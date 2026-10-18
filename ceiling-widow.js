// The position retained by game/navigation is the supported floor point.
// Render the existing giant-spider species at ceilingWidowPerch(enemy), rather
// than moving that gameplay point or drawing another ground-level spider.
export const WIDOW_RULES=Object.freeze({triggerRadius:2.3,warning:1.2,cooldown:8,elevationOffset:2.8});
const finite=n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=1e6;
const position=p=>p&&finite(p.x)&&finite(p.y)&&finite(p.z);
const identity=id=>typeof id==='string'&&/^[a-zA-Z0-9_.:-]{1,128}$/.test(id);
const floorId=n=>Number.isInteger(n)&&n>=0&&n<=1023;
const copy=p=>({x:p.x,y:p.y,z:p.z});
const sourceAlive=enemy=>enemy?.type==='ceiling-widow'&&identity(enemy.id)&&position(enemy.position)&&finite(enemy.hp)&&enemy.hp>0&&!enemy.arrival&&!enemy.controlled;

export function ceilingWidowPerch(enemy){
 if(!position(enemy?.position))return null;
 const perch={x:enemy.position.x,y:enemy.position.y+WIDOW_RULES.elevationOffset,z:enemy.position.z};
 return position(perch)?perch:null;
}

// Optional snapshot validation for the existing enemy.wait numeric field. No
// separate clock, wall time, random seed, player references or capture state.
export function parseWidowCooldown(value=0){
 if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>WIDOW_RULES.cooldown)throw TypeError('Invalid Ceiling Widow cooldown.');
 return value;
}

// canSee(from,to,target) must check physical walls, doors and other blockers.
// Both the floor-base segment and the descending ceiling segment must be clear:
// a high ray alone must not see over a closed door or snag an upper gallery.
export function selectCeilingWidowTarget(enemy,{floor,targets,canSee}={}){
 if(!sourceAlive(enemy)||!floorId(floor)||enemy.floor!==undefined&&enemy.floor!==floor||!Array.isArray(targets)||targets.length>64||typeof canSee!=='function')return null;
 const perch=ceilingWidowPerch(enemy);if(!perch)return null;
 let best=null,bestDistance=Infinity;
 for(const target of targets){
  if(!target||!identity(target.id)||target.alive!==true||target.fainted||target.escaped||!finite(target.health)||target.health<=0||!position(target.position)||target.floor!==undefined&&target.floor!==floor)continue;
  if(Math.abs(target.position.y-enemy.position.y)>.45)continue;
  const distance=Math.hypot(target.position.x-enemy.position.x,target.position.z-enemy.position.z);
  if(distance>WIDOW_RULES.triggerRadius||distance>bestDistance||distance===bestDistance&&best&&target.id>=best.id)continue;
  let clear=false;try{clear=canSee(copy(enemy.position),copy(target.position),target)===true&&canSee(copy(perch),copy(target.position),target)===true;}catch{/* Failed geometry queries cannot authorize a snare. */}
  if(clear){best=target;bestDistance=distance;}
 }
 return best;
}

// Host calls once per simulation tick instead of ordinary pursuit/contact AI.
// active must explicitly be true. hasCapture() queries the caller's current
// global capture state; never acquire while any capture is active. The caller
// owns warning/capture progress, cancellation, release, damage and replication.
// startCapture(request) is synchronous and must explicitly return true.
// Return value means "capture accepted", not whether to run ordinary AI next.
export function tickCeilingWidow(enemy,{dt,active=false,paused=false,remote=false,floor,targets,canSee,hasCapture,startCapture}={}){
 if(active!==true||paused||remote||!sourceAlive(enemy)||!floorId(floor)||enemy.floor!==undefined&&enemy.floor!==floor)return false;
 const step=Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0;if(step===0)return false;
 const current=enemy.wait===undefined?0:Number.isFinite(enemy.wait)&&enemy.wait>=0?Math.min(WIDOW_RULES.cooldown,enemy.wait):WIDOW_RULES.cooldown;
 const remaining=current<=step+1e-9?0:current-step;enemy.wait=remaining;
 if(remaining>0||typeof hasCapture!=='function'||typeof startCapture!=='function')return false;
 try{if(hasCapture()!==false)return false;}catch{return false;}
 const target=selectCeilingWidowTarget(enemy,{floor,targets,canSee});if(!target)return false;
 const request={kind:'ceiling-widow',sourceId:enemy.id,targetId:target.id,floor,warning:WIDOW_RULES.warning,origin:copy(target.position),perch:ceilingWidowPerch(enemy)};
 // Reserve before the synchronous callback so reentrant ticks cannot acquire
 // twice. Failed acquisition restores readiness; it never creates a snare.
 enemy.wait=WIDOW_RULES.cooldown;
 let accepted=false;try{accepted=startCapture(request)===true;}catch{/* Caller declined/failed: no capture or player mutation here. */}
 enemy.wait=accepted?WIDOW_RULES.cooldown:remaining;
 return accepted;
}
