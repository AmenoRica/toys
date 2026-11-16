import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {PackedSplats} from '@sparkjsdev/spark';
import {writeSplat} from '../src/beach/write-splat.js';
test('batched surfaces preserve placement, leaf rotation, scale and material flags',()=>{
 const points=[{p:[.1,.7,-.2],n:[.7,.7,0],r:.04,c:[.2,.3,.4]},
 {p:[.4,1.2,.8],n:[0,1,0],r:.03,c:[.4,.5,.2],scale:[.1,.02,.01],quaternion:new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),.4).toArray(),leaf:true}];
 const e={x:12,y:1,z:-8,angle:.8,scale:3},buffer=new PackedSplats(),rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),e.angle);
 points.forEach((v,i)=>{
  writeSplat(buffer,i,v,e);const actual=buffer.getSplat(i),expected=new THREE.Vector3(...v.p).multiplyScalar(e.scale).applyQuaternion(rotation).add(new THREE.Vector3(e.x,e.y,e.z));
  assert.ok(actual.center.distanceTo(expected)<.02);
  const q=v.quaternion?new THREE.Quaternion(...v.quaternion):new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(...v.n).normalize());q.premultiply(rotation);
  assert.ok(actual.quaternion.angleTo(q)<.04);assert.ok(Math.abs(actual.opacity-(v.leaf?.8:1))<.01);
  const size=new THREE.Vector3(...(v.scale||[v.r,v.r,v.r*.45])).multiplyScalar(e.scale);for(const axis of ['x','y','z'])assert.ok(Math.abs(actual.scales[axis]/size[axis]-1)<.05);
 });
});
test('palette pass resolves at art resolution and restores the caller target and pixel grid',async()=>{
 const {createPost}=await import('../src/render/post.js'),post=createPost({lowResolution:true}),destination={name:'screen'},calls=[];let target=destination;
 const renderer={getRenderTarget:()=>target,setRenderTarget:t=>{target=t;},render:scene=>{
  const uniforms=scene.children[0].material.uniforms;
  calls.push({target,pixel:uniforms.pixelSize.value,low:uniforms.lowRes.value.toArray()});
 }};
 for(const pixel of [1,3,6]){
  calls.length=0;post.setSizes(324,344,pixel*1.5);post.render(renderer,new THREE.Texture(),true,.42);
  assert.equal(calls.length,2);assert.equal(calls[0].target.width,324);assert.equal(calls[0].target.height,344);assert.equal(calls[0].pixel,1);
  assert.equal(calls[1].target,destination);assert.equal(calls[1].pixel,pixel*1.5);assert.deepEqual(calls[1].low,[324,344]);assert.equal(target,destination);
 }
 const legacy=createPost();calls.length=0;legacy.setSizes(324,344,4.5);legacy.render(renderer,new THREE.Texture(),true,.42);assert.equal(calls.length,1);assert.equal(calls[0].pixel,4.5);
});
test('fixed batch clears deleted surfaces and never overwrites neighbouring objects on growth',async()=>{
 const {createFixedBatch}=await import('../src/beach/fixed-batch.js'),splats=new PackedSplats(),batch=createFixedBatch(splats,writeSplat);
 const point=x=>({p:[x,0,0],n:[0,1,0],r:.04,c:[.3,.4,.5]});
 const a={id:1,x:0,y:0,z:0,angle:0,scale:1,revision:0,points:[point(0),point(1)]},b={...a,id:2,x:8,points:[point(0)]};
 assert.ok(batch.sync([a,b]));const neighbor=splats.packedArray.slice(8,12);
 a.points=a.points.slice(0,1);a.revision++;batch.sync([a,b]);assert.deepEqual([...splats.packedArray.slice(4,8)],[0,0,0,0]);assert.deepEqual(splats.packedArray.slice(8,12),neighbor);
 a.points=[point(0),point(1),point(2)];a.revision++;batch.sync([a,b]);assert.deepEqual([...splats.packedArray.slice(0,8)],Array(8).fill(0));assert.deepEqual(splats.packedArray.slice(8,12),neighbor);
 a.detached=true;batch.sync([a,b]);assert.ok(splats.packedArray.slice(12,24).every(v=>v===0));assert.equal(batch.sync([a,b]),false);
});

test('sleeping pieces batch at their rigid pose, clear on wake and reuse their slots',async()=>{
 const {createFixedBatch}=await import('../src/beach/fixed-batch.js'),splats=new PackedSplats(),batch=createFixedBatch(splats,writeSplat);
 let sleeping=true;const pos={x:2,y:3,z:4},q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),.7);
 const e={id:1,x:1,y:0,z:0,angle:.3,scale:2,revision:0,detached:true,points:[{p:[.2,.3,.1],n:[0,1,0],r:.03,c:[.2,.3,.4]}],rigid:{isSleeping:()=>sleeping,translation:()=>pos,rotation:()=>q}};
 batch.sync([e]);const expected=new THREE.Vector3(...e.points[0].p).multiplyScalar(2).applyAxisAngle(new THREE.Vector3(0,1,0),.3).add(new THREE.Vector3(1,0,0)).applyQuaternion(q).add(new THREE.Vector3(2,3,4));
 assert.ok(splats.getSplat(0).center.distanceTo(expected)<.02);const capacity=splats.numSplats;
 sleeping=false;batch.sync([e]);assert.ok(splats.packedArray.slice(0,4).every(v=>v===0));
 pos.y+=1;sleeping=true;batch.sync([e]);assert.equal(splats.numSplats,capacity);expected.y++;assert.ok(splats.getSplat(0).center.distanceTo(expected)<.02);
});
