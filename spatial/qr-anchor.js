import * as THREE from 'three';
export function matchesQr(value,id){try{const u=new URL(value);return u.origin==='https://stagelek.github.io'&&u.pathname===`/remember-1910/${id}/`;}catch{return false;}}
export function markerMatrix(d,physicalWidth){const nums=[d.position?.x,d.position?.y,d.position?.z,d.rotation?.x,d.rotation?.y,d.rotation?.z,d.rotation?.w,d.scale,d.scaledWidth];if(nums.some(n=>!Number.isFinite(n)))return null;const factor=d.scale*d.scaledWidth/physicalWidth;if(!(factor>.05&&factor<20))return null;const q=new THREE.Quaternion(d.rotation.x,d.rotation.y,d.rotation.z,d.rotation.w);if(Math.abs(q.length()-1)>.05)return null;q.normalize();return new THREE.Matrix4().compose(new THREE.Vector3(d.position.x,d.position.y,d.position.z),q,new THREE.Vector3(factor,factor,factor));}
// Freeze a validated marker pose in SLAM space. QR loss does not clear it.
// Any SLAM tracking interruption invalidates it; require a fresh QR observation.
export function createQrAnchor({id,onLock,now=()=>performance.now(),samples=4}){
 let good=false,locked=false,decodedAt=-Infinity,last=null,count=0;
 return {
  tracking(normal){good=normal;if(!normal){locked=false;decodedAt=-Infinity;last=null;count=0;}},
  decoded(value){decodedAt=matchesQr(value,id)?now():-Infinity;},
  observe(d,width){if(locked||!good||d.name!==id||now()-decodedAt>1200)return false;const m=markerMatrix(d,width);if(!m)return false;const p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();m.decompose(p,q,s);
   if(last){const a=new THREE.Vector3(),b=new THREE.Quaternion(),c=new THREE.Vector3();last.decompose(a,b,c);if(p.distanceTo(a)>.05*Math.max(s.x,c.x)||q.angleTo(b)>.12||Math.abs(s.x/c.x-1)>.12)count=0;}
   last=m;count++;if(count<samples)return false;locked=true;onLock(m.clone());return true;},
  reset(){locked=false;decodedAt=-Infinity;last=null;count=0;},
  get locked(){return locked;}
 };
}
