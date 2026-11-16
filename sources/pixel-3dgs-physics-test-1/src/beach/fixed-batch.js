import {cacheSplatWrites} from './splat-cache.js';
// Stable slots prevent a cut in one object from repacking every other object.
export function createFixedBatch(splats,write){
 const ranges=new Map();let count=0;
 const clear=d=>splats.packedArray.fill(0,d.start*4,(d.start+d.capacity)*4);
 return {sync(entities){
  const live=new Set(),present=new Set(entities.map(e=>e.id));let changed=false;
  for(const e of entities){
   if(e.detached&&!e.rigid?.isSleeping())continue;live.add(e.id);let d=ranges.get(e.id);
   if(!d){d={start:count,capacity:e.points.length,revision:-1,write:cacheSplatWrites((s,i,v)=>write(s,i,v,e))};count+=d.capacity;ranges.set(e.id,d);}
   if(d.revision===e.revision)continue;
   if(d.revision===-1)d.write=cacheSplatWrites((s,i,v)=>write(s,i,v,e));
   if(e.points.length>d.capacity){clear(d);d.start=count;d.capacity=e.points.length;count+=d.capacity;}
   splats.ensureSplats(count);clear(d);
   e.points.forEach((v,i)=>d.write(splats,d.start+i,v));d.revision=e.revision;changed=true;
  }
  for(const [id,d] of ranges)if(!live.has(id)){if(d.revision!==-1){clear(d);d.revision=-1;changed=true;}if(!present.has(id))ranges.delete(id);}
  if(changed){splats.numSplats=count;splats.needsUpdate=true;}
  return changed;
 }};
}
