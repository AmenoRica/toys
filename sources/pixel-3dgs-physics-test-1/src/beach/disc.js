export const discSettings={radius:.5,halfThickness:.07,range:18,speed:14,returnSpeed:20,recoilTime:.1,recoilSpeed:4.5,dentDepth:.025,dentLimit:.06,dentRadius:.28};
const sub=(a,b)=>a.map((v,k)=>v-b[k]);
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const length=a=>Math.hypot(...a);
export function rotate(v,q){
 const t=[2*(q.y*v[2]-q.z*v[1]),2*(q.z*v[0]-q.x*v[2]),2*(q.x*v[1]-q.y*v[0])];
 return [v[0]+q.w*t[0]+q.y*t[2]-q.z*t[1],v[1]+q.w*t[1]+q.z*t[0]-q.x*t[2],v[2]+q.w*t[2]+q.x*t[1]-q.y*t[0]];
}
export function localVector(v,e){
 if(e.rigid){const q=e.rigid.rotation();v=rotate(v,{x:-q.x,y:-q.y,z:-q.z,w:q.w});}
 const c=Math.cos(e.angle),s=Math.sin(e.angle);return [c*v[0]-s*v[2],v[1],s*v[0]+c*v[2]];
}
export function localPosition(v,e){
 if(e.rigid){const p=e.rigid.translation(),q=e.rigid.rotation();v=rotate([v[0]-p.x,v[1]-p.y,v[2]-p.z],{x:-q.x,y:-q.y,z:-q.z,w:q.w});}
 const c=Math.cos(e.angle),s=Math.sin(e.angle),x=v[0]-e.x,z=v[2]-e.z;
 return [(c*x-s*z)/e.scale,(v[1]-e.y)/e.scale,(s*x+c*z)/e.scale];
}
export function cutSurface(points,from,to,normal,radius,halfThickness){
 if(![...from,...to,...normal,radius,halfThickness].every(Number.isFinite)||radius<=0||halfThickness<0||Math.abs(length(normal)-1)>.001)throw new Error('Invalid blade sweep');
 const dx=to[0]-from[0],dy=to[1]-from[1],dz=to[2]-from[2],d2=dx*dx+dy*dy+dz*dz;
 const count=Math.max(1,Math.ceil(Math.sqrt(d2)/Math.min(radius*.4,Math.max(halfThickness,.005))));
 let alive=null;const contacts=[];
 for(let i=0;i<points.length;i++){
  const p=points[i];let hit=false;
  if(!p.anchor){
   const x=p.p[0]-from[0],y=p.p[1]-from[1],z=p.p[2]-from[2];
   const t=d2?Math.max(0,Math.min(1,(x*dx+y*dy+z*dz)/d2)):0,reach=radius+p.r*1.5;
   const qx=x-dx*t,qy=y-dy*t,qz=z-dz*t;
   if(qx*qx+qy*qy+qz*qz<=(reach+halfThickness)**2){
    const nearest=Math.round(t*count);
    for(let j=Math.max(0,nearest-2);j<=Math.min(count,nearest+2);j++){
     const u=j/count,ax=x-dx*u,ay=y-dy*u,az=z-dz*u,h=ax*normal[0]+ay*normal[1]+az*normal[2];
     if(Math.abs(h)<=halfThickness+p.r*.7&&ax*ax+ay*ay+az*az-h*h<=reach*reach){hit=true;break;}
    }
   }
  }
  if(hit){alive??=points.slice(0,i);contacts.push(p);}else if(alive)alive.push(p);
 }
 return {points:alive??points,contacts,removed:contacts.length};
}
// Sweep an inflated thin disc against surface samples, retaining the earliest contact.
export function rockContact(points,from,to,normal,radius,halfThickness){
 const delta=sub(to,from);let hit=null;
 for(const point of points){
  if(dot(delta,point.n)>=-1e-9)continue;
  const offset=sub(from,point.p),r=radius+point.r,h=halfThickness+point.r;
  const metric=(a,b)=>dot(a,b)/(r*r)+dot(a,normal)*dot(b,normal)*(1/(h*h)-1/(r*r));
  const a=metric(delta,delta),b=metric(offset,delta),c=metric(offset,offset)-1;
  if(a<1e-12)continue;
  const discriminant=b*b-a*c;if(discriminant<0)continue;
  const t=c<=0?0:(-b-Math.sqrt(discriminant))/a;
  if(t<0||t>1||hit&&t>=hit.t)continue;
  hit={t,point,position:from.map((v,k)=>v+delta[k]*t),normal:point.n};
 }
 return hit;
}
export function dentRock(points,contact,scale){
 const radius=discSettings.dentRadius/scale,limit=discSettings.dentLimit/scale;
 return points.map(p=>{
  const distance=length(sub(p.p,contact.p));
  if(distance>=radius||p.anchor||dot(p.n,contact.n)<.3)return p;
  const amount=Math.min(Math.max(0,limit-(p.dent||0)),discSettings.dentDepth/scale*(1-(distance/radius)**2)**2);
  if(!amount)return p;
  return {...p,p:p.p.map((v,k)=>v-p.n[k]*amount),dent:(p.dent||0)+amount};
 });
}
export function createDisc(){
 return {phase:'held',position:[0,0,0],direction:[0,0,-1],normal:[0,1,0],distance:0,recoil:0,
  launch(hand,target,normal){
   if(this.phase!=='held')return false;
   const d=sub(target,hand),l=length(d);
   if(![...hand,...target,...normal].every(Number.isFinite)||l<1e-6||Math.abs(length(normal)-1)>.001)throw new Error('Invalid disc launch');
   this.position=[...hand];this.direction=d.map(v=>v/l);this.normal=[...normal];this.distance=0;this.phase='outbound';return true;
  },
  reset(){this.phase='held';this.distance=0;this.recoil=0;},
  bounce(hit,from,to){
   const d=sub(to,from),l=length(d);if(l<1e-9)return;
   const incoming=d.map(v=>v/l),projection=dot(incoming,hit.normal);
   this.direction=incoming.map((v,k)=>v-2*projection*hit.normal[k]);
   this.position=hit.position.map((v,k)=>v+hit.normal[k]*.005);
   this.phase='recoil';this.recoil=discSettings.recoilTime;
  },
  step(dt,hand,onSweep){
   if(!Number.isFinite(dt)||dt<0)throw new Error('Invalid disc time');
   if(this.phase==='held'){this.position=[...hand];return;}
   let remaining=Math.min(dt,.05);
   while(remaining>1e-8&&this.phase!=='held'){
    const h=Math.min(remaining,1/120);remaining-=h;const from=[...this.position];
    if(this.phase==='recoil'){
     const elapsed=Math.min(h,this.recoil);
     this.position=this.position.map((v,k)=>v+this.direction[k]*discSettings.recoilSpeed*elapsed);
     this.recoil-=elapsed;if(this.recoil<=1e-8)this.phase='returning';
    }else if(this.phase==='outbound'){
     const travel=Math.min(discSettings.speed*h,discSettings.range-this.distance);
     this.position=this.position.map((v,k)=>v+this.direction[k]*travel);this.distance+=travel;
     if(this.distance>=discSettings.range-1e-8)this.phase='returning';
    }else{
     const d=sub(hand,this.position),l=length(d),travel=Math.min(l,discSettings.returnSpeed*h);
     if(l<1e-6){this.phase='held';this.position=[...hand];break;}
     this.position=this.position.map((v,k)=>v+d[k]*travel/l);
     if(l<=travel+.08)this.phase='held';
    }
    onSweep(from,[...this.position],this.normal);
   }
  },
 };
}
