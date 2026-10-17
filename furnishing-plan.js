// Stable room-local furnishing recipes; scene construction stays with the host.
const themes={crypt:['tomb','cabinet','drawers','chest'],library:['bookshelf','cabinet','drawers','bookshelf'],barracks:['barrel','drawers','cabinet','chest'],flooded:['basin','barrel','crate','chest']};
const heights={tomb:1.1,cabinet:1.9,drawers:1.05,chest:.9,bookshelf:2.1,barrel:1.1,basin:.8,crate:.95};
export function planFurnishings(room,{theme='crypt',seed=''}={}){
 if(!room||![room.x,room.z,room.w,room.h].every(Number.isInteger)||room.w<2||room.h<2)return [];
 const id=[room.x,room.z,room.w,room.h].join(':'),kinds=themes[theme]??themes.crypt;
 let hash=2166136261;for(const c of seed+':'+id)hash=Math.imul(hash^c.charCodeAt(0),16777619);
 const columns=room.w>=5?[0,1,room.w-2,room.w-1]:[0,room.w-1];
 return columns.map((col,i)=>{const kind=kinds[(i+(hash>>>0)%kinds.length)%kinds.length];return {id:'room:'+id+':'+col,kind,height:heights[kind],col,row:0,offsetZ:.35};});
}
