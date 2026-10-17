export const DIRS=[[0,-1],[1,0],[0,1],[-1,0]];
export const tiles=[{s:[0,0,0,0],weight:.32}];
for(let mask=1;mask<16;mask++){
 const s=DIRS.map((_,d)=>(mask>>d)&1),n=s.reduce((a,b)=>a+b,0);
 tiles.push({s,weight:n===1?.4:n===2?2.5:n===3?1.4:.7});
 for(let a=0;a<4;a++)for(let b=a+1;b<4;b++)if(s[a]&&s[b]){const c=[...s];c[a]=c[b]=2;tiles.push({s:c,weight:.14});}
}
export function random(seed){let a=2166136261;for(const c of String(seed))a=Math.imul(a^c.charCodeAt(0),16777619);return()=>{a+=0x6d2b79f5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export function coherentCanalTile(tile){if(tile.recipe||tile.catalogKey||!tile.s.includes(2)||!tile.s.includes(1))return true;return tile.s.filter(s=>s===2).length===2&&tile.s.filter(s=>s===1).length===2&&(tile.s[0]===2&&tile.s[2]===2||tile.s[1]===2&&tile.s[3]===2);}
export function solve(size,seed,fixed=null){
 const rng=random(seed),history=[];let nodes=0;
 let cells=Array.from({length:size*size},(_,i)=>tiles.map((_,t)=>t).filter(t=>(coherentCanalTile(tiles[t])||(Array.isArray(fixed)?fixed:fixed?[fixed]:[]).some(pin=>pin.index===i&&pin.tile===t))&&DIRS.every(([dx,dz],d)=>{const x=i%size+dx,z=Math.floor(i/size)+dz;return x>=0&&z>=0&&x<size&&z<size||tiles[t].s[d]===0;})));
 if(fixed)for(const pin of Array.isArray(fixed)?fixed:[fixed]){cells[pin.index]=cells[pin.index].filter(t=>(!pin.dry||!tiles[t].s.includes(2))&&(pin.tile!==undefined?t===pin.tile:pin.sockets.every((s,d)=>s===null||tiles[t].s[d]===s)));if(!cells[pin.index].length)throw Error('Pinned tile conflicts with boundaries or room constraints');}
 function propagate(c,queue){while(queue.length){const i=queue.pop(),x=i%size,z=Math.floor(i/size);for(let d=0;d<4;d++){const [dx,dz]=DIRS[d],xx=x+dx,zz=z+dz;if(xx<0||zz<0||xx>=size||zz>=size)continue;const j=zz*size+xx,allowed=new Set(c[i].map(t=>tiles[t].s[d])),next=c[j].filter(t=>allowed.has(tiles[t].s[(d+2)%4]));if(!next.length)return false;if(next.length!==c[j].length){c[j]=next;queue.push(j);}}}return true;}
 function search(c){if(++nodes>12000)return null;let best=-1,min=Infinity;for(let i=0;i<c.length;i++)if(c[i].length>1){const e=c[i].length+rng()*.3;if(e<min){best=i;min=e;}}if(best<0)return c;
 const options=c[best].map(t=>({t,key:-Math.log(Math.max(.00001,rng()))/tiles[t].weight})).sort((a,b)=>a.key-b.key);
 for(const {t} of options){const next=c.map(v=>[...v]);next[best]=[t];const mark=history.length;if(propagate(next,[best])){history.push({index:best,tile:t,resolved:next.filter(v=>v.length===1).length});const result=search(next);if(result)return result;}history.length=mark;}return null;}
 if(!propagate(cells,cells.map((_,i)=>i)))throw Error('Invalid boundary constraints');let result=search(cells);if(!result){const dry=cells.map(options=>options.filter(t=>!tiles[t].s.includes(2)));if(dry.every(options=>options.length)){nodes=0;history.length=0;if(propagate(dry,dry.map((_,i)=>i)))result=search(dry);}}if(!result)throw Error('No solution found. Try a different seed.');return {grid:result.map(c=>c[0]),history,nodes};
}
export function component(grid,size){let largest=[];const seen=new Set();for(let i=0;i<grid.length;i++){if(seen.has(i)||!tiles[grid[i]].s.some(s=>s===1))continue;const group=[],q=[i];seen.add(i);while(q.length){const v=q.pop();group.push(v);for(let d=0;d<4;d++){if(tiles[grid[v]].s[d]!==1)continue;const [dx,dz]=DIRS[d],x=v%size+dx,z=Math.floor(v/size)+dz,j=z*size+x;if(x>=0&&z>=0&&x<size&&z<size&&!seen.has(j)&&tiles[grid[j]].s[(d+2)%4]===1){seen.add(j);q.push(j);}}}if(group.length>largest.length)largest=group;}return largest;}
