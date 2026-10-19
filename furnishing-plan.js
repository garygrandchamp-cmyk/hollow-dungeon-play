import {LARGE_ROOM_SHAPES,roomPerimeter} from './room-footprint.js?v=637e9034956bdc32208d05c0403c280117b60bda';
// Stable room-local furnishing recipes; scene construction stays with the host.
const themes={crypt:['tomb','cabinet','drawers','chest'],library:['bookshelf','cabinet','drawers','bookshelf'],barracks:['barrel','drawers','cabinet','chest'],flooded:['basin','barrel','crate','chest']};
const heights={tomb:1.1,cabinet:1.9,drawers:1.05,chest:.9,bookshelf:2.1,barrel:1.1,basin:.8,crate:.95};
export const WALL_FURNISHINGS=Object.freeze(['bookshelf','cabinet','drawers']);
export function furnishingPlacement(recipe,{moduleSize=4.8,depth=.6,clearance=.08}={}){
 let x=(recipe.offsetX??recipe.col)*moduleSize,z=recipe.offsetZ*moduleSize,yaw=0;
 if(WALL_FURNISHINGS.includes(recipe.kind)&&Number.isInteger(recipe.wallDirection)){
  const d=recipe.wallDirection,[dx,dz]=[[0,-1],[1,0],[0,1],[-1,0]][d];
  x=recipe.col*moduleSize+dx*(moduleSize/2-depth/2-clearance);
  z=recipe.row*moduleSize+dz*(moduleSize/2-depth/2-clearance);
  yaw=[0,-Math.PI/2,Math.PI,Math.PI/2][d];
 }
 return {x,z,yaw};
}
function wallRecipes(room,recipes){
 const edges=roomPerimeter(room),used=new Set();
 return recipes.flatMap(recipe=>{
  if(!WALL_FURNISHINGS.includes(recipe.kind))return [recipe];
  const choices=edges.filter(p=>!used.has(p.row*room.w+p.col)).sort((a,b)=>Math.abs(a.col-recipe.col)+Math.abs(a.row-recipe.row)-Math.abs(b.col-recipe.col)-Math.abs(b.row-recipe.row)||a.d-b.d||a.row-b.row||a.col-b.col);
  const p=choices[0];if(!p)return [];used.add(p.row*room.w+p.col);
  return [{...recipe,col:p.col,row:p.row,offsetX:p.col,offsetZ:p.row,wallDirection:p.d}];
 });
}
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
  return wallRecipes(room,recipes);
 }
 const columns=room.w>=5?[0,1,room.w-2,room.w-1]:[0,room.w-1];
 return wallRecipes(room,columns.map((col,i)=>{const kind=kinds[(i+(hash>>>0)%kinds.length)%kinds.length];return {id:'room:'+id+':'+col,kind,height:heights[kind],col,row:0,offsetZ:.35};}));
}
