/** Room bounds stay x/z/w/h in global tile coordinates. Optional footprint
 * rows are room-local, north-to-south strings of 0/1, one character per cell.
 * No footprint means the original full rectangle; no Sets are serialized.
 */
export const ROOM_SHAPES=Object.freeze(['l','cross','t','clipped-corner']);
const bounds=r=>r&&[r.x,r.z,r.w,r.h].every(Number.isInteger)&&r.w>0&&r.h>0&&r.w<=128&&r.h<=128;
export function roomContainsCell(room,col,row){
 if(!bounds(room)||!Number.isInteger(col)||!Number.isInteger(row)||col<0||row<0||col>=room.w||row>=room.h)return false;
 const f=room.footprint;if(f===undefined)return true;
 return f?.version===1&&typeof f.rows?.[row]==='string'&&f.rows[row][col]==='1';
}
export function roomContainsTile(room,x,z){return bounds(room)&&roomContainsCell(room,x-room.x,z-room.z);}
export function roomCells(room){
 if(!bounds(room))return [];const cells=[];
 for(let row=0;row<room.h;row++)for(let col=0;col<room.w;col++)if(roomContainsCell(room,col,row))cells.push({x:room.x+col,z:room.z+row,col,row});
 return cells;
}
export function roomCellIndices(room,size){return roomCells(room).map(p=>p.z*size+p.x);}
export function roomContainsWorld(room,x,z,size,moduleSize=4.8){
 if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isInteger(size)||size<1||!Number.isFinite(moduleSize)||moduleSize<=0)return false;
 return roomContainsTile(room,Math.floor(x/moduleSize+size/2),Math.floor(z/moduleSize+size/2));
}
export function roomPerimeter(room){
 const edges=[],directions=[[0,-1],[1,0],[0,1],[-1,0]];
 for(const p of roomCells(room))for(let d=0;d<4;d++)if(!roomContainsCell(room,p.col+directions[d][0],p.row+directions[d][1]))edges.push({...p,d});
 return edges;
}
/** Occupied tile nearest the footprint centroid; rectangle ties preserve the
 * original floor(w/2),floor(h/2) center used for entry and staircase placement.
 */
export function roomCenterTile(room){
 const cells=roomCells(room);if(!cells.length)return null;
 const x=cells.reduce((sum,p)=>sum+p.x,0)/cells.length,z=cells.reduce((sum,p)=>sum+p.z,0)/cells.length,px=room.x+Math.floor(room.w/2),pz=room.z+Math.floor(room.h/2);
 cells.sort((a,b)=>(a.x-x)**2+(a.z-z)**2-((b.x-x)**2+(b.z-z)**2)||Math.abs(a.x-px)+Math.abs(a.z-pz)-Math.abs(b.x-px)-Math.abs(b.z-pz)||a.row-b.row||a.col-b.col);
 return {x:cells[0].x,z:cells[0].z};
}
export function validateRoomFootprint(room){
 if(!bounds(room))return false;if(room.footprint===undefined)return true;
 const f=room.footprint;if(!f||f.version!==1||!ROOM_SHAPES.includes(f.shape)||!Number.isInteger(f.rotation)||f.rotation<0||f.rotation>3||!Array.isArray(f.rows)||f.rows.length!==room.h||f.rows.some(row=>typeof row!=='string'||row.length!==room.w||!/^[01]+$/.test(row)))return false;
 const cells=roomCells(room);if(cells.length<7||cells.length>=room.w*room.h||f.rows.some(row=>!row.includes('1')))return false;
 if(Array.from({length:room.w},(_,col)=>f.rows.every(row=>row[col]==='0')).some(Boolean))return false;
 const occupied=new Set(cells.map(p=>p.row*room.w+p.col)),queue=[cells[0]],seen=new Set([queue[0].row*room.w+queue[0].col]);
 for(let head=0;head<queue.length;head++)for(const [dx,dz]of [[0,-1],[1,0],[0,1],[-1,0]]){
  const col=queue[head].col+dx,row=queue[head].row+dz,key=row*room.w+col;if(col>=0&&col<room.w&&row>=0&&row<room.h&&occupied.has(key)&&!seen.has(key)){seen.add(key);queue.push({col,row});}
 }
 if(seen.size!==cells.length)return false;
 // Every occupied cell belongs to at least one full 2×2 patch: no isolated
 // corners or one-cell necks masquerading as usable room space.
 return cells.every(p=>[-1,0].some(dx=>[-1,0].some(dz=>[0,1].every(x=>[0,1].every(z=>roomContainsCell(room,p.col+dx+x,p.row+dz+z))))));
}
export function makeRoomFootprint(room,shape,rotation=0){
 if(!bounds(room)||room.w<3||room.h<3||!ROOM_SHAPES.includes(shape))throw TypeError('Room shape requires valid bounds and a known shape.');
 const turns=((Math.trunc(rotation)%4)+4)%4;
 if(shape==='cross'&&Math.min(room.w,room.h)<4)shape='clipped-corner';
 const width=turns%2?room.h:room.w,height=turns%2?room.w:room.h;
 const stem=Math.max(2,Math.floor(width/2)),band=Math.max(2,Math.floor(height/2)),left=Math.floor((width-stem)/2),top=Math.floor((height-band)/2),clip=Math.min(2,Math.floor((Math.min(width,height)-1)/2));
 let rows=Array.from({length:height},(_,z)=>Array.from({length:width},(_,x)=>{
  if(shape==='l')return !(x>=width-Math.floor(width/2)&&z<Math.floor(height/2));
  if(shape==='cross')return x>=left&&x<left+stem||z>=top&&z<top+band;
  if(shape==='t')return z<band||x>=left&&x<left+stem;
  return x+z>=clip;
 }));
 for(let q=0;q<turns;q++)rows=Array.from({length:rows[0].length},(_,z)=>Array.from({length:rows.length},(_,x)=>rows[rows.length-1-x][z]));
 const footprint={version:1,shape,rotation:turns,rows:rows.map(row=>row.map(v=>v?'1':'0').join(''))};
 if(!validateRoomFootprint({...room,footprint}))throw TypeError('Room shape would create an unusable footprint.');
 return footprint;
}
