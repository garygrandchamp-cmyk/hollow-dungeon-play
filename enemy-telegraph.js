// Restrained faceted floor outline, not a luminous full-screen combat effect.
export function makeEnemyTelegraph(THREE,profile){
 const reach=profile.lunge?profile.trigger:profile.reach;
 const geometry=new THREE.RingGeometry(Math.max(.1,reach-.055),reach,12,1,Math.PI/2-profile.arc/2,profile.arc);
 geometry.rotateX(-Math.PI/2);
 const material=new THREE.MeshBasicMaterial({color:profile.lunge?0x9c8063:0xa58d65,transparent:true,opacity:.6,depthTest:true,depthWrite:false,side:THREE.DoubleSide,fog:true,toneMapped:false});
 const mesh=new THREE.Mesh(geometry,material);mesh.name='enemy-committed-attack-warning';mesh.userData.ownGeometry=true;mesh.userData.dynamic=true;mesh.renderOrder=2;
 let disposed=false,geometryDisposed=false;geometry.addEventListener('dispose',()=>geometryDisposed=true);mesh.userData.disposeMaterials=()=>{if(disposed)return;disposed=true;material.dispose();};
 return {mesh,update(enemy){const intent=enemy.intent;mesh.visible=enemy.hp>0&&!!intent&&intent.phase!=='recover';if(!intent)return;mesh.position.set(intent.origin.x,intent.origin.y+.035,intent.origin.z);mesh.rotation.y=Math.atan2(-(intent.aim.x-intent.origin.x),-(intent.aim.z-intent.origin.z));material.opacity=intent.phase==='windup'?.35+.3*(1-intent.remaining/profile.windup):.3;},dispose(){mesh.removeFromParent();mesh.userData.disposeMaterials();if(!geometryDisposed)geometry.dispose();}};
}
