export const beachPalette=['#060b1b','#0a1224','#101e32','#192c43','#294058','#3c5368','#587083','#8193a0','#b9c7c9','#e3e4c9','#102a29','#1b3b32','#315344','#53634b','#4a3d34','#695441','#95704a','#c38c51','#edb966','#ffe7ac','#ffce66','#ed913b','#b64e26','#742f23','#226c7e','#3aa5b8','#68d4d9','#b2fbf0'];
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const hex=values=>'#'+values.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
const distance=(a,b)=>a.reduce((sum,v,i)=>sum+(v-b[i])**2*[.34,.60,.26][i],0);
export function selectPalette(count){
 if(!Number.isInteger(count)||count<4||count>64)throw new RangeError('Palette size must be 4–64');
 if(count===28)return [...beachPalette];
 const selected=count>28?[...beachPalette]:[beachPalette[0]];
 const candidates=new Set(beachPalette);
 if(count>28)for(let i=0;i<28;i++)for(let j=i+1;j<28;j++){
  const a=rgb(beachPalette[i]),b=rgb(beachPalette[j]);candidates.add(hex(a.map((v,k)=>(v+b[k])/2)));
 }
 const entries=[...candidates].map(color=>({color,value:rgb(color)}));
 while(selected.length<count){
  const current=selected.map(rgb);let best=null,score=-1;
  for(const entry of entries){
   if(selected.includes(entry.color))continue;
   const nearest=Math.min(...current.map(v=>distance(v,entry.value)));
   if(nearest>score){best=entry.color;score=nearest;}
  }
  selected.push(best);
 }
 return selected;
}
