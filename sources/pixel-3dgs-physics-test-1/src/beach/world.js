import {mulberry32} from '../noise.js';
import {push,partition,finishSurface} from '../push-lab/model.js';
import {createPhysics} from '../push-lab/physics.js';
import {prepareCut} from './cut-processing.js';
import {cutSurface,localPosition,localVector,rotate,discSettings,rockContact,dentRock} from './disc.js';
export const beachSettings={eye:1.65,speed:3.6,playerRadius:.28,pixel:3,jumpHeight:1,gravity:9.81};
export function shoreRadius(a){return 24+2.5*Math.sin(a*3+.7)+1.2*Math.sin(a*5);}
export function groundHeight(x,z){
  const r=Math.hypot(x,z),t=Math.max(0,Math.min(1,(shoreRadius(Math.atan2(z,x))-r)/7));
  return -.45+1.6*t*t*(3-2*t)+.14*Math.sin(x*.32)*Math.cos(z*.27)*t;
}
export function terrain(){
  const rows=64,cols=64,width=68,depth=68,heights=new Float32Array((rows+1)*(cols+1));
  for(let x=0;x<=cols;x++)for(let z=0;z<=rows;z++)heights[x*(rows+1)+z]=groundHeight((x/cols-.5)*width,(z/rows-.5)*depth);
  return {rows,cols,width,depth,heights};
}
export function layout(){
  const rnd=mulberry32(418),objects=[];
  for(const kind of ['tree','rock'])for(let i=0;i<(kind==='tree'?28:34);i++){
    let x,z;
    for(let attempt=0;attempt<1000;attempt++){
      const a=rnd()*Math.PI*2,r=6+Math.sqrt(rnd())*15;x=Math.cos(a)*r;z=Math.sin(a)*r;
      if(r>shoreRadius(a)-3||Math.abs(x)<2&&z>0||objects.some(v=>Math.hypot(v.x-x,v.z-z)<(kind==='tree'?2.6:1.5)))continue;
      break;
    }
    objects.push({kind,x,z,y:groundHeight(x,z),angle:rnd()*Math.PI*2,scale:kind==='tree'?2.5+rnd()*1.2:.55+rnd()*.85});
  }
  return objects;
}
export function rockPoints(){
  const points=[],n=640;
  for(let i=0;i<n;i++){
    const y=1-2*(i+.5)/n,a=i*2.39996323,s=Math.sqrt(1-y*y),v=[Math.cos(a)*s,y,Math.sin(a)*s];
    const rough=1+.07*Math.sin(a*3+y*11),p=[v[0]*rough,v[1]*.75*rough+.65,v[2]*.8*rough];
    const normal=[v[0],v[1]/.75,v[2]/.8],l=Math.hypot(...normal),shade=.7+.15*Math.sin(a*2);
    points.push({p,n:normal.map(x=>x/l),c:[.36*shade,.4*shade,.46*shade],r:.085,anchor:p[1]<.15});
  }
  return points;
}
export function worldPoints(points,o){
  const c=Math.cos(o.angle),s=Math.sin(o.angle);
  return points.map(v=>({...v,p:[o.x+o.scale*(c*v.p[0]+s*v.p[2]),o.y+o.scale*v.p[1],o.z+o.scale*(-s*v.p[0]+c*v.p[2])],n:[c*v.n[0]+s*v.n[2],v.n[1],-s*v.n[0]+c*v.n[2]],r:v.r*o.scale,scale:v.scale?.map(x=>x*o.scale)}));
}
// Character support approximates the procedural rock; surfel dents do not change its envelope.
export function rockHeight(x,z,o){
 const c=Math.cos(o.angle??0),s=Math.sin(o.angle??0),dx=x-o.x,dz=z-o.z;
 const lx=(c*dx-s*dz)/o.scale,lz=(s*dx+c*dz)/(.8*o.scale),r2=lx*lx+lz*lz;
 return r2<=1?(o.y??groundHeight(o.x,o.z))+o.scale*(.65+.75*Math.sqrt(1-r2)):-Infinity;
}
export function moveWalker(pos,dx,dz,objects,feet=-Infinity,stepHeight=0){
  let x=pos.x,z=pos.z;const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.08));
  for(let i=0;i<steps;i++){
    let nx=x+dx/steps,nz=z+dz/steps;
    for(const o of [{x:0,z:0,radius:1.1},...objects]){
      if(o.detached||o.points?.length===0)continue;
      const radius=(o.radius??(o.kind==='tree'?.14:1)*o.scale)+beachSettings.playerRadius;
      const vx=nx-o.x,vz=nz-o.z,d=Math.hypot(vx,vz);
      if(d<radius&&o.kind==='rock'&&Number.isFinite(feet)){
        const top=rockHeight(nx,nz,o);
        if(top===-Infinity||feet+stepHeight>=top-1e-6)continue;
        if(feet>=rockHeight(x,z,o)-.12){nx=x;nz=z;continue;}
      }
      if(d<radius){nx=o.x+(d>1e-6?vx/d:1)*radius;nz=o.z+(d>1e-6?vz/d:0)*radius;}
    }
    const r=Math.hypot(nx,nz),limit=shoreRadius(Math.atan2(nz,nx))-2.6;
    if(r>limit){nx*=limit/r;nz*=limit/r;}
    x=nx;z=nz;
  }
  return {x,z,y:groundHeight(x,z)+beachSettings.eye};
}
export function stepWalker(pos,dx,dz,objects,dt,jump=false){
 if(!Number.isFinite(dt)||dt<0||dt>.05)throw new RangeError('Invalid character step');
 let p={...pos,vy:pos.vy??0,grounded:pos.grounded??true};
 if(jump&&p.grounded){p.vy=Math.sqrt(2*beachSettings.gravity*beachSettings.jumpHeight);p.grounded=false;}
 const steps=Math.max(1,Math.ceil(dt/(1/120))),h=dt/steps;
 for(let i=0;i<steps;i++){
  const feet=p.y-beachSettings.eye;
  const moved=moveWalker(p,dx/steps,dz/steps,objects,feet,p.grounded?.12:0);
  let floor=groundHeight(moved.x,moved.z);
  for(const o of objects)if(o.kind==='rock'&&!o.detached&&o.points?.length!==0){
   const top=rockHeight(moved.x,moved.z,o);
   if(top<=feet+(p.grounded?.12:1e-6))floor=Math.max(floor,top);
  }
  let next=feet+p.vy*h-.5*beachSettings.gravity*h*h;p.vy-=beachSettings.gravity*h;
  if(next<=floor&&p.vy<=0){next=floor;p.vy=0;p.grounded=true;}else p.grounded=false;
  p={...p,x:moved.x,z:moved.z,y:next+beachSettings.eye};
 }
 return p;
}
export async function createBeachWorld(tree,{prepare=prepareCut,physics:providedPhysics}={}){
  const physics=providedPhysics??await createPhysics({terrain:terrain(),cell:.6}),entities=[],completed=[];let serial=0,disposed=false;
  const rock=rockPoints();
  const bounds=points=>{
    const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
    for(const p of points)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],p.p[k]);hi[k]=Math.max(hi[k],p.p[k]);}
    return points.length?{center:lo.map((v,k)=>(v+hi[k])/2),radius:Math.hypot(...hi.map((v,k)=>(v-lo[k])/2))+.1}:{center:[0,0,0],radius:0};
  };
  const add=(points,o,detached=false,colliders,inherit=null)=>{
    const e={...o,id:serial++,points,detached,revision:0,bounds:bounds(points),pending:false,contacts:[],cutError:null};entities.push(e);
    if(detached)e.rigid=physics.addDynamic(e.id,colliders?null:worldPoints(points,e),colliders,inherit);else physics.setFixed(e.id,worldPoints(points,e));return e;
  };
  for(const o of layout())add(o.kind==='tree'?tree:rock,o);
  function commit(e,result){
    const finished=result.groups;let inherited=null;
    if(e.detached){inherited={p:{...e.rigid.translation()},q:{...e.rigid.rotation()},v:{...e.rigid.linvel()},w:{...e.rigid.angvel()},com:{...e.rigid.worldCom()}};physics.remove(e.id);entities.splice(entities.indexOf(e),1);}
    else{e.points=finished[0];e.bounds=bounds(e.points);e.revision++;physics.setFixed(e.id,result.colliders?null:worldPoints(e.points,e),result.colliders?.[0]);}
    for(let i=1;i<finished.length;i++)add(finished[i],e,true,result.colliders?.[i],inherited);
    e.contacts=[];e.pending=false;
  }
  function schedule(e){
    if(e.pending)return;
    const revision=e.revision;e.pending=true;
    const result=prepare(e.points,e.contacts,{x:e.x,y:e.y,z:e.z,angle:e.angle,scale:e.scale});
    if(result&&typeof result.then==='function')result.then(result=>{if(!disposed)completed.push({e,revision,result});},error=>{if(!disposed)completed.push({e,revision,error});});
    else commit(e,result);
  }
  await physics.flush?.();
  return {physics,entities,
    strike(from,to,normal){
      let hit=null;
      for(const e of entities){
        if(e.kind!=='rock'||!e.points.length)continue;
        const a=localPosition(from,e),b=localPosition(to,e),d=b.map((v,k)=>v-a[k]);
        const offset=e.bounds.center.map((v,k)=>v-a[k]),d2=d.reduce((s,v)=>s+v*v,0);
        const t=d2?Math.max(0,Math.min(1,offset.reduce((s,v,k)=>s+v*d[k],0)/d2)):0;
        if(Math.hypot(...offset.map((v,k)=>v-d[k]*t))>e.bounds.radius+discSettings.radius/e.scale)continue;
        const contact=rockContact(e.points,a,b,localVector(normal,e),discSettings.radius/e.scale,discSettings.halfThickness/e.scale);
        if(contact&&(!hit||contact.t<hit.t))hit={...contact,e};
      }
      const end=hit?from.map((v,k)=>v+(to[k]-v)*hit.t):to;
      this.cut(from,end,normal);
      if(!hit)return null;
      const {e}=hit;e.points=dentRock(e.points,hit.point,e.scale);e.revision++;
      // shortcut: shallow dents retain the existing rigid-body envelope; rebuild if deep deformation is added.
      const c=Math.cos(e.angle),s=Math.sin(e.angle),n=hit.normal;
      let outward=[c*n[0]+s*n[2],n[1],-s*n[0]+c*n[2]];
      if(e.rigid)outward=rotate(outward,e.rigid.rotation());
      let surfacePosition=worldPoints([hit.point],e)[0].p;
      if(e.rigid){const t=e.rigid.translation();surfacePosition=rotate(surfacePosition,e.rigid.rotation()).map((v,k)=>v+[t.x,t.y,t.z][k]);}
      return {position:end,normal:outward,surfacePosition};
    },
    cut(from,to,normal){
      let removed=0;
      for(const e of [...entities]){
        if(e.kind!=='tree'||!e.points.length)continue;
        const a=localPosition(from,e),b=localPosition(to,e),n=localVector(normal,e),d=b.map((v,k)=>v-a[k]);
        const d2=d.reduce((s,v)=>s+v*v,0),offset=e.bounds.center.map((v,k)=>v-a[k]);
        const t=d2?Math.max(0,Math.min(1,offset.reduce((s,v,k)=>s+v*d[k],0)/d2)):0;
        if(Math.hypot(...offset.map((v,k)=>v-d[k]*t))>e.bounds.radius+discSettings.radius/e.scale)continue;
        const result=cutSurface(e.points,a,b,n,discSettings.radius/e.scale,discSettings.halfThickness/e.scale);
        if(!result.removed)continue;
        removed+=result.removed;
        e.points=result.points;e.bounds=bounds(e.points);e.revision++;
        e.contacts=(e.contacts||[]).concat(result.contacts).slice(-512);
        schedule(e);
      }
      return removed;
    },
    // The slow pushing operation remains independent of mouse input.
    deform(id,center,direction,radius){
      const e=entities.find(e=>e.id===id);if(!e||e.detached)return null;
      const c=Math.cos(e.angle),s=Math.sin(e.angle),x=center[0]-e.x,z=center[2]-e.z;
      const local=[(c*x-s*z)/e.scale,(center[1]-e.y)/e.scale,(s*x+c*z)/e.scale],dir=[c*direction[0]-s*direction[2],direction[1],s*direction[0]+c*direction[2]];
      const result=push(e.points,local,dir,radius/e.scale),split=result.removed?partition(result.points):{attached:result.points,detached:[],discarded:0};
      const groups=[split.attached,...split.detached];
      const finished=split.detached.length?groups.map((p,i)=>finishSurface(p,result.contacts,groups.filter((_,j)=>i!==j).flat()).points):groups;
      e.points=finished[0];e.bounds=bounds(e.points);e.revision++;physics.setFixed(e.id,worldPoints(e.points,e));
      for(const p of finished.slice(1))add(p,e,true);
      return {removed:result.removed+split.discarded,detached:finished.length-1};
    },
    step(dt){
      // Apply at most one collision/mesh transition per frame. Stale jobs never restore cut points.
      while(completed.length){
        const job=completed.shift(),{e}=job;if(!entities.includes(e))continue;
        e.pending=false;
        if(job.error){e.cutError=job.error.message;break;}
        if(e.revision!==job.revision){schedule(e);continue;}
        commit(e,job.result);break;
      }
      physics.step(dt);
      for(let i=entities.length-1;i>=0;i--)if(entities[i].detached&&entities[i].rigid.worldCom().y < -20){physics.remove(entities[i].id);entities.splice(i,1);}
    },
    dispose(){disposed=true;completed.length=0;physics.dispose();},
  };
}
