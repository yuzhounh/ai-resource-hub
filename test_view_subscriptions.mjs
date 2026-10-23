import assert from 'node:assert/strict';
import test from 'node:test';
import {ActiveViewSubscriptions} from './view-subscriptions.mjs';
import fs from 'node:fs';
import vm from 'node:vm';

test('signed-in hidden view does no reads; opening shares one subscription and leaving releases it',()=>{
  let starts=0,stops=0;
  const watcher=new ActiveViewSubscriptions(()=>{starts++;return()=>{stops++}});
  watcher.update({uid:'a'},false);
  watcher.update(null,true);
  assert.equal(starts,0);
  watcher.update({uid:'a'},true);
  watcher.update({uid:'a'},true);
  assert.equal(starts,1);
  watcher.update({uid:'a'},false);
  assert.equal(stops,1);
  watcher.update({uid:'a'},true);
  assert.equal(starts,2);
});

test('queued callbacks from old account or old view cannot change the current account',()=>{
  const updates=[];
  const watcher=new ActiveViewSubscriptions((user,current)=>{
    updates.push(()=>current()?user.uid:null);
    return()=>{};
  });
  watcher.update({uid:'a'},true);
  assert.equal(updates[0](),'a');
  watcher.update({uid:'b'},true);
  assert.equal(updates[0](),null);
  assert.equal(updates[1](),'b');
  watcher.update({uid:'b'},false);
  assert.equal(updates[1](),null);
  watcher.update({uid:'a'},true);
  assert.equal(updates[0](),null);
  assert.equal(updates[2](),'a');
  watcher.update(null,false);
  assert.equal(updates[2](),null);
});

test('a failed start can retry and a synchronous account change cleans up the stale registration',()=>{
  let calls=0,stops=0;
  const retry=new ActiveViewSubscriptions(()=>{
    if(++calls===1)throw Error('unavailable');
    return()=>{};
  });
  assert.throws(()=>retry.update({uid:'a'},true),/unavailable/);
  retry.update({uid:'a'},true);
  assert.equal(calls,2);
  const watcher=new ActiveViewSubscriptions(()=>{
    watcher.update(null,false);
    return()=>stops++;
  });
  watcher.update({uid:'a'},true);
  assert.equal(stops,1);
  assert.equal(watcher.uid,null);
});

test('manager selects panel dependencies, coalesces renders and preserves complete legacy exports',()=>{
  const code=fs.readFileSync(new URL('./manager.js',import.meta.url),'utf8');
  const body=code.slice(code.indexOf('let managerRenderFrame=0;'),code.indexOf('function showPanel(name)'));
  const callbacks=[],frames=new Map(),exportButton={disabled:false},view={hidden:true};
  let renders=0,frameId=0;
  const context={ActiveViewSubscriptions,state:{user:{uid:'a'},data:{}},db:{},
    collectionNames:['plans','promotions','transactions','models','compatibilityTests','usageSnapshots','notes'],
    document:{getElementById:id=>id==='manager-export'?exportButton:view},els:{syncMessage:{}},
    setMessage(){},friendlyError:error=>error.message,addEventListener(){},renderActivePanel(){renders++},
    collection:(_db,...segments)=>segments,onSnapshot:(segments,next,error)=>{
      const callback={segments,next,error,stopped:false};callbacks.push(callback);return()=>{callback.stopped=true};
    },requestAnimationFrame:fn=>{frames.set(++frameId,fn);return frameId},cancelAnimationFrame:id=>frames.delete(id),
  };
  vm.runInNewContext(body+'\nthis.sync=syncManagerSubscriptions;',context);
  context.sync();assert.equal(callbacks.length,0);
  view.hidden=false;context.sync();assert.equal(callbacks.length,7);assert.equal(exportButton.disabled,true);
  callbacks.slice(0,6).forEach(item=>item.next({docs:[]}));assert.equal(exportButton.disabled,true);
  callbacks[6].next({docs:[]});assert.equal(exportButton.disabled,false);assert.equal(frames.size,1);
  frames.values().next().value();frames.clear();assert.equal(renders,1);
  view.hidden=true;context.sync();assert.ok(callbacks.every(item=>item.stopped));assert.equal(exportButton.disabled,true);
  callbacks[0].next({docs:[{id:'old',data:()=>({provider:'old user'})}]});
  assert.equal(context.state.data.plans.length,0);
  context.state.user={uid:'b'};view.hidden=false;context.sync();assert.equal(callbacks.length,14);
  assert.equal(callbacks[7].segments[1],'b');
  view.hidden=true;context.sync();view.hidden=false;
  let started=0;
  context.onSnapshot=(segments,next,error)=>{
    if(++started===2)throw Error('failed registration');
    return()=>{started--};
  };
  assert.throws(()=>context.sync(),/failed registration/);
  assert.equal(started,1);
  context.document.getElementById=id=>id==='manager-export'?null:view;
  context.state.activePanel='plans';
  context.onSnapshot=(segments,next,error)=>{callbacks.push({segments,next,error});return()=>{}};
  const before=callbacks.length;
  context.sync();
  assert.deepEqual(callbacks.slice(before).map(item=>item.segments[2]),['plans','promotions']);
  context.state.activePanel='compatibility';
  const plansEnd=callbacks.length;
  context.sync();
  assert.deepEqual(callbacks.slice(plansEnd).map(item=>item.segments[2]),['plans','models','compatibilityTests']);
});
