import {roomPerimeter} from './room-footprint.js?v=1d78ea79feefea23b13aa344fdb80a6c28d88fec';
import {wallTorchMountAllowed} from './torch-mounts.js?v=1d78ea79feefea23b13aa344fdb80a6c28d88fec';
import {tagTextureDensity,applyPhysicalUVs} from './pixel-density.js?v=1d78ea79feefea23b13aa344fdb80a6c28d88fec';

const DIRS=[[0,-1],[1,0],[0,1],[-1,0]],LIMITS={low:2,medium:3,high:4};
function random(seed){let n=2166136261;for(const c of String(seed))n=Math.imul(n^c.charCodeAt(0),16777619);return()=>{n|=0;n=n+0x6d2b79f5|0;let t=Math.imul(n^n>>>15,1|n);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

/** A few roof-attached clusters, not a room-wide particle field. Each cluster
 * is one opaque mesh with a conservative static-culling sphere. Animation only
 * changes its preallocated position buffer at 8Hz; CPU work is hard bounded. */
export function createCeilingAtmosphere(THREE){
 const root=new THREE.Group();root.name='ceiling-damp-details';root.userData.atmosphere=true;
 let patches=[],material=null,map=null,elapsed=0,lastFrame=-1,disposed=false;
 function retire(){for(const p of patches)p.mesh.geometry.dispose();patches=[];root.clear();material?.dispose();map?.dispose();material=null;map=null;root.userData.drawCalls=0;root.userData.patchCount=0;}
 root.userData.disposeMaterials=retire;
 function build({architecture,size,moduleSize=4.8,seed='ceiling-damp',quality='medium',ceiling,grid,tiles,edgeAt,entrances=[],secrets=[],groundHeight=()=>0}={}){
  retire();elapsed=0;lastFrame=-1;if(disposed||!ceiling?.isObject3D||!Number.isInteger(size)||size<1||quality==='off'||quality===false)return root;
  const rng=random(seed),anchors=[],ray=new THREE.Raycaster(),up=new THREE.Vector3(0,1,0),rooms=[...(architecture?.rooms??[])].slice(0,24).map(room=>({room,rank:rng()})).sort((a,b)=>a.rank-b.rank),limit=LIMITS[quality]??LIMITS.medium;
  ceiling.updateWorldMatrix(true,true);
  for(const {room}of rooms){if(anchors.length>=limit)break;const edges=roomPerimeter(room).map(edge=>({...edge,rank:rng()})).sort((a,b)=>a.rank-b.rank);
   for(const edge of edges){const [dx,dz]=DIRS[edge.d],normal={x:-dx,z:-dz},position={x:(edge.x-(size-1)/2)*moduleSize+dx*(moduleSize/2-.08),z:(edge.z-(size-1)/2)*moduleSize+dz*(moduleSize/2-.08)};
    if(!wallTorchMountAllowed({position,normal,size,moduleSize,architecture,grid,tiles,edgeAt,entrances,secrets}))continue;
    const x=position.x+normal.x*.3,z=position.z+normal.z*.3,ground=Number(groundHeight(x,z));if(!Number.isFinite(ground))continue;
    ray.set(new THREE.Vector3(x,ground+1.8,z),up);ray.far=24;const hit=ray.intersectObject(ceiling,true)[0];if(!hit||hit.point.y-ground<2.3)continue;
    anchors.push({x,y:hit.point.y-.025,z,normal,ground,phase:rng()*Math.PI*2});break;
   }
  }
  if(!anchors.length)return root;
  const pixels=new Uint8Array(16*16*4);for(let y=0;y<16;y++)for(let x=0;x<16;x++){const v=(Math.floor(x/3)+Math.floor(y/4))%3===0?203:237;pixels.set([v,v,v,255],(y*16+x)*4);}
  map=new THREE.DataTexture(pixels,16,16);map.colorSpace=THREE.SRGBColorSpace;map.minFilter=map.magFilter=THREE.NearestFilter;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.generateMipmaps=false;map.needsUpdate=true;tagTextureDensity(map,[.25,.25]);
  material=new THREE.MeshStandardMaterial({map,vertexColors:true,roughness:.96,metalness:0,flatShading:true});material.name='ceiling-roots-silk-damp';
  for(const a of anchors){
   const values=[],normals=[],colors=[],uvs=[],parts=[];const tint=new THREE.Color();
   function add(geometry,color,kind,center=null){const raw=geometry.index?geometry.toNonIndexed():geometry;if(raw!==geometry)geometry.dispose();const first=values.length/3,p=raw.attributes.position,n=raw.attributes.normal;tint.setHex(color);for(let i=0;i<p.count;i++){values.push(p.getX(i),p.getY(i),p.getZ(i));normals.push(n.getX(i),n.getY(i),n.getZ(i));colors.push(tint.r,tint.g,tint.b);uvs.push(0,0);}parts.push({first,count:p.count,kind,center});raw.dispose();}
   function beam(from,to,r,color,kind){const start=new THREE.Vector3(...from),end=new THREE.Vector3(...to),delta=end.clone().sub(start),g=new THREE.CylinderGeometry(r*.7,r,delta.length(),5);g.applyMatrix4(new THREE.Matrix4().compose(start.add(end).multiplyScalar(.5),new THREE.Quaternion().setFromUnitVectors(up,delta.normalize()),new THREE.Vector3(1,1,1)));add(g,color,kind);}
   // A creeping roof root branches into two short hanging tendrils.
   const path=[[-.9,0,.1],[-.48,-.025,.05],[0,-.06,.08],[.16,-.42,.14],[.08,-.85,.17],[.22,-1.28,.2]];
   for(let i=1;i<path.length;i++)beam(path[i-1],path[i],.024-i*.002,0x514f36,'root');beam(path[3],[.45,-.65,.18],.011,0x47492f,'root');beam([.45,-.65,.18],[.54,-.94,.22],.008,0x47492f,'root');
   // Open strand geometry has real depth/sag, with no billboard web card.
   const fringe=[[-.92,-.2,.08],[-.65,-.56,.15],[-.22,-.7,.2],[.18,-.58,.17],[.48,-.26,.08]];
   for(const p of fringe)beam([0,-.02,0],p,.0065,0x999584,'web');for(let i=1;i<fringe.length;i++)beam(fringe[i-1],fringe[i],.005,0x8e8b7e,'web');
   for(let i=0;i<3;i++){const g=new THREE.BoxGeometry(.025+i*.009,.65+i*.28,.012);g.translate(-.42+i*.15,-.95-i*.12,-.265);add(g,0x31382e,'wet');}
   const dropCenter=[-.23,-.1,.16],drop=new THREE.SphereGeometry(.018,4,3);drop.scale(.55,1.7,.55);drop.translate(...dropCenter);add(drop,0x78847a,'drip',dropCenter);
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(values,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));applyPhysicalUVs(g,material);g.computeBoundingBox();g.boundingBox.expandByPoint(new THREE.Vector3(dropCenter[0],a.ground-a.y,dropCenter[2]));g.boundingBox.expandByScalar(.15);g.boundingSphere=g.boundingBox.getBoundingSphere(new THREE.Sphere());
   const mesh=new THREE.Mesh(g,material);mesh.name='local-ceiling-damp-cluster';mesh.position.set(a.x,a.y,a.z);mesh.rotation.y=Math.atan2(a.normal.x,a.normal.z);Object.assign(mesh.userData,{ownGeometry:true,staticBatch:true,atmosphere:true,ceilingDetails:['root','web','wet','drip']});root.add(mesh);patches.push({mesh,base:new Float32Array(values),parts,phase:a.phase,fall:Math.max(1,a.y-a.ground)});
  }
  root.userData.drawCalls=patches.length;root.userData.patchCount=patches.length;return root;
 }
 function tick(dt,{paused=false,visible=true}={}){if(disposed||paused||!visible)return;elapsed+=Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0;const frame=Math.floor(elapsed*8);if(frame===lastFrame)return;lastFrame=frame;
  for(const p of patches){const attribute=p.mesh.geometry.attributes.position,data=attribute.array;data.set(p.base);for(const part of p.parts)for(let i=part.first;i<part.first+part.count;i++){const at=i*3;if(part.kind==='root'||part.kind==='web'){const depth=Math.max(0,-p.base[at+1]);data[at]+=Math.sin(elapsed*.32+p.phase)*Math.min(.045,depth*.035);data[at+2]+=Math.cos(elapsed*.27+p.phase)*Math.min(.03,depth*.025);}else if(part.kind==='drip'){const phase=(elapsed+p.phase)%9,fall=phase<.8?Math.pow(phase/.8,2)*p.fall:0,scale=phase<.8?1:0;for(let axis=0;axis<3;axis++)data[at+axis]=part.center[axis]+(p.base[at+axis]-part.center[axis])*scale;data[at+1]-=fall;}}attribute.needsUpdate=true;}
 }
 return {root,build,tick,dispose(){if(disposed)return;retire();disposed=true;root.removeFromParent();}};
}
