import {roomCells,roomContainsTile} from './room-footprint.js?v=096375a8b41b569f9c1ed4904ee997628eeda887';
export const CHAPEL_ACTIONS=Object.freeze(['chapel-bell','chapel-valve','chapel-winch','chapel-treasury','chapel-bargain','chapel-drop']);
export const CHAPEL_DM_COSTS=Object.freeze({'chapel-decoy':6,'chapel-rummage':8,'chapel-flood':12,'chapel-ring':8});
const live=a=>a&&a.alive!==false&&!a.fainted&&!a.escaped&&a.health>0;
const fresh=()=>({silenced:false,drained:false,treasury:false,bargain:false,holder:null,carrier:null,heat:0,ring:0,flood:0,decoy:0,decoyKind:'steps',whisper:0});
/** Optional encounter landmarks never alter WFC sockets, doors or required paths. */
export function planBellChapel(architecture,size){
 const room=architecture?.rooms?.[1];if(!room||Math.min(room.w,room.h)<5)return null;
 const reserved=new Set([architecture.start,architecture.start+1,architecture.start-size-1,architecture.start-size+1,architecture.stair,architecture.stair-1,architecture.stair-size,architecture.stair+size,...architecture.objectiveIndices??[],...architecture.doors.map(d=>d.index)]);
 const cells=roomCells(room).filter(p=>!reserved.has(p.z*size+p.x));if(cells.length<4)return null;
 const targets=[[room.x+1,room.z+1],[room.x+room.w-2,room.z+1],[room.x+1,room.z+room.h-2],[room.x+room.w-2,room.z+room.h-2]],nodes={};
 for(const [n,key]of ['bell','valve','winch','treasury'].entries()){
  cells.sort((a,b)=>Math.abs(a.x-targets[n][0])+Math.abs(a.z-targets[n][1])-(Math.abs(b.x-targets[n][0])+Math.abs(b.z-targets[n][1]))||a.z-b.z||a.x-b.x);
  const p=cells.shift();nodes[key]={index:p.z*size+p.x,x:p.x,z:p.z};
 }
 return {room,nodes,size};
}
export function selectChapelPlans(architectures,size,seed=''){
 const plans=architectures.map(a=>planBellChapel(a,size)),eligible=plans.map((p,i)=>p?i:-1).filter(i=>i>=0);if(!eligible.length)return plans;
 let hash=2166136261;for(const c of String(seed)+'|bell-chapel-v1')hash=Math.imul(hash^c.charCodeAt(0),16777619);
 const chosen=eligible[(hash>>>0)%eligible.length];return plans.map((p,i)=>i===chosen?p:null);
}
export function createBellChapel({state,notify=()=>{},sound=()=>{},reward=()=>false,restoreDM=()=>{},charge=()=>true,spendDM=()=>false,finalPursuit=()=>false}={}){
 let seed='',floors=[fresh(),fresh()],finalReady=false,finalUsed=false,noiseCooldown=new Map(),sequence=0,lastEvent=null;
 const context=()=>state(),current=()=>floors[context().floor];
 function reset(value=''){seed=String(value);floors=[fresh(),fresh()];finalReady=finalUsed=false;noiseCooldown.clear();sequence=0;lastEvent=null;}
 function event(message,kind='bell',node='bell'){const s=context();lastEvent={serial:++sequence,message,kind,floor:s.floor,node};if(message)notify(message);sound(kind,s.plan?.nodes[node]);}
 function noise(actor,amount=3){const s=context();if(s.remote||s.phase!=='active'||!live(actor)||!s.plan||!roomContainsTile(s.plan.room,actor.index%s.size,Math.floor(actor.index/s.size)))return false;const floor=current(),key=s.floor+':'+actor.id;if((noiseCooldown.get(key)??0)>0)return false;noiseCooldown.set(key,1);floor.heat=Math.min(100,floor.heat+amount);return true;}
 function near(actor,node){const s=context(),p=s.plan?.nodes[node];if(!p||!live(actor))return false;const [x,z]=s.coord(p.index);return Math.hypot(actor.position.x-x,actor.position.z-z)<2.9&&Math.abs(actor.position.y-s.groundHeight(x,z))<1.2&&(!s.visible||s.visible(actor.position,{x,y:s.groundHeight(x,z),z}));}
 function action(actor,kind){const s=context(),f=current();if(s.remote||s.paused||s.phase!=='active'||!live(actor)||!s.plan)return false;
  const node=kind==='chapel-bargain'?'treasury':kind.slice(7);
  if(kind==='chapel-drop'){if(f.carrier!==actor.id||!near(actor,'treasury'))return false;f.carrier=null;event('The whispering reliquary is returned to its plinth.','door','treasury');return true;}
  if(!near(actor,node)){notify('Approach the chapel '+node+'.');return false;}
  if(kind==='chapel-bell'){if(f.silenced||!charge(actor))return false;f.silenced=true;f.ring=0;if(finalReady&&f.carrier)f.whisper=8;event('Bell rope cut. Alarms stopped; the reliquary keeps its slower whisper during escape.');return true;}
  if(kind==='chapel-valve'){if(s.floodable===false){notify('This flat chamber has no recessed court to drain.');return false;}if(!charge(actor))return false;f.drained=!f.drained;f.flood=0;noise(actor,8);event(f.drained?'Sluice opened. The court drains; footing is clear.':'Sluice closed. Cold water returns.','sluice','valve');return true;}
  if(kind==='chapel-winch'){if(f.holder!==actor.id&&!charge(actor))return false;f.holder=f.holder===actor.id?null:actor.id;event(f.holder?'Winch held. Stay here while a companion opens the treasury.':'The winch falls back.','door','winch');return true;}
  if(kind==='chapel-treasury'){if(f.treasury)return false;const holder=s.actors.find(a=>a.id===f.holder);if(!holder||holder.id===actor.id||!near(holder,'winch')){notify('A different living adventurer must hold the distant winch.');return false;}if(!charge(actor)||!reward(actor,'treasury'))return false;f.treasury=true;noise(actor,12);event('Treasury opened together. Its offered curse is a separate choice.','chest','treasury');return true;}
  if(kind==='chapel-bargain'){if(!f.treasury||f.bargain){notify('Open the treasury first.');return false;}if(!reward(actor,'bargain'))return false;f.bargain=true;f.carrier=actor.id;f.whisper=finalReady&&!f.silenced?4:8;restoreDM(18);event('Bargain accepted: extra loot; DM gains 18 stamina. The carrier whispers and cannot block until the reliquary is returned.','whisper','treasury');return true;}
  return false;
 }
 function dmAction(kind){const s=context(),f=current();if(s.remote||s.paused||s.phase!=='active')return false;
  if(kind==='chapel-pursuit'){if(!finalReady||finalUsed)return false;if(!finalPursuit())return false;finalUsed=true;event('FINAL PURSUIT: a drowned hunter is entering. Return to the entrance!','bell');return true;}
  if(kind==='chapel-flood'&&s.floodable===false)return false;
  if(!s.plan||!Object.hasOwn(CHAPEL_DM_COSTS,kind)||kind==='chapel-ring'&&f.silenced||['chapel-decoy','chapel-rummage'].includes(kind)&&f.decoy>0||kind==='chapel-flood'&&f.flood>0)return false;
  if(!spendDM(kind,CHAPEL_DM_COSTS[kind]))return false;
  if(['chapel-decoy','chapel-rummage'].includes(kind)){f.decoy=15;f.decoyKind=kind==='chapel-rummage'?'rummage':'steps';event(f.decoyKind==='steps'?'Footsteps echo near the chapel treasury.':'Wood scrapes and belongings rustle near the chapel treasury.',f.decoyKind==='steps'?'decoy':'decoy-rummage','treasury');}
  if(kind==='chapel-ring'){f.heat=Math.min(100,f.heat+30);event('The chapel bell answers the dungeon master.');}
  if(kind==='chapel-flood'){f.flood=20;event('The DM reverses the sluice for 20 seconds. The raised routes remain open.','sluice','valve');}
  return true;
 }
 function tick(dt){const s=context();if(s.remote||s.phase!=='active'||s.paused)return;dt=Math.max(0,Math.min(.1,Number.isFinite(dt)?dt:0));
  for(let floor=0;floor<2;floor++){const record=floors[floor];if(floor!==s.floor)record.holder=null;if(record.carrier&&!live(s.actors.find(a=>a.id===record.carrier)))record.carrier=null;}
  for(const [id,t]of noiseCooldown){if(t<=dt)noiseCooldown.delete(id);else noiseCooldown.set(id,t-dt);}
  if(s.complete&&!finalReady){finalReady=true;for(const curse of floors)if(curse.carrier&&!curse.silenced)curse.whisper=Math.min(curse.whisper,4);event(floors.some(f=>f.carrier&&!f.silenced)?'Escape begins. The intact chapel bell quickens the carried curse: whispers every 4s. Return it or cut its rope. The DM has one paid pursuit.':'All relics taken. Escape begins. The DM has one paid final pursuit through an entrance.');}
  const f=current(),previousDecoy=f.decoy;for(const key of ['ring','flood','decoy'])f[key]=Math.max(0,f[key]-dt);f.heat=Math.max(0,f.heat-dt*.8);
  if(s.plan&&previousDecoy>0){const times=f.decoyKind==='rummage'?[2.4,6,8.4]:[.65,1.3,1.95,6,6.65,7.3,7.95];for(const time of times)if(15-previousDecoy<time&&15-f.decoy>=time)event('',f.decoyKind==='rummage'?'decoy-rummage':'decoy','treasury');}
  if(f.holder&&!near(s.actors.find(a=>a.id===f.holder),'winch'))f.holder=null;
  const carrier=s.actors.find(a=>a.id===f.carrier);if(f.carrier&&!live(carrier))f.carrier=null;
  for(const curse of floors)if(curse.carrier){curse.whisper-=dt;if(curse.whisper<=0){curse.whisper=finalReady&&!curse.silenced?4:8;f.heat=Math.min(100,f.heat+10);event('The carried reliquary whispers. Nearby enemies are listening.','whisper','treasury');}}
  if(s.plan&&!f.silenced&&f.ring<=0&&s.bellkeeper?.()){f.ring=12;f.heat=Math.min(100,f.heat+20);event('A bellkeeper raises the alarm. Kill it or cut the bell rope.');}
 }
 function snapshot(){return {version:1,seed,floors:structuredClone(floors),finalReady,finalUsed,sequence,event:lastEvent?{...lastEvent}:null};}
 function apply(value){const checked=validateChapelSnapshot(value,seed);if(!checked)return false;floors=structuredClone(checked.floors);finalReady=checked.finalReady;finalUsed=checked.finalUsed;if(checked.sequence>sequence&&checked.event){lastEvent={...checked.event};if(lastEvent.floor===context().floor){if(lastEvent.message)notify(lastEvent.message);sound(lastEvent.kind,context().plan?.nodes[lastEvent.node]);}}sequence=checked.sequence;return true;}
 return {reset,action,dmAction,noise,tick,snapshot,apply,near,releaseHold(actor){const f=current();if(f.holder===actor?.id){f.holder=null;notify('You let go of the winch to fight.');}},get record(){return {...current()};},get extracting(){return finalReady;},get finalReady(){return finalReady&&!finalUsed;},whisperInterval:id=>{const home=floors.find(f=>f.carrier===id);return home?(finalReady&&!home.silenced?4:8):0;},burdened:id=>floors.some(f=>f.carrier===id),homeFloor:id=>floors.findIndex(f=>f.carrier===id),movementScale(actor){const s=context(),f=current();return s.plan&&(f.flood>0||!f.drained)&&roomContainsTile(s.plan.room,actor.index%s.size,Math.floor(actor.index/s.size))?.78:1;}};
}
export function validateChapelSnapshot(v,seed){
 if(!v||v.version!==1||v.seed!==seed||!Array.isArray(v.floors)||v.floors.length!==2||!Number.isSafeInteger(v.sequence)||v.sequence<0||typeof v.finalReady!=='boolean'||typeof v.finalUsed!=='boolean'||v.finalUsed&&!v.finalReady)return null;
 for(const f of v.floors){if(!f||f.decoyKind!==undefined&&!['steps','rummage'].includes(f.decoyKind)||['silenced','drained','treasury','bargain'].some(k=>typeof f[k]!=='boolean')||['heat','ring','flood','decoy','whisper'].some(k=>!Number.isFinite(f[k])||f[k]<0||f[k]>100)||['holder','carrier'].some(k=>f[k]!==null&&!/^hero-[123]$/.test(f[k]))||f.bargain&&!f.treasury||f.carrier&&!f.bargain)return null;}
 if(v.event!==null&&(!v.event||v.event.serial!==v.sequence||!['bell','sluice','door','chest','whisper','decoy','decoy-rummage'].includes(v.event.kind)||!['bell','valve','winch','treasury'].includes(v.event.node)||![0,1].includes(v.event.floor)||typeof v.event.message!=='string'||v.event.message.length>280))return null;
 return v;
}
