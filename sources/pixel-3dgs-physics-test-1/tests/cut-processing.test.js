import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {clusters} from '../src/push-lab/model.js';
import {rockPoints,createBeachWorld} from '../src/beach/world.js';
import {cutSurface} from '../src/beach/disc.js';
import {prepareCut} from '../src/beach/cut-processing.js';
const tree=JSON.parse(fs.readFileSync(new URL('../public/models/push-tree.json',import.meta.url))).points;
test('rock stays connected before cutting and retains both substantial halves after a full cut',()=>{
 const rock=rockPoints();assert.deepEqual(clusters(rock).map(g=>g.length),[640]);
 const cut=cutSurface(rock,[-2,.65,0],[2,.65,0],[0,1,0],1.5,.09);
 const result=prepareCut(cut.points,cut.contacts);
 assert.ok(result.groups[0].length>180);assert.ok(result.groups.slice(1).some(g=>g.length>180));
 assert.ok(result.discarded<24);
 assert.equal(clusters(result.groups.flat()).length,result.groups.filter(g=>g.length).length,'finishing must not reconnect the halves');
});
test('consecutive cuts coalesce pending work and never apply stale geometry',async()=>{
 const jobs=[];
 const w=await createBeachWorld(tree,{prepare:(points,contacts)=>new Promise(resolve=>jobs.push({points,contacts,resolve}))});
 try{
  const e=w.entities[0],cut=y=>w.cut([e.x-1,y,e.z],[e.x+1,y,e.z],[0,1,0]);
  assert.ok(cut(e.y+.72*e.scale)>0);const firstCount=e.points.length;
  assert.ok(cut(e.y+.77*e.scale)>0);const latest=e.points;
  assert.ok(latest.length<firstCount);assert.equal(jobs.length,1);
  jobs[0].resolve(prepareCut(jobs[0].points,jobs[0].contacts));await Promise.resolve();w.step(0);
  assert.equal(e.points,latest);assert.equal(jobs.length,2);assert.equal(w.physics.dynamic.size,0);
  jobs[1].resolve(prepareCut(jobs[1].points,jobs[1].contacts));await Promise.resolve();w.step(0);
  assert.ok(w.physics.dynamic.size>0);assert.ok(w.entities.every(e=>!e.pending));
  const top=w.entities.find(e=>e.detached&&e.points.length>500);assert.ok(top);
  const y=top.y+1.1*top.scale;w.cut([top.x-1,y,top.z],[top.x+1,y,top.z],[0,1,0]);
  assert.ok(jobs.length>2,'new fragments can schedule another cut');
 }finally{w.dispose();}
 for(const job of jobs.slice(2))job.resolve(prepareCut(job.points,job.contacts));await Promise.resolve();
});
test('prebuilt collision hulls preserve bounds and support a falling fragment',async()=>{
 const {createPhysics,prepareColliders}=await import('../src/push-lab/physics.js');
 const points=rockPoints().map(p=>({...p,p:[p.p[0],p.p[1]+2,p.p[2]]}));
 const [data]=await prepareColliders([points],.6),a=await createPhysics({cell:.6}),b=await createPhysics({cell:.6});
 const transfer=data.flatMap(c=>c.vertices?[c.vertices.buffer,...(c.indices?[c.indices.buffer]:[])]:[]);
 const prepared=structuredClone(data,{transfer});assert.ok(transfer.every(buffer=>buffer.byteLength===0));
 try{
  const direct=a.addDynamic(1,points),cached=b.addDynamic(1,null,prepared);
  assert.ok(Math.abs(direct.mass()-cached.mass())/direct.mass()<.0001);
  for(let i=0;i<30;i++){a.step(1/60);b.step(1/60);}
  assert.ok(Math.abs(direct.worldCom().y-cached.worldCom().y)<.001);
  b.setFixed(2,null,prepared);assert.equal(b.fixed.get(2).length,prepared.length);
 }finally{a.dispose();b.dispose();}
});
