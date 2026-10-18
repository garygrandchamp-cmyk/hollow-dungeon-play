export const NOISE_PROFILES=Object.freeze(Object.fromEntries(Object.entries({
 melee:{label:'Steel clash',radius:14,duration:5},heavy:{label:'Heavy impact',radius:22,duration:7},magic:{label:'Arcane crack',radius:26,duration:8},bow:{label:'Bowstring',radius:8,duration:4},door:{label:'Grinding door',radius:14,duration:6},search:{label:'Rummaging',radius:9,duration:4},bell:{label:'Chapel bell',radius:32,duration:8},whisper:{label:'Cursed whisper',radius:18,duration:6}
}).map(([k,v])=>[k,Object.freeze(v)])));
const point=i=>Number.isInteger(i)&&i>=0;
/** Bounded host-only acoustic field. Geometry is never generated here. Dijkstra
 * handles muffled doors; fields cache until a door/topology or event changes. */
export function createDungeonNoise({size,coord,edgeCost}){
 let events=[],serial=0;const fields=new Map(),cooldowns=new Map();
 function reset(){events=[];serial=0;fields.clear();cooldowns.clear();}
 function invalidate(){fields.clear();}
 function emit({kind,floor,index,actorId='solo'}){
  const n=size(),profile=typeof kind==='string'&&Object.hasOwn(NOISE_PROFILES,kind)?NOISE_PROFILES[kind]:null;if(!profile||![0,1].includes(floor)||!point(index)||index>=n*n||typeof actorId!=='string'||!/^hero-[123]$|^solo$/.test(actorId))return false;
  if(kind==='door')invalidate();const key=floor+':'+actorId;if((cooldowns.get(key)??0)>0)return false;cooldowns.set(key,.75);
  // Coalesce the same actor's repeated action; retain a bounded recent trail.
  const previous=events.find(e=>e.floor===floor&&e.actorId===actorId&&e.kind===kind&&e.index===index);if(previous){fields.delete(previous.id);events=events.filter(e=>e!==previous);}
  events.push({id:++serial,kind,floor,index,actorId,remaining:profile.duration});while(events.length>16){fields.delete(events[0].id);events.shift();}return true;
 }
 function tick(dt){dt=Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0;for(const [id,t]of cooldowns){if(t<=dt)cooldowns.delete(id);else cooldowns.set(id,t-dt);}for(const e of events)e.remaining=Math.max(0,e.remaining-dt);events=events.filter(e=>{if(e.remaining>0)return true;fields.delete(e.id);return false;});}
 function field(event){if(fields.has(event.id))return fields.get(event.id);const n=size(),limit=NOISE_PROFILES[event.kind].radius,distance=new Map([[event.index,0]]),queue=[{index:event.index,cost:0}];
  while(queue.length){queue.sort((a,b)=>a.cost-b.cost);const current=queue.shift();if(current.cost!==distance.get(current.index))continue;
   const x=current.index%n,z=Math.floor(current.index/n),[ax,az]=coord(current.index);
   for(const [dx,dz]of [[0,-1],[1,0],[0,1],[-1,0]]){const xx=x+dx,zz=z+dz;if(xx<0||zz<0||xx>=n||zz>=n)continue;const index=zz*n+xx,muffle=edgeCost(event.floor,current.index,index);if(!Number.isFinite(muffle)||muffle<=0)continue;const [bx,bz]=coord(index),cost=current.cost+Math.hypot(bx-ax,bz-az)*Math.max(1,muffle);if(cost>limit||cost>=(distance.get(index)??Infinity))continue;distance.set(index,cost);queue.push({index,cost});}
  }
  fields.set(event.id,distance);return distance;
 }
 function hear(floor,index){let best=null,score=-Infinity;for(const e of events){if(e.floor!==floor)continue;const d=field(e).get(index);if(d===undefined)continue;const p=NOISE_PROFILES[e.kind],value=(1-d/p.radius)*.7+e.remaining/p.duration*.3;if(value>score){score=value;best=e;}}return best?{...best}:null;}
 function hint(actorId,floor){const e=events.filter(e=>e.actorId===actorId&&e.floor===floor).at(-1);return e?NOISE_PROFILES[e.kind].label.toUpperCase()+' · '+Math.ceil(e.remaining)+'s':'';}
 function report(floor,gridSize){const e=events.filter(e=>e.floor===floor).at(-1);return e?NOISE_PROFILES[e.kind].label+' · tile '+(e.index%(gridSize??size())+1)+','+(Math.floor(e.index/(gridSize??size()))+1):'';}
 function snapshot(){return {version:1,serial,events:events.map(e=>({...e}))};}
 function apply(value){const parsed=parseDungeonNoise(value,size());if(!parsed)return false;serial=parsed.serial;events=parsed.events.map(e=>({...e}));fields.clear();cooldowns.clear();return true;}
 function approach(floor,index,id,canWalk){const event=events.find(e=>e.floor===floor&&e.id===id);if(!event)return index;const distances=field(event),current=distances.get(index);if(current===undefined)return index;let next=index,best=current;const n=size(),x=index%n,z=Math.floor(index/n);for(const [dx,dz]of [[0,-1],[1,0],[0,1],[-1,0]]){const xx=x+dx,zz=z+dz,j=zz*n+xx;if(xx<0||zz<0||xx>=n||zz>=n||!canWalk(index,j))continue;const cost=distances.get(j);if(cost!==undefined&&cost<best){best=cost;next=j;}}return next;}
 return {reset,emit,tick,invalidate,hear,approach,hint,report,snapshot,apply,get count(){return events.length;}};
}
export function parseDungeonNoise(v,size){
 if(v===undefined)return {version:1,serial:0,events:[]};
 if(!v||v.version!==1||!Number.isSafeInteger(v.serial)||v.serial<0||!Array.isArray(v.events)||v.events.length>16)return null;const ids=new Set();
 for(const e of v.events){if(!e||!Number.isSafeInteger(e.id)||e.id<1||e.id>v.serial||ids.has(e.id)||!Object.hasOwn(NOISE_PROFILES,e.kind)||![0,1].includes(e.floor)||!point(e.index)||e.index>=size*size||typeof e.actorId!=='string'||!/^hero-[123]$|^solo$/.test(e.actorId)||!Number.isFinite(e.remaining)||e.remaining<=0||e.remaining>NOISE_PROFILES[e.kind].duration)return null;ids.add(e.id);}
 return {version:1,serial:v.serial,events:v.events.map(e=>({...e}))};
}
