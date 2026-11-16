import test from 'node:test';
import assert from 'node:assert/strict';
import {beachPalette,selectPalette} from '../src/beach/palette.js';
import {createPost} from '../src/render/post.js';
test('4–64 colors are unique, deterministic, preserve background and retain the original at 28+',()=>{
 for(let n=4;n<=64;n++){
  const p=selectPalette(n);assert.equal(p.length,n);assert.equal(new Set(p).size,n);assert.ok(p.includes(beachPalette[0]));assert.deepEqual(p,selectPalette(n));
  if(n>=28)assert.ok(beachPalette.every(c=>p.includes(c)));
 }
 assert.deepEqual(selectPalette(28),beachPalette);
 for(const n of [3,65,4.5,NaN,Infinity,'28'])assert.throws(()=>selectPalette(n));
});
test('brightness defaults to unchanged and validates updates without losing the last value',()=>{
 const post=createPost();let value;
 const renderer={render:scene=>{value=scene.children[0].material.uniforms.brightness.value;}};
 post.render(renderer,null,true,0);assert.equal(value,1);
 for(const brightness of [.5,2,1]){post.setBrightness(brightness);post.render(renderer,null,true,0);assert.equal(value,brightness);}
 for(const brightness of [0,2.1,NaN,Infinity,'1'])assert.throws(()=>post.setBrightness(brightness));
 post.render(renderer,null,true,0);assert.equal(value,1);
});
