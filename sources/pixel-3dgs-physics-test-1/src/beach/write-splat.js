import * as THREE from 'three';
const p=new THREE.Vector3(),n=new THREE.Vector3(),q=new THREE.Quaternion(),scale=new THREE.Vector3(),color=new THREE.Color(),zAxis=new THREE.Vector3(0,0,1);
const yAxis=new THREE.Vector3(0,1,0);
const placementQ=new THREE.Quaternion(),placementP=new THREE.Vector3();
export function writeSplat(splats,i,v,placement=null){
  p.fromArray(v.p);n.fromArray(v.n||[0,1,0]);q.setFromUnitVectors(zAxis,n.normalize());if(v.quaternion)q.fromArray(v.quaternion);
  if(v.scale)scale.fromArray(v.scale);else scale.set(v.r,v.r,v.r*.45);color.setRGB(...v.c);
  if(placement){placementQ.setFromAxisAngle(yAxis,placement.angle);p.multiplyScalar(placement.scale).applyQuaternion(placementQ).add(placementP.set(placement.x,placement.y,placement.z));q.premultiply(placementQ);scale.multiplyScalar(placement.scale);
    if(placement.rigid){const b=placement.rigid,r=b.rotation(),t=b.translation();placementQ.set(r.x,r.y,r.z,r.w);p.applyQuaternion(placementQ).add(placementP.set(t.x,t.y,t.z));q.premultiply(placementQ);}
  }
  splats.setSplat(i,p,scale,q,v.opacity??(v.emissive?.9:v.leaf?.8:1),color);
}
