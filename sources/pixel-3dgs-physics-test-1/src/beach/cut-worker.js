import {prepareCut} from './cut-processing.js';
import {worldPoints} from './world.js';
import {prepareColliders} from '../push-lab/physics.js';
self.onmessage=async({data:{id,points,contacts,placement}})=>{
 try{
  const result=prepareCut(points,contacts);
  result.colliders=await prepareColliders(result.groups.map(p=>worldPoints(p,placement)),.6);
  const buffers=result.colliders.flatMap(group=>group.flatMap(c=>c.vertices?[c.vertices.buffer,...(c.indices?[c.indices.buffer]:[])]:[]));
  self.postMessage({id,result},buffers);
 }catch(error){self.postMessage({id,error:error.message});}
};
