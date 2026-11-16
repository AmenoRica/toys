import './style.css';
import {selectPalette} from './palette.js';
import * as THREE from 'three';
import {SplatMesh,SparkRenderer} from '@sparkjsdev/spark';
import {createPost} from '../render/post.js';
import {shadeFx,uniforms,setLights} from '../render/shade.js';
import {motionFx} from '../render/particles.js';
import {mulberry32} from '../noise.js';
import {createImpact} from './impact.js';
import {createFixedBatch} from './fixed-batch.js';
import {writeSplat as write} from './write-splat.js';
import {cacheSplatWrites} from './splat-cache.js';
import {createPhysicsWorker} from './physics-client.js';
import {createCutWorker} from './cut-worker-client.js';
import {createDisc,discSettings} from './disc.js';
import {beachSettings,terrain,groundHeight,shoreRadius,createBeachWorld,stepWalker} from './world.js';

document.body.innerHTML=`<main class="app"><header class="topbar"><a class="home-link" href="../">← toys</a><h1>Pixel-3DGS + Physics Test 1</h1><button id="settings" type="button">설정 / 사용법</button></header><div id="stage"><div id="menu"><section class="panel" aria-label="설정 및 사용법"><h2>설정</h2><label for="pixel">픽셀 크기 <output id="pixelValue">3</output></label><input id="pixel" type="range" min="1" max="6" step="1" value="3"><label for="colors">팔레트 색 수 <output id="colorsValue">28색</output></label><input id="colors" type="range" min="4" max="64" step="1" value="28"><label for="brightness">밝기 <output id="brightnessValue">100%</output></label><input id="brightness" type="range" min="50" max="200" step="5" value="100"><button id="resume" class="primary" disabled>불러오는 중…</button><button id="reset" disabled>처음 위치로</button><details><summary>사용법</summary><p>WASD 이동 · Space 점프<br>마우스 시점 · 클릭 원반 발사<br>Esc 일시정지 / 설정<br>마우스 잠금이 지원되지 않으면 오른쪽 드래그로 시점을 움직입니다.</p><p>키보드와 마우스를 사용하는 데스크톱용 실험입니다.</p></details><div id="status" role="status"></div></section></div><div id="reticle" hidden></div></div></main>`;
const menu=document.querySelector('#menu'),resume=document.querySelector('#resume'),reset=document.querySelector('#reset'),status=document.querySelector('#status'),reticle=document.querySelector('#reticle');
const stage=document.querySelector('#stage');
const renderer=new THREE.WebGLRenderer({antialias:false});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));THREE.ColorManagement.enabled=false;renderer.outputColorSpace=THREE.LinearSRGBColorSpace;stage.prepend(renderer.domElement);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(72,1,.08,180),spark=new SparkRenderer({renderer});scene.add(spark);
const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
const profile=import.meta.env.DEV&&new URLSearchParams(location.search).has('profile')?(await import('./profile.js')).createFrameProfile(renderer):null;
const post=createPost({lowResolution:true});spark.falloff=0;spark.maxStdDev=1.5;spark.blurAmount=0;spark.preBlurAmount=.3;post.setCrisp(true);post.setBackground('#060b1b');
post.setPalette(selectPalette(28));
uniforms.fog.value.set(36,90);uniforms.bands.value=0;
let pixel=beachSettings.pixel,world=null,paused=true,fallback=false,looking=false,yaw=0,pitch=-.1,walker={x:0,z:11,y:groundHeight(0,11)+beachSettings.eye},last=performance.now(),time=0;
let stress=null,stressStatus=null,jumpRequested=false;
const disc=createDisc(),cutWorker=createCutWorker();
const keys=new Set(),drawn=new Map(),animated=[],meshes=[];
const writeCached=cacheSplatWrites(write);
function mesh(points,motion=null,unlit=false,cached=false){
  const m=new SplatMesh({editable:false,raycastable:false,constructSplats:s=>points.forEach((v,i)=>(cached?writeCached:write)(s,i,v))});if(!unlit)m.worldModifier=shadeFx({world:true,night:true});
  if(motion)m.objectModifier=motion;m.updateGenerator();scene.add(m);meshes.push(m);return m;
}
const impact=createImpact(),impactMesh=mesh(impact.points,null,true),impactLight={pos:new THREE.Vector3(),color:[.4,.9,1],power:0};
impactMesh.visible=false;
const bladePoints=[];
for(let ring=0;ring<8;ring++)for(let i=0;i<96;i++){
  const a=i/96*Math.PI*2,r=.5-ring*.043;
  bladePoints.push({p:[Math.cos(a)*r,0,Math.sin(a)*r],n:[0,1,0],r:ring===0?.027:.024,c:ring===0?[.75,1,1]:ring%2?[.06,.45,.56]:[.14,.72,.8],opacity:1});
}
bladePoints.push({p:[0,0,0],n:[0,1,0],scale:[.38,.38,.016],r:.38,c:[.05,.6,.75],opacity:.045});
const bladeMesh=mesh(bladePoints,null,true),bladeUp=new THREE.Vector3(0,1,0),hand=new THREE.Vector3(),aim=new THREE.Vector3(),right=new THREE.Vector3(),bladeNormal=new THREE.Vector3();
function handPosition(){camera.updateMatrixWorld();return hand.set(.4,-.32,-1.0).applyMatrix4(camera.matrixWorld).toArray();}
function launchDisc(){
  const origin=handPosition();camera.getWorldDirection(aim);aim.multiplyScalar(discSettings.range).add(camera.position);
  right.set(1,0,0).applyQuaternion(camera.quaternion);bladeNormal.crossVectors(right,new THREE.Vector3().fromArray(origin).sub(aim)).normalize();
  disc.launch(origin,aim.toArray(),bladeNormal.toArray());
}
function environment(){
  const rnd=mulberry32(723),land=[],sea=[],stars=[],grass=[];
  for(let x=-29;x<=29;x+=.22)for(let z=-29;z<=29;z+=.22){
    const r=Math.hypot(x,z);if(r>shoreRadius(Math.atan2(z,x))+1)continue;
    const y=groundHeight(x,z),normal=[groundHeight(x-.1,z)-groundHeight(x+.1,z),.2,groundHeight(x,z-.1)-groundHeight(x,z+.1)];
    const shade=.8+rnd()*.2,inner=r<14&&Math.sin(x*.4)*Math.cos(z*.35)>.15;
    land.push({p:[x,y,z],n:normal,r:.165,c:inner?[.37*shade,.43*shade,.26*shade]:[.76*shade,.68*shade,.49*shade]});
  }
  for(let x=-90;x<=90;x+=.8)for(let z=-90;z<=90;z+=.8){
    if(groundHeight(x,z)>.02)continue;
    const wave=Math.sin(x*.28+z*.43),shine=.55+.18*wave;
    sea.push({p:[x,-.03+wave*.012,z],n:[0,1,0],r:.65,c:[.1*shine,.27*shine,.44*shine]});
  }
  for(let i=0;i<280;i++){
    const a=rnd()*Math.PI*2,h=.12+rnd()*.85,r=Math.sqrt(1-h*h)*110;
    stars.push({p:[Math.sin(a)*r,h*110,Math.cos(a)*r],n:[0,0,1],r:.045+rnd()*.065,c:[.65,.76,.9],emissive:true,scale:[.07,.07,.07]});
  }
  stars.push({p:[-25,38,-65],n:[.3,-.35,.9],r:2.8,c:[.7,.79,.82],emissive:true});
  for(let i=0;i<4500;i++){
    const x=(rnd()-.5)*32,z=(rnd()-.5)*32,r=Math.hypot(x,z);if(r<2||r>17||Math.abs(x)<1.7&&z>0)continue;
    grass.push({p:[x,groundHeight(x,z)+.12,z],n:[0,0,1],scale:[.025,.12+rnd()*.1,.02],c:[.31,.4,.2],r:.05,leaf:true});
  }
  mesh(land);mesh(sea);mesh(stars);mesh(grass,motionFx('sway'));
  const sparks=[];for(let i=0;i<90;i++)sparks.push({p:[(rnd()-.5)*.7,groundHeight(0,0)+.5,(rnd()-.5)*.7],n:[0,1,0],r:.014+rnd()*.015,c:[1,.5,.1],emissive:true});
  mesh(sparks,motionFx('rise',new THREE.Vector3(1,2,0)),true);
}
const fixedMesh=mesh([]),fixedBatch=createFixedBatch(fixedMesh.packedSplats,write);
function sync(){
  if(fixedBatch.sync(world.entities))fixedMesh.numSplats=fixedMesh.packedSplats.numSplats;
  const ids=new Set(world.entities.filter(e=>e.detached&&!e.rigid.isSleeping()).map(e=>e.id));
  for(const [id,d] of drawn)if(!ids.has(id)){scene.remove(d.root);d.mesh.dispose();meshes.splice(meshes.indexOf(d.mesh),1);drawn.delete(id);}
  for(const e of world.entities){
    if(!ids.has(e.id))continue;
    let d=drawn.get(e.id);
    if(!d){const m=mesh(e.points,null,false,true),root=new THREE.Group();scene.remove(m);root.add(m);scene.add(root);m.position.set(e.x,e.y,e.z);m.rotation.y=e.angle;m.scale.setScalar(e.scale);d={mesh:m,root,revision:e.revision};drawn.set(e.id,d);}
    if(d.revision!==e.revision){e.points.forEach((v,i)=>writeCached(d.mesh.packedSplats,i,v));d.mesh.packedSplats.numSplats=e.points.length;d.mesh.packedSplats.needsUpdate=true;d.mesh.numSplats=e.points.length;d.revision=e.revision;}
    if(e.detached){const p=e.rigid.translation(),q=e.rigid.rotation();d.root.position.set(p.x,p.y,p.z);d.root.quaternion.set(q.x,q.y,q.z,q.w);}
  }
}
function showMenu(){paused=true;looking=false;keys.clear();jumpRequested=false;menu.hidden=false;reticle.hidden=true;resume.focus();}
function beginWalk(){paused=false;menu.hidden=true;reticle.hidden=false;keys.clear();jumpRequested=false;}
function useDrag(){fallback=true;beginWalk();}
async function enter(){
  if(!world)return;status.textContent='';if(fallback){beginWalk();return;}
  try{await renderer.domElement.requestPointerLock();}catch{useDrag();}
}
document.querySelector('#settings').onclick=()=>{document.exitPointerLock();showMenu();};
resume.onclick=enter;renderer.domElement.addEventListener('click',e=>{if(e.button!==0)return;if(paused)enter();else launchDisc();});
document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement===renderer.domElement){fallback=false;beginWalk();}else if(!fallback)showMenu();});
document.addEventListener('pointerlockerror',useDrag);
renderer.domElement.addEventListener('pointerdown',e=>{if(e.button===2&&!paused&&fallback){looking=true;renderer.domElement.setPointerCapture(e.pointerId);}});
for(const event of ['pointerup','pointercancel','lostpointercapture'])renderer.domElement.addEventListener(event,()=>looking=false);
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('mousemove',e=>{if(paused||(fallback&&!looking))return;yaw-=e.movementX*.002;pitch=Math.max(-1.4,Math.min(1.4,pitch-e.movementY*.002));});
document.addEventListener('keydown',e=>{if(e.code==='Escape'){if(document.pointerLockElement)document.exitPointerLock();showMenu();}if(!paused&&e.code==='Space'){e.preventDefault();if(!e.repeat)jumpRequested=true;}if(!paused&&['KeyW','KeyA','KeyS','KeyD'].includes(e.code)){keys.add(e.code);e.preventDefault();}});
document.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{document.exitPointerLock();showMenu();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){document.exitPointerLock();showMenu();}});
document.querySelector('#pixel').oninput=e=>{pixel=Number(e.target.value);document.querySelector('#pixelValue').value=String(pixel);resize();};
document.querySelector('#colors').oninput=e=>{const count=Number(e.target.value);post.setPalette(selectPalette(count));document.querySelector('#colorsValue').value=count+'색';};
document.querySelector('#brightness').oninput=e=>{const percent=Number(e.target.value);post.setBrightness(percent/100);document.querySelector('#brightnessValue').value=percent+'%';};
reset.onclick=()=>{walker={x:0,z:11,y:groundHeight(0,11)+beachSettings.eye};yaw=0;pitch=-.1;disc.reset();impact.clear();impactMesh.visible=false;keys.clear();jumpRequested=false;status.textContent='처음 위치로 돌아왔습니다.';};
function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();const lw=Math.max(1,Math.round(w/pixel)),lh=Math.max(1,Math.round(h/pixel));target.setSize(lw,lh);post.setSizes(lw,lh,pixel*renderer.getPixelRatio());}
window.addEventListener('resize',resize);new ResizeObserver(resize).observe(stage);resize();
try{
  const [tree,fire]=await Promise.all(['models/push-tree.json','models/beach-fire.json'].map(async url=>{const r=await fetch(new URL(url,document.baseURI));if(!r.ok)throw new Error(url);return r.json();}));
  environment();for(const lit of [false,true]){const f=mesh(fire.filter(v=>!!v.emissive===lit));f.position.y=groundHeight(0,0);f.scale.setScalar(2.8);if(lit)animated.push(f);}
  const physics=await createPhysicsWorker({terrain:terrain(),cell:.6});
  world=await createBeachWorld(tree.points,{prepare:cutWorker.prepare,physics});sync();resume.disabled=false;reset.disabled=false;resume.textContent='해변 걷기';
}catch(error){status.textContent='섬을 불러오지 못했습니다. 새로고침해 주세요.';console.error(error);}
const fireLight=[{pos:new THREE.Vector3(0,groundHeight(0,0)+1,0),color:[1,.45,.12],power:5}];
function frame(now){
  profile?.begin(now,stress?'stress':disc.phase,paused);
  if(world?.physics.error&&!paused){status.textContent='물리 계산에 문제가 생겼습니다. 새로고침해 주세요.';document.exitPointerLock();showMenu();}
  const dt=Math.max(0,Math.min((now-last)/1000,.05));last=now;
  if(!paused&&world){
    time+=dt;let f=Number(keys.has('KeyW'))-Number(keys.has('KeyS')),s=Number(keys.has('KeyD'))-Number(keys.has('KeyA'));const len=Math.hypot(f,s)||1;
    f*=beachSettings.speed*dt/len;s*=beachSettings.speed*dt/len;
    walker=stepWalker(walker,-Math.sin(yaw)*f+Math.cos(yaw)*s,-Math.cos(yaw)*f-Math.sin(yaw)*s,world.entities,dt,jumpRequested);jumpRequested=false;
  }
  camera.position.set(walker.x,walker.y,walker.z);camera.rotation.set(pitch,yaw,0,'YXZ');
  const home=handPosition();profile?.mark('walk');
  if(!paused&&world){
    let from=null,to=null;
    disc.step(dt,home,(a,b)=>{from??=a;to=b;});
    if(from){const hit=world.strike(from,to,disc.normal);if(hit){disc.bounce(hit,from,to);impact.emit(hit.surfacePosition,hit.normal);}}
    if(stress)stressStatus=stress.step(dt);
    profile?.mark('strike');world.step(dt);profile?.mark('physics');sync();profile?.mark('sync');
    impactMesh.visible=impact.step(dt);
    if(impactMesh.visible){impact.points.forEach((v,i)=>write(impactMesh.packedSplats,i,v));impactMesh.packedSplats.needsUpdate=true;}
    const cutFailure=world.entities.find(e=>e.cutError);if(cutFailure){status.textContent='절단 계산에 문제가 생겼습니다. 새로고침해 주세요.';document.exitPointerLock();showMenu();}
  }
  if(disc.phase==='held'){
    bladeMesh.position.fromArray(home);bladeMesh.scale.setScalar(.5);bladeMesh.quaternion.copy(camera.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),.3));
  }else{bladeMesh.position.fromArray(disc.position);bladeMesh.scale.setScalar(1);bladeMesh.quaternion.setFromUnitVectors(bladeUp,bladeNormal.fromArray(disc.normal));}
  bladeMesh.rotateY(time*14);uniforms.camera.value.copy(camera.position);uniforms.time.value=time;
  impactLight.pos.fromArray(impact.position);impactLight.power=impact.power;
  setLights([...fireLight,{pos:bladeMesh.position,color:[.1,.75,1],power:.45},impactLight],time);for(const m of animated)m.scale.y=2.8*(1+.06*Math.sin(time*8)+.04*Math.sin(time*13));
  for(const m of meshes)m.updateVersion();profile?.mark('prepare');profile?.renderStart();renderer.setRenderTarget(target);renderer.setClearColor(0,0);renderer.clear();renderer.render(scene,camera);profile?.renderEnd();profile?.renderStart('post');renderer.setRenderTarget(null);post.render(renderer,target.texture,true,.42);profile?.mark('render');profile?.end(stressStatus?{...stressStatus,physics:world.physics.metrics||{colliders:world.physics.world.colliders.len(),awake:[...world.physics.dynamic.values()].filter(b=>!b.isSleeping()).length}}:null);requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// The slow push remains a development operation; mouse input launches only the disc.
window.beachDemo={deform:(...args)=>{const result=world?.deform(...args);if(world)sync();return result;},stats:()=>({position:{...walker},paused,pixel,disc:disc.phase,objects:world?.entities.length??0})};

if(profile){
 const {createStress}=await import('./stress.js');
 const load=document.createElement('button');load.textContent='28그루 연속 절단 시험';load.style.cssText='position:fixed;left:12px;top:58px;z-index:20;width:auto;padding:8px';load.onclick=()=>{if(!world||stress)return;stress=createStress(world);fallback=true;beginWalk();load.disabled=true;};document.body.append(load);
 let profileTree=0;
 const button=document.createElement('button');button.textContent='나무 앞에서 측정';button.style.cssText='position:fixed;left:12px;top:12px;z-index:20;width:auto;padding:8px';
 button.onclick=()=>{const trees=world?.entities.filter(e=>e.kind==='tree'&&!e.detached&&e.points.length>3000)||[],e=trees[profileTree++%trees.length];if(!e)return;button.textContent='다음 나무 측정 · '+e.id;walker={x:e.x,z:e.z+5,y:groundHeight(e.x,e.z+5)+beachSettings.eye};yaw=0;pitch=Math.atan2(e.y+.72*e.scale+.25-walker.y,5);fallback=true;beginWalk();};document.body.append(button);
}
