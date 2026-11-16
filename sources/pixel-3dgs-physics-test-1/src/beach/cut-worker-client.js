export function createCutWorker(){
 const worker=new Worker(new URL('./cut-worker.js',import.meta.url),{type:'module'}),pending=new Map();let serial=0,failure=null;
 worker.onmessage=({data})=>{const job=pending.get(data.id);if(!job)return;pending.delete(data.id);if(data.error)job.reject(new Error(data.error));else job.resolve(data.result);};
 worker.onerror=event=>{failure=new Error(event.message||'Cut worker failed');for(const job of pending.values())job.reject(failure);pending.clear();};
 return {prepare(points,contacts,placement){if(failure)return Promise.reject(failure);return new Promise((resolve,reject)=>{const id=serial++;pending.set(id,{resolve,reject});worker.postMessage({id,points,contacts,placement});});},
 dispose(){worker.terminate();failure=new Error('Cut worker disposed');for(const job of pending.values())job.reject(failure);pending.clear();}};
}
