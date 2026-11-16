// Development fixture: actual cut/fragment pipeline, with repeatable sweeps on every tree.
export function createStress(world){
 const jobs=world.entities.filter(e=>e.kind==='tree'&&!e.detached).flatMap(e=>[1.1,.72].map(height=>({e,height})));
 let index=0,elapsed=0,next=0,doneAt=null,peak=0;
 return {step(dt){
  elapsed+=dt;peak=Math.max(peak,world.physics.dynamic.size);
  if(index<jobs.length&&elapsed>=next){const {e,height}=jobs[index];if(!e.pending){
   const y=e.y+height*e.scale;world.cut([e.x-2,y,e.z],[e.x+2,y,e.z],[0,1,0]);index++;next=elapsed+.35;
  }}
  if(index===jobs.length&&!world.entities.some(e=>e.pending)&&doneAt===null)doneAt=elapsed;
  return {cuts:index,total:jobs.length,bodies:world.physics.dynamic.size,peak,settledSeconds:doneAt===null?0:elapsed-doneAt};
 }};
}
