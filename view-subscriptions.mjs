// Ownership guard also invalidates callbacks already queued when unsubscribing.
export class ActiveViewSubscriptions {
  constructor(subscribe) {
    this.subscribe=subscribe;
    this.uid=null;
    this.scope='';
    this.generation=0;
    this.stop=null;
  }
  update(user,active,scope='') {
    const wanted=active&&user ? user.uid : null;
    if(this.uid===wanted&&this.scope===scope) return;
    this.uid=wanted;
    this.scope=scope;
    const generation=++this.generation;
    this.stop?.();
    this.stop=null;
    if(!wanted) return;
    const current=()=>this.generation===generation&&this.uid===wanted;
    try {
      const stop=this.subscribe(user,current,scope);
      if(current()) this.stop=stop;
      else stop();
    } catch(error) {
      this.uid=null;
      this.generation++;
      throw error;
    }
  }
}
