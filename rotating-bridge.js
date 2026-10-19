import {roomContainsTile} from './room-footprint.js?v=1d78ea79feefea23b13aa344fdb80a6c28d88fec';
import {dungeonProgression} from './dungeon-progression.js?v=1d78ea79feefea23b13aa344fdb80a6c28d88fec';
import {validateDungeon} from './progression-validator.js?v=1d78ea79feefea23b13aa344fdb80a6c28d88fec';

export const BRIDGE_TURN_SECONDS=2.4;
export const BRIDGE_DM_COST=8;
const directions=[[0,-1],[1,0],[0,1],[-1,0]];
const fresh=()=>({axis:0,turning:false,elapsed:0,serial:0});
const living=a=>a&&a.alive!==false&&!a.fainted&&!a.escaped&&a.health>0;
const hash=value=>{let n=2166136261;for(const c of String(value))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};

/** A two-tile court within a fully occupied four-tile patch. Its outer ring
 * remains ordinary ground in BOTH configurations and during the turn. */
// avoid: world rectangles {left,right,north,south} (e.g. a gallery stair and landing) that the 2×2 court,
// or with avoidRadius the swept turntable circle, must stay clear of.
export function planRotatingBridge({architecture,grid,tiles,size,seed='',floor=0,reserved=[],avoid=[],avoidRadius=0}={}){
 if(!architecture||!Array.isArray(grid)||!Number.isInteger(size)||size<8)return null;
 const protectedCells=new Set([architecture.start,architecture.start+1,architecture.start-size-1,architecture.start-size+1,architecture.stair,architecture.stair+1,architecture.stair-1,architecture.stair-size,architecture.stair+size,...architecture.objectiveIndices??[],...architecture.doors.map(d=>d.index),...reserved]);
 const candidates=[],avoided=(Array.isArray(avoid)?avoid:[]).filter(b=>b&&[b.left,b.right,b.north,b.south].every(Number.isFinite));
 const intrudes=(cx,cz,half)=>avoided.some(b=>avoidRadius>0?Math.hypot(Math.max(b.left,Math.min(cx,b.right))-cx,Math.max(b.north,Math.min(cz,b.south))-cz)<avoidRadius:b.left<cx+half&&b.right>cx-half&&b.north<cz+half&&b.south>cz-half);
 for(const room of architecture.rooms)if(room.w>=5&&room.h>=5){
  for(let z=room.z+1;z<room.z+room.h-2;z++)for(let x=room.x+1;x<room.x+room.w-2;x++){
   const patch=[];let valid=true;
   for(let dz=-1;dz<=2;dz++)for(let dx=-1;dx<=2;dx++){const xx=x+dx,zz=z+dz,i=zz*size+xx;if(!roomContainsTile(room,xx,zz)||!tiles[grid[i]]?.s.some(s=>s===1))valid=false;for(let d=0;d<4;d++){const [ox,oz]=directions[d];if(dx+ox>=-1&&dx+ox<=2&&dz+oz>=-1&&dz+oz<=2&&tiles[grid[i]]?.s[d]!==1)valid=false;}patch.push(i);}
   if(!valid)continue;
   const cells=[z*size+x,z*size+x+1,(z+1)*size+x,(z+1)*size+x+1];
   const controls=[(z-1)*size+x,z*size+x+2,(z+2)*size+x,z*size+x-1];
   if([...cells,...controls].some(i=>protectedCells.has(i)))continue;
   const cx=(x+1-size/2)*4.8,cz=(z+1-size/2)*4.8,half=4.8;
   if(intrudes(cx,cz,half))continue;
   candidates.push({id:`turntable:${floor}:${x}:${z}`,floor,room,x,z,cx,cz,half,width:2,length:9.9,cells,reserved:patch,
    // cx/cz lie on tile seams; nudge each bank control 0.6 m into its recorded tile so position and index agree.
    controls:directions.map(([dx,dz],i)=>({index:controls[i],x:cx+dx*(half+1.5)-(dx===0?.6:0),z:cz+dz*(half+1.5)-(dz===0?.6:0)})),score:hash(seed+':bridge:'+floor+':'+x+':'+z)});
  }
 }
 candidates.sort((a,b)=>a.score-b.score);return candidates[0]??null;
}
export function selectRotatingBridges({levels,size,tiles,seed='',reserved=[[],[]],avoid=[[],[]]}={}){
 const plans=levels.map((l,floor)=>planRotatingBridge({architecture:l.result.architecture,grid:l.result.grid,tiles,size,seed,floor,reserved:reserved[floor],avoid:avoid?.[floor]??[],avoidRadius:Math.hypot(9.9/2,2/2)+.5}));
 const eligible=plans.flatMap((p,i)=>p?[i]:[]);if(!eligible.length)return plans;
 const chosen=eligible[hash(seed+':turntable-floor')%eligible.length];return plans.map((p,i)=>i===chosen?p:null);
}
export function bridgeSwept(plan,x,z,radius=.18){return !!plan&&Number.isFinite(x)&&Number.isFinite(z)&&Math.hypot(x-plan.cx,z-plan.cz)<Math.hypot(plan.length/2,plan.width/2)+radius+.12;}
/** undefined outside court; otherwise the entire small body footprint must be
 * supported by bank, hub or the stationary stone deck. No invisible water floor. */
export function bridgeSupport(plan,record,x,z,radius=.18){
 if(!plan||!Number.isFinite(x)||!Number.isFinite(z))return undefined;
 const r=Number.isFinite(radius)?Math.max(0,Math.min(.6,radius)):.18;
 if(record?.turning&&bridgeSwept(plan,x,z,r))return false;
 if(Math.abs(x-plan.cx)>plan.half+r||Math.abs(z-plan.cz)>plan.half+r)return undefined;
 const point=(xx,zz)=>{let dx=xx-plan.cx,dz=zz-plan.cz;if(Math.abs(dx)>=plan.half||Math.abs(dz)>=plan.half)return true;if(Math.hypot(dx,dz)<=.85)return true;if(record?.axis===1)[dx,dz]=[dz,dx];return Math.abs(dx)<=plan.width/2&&Math.abs(dz)<=plan.length/2;};
 return [[0,0],[r,0],[-r,0],[0,r],[0,-r],...[[1,1],[1,-1],[-1,1],[-1,-1]].map(([a,b])=>[a*r*.7072,b*r*.7072])].every(([dx,dz])=>point(x+dx,z+dz));
}
export function validateBridgeSnapshot(value,seed,plans){
 if(!value||value.version!==1||value.seed!==seed||!Array.isArray(value.floors)||value.floors.length!==2)return null;
 for(let i=0;i<2;i++){const r=value.floors[i];if(!r||r.id!==(plans[i]?.id??null)||![0,1].includes(r.axis)||typeof r.turning!=='boolean'||!Number.isFinite(r.elapsed)||r.elapsed<0||r.elapsed>=BRIDGE_TURN_SECONDS||!r.turning&&r.elapsed!==0||!Number.isSafeInteger(r.serial)||r.serial<0||!plans[i]&&(r.turning||r.axis!==0||r.serial!==0))return null;}
 return value;
}
/** Prove key-before-lock progression with the entire court removed, then make
 * sure no living hero or crank lies outside that permanent connected route. */
export function validateBridgeRoutes({plans,actors=[],floor=0,...options}){
 const graph=dungeonProgression({...options,blockedCells:plans.map(p=>p?.cells??[])});
 const byId=new Map(graph.nodes.map(n=>[n.id,n])),seen=new Set([graph.start]),queue=[graph.start];
 for(let k=0;k<queue.length;k++)for(const edge of byId.get(queue[k])?.neighbors??[])if(!seen.has(edge.to)){seen.add(edge.to);queue.push(edge.to);}
 for(const actor of actors.filter(living))if(!seen.has(floor+':'+actor.index))return {valid:false,reason:'a living adventurer has no dry route back.'};
 for(const [f,p]of plans.entries())if(p?.controls.some(c=>!seen.has(f+':'+c.index)))return {valid:false,reason:'a bank crank is cut off.'};
 // A completed relic route leaves its paid doors permanently open. Controls
 // reachable through those doors can be visited from the exit without spending
 // another key. Only the remaining locations need extra search goals, avoiding
 // an exponential set of independent control-visit bits on ordinary layouts.
 const locations=[...new Set([...actors.filter(living).map(a=>floor+':'+a.index),...plans.flatMap((p,f)=>(p?.controls??[]).map(c=>f+':'+c.index))])],requiredObjectives=new Set(graph.requiredObjectives);
 for(let attempt=0;attempt<=locations.length;attempt++){
  const proof=validateDungeon({...graph,requiredObjectives:[...requiredObjectives]});if(!proof.valid)return proof;
  const opened=new Set(graph.doors.filter(d=>d.open||d.kind==='free').map(d=>d.id));for(const action of proof.actions)if(action.type==='unlock')opened.add(action.doorId);
  const reachable=new Set([graph.start]),pending=[graph.start];
  for(let k=0;k<pending.length;k++)for(const edge of byId.get(pending[k])?.neighbors??[])if((edge.doorId===undefined||opened.has(edge.doorId))&&!reachable.has(edge.to)){reachable.add(edge.to);pending.push(edge.to);}
  const reverse=new Map(graph.nodes.map(n=>[n.id,[]]));for(const node of graph.nodes)for(const edge of node.neighbors)if(edge.doorId===undefined||opened.has(edge.doorId))reverse.get(edge.to)?.push(node.id);
  const returns=new Set([graph.start]),back=[graph.start];for(let k=0;k<back.length;k++)for(const id of reverse.get(back[k])??[])if(!returns.has(id)){returns.add(id);back.push(id);}
  const missing=locations.filter(id=>!reachable.has(id)||!returns.has(id));if(!missing.length)return proof;
  for(const id of missing)requiredObjectives.add(id);
 }
 return {valid:false,reason:'a bank control or living adventurer has no key-safe dry route back.'};
}
export function createRotatingBridge({state,notify=()=>{},charge=()=>false,spendDM=()=>false,checkRoutes=()=>({valid:false}),sweepClear=()=>false,sound=()=>{}}={}){
 let seed='',floors=[fresh(),fresh()];
 const record=()=>floors[state().floor];
 function reset(value=''){seed=String(value);floors=[fresh(),fresh()];}
 function near(actor){const s=state(),p=s.plans[s.floor];return !!p&&living(actor)&&Math.abs(actor.position.y)<.3&&p.controls.some(c=>Math.hypot(actor.position.x-c.x,actor.position.z-c.z)<=2.1&&(!s.visible||s.visible(actor.position,{x:c.x,y:0,z:c.z})));}
 function turn(actor=null,dm=false){const s=state(),p=s.plans[s.floor],r=record();if(s.remote||s.paused||s.phase!=='active'||!p)return false;if(!dm&&!near(actor))return false;
  if(r.turning){notify('The bridge is already turning.');return false;}
  if((s.actors??[]).some(a=>living(a)&&a.position.y<2&&bridgeSwept(p,a.position.x,a.position.z,.3))||!sweepClear(p)){notify('Clear the bridge and its sweep before turning the crank.');return false;}
  const routes=checkRoutes();if(!routes?.valid){notify('Bridge locked: '+(routes?.reason??'a safe route to the objectives and exit is missing.'));return false;}
  if(dm?!spendDM(BRIDGE_DM_COST):!charge(actor))return false;
  r.turning=true;r.elapsed=0;r.serial++;sound(p);notify('Stone gears grind. Bridge turning — keep clear.');return true;
 }
 function tick(dt){const s=state();if(s.remote||s.paused||s.phase!=='active')return;const r=record();if(!r.turning)return;r.elapsed+=Math.max(0,Math.min(.1,Number.isFinite(dt)?dt:0));if(r.elapsed>=BRIDGE_TURN_SECONDS-1e-8){r.axis=1-r.axis;r.turning=false;r.elapsed=0;notify('Bridge aligned '+(r.axis?'east–west.':'north–south.'));}}
 function snapshot(){return {version:1,seed,floors:floors.map((r,i)=>({id:state().plans[i]?.id??null,...r}))};}
 function apply(value){const checked=validateBridgeSnapshot(value,seed,state().plans);if(!checked)return false;const floor=state().floor,next=checked.floors[floor];if(next.serial>floors[floor].serial&&next.turning)sound(state().plans[floor]);floors=checked.floors.map(({axis,turning,elapsed,serial})=>({axis,turning,elapsed,serial}));return true;}
 return {reset,near,turn,tick,snapshot,apply,get record(){return {...record()};},support:(x,z,r)=>bridgeSupport(state().plans[state().floor],record(),x,z,r)};
}
