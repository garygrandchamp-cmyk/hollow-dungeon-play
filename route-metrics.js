import {roomContainsTile} from './room-footprint.js?v=1908281481c3818581fa62f1b68e946e615fba61';
/** Readability metrics for a validated required-objective route, not a validity gate. */
export function routeMetrics(path,{size,levels=[],moduleSize=4.8}={}){
 let steps=0,turns=0,transitions=0,lastDirection=null;const rooms=new Set(),cells=new Set();
 for(let j=0;j<(path?.length??0);j++){
  const [floor,index]=String(path[j]).split(':').map(Number);if(!Number.isInteger(floor)||!Number.isInteger(index))continue;cells.add(floor+':'+index);
  for(const [r,room]of (levels[floor]?.result?.architecture?.rooms??[]).entries())if(roomContainsTile(room,index%size,Math.floor(index/size)))rooms.add(floor+':'+r);
  if(!j)continue;const [priorFloor,prior]=String(path[j-1]).split(':').map(Number);if(priorFloor!==floor){transitions++;lastDirection=null;continue;}
  const dx=index%size-prior%size,dz=Math.floor(index/size)-Math.floor(prior/size);if(Math.abs(dx)+Math.abs(dz)!==1){lastDirection=null;continue;}
  steps++;const direction=dx+','+dz;if(lastDirection&&lastDirection!==direction)turns++;lastDirection=direction;
 }
 return {steps,turns,transitions,metres:Math.round(steps*moduleSize),rooms:rooms.size,uniqueTiles:cells.size};
}
