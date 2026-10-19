// Keys belong to a run, while unlocked seals remain unlocked across rebuilds.
export function createDoorLocks(){
 let run=null,nextPickupId=1;const floors=new Map(),keys=new Map(),customLocks=new Map(),pickups=new Map(),floorSizes=new Map();
 const validFloor=n=>Number.isInteger(n)&&n>=0&&n<64;
 const text=v=>typeof v==='string'&&v.trim().length>0&&v.length<=128&&!/[\u0000-\u001f]/.test(v);
 const cell=(floor,index)=>Number.isSafeInteger(index)&&index>=0&&index<(floorSizes.has(floor)?floorSizes.get(floor)**2:1_000_000);
 function edge(floor,value){
  if(!validFloor(floor)||typeof value!=='string'||!/^\d+:\d+$/.test(value))return null;
  const [a,b]=value.split(':').map(Number),n=floorSizes.get(floor);if(!cell(floor,a)||!cell(floor,b)||a===b)return null;
  if(n&&!(Math.abs(a-b)===n||Math.abs(a-b)===1&&Math.floor(a/n)===Math.floor(b/n)))return null;
  return Math.min(a,b)+':'+Math.max(a,b);
 }
 function keyKind({kind,keyId}={},fallback){
  if(kind==='silver')return 'silver';
  if(kind==='named'){const id=keyId??fallback;return text(id)&&!['silver','named'].includes(id)?id:null;}
  // A pickup may echo an actual named kind from getLocks/getPickups.
  return text(kind)&&kind!=='silver'?kind:null;
 }
 const lockAt=(floor,doorKey)=>{const normal=floors.get(floor);return normal?.doorKey===doorKey?normal:customLocks.get(floor+':'+doorKey);};
 function reset(){run=null;nextPickupId=1;floors.clear();keys.clear();customLocks.clear();pickups.clear();floorSizes.clear();}
 function prepare(seed,floor,architecture,size){
  if(run!==seed){reset();run=seed;}
  floorSizes.set(floor,size);
  if(!floors.has(floor)){
   const door=architecture.doors[1],neighbor=door.index+[ -size,1,size,-1 ][door.d];
   const kind=floor===0?'silver':'archive-signet';
   floors.set(floor,{doorKey:[Math.min(door.index,neighbor),Math.max(door.index,neighbor)].join(':'),kind,name:floor===0?'Silver key':'Archive signet',room:door.name,unlocked:false,collected:false,index:floor===0?architecture.start+1:architecture.stair+1});
  }
  return floors.get(floor);
 }
 function collect(floor,pickupId){
  const pickup=pickupId===undefined||pickupId==='default:'+floor?floors.get(floor):pickups.get(pickupId);
  if(!pickup||pickup.floor!==undefined&&pickup.floor!==floor||pickup.collected)return null;
  pickup.collected=true;keys.set(pickup.kind,(keys.get(pickup.kind)??0)+1);return pickup.name;
 }
 function unlock(floor,key){const lock=lockAt(floor,edge(floor,key)??key);if(!lock||lock.unlocked)return {allowed:true};if(!(keys.get(lock.kind)>0))return {allowed:false,message:`Locked ${lock.room}. Requires ${lock.name.toLowerCase()}.`};keys.set(lock.kind,keys.get(lock.kind)-1);lock.unlocked=true;return {allowed:true,message:`${lock.name} used. ${lock.room} unlocked.`};}
 function hint(floor,key){const lock=lockAt(floor,edge(floor,key)??key);return lock&&!lock.unlocked?'E · Unlock with '+lock.name:'';}
 function getLocks(){return [...floors].map(([floor,l])=>({...l,id:'default-lock:'+floor,floor})).concat([...customLocks.values()].map(l=>({...l})));}
 function getPickups(floor){const normal=floors.get(floor);return (normal?[{id:'default:'+floor,floor,index:normal.index,kind:normal.kind,name:normal.name,collected:normal.collected}]:[]).concat([...pickups.values()].filter(p=>p.floor===floor).map(p=>({...p})));}
 function placeLock(floor,doorKey,options={}){
  if(!options||typeof options!=='object')return null;
  const canonical=edge(floor,doorKey);if(!canonical||lockAt(floor,canonical))return null;
  if(!['silver','named'].includes(options.kind))return null;
  const kind=keyKind(options,'seal:'+floor+':'+canonical),name=options.name??(kind==='silver'?'Silver key':kind);
  if(!kind||!text(name))return null;
  const lock={id:'lock:'+floor+':'+canonical,floor,doorKey:canonical,kind,name,room:options.name??'sealed door',unlocked:false};
  customLocks.set(floor+':'+canonical,lock);return lock;
 }
 function placeKey(floor,index,options={}){
  if(!options||typeof options!=='object')return null;
  const kind=keyKind(options),name=options.name??(kind==='silver'?'Silver key':kind);
  if(!validFloor(floor)||!cell(floor,index)||!kind||!text(name)||nextPickupId>=Number.MAX_SAFE_INTEGER)return null;
  const pickup={id:'key:'+floor+':'+nextPickupId++,floor,index,kind,name,collected:false};pickups.set(pickup.id,pickup);return pickup;
 }
 function eraseLock(floor,doorKey){const canonical=edge(floor,doorKey);return !!canonical&&customLocks.delete(floor+':'+canonical);}
 function eraseKey(floor,id){const pickup=pickups.get(id);return !!pickup&&pickup.floor===floor&&pickups.delete(id);}
 function snapshot(){return {version:1,seed:run,nextPickupId,floorSizes:[...floorSizes],defaults:[...floors].map(([floor,l])=>({floor,...l})),locks:[...customLocks.values()].map(l=>({...l})),pickups:[...pickups.values()].map(p=>({...p})),keys:[...keys].map(k=>[...k])};}
 function applySnapshot(data){
  // Validate a detached model first, so malformed packets never partially apply.
  try{
   if(!data||data.version!==1||!(data.seed===null||typeof data.seed==='string'&&data.seed.length<=256)||!Number.isSafeInteger(data.nextPickupId)||data.nextPickupId<1) return false;
   if(!['floorSizes','defaults','locks','pickups','keys'].every(k=>Array.isArray(data[k])&&data[k].length<=4096))return false;
   const sizes=new Map();
   for(const pair of data.floorSizes){if(!Array.isArray(pair)||pair.length!==2||!validFloor(pair[0])||!Number.isInteger(pair[1])||pair[1]<2||pair[1]>1024||sizes.has(pair[0]))return false;sizes.set(...pair);}
   const stagedFloors=new Map(),stagedLocks=new Map(),stagedPickups=new Map(),stagedKeys=new Map();
   const validCell=(floor,i)=>Number.isSafeInteger(i)&&i>=0&&i<(sizes.has(floor)?sizes.get(floor)**2:1_000_000);
   const validEdge=(floor,k)=>{if(typeof k!=='string'||!/^\d+:\d+$/.test(k))return false;const [a,b]=k.split(':').map(Number),n=sizes.get(floor);return validCell(floor,a)&&validCell(floor,b)&&a<b&&(!n||b-a===n||b-a===1&&Math.floor(a/n)===Math.floor(b/n));};
   const validLock=l=>l&&validFloor(l.floor)&&validEdge(l.floor,l.doorKey)&&text(l.kind)&&l.kind!=='named'&&text(l.name)&&text(l.room)&&typeof l.unlocked==='boolean';
   for(const l of data.defaults){if(!validLock(l)||!validCell(l.floor,l.index)||typeof l.collected!=='boolean'||stagedFloors.has(l.floor))return false;stagedFloors.set(l.floor,{doorKey:l.doorKey,kind:l.kind,name:l.name,room:l.room,unlocked:l.unlocked,collected:l.collected,index:l.index});}
   for(const l of data.locks){const key=l?.floor+':'+l?.doorKey;if(!validLock(l)||l.index!==undefined||l.id!=='lock:'+key||stagedLocks.has(key)||stagedFloors.get(l.floor)?.doorKey===l.doorKey)return false;stagedLocks.set(key,{id:l.id,floor:l.floor,doorKey:l.doorKey,kind:l.kind,name:l.name,room:l.room,unlocked:l.unlocked});}
   let highest=0;
   for(const p of data.pickups){if(!p||!validFloor(p.floor)||!validCell(p.floor,p.index)||!text(p.kind)||p.kind==='named'||!text(p.name)||typeof p.collected!=='boolean'||typeof p.id!=='string'||!new RegExp('^key:'+p.floor+':([1-9][0-9]*)$').test(p.id)||stagedPickups.has(p.id))return false;highest=Math.max(highest,Number(p.id.split(':')[2]));stagedPickups.set(p.id,{id:p.id,floor:p.floor,index:p.index,kind:p.kind,name:p.name,collected:p.collected});}
   if(!Number.isSafeInteger(highest)||data.nextPickupId<=highest)return false;
   for(const pair of data.keys){if(!Array.isArray(pair)||pair.length!==2||!text(pair[0])||pair[0]==='named'||!Number.isSafeInteger(pair[1])||pair[1]<0||pair[1]>4096||stagedKeys.has(pair[0]))return false;stagedKeys.set(...pair);}
   // The detached maps above contain only allowlisted metadata.
   reset();run=data.seed;nextPickupId=data.nextPickupId;for(const [k,v]of sizes)floorSizes.set(k,v);for(const [k,v]of stagedFloors)floors.set(k,v);for(const [k,v]of stagedLocks)customLocks.set(k,v);for(const [k,v]of stagedPickups)pickups.set(k,v);for(const [k,v]of stagedKeys)keys.set(k,v);return true;
  }catch{return false;}
 }
 return {prepare,collect,unlock,hint,getLocks,getPickups,placeLock,placeKey,eraseLock,eraseKey,snapshot,applySnapshot,get keys(){return [...keys].filter(([,n])=>n>0);},reset};
}

// Visual API remains compatible; lock rules above own no render resources.
export {makeKeyPickup} from './world-pickups.js?v=5d7531948dcd036925fc96b539d81165ba86fa3a';
