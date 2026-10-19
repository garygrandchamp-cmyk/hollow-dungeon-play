import {CAPTURE_RULES,createCapture,tickCapture,struggleCapture,cutCapture,parseCapture,serializeCapture} from './creature-capture.js?v=b62f91ca9ddcf47d5a6312b8f4025115d5dbd33a';
import {tickCeilingWidow,WIDOW_RULES} from './ceiling-widow.js?v=b62f91ca9ddcf47d5a6312b8f4025115d5dbd33a';

// Host owns every transition. Guests only apply staged, bounded capture records.
export function createWidowEncounters({state,enemies,clear,notify=()=>{},sound=()=>{}}){
 let capture=null;const immunity=new Map();
 const actorId=s=>s.actor?.id??'solo';
 const living=a=>a&&a.alive!==false&&!a.fainted&&!a.escaped&&a.health>0;
 function actors(s){return s.partyMode?s.party??[]:[{...(s.actor??{}),id:actorId(s),alive:s.actor?.alive!==false,health:s.actor?.health??100,position:s.position,index:s.playerIndex}];}
 function free(reason){if(!capture)return;immunity.set(capture.actorId,CAPTURE_RULES.immunity);capture=null;notify(reason==='rescued'?'Silk cut! Your ally is free.':reason==='escaped'?'You tear through the cocoon.':reason==='dodged'?'You evade the falling snare.':'The silk loosens. You are free.');}
 function get(id=actorId(state())){return capture?.actorId===id?capture:null;}
 function blocked(id){return get(id)?.phase==='cocoon';}
 function tick(dt,enabled){const s=state();if(s.remote||!enabled)return;const step=Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0;
  for(const [id,time]of immunity){if(time<=step)immunity.delete(id);else immunity.set(id,time-step);}
  const party=actors(s);
  if(capture){const source=enemies(capture.floor).find(e=>e.id===capture.enemyId&&e.hp>0),target=party.find(a=>a.id===capture.actorId);
   if(capture.floor!==s.floor||!source||!living(target)){free('cancelled');return;}
   if(capture.phase==='cocoon'&&(Math.hypot(target.position.x-capture.origin.x,target.position.z-capture.origin.z)>.3||Math.abs(target.position.y-capture.origin.y)>.2)){free('cancelled');return;}
   if(capture.phase==='snare'&&(Math.hypot(target.position.x-capture.origin.x,target.position.z-capture.origin.z)>.8||Math.abs(target.position.y-capture.origin.y)>.45||!clear(source.position,target.position))){free('dodged');return;}
   const phase=capture.phase,result=tickCapture(capture,step);if(result.release){free(result.release);return;}
   if(phase!==capture.phase&&capture.phase==='cocoon'){target.guarding=false;sound('spider-alert');notify('COCOONED! E / Attack: struggle (4). Allies: cut the silk twice.');}
  }
  for(const enemy of enemies(s.floor))if(enemy.type==='ceiling-widow')tickCeilingWidow(enemy,{dt:step,active:true,floor:s.floor,targets:party.filter(a=>!immunity.has(a.id)),canSee:clear,hasCapture:()=>!!capture,startCapture:request=>{if(capture)return false;const target=party.find(a=>a.id===request.targetId);if(!living(target))return false;capture=createCapture({enemyId:enemy.id,actorId:target.id,floor:s.floor,origin:target.position});sound('spider-windup');notify('Silk falls from above — MOVE away from the snare!');return true;}});
 }
 const actionAllowed=s=>!s.remote&&!s.paused&&!s.busy&&!s.isGenerating&&!s.editing&&!s.watching&&!s.viewingOther&&(!s.partyMode||s.partyPhase==='active');
 function struggle(id=actorId(state())){const s=state();if(!actionAllowed(s)||!blocked(id))return false;const result=struggleCapture(capture);if(result.release)free(result.release);else if(result.changed)notify('Struggling free: '+capture.escape+' / 4');return result.changed;}
 function rescueTarget(position,id,forward,reach=2.25){if(!capture||capture.actorId===id||capture.floor!==state().floor)return null;const p=capture.origin,dx=p.x-position.x,dz=p.z-position.z,d=Math.hypot(dx,dz);return Math.abs(p.y-position.y)<=.45&&d<=reach&&(!forward||d<.1||(dx*forward.x+dz*forward.z)/d>.35)&&clear(position,p)?capture:null;}
 function cut(position,id,forward,reach){if(!actionAllowed(state())||!rescueTarget(position,id,forward,reach))return false;const result=cutCapture(capture);if(result.release)free(result.release);else if(result.changed){sound('swing');notify('Silk severed: '+capture.rescue+' / 2');}return result.changed;}
 function cancelEnemy(id){if(capture?.enemyId===id)free('rescued');}
 function snapshot(){return capture?[serializeCapture(capture)]:[];}
 function stage(value,staged,floor=state().floor){if(value===undefined)return null;if(!Array.isArray(value)||value.length>1)throw TypeError('Invalid captures.');if(!value.length)return null;const record=parseCapture(value[0]);const source=record&&staged[record.floor]?.enemies.find(e=>e.id===record.enemyId);if(!record||record.floor!==floor||!source?.position||Math.hypot(source.position.x-record.origin.x,source.position.z-record.origin.z)>WIDOW_RULES.triggerRadius+.01||Math.abs(source.position.y-record.origin.y)>.45||!actors(state()).some(a=>a.id===record.actorId)||!['snare','cocoon'].includes(record.phase)||!staged[record.floor]?.enemies.some(e=>e.id===record.enemyId&&e.type==='ceiling-widow'&&e.hp>0))throw TypeError('Invalid capture source.');return record;}
 function hint(id=actorId(state())){const c=get(id);return c?c.phase==='snare'?'FALLING SILK · MOVE away!':'COCOONED · E / Attack: struggle '+c.escape+'/4 · '+Math.ceil(c.remaining)+'s remaining':'';}
 return {get,blocked,tick,struggle,cut,rescueTarget,cancelEnemy,snapshot,stage,hint,apply(record){capture=record;},get current(){return capture;},reset(){capture=null;immunity.clear();}};
}
