import test from 'node:test';
import assert from 'node:assert/strict';
import {rockContact,dentRock,createDisc,discSettings} from '../src/beach/disc.js';
import {rockPoints,createBeachWorld,worldPoints} from '../src/beach/world.js';
test('a fast swept disc stops at the entry surface and can leave the same surface',()=>{
 const points=rockPoints(),from=[-4,.65,0],to=[4,.65,0];
 const hit=rockContact(points,from,to,[0,1,0],.5,.07);
 assert.ok(hit&&hit.t>0&&hit.t<.5);assert.ok(hit.normal[0]<0);
 assert.equal(rockContact(points,hit.position,[-4,.65,0],[0,1,0],.5,.07),null);
 assert.equal(rockContact(points,[-4,4,0],[4,4,0],[0,1,0],.5,.07),null);
});
test('repeated dents preserve every surfel and cap displacement in world metres',()=>{
 const original=rockPoints();let points=original;
 for(let i=0;i<100;i++){
  const hit=rockContact(points,[-4,.65,0],[4,.65,0],[0,1,0],.5,.07);assert.ok(hit);
  points=dentRock(points,hit.point,.55);
 }
 assert.equal(points.length,original.length);assert.ok(points.some(p=>p.dent>0));
 for(let i=0;i<points.length;i++)assert.ok(Math.hypot(...points[i].p.map((v,k)=>v-original[i].p[k]))*.55<=discSettings.dentLimit+1e-8);
 assert.ok(points.filter(p=>p.anchor).every((p,i)=>p===original.filter(p=>p.anchor)[i]));
});
test('impact recoils briefly then returns to the hand and reset clears recoil',()=>{
 const disc=createDisc();disc.launch([0,1,0],[0,1,-18],[0,1,0]);
 disc.bounce({position:[0,1,-2],normal:[0,0,1]},[0,1,-1],[0,1,-3]);
 const z=disc.position[2];disc.step(.05,[0,1,0],()=>{});
 assert.equal(disc.phase,'recoil');assert.ok(disc.position[2]>z);
 disc.step(.05,[0,1,0],()=>{});assert.equal(disc.phase,'returning');
 for(let i=0;i<60;i++)disc.step(1/60,[.2,1,0],()=>{});
 assert.equal(disc.phase,'held');assert.deepEqual(disc.position,[.2,1,0]);
 disc.reset();assert.equal(disc.recoil,0);
});
test('world clips tree cutting at the closest rock, dents it without deleting or spawning bodies',async()=>{
 const w=await createBeachWorld([]);
 try{
  const rocks=w.entities.filter(e=>e.kind==='rock'),e=rocks[0];
  w.entities.splice(0,w.entities.length,e);
  const [a,b]=worldPoints([{p:[-4,.65,0],n:[0,1,0],r:.01},{p:[4,.65,0],n:[0,1,0],r:.01}],e).map(p=>p.p);
  const original=e.points;let clipped;
  const cut=w.cut.bind(w);w.cut=(from,to,normal)=>{clipped=to;return cut(from,to,normal);};
  const hit=w.strike(a,b,[0,1,0]);assert.ok(hit);assert.deepEqual(hit.position,clipped);
  assert.ok(Math.hypot(...clipped.map((v,k)=>v-a[k]))<Math.hypot(...b.map((v,k)=>v-a[k]))/2);
  assert.equal(e.points.length,original.length);assert.ok(e.points.some(p=>p.dent>0));
  assert.equal(w.physics.dynamic.size,0);assert.equal(e.pending,false);
  const dented=e.points;assert.equal(cut(a,b,[0,1,0]),0);assert.equal(e.points,dented);
 }finally{w.dispose();}
});
test('disc completes a real rock impact and returns without repeated-contact trapping',async()=>{
 const w=await createBeachWorld([]);
 try{
  const e=w.entities.find(e=>e.kind==='rock');w.entities.splice(0,w.entities.length,e);
  const [hand,target]=worldPoints([{p:[-4,.65,0],n:[0,1,0],r:.01},{p:[0,.65,0],n:[0,1,0],r:.01}],e).map(p=>p.p);
  const disc=createDisc();disc.launch(hand,target,[0,1,0]);let hits=0;
  for(let i=0;i<300&&disc.phase!=='held';i++){
   let from,to;disc.step(1/60,hand,(a,b)=>{from??=a;to=b;});
   if(from){const hit=w.strike(from,to,disc.normal);if(hit){hits++;disc.bounce(hit,from,to);}}
  }
  assert.ok(hits>=1&&hits<=2,`unexpected repeat collisions: ${hits}`);assert.equal(disc.phase,'held');assert.equal(e.points.length,640);
 }finally{w.dispose();}
});
