// Navigation queries share the host's wall/floor rules and add body clearance
// against actual tagged solid props. No renderer or application global needed.
export function createEnemyNavigation(THREE,{world,coord,canCross,getState}){
 let obstacles=[];
 function rebuild(){obstacles=[];world.updateMatrixWorld(true);world.traverse(o=>{
  for(const b of o.userData.collisionBoxes??[])if(b?.isBox3)obstacles.push(b.clone().applyMatrix4(o.matrixWorld));
  const b=o.userData.collisionBounds;if(b?.isBox3)obstacles.push(b.clone().applyMatrix4(o.matrixWorld));
  else if(o.userData.solidObstacle&&o.geometry){o.geometry.computeBoundingBox();obstacles.push(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}
 });}
 function indexAt(x,z,s){const [ox,oz]=coord(0),[xx]=coord(1),[,zz]=coord(s.size),sx=xx-ox,sz=zz-oz;if(!sx||!sz)return -1;const col=Math.round((x-ox)/sx),row=Math.round((z-oz)/sz);return col<0||row<0||col>=s.size||row>=s.size?-1:row*s.size+col;}
 function clear(x,z,y,radius,s){
  for(const [dx,dz]of [[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius]])if(s.groundWalkable&&!s.groundWalkable(x+dx,z+dz))return false;
  for(const b of obstacles){if(y+.12>=b.max.y||y+1.35<=b.min.y)continue;const dx=Math.max(b.min.x-x,0,x-b.max.x),dz=Math.max(b.min.z-z,0,z-b.max.z);if(dx*dx+dz*dz<radius*radius)return false;}
  return true;
 }
 function move(enemy,dx,dz,radius=.25){
  const s=getState(),distance=Math.hypot(dx,dz);if(!Number.isFinite(distance)||!enemy.position||distance===0)return false;
  const steps=Math.max(1,Math.ceil(distance/.09)),stepX=dx/steps,stepZ=dz/steps;let moved=false;
  for(let k=0;k<steps;k++){
   const from=enemy.position,next=from.clone();next.x+=stepX;next.z+=stepZ;next.y=s.groundHeight?.(next.x,next.z)??0;
   const a=indexAt(from.x,from.z,s),b=indexAt(next.x,next.z,s);
   if(a<0||b<0||a!==b&&(![1,s.size].includes(Math.abs(a-b))||!canCross(a,b))||Math.abs(next.y-from.y)>.26||!clear(next.x,next.z,next.y,radius,s))break;
   if(s.combatVisible&&!s.combatVisible(from.clone().add(new THREE.Vector3(0,.55,0)),next.clone().add(new THREE.Vector3(0,.55,0))))break;
   // Never tunnel through another living body, even during a fast lunge.
   if(s.partyMode&&(s.party??[]).some(a=>a.alive&&!a.escaped&&a.health>0&&Math.abs(a.position.y-next.y)<.6&&Math.hypot(a.position.x-next.x,a.position.z-next.z)<radius+.18))break;
   if(!s.partyMode&&s.position&&Math.abs(s.position.y-next.y)<.6&&Math.hypot(s.position.x-next.x,s.position.z-next.z)<radius+.18)break;
   from.copy(next);enemy.index=b;moved=true;
  }
  return moved;
 }
 return {rebuild,move,indexAt:(x,z)=>indexAt(x,z,getState())};
}
