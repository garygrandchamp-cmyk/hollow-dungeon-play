import {pursuerBlocks} from './dm-boss-encounters.js?v=1d78ea79feefea23b13aa344fdb80a6c28d88fec';
// Navigation queries share the host's wall/floor rules and add body clearance
// against tagged solid props and living enemies supplied by the host.
export function createEnemyNavigation(THREE,{world,coord,canCross,getState,getEnemies=()=>getState().enemies??[]}){
 let obstacles=[];const radii=new WeakMap();
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
  radius=Number.isFinite(radius)?Math.max(.05,Math.min(1,radius)):.25;radii.set(enemy,radius);
  const bodies=(getEnemies()??[]).filter(e=>e!==enemy&&(!e.id||e.id!==enemy.id)&&e.hp>0&&e.position&&e.type!=='ceiling-widow'&&pursuerBlocks(e));
  const obstructed=(from,next)=>bodies.some(other=>{if(Math.abs(other.position.y-next.y)>=.6)return false;const gap=radius+(radii.get(other)??(other.boss?.5:.28)),after=Math.hypot(other.position.x-next.x,other.position.z-next.z),before=Math.hypot(other.position.x-from.x,other.position.z-from.z);return after<gap&&after<=before+1e-8;});
  const steps=Math.max(1,Math.ceil(distance/.09)),stepX=dx/steps,stepZ=dz/steps;let moved=false;
  for(let k=0;k<steps;k++){
   const from=enemy.position,next=from.clone();next.x+=stepX;next.z+=stepZ;next.y=s.groundHeight?.(next.x,next.z)??0;
   const a=indexAt(from.x,from.z,s),b=indexAt(next.x,next.z,s);
   const supported=p=>{const index=indexAt(p.x,p.z,s);return index>=0&&(a===index||[1,s.size].includes(Math.abs(a-index))&&canCross(a,index))&&Math.abs(p.y-from.y)<=.26&&clear(p.x,p.z,p.y,radius,s)&&(!s.combatVisible||s.combatVisible(from.clone().add(new THREE.Vector3(0,.55,0)),p.clone().add(new THREE.Vector3(0,.55,0))));};
   if(a<0||b<0||a!==b&&(![1,s.size].includes(Math.abs(a-b))||!canCross(a,b))||Math.abs(next.y-from.y)>.26||!clear(next.x,next.z,next.y,radius,s))break;
   if(s.combatVisible&&!s.combatVisible(from.clone().add(new THREE.Vector3(0,.55,0)),next.clone().add(new THREE.Vector3(0,.55,0))))break;
   // Never tunnel through another living body, even during a fast lunge.
   if(s.partyMode&&(s.party??[]).some(a=>a.alive&&!a.escaped&&a.health>0&&Math.abs(a.position.y-next.y)<.6&&Math.hypot(a.position.x-next.x,a.position.z-next.z)<radius+.18))break;
   if(!s.partyMode&&s.position&&Math.abs(s.position.y-next.y)<.6&&Math.hypot(s.position.x-next.x,s.position.z-next.z)<radius+.18)break;
   if(obstructed(from,next)){
    // Ordinary pursuit can peel around a body, but a committed attack lane
    // must never bend after its warning. Every side step keeps swept checks.
    if(enemy.intent&&enemy.intent.phase!=='recover')break;
    const sign=[...String(enemy.id??'enemy')].reduce((n,c)=>n+c.charCodeAt(0),0)%2?1:-1;let side=null;
    for(const direction of [sign,-sign]){const p=from.clone();p.x+=-stepZ*direction;p.z+=stepX*direction;p.y=s.groundHeight?.(p.x,p.z)??0;if(!supported(p)||obstructed(from,p))continue;const actors=s.partyMode?s.party??[]:s.position?[{alive:true,health:1,position:s.position}]:[];if(actors.some(a=>a.alive&&!a.escaped&&a.health>0&&Math.abs(a.position.y-p.y)<.6&&Math.hypot(a.position.x-p.x,a.position.z-p.z)<radius+.18))continue;side=p;break;}
    if(!side)break;next.copy(side);
   }
   from.copy(next);enemy.index=indexAt(next.x,next.z,s);moved=true;
  }
  return moved;
 }
 return {rebuild,move,indexAt:(x,z)=>indexAt(x,z,getState())};
}
