import {roomPerimeter} from './room-footprint.js?v=84fc371936953c752f7d36674575129dbb0d8ea1';
import {wallTorchMountAllowed} from './torch-mounts.js?v=84fc371936953c752f7d36674575129dbb0d8ea1';

const directions=[[0,-1],[1,0],[0,1],[-1,0]];
const themes={
 crypt:['crypt-plaque','painting:devotion','painting:ancestor'],
 library:['painting:ancestor','painting:castle','painting:devotion'],
 barracks:['shackles','painting:castle','painting:ancestor'],
 flooded:['crypt-plaque','painting:devotion'],
};
function hash(text){let h=2166136261;for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
export function wallDressingSurfaceAllowed(surface){return !!surface&&surface.opening==='none'&&
 (!surface.sightDamage||surface.sightDamage==='none')&&Number.isFinite(surface.height)&&surface.height>=2.9&&
 Number.isFinite(surface.ruin)&&surface.ruin<=.2&&Number.isFinite(surface.thickness)&&surface.thickness>=.15&&surface.thickness<=.9;}

/** Build-time only. A decoration never changes collision or route state. */
export function planWallDressing({rooms=[],seed='',theme='crypt',floor=0,size,
 moduleSize=4.8,maxPieces=5,blockedIndices=[],surfaceAt=()=>null,...context}={}){
 if(!Number.isInteger(size)||size<1||!Number.isFinite(moduleSize)||moduleSize<2||
  !Number.isInteger(maxPieces)||maxPieces<0||!Array.isArray(rooms))return [];
 const used=new Set(),seenRooms=new Set(),blocked=new Set(blockedIndices),plans=[],kinds=themes[theme]??themes.crypt;
 const ordered=rooms.filter(room=>room&&[room.x,room.z,room.w,room.h].every(Number.isInteger)&&
  room.x>=0&&room.z>=0&&room.w>0&&room.h>0&&room.x+room.w<=size&&room.z+room.h<=size)
  .map(room=>({room,key:[room.x,room.z,room.w,room.h].join(':')}))
  .sort((a,b)=>hash(seed+':'+floor+':'+a.key)-hash(seed+':'+floor+':'+b.key)||a.key.localeCompare(b.key));
 for(const {room,key}of ordered){
  if(seenRooms.has(key))continue;seenRooms.add(key);
  if(plans.length>=Math.min(6,maxPieces))break;
  const rank=hash(seed+':dressing:'+floor+':'+key);
  // Deliberate empty walls: one small piece at most per selected room.
  if(rank%4===0)continue;
  const edges=roomPerimeter(room).map(edge=>({...edge,index:(room.z+edge.row)*size+room.x+edge.col}))
   .sort((a,b)=>hash(seed+':'+key+':'+a.index+':'+a.d)-hash(seed+':'+key+':'+b.index+':'+b.d)||a.index-b.index||a.d-b.d);
  for(const edge of edges){
   const {index,d}=edge;if(index<0||index>=size*size||blocked.has(index)||used.has(index))continue;
   const surface=surfaceAt(index,d);
   if(!wallDressingSurfaceAllowed(surface))continue;
   const [dx,dz]=directions[d],normal={x:-dx,z:-dz};
   const inset=surface.thickness/2+.012;
   const position={x:(index%size-(size-1)/2)*moduleSize+dx*(moduleSize/2-inset),
    z:(Math.floor(index/size)-(size-1)/2)*moduleSize+dz*(moduleSize/2-inset)};
   if(!wallTorchMountAllowed({...context,position,normal,size,moduleSize}))continue;
   const kind=kinds[rank%kinds.length];
   plans.push({id:'dressing:'+floor+':'+key,index,d,kind,...position,wallThickness:surface.thickness,
    y:kind==='shackles'?1.35:kind==='crypt-plaque'?1.65:1.9,yaw:Math.atan2(normal.x,normal.z)});
   used.add(index);break;
  }
 }
 return plans;
}
