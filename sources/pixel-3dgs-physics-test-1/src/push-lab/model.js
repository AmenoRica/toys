// Surface state only. Neighbor relations are queried, never stored as edges.
export const settings={step:.004, radius:.25, neighbor:.073, collision:.035, maxPoints:50000, minFragment:24, cleanupScale:3};
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
export function indexPoints(points,cell=settings.neighbor){
  const map=new Map(),key=(x,y,z)=>`${x},${y},${z}`;
  for(let i=0;i<points.length;i++){
    const p=points[i].p,k=key(Math.floor(p[0]/cell),Math.floor(p[1]/cell),Math.floor(p[2]/cell));
    let bucket=map.get(k);if(!bucket)map.set(k,bucket=[]);bucket.push(i);
  }
  return (p,r)=>{const out=[],r2=r*r;
    for(let x=Math.floor((p[0]-r)/cell),xh=Math.floor((p[0]+r)/cell);x<=xh;x++)
    for(let y=Math.floor((p[1]-r)/cell),yh=Math.floor((p[1]+r)/cell);y<=yh;y++)
    for(let z=Math.floor((p[2]-r)/cell),zh=Math.floor((p[2]+r)/cell);z<=zh;z++){
      const bucket=map.get(key(x,y,z));if(!bucket)continue;
      for(const i of bucket){const q=points[i].p,dx=q[0]-p[0],dy=q[1]-p[1],dz=q[2]-p[2];if(dx*dx+dy*dy+dz*dz<=r2)out.push(i);}
    }
    return out;
  };
}
export function clusters(points){
  // Search by surfel size: rocks are sampled more coarsely than bark.
  const buckets=new Map(),seen=new Uint8Array(points.length),groups=[];
  points.forEach((p,i)=>{const key=Math.ceil(Math.log2(p.r));let bucket=buckets.get(key);if(!bucket)buckets.set(key,bucket={points:[],ids:[],radius:0});bucket.points.push(p);bucket.ids.push(i);bucket.radius=Math.max(bucket.radius,p.r);});
  for(const bucket of buckets.values())bucket.near=indexPoints(bucket.points,Math.max(.032,bucket.radius*3));
  for(let i=0;i<points.length;i++)if(!seen[i]){
    const ids=[i];seen[i]=1;
    for(let k=0;k<ids.length;k++){
      const a=points[ids[k]];
      for(const bucket of buckets.values())for(const local of bucket.near(a.p,Math.max(.032,1.5*(a.r+bucket.radius)))){
        const j=bucket.ids[local];if(seen[j])continue;
        const b=points[j],reach=Math.max(.032,1.5*(a.r+b.r)),dx=a.p[0]-b.p[0],dy=a.p[1]-b.p[1],dz=a.p[2]-b.p[2];
        if(dx*dx+dy*dy+dz*dz<=reach*reach){seen[j]=1;ids.push(j);}
      }
    }
    groups.push(ids.map(j=>points[j]));
  }
  return groups;
}
// Compact smooth brush: displacement and slope both vanish at the rim.
function deform(point, center, direction, radius) {
  const q=sub(point,center), along=dot(q,direction);
  const radial=sub(q,direction.map(v=>v*along)), u=dot(radial,radial)/(radius*radius);
  if(u>=1)return {p:[...point],gradient:[0,0,0]};
  const amount=settings.step*(1-u)**2;
  return {p:point.map((v,k)=>v+direction[k]*amount),
    gradient:radial.map(v=>-4*settings.step*(1-u)*v/(radius*radius))};
}
export function push(points,center,direction,radius=settings.radius){
  if(![...center,...direction,radius].every(Number.isFinite)||radius<=0||Math.abs(dot(direction,direction)-1)>.001)throw new Error('Invalid push');
  const near=indexPoints(points), moving=new Set(), dead=new Set();
  const next=points.slice(), inserted=[];
  for(let i=0;i<points.length;i++){
    const a=points[i],q=sub(a.p,center),along=dot(q,direction);
    const radial=sub(q,direction.map(v=>v*along));
    if(a.anchor||along<=-.08||along>=radius*2||dot(radial,radial)>=radius*radius||dot(a.n,direction)>=-.02)continue;
    moving.add(i);
    const change=deform(a.p,center,direction,radius);
    next[i]={...a,p:change.p};
    const n=a.n.map((v,k)=>v-change.gradient[k]*dot(a.n,direction)),length=Math.hypot(...n);
    next[i].n=n.map(v=>v/length);
    // Existing leaf orientation is retained until that leaf is actually deformed.
    delete next[i].quaternion;
  }
  // Swept ellipsoid support: includes surfel area, thickness and relative motion.
  const extent=p=>p.scale?Math.max(...p.scale):p.r;
  // Keep large leaves from widening every trunk contact query.
  const pools=[{points:[],ids:[],max:0},{points:[],ids:[],max:0}];
  points.forEach((p,i)=>{const pool=pools[p.scale?1:0];pool.points.push(p);pool.ids.push(i);pool.max=Math.max(pool.max,extent(p));});
  for(const pool of pools)pool.near=indexPoints(pool.points);

  for(const i of moving){
    const a=points[i],end=next[i].p;
    for(const pool of pools)for(const id of pool.near(end,1.5*(extent(a)+pool.max)+settings.step)){
      const j=pool.ids[id];
      if(j===i||points[j].anchor)continue;
      const b=points[j];
      // Same-facing neighbors are overlapping samples of one surface, not a cut.
      if(dot(next[i].n,next[j].n)>.25)continue;
      const offset=sub(b.p,a.p),delta=sub(sub(next[j].p,b.p),sub(end,a.p));
      if(dot(offset,delta)>=-1e-10)continue;
      const axis=sub(next[i].n,next[j].n),len=Math.hypot(...axis);
      for(let k=0;k<3;k++)axis[k]/=len;
      const tangent=1.5*(extent(a)+extent(b));
      const thickness=p=>p.scale?Math.min(...p.scale):p.r*.45;
      const depth=1.5*(thickness(a)+thickness(b));
      const metric=(u,v)=>dot(u,v)/(tangent*tangent)+dot(u,axis)*dot(v,axis)*(1/(depth*depth)-1/(tangent*tangent));
      const dd=metric(delta,delta),t=dd?Math.max(0,Math.min(1,-metric(offset,delta)/dd)):1;
      const q=offset.map((v,k)=>v+t*delta[k]);
      // shortcut: tilted/anisotropic pairs use a shared tangent ellipse; full covariance is needed for exact leaf contacts.
      if(metric(q,q)>1)continue;
      dead.add(i);dead.add(j);
    }
  }
  // Clear a single local collar around actual contacts, never recursively grow the cut.
  const contacts=[...dead];
  for(const i of contacts)for(const j of near(next[i].p,points[i].r*settings.cleanupScale)){
    if(!points[j].anchor&&!points[j].leaf)dead.add(j);
  }
  // Re-sample only stretched, previously neighboring surface patches. Never bridge a deleted pair.
  const alive=next.filter((_,i)=>!dead.has(i)),occupied=indexPoints(alive);
  for(const i of moving){
    if(dead.has(i)||points[i].leaf)continue;
    const a=points[i];
    for(const j of near(a.p,a.r*3.0)){
      if(j<=i||dead.has(j)||points[j].leaf||points[j].anchor||dot(a.n,points[j].n)<.6)continue;
      const b=points[j],oldGap=Math.hypot(...sub(a.p,b.p)),gap=Math.hypot(...sub(next[i].p,next[j].p));
      if(oldGap<1e-6||gap<oldGap*1.001||gap<(a.r+b.r)*1.2)continue;
      if(alive.length+inserted.length>=settings.maxPoints||inserted.length>=128)break;
      const mid=a.p.map((v,k)=>(v+b.p[k])/2);
      const p=deform(mid,center,direction,radius).p,clearance=Math.min(a.r,b.r)*.9;
      if(near(mid,settings.collision*2).some(k=>dead.has(k)))continue;
      if(occupied(p,settings.collision).some(k=>dot(alive[k].n,a.n)<0))continue;
      if(occupied(p,clearance).length||inserted.some(v=>Math.hypot(...sub(v.p,p))<clearance))continue;
      // A local tangent check rejects neighbors on separate folds, without storing connectivity.
      if(Math.abs(dot(sub(b.p,a.p),a.n))>oldGap*.45)continue;
      const n=next[i].n.map((v,k)=>v+next[j].n[k]),len=Math.hypot(...n);
      inserted.push({p,n:n.map(v=>v/len),c:a.c.map((v,k)=>(v+b.c[k])/2),r:(a.r+b.r)/2,anchor:false});
    }
  }
  return {points:alive.concat(inserted),moved:moving.size,removed:dead.size,added:inserted.length,contacts:contacts.map(i=>next[i])};
}
// Local finishing only: no stored edges, cut loops, or interior volume.
export function finishSurface(points,contacts,others=[]){
  if(!contacts.length||!points.length)return {points,added:0};
  const otherRadius=others.reduce((r,p)=>Math.max(r,p.r),0);
  const cuts=indexPoints(contacts),blocked=indexPoints(others,Math.max(settings.neighbor,otherRadius*3));
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(const c of contacts)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],c.p[k]);hi[k]=Math.max(hi[k],c.p[k]);}
  const affected=points.map(p=>!p.anchor&&!p.leaf&&p.p.every((v,k)=>v>=lo[k]-p.r*6&&v<=hi[k]+p.r*6)&&cuts(p.p,p.r*6).length>0);
  const safe=(p,r)=>!blocked(p,Math.max(.032,1.5*(r+otherRadius))).some(i=>{
    const reach=Math.max(.032,1.5*(r+others[i].r));
    const d=sub(p,others[i].p);return dot(d,d)<=reach*reach;
  });
  let current=points;
  for(let pass=0;pass<3;pass++){
    const near=indexPoints(current);
    current=current.map((a,i)=>{
      if(!affected[i])return a;
      const neighbors=near(a.p,a.r*4).map(i=>current[i]).filter(b=>!b.leaf&&dot(a.n,b.n)>.35);
      if(neighbors.length<4)return a;
      const p=[0,0,0],n=[0,0,0];let weight=0;
      for(const b of neighbors){const d=sub(b.p,a.p),w=Math.exp(-dot(d,d)/(a.r*a.r*4));weight+=w;
        for(let k=0;k<3;k++){p[k]+=b.p[k]*w;n[k]+=b.n[k]*w;}}
      const delta=p.map((v,k)=>(v/weight-a.p[k])*.5),length=Math.hypot(...delta);
      const target=a.p.map((v,k)=>v+delta[k]*Math.min(1,a.r*.35/(length||1)));
      if(!safe(target,a.r))return a;
      const norm=Math.hypot(...n);return {...a,p:target,n:n.map(v=>v/norm)};
    });
  }
  if(current.length>=settings.maxPoints)return {points:current,added:0};
  const near=indexPoints(current),added=[];
  for(let i=0;i<current.length;i++){
    const a=current[i];if(!affected[i])continue;
    for(const j of near(a.p,a.r*4)){
      const b=current[j];if(j<=i||b.anchor||b.leaf||dot(a.n,b.n)<.7)continue;
      const d=sub(b.p,a.p),gap=Math.hypot(...d);
      if(gap<(a.r+b.r)*1.5||Math.abs(dot(d,a.n))>gap*.4)continue;
      const p=a.p.map((v,k)=>(v+b.p[k])/2),r=(a.r+b.r)/2;
      if(near(p,r*.95).length||added.some(v=>Math.hypot(...sub(v.p,p))<r*.95)||!safe(p,r))continue;
      const n=a.n.map((v,k)=>v+b.n[k]),norm=Math.hypot(...n);for(let k=0;k<3;k++)n[k]/=norm;
      const ring=near(p,r*2.6).map(k=>current[k]).filter(v=>!v.leaf&&dot(v.n,n)>.7);
      if(ring.length<3)continue;
      // A surrounding ring distinguishes a small hole from an open cut edge.
      const balance=[0,0,0];let count=0;
      for(const v of ring){const d=sub(v.p,p),h=dot(d,n),t=d.map((x,k)=>x-h*n[k]),len=Math.hypot(...t);
        if(len<1e-6)continue;for(let k=0;k<3;k++)balance[k]+=t[k]/len;count++;}
      if(count<3||Math.hypot(...balance)/count>.3)continue;
      added.push({p,n,c:a.c.map((v,k)=>(v+b.c[k])/2),r,anchor:false});
      if(added.length>=128||current.length+added.length>=settings.maxPoints)return {points:current.concat(added),added:added.length};
    }
  }
  return {points:current.concat(added),added:added.length};
}
export function partition(points){
  const attached=[],detached=[];let discarded=0;
  for(const group of clusters(points)){
    if(group.some(p=>p.anchor))attached.push(...group);
    else if(group.length<settings.minFragment)discarded+=group.length;
    else detached.push(group);
  }
  return {attached,detached,discarded};
}
export function pick(points,origin,direction){
  let best=Infinity,hit=null;
  for(const p of points){const q=sub(p.p,origin),t=dot(q,direction);if(t<=0||t>=best||dot(p.n,direction)>=-.08)continue;const r=sub(q,direction.map(v=>v*t));if(dot(r,r)<(p.r*1.7)**2){best=t;hit=p;}}
  return hit;
}
