import test from 'node:test';
import assert from 'node:assert/strict';
import {stepWalker,groundHeight,rockHeight,beachSettings as settings} from '../src/beach/world.js';
const start=(x=8,z=0)=>({x,z,y:groundHeight(x,z)+settings.eye});
test('one metre jump lands, refuses a second jump and is stable across frame rates',()=>{
 for(const dt of [1/30,1/60,1/120]){
  let p=start(),peak=p.y,initial=p.y;
  for(let i=0;i<Math.ceil(1.4/dt);i++){p=stepWalker(p,0,0,[],dt,i===0||i===Math.round(.2/dt));peak=Math.max(peak,p.y);}
  assert.ok(Math.abs(peak-initial-1)<.004);assert.equal(p.grounded,true);assert.equal(p.vy,0);assert.equal(p.y,initial);
 }
 assert.throws(()=>stepWalker(start(),0,0,[],NaN));
});
test('jump mounts a rotated small rock, stays on it, jumps again and falls off its edge',()=>{
 const rock={kind:'rock',x:8,z:0,y:groundHeight(8,0),angle:.4,scale:.55};
 let p=start(8,1.4);
 for(let i=0;i<24;i++)p=stepWalker(p,0,-1.4/24,[rock],1/60,i===0);
 for(let i=0;i<90;i++)p=stepWalker(p,0,0,[rock],1/60);
 assert.ok(Math.abs(p.z)<.02);assert.ok(Math.abs(p.y-settings.eye-rockHeight(p.x,p.z,rock))<1e-5);assert.ok(p.grounded);
 const onRock=p.y;p=stepWalker(p,0,0,[rock],1/60,true);assert.ok(p.y>onRock&&!p.grounded);
 for(let i=0;i<100;i++)p=stepWalker(p,0,.04,[rock],1/60);
 assert.ok(p.z>2);assert.ok(p.grounded);assert.ok(Math.abs(p.y-settings.eye-groundHeight(p.x,p.z))<1e-5);
});
test('walking cannot climb a rock face; a falling player lands without tunnelling',()=>{
 const rock={kind:'rock',x:8,z:0,y:groundHeight(8,0),angle:.8,scale:1.2};let p=start(8,2);
 for(let i=0;i<90;i++)p=stepWalker(p,0,-.06,[rock],1/60);
 assert.ok(p.z>.8);assert.ok(p.y<rockHeight(8,0,rock)+settings.eye-.5);
 p={...start(),y:rock.y+5+settings.eye,vy:-20,grounded:false};
 for(let i=0;i<20;i++)p=stepWalker(p,0,0,[rock],.05);
 assert.ok(p.grounded);assert.ok(Math.abs(p.y-settings.eye-rockHeight(8,0,rock))<1e-6);
});
