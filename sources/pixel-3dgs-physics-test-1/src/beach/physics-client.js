export function createPhysicsWorker(options){
 return createPhysicsClient(new Worker(new URL('./physics-worker.js',import.meta.url),{type:'module'}),options);
}
export function createPhysicsClient(worker,options){
 return new Promise((resolve,reject)=>{
  const dynamic=new Map(),fixed=new Map(),commands=[],waiters=[],metrics={stepMs:0,commandMs:0,bodies:0,awake:0,colliders:0,latencyMs:0,droppedTime:0};
  let sequence=0,inflight=false,pendingTime=0,sentAt=0,error=null,disposed=false,ready=false;
  const fail=reason=>{error=reason instanceof Error?reason:new Error(String(reason));reject(error);for(const w of waiters.splice(0))w.reject(error);};
  const enqueue=(op,id,args=[])=>{if(error)throw error;if(disposed)throw new Error('Physics disposed');commands.push({op,id,args});return ++sequence;};
  function pump(){
   if(!ready||inflight||disposed||error)return;
   if(!commands.length&&pendingTime<1/60){for(const w of waiters.splice(0))w.resolve();return;}
   // shortcut: cap backlog at 100ms; sustained overload slows simulation rather than freezing rendering.
   const dt=Math.min(pendingTime,1/60),batch=commands.splice(0);pendingTime-=dt;inflight=true;sentAt=performance.now();
   const transfer=[];
   for(const c of batch)if(c.op==='fixed'||c.op==='add')for(const shape of c.args[1]||[])if(shape.vertices){transfer.push(shape.vertices.buffer);if(shape.indices)transfer.push(shape.indices.buffer);}
   try{worker.postMessage({type:'frame',commands:batch,dt,sequence},[...new Set(transfer)]);}catch(e){inflight=false;fail(e);}
  }
  const body=(id,inherit)=>{
   const p={x:0,y:0,z:0,...inherit?.p},q={x:0,y:0,z:0,w:1,...inherit?.q},v={x:0,y:0,z:0,...inherit?.v},w={x:0,y:0,z:0,...inherit?.w},com={x:0,y:0,z:0,...inherit?.com};
   const b={p,q,v,w,com,lastCommand:sequence,sleeping:false,translation:()=>p,rotation:()=>q,linvel:()=>v,angvel:()=>w,worldCom:()=>com,isSleeping:()=>b.sleeping};
   for(const [method,value] of [['setTranslation',p],['setRotation',q],['setLinvel',v],['setAngvel',w]])b[method]=next=>{Object.assign(value,next);b.lastCommand=enqueue(method,id,[next]);};
   return b;
  };
  const client={dynamic,fixed,metrics,get error(){return error;},
   setFixed(id,points,prepared){enqueue('fixed',id,[points,prepared]);fixed.set(id,true);},
   addDynamic(id,points,prepared,inherit=null){if(dynamic.has(id))throw new Error('Duplicate dynamic fragment');enqueue('add',id,[points,prepared,inherit]);const b=body(id,inherit);dynamic.set(id,b);return b;},
   remove(id){enqueue('remove',id);dynamic.delete(id);fixed.delete(id);},
   step(dt){
    if(!Number.isFinite(dt)||dt<0)throw new Error('Invalid physics time');
    if(metrics.needsStep||[...dynamic.values()].some(b=>!b.isSleeping())){const sum=pendingTime+Math.min(dt,.05);metrics.droppedTime+=Math.max(0,sum-.1);pendingTime=Math.min(sum,.1);}else pendingTime=0;
    pump();
   },
   flush(){if(error)return Promise.reject(error);if(disposed)return Promise.reject(new Error('Physics disposed'));return new Promise((resolve,reject)=>{waiters.push({resolve,reject});pump();});},
   dispose(){disposed=true;worker.terminate();dynamic.clear();fixed.clear();commands.length=0;for(const w of waiters.splice(0))w.reject(new Error('Physics disposed'));},
  };
  worker.onmessage=({data})=>{
   if(disposed)return;
   if(data.type==='ready'){ready=true;resolve(client);return;}
   if(data.type==='error'){inflight=false;fail(new Error(data.error));return;}
   if(data.type!=='state')return;
   inflight=false;Object.assign(metrics,data.metrics,{latencyMs:performance.now()-sentAt});
   const s=data.states;
   for(let i=0;i<s.length;i+=18){const b=dynamic.get(s[i]);if(!b||b.lastCommand>data.sequence)continue;
    Object.assign(b.p,{x:s[i+1],y:s[i+2],z:s[i+3]});Object.assign(b.q,{x:s[i+4],y:s[i+5],z:s[i+6],w:s[i+7]});
    Object.assign(b.v,{x:s[i+8],y:s[i+9],z:s[i+10]});Object.assign(b.w,{x:s[i+11],y:s[i+12],z:s[i+13]});Object.assign(b.com,{x:s[i+14],y:s[i+15],z:s[i+16]});b.sleeping=!!s[i+17];
   }
   pump();
  };
  worker.onerror=e=>fail(new Error(e.message||'Physics worker failed'));
  worker.postMessage({type:'init',options});
 });
}
