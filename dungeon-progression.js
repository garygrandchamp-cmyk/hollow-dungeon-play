import {validateDungeon} from './progression-validator.js?v=3bb31c2b0119d0819fb38cd81c6202ed8ba2819a';
const dirs=[[0,-1],[1,0],[0,1],[-1,0]];
/** Snapshot the navigation recipe, not scene meshes or enemy positions. */
export function dungeonProgression({levels,size,tiles,locks=[],edgeAt=()=>null,extraKeys=[],blockedCells=[[],[]]}={}){
 const nodes=[],doors=[],nodeIds=new Set(),nodeId=(floor,index)=>floor+':'+index;
 const lockByEdge=new Map(locks.map(l=>[l.floor+':'+l.doorKey,l]));
 for(let floor=0;floor<levels.length;floor++){
  const level=levels[floor],grid=level.result.grid;
  for(let i=0;i<grid.length;i++)if(!blockedCells[floor]?.includes(i)&&tiles[grid[i]]&&!tiles[grid[i]].s.every(s=>s===0))nodeIds.add(nodeId(floor,i));
 }
 for(const [key,l]of lockByEdge)doors.push({id:key,kind:l.kind==='silver'?'silver':'named',keyId:l.kind,open:!!l.unlocked});
 for(let floor=0;floor<levels.length;floor++){
  const level=levels[floor],grid=level.result.grid,arch=level.result.architecture;
  for(let i=0;i<grid.length;i++){
   const id=nodeId(floor,i);if(!nodeIds.has(id))continue;const neighbors=[];
   for(let d=0;d<4;d++){
    const [dx,dz]=dirs[d],x=i%size+dx,z=Math.floor(i/size)+dz,j=z*size+x;
    if(x<0||z<0||x>=size||z>=size||!nodeIds.has(nodeId(floor,j)))continue;
    const edge=edgeAt(floor,i,d),s=tiles[grid[i]].s[d],other=tiles[grid[j]].s[(d+2)%4];
    if(edge?!edge.passable:s===0||s!==other)continue;
    const edgeKey=[Math.min(i,j),Math.max(i,j)].join(':'),doorId=floor+':'+edgeKey;
    neighbors.push({to:nodeId(floor,j),...(lockByEdge.has(doorId)?{doorId}:{})});
   }
   if(i===arch.stair&&levels.length===2)neighbors.push({to:nodeId(1-floor,levels[1-floor].result.architecture.stair),via:'stairs'});
   const keys=locks.filter(l=>l.floor===floor&&l.index===i&&!l.collected).map(l=>({id:l.kind,kind:l.kind==='silver'?'silver':'named',pickupId:floor+':'+l.kind}));
   for(const k of extraKeys)if(k.floor===floor&&k.index===i)keys.push({...k,pickupId:k.pickupId??k.id+':'+floor+':'+i});
   nodes.push({id,neighbors,keys,objective:level.items.some(item=>item.index===i)?id:undefined,exit:floor===0&&i===arch.start});
  }
 }
 return {nodes,doors,start:nodeId(0,levels[0].result.architecture.start),requiredObjectives:levels.flatMap((l,f)=>l.items.map(item=>nodeId(f,item.index)))};
}
export function validateDungeonProgression(options){return validateDungeon(dungeonProgression(options));}
