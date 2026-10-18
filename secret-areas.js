import {DIRS,tiles as defaultTiles} from './wfc.js?v=6f522cb686c558f4c908d1aec66f280bb4b8a20c';

const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const hash=value=>{let h=2166136261;for(const c of String(value))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
const indexOK=(index,size)=>Number.isInteger(index)&&index>=0&&index<size*size;
const gridOK=(grid,size)=>Number.isInteger(size)&&size>=1&&size<=128&&(Array.isArray(grid)||ArrayBuffer.isView(grid))&&grid.length===size*size;
const edge=(a,b)=>Math.min(a,b)+':'+Math.max(a,b);
function neighbor(index,d,size){const [dx,dz]=DIRS[d],x=index%size+dx,z=Math.floor(index/size)+dz;return x>=0&&z>=0&&x<size&&z<size?z*size+x:-1;}
function sockets(grid,tiles,index){const tile=tiles[grid[index]];return tile&&Array.isArray(tile.s)&&tile.s.length===4&&tile.s.every(v=>v===0||v===1||v===2)?tile.s:null;}
function dry(grid,tiles,index){const s=sockets(grid,tiles,index);return s&&!s.includes(2)&&s.includes(1);}
function custom(grid,tiles,index){const tile=tiles[grid[index]];return !!(tile?.custom||tile?.recipe||tile?.catalogKey||tile?.catalogId);}
function addCells(target,values,size){
 if(!values)return;
 if(values instanceof Map)values=values.keys();
 if(typeof values[Symbol.iterator]!=='function')return;
 for(const value of values){const i=Number.isInteger(value)?value:value?.index;if(indexOK(i,size))target.add(i);}
}
function exclusions({size,architecture,reserved,protected:protectedCells,pins,customPins,roomPins}){
 const result=new Set();for(const values of [reserved,protectedCells,pins,customPins,roomPins,architecture?.protected,architecture?.pins,architecture?.route,architecture?.reserved,architecture?.items,architecture?.keys])addCells(result,values,size);
 for(const i of [architecture?.start,architecture?.stair,architecture?.exit])if(indexOK(i,size))result.add(i);
 return result;
}
function reachable(grid,tiles,size,start,blocked=new Set()){
 const found=new Set();if(!indexOK(start,size)||!sockets(grid,tiles,start)?.includes(1)||blocked.has(start))return found;
 const queue=[start];found.add(start);
 for(let head=0;head<queue.length;head++){const index=queue[head],s=sockets(grid,tiles,index);for(let d=0;d<4;d++){const j=neighbor(index,d,size);if(s[d]!==1||j<0||found.has(j)||blocked.has(j)||!sockets(grid,tiles,j)?.includes(1)||sockets(grid,tiles,j)[(d+2)%4]!==1)continue;found.add(j);queue.push(j);}}
 return found;
}
function leaf(grid,tiles,size,index){
 if(!indexOK(index,size)||!dry(grid,tiles,index)||custom(grid,tiles,index))return null;
 const s=sockets(grid,tiles,index);if(s.filter(v=>v===1).length!==1)return null;
 const d=s.indexOf(1),entranceIndex=neighbor(index,d,size);
 if(entranceIndex<0||!dry(grid,tiles,entranceIndex)||custom(grid,tiles,entranceIndex)||sockets(grid,tiles,entranceIndex)[(d+2)%4]!==1)return null;
 return {index,entranceIndex,d,edgeKey:edge(index,entranceIndex)};
}

/** Existing dry leaf only; d points FROM the secret index TO entranceIndex.
 * Returns zero or one plans. No tiles, sockets, architecture or inputs mutate.
 */
export function planSecrets({seed='',floor=0,grid,tiles=defaultTiles,size,reserved=[],forbiddenEdges=[],max=1,protected:protectedCells=[],start,architecture,pins=[],customPins=[],roomPins=[]}={}){
 if(!gridOK(grid,size)||!Array.isArray(tiles)||!Number.isInteger(floor)||floor<0||floor>1||!Number.isFinite(max)||max<1||!forbiddenEdges||typeof forbiddenEdges[Symbol.iterator]!=='function')return [];
 start=start??architecture?.start;if(!indexOK(start,size))return [];
 const excluded=exclusions({size,architecture,reserved,protected:protectedCells,pins,customPins,roomPins}),forbidden=new Set(forbiddenEdges),seen=reachable(grid,tiles,size,start),candidates=[];
 for(const index of seen){const candidate=leaf(grid,tiles,size,index);if(!candidate||excluded.has(index)||excluded.has(candidate.entranceIndex)||forbidden.has(candidate.edgeKey))continue;
  // Closing this alcove must leave every other previously reachable dry cell.
  const remainder=reachable(grid,tiles,size,start,new Set([index]));if(remainder.size!==seen.size-1)continue;
  candidates.push({...candidate,floor,id:`secret:${floor}:${index}:${hash(seed+'|'+floor+'|'+index).toString(16)}`});
 }
 candidates.sort((a,b)=>hash(seed+'|secret|'+floor+'|'+a.index)-hash(seed+'|secret|'+floor+'|'+b.index)||a.index-b.index);
 // Explicitly bounded to one hidden alcove per floor, including oversized max.
 return candidates.slice(0,1);
}

/** Strict immutable-layout snapshot validation. Absent/invalid -> null.
 * Actual level grid is accepted as level.grid, level.result.grid, or raw grid.
 * Opened/broken state is intentionally rejected and belongs in runtime state.
 */
export function normalizeSecretPlans(value,{size,levels,tiles=defaultTiles}={}){
 if(!Array.isArray(value)||value.length!==2||!Array.isArray(levels)||levels.length!==2||!Array.isArray(tiles))return null;
 const result=[[],[]],ids=new Set();
 for(let floor=0;floor<2;floor++){
  const level=levels[floor],grid=Array.isArray(level)||ArrayBuffer.isView(level)?level:level?.grid??level?.result?.grid,architecture=level?.architecture??level?.result?.architecture;
  if(!gridOK(grid,size)||!Array.isArray(value[floor])||value[floor].length>1)return null;
  const excluded=exclusions({size,architecture,reserved:level?.reserved??level?.items,pins:level?.pins,roomPins:level?.roomPins,protected:level?.protected});
  for(const cells of [level?.items,level?.keys,level?.customPins,level?.route])addCells(excluded,cells,size);
  const start=level?.start??architecture?.start,seen=indexOK(start,size)?reachable(grid,tiles,size,start):null;
  for(const plan of value[floor]){
   if(!seen)return null;
   if(!object(plan)||Object.keys(plan).length!==6||Object.keys(plan).some(k=>!['id','floor','index','entranceIndex','d','edgeKey'].includes(k))||typeof plan.id!=='string'||!/^[a-zA-Z0-9_.:-]{1,128}$/.test(plan.id)||ids.has(plan.id)||plan.floor!==floor||!Number.isInteger(plan.d)||plan.d<0||plan.d>3)return null;
   const actual=leaf(grid,tiles,size,plan.index);
   if(!actual||actual.entranceIndex!==plan.entranceIndex||actual.d!==plan.d||actual.edgeKey!==plan.edgeKey||excluded.has(plan.index)||excluded.has(plan.entranceIndex)||seen&&!seen.has(plan.index))return null;
   ids.add(plan.id);result[floor].push({id:plan.id,floor,index:plan.index,entranceIndex:plan.entranceIndex,d:plan.d,edgeKey:plan.edgeKey});
  }
 }
 return result;
}
