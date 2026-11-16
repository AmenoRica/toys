import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {push,pick,clusters,partition,settings,finishSurface} from '../src/push-lab/model.js';
const original=JSON.parse(fs.readFileSync(new URL('../public/models/push-tree.json',import.meta.url))).points;
const sample=(x,y,z=0,n=[0,0,1])=>({p:[x,y,z],n,c:[.4,.3,.2],r:.013,anchor:false});
test('original palm is a single anchored surface cluster',()=>{
  assert.equal(clusters(original).length,1);assert.ok(original.some(p=>p.anchor));
});
test('brush falls off smoothly, stays slow, preserves the rim and input',()=>{
  const p=[sample(0,0),sample(.05,0),sample(.09,0),sample(.1,0),sample(.12,0)],before=JSON.stringify(p);
  const r=push(p,[0,0,0],[0,0,-1],.1);
  assert.equal(JSON.stringify(p),before);
  const depth=r.points.slice(0,5).map(v=>-v.p[2]);
  assert.ok(depth[0]<=.004);assert.ok(depth[0]>depth[1]&&depth[1]>depth[2]);
  assert.ok(depth[3]===0&&depth[4]===0);
  assert.ok(r.points[1].n[0]<0);assert.equal(r.removed,0);
  assert.throws(()=>push(p,[NaN,0,0],[0,0,1]));
});
test('shallow push preserves roots and does not split the tree',()=>{
  const r=push(original,pick(original,[0,.2,3],[0,0,-1]).p,[0,0,-1],.1);
  assert.ok(r.moved>0);assert.equal(r.removed,0);
  assert.deepEqual(r.points.filter(p=>p.anchor),original.filter(p=>p.anchor));
  assert.equal(clusters(r.points).length,1);
});
test('only opposing samples at actual contact are deleted, not surrounding sidewall',()=>{
  const p=[sample(0,0),sample(0,0,-.01,[0,0,-1]),sample(.05,0,-.01,[0,0,-1])];
  const r=push(p,[0,0,0],[0,0,-1],.02);
  assert.equal(r.removed,2);assert.equal(r.points.length,1);assert.deepEqual(r.points[0].p,p[2].p);
  const same=p.map(v=>({...v,n:[0,0,1]}));assert.equal(push(same,[0,0,0],[0,0,-1],.02).removed,0);
});
test('stretched surface is resampled on the current depression, not at old positions',()=>{
  let p=[];for(let x=-.14;x<=.14;x+=.02)for(let y=-.14;y<=.14;y+=.02)p.push(sample(x,y));
  let added=0;
  for(let i=0;i<60;i++){
    const r=push(p,[0,0,-i*settings.step],[0,0,-1],.12);
    if(r.added)for(const v of r.points.slice(-r.added)){assert.ok(v.p[2]<0);assert.ok(Math.abs(Math.hypot(...v.n)-1)<1e-6);}
    added+=r.added;p=r.points;assert.ok(p.length<=settings.maxPoints);
  }
  assert.ok(added>0);
});
test('slow surface pushing still separates the real palm without stored cuts',()=>{
  let points=structuredClone(original),removed=0,separated=false;
  for(let i=0;i<720;i++){
    const a=Math.floor(i/120)*Math.PI/3,depth=.24-(i%120)*settings.step;
    const r=push(points,[Math.sin(a)*depth,.72,Math.cos(a)*depth],[-Math.sin(a),0,-Math.cos(a)],.29);
    points=r.points;removed+=r.removed;
    if(r.removed){const groups=clusters(points);if(groups.some(g=>g.length>500&&!g.some(p=>p.anchor))){assert.ok(groups.some(g=>g.some(p=>p.anchor)));separated=true;break;}}
  }
  assert.ok(separated);assert.ok(removed>0);
});

test('surfel area contact is detected beyond the former centre threshold',()=>{
  const a={...sample(0,0),r:.03},b={...sample(.06,0,-.01,[0,0,-1]),r:.03};
  const r=push([a,b],[0,0,0],[0,0,-1],.1);
  assert.equal(r.removed,2);
});
test('tilted opposing patches are deleted even when both are moving',()=>{
  const a=sample(0,0,0,[.98,0,.199]),b=sample(0,0,-.006,[-.98,0,.199]);
  for(const p of [a,b]){const l=Math.hypot(...p.n);p.n=p.n.map(v=>v/l);}
  // The off-centre front patch moves faster than the rear patch.
  b.p[0]=.015;
  const r=push([a,b],a.p,[0,0,-1],.03);
  assert.equal(r.moved,2);assert.equal(r.removed,2);
});
test('holding a stationary brush keeps pushing until the actual palm separates',()=>{
  let points=structuredClone(original),removed=0,separated=false;
  const center=pick(points,[0,.72,3],[0,0,-1]).p;
  for(let i=0;i<240;i++){
    const r=push(points,center,[0,0,-1],.12);points=r.points;removed+=r.removed;
    if(r.removed&&clusters(points).some(g=>g.length>500&&!g.some(p=>p.anchor))){separated=true;break;}
  }
  assert.ok(removed>0);assert.ok(separated);
});

test('local contact cleanup removes a thin remnant but preserves distant surface',()=>{
  const p=[sample(0,0),sample(0,0,-.01,[0,0,-1]),sample(.025,0,0,[1,0,0]),sample(.08,0,0,[1,0,0])];
  const r=push(p,[0,0,0],[0,0,-1],.02);
  assert.equal(r.removed,3);assert.equal(r.points.length,1);assert.deepEqual(r.points[0],p[3]);
});
test('small detached debris is deleted while anchored and larger groups survive',()=>{
  const root={...sample(0,0),anchor:true};
  const p=[root,...Array.from({length:23},(_,i)=>sample(1+i*.001,0)),...Array.from({length:24},(_,i)=>sample(2+i*.001,0))];
  const r=partition(p);assert.equal(r.discarded,23);assert.equal(r.attached.length,1);assert.equal(r.detached.length,1);assert.equal(r.detached[0].length,24);
});


test('finishing reduces a local spike while keeping a curved depression and distant surface',()=>{
  const points=[];
  for(let x=-.1;x<=.1001;x+=.02)for(let y=-.1;y<=.1001;y+=.02){
    const z=-.04+.8*(x*x+y*y),n=[-1.6*x,-1.6*y,1],l=Math.hypot(...n);
    points.push(sample(x,y,z,n.map(v=>v/l)));
  }
  const spike=points.find(p=>Math.hypot(p.p[0],p.p[1])<1e-6);spike.p[2]+=.02;
  const before=structuredClone(points),result=finishSurface(points,[spike]);
  const i=points.indexOf(spike);assert.ok(result.points[i].p[2]<spike.p[2]-.004);
  assert.ok(result.points[i].p[2]<-.02);
  assert.deepEqual(result.points[0],points[0]);assert.deepEqual(points,before);
});
test('finishing fills a small surrounded hole but does not extend an open edge',()=>{
  const p=[];for(let x=-.08;x<=.0801;x+=.02)for(let y=-.08;y<=.0801;y+=.02)if(Math.hypot(x,y)>.001)p.push(sample(x,y));
  const r=finishSurface(p,[sample(0,0)]);
  assert.ok(r.added>0);assert.ok(r.points.slice(p.length).some(v=>Math.hypot(...v.p)<.01));
  for(const v of r.points.slice(p.length))assert.ok(Math.abs(v.p[0])<=.08&&Math.abs(v.p[1])<=.08);
});
test('finishing real cut groups preserves separation and fixed roots',()=>{
  let points=structuredClone(original),sites=[];
  for(let i=0;i<120;i++){
    const r=push(points,[0,.72,.24-i*settings.step],[0,0,-1],.29);points=r.points;sites.push(...r.contacts);
    if(!r.removed)continue;
    const split=partition(points);if(!split.detached.length)continue;
    const groups=[split.attached,...split.detached];
    const finished=groups.map((g,i)=>finishSurface(g,sites,groups.filter((_,j)=>i!==j).flat()));
    assert.deepEqual(new Set(finished[0].points.filter(p=>p.anchor).map(p=>JSON.stringify(p))),new Set(original.filter(p=>p.anchor).map(p=>JSON.stringify(p))));
    assert.equal(clusters(finished.flatMap(r=>r.points)).length,groups.length);
    for(const r of finished)for(const p of r.points)assert.ok(p.p.every(Number.isFinite)&&Math.abs(Math.hypot(...p.n)-1)<1e-5);
    return;
  }
  assert.fail('actual palm never separated');
});
