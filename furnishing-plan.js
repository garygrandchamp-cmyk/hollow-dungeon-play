import {LARGE_ROOM_SHAPES,roomPerimeter} from './room-footprint.js?v=3bb31c2b0119d0819fb38cd81c6202ed8ba2819a';
// Stable room-local furnishing recipes; scene construction stays with the host.
const themes={crypt:['tomb','cabinet','drawers','chest'],library:['bookshelf','cabinet','drawers','bookshelf'],barracks:['barrel','drawers','cabinet','chest'],flooded:['basin','barrel','crate','chest']};
const heights={tomb:1.1,cabinet:1.9,drawers:1.05,chest:.9,bookshelf:2.1,barrel:1.1,basin:.8,crate:.95};
export function planFurnishings(room,{theme='crypt',seed=''}={}){
 if(!room||![room.x,room.z,room.w,room.h].every(Number.isInteger)||room.w<2||room.h<2)return [];
 const id=[room.x,room.z,room.w,room.h].join(':'),kinds=themes[theme]??themes.crypt;
 let hash=2166136261;for(const c of seed+':'+id)hash=Math.imul(hash^c.charCodeAt(0),16777619);
 if(LARGE_ROOM_SHAPES.includes(room.footprint?.shape)){
  const edges=roomPerimeter(room),directions=[[0,-1],[1,0],[0,1],[-1,0]],used=new Set(),recipes=[];
  // Furnish each wing against its actual wall, leaving the central crossing open.
  // Cell-relative offsets keep large props inside the usable mask, not cut corners.
  for(let d=0;d<4;d++){
   const choices=edges.filter(p=>p.d===d&&!used.has(p.row*room.w+p.col));
   choices.sort((a,b)=>Math.abs(a.col-(room.w-1)/2)+Math.abs(a.row-(room.h-1)/2)-(Math.abs(b.col-(room.w-1)/2)+Math.abs(b.row-(room.h-1)/2))||a.row-b.row||a.col-b.col);
   const p=choices[0];if(!p)continue;used.add(p.row*room.w+p.col);
   const kind=kinds[(d+(hash>>>0)%kinds.length)%kinds.length],[dx,dz]=directions[d];
   recipes.push({id:'room:'+id+':wing:'+d,kind,height:heights[kind],col:p.col,row:p.row,offsetX:p.col+dx*.18,offsetZ:p.row+dz*.18});
  }
  return recipes;
 }
 const columns=room.w>=5?[0,1,room.w-2,room.w-1]:[0,room.w-1];
 return columns.map((col,i)=>{const kind=kinds[(i+(hash>>>0)%kinds.length)%kinds.length];return {id:'room:'+id+':'+col,kind,height:heights[kind],col,row:0,offsetZ:.35};});
}
