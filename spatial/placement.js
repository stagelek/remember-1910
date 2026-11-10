import * as THREE from 'three';
export const VERSION=1;
const limits={width:[.1,30],x:[-30,30],y:[-10,10],z:[-30,30],yaw:[-180,180],distance:[.3,15],eyeHeight:[.5,2.2]};
export function defaults(cfg){return {version:VERSION,id:cfg.id,width:cfg.nativeWidthM,x:0,y:0,z:0,yaw:0,distance:2,eyeHeight:1.5};}
export function sanitize(input,cfg){const p=defaults(cfg);if(!input||input.id!==cfg.id)return p;for(const [k,[lo,hi]]of Object.entries(limits)){const n=Number(input[k]);if(input[k]!==undefined&&Number.isFinite(n))p[k]=Math.min(hi,Math.max(lo,n));}return p;}
// Shared floor origin: stand at the same marked spot and face the same reference.
// Session coordinates are deliberately never persisted.
export function poseInFront(cameraMatrix,distance,eyeHeight){const pos=new THREE.Vector3().setFromMatrixPosition(cameraMatrix);const forward=new THREE.Vector3(0,0,-1).transformDirection(cameraMatrix);forward.y=0;if(forward.lengthSq()<.01)throw new Error('휴대폰을 수평 방향으로 향해 주세요.');forward.normalize();const yaw=Math.atan2(-forward.x,-forward.z);pos.addScaledVector(forward,distance);pos.y-=eyeHeight;return new THREE.Matrix4().compose(pos,new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw),new THREE.Vector3(1,1,1));}
export function applyProfile(group,p){group.position.set(p.x,p.y,-p.z);group.rotation.set(0,THREE.MathUtils.degToRad(p.yaw),0);group.scale.setScalar(p.width);}
export function normalizeModel(model,cfg){if(cfg.id==='flower')model.rotation.x=-Math.PI/2;model.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(model);const size=bounds.getSize(new THREE.Vector3());if(!(size.x>0))throw new Error('모델 크기를 확인할 수 없습니다.');const normalized=new THREE.Group();normalized.add(model);model.position.sub(new THREE.Vector3((bounds.min.x+bounds.max.x)/2,bounds.min.y,(bounds.min.z+bounds.max.z)/2));normalized.scale.setScalar(1/size.x);return normalized;}
