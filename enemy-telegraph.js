import {enemyLungeTravel} from './enemy-behavior.js?v=096375a8b41b569f9c1ed4904ee997628eeda887';
// Restrained floor outlines. Sweeps keep their arc; a charge gets straight rails.
export function makeEnemyTelegraph(THREE,profile){
 const geometry=profile.lunge?new THREE.BufferGeometry():new THREE.RingGeometry(Math.max(.1,profile.reach-.055),profile.reach,12,1,Math.PI/2-profile.arc/2,profile.arc);
 let laneLength=-1;
 function lane(length){
  if(length===laneLength)return;laneLength=length;
  const values=[],width=profile.reach,stroke=.055;
  const quad=(x,z,w,h)=>{const l=x-w/2,r=x+w/2,n=z-h/2,s=z+h/2;values.push(l,0,n,l,0,s,r,0,n,r,0,n,l,0,s,r,0,s);};
  for(const x of [-width,width])quad(x,-length/2,stroke,length);
  for(const z of [0,-length])quad(0,z,width*2,stroke);
  for(const t of [.35,.7])quad(0,-length*t,stroke,.18);
  let attribute=geometry.attributes.position;if(!attribute){attribute=new THREE.Float32BufferAttribute(values,3);attribute.setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('position',attribute);}else{attribute.array.set(values);attribute.needsUpdate=true;}
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
 }
 if(profile.lunge)lane(profile.trigger);else geometry.rotateX(-Math.PI/2);
 const material=new THREE.MeshBasicMaterial({color:profile.lunge?0x9c8063:0xa58d65,transparent:true,opacity:.6,depthTest:true,depthWrite:false,side:THREE.DoubleSide,fog:true,toneMapped:false});
 const mesh=new THREE.Mesh(geometry,material);mesh.name='enemy-committed-attack-warning';mesh.userData.ownGeometry=true;mesh.userData.dynamic=true;mesh.renderOrder=2;
 let disposed=false,geometryDisposed=false;geometry.addEventListener('dispose',()=>geometryDisposed=true);mesh.userData.disposeMaterials=()=>{if(disposed)return;disposed=true;material.dispose();};
 return {mesh,update(enemy){const intent=enemy.intent;mesh.visible=enemy.hp>0&&!!intent&&intent.phase!=='recover';if(!intent)return;if(profile.lunge)lane(enemyLungeTravel(intent,profile)+profile.reach);mesh.position.set(intent.origin.x,intent.origin.y+.035,intent.origin.z);mesh.rotation.y=Math.atan2(-(intent.aim.x-intent.origin.x),-(intent.aim.z-intent.origin.z));const imminent=!!profile.punish&&intent.phase==='windup'&&intent.remaining<=.25;material.color.setHex(imminent?0xbba080:profile.lunge?0x9c8063:0xa58d65);material.opacity=intent.phase==='windup'?.35+(profile.punish?.45:.3)*(1-intent.remaining/profile.windup):.3;},dispose(){mesh.removeFromParent();mesh.userData.disposeMaterials();if(!geometryDisposed)geometry.dispose();}};
}
