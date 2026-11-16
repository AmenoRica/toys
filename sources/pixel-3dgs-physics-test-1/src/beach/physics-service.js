import {createPhysics} from '../push-lab/physics.js';
export function physicsService(send){
 let physics=null;
 return async data=>{
  try{
   if(data.type==='init'){physics=await createPhysics(data.options);send({type:'ready'});return;}
   if(data.type!=='frame'||!physics)throw new Error('Invalid physics message');
   const start=performance.now();
   for(const command of data.commands){
    const {op,id,args}=command;
    if(op==='fixed')physics.setFixed(id,...args);
    else if(op==='add')physics.addDynamic(id,...args);
    else if(op==='remove')physics.remove(id);
    else if(['setTranslation','setRotation','setLinvel','setAngvel'].includes(op))physics.dynamic.get(id)?.[op](args[0],true);
    else throw new Error('Invalid physics command');
   }
   // Populate the broad phase during loading, before the first falling fragment.
   if(!physics.dynamic.size&&physics.changed){physics.world.step();physics.changed=false;}
   const commandMs=performance.now()-start,tick=performance.now();physics.step(data.dt);
   const stepMs=performance.now()-tick,states=new Float64Array(physics.dynamic.size*18);let offset=0,awake=0;
   for(const [id,b] of physics.dynamic){
    const p=b.translation(),q=b.rotation(),v=b.linvel(),w=b.angvel(),c=b.worldCom(),sleep=b.isSleeping();if(!sleep)awake++;
    states.set([id,p.x,p.y,p.z,q.x,q.y,q.z,q.w,v.x,v.y,v.z,w.x,w.y,w.z,c.x,c.y,c.z,+sleep],offset);offset+=18;
   }
   send({type:'state',sequence:data.sequence,states,metrics:{commandMs,stepMs,needsStep:physics.changed,bodies:physics.dynamic.size,awake,colliders:physics.world.colliders.len()}},[states.buffer]);
  }catch(error){send({type:'error',error:error.message});}
 };
}
