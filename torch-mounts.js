const DIRS=[[0,-1],[1,0],[0,1],[-1,0]];
const key=(a,b)=>Math.min(a,b)+':'+Math.max(a,b);
/** Conservative wall mounting: inset into a real masonry edge, never an
 * authored arch/door, ingress tile or secret/moving panel. No renderer needed. */
export function wallTorchMountAllowed({position,normal,size,moduleSize=4.8,grid,tiles,architecture,edgeAt=()=>null,entrances=[],secrets=[]}){
 if(!position||!normal||![position.x,position.z,normal.x,normal.z].every(Number.isFinite)||!Number.isInteger(size)||size<1||!Number.isFinite(moduleSize)||moduleSize<=0||!Array.isArray(grid)||!Array.isArray(tiles))return false;
 const nx=Math.abs(normal.x)>.9?Math.sign(normal.x):0,nz=Math.abs(normal.z)>.9?Math.sign(normal.z):0;if(Math.abs(nx)+Math.abs(nz)!==1)return false;
 const col=Math.floor((position.x+nx*.45)/moduleSize+size/2),row=Math.floor((position.z+nz*.45)/moduleSize+size/2);if(col<0||row<0||col>=size||row>=size)return false;
 const index=row*size+col,d=DIRS.findIndex(([x,z])=>x===-nx&&z===-nz),[dx,dz]=DIRS[d],neighbor=index+dx+dz*size,edgeKey=key(index,neighbor),cx=(col-(size-1)/2)*moduleSize,cz=(row-(size-1)/2)*moduleSize;
 if(Math.abs(nx?position.x-(cx-nx*moduleSize/2):position.z-(cz-nz*moduleSize/2))>.65)return false;
 const edge=edgeAt(index,d);if(edge?.door||edge?.passable||!edge&&tiles[grid[index]]?.s?.[d]!==0)return false;
 if((architecture?.doors??[]).some(p=>key(p.index,p.index+DIRS[p.d][0]+DIRS[p.d][1]*size)===edgeKey))return false;
 if(secrets.some(p=>p.edgeKey===edgeKey||p.index===index||p.index===neighbor))return false;
 return !entrances.some(p=>p.index===index||p.index===neighbor);
}

export function pruneUnsafeWallTorches(THREE,{torches,colliders,...context}){
 let removed=0;const position=new THREE.Vector3(),normal=new THREE.Vector3();
 for(let i=torches.length-1;i>=0;i--){const t=torches[i],fixture=t.sprite??t.f;if(!fixture?.userData.torchMount)continue;fixture.updateWorldMatrix(true,false);fixture.getWorldPosition(position);normal.set(0,0,1).transformDirection(fixture.matrixWorld);
  const index=Math.floor(position.z/context.moduleSize+context.size/2)*context.size+Math.floor(position.x/context.moduleSize+context.size/2),standingClear=!(context.entrances??[]).some(p=>p.index===index)&&(!context.floorSupported||context.floorSupported(position.x,position.z));
  if(fixture.userData.torchMount==='wall'?wallTorchMountAllowed({...context,position,normal}):standingClear)continue;
  fixture.userData.dispose?.();t.l?.removeFromParent();t.l?.dispose?.();torches.splice(i,1);removed++;
  for(let j=colliders.length-1;j>=0;j--)if(colliders[j].sprite===fixture)colliders.splice(j,1);
 }
 return removed;
}
