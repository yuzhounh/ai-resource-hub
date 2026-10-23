export function initConnectivity(records){
    // Connectivity View Logic
    const connectivitySearch=document.getElementById('connectivity-search');
    const connTbody=document.querySelector('#view-connectivity table tbody');
    const connCards=Array.from(document.querySelectorAll('#view-connectivity .provider-card'));
    const connFilters=Array.from(document.querySelectorAll('#view-connectivity .filter-btn'));
    const connSortHeaders=Array.from(document.querySelectorAll('#view-connectivity th.sortable'));
    const connStatusOrder={SUCCESS:0,BATCH:1,SKIPPED:2,FAILED:3};
    const connRows=records.map(row=>({...row,
      search:row.search.toLowerCase(), model:row.model.toLowerCase(), protocol:row.protocol.toLowerCase()
    }));
    let connProviderFilter='ALL';
    let connStatusFilter='ALL';
    let connSortColumn=null;
    let connSortDirection=1;
    let connSearchTimer;
    let connPageSize=25;
    let connCurrentPage=1;
    let connMatchedRows=[];

    // 归档状态完全由 Plan 管理驱动：Plan 中归档的服务商，在连通性页自动归档
    let connShowArchived=false;
    let connEffectiveSet=new Set();

    // Plan 管理归档的服务商 → 与连通性卡片名称精确匹配（名称已统一）
    function connMatchPlanProviders(planProviders){
      const keys=new Set((planProviders||[]).map(s=>String(s).trim().toLowerCase()).filter(Boolean));
      const out=new Set();
      connCards.forEach(card=>{
        const name=String(card.dataset.provider||'').trim();
        if(name&&keys.has(name.toLowerCase())) out.add(name);
      });
      return out;
    }

    function applyConnArchiveVisibility(){
      connCards.forEach(card=>{
        const p=card.dataset.provider;
        const archived=connEffectiveSet.has(p);
        card.classList.toggle('conn-archived',archived);
        if(archived&&!connShowArchived){ card.setAttribute('data-conn-hidden','1'); }
        else{ card.removeAttribute('data-conn-hidden'); }
      });
      const providersCountEl=document.getElementById('connProvidersCount');
      if(providersCountEl) providersCountEl.textContent=connCards.filter(card=>!card.hasAttribute('data-conn-hidden')).length;
      const toggleBtn=document.getElementById('connShowArchivedToggle');
      if(toggleBtn){
        const count=connEffectiveSet.size;
        toggleBtn.innerHTML=connShowArchived?`隐藏归档 <em>${count}</em>`:`显示归档 <em>${count}</em>`;
        toggleBtn.classList.toggle('active',connShowArchived);
        toggleBtn.hidden=count===0&&!connShowArchived;
      }
    }

    // "显示归档"切换按钮
    const connShowArchivedToggle=document.getElementById('connShowArchivedToggle');
    if(connShowArchivedToggle) connShowArchivedToggle.addEventListener('click',()=>{
      connShowArchived=!connShowArchived;
      applyConnArchiveVisibility();
      applyConnFilters(true);
      updateConnDetailControls();
    });

    // 接入 hub-auth：监听 Plan 管理归档变化 → 本页对应服务商自动归档
    function connSyncFromHub(){
      connEffectiveSet=window.HubAuth?connMatchPlanProviders(HubAuth.getArchivedPlanProviders()):new Set();
      applyConnArchiveVisibility();
      applyConnFilters(true);
      updateConnDetailControls();
    }
    function connBindHub(){
      if(!window.HubAuth) return;
      HubAuth.onChange(connSyncFromHub);
      document.addEventListener('hub-archived-plans',connSyncFromHub);
    }


    applyConnArchiveVisibility();

    function renderConnPagination(){
      const total=connMatchedRows.length;
      const totalPages=Math.max(1,Math.ceil(total/connPageSize));
      connCurrentPage=Math.min(connCurrentPage,totalPages);
      const totalEl=document.getElementById('connTotalCount');
      if(totalEl) totalEl.textContent=total;
      const pageInfoEl=document.getElementById('connPageInfo');
      if(pageInfoEl) pageInfoEl.textContent=`${connCurrentPage} / ${totalPages}`;
      const prevBtn=document.getElementById('connPrevPage');
      const nextBtn=document.getElementById('connNextPage');
      if(prevBtn) prevBtn.disabled=connCurrentPage<=1;
      if(nextBtn) nextBtn.disabled=connCurrentPage>=totalPages;
      const pagesEl=document.getElementById('connPageButtons');
      if(pagesEl){
        pagesEl.innerHTML='';
        const range=[];
        if(totalPages<=7){for(let i=1;i<=totalPages;i++) range.push(i);}
        else{
          range.push(1);
          if(connCurrentPage>3) range.push('…');
          for(let i=Math.max(2,connCurrentPage-1);i<=Math.min(totalPages-1,connCurrentPage+1);i++) range.push(i);
          if(connCurrentPage<totalPages-2) range.push('…');
          range.push(totalPages);
        }
        range.forEach(item=>{
          if(item==='…'){const s=document.createElement('span');s.className='pagination-ellipsis';s.textContent='…';pagesEl.appendChild(s);}
          else{const b=document.createElement('button');b.type='button';b.className='pagination-page-btn'+(item===connCurrentPage?' active':'');b.textContent=item;b.addEventListener('click',()=>{connCurrentPage=item;applyConnPaging();});pagesEl.appendChild(b);}
        });
      }
    }

    function applyConnPaging(){
      const start=(connCurrentPage-1)*connPageSize;
      const end=start+connPageSize;
      const fragment=document.createDocumentFragment();
      const template=document.createElement('template');
      connMatchedRows.slice(start,end).forEach(row=>{
        template.innerHTML='<table><tbody>'+row.html+'</tbody></table>';
        fragment.appendChild(template.content.querySelector('tr'));
      });
      connTbody.replaceChildren(fragment);
      renderConnPagination();
      const emptyEl=document.getElementById('emptyState');
      if(emptyEl) emptyEl.hidden=connMatchedRows.length!==0;
    }

    function applyConnFilters(resetPage){
      if(resetPage!==false) connCurrentPage=1;
      clearTimeout(connSearchTimer);
      const query=connectivitySearch.value.trim().toLowerCase();
      connMatchedRows=connRows.filter(row=>(connProviderFilter==='ALL'||row.provider===connProviderFilter)
        &&(connStatusFilter==='ALL'||row.status===connStatusFilter)&&row.search.includes(query)
        &&(connShowArchived||!connEffectiveSet.has(row.provider)));
      applyConnPaging();
      const scopeCount=connRows.filter(r=>(connProviderFilter==='ALL'||r.provider===connProviderFilter)&&(connShowArchived||!connEffectiveSet.has(r.provider))).length;
      const resCountEl=document.getElementById('resultCount');
      if(resCountEl) resCountEl.textContent=`显示 ${connMatchedRows.length} / ${scopeCount} 个模型`;
    }
    connectivitySearch.addEventListener('input',()=>{
      clearTimeout(connSearchTimer);
      connSearchTimer=setTimeout(()=>applyConnFilters(true),100);
    });

    const connPageSizeSelect=document.getElementById('connPageSize');
    if(connPageSizeSelect) connPageSizeSelect.addEventListener('change',()=>{connPageSize=parseInt(connPageSizeSelect.value,10);connCurrentPage=1;applyConnFilters(false);});
    const connPrevBtn=document.getElementById('connPrevPage');
    const connNextBtn=document.getElementById('connNextPage');
    if(connPrevBtn) connPrevBtn.addEventListener('click',()=>{if(connCurrentPage>1){connCurrentPage--;applyConnPaging();}});
    if(connNextBtn) connNextBtn.addEventListener('click',()=>{const tp=Math.ceil(connMatchedRows.length/connPageSize);if(connCurrentPage<tp){connCurrentPage++;applyConnPaging();}});

    // Initialize pagination
    applyConnFilters(true);

    const initialConnStats={
      providerLabel:document.getElementById('providerStatLabel')?.textContent||'目录请求成功 / 已配置',
      providerValue:document.getElementById('providerStatValue')?.textContent||'16 / 16',
      providerSub:document.getElementById('providerStatSub')?.textContent||'目录失败 0 / 缺少凭据 0',
      successLabel:document.getElementById('successStatLabel')?.textContent||'模型实测成功',
      successValue:document.getElementById('successStatValue')?.textContent||'202',
      successSub:document.getElementById('successStatSub')?.textContent||'Chat: 190 | Resp: 10 | Anth: 10',
      skippedValue:document.getElementById('skippedStatValue')?.textContent||'871',
      skippedSub:document.getElementById('skippedStatSub')?.textContent||'41 Batch推断 / 131 分类跳过 / 699 未测试',
      latencyValue:document.getElementById('latencyStatValue')?.textContent||'2435 ms',
      latencySub:document.getElementById('latencyStatSub')?.textContent||'仅统计成功记录'
    };

    function updateConnDetailControls(){
      const selected=connProviderFilter==='ALL'?null:connProviderFilter;
      const rowVisible=r=>connShowArchived||!connEffectiveSet.has(r.provider);
      const scopedRows=connRows.filter(r=>selected?r.provider===selected:rowVisible(r));
      const counts={ALL:scopedRows.length,SUCCESS:0,BATCH:0,SKIPPED:0,FAILED:0};
      const successLatencies=[];
      const successProto={chat:0,resp:0,anth:0};
      scopedRows.forEach(r=>{
        if(r.status==='SUCCESS'){
          counts.SUCCESS++;
          if(r.latency>0) successLatencies.push(r.latency);
          if(r.protocol.includes('chat')) successProto.chat++;
          if(r.protocol.includes('responses')) successProto.resp++;
          if(r.protocol.includes('anthropic')) successProto.anth++;
        }else if(r.status==='BATCH'){
          counts.BATCH++;
        }else if(r.status==='FAILED'){
          counts.FAILED++;
        }else{
          counts.SKIPPED++;
        }
      });
      const labels={ALL:'全部',SUCCESS:'成功',BATCH:'Batch',SKIPPED:'跳过/未测试',FAILED:'探测失败'};
      connFilters.forEach(btn=>{
        const st=btn.dataset.status;
        if(st && counts[st]!==undefined){
          btn.textContent=`${labels[st]} (${counts[st]})`;
        }
      });
      const refreshBtn=document.getElementById('refreshScope');
      if(refreshBtn){
        refreshBtn.textContent=selected?'刷新当前':'刷新全部';
        refreshBtn.title=selected?`刷新 ${selected}`:'刷新全部服务商';
        refreshBtn.setAttribute('aria-label',selected?`刷新 ${selected}`:'刷新全部服务商');
      }
      const pLabel=document.getElementById('providerStatLabel');
      const pVal=document.getElementById('providerStatValue');
      const pSub=document.getElementById('providerStatSub');
      const sLabel=document.getElementById('successStatLabel');
      const sVal=document.getElementById('successStatValue');
      const sSub=document.getElementById('successStatSub');
      const skVal=document.getElementById('skippedStatValue');
      const skSub=document.getElementById('skippedStatSub');
      const lVal=document.getElementById('latencyStatValue');
      const lSub=document.getElementById('latencyStatSub');
      if(selected){
        if(pLabel) pLabel.textContent='当前选中服务商';
        if(pVal) pVal.textContent=selected;
        if(pSub) pSub.textContent=`共 ${counts.ALL} 个模型`;
        if(sLabel) sLabel.textContent=`${selected} 实测成功`;
        if(sVal) sVal.textContent=String(counts.SUCCESS);
        const rate=counts.ALL?Math.round(counts.SUCCESS/counts.ALL*100):0;
        if(sSub) sSub.textContent=`实测成功率 ${rate}%`;
        if(skVal) skVal.textContent=String(counts.SKIPPED+counts.BATCH);
        if(skSub) skSub.textContent=`${counts.BATCH} Batch推断 / ${counts.SKIPPED} 跳过或未测试`;
        const avgLat=successLatencies.length?Math.round(successLatencies.reduce((a,b)=>a+b,0)/successLatencies.length)+' ms':'-';
        if(lVal) lVal.textContent=avgLat;
        if(lSub) lSub.textContent=successLatencies.length?`基于 ${successLatencies.length} 个成功模型响应`:'暂无成功样本';
      }else{
        const visibleProviders=connCards.filter(c=>connShowArchived||!connEffectiveSet.has(c.dataset.provider)).length;
        if(pLabel) pLabel.textContent=initialConnStats.providerLabel;
        if(pVal) pVal.textContent=`${visibleProviders} / ${visibleProviders}`;
        if(pSub) pSub.textContent=initialConnStats.providerSub;
        if(sLabel) sLabel.textContent=initialConnStats.successLabel;
        if(sVal) sVal.textContent=String(counts.SUCCESS);
        if(sSub) sSub.textContent=`Chat: ${successProto.chat} | Resp: ${successProto.resp} | Anth: ${successProto.anth}`;
        if(skVal) skVal.textContent=String(counts.BATCH+counts.SKIPPED);
        if(skSub) skSub.textContent=`${counts.BATCH} Batch推断 / ${counts.SKIPPED} 跳过或未测试`;
        const avgLat=successLatencies.length?Math.round(successLatencies.reduce((a,b)=>a+b,0)/successLatencies.length)+' ms':'-';
        if(lVal) lVal.textContent=avgLat;
        if(lSub) lSub.textContent=initialConnStats.latencySub;
      }
    }

    connCards.forEach(card=>card.addEventListener('click',e=>{
      if(e.target.closest('.copy-btn')) return;
      const provider=card.dataset.provider;
      connProviderFilter=connProviderFilter===provider?'ALL':provider;
      connCards.forEach(item=>{
        const sel=item.dataset.provider===connProviderFilter;
        item.classList.toggle('selected',sel);
        const selBtn=item.querySelector('.provider-select');
        if(selBtn) selBtn.setAttribute('aria-pressed',String(sel));
      });
      applyConnFilters(true);
      updateConnDetailControls();
    }));

    connFilters.forEach(btn=>btn.addEventListener('click',()=>{
      connStatusFilter=btn.dataset.status;
      connFilters.forEach(item=>{
        const sel=item===btn;
        item.classList.toggle('active',sel);
        item.setAttribute('aria-pressed',String(sel));
      });
      applyConnFilters(true);
    }));

    function sortConnTable(col){
      if(connSortColumn!==col){connSortColumn=col;connSortDirection=1;}
      else if(connSortDirection===1) connSortDirection=-1;
      else {connSortColumn=null;connSortDirection=1;}
      connRows.sort((a,b)=>{
        if(!connSortColumn) return (a.provider.localeCompare(b.provider)) || (a.model.localeCompare(b.model));
        let res=0;
        if(connSortColumn==='latency'){
          if((a.latency<=0)!==(b.latency<=0)) return a.latency<=0?1:-1;
          res=a.latency-b.latency;
        }else if(connSortColumn==='status'){
          res=(connStatusOrder[a.status]??9)-(connStatusOrder[b.status]??9);
        }else{
          res=a.protocol.localeCompare(b.protocol);
        }
        return res*connSortDirection || a.model.localeCompare(b.model);
      });
      connSortHeaders.forEach(h=>{
        const sel=h.dataset.sort===connSortColumn;
        h.classList.toggle('th-active',sel);
        h.setAttribute('aria-sort',sel?(connSortDirection===1?'ascending':'descending'):'none');
        const ind=h.querySelector('.sort-ind');
        if(ind) ind.textContent=sel?(connSortDirection===1?'▲':'▼'):'↕';
      });
      applyConnFilters(true);
    }
    connSortHeaders.forEach(h=>{
      h.addEventListener('click',()=>sortConnTable(h.dataset.sort));
    });

    document.querySelectorAll('#view-connectivity .copy-btn').forEach(button=>{
      let resetTimer;
      const origTitle=button.title;
      button.addEventListener('click',async e=>{
        e.stopPropagation();
        const url=button.dataset.copyUrl;
        let success=false;
        try{
          if(navigator.clipboard&&navigator.clipboard.writeText){
            await navigator.clipboard.writeText(url);
            success=true;
          }
        }catch(_){}
        if(!success){
          const ta=document.createElement('textarea');
          ta.value=url;ta.style.position='fixed';ta.style.left='-9999px';
          document.body.appendChild(ta);ta.select();
          try{success=document.execCommand('copy');}catch(_){}
          ta.remove();
        }
        clearTimeout(resetTimer);
        button.classList.toggle('copied',success);
        button.title=success?'已复制':'复制失败';
        const st=document.getElementById('copyStatus');
        if(st) st.textContent=button.title;
        resetTimer=setTimeout(()=>{button.classList.remove('copied');button.title=origTitle;},2000);
      });
    });

    if(document.readyState==='loading') addEventListener('DOMContentLoaded',connBindHub,{once:true}); else connBindHub();
    connSyncFromHub();

}
