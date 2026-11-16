import RAPIER from '@dimforge/rapier3d-compat';

// Temporary scene tuning, not a material or volume simulation.
export const physicsSettings={gravity:-9.81,step:1/60,cell:.16,friction:.7,restitution:.05,density:500};
let ready;
export async function createPhysics(options={}){
  await (ready??=RAPIER.init());
  return new Physics(options);
}
function shapes(points,cell=physicsSettings.cell){
  const bins=new Map();
  for(const v of points){
    if(![...v.p,...v.n,v.r].every(Number.isFinite)||v.r<=0)throw new Error('Invalid physics surface');
    if(v.leaf)continue;
    const key=v.p.map(x=>Math.floor(x/cell)).join(',');
    if(!bins.has(key))bins.set(key,[]);bins.get(key).push(v);
  }
  if(!bins.size&&points.length){
    // shortcut: leaf-only fragments have one small representative collider, not leaf cloth physics.
    const p=points.reduce((a,v)=>a.map((x,k)=>x+v.p[k]/points.length),[0,0,0]);
    return [RAPIER.ColliderDesc.ball(.025).setTranslation(...p)];
  }
  return [...bins.values()].map(group=>{
    const vertices=[];
    // Tiny cells may contain a single surfel: give the hull finite thickness in all axes.
    for(const v of group)for(let axis=0;axis<3;axis++)for(const side of [-1,1])for(let k=0;k<3;k++)vertices.push(v.p[k]+(k===axis?side*v.r*.3:0));
    const hull=RAPIER.ColliderDesc.convexHull(new Float32Array(vertices));
    if(hull)return hull;
    const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
    for(const v of group)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],v.p[k]-v.r*.3);hi[k]=Math.max(hi[k],v.p[k]+v.r*.3);}
    return RAPIER.ColliderDesc.cuboid(...hi.map((v,k)=>Math.max(.004,(v-lo[k])/2))).setTranslation(...hi.map((v,k)=>(v+lo[k])/2));
  });
}
// Build hull topology off-thread; the main world only installs the finished convex meshes.
export async function prepareColliders(groups,cell){
  await (ready??=RAPIER.init());
  const world=new RAPIER.World({x:0,y:0,z:0});
  try{return groups.map(points=>shapes(points,cell).map(desc=>{
    if(desc.shape.type===RAPIER.ShapeType.Ball)return {ball:desc.shape.radius,p:desc.translation};
    if(desc.shape.type===RAPIER.ShapeType.Cuboid)return {box:desc.shape.halfExtents,p:desc.translation};
    const collider=world.createCollider(desc),data={vertices:collider.vertices(),indices:collider.indices()};
    world.removeCollider(collider,false);return data;
  }));}finally{world.free();}
}
function descriptions(data){return data.map(d=>d.ball!==undefined?RAPIER.ColliderDesc.ball(d.ball).setTranslation(d.p.x,d.p.y,d.p.z):d.box?RAPIER.ColliderDesc.cuboid(d.box.x,d.box.y,d.box.z).setTranslation(d.p.x,d.p.y,d.p.z):RAPIER.ColliderDesc.convexMesh(d.vertices,d.indices));}
class Physics{
  constructor(options){this.options=options;this.fixed=new Map();this.dynamic=new Map();this.reset();}
  reset(){
    this.world?.free();this.fixed.clear();this.dynamic.clear();this.accumulator=0;this.changed=false;
    this.world=new RAPIER.World({x:0,y:physicsSettings.gravity,z:0});this.world.timestep=physicsSettings.step;
    const t=this.options.terrain;
    const ground=t?RAPIER.ColliderDesc.heightfield(t.rows,t.cols,t.heights,{x:t.width,y:1,z:t.depth}):RAPIER.ColliderDesc.cylinder(.1,1.65).setTranslation(0,-.125,0);
    this.world.createCollider(ground.setFriction(physicsSettings.friction));
  }
  setFixed(id,points,prepared){
    const colliders=prepared?descriptions(prepared):shapes(points,this.options.cell);this.changed=true;
    for(const collider of this.fixed.get(id)||[])this.world.removeCollider(collider,true);
    this.fixed.set(id,colliders.map(d=>this.world.createCollider(d.setFriction(physicsSettings.friction))));
  }
  addDynamic(id,points,prepared,inherit=null){
    const colliders=prepared?descriptions(prepared):shapes(points,this.options.cell);this.changed=true;
    if(!colliders.length)throw new Error('Empty dynamic fragment');
    if(this.dynamic.has(id))throw new Error('Duplicate dynamic fragment');
    const body=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setLinearDamping(.08).setAngularDamping(.15).setCcdEnabled(true).setAdditionalSolverIterations(4));
    for(const d of colliders)this.world.createCollider(d.setDensity(physicsSettings.density).setFriction(physicsSettings.friction).setRestitution(physicsSettings.restitution),body);
    if(inherit){
      const {p,q,v,w,com}=inherit;body.setTranslation(p,true);body.setRotation(q,true);
      const c=body.worldCom(),r={x:c.x-com.x,y:c.y-com.y,z:c.z-com.z};
      body.setLinvel({x:v.x+w.y*r.z-w.z*r.y,y:v.y+w.z*r.x-w.x*r.z,z:v.z+w.x*r.y-w.y*r.x},true);body.setAngvel(w,true);
    }
    this.dynamic.set(id,body);return body;
  }
  step(dt){
    if(!Number.isFinite(dt)||dt<0)throw new Error('Invalid physics time');
    if(!this.dynamic.size||!this.changed&&![...this.dynamic.values()].some(b=>!b.isSleeping())){this.accumulator=0;this.changed=false;return;}
    this.accumulator+=Math.min(dt,.05);
    while(this.accumulator>=physicsSettings.step){this.world.step();this.changed=false;this.accumulator-=physicsSettings.step;}
  }
  remove(id){
    this.changed=true;
    const body=this.dynamic.get(id);if(body){this.world.removeRigidBody(body);this.dynamic.delete(id);}
    for(const c of this.fixed.get(id)||[])this.world.removeCollider(c,true);this.fixed.delete(id);
  }
  dispose(){this.world.free();this.fixed.clear();this.dynamic.clear();}
}
