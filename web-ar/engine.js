import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MindARThree} from '../card-webar/vendor/mindar-image-three.prod.js';
import {createImmersiveMenu} from './menu-controller.js';
const cfg=JSON.parse(document.getElementById('ar-config').textContent);
const el=id=>document.getElementById(id);
let ar=null, model=null, starting=false, generation=0, width=cfg.smallWidthM;
const menu=createImmersiveMenu({surface:document,menu:el('menu-panel'),guide:el('frame-guide'),hint:el('touch-hint')});
function applyWidth(value){
  width=value;
  if(model){model.scale.setScalar(width/(cfg.width*cfg.targetWidthM));model.position.set(0,0,.015);}
  el('scale-label').textContent=`표시 폭 ${width.toFixed(2)}m · 인식판 폭 18cm 기준`;
  el('size-small').setAttribute('aria-pressed',String(Math.abs(width-cfg.smallWidthM)<.001));
  el('size-native').setAttribute('aria-pressed',String(Math.abs(width-cfg.nativeWidthM)<.001));
}
function disposeModel(root){
  const textures=new Set(),materials=new Set(),geometry=new Set();
  root?.traverse(o=>{if(o.geometry)geometry.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])materials.add(m);});
  for(const m of materials)for(const v of Object.values(m))if(v?.isTexture)textures.add(v);
  for(const t of textures)t.dispose();for(const m of materials)m.dispose();for(const g of geometry)g.dispose();
}
function release(current){
  try{current?.renderer.setAnimationLoop(null);}catch{}
  try{current?.controller?.stopProcessVideo();current?.controller?.worker?.terminate();}catch{}
  try{current?.video?.srcObject?.getTracks().forEach(t=>t.stop());current?.video?.remove();}catch{}
  if(current?._arResizeHandler)window.removeEventListener('resize',current._arResizeHandler);
  try{current?.renderer.dispose();}catch{}
}
export async function stop({exitFullscreen=false}={}){
  generation++;const current=ar;ar=null;release(current);disposeModel(model);model=null;menu.deactivate();
  el('camera').replaceChildren();document.body.classList.remove('running');el('welcome').hidden=false;el('live-ui').hidden=true;
  if(exitFullscreen&&document.fullscreenElement)try{await document.exitFullscreen();}catch{}
}
export async function start(update){
  if(starting)return;starting=true;const token=++generation;
  try{
    update('콘텐츠를 준비 중입니다…');
    const gltf=await new GLTFLoader().loadAsync(new URL(cfg.model,document.baseURI).href,p=>{if(p.total)update(`콘텐츠를 준비 중입니다… ${Math.round(p.loaded/p.total*100)}%`);});
    if(token!==generation){disposeModel(gltf.scene);return;}
    model=gltf.scene;
    ar=new MindARThree({container:el('camera'),imageTargetSrc:new URL(cfg.target,document.baseURI).href,maxTrack:1,uiLoading:'no',uiScanning:'no',uiError:'no',filterMinCF:.001,filterBeta:1000,warmupTolerance:5,missTolerance:8});
    ar.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));ar.renderer.outputColorSpace=THREE.SRGBColorSpace;
    ar.scene.add(new THREE.HemisphereLight(0xffffff,0x8d8b7a,2));const light=new THREE.DirectionalLight(0xffffff,1.4);light.position.set(1,2,3);ar.scene.add(light);
    const anchor=ar.addAnchor(0);anchor.group.add(model);applyWidth(width);
    anchor.onTargetFound=()=>{el('tracking').textContent='인식됐습니다. 콘텐츠를 살펴보세요.';menu.found();};
    anchor.onTargetLost=()=>{el('tracking').textContent='인식판 전체를 다시 비춰 주세요.';};
    update('카메라 사용을 허용해 주세요.');document.body.classList.add('running');el('welcome').hidden=true;el('live-ui').hidden=false;el('tracking').textContent='인식판 전체를 비춰 주세요.';menu.activate();
    const active=ar;await active.start();if(token!==generation){release(active);return;}
    const {renderer,scene,camera}=active;renderer.setAnimationLoop(()=>renderer.render(scene,camera));
  }catch(error){await stop();throw error instanceof Error?error:new Error('카메라를 시작하지 못했습니다. 카메라 사용 허용을 확인하고 Chrome 또는 Safari에서 다시 열어 주세요.');}
  finally{starting=false;}
}
el('stop').addEventListener('click',()=>stop({exitFullscreen:true}));
el('size-small').addEventListener('click',()=>{applyWidth(cfg.smallWidthM);menu.refresh();});
el('size-native').addEventListener('click',()=>{applyWidth(cfg.nativeWidthM);menu.refresh();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&ar)menu.toggle();});
window.addEventListener('pagehide',()=>stop());
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(ar||starting))stop();});
