import {mulberry32} from '../noise.js';
export const impactSettings={capacity:36,count:12,lifetime:.35,flashTime:.14};
export function createImpact(){
 const random=mulberry32(918),points=Array.from({length:impactSettings.capacity},()=>({p:[0,0,0],n:[0,1,0],c:[.7,1,1],r:.025,scale:[.025,.025,.025],opacity:0,v:[0,0,0],life:0}));
 let cursor=0,flash=0;const position=[0,0,0];
 return {points,position,get power(){return 1.8*(flash/impactSettings.flashTime)**2;},
  emit(p,n){
   position.splice(0,3,...p);flash=impactSettings.flashTime;
   for(let i=0;i<impactSettings.count;i++){
    const a=points[cursor++%points.length];a.p=p.map((v,k)=>v+n[k]*.025);a.life=impactSettings.lifetime*(.7+random()*.3);a.opacity=1;
    const v=[random()*2-1,random()*2-1,random()*2-1],dot=v.reduce((s,x,k)=>s+x*n[k],0);
    a.v=v.map((x,k)=>(x-dot*n[k])*.9+n[k]*(.8+random()*.6));a.r=.02+random()*.014;a.scale.fill(a.r);
   }
  },
  step(dt){
   if(!Number.isFinite(dt)||dt<0)throw new Error('Invalid impact time');
   flash=Math.max(0,flash-dt);let active=false;
   for(const p of points){
    if(p.life<=0)continue;p.life=Math.max(0,p.life-dt);p.opacity=p.life/impactSettings.lifetime;
    for(let k=0;k<3;k++)p.p[k]+=p.v[k]*dt;
    p.v[1]-=2.5*dt;active||=p.life>0;
   }
   return active;
  },
  clear(){flash=0;for(const p of points){p.life=0;p.opacity=0;}},
 };
}
