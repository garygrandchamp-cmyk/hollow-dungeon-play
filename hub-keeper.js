import {KEEPER_CELL,decodeKeeperCandidate} from './hub-keeper-data.js?v=1d78ea79feefea23b13aa344fdb80a6c28d88fec';

/** Root-accepted static counter keeper (2026-10-18). No gameplay authority.
 * Caller positions/rotates the root. No billboard, animation or per-frame work.
 */
export function makeKeeperCandidate(THREE,{height=1.7}={}){
 if(!Number.isFinite(height)||height<=0)throw new RangeError('Keeper body height must be positive');
 const root=new THREE.Group(),{data,width,height:rows}=decodeKeeperCandidate(),bottomUp=new Uint8Array(data.length),stride=width*4;
 for(let y=0;y<rows;y++)bottomUp.set(data.subarray(y*stride,(y+1)*stride),(rows-1-y)*stride);
 const map=new THREE.DataTexture(bottomUp,width,rows);map.name='private-keeper-reviewed-cell';map.flipY=false;map.colorSpace=THREE.SRGBColorSpace;map.minFilter=map.magFilter=THREE.NearestFilter;map.generateMipmaps=false;map.wrapS=map.wrapT=THREE.ClampToEdgeWrapping;map.needsUpdate=true;
 const material=new THREE.MeshBasicMaterial({map,alphaTest:.5,transparent:false,depthTest:true,depthWrite:true,fog:true,toneMapped:false,side:THREE.DoubleSide});
 const planeSize=height*KEEPER_CELL.height/KEEPER_CELL.bodyPixels,geometry=new THREE.PlaneGeometry(planeSize,planeSize);geometry.translate(0,planeSize*(KEEPER_CELL.footRow/KEEPER_CELL.height-.5),0);
 const mesh=new THREE.Mesh(geometry,material);mesh.name='private-keeper-static-cell';mesh.userData.ownGeometry=true;root.add(mesh);root.name='private-keeper-static-candidate';root.userData.privateCandidate=true;root.userData.bodyHeight=height;root.userData.bodyTexelsPerMetre=KEEPER_CELL.bodyPixels/height;root.userData.footRow=KEEPER_CELL.footRow;
 let disposed=false;root.userData.dispose=()=>{if(disposed)return;disposed=true;geometry.dispose();material.dispose();map.dispose();root.removeFromParent();};
 return root;
}
