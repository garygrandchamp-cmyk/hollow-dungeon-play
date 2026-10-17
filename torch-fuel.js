export const TORCH_FUEL_SECONDS=120;
export const TORCH_FUEL_STORAGE_KEY='hollow:torch-fuel:v1';
const bounded=value=>typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(TORCH_FUEL_SECONDS,value)):0;
const idOf=actor=>typeof actor?.id==='string'&&/^[a-zA-Z0-9_.:-]{1,128}$/.test(actor.id)&&!['__proto__','constructor','prototype'].includes(actor.id)?actor.id:null;
const living=actor=>!!actor&&actor.alive!==false&&!actor.escaped&&!actor.fainted&&(actor.health===undefined||Number.isFinite(actor.health)&&actor.health>0);
function localStorageOrNull(){try{return globalThis.localStorage??null;}catch{return null;}}

/** Actor fields are authoritative at runtime; browser storage prevents a new
 * actor object/page reload from silently allocating another120seconds.
 * Persist whole seconds rounded DOWN, so refresh never grants fractional fuel.
 */
export function createTorchFuel({storage=localStorageOrNull(),storageKey=TORCH_FUEL_STORAGE_KEY}={}){
 const saved=new Map(),seen=new WeakSet();let signature='';
 try{const raw=storage?.getItem(storageKey);if(raw&&raw.length<=32768){const value=JSON.parse(raw);if(value?.version===1&&Array.isArray(value.actors))for(const entry of value.actors.slice(0,64)){const [id,state]=Array.isArray(entry)?entry:[];if(idOf({id})&&state&&typeof state==='object')saved.set(id,{torchFuel:bounded(state.torchFuel),torchLit:state.torchLit===true&&bounded(state.torchFuel)>0});}}}catch{}
 function persist(actor){
  const id=idOf(actor);if(!id)return;saved.set(id,{torchFuel:actor.torchFuel,torchLit:actor.torchLit});while(saved.size>64)saved.delete(saved.keys().next().value);
  const text=JSON.stringify({version:1,actors:[...saved].map(([key,state])=>[key,{torchFuel:Math.floor(state.torchFuel),torchLit:state.torchLit}])});if(text===signature)return;signature=text;try{storage?.setItem(storageKey,text);}catch{}
 }
 function ensure(actor,{remote=false}={}){
  if(!actor||typeof actor!=='object')throw TypeError('Torch requires an actor.');
  const prior=!remote&&!seen.has(actor)?saved.get(idOf(actor)):null;
  const supplied=actor.torchFuel===undefined?TORCH_FUEL_SECONDS:bounded(actor.torchFuel);
  actor.torchFuel=prior?Math.min(prior.torchFuel,supplied):supplied;
  actor.torchLit=actor.torchFuel>0&&(prior?prior.torchLit&&actor.torchLit!==false:actor.torchLit===undefined?true:actor.torchLit===true);
  if(!remote){seen.add(actor);persist(actor);}return {torchFuel:actor.torchFuel,torchLit:actor.torchLit};
 }
 return{
  ensure,
  tick(actor,dt,{active=true,paused=false,remote=false,equipped=actor?.offhand??actor?.leftHand??actor?.equipment?.offhand?.id}={}){
   const before=ensure(actor,{remote}),seconds=Number.isFinite(dt)?Math.max(0,Math.min(TORCH_FUEL_SECONDS,dt)):0;
   if(!remote&&active&&!paused&&living(actor)&&equipped==='torch'&&actor.torchLit&&seconds>0){actor.torchFuel=Math.max(0,actor.torchFuel-seconds);if(actor.torchFuel===0)actor.torchLit=false;persist(actor);}
   return {torchFuel:actor.torchFuel,torchLit:actor.torchLit,burned:before.torchFuel-actor.torchFuel,expired:before.torchFuel>0&&actor.torchFuel===0};
  },
  toggle(actor,{active=true,remote=false}={}){ensure(actor,{remote});if(remote||!active||!living(actor))return false;actor.torchLit=actor.torchFuel>0&&!actor.torchLit;persist(actor);return actor.torchLit;},
  refill(actor,{remote=false}={}){if(remote)return false;actor.torchFuel=TORCH_FUEL_SECONDS;actor.torchLit=true;seen.add(actor);persist(actor);return true;}
 };
}
