import {moduleFloorContains} from './canal-module.js?v=651dfa860b2dae38e46f50e1c461f45d3145b8c8';

// Water sockets describe the channel, not the dry banks on either side of it.
export function canTraverseSurfaceEdge({grid,tiles,size,from,to,x,z,radius=.18,tileSize=4.8,edge=null,open=new Set()}){
 if(from<0||to<0||from>=grid.length||to>=grid.length)return false;
 if(from===to)return true;
 const dx=to%size-from%size,dz=Math.floor(to/size)-Math.floor(from/size),directions=[[0,-1],[1,0],[0,1],[-1,0]],d=directions.findIndex(([a,b])=>a===dx&&b===dz);
 if(d<0)return false;
 if(edge)return !!edge.passable&&(!edge.door||open.has(edge.key));
 const a=tiles[grid[from]],b=tiles[grid[to]];
 if(a.s[d]===1&&b.s[(d+2)%4]===1)return true;
 if(a.s[d]!==2||b.s[(d+2)%4]!==2)return false;
 const cx=(from%size-(size-1)/2)*tileSize,cz=(Math.floor(from/size)-(size-1)/2)*tileSize,bx=dx?cx+dx*tileSize/2:x,bz=dz?cz+dz*tileSize/2:z,scale=tileSize/2.4;
 const dry=(i,wx,wz)=>moduleFloorContains({sockets:tiles[grid[i]].s,x:(wx-(i%size-(size-1)/2)*tileSize)/scale,z:(wz-(Math.floor(i/size)-(size-1)/2)*tileSize)/scale});
 for(const offset of [-radius,0,radius]){const wx=bx+(dz?offset:0),wz=bz+(dx?offset:0);if(!dry(from,wx-dx*.005,wz-dz*.005)||!dry(to,wx+dx*.005,wz+dz*.005))return false;}
 return true;
}
