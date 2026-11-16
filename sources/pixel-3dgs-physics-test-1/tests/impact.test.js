import test from 'node:test';
import assert from 'node:assert/strict';
import {createImpact,impactSettings} from '../src/beach/impact.js';
import {cacheSplatWrites} from '../src/beach/splat-cache.js';
import {PackedSplats} from '@sparkjsdev/spark';
import * as THREE from 'three';
test('impact slots remain bounded, travel outward, expire and reset',()=>{
 const effect=createImpact();effect.emit([1,2,3],[0,0,1]);
 assert.equal(effect.points.filter(p=>p.life>0).length,impactSettings.count);assert.ok(effect.power>0);
 const before=effect.points[0].p[2];assert.ok(effect.step(.05));assert.ok(effect.points[0].p[2]>before);
 for(let i=0;i<100;i++)effect.emit([1,2,3],[0,0,1]);
 assert.equal(effect.points.length,impactSettings.capacity);
 assert.equal(effect.step(1),false);assert.equal(effect.power,0);assert.ok(effect.points.every(p=>p.opacity===0));
 effect.emit([0,0,0],[1,0,0]);effect.clear();assert.equal(effect.power,0);assert.ok(effect.points.every(p=>p.opacity===0));
 assert.throws(()=>effect.step(NaN));
});
test('cached surface encoding matches Spark and invalidates replaced points',()=>{
 const a=new PackedSplats(),b=new PackedSplats();let calls=0;
 const write=(target,i,v)=>{calls++;target.setSplat(i,new THREE.Vector3(...v.p),new THREE.Vector3(.02,.03,.01),new THREE.Quaternion(),.8,new THREE.Color(.2,.4,.6));};
 const cached=cacheSplatWrites(write),point={p:[1,2,3]},changed={p:[1,2,4]};
 cached(a,0,point);cached(b,0,point);assert.equal(calls,1);assert.equal(b.numSplats,1);
 assert.deepEqual(a.packedArray.slice(0,4),b.packedArray.slice(0,4));
 cached(b,1,changed);assert.equal(calls,2);assert.equal(b.numSplats,2);
 write(a,1,changed);assert.deepEqual(a.packedArray.slice(4,8),b.packedArray.slice(4,8));
});
