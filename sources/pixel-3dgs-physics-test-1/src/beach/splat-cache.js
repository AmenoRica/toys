// Surface edits replace point objects. The cache never retains deleted points.
export function cacheSplatWrites(write){
 const cache=new WeakMap();
 return (splats,i,point)=>{
  const packed=cache.get(point);
  if(packed){splats.ensureSplats(i+1).set(packed,i*4);splats.numSplats=Math.max(splats.numSplats,i+1);}
  else{write(splats,i,point);cache.set(point,splats.packedArray.slice(i*4,i*4+4));}
 };
}
