// Pure entrance planning and host-owned reinforcement queue. Static-host safe:
// no THREE, DOM, clocks, storage, network, asset imports, or implicit spawning.
import {roomContainsTile} from './room-footprint.js?v=7ab9ee66430396ccf651b982597738c01913a015';
export const ENEMY_INGRESS_KINDS=Object.freeze(['hatch','grate','ceiling']);
export const ENEMY_INGRESS_MONSTERS=Object.freeze(['skeleton','goblin','wraith','spider','slime','rat','bat','crawler','skeletal-mage','drowned','boss']);
export const ENEMY_INGRESS_WARNING_SECONDS=Object.freeze({hatch:1.8,grate:1.8,ceiling:2});
export const ENEMY_INGRESS_LIMITS=Object.freeze({entrances:64,pending:16,recentRequests:256,generated:6,blockedSeconds:6});
const DIRS=[[0,-1],[1,0],[0,1],[-1,0]];
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const finite=(x,limit=1e6)=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=limit;
const text=(x,max=128)=>typeof x==='string'&&x.length>0&&x.length<=max;
const identifier=x=>text(x)&&/^[a-zA-Z0-9_.:-]+$/.test(x);
const floorOK=x=>x===0||x===1;
const sizeOK=x=>Number.isInteger(x)&&x>=2&&x<=128;
const cell=(i,n)=>Number.isInteger(i)&&i>=0&&i<n*n;
const hash=value=>{let h=2166136261;for(const c of String(value))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
function neighbor(i,d,n){const [dx,dz]=DIRS[d],x=i%n+dx,z=Math.floor(i/n)+dz;return x>=0&&z>=0&&x<n&&z<n?z*n+x:-1;}
function point(p){return p&&finite(p.x)&&finite(p.y??0)&&finite(p.z)?{x:p.x,y:p.y??0,z:p.z}:null;}
function copyEntrance(e){return {id:e.id,floor:e.floor,index:e.index,kind:e.kind,...(e.kind==='grate'?{d:e.d}:{}),...(e.position?{position:point(e.position)}:{})};}
function shapeEntrance(e,{floor,size}={}){
 if(!object(e)||!identifier(e.id)||!floorOK(e.floor)||floor!==undefined&&e.floor!==floor||!Number.isInteger(e.index)||e.index<0||e.index>=16384||size!==undefined&&(!sizeOK(size)||!cell(e.index,size))||!ENEMY_INGRESS_KINDS.includes(e.kind))return null;
 if(e.kind==='grate'?(!Number.isInteger(e.d)||e.d<0||e.d>3):e.d!==undefined)return null;
 if(e.position!==undefined&&!point(e.position))return null;
 return copyEntrance(e);
}
function addCells(out,values,n,floor){
 if(!values||typeof values[Symbol.iterator]!=='function')return;
 for(const value of values){if(object(value)&&value.floor!==undefined&&value.floor!==floor)continue;const i=Number.isInteger(value)?value:value?.index;if(cell(i,n))out.add(i);}
}
function topology(options){
 const {size:n,architecture:a,grid,tiles,floor}=options??{};
 if(!sizeOK(n)||!floorOK(floor)||!a||!cell(a.start,n)||!cell(a.stair,n)||(!Array.isArray(grid)&&!ArrayBuffer.isView(grid))||grid.length!==n*n||!Array.isArray(tiles))return null;
 if(a.voidCells!==undefined&&!Array.isArray(a.voidCells)&&!(a.voidCells instanceof Set)||a.doors!==undefined&&!Array.isArray(a.doors))return null;
 const sockets=new Map(),voids=new Set(a.voidCells??[]);
 for(let i=0;i<grid.length;i++){
  const s=tiles[grid[i]]?.s;if(!Array.isArray(s)||s.length!==4||s.some(v=>v!==0&&v!==1&&v!==2))return null;
  if(s.includes(1)&&!s.includes(2)&&!(a.voidSet?.has?.(i))&&!voids.has(i))sockets.set(i,s);
 }
 if(!sockets.has(a.start))return null;
 const adjacency=new Map(),queue=[a.start],seen=new Set(queue);
 for(let head=0;head<queue.length;head++){
  const i=queue[head],s=sockets.get(i),edges=[];
  for(let d=0;d<4;d++){const j=neighbor(i,d,n);if(s[d]===1&&j>=0&&sockets.get(j)?.[(d+2)%4]===1){edges.push(j);if(!seen.has(j)){seen.add(j);queue.push(j);}}}
  adjacency.set(i,edges);
 }
 if(!seen.has(a.stair))return null;
 const reserved=new Set([a.start,a.stair]);
 for(const list of [a.objectiveIndices,a.objectives,a.items,a.relics,a.keys,a.keyLocations,a.reservedIndices,options.reservedIndices,a.routeComplexity?.requiredPath])addCells(reserved,list,n,floor);
 // Preserve legacy relic/key/chest/shrine locations as well as modern ones.
 for(const i of [a.start+1,a.start-n-1,a.start-n+1,a.stair-1,a.stair+1,a.stair-n,a.stair+n])if(cell(i,n))reserved.add(i);
 for(const door of a.doors??[]){if(!cell(door?.index,n)||!Number.isInteger(door.d)||door.d<0||door.d>3)return null;reserved.add(door.index);const j=neighbor(door.index,door.d,n);if(j>=0)reserved.add(j);}
 // Iterative Tarjan traversal: never place an arrival on a bottleneck that
 // could become the sole obstruction to any connected required route.
 const discovered=new Map([[a.start,1]]),low=new Map([[a.start,1]]),parents=new Map([[a.start,null]]),children=new Map(),cuts=new Set(),stack=[{i:a.start,next:0}];let serial=1;
 while(stack.length){
  const frame=stack.at(-1),edges=adjacency.get(frame.i);
  if(frame.next<edges.length){const j=edges[frame.next++];if(!discovered.has(j)){parents.set(j,frame.i);children.set(frame.i,(children.get(frame.i)??0)+1);discovered.set(j,++serial);low.set(j,serial);stack.push({i:j,next:0});}else if(j!==parents.get(frame.i))low.set(frame.i,Math.min(low.get(frame.i),discovered.get(j)));}
  else{stack.pop();const parent=parents.get(frame.i);if(parent===null){if((children.get(frame.i)??0)>1)cuts.add(frame.i);}else{low.set(parent,Math.min(low.get(parent),low.get(frame.i)));if(parents.get(parent)!==null&&low.get(frame.i)>=discovered.get(parent))cuts.add(parent);}}
 }
 return {size:n,sockets,adjacency,seen,reserved,cuts};
}
function eligible(t,index,architecture){return t.seen.has(index)&&!t.reserved.has(index)&&!t.cuts.has(index)&&Math.abs(index%t.size-architecture.start%t.size)+Math.abs(Math.floor(index/t.size)-Math.floor(architecture.start/t.size))>2;}
function positionsLookup(positions){
 if(positions===undefined)return null;if(typeof positions==='function')return positions;
 if(positions instanceof Map)return i=>positions.get(i);
 if(Array.isArray(positions)){if(positions.length&&Array.from(positions).every(p=>object(p)&&Number.isInteger(p.index))){const map=new Map(positions.map(p=>[p.index,p]));return i=>map.get(i);}return i=>positions[i];}
 return ()=>null;
}
/** positions is optional: function(index), Map, dense point array, or records
 * with index. Supplied samples need finite x/z (y defaults to 0). Missing,
 * blocked/occupied, valid:false or walkable:false samples are excluded. A
 * ceiling:false sample disallows a ceiling hole on that cell.
 */
export function planEnemyEntrances(options={}){
 const t=topology(options);if(!t)return [];
 const {architecture,seed='',floor,positions}=options,lookup=positionsLookup(positions),candidates=[];
 for(const index of t.seen){
  if(!eligible(t,index,architecture))continue;
  let sample=null;if(lookup){try{sample=lookup(index);}catch{continue;}if(!sample||sample.blocked||sample.occupied||sample.valid===false||sample.walkable===false||!point(sample))continue;}
  candidates.push({index,sample,rank:hash(seed+'|ingress-v1|'+floor+'|'+index)});
 }
 candidates.sort((a,b)=>a.rank-b.rank||a.index-b.index);
 const selected=[],selectedIndices=new Set();
 const separated=c=>selected.every(e=>Math.abs(e.index%t.size-c.index%t.size)+Math.abs(Math.floor(e.index/t.size)-Math.floor(c.index/t.size))>=3);
 function select(pool,roomPass=false){
  if(selected.length>=ENEMY_INGRESS_LIMITS.generated)return;
  pool=pool.filter(c=>!selectedIndices.has(c.index));const spaced=pool.filter(separated);if(spaced.length)pool=spaced;else if(!roomPass)return;
  if(!pool.length)return;
  const preferred=['hatch','grate','ceiling'][selected.length%3];
  const c=pool.find(c=>preferred==='grate'?t.sockets.get(c.index).includes(0):preferred==='ceiling'?c.sample?.ceiling!==false:true)??pool[0];
  const walls=t.sockets.get(c.index).map((s,d)=>s===0?d:-1).filter(d=>d>=0);
  let kind=preferred==='grate'&&!walls.length?'hatch':preferred;if(kind==='ceiling'&&c.sample?.ceiling===false)kind='hatch';
  const d=walls[hash(seed+'|wall|'+floor+'|'+c.index)%Math.max(1,walls.length)];
  selected.push({id:`ingress:${floor}:${c.index}:${kind}${kind==='grate'?':'+d:''}`,floor,index:c.index,kind,...(kind==='grate'?{d}:{}),...(c.sample?{position:point(c.sample)}:{})});
  selectedIndices.add(c.index);
 }
 // Room coverage takes priority over optional spacing. Required-route/start
 // exclusions still win; small entry rooms may correctly have no legal exit.
 for(const room of architecture.rooms??[])select(candidates.filter(c=>roomContainsTile(room,c.index%t.size,Math.floor(c.index/t.size))),true);
 for(const c of candidates)select([c]);
 return selected;
}
/** Schema validation always runs. Supplying grid/architecture also validates
 * authored entrances against the same reachable, reserved and bottleneck rules.
 */
export function validateEnemyEntrance(value,context={}){
 const entrance=shapeEntrance(value,context);if(!entrance)return false;
 if(context.grid!==undefined||context.architecture!==undefined){const t=topology({...context,floor:entrance.floor});if(!t||!eligible(t,entrance.index,context.architecture)||entrance.kind==='grate'&&t.sockets.get(entrance.index)[entrance.d]!==0)return false;}
 return true;
}
function sameEntrance(a,b){return a.id===b.id&&a.floor===b.floor&&a.index===b.index&&a.kind===b.kind&&a.d===b.d&&(!a.position&&!b.position||a.position&&b.position&&['x','y','z'].every(k=>a.position[k]===(b.position[k]??(k==='y'?0:undefined))));}
function identity(s){return {seed:String(s?.seed??''),runId:String(s?.runId??s?.runNumber??0),floor:s?.floor};}
const identityKey=s=>JSON.stringify(identity(s));
function plainRecord(r){return {id:r.id,entranceId:r.entranceId,floor:r.entrance.floor,type:r.monsterType,monsterType:r.monsterType,entrance:copyEntrance(r.entrance),phase:r.phase,remaining:r.remaining,duration:r.warningSeconds,warningSeconds:r.warningSeconds,progress:Math.max(0,Math.min(1,1-r.remaining/r.warningSeconds)),blockedFor:r.blockedFor??0};}

/** Pure, atomic parser. It returns {valid,snapshot?,reason?}; it never mutates
 * input or runs callbacks. Context may bind seed/runId/floor/size and entrances.
 */
export function validateEnemyIngressSnapshot(value,context={}){
 const fail=()=>({valid:false,reason:'invalid'});
 if(!object(value)||value.version!==1||typeof value.seed!=='string'||value.seed.length>256||typeof value.runId!=='string'||value.runId.length>128||!floorOK(value.floor)||!Number.isSafeInteger(value.sequence)||value.sequence<0||!Number.isSafeInteger(value.serial)||value.serial<0||!Array.isArray(value.pending)||value.pending.length>ENEMY_INGRESS_LIMITS.pending||!Array.isArray(value.recentRequestIds)||value.recentRequestIds.length>ENEMY_INGRESS_LIMITS.recentRequests||value.recentRequestIds.some(id=>!identifier(id))||new Set(value.recentRequestIds).size!==value.recentRequestIds.length)return fail();
 for(const key of ['seed','runId','floor'])if(context[key]!==undefined&&value[key]!==context[key])return {valid:false,reason:'different-run'};
 if(context.runId===undefined&&context.runNumber!==undefined&&value.runId!==String(context.runNumber))return {valid:false,reason:'different-run'};
 const ids=new Set(),entrances=new Set(),recent=new Set(value.recentRequestIds),pending=[];
 for(const r of value.pending){
  if(!object(r)||!identifier(r.id)||ids.has(r.id)||!recent.has(r.id)||!identifier(r.entranceId)||entrances.has(r.entranceId)||!ENEMY_INGRESS_MONSTERS.includes(r.monsterType)||!['warning','blocked'].includes(r.phase)||!finite(r.remaining,2)||r.remaining<0)return fail();
  const entrance=shapeEntrance(r.entrance,{floor:value.floor,size:context.size});if(!entrance||r.entranceId!==entrance.id||r.floor!==entrance.floor||r.type!==r.monsterType||r.warningSeconds!==ENEMY_INGRESS_WARNING_SECONDS[entrance.kind]||r.duration!==r.warningSeconds||r.remaining>r.warningSeconds||!finite(r.progress,1)||Math.abs(r.progress-(1-r.remaining/r.warningSeconds))>1e-7||!finite(r.blockedFor,ENEMY_INGRESS_LIMITS.blockedSeconds)||r.blockedFor<0||r.phase==='warning'&&r.blockedFor!==0||r.phase==='blocked'&&r.remaining!==0)return fail();
  if(context.entrances!==undefined){if(!Array.isArray(context.entrances)||context.entrances.length>ENEMY_INGRESS_LIMITS.entrances)return fail();const known=context.entrances.find(e=>e.id===entrance.id);if(!known||!shapeEntrance(known,{floor:value.floor,size:context.size})||!sameEntrance(entrance,known))return fail();}
  ids.add(r.id);entrances.add(r.entranceId);pending.push(plainRecord({...r,entrance}));
 }
 return {valid:true,snapshot:{version:1,seed:value.seed,runId:value.runId,floor:value.floor,sequence:value.sequence,serial:value.serial,pending,recentRequestIds:[...value.recentRequestIds]}};
}

/** state() => {seed,runId|runNumber,floor,size,phase:'active',remote,
 * entrances,canSpawn(entrance,monsterType),actors?,occupiedIndices?,blockedIndices?,
 * paused?,busy?,watching?,editing?,isGenerating?,viewingOther?}.
 * canAfford(order),spend(order),spawn(order) are SYNCHRONOUS booleans. spend
 * must return true iff it charged; spawn true iff it committed one enemy.
 * order exposes id,kind:'monster:'+monsterType,monsterType,index,floor,entrance.
 * Accepted orders pay once. Blocked exits wait up to six active seconds, without
 * recharging, then cancel with feedback. Canceling
 * an accepted order (including run/floor/end changes) does not refund its cost.
 */
export function createEnemyIngress({state,spawn,canAfford,spend,notify=()=>{},sound=()=>{}}={}){
 if(typeof state!=='function'||typeof spawn!=='function'||typeof canAfford!=='function'||typeof spend!=='function')throw TypeError('Ingress requires state, spawn, canAfford and spend callbacks.');
 const pending=new Map(),recent=new Set();let bound=null,serial=0,sequence=0,lastApplied=-1,inCallback=false,ticking=false;
 const safe=(fn,...args)=>{try{fn(...args);}catch{}};
 const readState=()=>{try{const value=state();return object(value)?value:{};}catch{return {};}};
 function bind(s){const key=identityKey(s);if(bound!==key){pending.clear();recent.clear();serial=0;lastApplied=-1;bound=key;sequence++;}return s;}
 function ended(s){return s.phase!=='active'||Array.isArray(s.actors)&&!s.actors.some(a=>a&&a.alive!==false&&!a.fainted&&!a.escaped&&(a.health===undefined||a.health>0));}
 const paused=s=>s.paused||s.busy||s.watching||s.editing||s.isGenerating||s.viewingOther;
 function roster(s){if(!Array.isArray(s.entrances)||s.entrances.length>ENEMY_INGRESS_LIMITS.entrances)return null;const ids=new Set(),list=[];for(const e of s.entrances){const copy=shapeEntrance(e,{floor:s.floor,size:s.size});if(!copy||ids.has(copy.id))return null;ids.add(copy.id);list.push(copy);}return list;}
 function open(s,entrance,type){
  if(typeof s.canSpawn!=='function'||s.occupiedIndices?.includes?.(entrance.index)||s.blockedIndices?.includes?.(entrance.index))return false;
  if(Array.isArray(s.actors)&&s.actors.some(a=>a&&a.alive!==false&&!a.fainted&&!a.escaped&&(a.health===undefined||a.health>0)&&(a.floor===undefined||a.floor===s.floor)&&a.index===entrance.index&&(!finite(a.position?.y)||!finite(entrance.position?.y)||Math.abs(a.position.y-entrance.position.y)<1.8)))return false;
  try{return s.canSpawn(copyEntrance(entrance),type)===true;}catch{return false;}
 }
 const order=r=>({id:r.id,kind:'monster:'+r.monsterType,type:r.monsterType,monsterType:r.monsterType,index:r.entrance.index,floor:r.entrance.floor,entrance:copyEntrance(r.entrance)});
 const reject=(reason,message)=>({accepted:false,reason,message});
 function request(value){
  if(inCallback||ticking)return reject('busy','A reinforcement request is already being processed.');
  const s=bind(readState());if(s.remote)return reject('remote','Only the host can deploy reinforcements.');
  if(!floorOK(s.floor)||ended(s))return reject('phase','Use free map placement during setup; entrances deploy only during an active expedition.');
  if(paused(s))return reject('paused','Close menus and resume the expedition first.');
  if(!object(value)||!identifier(value.entranceId)||!ENEMY_INGRESS_MONSTERS.includes(value.type??value.monsterType)||value.type!==undefined&&value.monsterType!==undefined&&value.type!==value.monsterType||value.requestId!==undefined&&!identifier(value.requestId))return reject('invalid','Choose a valid entrance and monster.');
  const monsterType=value.type??value.monsterType;
  if(value.requestId!==undefined&&recent.has(value.requestId))return reject('duplicate','That reinforcement request was already accepted.');
  const entrances=roster(s),entrance=entrances?.find(e=>e.id===value.entranceId);if(!entrance)return reject('entrance','Select an entrance on the current floor.');
  if(pending.has(entrance.id))return reject('pending','That entrance already has a pending arrival.');
  if(pending.size>=ENEMY_INGRESS_LIMITS.pending)return reject('capacity','Too many pending reinforcements.');
  inCallback=true;
  try{
   if(!open(s,entrance,monsterType))return reject('blocked','The entrance exit is blocked.');
   const id=value.requestId??'ingress-request:'+String(++serial);if(recent.has(id))return reject('duplicate','That reinforcement request was already accepted.');
   const warningSeconds=ENEMY_INGRESS_WARNING_SECONDS[entrance.kind],record={id,entranceId:entrance.id,monsterType,entrance,phase:'warning',remaining:warningSeconds,warningSeconds,blockedFor:0,retry:0};
   let affordable=false;try{affordable=canAfford(order(record))===true;}catch{}if(!affordable)return reject('unaffordable','Not enough DM stamina for that monster.');
   const current=readState();if(identityKey(current)!==bound||current.remote||ended(current)||paused(current))return reject('changed','The expedition changed before the request was accepted.');
   let charged=false;try{charged=spend(order(record))===true;}catch{}if(!charged)return reject('payment','The reinforcement cost was not accepted.');
   pending.set(entrance.id,record);recent.add(id);while(recent.size>ENEMY_INGRESS_LIMITS.recentRequests){const protectedIds=new Set([...pending.values()].map(r=>r.id)),old=[...recent].find(id=>!protectedIds.has(id));recent.delete(old);}sequence++;
   safe(sound,'ingress-warning',order(record));safe(notify,'Reinforcements gathering at '+entrance.kind+'.');
   return {accepted:true,pending:plainRecord(record)};
  }finally{inCallback=false;}
 }
 function tick(dt){
  if(ticking||inCallback)return;const s=bind(readState());if(s.remote)return;
  if(ended(s)){if(pending.size){pending.clear();sequence++;}return;}if(paused(s))return;
  dt=finite(dt)?Math.max(0,Math.min(.1,dt)):0;const entrances=roster(s);let changed=false;
  ticking=true;
  try{for(const [id,r]of [...pending]){
   const known=entrances?.find(e=>e.id===id);if(!known||!sameEntrance(r.entrance,known)){pending.delete(id);changed=true;continue;}
   if(r.phase==='blocked'){r.blockedFor=Math.min(ENEMY_INGRESS_LIMITS.blockedSeconds,r.blockedFor+dt);changed=changed||dt>0;if(r.blockedFor>=ENEMY_INGRESS_LIMITS.blockedSeconds-1e-8){pending.delete(id);changed=true;safe(notify,'Reinforcement canceled: the entrance stayed blocked for six seconds. Paid stamina is not refunded.');continue;}}
   const before=r.remaining;r.remaining=Math.max(0,r.remaining-dt);if(r.remaining<1e-8)r.remaining=0;changed=changed||before!==r.remaining;
   if(r.remaining>0)continue;
   r.retry=Math.max(0,r.retry-dt);if(r.retry>0)continue;
   inCallback=true;let clear=false;try{clear=open(s,r.entrance,r.monsterType);}finally{inCallback=false;}
   if(!clear){if(r.phase!=='blocked'){r.phase='blocked';changed=true;safe(notify,'Entrance blocked; the paid reinforcement is waiting for a clear exit.');}r.retry=.25;continue;}
   // Recheck current run/phase after caller collision queries and before spawn.
   const current=readState();if(identityKey(current)!==bound||current.remote||ended(current)||paused(current))continue;
   pending.delete(id);changed=true;let spawned=false;
   try{spawned=spawn(order(r))===true;}catch{safe(notify,'Reinforcement canceled after a spawn error; it will not be retried automatically.');continue;}
   if(spawned){safe(sound,'ingress-emerge',order(r));safe(notify,r.monsterType+' entered through '+r.entrance.kind+'.');}
   else{r.phase='blocked';r.retry=.25;pending.set(id,r);}
  }}finally{ticking=false;if(changed)sequence++;}
 }
 function snapshot(){const s=bind(readState()),context=identity(s);return {version:1,...context,sequence,serial,pending:[...pending.values()].map(plainRecord),recentRequestIds:[...recent]};}
 function applySnapshot(value,{resumeHost=false}={}){
  if(ticking||inCallback)return {applied:false,reason:'busy'};const s=bind(readState());if(!s.remote&&!resumeHost)return {applied:false,reason:'host-authority'};
  const parsed=validateEnemyIngressSnapshot(value,{...identity(s),size:s.size,entrances:s.entrances});if(!parsed.valid)return {applied:false,reason:parsed.reason};
  if(parsed.snapshot.sequence<=lastApplied)return {applied:false,reason:'stale'};
  const incoming=parsed.snapshot;pending.clear();recent.clear();for(const r of incoming.pending)pending.set(r.entranceId,{...r,retry:0});for(const id of incoming.recentRequestIds)recent.add(id);serial=incoming.serial;sequence=Math.max(sequence,incoming.sequence);lastApplied=incoming.sequence;
  return {applied:true};
 }
 function reset(){if(ticking||inCallback)return false;const count=pending.size;pending.clear();recent.clear();serial=0;lastApplied=-1;bound=identityKey(readState());sequence++;return count;}
 function cancel(entranceId){if(ticking||inCallback)return false;const removed=pending.delete(entranceId);if(removed)sequence++;return removed;}
 return {request,tick,snapshot,applySnapshot,reset,cancel};
}
