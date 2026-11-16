import test from 'node:test';
import assert from 'node:assert/strict';
import {createDisc,cutSurface,discSettings} from '../src/beach/disc.js';
const point=(x,y,z,anchor=false)=>({p:[x,y,z],n:[0,1,0],r:.013,c:[.4,.3,.2],anchor});
test('one disc travels outward then returns to the moving hand',()=>{
 const d=createDisc(),sweeps=[];assert.ok(d.launch([0,1,0],[0,1,-18],[0,1,0]));assert.equal(d.launch([0,1,0],[0,1,-18],[0,1,0]),false);
 let returned=false;for(let i=0;i<360;i++){const hand=[Math.min(i/60,2),1,0];d.step(1/60,hand,(a,b)=>sweeps.push([a,b]));if(d.phase==='held'){returned=true;assert.ok(Math.hypot(...d.position.map((v,k)=>v-hand[k]))<.1);break;}}
 assert.ok(returned);assert.ok(sweeps.length);assert.ok(d.distance<=discSettings.range+1e-6);assert.throws(()=>d.step(NaN,[0,0,0],()=>{}));
});
test('fast blade sweep cuts a thin band, preserves roots and nearby unhit surface',()=>{
 const p=[point(0,0,0),point(.4,.03,2),point(0,.3,0),point(2,0,0),point(0,0,0,true)];
 const r=cutSurface(p,[0,0,5],[0,0,-5],[0,1,0],.5,.07);
 assert.equal(r.removed,2);assert.deepEqual(r.points,p.slice(2));assert.equal(p.length,5);
});
