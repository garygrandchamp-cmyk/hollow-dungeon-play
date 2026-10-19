import {createWallDressingFactory,PAINTINGS} from './wall-dressing.js?v=84fc371936953c752f7d36674575129dbb0d8ea1';
import {decodeWallPainting} from './wall-painting-data.js?v=84fc371936953c752f7d36674575129dbb0d8ea1';
import {tagTextureDensity} from './pixel-density.js?v=84fc371936953c752f7d36674575129dbb0d8ea1';

export function createDungeonWallDressing(THREE,{plans=[],groundHeight=()=>0,graphicsProfile='normal'}={}){
 const root=new THREE.Group(),maps={};root.name='room-wall-dressing';
 for(const plan of plans){
  if(!plan.kind.startsWith('painting:'))continue;const key=plan.kind.slice(9);if(maps[key])continue;
  const art=decodeWallPainting(key),upload=new Uint8Array(art.data.length),stride=art.width*4;
  // Native image rows start at the top; typed texture rows start at UV v=0.
  for(let y=0;y<art.height;y++)upload.set(art.data.subarray(y*stride,(y+1)*stride),(art.height-1-y)*stride);
  const map=new THREE.DataTexture(upload,art.width,art.height);
  map.name='painting-'+key;tagTextureDensity(map,[PAINTINGS[key].width,PAINTINGS[key].height]);maps[key]=map;
 }
 const factory=createWallDressingFactory(THREE,{paintingMaps:maps,graphicsProfile}),colliders=[];
 for(const plan of plans){
  const y=groundHeight(plan.x,plan.z);if(!Number.isFinite(y))continue;
  const object=factory.make(plan.kind);object.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(object),size=bounds.getSize(new THREE.Vector3());
  object.userData.collisionBounds=bounds;object.userData.solidSize={width:size.x,height:size.y,depth:size.z};
  object.userData.decoration=true;object.userData.wallDressingPlan={...plan};
  // Fixed painted surfaces retain their authored UVs, but participate in the
  // same distance culling as the already-batched frame and wall geometry.
  object.traverse(mesh=>{if(mesh.isMesh){mesh.userData.dynamic=false;mesh.userData.staticBatch=true;}});
  object.position.set(plan.x,y+plan.y,plan.z);object.rotation.y=plan.yaw;
  root.add(object);colliders.push({sprite:object});
 }
 let disposed=false;
 return {root,colliders,prune(keep){const removed=[];for(let i=colliders.length-1;i>=0;i--){const object=colliders[i].sprite;
  if(keep(object.userData.wallDressingPlan))continue;object.userData.dispose();removed.push(object);colliders.splice(i,1);
 }return removed;},dispose(){if(disposed)return;disposed=true;factory.dispose();Object.values(maps).forEach(map=>map.dispose());root.removeFromParent();}};
}
