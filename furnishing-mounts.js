import {wallTorchMountAllowed} from './torch-mounts.js?v=84fc371936953c752f7d36674575129dbb0d8ea1';

// The same solid-wall test used for torches also excludes doors, ingress grates
// and moving/secret panels from wall-backed furniture. Called after entrances
// are known; removed objects must leave both rendering and player collision.
export function pruneUnsafeWallFurnishings(THREE,{colliders,...context}){
 let removed=0;
 for(let i=colliders.length-1;i>=0;i--){
  const prop=colliders[i].sprite,d=prop?.userData.wallDirection;
  if(!Number.isInteger(d))continue;
  const [dx,dz]=[[0,-1],[1,0],[0,1],[-1,0]][d],position=prop.getWorldPosition(new THREE.Vector3()),half=(prop.userData.solidSize?.depth??.6)/2+.08;
  position.x+=dx*half;position.z+=dz*half;
  if(wallTorchMountAllowed({...context,position,normal:{x:-dx,z:-dz}}))continue;
  prop.userData.dispose?.();prop.removeFromParent();colliders.splice(i,1);removed++;
 }
 return removed;
}
