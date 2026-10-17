import {solve,DIRS,tiles,random} from './wfc.js?v=64ad63ccf9b715304e37145621288e4cb455ca14';
import {roomContainsTile,roomCells as enumerateRoomCells,roomPerimeter,roomCenterTile,makeRoomFootprint,ROOM_SHAPES} from './room-footprint.js?v=64ad63ccf9b715304e37145621288e4cb455ca14';
function legacyPlan(size,scale='mixed'){
 const main=Math.min(size-5,scale==='intimate'?3:scale==='grand'?8:Math.max(3,Math.min(6,Math.floor(size*.38)))),entry=Math.max(3,Math.min(scale==='grand'?5:scale==='intimate'?3:4,size-main-3));
 const rooms=[{x:1,z:1,w:entry,h:entry,name:'Entry hall'},{x:size-main-1,z:size-main-1,w:main,h:main,name:'Grand reliquary'}],pins=new Map(),doors=[],route=[];
 const ensure=i=>{if(!pins.has(i))pins.set(i,[null,null,null,null]);return pins.get(i);};
 rooms.forEach((r,k)=>{for(let z=r.z;z<r.z+r.h;z++)for(let x=r.x;x<r.x+r.w;x++)ensure(z*size+x).splice(0,4,...DIRS.map(([dx,dz])=>x+dx>=r.x&&x+dx<r.x+r.w&&z+dz>=r.z&&z+dz<r.z+r.h?1:0));const x=k===0?r.x+Math.floor(r.w/2):r.x,z=k===0?r.z+r.h-1:r.z+Math.floor(r.h/2),d=k===0?2:3;ensure(z*size+x)[d]=1;doors.push({index:z*size+x,d,name:r.name});});
 const start=2*size+2,b=rooms[1],stair=(b.z+Math.floor(b.h/2))*size+b.x+Math.floor(b.w/2),exitX=doors[0].index%size,exitZ=Math.floor(doors[0].index/size),endZ=Math.floor(doors[1].index/size);
 for(let z=exitZ+1;z<=endZ;z++)route.push(z*size+exitX);
 for(let x=exitX+1;x<b.x;x++)route.push(endZ*size+x);
 const chain=[doors[0].index,...route,doors[1].index];
 for(let j=0;j<chain.length-1;j++){const a=chain[j],b=chain[j+1],dx=b%size-a%size,dz=Math.floor(b/size)-Math.floor(a/size),d=DIRS.findIndex(v=>v[0]===dx&&v[1]===dz);if(d<0)throw Error('Invalid architecture route');ensure(a)[d]=1;ensure(b)[(d+2)%4]=1;}
 return {scale,rooms,doors,start,stair,pins:[...pins].map(([index,sockets])=>({index,sockets})),protected:new Set(pins.keys())};
}
const inside=roomContainsTile;
const separate=(a,b)=>a.x+a.w<b.x||b.x+b.w<a.x||a.z+a.h<b.z||b.z+b.h<a.z;
function neighbor(i,d,n){const [dx,dz]=DIRS[d],x=i%n+dx,z=Math.floor(i/n)+dz;return x>=0&&z>=0&&x<n&&z<n?z*n+x:-1;}
function pathBetween(n,start,goal,blocked,order){
 const previous=new Map([[start,null]]),queue=[start];let end=-1;
 for(let head=0;head<queue.length;head++){
  const i=queue[head];if(goal(i)){end=i;break;}
  for(const d of order){const j=neighbor(i,d,n);if(j>=0&&!blocked.has(j)&&!previous.has(j)){previous.set(j,i);queue.push(j);}}
 }
 if(end<0)return null;const path=[];for(let i=end;i!==null;i=previous.get(i))path.push(i);return path.reverse();
}

/** Omitted seed deliberately retains the original layout for old saves/tests.
 * Seeded layouts expose serializable footprint/void arrays as well as Sets.
 * extra pins expand the footprint without moving the seeded macro rooms.
 */
export function plan(size,scale='mixed',seed,extra=null){
 if(seed===undefined)return legacyPlan(size,scale);
 if(!Number.isInteger(size)||size<8||size>24)throw RangeError('Seeded architecture requires size 8–24.');
 if(!['intimate','mixed','grand'].includes(scale))throw RangeError('Unknown chamber scale.');
 const rng=random(String(seed)+'|macro-v3|'+size+'|'+scale),int=(a,b)=>a+Math.floor(rng()*(b-a+1)),margin=size>=10?1:0;
 const available=size-margin*2,maxMain=Math.min(scale==='intimate'?4:scale==='grand'?8:7,available-4),minMain=Math.min(maxMain,scale==='grand'?6:scale==='mixed'?4:3);
 let grand={w:int(minMain,maxMain),h:int(minMain,maxMain)},entry={w:int(3,Math.min(scale==='grand'?5:4,available-4)),h:int(3,Math.min(scale==='grand'?5:4,available-4))};
 let rooms;const targetRooms=size<12?3:int(3,5),extras=extra?(Array.isArray(extra)?extra:[extra]):[];
 const quarterTurns=int(0,3),rotate=r=>{for(let q=0;q<quarterTurns;q++)r={...r,x:size-r.z-r.h,z:r.x,w:r.h,h:r.w};return r;};
 const compatible=candidate=>extras.every(pin=>{const s=pin.sockets??tiles[pin.tile]?.s;if(!s)return true;const x=pin.index%size,z=Math.floor(pin.index/size);return candidate.map(rotate).every(r=>!inside(r,x,z)||s.every((v,d)=>v===null||v===(inside(r,x+DIRS[d][0],z+DIRS[d][1])?1:0)));});
 // Candidate placement is bounded, and smaller grids retain meaningful 3×3 rooms.
 for(let attempt=0;attempt<1000&&!rooms;attempt++){
  if(attempt&&attempt%100===0){if(grand.w>3)grand.w--;if(grand.h>3)grand.h--;if(entry.w>3)entry.w--;if(entry.h>3)entry.h--;}
  const b={x:int(margin,size-margin-grand.w),z:int(margin,size-margin-grand.h),...grand,name:'Grand reliquary'};
  const a={x:int(margin,size-margin-entry.w),z:int(margin,size-margin-entry.h),...entry,name:'Entry hall'};
  if(separate(a,b)){
   const candidate=[a,b];
   for(let k=2;k<targetRooms;k++){
    let next;
    for(let trial=0;trial<120&&!next;trial++){
     const max=trial<60?Math.min(5,available-4):3,w=int(3,max),h=int(3,max),r={x:int(margin,size-margin-w),z:int(margin,size-margin-h),w,h,name:['','', 'Forgotten archive','Ossuary chapel','Warden chamber'][k]};
     if(candidate.every(other=>separate(r,other)))next=r;
    }
    if(next)candidate.push(next);else break;
   }
   if(candidate.length>=3&&compatible(candidate))rooms=candidate;
  }
 }
 if(!rooms)throw Error('Could not place separated macro rooms.');
 rooms=rooms.map(rotate);
 // Separate RNG preserves the existing seeded room bounds/entry/grand sizing.
 // Saved architecture without this metadata continues to mean full rectangles.
 const shapeRng=random(String(seed)+'|room-footprints-v1|'+size+'|'+scale);
 for(let k=2;k<rooms.length;k++){
  const r=rooms[k],chosen=ROOM_SHAPES[Math.floor(shapeRng()*ROOM_SHAPES.length)],turns=Math.floor(shapeRng()*4);
  if(k>2&&shapeRng()<.25)continue;
  const shaped={...r,footprint:makeRoomFootprint(r,chosen,turns)};
  const fits=extras.every(pin=>{const s=pin.sockets??tiles[pin.tile]?.s,x=pin.index%size,z=Math.floor(pin.index/size);if(!s||x<r.x||x>=r.x+r.w||z<r.z||z>=r.z+r.h)return true;
   return inside(shaped,x,z)&&s.every((v,d)=>v===null||v===(inside(shaped,x+DIRS[d][0],z+DIRS[d][1])?1:0));});
  if(fits)rooms[k]=shaped;
 }
 const pins=new Map(),roomCells=new Set(),active=new Set(),doors=[null,null],route=[];
 const ensure=i=>{if(!pins.has(i))pins.set(i,[null,null,null,null]);return pins.get(i);};
 for(const r of rooms)for(const {x,z}of enumerateRoomCells(r)){
  const i=z*size+x;active.add(i);roomCells.add(i);pins.set(i,DIRS.map(([dx,dz])=>inside(r,x+dx,z+dz)?1:0));
 }
 function doorCandidates(room){
  const candidates=room.footprint?roomPerimeter(room):[{x:room.x+Math.floor(room.w/2),z:room.z,d:0},{x:room.x+room.w-1,z:room.z+Math.floor(room.h/2),d:1},{x:room.x+Math.floor(room.w/2),z:room.z+room.h-1,d:2},{x:room.x,z:room.z+Math.floor(room.h/2),d:3}];
  return candidates.map(p=>({...p,index:p.z*size+p.x})).filter(p=>{const j=neighbor(p.index,p.d,size);return j>=0&&!roomCells.has(j);});
 }
 function doorFor(room,target){
  const center=roomCenterTile(target);
  return doorCandidates(room).sort((a,b)=>Math.abs(a.x-center.x)+Math.abs(a.z-center.z)-Math.abs(b.x-center.x)-Math.abs(b.z-center.z))[0];
 }
 const order=[0,1,2,3];for(let k=3;k>0;k--){const j=int(0,k);[order[k],order[j]]=[order[j],order[k]];}
 function carve(path){for(const i of path){active.add(i);if(!pins.has(i))pins.set(i,[0,0,0,0]);if(!roomCells.has(i)&&!route.includes(i))route.push(i);}for(let k=1;k<path.length;k++){const a=path[k-1],b=path[k],d=DIRS.findIndex((_,d)=>neighbor(a,d,size)===b);ensure(a)[d]=1;ensure(b)[(d+2)%4]=1;}}
 const journeyRooms=[0,...rooms.slice(2).map((_,i)=>i+2),1],roomDoors=new Map();
 for(let leg=1;leg<journeyRooms.length;leg++){
  const fromRoom=rooms[journeyRooms[leg-1]],toRoom=rooms[journeyRooms[leg]];
  let a=doorFor(fromRoom,toRoom),b=doorFor(toRoom,fromRoom);
  const previous=roomDoors.get(journeyRooms[leg-1]);
  if(previous?.d===a.d){
   const alternatives=doorCandidates(fromRoom).filter(p=>p.d!==a.d);
   if(alternatives.length)a=alternatives[int(0,alternatives.length-1)];
  }
  let from=neighbor(a.index,a.d,size),to=neighbor(b.index,b.d,size);const blocked=new Set([...roomCells,...route]);blocked.delete(from);blocked.delete(to);
  let corridor=pathBetween(size,from,i=>i===to,blocked,order)??pathBetween(size,from,i=>i===to,roomCells,order);
  // A concave edge can face a clipped pocket against the grid boundary.
  // Select a reachable perimeter pair rather than carving through room walls.
  if(!corridor)outer:for(const candidateA of doorCandidates(fromRoom))for(const candidateB of doorCandidates(toRoom)){
   const candidateFrom=neighbor(candidateA.index,candidateA.d,size),candidateTo=neighbor(candidateB.index,candidateB.d,size),path=pathBetween(size,candidateFrom,i=>i===candidateTo,roomCells,order);
   if(path){a=candidateA;b=candidateB;from=candidateFrom;to=candidateTo;corridor=path;break outer;}
  }
  if(!corridor)throw Error('Macro corridor cannot connect its rooms.');
  carve([a.index,...corridor,b.index]);
  const entrance={index:a.index,d:a.d,name:fromRoom.name,roomIndex:journeyRooms[leg-1]},exit={index:b.index,d:b.d,name:toRoom.name,roomIndex:journeyRooms[leg]};
  if(leg===1)doors[0]=entrance;else doors.push(entrance);
  if(leg===journeyRooms.length-1)doors[1]=exit;else doors.push(exit);
  roomDoors.set(journeyRooms[leg],b);
 }
 // Branch wings terminate at different places and widths rather than filling
 // the enclosing square. Their pinned spines always connect to the main route.
 const wings=[],wingCount=int(2,5);
 for(let k=0;k<wingCount;k++){
  const origins=route.filter(i=>!roomCells.has(i));if(!origins.length)break;
  const origin=origins[int(0,origins.length-1)],target=int(0,size*size-1);if(roomCells.has(target))continue;
  const path=pathBetween(size,origin,i=>i===target,roomCells,order);if(!path)continue;
  const wing=path.slice(0,int(3,Math.max(3,Math.min(path.length,Math.ceil(size*.45)))));carve(wing);wings.push(wing);
 }
 // Keep one nonessential dry leaf available to the existing secret-area
 // system. Its two cells are solver constraints, not reserved architecture.
 const optionalCells=new Set(),optionalAlcoves=[];
 const extraIndices=new Set(extras.map(p=>p.index));
 for(const origin of [...route]){
  let found=false;
  for(const d of order){const a=neighbor(origin,d,size),b=a<0?-1:neighbor(a,d,size);
   if(a<0||b<0||pins.has(a)||pins.has(b)||extraIndices.has(a)||extraIndices.has(b))continue;
   if(DIRS.some((_,side)=>{const j=neighbor(b,side,size);return j>=0&&j!==a&&pins.has(j);}))continue;
   carve([origin,a,b]);optionalCells.add(a);optionalCells.add(b);optionalAlcoves.push({index:b,entranceIndex:a});found=true;break;
  }
  if(found)break;
 }
 for(let i=route.length-1;i>=0;i--)if(optionalCells.has(route[i]))route.splice(i,1);
 // A one-cell ragged skirt allows local WFC junctions and dry leaf alcoves.
 for(const i of [...active])if(!roomCells.has(i))for(let d=0;d<4;d++){const j=neighbor(i,d,size);if(j>=0&&rng()<.66)active.add(j);}
 for(const pin of extras){
  if(!Number.isInteger(pin?.index)||pin.index<0||pin.index>=size*size)continue;
  const oldActive=new Set(active);active.add(pin.index);
  const link=pathBetween(size,pin.index,i=>oldActive.has(i),new Set(),order);for(const i of link??[])active.add(i);
  const sockets=pin.sockets??tiles[pin.tile]?.s;
  for(let d=0;d<4;d++)if(!sockets||sockets[d]!==0){const j=neighbor(pin.index,d,size);if(j>=0){active.add(j);if(sockets&&sockets[d]!==null&&!roomCells.has(pin.index)&&pins.has(pin.index))pins.get(pin.index)[d]=sockets[d];if(sockets&&sockets[d]!==null&&!roomCells.has(j)&&pins.has(j))pins.get(j)[(d+2)%4]=sockets[d];}}
 }
 const protectedCells=new Set([...pins.keys()].filter(i=>!optionalCells.has(i))),voidCells=[];
 for(let i=0;i<size*size;i++)if(!active.has(i)){voidCells.push(i);pins.set(i,[0,0,0,0]);}
 const a=rooms[0],b=rooms[1],start=(a.z+Math.floor(a.h/2))*size+a.x+Math.floor(a.w/2),stair=(b.z+Math.floor(b.h/2))*size+b.x+Math.floor(b.w/2);
 const footprint=[...active].sort((a,b)=>a-b);
 const voidSet=new Set(voidCells);
 const topology={layoutVersion:2,planVersion:2,roomFootprintVersion:1,seed:String(seed),layoutSeed:String(seed),scale,quarterTurns,rooms,roomCenters:rooms.map(roomCenterTile),doors,start,stair,route,wings,journeyRooms,optionalAlcoves,optionalPins:[...optionalCells].map(index=>({index,sockets:pins.get(index)})),footprint,footprintSet:new Set(footprint),voidCells,voidSet,pins:[...pins].filter(([index])=>!optionalCells.has(index)).map(([index,sockets])=>voidSet.has(index)?{index,tile:0,sockets:[0,0,0,0]}:{index,sockets}),protected:protectedCells};
 return addJourneyObjectives(topology,size,pins);
}
function traceSockets(size,start,goal,sockets){
 const previous=new Map([[start,null]]),queue=[start];
 for(let head=0;head<queue.length;head++){
  const i=queue[head];if(i===goal){const path=[];for(let j=i;j!==null;j=previous.get(j))path.push(j);return path.reverse();}
  const s=sockets(i);if(!s)continue;
  for(let d=0;d<4;d++){const j=neighbor(i,d,size);if(s[d]===1&&j>=0&&sockets(j)?.[(d+2)%4]===1&&!previous.has(j)){previous.set(j,i);queue.push(j);}}
 }
 return null;
}
function journeyMetrics(p,size,sockets){
 const cache=new Map(),path=(a,b)=>{const key=a+':'+b;if(!cache.has(key))cache.set(key,traceSockets(size,a,b,sockets));return cache.get(key);};
 const turns=indices=>{let count=0,previous=null;for(let k=1;k<indices.length;k++){const direction=indices[k]-indices[k-1];if(previous!==null&&direction!==previous)count++;previous=direction;}return count;};
 const [a,b,c]=p.objectiveIndices,orders=[[a,b,c],[a,c,b],[b,a,c],[b,c,a],[c,a,b],[c,b,a]];
 let best=null;
 for(const order of orders){const stops=[p.start,...order,p.stair],indices=[p.start];let valid=true;for(let k=1;k<stops.length;k++){const leg=path(stops[k-1],stops[k]);if(!leg){valid=false;break;}indices.push(...leg.slice(1));}if(!valid)continue;const metric={requiredSteps:indices.length-1,requiredTurns:turns(indices),requiredOrder:order,requiredPath:indices};if(!best||metric.requiredSteps<best.requiredSteps||metric.requiredSteps===best.requiredSteps&&metric.requiredTurns<best.requiredTurns)best=metric;}
 const direct=path(p.start,p.stair);
 return {version:1,roomCount:p.rooms.length,waypointRoomCount:p.rooms.length-2,turnsMethod:'deterministic shortest-path witness',startToStairSteps:direct?direct.length-1:null,startToStairTurns:direct?turns(direct):null,...(best??{requiredSteps:null,requiredTurns:null,requiredOrder:[],requiredPath:[]}),detourSteps:best&&direct?best.requiredSteps-(direct.length-1):null,objectiveDistances:p.objectiveIndices.map(i=>({index:i,fromStart:path(p.start,i)?path(p.start,i).length-1:null,fromStair:path(p.stair,i)?path(p.stair,i).length-1:null}))};
}
function addJourneyObjectives(p,size,pins){
 const sockets=i=>pins.get(i),excluded=new Set([p.start,p.start+1,p.start-size-1,p.start-size+1,p.stair,p.stair-1,p.stair+1,p.stair-size,p.stair+size,...p.doors.map(d=>d.index),...p.optionalPins.map(p=>p.index)]);
 const candidates=[...pins.keys()].filter(i=>!excluded.has(i)&&sockets(i).includes(1)&&traceSockets(size,p.start,i,sockets));
 const distances=new Map(),distance=(a,b)=>{const key=a+':'+b;if(!distances.has(key))distances.set(key,(traceSockets(size,a,b,sockets)?.length??1)-1);return distances.get(key);};
 const selected=[],usedRooms=new Set(),roomOf=i=>p.rooms.findIndex(r=>inside(r,i%size,Math.floor(i/size)));
 for(let k=0;k<3;k++){
  let best=-1,score=-Infinity;
  for(const i of candidates){if(selected.includes(i))continue;const room=roomOf(i),minimum=Math.min(distance(p.start,i),distance(p.stair,i),...selected.map(j=>distance(j,i))),value=minimum+distance(p.start,i)*.15+(room>=2&&!usedRooms.has(room)?size*.45:0);
   if(value>score){score=value;best=i;}
  }
  if(best<0)throw Error('Architecture cannot place three safe objectives.');selected.push(best);usedRooms.add(roomOf(best));
 }
 p.objectiveIndices=selected;p.objectives=[...selected];p.routeComplexity=journeyMetrics(p,size,sockets);return p;
}
/** Diagnostics only: never rejects a short authored/custom dungeon. */
export function measureJourney(grid,size,architecture){const p=architecture.objectiveIndices?architecture:{...architecture,objectiveIndices:[architecture.start+1,architecture.stair-1,architecture.stair-size]};return journeyMetrics(p,size,i=>tiles[grid[i]]?.s);}
function extendArchitecture(base,size,extra){
 const p=structuredClone(base),active=new Set(p.footprint??Array.from({length:size*size},(_,i)=>i)),oldVoid=new Set(p.voidCells??[]),extras=extra?(Array.isArray(extra)?extra:[extra]):[];
 if(!Array.isArray(p.rooms)||!Array.isArray(p.doors)||!Array.isArray(p.pins)||!Number.isInteger(p.start)||!Number.isInteger(p.stair))throw TypeError('Invalid architecture override.');
 for(const pin of extras){if(!Number.isInteger(pin?.index)||pin.index<0||pin.index>=size*size)throw RangeError('Pinned cell is outside the grid.');
  const oldActive=new Set(active),link=pathBetween(size,pin.index,i=>oldActive.has(i),new Set(),[0,1,2,3]);for(const i of link??[])active.add(i);active.add(pin.index);
  const s=pin.sockets??tiles[pin.tile]?.s;for(let d=0;d<4;d++)if(!s||s[d]!==0){const j=neighbor(pin.index,d,size);if(j>=0)active.add(j);}
 }
 p.footprint=[...active].sort((a,b)=>a-b);p.footprintSet=new Set(p.footprint);p.voidCells=Array.from({length:size*size},(_,i)=>i).filter(i=>!active.has(i));p.voidSet=new Set(p.voidCells);
 p.pins=p.pins.filter(pin=>!oldVoid.has(pin.index));for(const index of p.voidCells)p.pins.push({index,tile:0,sockets:[0,0,0,0]});
 p.protected=new Set(base.protected??[]);return p;
}
/** Fifth argument may be a layout seed or the exact current architecture.
 * Pass the architecture object for manual stamps: existing macro rooms, doors,
 * objectives and mandatory constraints remain unchanged, while void expands.
 */
export function generateFloor(size,seed,extra=null,scale='mixed',layoutSeed=seed){
 const p=layoutSeed&&typeof layoutSeed==='object'?extendArchitecture(layoutSeed,size,extra):plan(size,scale,layoutSeed,extra),pins=[...p.pins,...(p.optionalPins??[]),...(extra?(Array.isArray(extra)?extra:[extra]):[])];
 const finish=result=>{if(p.objectiveIndices)p.routeComplexity=measureJourney(result.grid,size,p);return {...result,architecture:p};};
 for(let attempt=0;attempt<4;attempt++){try{return finish(solve(size,seed+'-attempt-'+attempt,pins));}catch(e){if(attempt===3){const dry=Array.from({length:size*size},(_,index)=>({index,sockets:[null,null,null,null],dry:true}));return finish(solve(size,seed+'-dry',[...pins,...dry]));}}}
}
export function reachable(grid,size,start){const seen=new Set([start]),q=[start];while(q.length){const i=q.pop();for(let d=0;d<4;d++){if(tiles[grid[i]].s[d]!==1)continue;const [dx,dz]=DIRS[d],x=i%size+dx,z=Math.floor(i/size)+dz,j=z*size+x;if(x<0||z<0||x>=size||z>=size||seen.has(j))continue;if(tiles[grid[j]].s[(d+2)%4]===1){seen.add(j);q.push(j);}}}return [...seen];}
