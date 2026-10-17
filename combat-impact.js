// Cosmetic hit-stop affects held equipment only, never simulation or input.
export function impactPose(event,now){
 const age=now-event?.at;
 if(!event||![1,2].includes(event.strength)||!Number.isFinite(age)||age<0||age>180)return {time:now,kick:0};
 const stop=event.strength===2?85:55;
 return {time:age<stop?event.at:now,kick:(1-age/180)*(event.strength===2?1:.6)};
}
export const meleeImpactStrength=(kind,counter=false)=>counter||['axe','mace','hammer'].includes(kind)?2:1;
export function parseMeleeImpacts(list=[],offset=0){
 if(!Array.isArray(list)||list.length>4||!Number.isFinite(offset))throw TypeError('Invalid melee impacts');
 const seen=new Set();return list.map(e=>{
  if(!e||typeof e.actorId!=='string'||!/^[a-zA-Z0-9_.:-]{1,128}$/.test(e.actorId)||seen.has(e.actorId)||!Number.isSafeInteger(e.serial)||e.serial<1||e.serial>1e9||!Number.isFinite(e.at)||Math.abs(e.at)>1e12||![1,2].includes(e.strength)||typeof e.counter!=='boolean')throw TypeError('Invalid melee impact');
  seen.add(e.actorId);return {actorId:e.actorId,serial:e.serial,at:e.at+offset,strength:e.strength,counter:e.counter};
 });
}
