import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {defaults,sanitize,poseInFront,applyProfile,normalizeModel} from './placement.js?v=20261110s2';
const $=id=>document.getElementById(id), params=new URLSearchParams(location.search);
const configs=await fetch('../web-ar/config.json').then(r=>{if(!r.ok)throw Error('설정을 불러오지 못했습니다.');return r.json();});
const notes={flower:'입구 밖에서 내부 흰색 바닥을 향해 배치합니다. 바닥 경계·깊이는 현장 조정이 필요합니다.',stairs:'곡면 벽에 맞출 콘텐츠입니다. 계단 상·하부의 평평한 공간에서 확인하세요. 곡률은 기존 모델을 유지합니다.',card:'복도 끝 정면 벽에 배치합니다. 열린 철문과 벽면 표시 범위를 확인하세요.',women:'감방 입구에서 안을 바라보며 여성 두 명의 발 위치를 내부 바닥에 맞춥니다.',brothers:'야외 잔디밭용입니다. 최초 정면 기준 거리는 2m이며 기존 6인 모델 배치를 유지합니다. 한 명씩 보이는 크기와 간격은 현장에서 확인하세요.'};
let cfg,profile,renderer,scene,camera,session,root,offset,model,reticle,hitSource,hitSpace,refSpace;
let pose=null,lastHit=null,placed=false,mode=null,starting=false,token=0,hideTimer,hintTimer,slamCanvas=null,slamTimer=null,previewOrbit={az:0,el:.25,r:5},drag=null;
const labels={width:['전체 폭 (m)',.05],x:['좌우: 오른쪽 + (m)',.05],y:['높이: 위쪽 + (m)',.05],z:['앞뒤: 멀리 + (m)',.05],yaw:['방향 (도)',1],distance:['최초 배치 거리 (m)',.1],eyeHeight:['카메라 높이 (m)',.05]};
for(const c of Object.values(configs)){const o=document.createElement('option');o.value=c.id;o.textContent=c.title;$('content').append(o);}
$('content').value=configs[params.get('content')]?params.get('content'):'card';
function key(){return `remember1910-spatial-v1-${cfg.id}`;}
function readProfile(){let p;try{p=JSON.parse(localStorage.getItem(key()));}catch{}if(params.get('content')===cfg.id&&params.has('profile'))try{p=JSON.parse(params.get('profile'));}catch{}return sanitize(p,cfg);}
function choose(){cfg=configs[$('content').value];profile=readProfile();$('site-note').textContent=notes[cfg.id];$('title').textContent=cfg.title;$('image-link').href=`../${cfg.id}/`;renderFields();}
function renderFields(){$('fields').replaceChildren();for(const [k,[text,step]]of Object.entries(labels)){const label=document.createElement('label');label.textContent=text;const input=document.createElement('input');input.type='number';input.step=step;input.value=profile[k];input.dataset.field=k;input.addEventListener('change',()=>{profile=sanitize({...profile,[k]:input.value},cfg);input.value=profile[k];if(offset)applyProfile(offset,profile);if(mode==='preview')updatePreview();feedback(k==='distance'||k==='eyeHeight'?'다음 기준점 재배치부터 반영됩니다.':'조정했습니다.');
});label.append(input);$('fields').append(label);}}
function feedback(s){$('feedback').textContent=s;}
function showPanel(){if(!mode||!placed)return;clearTimeout(hideTimer);$('panel').hidden=false;hideTimer=setTimeout(()=>{if($('panel').contains(document.activeElement)){showPanel();return;}$('panel').hidden=true;},7000);}
function hidePanel(){clearTimeout(hideTimer);$('panel').hidden=true;}
$('panel').addEventListener('pointerdown',()=>{clearTimeout(hideTimer);});$('panel').addEventListener('pointerup',showPanel);$('panel').addEventListener('input',()=>{clearTimeout(hideTimer);});$('panel').addEventListener('focusout',()=>{if(mode)showPanel();});
$('close-panel').onclick=()=>{document.activeElement?.blur();hidePanel();};
function setLive(){document.body.classList.add('live');$('welcome').hidden=true;$('overlay').hidden=false;$('setup').hidden=false;$('tracking-warning').hidden=true;$('floor').disabled=true;$('place').disabled=true;hidePanel();}
function initScene(){renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;document.body.append(renderer.domElement);scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,.02,100);buildObjects();}
function buildObjects(){scene.add(new THREE.HemisphereLight(0xffffff,0x72766d,2));const light=new THREE.DirectionalLight(0xffffff,1.5);light.position.set(1,3,2);scene.add(light);root=new THREE.Group();offset=new THREE.Group();root.add(offset);root.visible=false;scene.add(root);reticle=new THREE.Mesh(new THREE.RingGeometry(.08,.1,32).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xe2bb64,side:THREE.DoubleSide}));reticle.matrixAutoUpdate=false;reticle.visible=false;scene.add(reticle);}
async function loadModel(t){const gltf=await new GLTFLoader().loadAsync(new URL(cfg.model,location.href).href);if(t!==token){dispose(gltf.scene);return false;}model=gltf.scene;offset.add(normalizeModel(model,cfg));applyProfile(offset,profile);return true;}
function dispose(obj){const ts=new Set(),ms=new Set(),gs=new Set();obj?.traverse(o=>{if(o.geometry)gs.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){ms.add(m);for(const v of Object.values(m))if(v?.isTexture)ts.add(v);}});ts.forEach(t=>t.dispose());ms.forEach(m=>m.dispose());gs.forEach(g=>g.dispose());}
async function startAR(){if(starting||mode)return;starting=true;$('start').disabled=true;const t=++token;try{
// Call directly in the click handler: preserve the user activation needed by WebXR.
const pending=navigator.xr.requestSession('immersive-ar',{requiredFeatures:['local-floor','dom-overlay'],optionalFeatures:['hit-test'],domOverlay:{root:$('overlay')}});
session=await pending;if(t!==token){await session.end();return;}
const active=session;active.addEventListener('end',()=>{if(session===active)cleanup();},{once:true});
if(!active.domOverlayState)throw Error('이 브라우저는 AR 조정 화면을 지원하지 않습니다. Android Chrome에서 열어 주세요.');
mode='xr';initScene();renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local-floor');await renderer.xr.setSession(active);refSpace=renderer.xr.getReferenceSpace();setLive();$('instruction').textContent='콘텐츠를 준비하고 있습니다…';
if(!await loadModel(t))return;
try{hitSpace=await active.requestReferenceSpace('viewer');if(t===token&&active.requestHitTestSource)hitSource=await active.requestHitTestSource({space:hitSpace});if(t!==token){hitSource?.cancel();return;}}catch{}
$('instruction').textContent='같은 시작점에서 정면을 향한 뒤 배치하세요. 바닥 원이 보이면 바닥 지점 배치도 가능합니다.';
renderer.setAnimationLoop((time,frame)=>{if(!frame)return;pose=frame.getViewerPose(refSpace);$('tracking-warning').hidden=!!pose;root.visible=placed&&!!pose;lastHit=null;reticle.visible=false;if(!placed&&pose&&hitSource){for(const hit of frame.getHitTestResults(hitSource)){const hp=hit.getPose(refSpace);if(!hp)continue;const matrix=new THREE.Matrix4().fromArray(hp.transform.matrix);const normal=new THREE.Vector3().setFromMatrixColumn(matrix,1);if(normal.y>.85){lastHit=matrix;reticle.matrix.copy(matrix);reticle.visible=true;break;}}}$('floor').disabled=!lastHit||!model;$('place').disabled=!pose||!model;renderer.render(scene,camera);});
}catch(e){const message=e?.name==='NotSupportedError'?'이 기기 또는 브라우저가 필요한 공간 AR 기능을 지원하지 않습니다.':e?.name==='NotAllowedError'?'AR 실행 권한이 허용되지 않았습니다.':e?.message||String(e);await exit();$('status').textContent=`공간 AR을 시작하지 못했습니다.\n${message}\n기존 이미지 AR은 아래 링크에서 이용할 수 있습니다.`;}
finally{starting=false;$('start').disabled=false;}}
function commit(matrix){if(!model)return;root.matrixAutoUpdate=false;root.matrix.copy(matrix);root.visible=true;placed=true;reticle.visible=false;$('setup').hidden=true;$('mode').textContent=mode!=='preview'?`${mode==='slam'?'8th Wall':'WebXR'} 공간 추적 중 · 화면 터치로 메뉴 열기`:'3D 미리보기 · 실제 카메라 추적 아님';$('tap-hint').hidden=false;clearTimeout(hintTimer);hintTimer=setTimeout(()=>{$('tap-hint').hidden=true;},2600);}
$('place').onclick=()=>{if(!pose)return;try{commit(poseInFront(new THREE.Matrix4().fromArray(pose.transform.matrix),profile.distance,profile.eyeHeight));}catch(e){$('instruction').textContent=e.message;}};
$('floor').onclick=()=>{if(!lastHit||!pose)return;const matrix=poseInFront(new THREE.Matrix4().fromArray(pose.transform.matrix),profile.distance,profile.eyeHeight);matrix.setPosition(new THREE.Vector3().setFromMatrixPosition(lastHit));commit(matrix);};
$('reposition').onclick=()=>{if(mode==='preview'){root.matrix.identity();showPanel();return;}placed=false;root.visible=false;$('setup').hidden=false;$('tap-hint').hidden=true;hidePanel();};
function updatePreview(){if(!camera||mode!=='preview')return;const h=(cfg.id==='flower'?cfg.depth:cfg.height)/cfg.width*profile.width;const target=new THREE.Vector3(profile.x,profile.y+h/2,-profile.z);previewOrbit.r=Math.max(profile.width,h,1)*1.4;const r=previewOrbit.r;camera.position.set(target.x+Math.sin(previewOrbit.az)*r*Math.cos(previewOrbit.el),target.y+Math.sin(previewOrbit.el)*r,target.z+Math.cos(previewOrbit.az)*r*Math.cos(previewOrbit.el));camera.lookAt(target);}
async function preview(){if(starting||mode)return;starting=true;const t=++token;try{mode='preview';initScene();scene.background=new THREE.Color(0x252b2c);setLive();$('instruction').textContent='미리보기 준비 중…';if(!await loadModel(t))return;commit(new THREE.Matrix4());updatePreview();showPanel();renderer.setAnimationLoop(()=>renderer.render(scene,camera));}catch(e){await exit();$('status').textContent=e.message;}finally{starting=false;}}
function cleanup(){const wasSlam=mode==='slam';token++;clearTimeout(slamTimer);if(wasSlam){try{window.XR8.stop();window.XR8.clearCameraPipelineModules();}catch{}}slamCanvas?.remove();slamCanvas=null;clearTimeout(hideTimer);clearTimeout(hintTimer);hitSource?.cancel();hitSource=null;hitSpace=null;refSpace=null;session=null;pose=null;lastHit=null;placed=false;renderer?.setAnimationLoop(null);dispose(scene);renderer?.dispose();renderer?.domElement.remove();renderer=null;scene=null;camera=null;root=null;offset=null;model=null;mode=null;$('overlay').hidden=true;$('welcome').hidden=false;document.body.classList.remove('live');}
async function exit(){const active=session;cleanup();try{await active?.end();}catch{}}
$('exit').onclick=exit;$('early-exit').onclick=exit;$('start').onclick=startAR;$('preview').onclick=preview;$('content').onchange=choose;
$('save').onclick=()=>{try{localStorage.setItem(key(),JSON.stringify(profile));feedback('이 기기에 저장했습니다.');}catch{feedback('저장하지 못했습니다. 설정 파일 저장을 이용해 주세요.');}};
$('download').onclick=()=>{const blob=new Blob([JSON.stringify(profile,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${cfg.id}-spatial-settings.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);feedback('설정 파일을 저장했습니다.');};
$('share').onclick=async()=>{const u=new URL(location.href);u.search='';u.searchParams.set('content',cfg.id);u.searchParams.set('profile',JSON.stringify(profile));try{await navigator.clipboard.writeText(u.href);feedback('설정이 포함된 링크를 복사했습니다. 새 실행 때 기준점 재배치가 필요합니다.');}catch{feedback(u.href);}};
$('reset').onclick=()=>{profile=defaults(cfg);renderFields();if(offset)applyProfile(offset,profile);if(mode==='preview')updatePreview();feedback('기본값으로 되돌렸습니다. 저장하려면 저장 버튼을 누르세요.');};
// DOM overlay interactions must never also become XR select actions.
$('overlay').addEventListener('beforexrselect',e=>{if(e.target.closest('button,input,select,section,#setup'))e.preventDefault();});
document.addEventListener('pointerdown',e=>{if(mode&&placed&&!e.target.closest('button,input,select,section,#setup'))drag={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};});
document.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>10)drag.moved=true;if(mode==='preview'&&drag.moved){previewOrbit.az+=dx*.005;previewOrbit.el=THREE.MathUtils.clamp(previewOrbit.el+dy*.005,-.5,1.3);drag.x=e.clientX;drag.y=e.clientY;updatePreview();}});
document.addEventListener('pointerup',e=>{if(!drag||drag.id!==e.pointerId)return;const d=drag;drag=null;if(d.moved||Math.hypot(e.clientX-d.x,e.clientY-d.y)>10)return;if($('panel').hidden)showPanel();else hidePanel();});document.addEventListener('pointercancel',()=>{drag=null;});
window.addEventListener('resize',()=>{if(renderer&&mode==='preview'){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);}});window.addEventListener('pagehide',exit);

function engineReady(){if(window.XR8?.XrController&&window.XR8?.Threejs){$('start-slam').disabled=false;$('slam-status').textContent='무료 공간 추적 엔진 준비 완료 · iPhone Safari / Android Chrome에서 테스트하세요.';}}
window.addEventListener('xrloaded',engineReady);engineReady();
async function startSlam(){if(starting||mode)return;starting=true;$('start-slam').disabled=true;const t=++token;
try{
// iOS sensor permission must originate in this button's user gesture.
const permission=typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'?DeviceOrientationEvent.requestPermission():Promise.resolve('granted');
if(await permission!=='granted')throw Error('동작 센서 사용을 허용해야 공간 추적을 실행할 수 있습니다.');
if(t!==token)return;window.THREE=THREE;const XR8=window.XR8;if(!XR8?.XrController)throw Error('공간 추적 엔진을 아직 준비하지 못했습니다.');
mode='slam';slamCanvas=document.createElement('canvas');document.body.append(slamCanvas);setLive();$('instruction').textContent='카메라 사용을 허용한 뒤 주변 무늬가 있는 곳을 천천히 비춰 주세요.';
XR8.clearCameraPipelineModules();XR8.XrController.configure({disableWorldTracking:false,scale:'absolute'});
XR8.addCameraPipelineModules([
 XR8.XrController.pipelineModule(),XR8.GlTextureRenderer.pipelineModule(),XR8.Threejs.pipelineModule(),
 {name:'remember1910-spatial',
 onStart:()=>{if(t!==token)return;clearTimeout(slamTimer);({scene,camera,renderer}=XR8.Threejs.xrScene());renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;buildObjects();XR8.XrController.updateCameraProjectionMatrix({origin:{x:0,y:profile.eyeHeight,z:0},facing:{x:0,y:0,z:0,w:1}});loadModel(t).catch(e=>{if(t===token)failSlam(e);});},
 onUpdate:({processCpuResult})=>{if(t!==token||!root)return;const reality=processCpuResult?.reality;const good=!!reality&&reality.trackingStatus==='NORMAL';pose=good?{transform:{matrix:new THREE.Matrix4().compose(new THREE.Vector3(reality.position.x,reality.position.y,reality.position.z),new THREE.Quaternion(reality.rotation.x,reality.rotation.y,reality.rotation.z,reality.rotation.w),new THREE.Vector3(1,1,1)).elements}}:null;root.visible=placed&&good;$('tracking-warning').hidden=good;$('place').disabled=!good||!model;$('floor').disabled=true;if(good&&!placed)$('instruction').textContent='공간을 인식했습니다. 같은 시작점에서 정면을 향하고 정면 기준 배치를 누르세요.';},
 onException:(error)=>{if(t===token)failSlam(error);},
 }
]);
slamTimer=setTimeout(()=>{if(t===token&&!root)failSlam(Error('카메라 시작이 지연됐습니다. 권한을 확인한 뒤 다시 실행해 주세요.'));},45000);
XR8.run({canvas:slamCanvas,allowedDevices:XR8.XrConfig.device().MOBILE,sessionConfiguration:{disableXrTablet:true}});
}catch(e){await failSlam(e);}finally{starting=false;$('start-slam').disabled=false;}}
async function failSlam(error){await exit();$('slam-status').textContent=`공간 AR을 시작하지 못했습니다. ${error?.message||String(error)} 기존 이미지 AR 또는 3D 미리보기를 이용할 수 있습니다.`;}
$('start-slam').onclick=startSlam;

choose();
try{const supported=!!navigator.xr&&await navigator.xr.isSessionSupported('immersive-ar');$('start').disabled=!supported;$('status').textContent=supported?'공간 AR 지원을 확인했습니다. 실행 후 실제 추적을 점검해 주세요.':'이 브라우저는 공간 AR을 지원하지 않습니다. 3D 배치 미리보기와 기존 이미지 AR을 이용할 수 있습니다.';}catch{$('start').disabled=true;$('status').textContent='공간 AR 지원 확인에 실패했습니다. 3D 미리보기를 이용할 수 있습니다.';}
