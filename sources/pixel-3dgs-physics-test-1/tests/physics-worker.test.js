import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {createPhysicsClient} from '../src/beach/physics-client.js';
import {createPhysics,prepareColliders} from '../src/push-lab/physics.js';
function worker(){
 const url=new URL('../src/beach/physics-service.js',import.meta.url).href;
 const instance=new Worker(new URL('data:text/javascript,'+encodeURIComponent(`import {parentPort} from 'node:worker_threads';import {physicsService} from ${JSON.stringify(url)};const handle=physicsService((data,transfer=[])=>parentPort.postMessage(data,transfer));parentPort.on('message',handle);`)),{type:'module'});
 const adapter={postMessage:(...args)=>instance.postMessage(...args),terminate:()=>instance.terminate()};instance.on('message',data=>adapter.onmessage?.({data}));instance.on('error',error=>adapter.onerror?.(error));return adapter;
}
function cube(y){const points=[];for(const x of [-.05,.05])for(const dy of [-.05,.05])for(const z of [-.05,.05])points.push({p:[x,y+dy,z],n:[0,1,0],r:.02});return points;}
test('worker physics matches direct collisions, gravity and re-cut velocity inheritance',async()=>{
 const remote=await createPhysicsClient(worker(),{}),direct=await createPhysics(),points=cube(1);
 try{
  const [prepared]=await prepareColliders([points],.16);
  const a=direct.addDynamic(1,null,structuredClone(prepared)),b=remote.addDynamic(1,null,prepared);await remote.flush();
  for(const body of [a,b]){body.setLinvel({x:.1,y:0,z:.1},true);body.setAngvel({x:.2,y:.3,z:.1},true);}
  for(let i=0;i<90;i++){direct.step(1/60);remote.step(1/60);await remote.flush();}
  for(const key of ['x','y','z'])assert.ok(Math.abs(a.worldCom()[key]-b.worldCom()[key])<1e-5);
  const inherit={p:{...b.translation()},q:{...b.rotation()},v:{...b.linvel()},w:{...b.angvel()},com:{...b.worldCom()}};
  const [fragment]=await prepareColliders([points.slice(0,4)],.16);
  direct.remove(1);remote.remove(1);const c=direct.addDynamic(2,null,structuredClone(fragment),inherit),d=remote.addDynamic(2,null,fragment,inherit);await remote.flush();
  for(const key of ['x','y','z'])assert.ok(Math.abs(c.linvel()[key]-d.linvel()[key])<1e-5);
  assert.equal(remote.dynamic.has(1),false);assert.equal(remote.metrics.bodies,1);assert.equal(remote.metrics.droppedTime,0);
  direct.setFixed(3,cube(.3));remote.setFixed(3,cube(.3));await remote.flush();assert.equal(remote.metrics.colliders,direct.world.colliders.len());
 }finally{remote.dispose();direct.dispose();}
});
test('one in-flight job bounds catch-up and stale poses cannot resurrect deleted bodies',async()=>{
 const sent=[],fake={postMessage(data){sent.push(data);if(data.type==='init')queueMicrotask(()=>fake.onmessage({data:{type:'ready'}}));},terminate(){}};
 const p=await createPhysicsClient(fake,{});
 try{
  p.addDynamic(1,cube(1));p.step(1/60);
  for(let i=0;i<100;i++)p.step(1/60);
  assert.equal(sent.filter(s=>s.type==='frame').length,1);assert.ok(p.metrics.droppedTime>0);
  p.remove(1);const data=sent.at(-1);fake.onmessage({data:{type:'state',sequence:data.sequence,states:new Float64Array([1,9,9,9,0,0,0,1,0,0,0,0,0,0,9,9,9,0]),metrics:{}}});
  assert.equal(p.dynamic.has(1),false);assert.ok(sent.at(-1).dt<=.05);
 }finally{p.dispose();}
});
test('worker failures reject flush instead of silently leaving pending physics',async()=>{
 const p=await createPhysicsClient(worker(),{});
 try{p.addDynamic(1,[]);await assert.rejects(p.flush(),/Empty dynamic fragment/);assert.ok(p.error);}finally{p.dispose();}
});

test('sleeping fragments wake when their fixed support is removed remotely',async()=>{
 const p=await createPhysicsClient(worker(),{});
 try{
  p.setFixed(0,null,[{box:{x:.2,y:.1,z:.2},p:{x:0,y:.3,z:0}}]);const b=p.addDynamic(1,cube(.6));await p.flush();
  for(let i=0;i<240;i++){p.step(1/60);await p.flush();}
  assert.ok(b.isSleeping());assert.ok(b.worldCom().y>.35);
  p.setFixed(0,[]);await p.flush();
  for(let i=0;i<240;i++){p.step(1/60);await p.flush();}
  assert.ok(b.worldCom().y<.1);
 }finally{p.dispose();}
});
