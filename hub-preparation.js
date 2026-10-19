import {createHubTransactions} from './hub-transactions.js?v=1d78ea79feefea23b13aa344fdb80a6c28d88fec';
import {INVENTORY_CAPACITY,HUB_STASH_CAPACITY} from './adventurer-inventory.js?v=1d78ea79feefea23b13aa344fdb80a6c28d88fec';

export const HUB_PREPARATION_KEY='hollow:hub-preparation:v1';
const clone=value=>JSON.parse(JSON.stringify(value));
const fail=reason=>({ok:false,reason});
const token=value=>typeof value==='string'&&value.length<=64&&/^[a-zA-Z0-9_.:-]+$/.test(value);
const point=p=>p&&['x','y','z'].every(k=>Number.isFinite(p[k])&&Math.abs(p[k])<=1e6);
// randomUUID needs a secure context (missing on plain-HTTP LAN testing and old Safari).
function randomEpochToken(){const c=globalThis.crypto;if(typeof c?.randomUUID==='function')return c.randomUUID();const bytes=new Uint8Array(16);if(typeof c?.getRandomValues==='function')c.getRandomValues(bytes);else for(let i=0;i<16;i++)bytes[i]=Math.floor(Math.random()*256);const hex=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);}
const eligible=a=>a&&a.alive!==false&&!a.fainted&&!a.escaped&&a.health>0;
function decode(raw){
 if(raw===null)return null;
 if(typeof raw!=='string'||raw.length>4096)throw Error('metadata');
 const r=JSON.parse(raw);
 if(!r||Object.keys(r).sort().join(',')!=='epoch,runNumber,status,version'||r.version!==1||!token(r.epoch)||!Number.isSafeInteger(r.runNumber)||r.runNumber<0||!['preparing','sealed','departed'].includes(r.status))throw Error('metadata');
 return r;
}

/** Durable host/local preparation boundary; no scene, DOM, network or campaign
 * lifecycle ownership. Inject the EXISTING campaign and inventory authorities,
 * the SAME durable profile storage, synchronous withActor, and trusted geometry.
 * ownerId must come from an authenticated host bridge, never request payload.
 * Only move() accepts input axes; client positions/stations never enter context.
 * offersForEpoch must deterministically reconstruct host stock from the epoch.
 * Root must call beforeStart BEFORE resetting inventory/campaign, then
 * completeStart AFTER beginRun, spawn/stat setup and campaign persistence.
 */
export function createHubPreparation({campaign,inventory,storage,withActor,getRole=()=> 'local',getPaused=()=>false,stations,spawns,blocked,offersForEpoch,sellPrice,createEpoch=()=> 'prep:'+randomEpochToken(),persistCampaign=()=>campaign.persist(),getActor=id=>campaign.actors.find(a=>a.id===id),prepareActors=()=>({ok:true}),validatePrepared=()=>({ok:true})}={}){
 if(!campaign?.state||!Array.isArray(campaign.actors)||!inventory?.hubRecord||typeof withActor!=='function'||!storage?.getItem||!storage?.setItem||typeof getRole!=='function'||typeof getPaused!=='function'||typeof blocked!=='function'||typeof offersForEpoch!=='function'||typeof sellPrice!=='function'||typeof createEpoch!=='function'||typeof persistCampaign!=='function'||typeof getActor!=='function'||typeof prepareActors!=='function'||typeof validatePrepared!=='function')throw TypeError('Invalid preparation dependencies');
 const stationPoints=clone(stations??{}),poses=new Map(),panels=new Map();
 if(Object.keys(stationPoints).sort().join(',')!=='shop,stash'||!Object.values(stationPoints).every(point)||campaign.actors.length!==3||new Set(campaign.actors.map(a=>a.id)).size!==3)throw TypeError('Invalid hub geometry');
 for(const a of campaign.actors){const p=spawns?.[a.id];if(!point(p)||blocked(p.x,p.z,.23))throw TypeError('Invalid hub spawn');poses.set(a.id,{position:{...p},yaw:0,pitch:0});}
 const initial=[...poses.values()];if(initial.some((p,i)=>initial.some((q,j)=>j<i&&Math.hypot(p.position.x-q.position.x,p.position.z-q.position.z)<.46)))throw TypeError('Overlapping hub spawns');
 let raw=null,record=null,loadError=false,ready=false,closed=false,locked=false,transactions=null,recoveryEpoch=null;
 try{raw=storage.getItem(HUB_PREPARATION_KEY)??null;record=decode(raw);}catch{loadError=true;}
 // Save health is checked on each entry (after one retry), not frozen at construction.
 function storageHealthy(){if(campaign.persistenceError)saveCampaign();if(inventory.persistenceError)inventory.persist?.();return !inventory.persistenceError&&!campaign.persistenceError;}
 // Run numbers never decrease: a record ahead of the campaign, or a departure the
 // campaign does not reflect, means the campaign save was reset or lost.
 function regressed(){return !!record&&(record.runNumber>campaign.runNumber||record.runNumber===campaign.runNumber&&record.status==='departed');}
 const authority=()=>['local','host'].includes(getRole());
 function current(){try{return (storage.getItem(HUB_PREPARATION_KEY)??null)===raw;}catch{return false;}}
 function write(next){if(!current())return fail('preparation-stale');try{const bytes=JSON.stringify(next);storage.setItem(HUB_PREPARATION_KEY,bytes);raw=bytes;record=next;return {ok:true};}catch{return fail('preparation-storage');}}
 function saveCampaign(){try{return persistCampaign()===true;}catch{return false;}}
 function context(id){return {role:getRole(),phase:recoveryEpoch!==null?campaign.state.phase:closed||!ready||getPaused()?'blocked':campaign.state.phase,epoch:recoveryEpoch??record?.epoch,position:poses.get(id)?.position,stations:stationPoints};}
 function build(epoch){return createHubTransactions({inventory,getActor,withActor,getContext:context,offers:offersForEpoch(epoch),sellPrice,persistCampaign:saveCampaign});}
 function boundary(fn){if(locked)return fail('busy');locked=true;try{return fn();}catch{return fail('context');}finally{locked=false;}}
 function base(){if(closed)return fail('closed');if(!authority())return fail('authority');if(loadError)return fail('preparation-invalid');if(!current())return fail('preparation-stale');if(inventory.hubDurable!==true)return fail('inventory-undurable');return {ok:true};}
 // Recover using each pending wallet's own epoch BEFORE rotating metadata. The
 // transaction core persists campaign gold before acknowledging that wallet.
 // Dead/escaped or orphaned pending wallets fail closed; never discard a ledger.
 function recoverAll(epoch){
  if(!inventory.hubStorageCurrent())return fail('inventory-stale');
  const records=inventory.snapshot().actors;
  if(records.some(r=>r.preparationLoss?.pendingMirror&&!poses.has(r.id)))return fail('orphan-wallet');
  if(records.some(r=>r.hub?.pendingMirror&&!poses.has(r.id)))return fail('orphan-wallet');
  for(const actor of campaign.actors){
   const r=withActor(actor.id,()=>inventory.hubRecord());
   if(!r||r.id!==actor.id)return fail('actor-context');
   if(!r.hub||!r.hub.pendingMirror&&r.hub.epoch!==epoch)continue;
   recoveryEpoch=r.hub.epoch;
   let result;try{result=build(recoveryEpoch).recover({actorId:actor.id,ownerId:actor.id});}finally{recoveryEpoch=null;}
   if(!result.ok)return result;if(result.mirrorPending)return fail('mirror-pending');
  }
  if(!saveCampaign())return fail('campaign-storage');return {ok:true};
 }
 function enterPreparation(){return boundary(()=>{
  const gate=base();if(!gate.ok)return gate;ready=false;panels.clear();
  if(campaign.state.phase!=='lobby')return fail('phase');
  if(!storageHealthy())return fail('preparation-invalid');
  // With no pending wallet or loss ledger nothing is lost by opening a fresh epoch.
  const stale=regressed();if(stale&&inventory.snapshot().actors.some(r=>r.hub?.pendingMirror||r.preparationLoss?.pendingMirror))return fail('run-conflict');
  if(!stale&&record?.runNumber===campaign.runNumber&&record.status==='sealed')return fail('start-sealed');
  const recovered=recoverAll(!stale&&record?.runNumber===campaign.runNumber?record.epoch:null);if(!recovered.ok)return recovered;
  let next=stale?null:record;
  if(!next||next.runNumber!==campaign.runNumber){const epoch=createEpoch();if(!token(epoch)||epoch===record?.epoch||inventory.snapshot().actors.some(r=>r.hub?.epoch===epoch))return fail('epoch');next={version:1,epoch,runNumber:campaign.runNumber,status:'preparing'};}
  // Build/validate deterministic stock before persisting a new epoch.
  const tx=build(next.epoch),saved=write(next);if(!saved.ok)return saved;
  // Wallet recovery and death loss set actor gold directly: let cached vitals re-read it.
  const prepared=prepareActors({epoch:record.epoch});if(!prepared?.ok)return prepared??fail('preparation-actors');transactions=tx;ready=true;inventory.refresh?.();return {ok:true,epoch:record.epoch};
 });}
 function actorGate(actorId,ownerId){const gate=base();if(!gate.ok)return gate;if(!ready||record?.status!=='preparing'||record.runNumber!==campaign.runNumber)return fail('not-ready');if(campaign.state.phase!=='lobby')return fail('phase');if(getPaused())return fail('paused');if(ownerId!==actorId||!poses.has(actorId))return fail('ownership');if(!eligible(getActor(actorId)))return fail('actor');return {ok:true};}
 const distance=(id,station)=>{const p=poses.get(id)?.position,s=stationPoints[station];return p&&s?Math.hypot(p.x-s.x,p.y-s.y,p.z-s.z):Infinity;};
 function interact({actorId,ownerId}={}){return boundary(()=>{const gate=actorGate(actorId,ownerId);if(!gate.ok)return gate;if(panels.has(actorId)){panels.delete(actorId);return {ok:true,station:null};}const station=Object.keys(stationPoints).filter(s=>distance(actorId,s)<=2.2).sort((a,b)=>distance(actorId,a)-distance(actorId,b))[0];if(!station)return fail('proximity');panels.set(actorId,station);return {ok:true,station};});}
 function execute(request,identity={}){return boundary(()=>{const {actorId,ownerId}=identity,gate=actorGate(actorId,ownerId);if(!gate.ok)return gate;const station=panels.get(actorId);if(!station||distance(actorId,station)>2.2){panels.delete(actorId);return fail('proximity');}if(station!==(['deposit','withdraw'].includes(request?.kind)?'stash':'shop'))return fail('station');return transactions.execute(request,{actorId,ownerId});});}
 function move({actorId,ownerId,forward=0,side=0,dt=0,yaw,pitch}={}){return boundary(()=>{
  const gate=actorGate(actorId,ownerId);if(!gate.ok)return gate;if(panels.has(actorId))return fail('panel');
  if(![forward,side,dt].every(Number.isFinite)||yaw!==undefined&&!Number.isFinite(yaw)||pitch!==undefined&&!Number.isFinite(pitch))return fail('input');
  const p=poses.get(actorId),angle=yaw===undefined?p.yaw:Math.atan2(Math.sin(yaw),Math.cos(yaw)),look=pitch===undefined?p.pitch:Math.max(-1.2,Math.min(1.2,pitch)),length=Math.max(1,Math.hypot(forward,side)),step=3.2*Math.max(0,Math.min(.05,dt));
  const dx=(-Math.sin(angle)*forward+Math.cos(angle)*side)/length*step,dz=(-Math.cos(angle)*forward-Math.sin(angle)*side)/length*step;
  let x=p.position.x,z=p.position.z;
  const collides=(nx,nz)=>blocked(nx,nz,.23)||[...poses].some(([id,q])=>id!==actorId&&Math.hypot(nx-q.position.x,nz-q.position.z)<.46);
  if(!collides(x+dx,z))x+=dx;if(!collides(x,z+dz))z+=dz;
  p.position.x=x;p.position.z=z;p.yaw=angle;p.pitch=look;return {ok:true,pose:clone(p)};
 });}
 function beforeStart(){return boundary(()=>{
  const gate=base();if(!gate.ok)return gate;if(!ready||record?.status!=='preparing'||record.runNumber!==campaign.runNumber)return fail('not-ready');if(campaign.state.phase!=='lobby')return fail('phase');if(getPaused())return fail('paused');
  const result=recoverAll(record.epoch);if(!result.ok)return result;const prepared=validatePrepared({epoch:record.epoch});if(!prepared?.ok)return prepared??fail('preparation-actors');
  const saved=write({...record,status:'sealed'});if(!saved.ok)return saved;ready=false;panels.clear();return {ok:true,epoch:record.epoch,runNumber:record.runNumber};
 });}
 function abortStart(){return boundary(()=>{
  const gate=base();if(!gate.ok)return gate;if(record?.status!=='sealed'||record.runNumber!==campaign.runNumber||campaign.state.phase!=='lobby')return fail('start-conflict');
  const result=recoverAll(record.epoch);if(!result.ok)return result;const prepared=prepareActors({epoch:record.epoch});if(!prepared?.ok)return prepared??fail('preparation-actors');const tx=build(record.epoch),saved=write({...record,status:'preparing'});if(!saved.ok)return saved;transactions=tx;ready=true;inventory.refresh?.();return {ok:true};
 });}
 function completeStart(){return boundary(()=>{
  const gate=base();if(!gate.ok)return gate;if(record?.status!=='sealed'||campaign.state.phase==='lobby'||campaign.runNumber!==record.runNumber+1)return fail('start-conflict');
  if(inventory.snapshot().actors.some(r=>r.hub?.pendingMirror||r.preparationLoss?.pendingMirror))return fail('mirror-pending');if(!saveCampaign())return fail('campaign-storage');const result=write({...record,status:'departed'});if(result.ok){ready=false;panels.clear();}return result;
 });}
 function view({actorId,ownerId}={}){return boundary(()=>{const gate=actorGate(actorId,ownerId);if(!gate.ok)return gate;return withActor(actorId,()=>{
  if(inventory.actor?.id!==actorId)return fail('actor-context');const r=inventory.hubRecord(),wallet=r.hub?.epoch===record.epoch?r.hub:null;
  return {ok:true,actorId,epoch:record.epoch,nextSequence:(wallet?.sequence??0)+1,mirrorPending:!!wallet?.pendingMirror,gold:campaign.actors.find(a=>a.id===actorId).gold,items:inventory.items,stored:inventory.stored,equipped:inventory.equipped,stats:inventory.stats(),station:panels.get(actorId)??null,offers:transactions.catalog(),packCapacity:INVENTORY_CAPACITY,stashCapacity:HUB_STASH_CAPACITY};
 });});}
 return {enterPreparation,beforeStart,abortStart,completeStart,move,interact,execute,view,
  closePanel(id){panels.delete(id);},clearPanels(){panels.clear();},close(){closed=true;ready=false;panels.clear();},
  getPose(id){return poses.has(id)?clone(poses.get(id)):null;},getStation(id){return panels.get(id)??null;},
  catalog(){return transactions?.catalog()??[];},snapshot(){return record?clone(record):null;},get ready(){return ready&&!closed&&current()&&authority()&&campaign.state.phase==='lobby'&&record?.status==='preparing'&&record.runNumber===campaign.runNumber;}};
}
