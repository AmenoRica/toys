import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createPhysics} from '../src/push-lab/physics.js';
import {push,partition,settings} from '../src/push-lab/model.js';
function cube(x,y,z,size=.08){
  const points=[];
  const count=Math.max(2,Math.ceil(size/.02));
  for(let axis=0;axis<3;axis++)for(const sign of [-1,1])for(let i=0;i<=count;i++)for(let j=0;j<=count;j++){
    const p=[x,y,z],n=[0,0,0];n[axis]=sign;p[axis]+=sign*size/2;p[(axis+1)%3]+=(i/count-.5)*size;p[(axis+2)%3]+=(j/count-.5)*size;
    points.push({p,n,r:.01,anchor:false});
  }
  return points;
}
function run(p,seconds){for(let i=0;i<seconds*60;i++)p.step(1/60);}
test('detached object starts without a jump, falls, rotates and rests on the lawn',async()=>{
  const p=await createPhysics();try{
    const points=cube(.1,1,.1),before=structuredClone(points),b=p.addDynamic(1,points);
    assert.deepEqual({...b.translation()},{x:0,y:0,z:0});assert.equal(b.rotation().w,1);
    const initial=b.worldCom().y;b.setAngvel({x:.5,y:0,z:1},true);
    run(p,.3);assert.ok(b.worldCom().y<initial-.2);assert.ok(Math.abs(b.rotation().z)>.02);
    run(p,8);assert.ok(b.worldCom().y>-.04&&b.worldCom().y<.08);assert.ok(Math.abs(b.linvel().y)<.03);
    assert.deepEqual(points,before);
  }finally{p.dispose();}
});
test('fixed remaining wood supports a fragment and a collider update releases it',async()=>{
  const p=await createPhysics();try{
    p.setFixed(0,cube(.1,.3,.1,.2));const b=p.addDynamic(1,cube(.1,.7,.1));
    run(p,3);assert.ok(b.worldCom().y>.4);
    p.setFixed(0,[]);run(p,3);assert.ok(b.worldCom().y<.08);
  }finally{p.dispose();}
});
test('detached fragments collide with each other and reset removes their physics',async()=>{
  const p=await createPhysics();try{
    const a=p.addDynamic(1,cube(.1,.3,.1)),b=p.addDynamic(2,cube(.1,.7,.1));run(p,5);
    assert.ok(Math.abs(a.worldCom().y-b.worldCom().y)>.055);
    p.remove(1);assert.equal(p.dynamic.size,1);
    p.reset();assert.equal(p.dynamic.size,0);assert.equal(p.fixed.size,0);assert.equal(p.world.colliders.len(),1);
    assert.throws(()=>p.step(NaN));assert.throws(()=>p.addDynamic(3,[]));
  }finally{p.dispose();}
});
test('an actual cut palm falls and tips against its remaining trunk without an artificial impulse',async()=>{
  let points=JSON.parse(fs.readFileSync(new URL('../public/models/push-tree.json',import.meta.url))).points,split;
  for(let i=0;i<120;i++){
    const r=push(points,[0,.72,.24-i*settings.step],[0,0,-1],.29);points=r.points;
    if(r.removed){const result=partition(points);if(result.detached.some(g=>g.length>500)){split=result;break;}}
  }
  assert.ok(split);
  const p=await createPhysics();try{
    p.setFixed(0,split.attached);const b=p.addDynamic(1,split.detached.find(g=>g.length>500)),start=b.worldCom().y;
    run(p,1);
    assert.ok(b.worldCom().y<start-.2);assert.ok(Math.hypot(b.rotation().x,b.rotation().y,b.rotation().z)>.1);
    assert.ok(b.worldCom().y>-.2);assert.ok(Number.isFinite(b.linvel().y));
    run(p,5);const end=b.worldCom();
    // The finite lawn has an edge; falling below it is valid only outside the lawn.
    if(end.y<-.2)assert.ok(Math.hypot(end.x,end.z)>1.65);
  }finally{p.dispose();}
});
