import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {layout,groundHeight,shoreRadius,moveWalker,beachSettings,terrain,createBeachWorld} from '../src/beach/world.js';
test('island layout is repeatable, populated and matches the ground',()=>{
 const a=layout();assert.deepEqual(a,layout());assert.equal(a.filter(o=>o.kind==='tree').length,28);assert.equal(a.filter(o=>o.kind==='rock').length,34);
 for(const o of a){assert.equal(o.y,groundHeight(o.x,o.z));assert.ok(Math.hypot(o.x,o.z)<shoreRadius(Math.atan2(o.z,o.x))-2);}
 const t=terrain();for(const [x,z] of [[0,32],[20,40],[51,12]])assert.ok(Math.abs(t.heights[x*65+z]-groundHeight((x/64-.5)*68,(z/64-.5)*68))<1e-6);
});
test('walking follows terrain and slides around fire, rocks and shore without tunnelling',()=>{
 let p={x:0,z:11};p=moveWalker(p,0,-1,[]);assert.ok(Math.abs(p.z-10)<1e-9);assert.ok(Math.abs(p.y-groundHeight(0,10)-beachSettings.eye)<1e-9);
 p=moveWalker(p,0,-30,[]);assert.ok(Math.hypot(p.x,p.z)>=1.1+beachSettings.playerRadius-.001);
 p=moveWalker({x:5,z:0},-10,0,[{kind:'rock',x:2,z:0,scale:1}]);assert.ok(p.x>=3.27);
 p=moveWalker({x:0,z:10},0,100,[]);assert.ok(Math.hypot(p.x,p.z)<=shoreRadius(Math.atan2(p.z,p.x))-2.59);assert.ok(groundHeight(p.x,p.z)>0);
});
test('beach destruction is callable independently of input and spawns real dynamic fragments',async()=>{
 const tree=JSON.parse(fs.readFileSync(new URL('../public/models/push-tree.json',import.meta.url))).points;
 const w=await createBeachWorld(tree);try{
  const e=w.entities[0],c=Math.cos(e.angle),s=Math.sin(e.angle);let detached=false;
  for(let i=0;i<120;i++){
   const z=.24-i*.004;
   const r=w.deform(e.id,[e.x+s*z*e.scale,e.y+.72*e.scale,e.z+c*z*e.scale],[-s,0,-c],.29*e.scale);
   if(r.detached){detached=true;break;}
  }
  assert.ok(detached);assert.ok(w.physics.dynamic.size>0);
  const b=[...w.physics.dynamic.values()][0],y=b.worldCom().y;
  for(let i=0;i<30;i++)w.step(1/60);
  assert.ok(b.worldCom().y<y);assert.equal(w.deform(-1,[0,0,0],[0,0,-1],1),null);
 }finally{w.dispose();}
});

test('physics ground height agrees with the asymmetric visible terrain',async()=>{
 const {createPhysics}=await import('../src/push-lab/physics.js');const p=await createPhysics({terrain:terrain(),cell:.6});
 try{
  const x=12,z=-7,y=groundHeight(x,z),points=[];
  for(const dx of [-.04,.04])for(const dy of [-.04,.04])for(const dz of [-.04,.04])points.push({p:[x+dx,y+1+dy,z+dz],n:[0,1,0],r:.02});
  const b=p.addDynamic(1,points);for(let i=0;i<300;i++)p.step(1/60);const c=b.worldCom();
  assert.ok(Math.abs(c.y-groundHeight(c.x,c.z)-.04)<.06);
 }finally{p.dispose();}
});

test('disc cuts a real tree and re-cuts a moving fragment without resetting its pose or velocity',async()=>{
 const tree=JSON.parse(fs.readFileSync(new URL('../public/models/push-tree.json',import.meta.url))).points;
 const w=await createBeachWorld(tree);try{
  const e=w.entities[0],y=e.y+.72*e.scale;
  const removed=w.cut([e.x-2,y,e.z],[e.x+2,y,e.z],[0,1,0]);assert.ok(removed>0);
  const top=w.entities.find(v=>v.detached&&v.points.length>500);assert.ok(top,'tree must split');
  top.rigid.setTranslation({x:.2,y:.1,z:0},true);top.rigid.setLinvel({x:1,y:.2,z:-.3},true);top.rigid.setAngvel({x:0,y:.4,z:0},true);
  const q={...top.rigid.rotation()},oldId=top.id,cutY=top.y+1.1*top.scale+.1;
  assert.ok(w.cut([top.x-2+.2,cutY,top.z],[top.x+2+.2,cutY,top.z],[0,1,0])>0);
  assert.ok(!w.entities.some(v=>v.id===oldId));
  const pieces=w.entities.filter(v=>v.detached&&v.id>oldId);assert.ok(pieces.length);
  for(const p of pieces){assert.ok(Math.abs(p.rigid.translation().x-.2)<1e-5);assert.ok(Math.abs(p.rigid.rotation().w-q.w)<1e-5);assert.ok(Math.abs(p.rigid.angvel().y-.4)<1e-5);assert.ok(p.rigid.linvel().x>.5);}
  assert.equal(w.entities.filter(v=>v.kind!=='tree'&&v.kind!=='rock').length,0);
 }finally{w.dispose();}
});
