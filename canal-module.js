const DIRS=[[0,-1],[1,0],[0,1],[-1,0]];
const EDGES=[-1.2,-.4,.4,1.2];
const CENTERS=[-.8,0,.8];
const validSockets=sockets=>Array.isArray(sockets)&&sockets.length===4&&sockets.every(s=>[0,1,2].includes(s));
function wetCells(sockets,pit){const wet=new Set();if(sockets.includes(2)){if(!pit)wet.add('1:1');for(let d=0;d<4;d++)if(sockets[d]===2){const [dx,dz]=DIRS[d];wet.add((1+dx)+':'+(1+dz));}}return wet;}
function supportBounds(a,b,pit){return [Math.max(-1.2,EDGES[a]-(pit&&a===2?0:.00025)),Math.min(1.2,EDGES[a+1]+(pit&&a===0?0:.00025)),Math.max(-1.2,EDGES[b]-(pit&&b===2?0:.00025)),Math.min(1.2,EDGES[b+1]+(pit&&b===0?0:.00025))];}
function bankBounds(wet,sockets,pit){
 const result=[];
 for(const cell of wet){const [a,b]=cell.split(':').map(Number),left=EDGES[a],right=EDGES[a+1],near=EDGES[b],far=EDGES[b+1];
  for(let d=0;d<4;d++){
   const [dx,dz]=DIRS[d],aa=a+dx,bb=b+dz;if(wet.has(aa+':'+bb))continue;
   const outside=aa<0||aa>2||bb<0||bb>2;if(outside&&sockets[d]===2)continue;
   const inset=pit&&aa===1&&bb===1?.03:0,x=(dx?(dx<0?left:right):(left+right)/2)-dx*inset,z=(dz?(dz<0?near:far):(near+far)/2)-dz*inset,w=dx?.06:right-left,depth=dz?.06:far-near;
   result.push([x-w/2,x+w/2,z-depth/2,z+depth/2]);
  }
 }
 return result;
}
function bridgeBounds(sockets,pit){
 const result=[];if(!sockets.includes(2)||!sockets.includes(1))return result;
 // Only span the channel. Dry approach cells already have solid masonry;
 // full-length raised arms read as floating boards and needlessly cover them.
 if(!pit&&sockets[0]===2&&sockets[2]===2&&sockets[1]===1&&sockets[3]===1)return [[-.62,.62,-.43,.43]];
 if(!pit&&sockets[1]===2&&sockets[3]===2&&sockets[0]===1&&sockets[2]===1)return [[-.43,.43,-.62,.62]];
 if(!pit)result.push([-.43,.43,-.43,.43]);
 for(let d=0;d<4;d++)if(sockets[d]===1){const [dx,dz]=DIRS[d],x=dx*.51,z=dz*.51,w=dx?.22:.86,depth=dz?.22:.86;result.push([x-w/2,x+w/2,z-depth/2,z+depth/2]);}
 return result;
}
const inBounds=(x,z,[left,right,near,far])=>x>=left&&x<=right&&z>=near&&z<=far;

// Point support query using the exact same footprints as rendered mortar,
// banks and bridge decks. The host may probe more points for an avatar radius.
export function moduleFloorContains({sockets,x,z,pit=false,pitHalfSize=.4}){
 if(!validSockets(sockets)||!Number.isFinite(x)||!Number.isFinite(z)||typeof pit!=='boolean'||!Number.isFinite(pitHalfSize)||pitHalfSize<.4||pitHalfSize>.9||x< -1.2||x>1.2||z< -1.2||z>1.2)return false;
 if(pit&&pitHalfSize>.4&&sockets.every(v=>v===1))return !(Math.abs(x)<pitHalfSize&&Math.abs(z)<pitHalfSize);
 if(pit&&Math.abs(x)<.4&&Math.abs(z)<.4)return false;
 const wet=wetCells(sockets,pit);
 for(let a=0;a<3;a++)for(let b=0;b<3;b++)if(!(pit&&a===1&&b===1)&&!wet.has(a+':'+b)&&inBounds(x,z,supportBounds(a,b,pit)))return true;
 return bridgeBounds(sockets,pit).some(bounds=>inBounds(x,z,bounds))||bankBounds(wet,sockets,pit).some(bounds=>inBounds(x,z,bounds));
}

// Local 2.4 m floor only; the host scales X/Z to its 4.8 m world module.
// All meshes are direct children of `group`. Box parts use the supplied shared
// geometry; small owned top surfaces seal the bevels at exact module corners.
export function buildModuleFloor({THREE,group,box,mat,sockets,floorStyle='flagstone',surfaceMaps,waterMaterial,seed='module',pit=false,pitHalfSize=.4}){
 if(!THREE||!group||typeof box!=='function'||typeof mat!=='function')throw TypeError('Module floor needs THREE, group, box, and mat.');
 if(!validSockets(sockets))throw TypeError('Module floor needs four typed sockets.');
 if(!['flagstone','mosaic','timber'].includes(floorStyle))throw RangeError('Unknown module floor style.');
 if(typeof pit!=='boolean')throw TypeError('Pit must be a boolean.');
 if(!Number.isFinite(pitHalfSize)||pitHalfSize<.4||pitHalfSize>.9)throw RangeError('Invalid pit opening.');
 const hasWater=sockets.includes(2),waterCount=sockets.filter(s=>s===2).length;
 const meshes=[],pavers=[],water=[],beds=[],banks=[],bridges=[],backing=[],foundations=[],surfaces=[];
 const foundationMaterial=mat('module-foundation',0x302c26),mortar=mat('module-floor-mortar',0x454337);
 const maps=surfaceMaps?.[floorStyle],floor=mat('paver-'+floorStyle,0xd9d1c1,maps?{map:maps,bumpMap:maps,bumpScale:.04}:{});
 const bank=hasWater?mat('stone-canal-bank',0x817c6b):null,bed=hasWater?mat('stone-canal-bed',0x3b4035):null;
 const bridgeStone=hasWater&&sockets.includes(1)?mat('stone-canal-bridge',0x898577,{roughness:.97}):null;
 let waterSurface=null;
 if(hasWater){
  waterSurface=waterMaterial??mat('module-canal-water',0x37676a,{roughness:.27,metalness:.15,...(surfaceMaps?.water?{map:surfaceMaps.water}:{})});
  // Shallow water should read as an opaque surface above a sealed basin, never
  // as a transparent hole into the foundation. Preserve the host's flowing map.
  if(waterSurface.transparent||waterSurface.opacity!==1||!waterSurface.depthWrite){waterSurface.transparent=false;waterSurface.opacity=1;waterSurface.depthWrite=true;waterSurface.needsUpdate=true;}
 }
 function add(role,x,y,z,w,h,d,material,list){
  const mesh=box(group,x,y,z,w,h,d,material);mesh.userData.moduleFloorPart=role;mesh.castShadow=role!=='water';mesh.receiveShadow=true;
  meshes.push(mesh);list?.push(mesh);return mesh;
 }
 function topSurface(rectangles,y,material,role,list){
  if(!rectangles.length)return;
  const positions=[],normals=[],uv=[];
  for(const [left,right,near,far]of rectangles)for(const [x,z]of [[left,near],[left,far],[right,far],[left,near],[right,far],[right,near]]){positions.push(x,y,z);normals.push(0,1,0);uv.push((x+1.2)/2.4,(z+1.2)/2.4);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeBoundingBox();geo.computeBoundingSphere();
  const mesh=new THREE.Mesh(geo,material);mesh.userData.ownGeometry=true;mesh.userData.moduleFloorPart=role;mesh.castShadow=false;mesh.receiveShadow=true;group.add(mesh);meshes.push(mesh);surfaces.push(mesh);list?.push(mesh);
 }
 function stoneArches(){
  // Each water-facing side of the shared central landing has a real segmental
  // opening. Piers sit on the sealed basin; the crown joins the stone deck.
  // All facades stay inside the same supported footprint used by navigation.
  const shape=new THREE.Shape();shape.moveTo(-.43,.10);shape.lineTo(.43,.10);shape.lineTo(.43,-.36);shape.lineTo(.32,-.36);shape.lineTo(.32,-.30);
  for(let j=1;j<=20;j++){const x=.32-.64*j/20,y=-.30+.255*Math.sqrt(Math.max(0,1-(x/.32)**2));shape.lineTo(x,y);}
  shape.lineTo(-.32,-.36);shape.lineTo(-.43,-.36);shape.closePath();
  const source=new THREE.ExtrudeGeometry(shape,{depth:.08,steps:1,bevelEnabled:false,curveSegments:1});source.translate(0,0,-.04);
  const positions=[],normals=[],uv=[];
  for(let d=0;d<4;d++)if(sockets[d]===2){
   const [dx,dz]=DIRS[d],part=source.clone();if(dx)part.rotateY(Math.PI/2);part.translate(dx*.37,0,dz*.37);
   const p=part.attributes.position,n=part.attributes.normal;
   for(let j=0;j<p.count;j++){const x=p.getX(j),y=p.getY(j),z=p.getZ(j),nx=n.getX(j),ny=n.getY(j),nz=n.getZ(j);positions.push(x,y,z);normals.push(nx,ny,nz);uv.push((Math.abs(nx)>.5?z:x)/2.4,(Math.abs(ny)>.5?z:y)/2.4);}
   part.dispose();
  }
  source.dispose();
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const mesh=new THREE.Mesh(geometry,bridgeStone);mesh.userData.ownGeometry=true;mesh.userData.moduleFloorPart='bridge-arch';mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);meshes.push(mesh);bridges.push(mesh);
  // Ankle-low coping follows only water-facing edges. It is a step-over
  // detail (6 cm above the deck), never a non-colliding full-height railing.
  for(let d=0;d<4;d++)if(sockets[d]===2){const [dx,dz]=DIRS[d],curb=add('bridge-coping',dx*.395,.171,dz*.395,dx?.06:.86,.06,dz?.06:.86,bridgeStone,bridges);curb.userData.stepOver=true;}
 }
 // Large dry trap pits retain a supported rim while opening a 3.2m square
 // in the production 4.8m tile. Legacy canal/pit masks keep their .4m opening.
 if(pit&&pitHalfSize>.4&&sockets.every(v=>v===1)){
  const h=pitHalfSize;
  for(const [l,r,n,f]of [[-1.2,-h,-1.2,1.2],[h,1.2,-1.2,1.2],[-h,h,-1.2,-h],[-h,h,h,1.2]]){
   add('foundation',(l+r)/2,-.7,(n+f)/2,r-l,.6,f-n,foundationMaterial,foundations);
   add('backing',(l+r)/2,-.1625,(n+f)/2,r-l,.475,f-n,mortar,backing);
   add('paver',(l+r)/2,-.17,(n+f)/2,r-l,.54,f-n,floor,pavers);
  }
  return {group,meshes,foundation:foundations[0],foundations,pavers,water,beds,banks,bridges,backing,surfaces,pit,waterMaterial:waterSurface,canalKind:'none'};
 }
 if(!pit)add('foundation',0,-.7,0,2.4,.6,2.4,foundationMaterial,foundations);
 else for(let a=0;a<3;a++)for(let b=0;b<3;b++)if(a!==1||b!==1)add('foundation',CENTERS[a],-.7,CENTERS[b],.8,.6,.8,foundationMaterial,foundations);
 const wet=wetCells(sockets,pit);
 const dryTops=[],waterTops=[];
 let grain=2166136261;for(const c of String(seed))grain=Math.imul(grain^c.charCodeAt(0),16777619);
 for(let a=0;a<3;a++)for(let b=0;b<3;b++){
  if(pit&&a===1&&b===1)continue;
  const left=EDGES[a],right=EDGES[a+1],near=EDGES[b],far=EDGES[b+1],x=(left+right)/2,z=(near+far)/2;
  if(wet.has(a+':'+b)){
   // Basin bottom seals each arm over the continuous foundation at y=-.4.
   add('bed',x,-.3825,z,right-left,.035,far-near,bed,beds);
   waterTops.push([left,right,near,far]);
  }else{
   // Recessed mortar backs narrow paver joints, keeping walking routes dry and
   // supported rather than exposing a half-meter crack to the foundation.
   const [supportLeft,supportRight,supportNear,supportFar]=supportBounds(a,b,pit);
   dryTops.push([supportLeft,supportRight,supportNear,supportFar]);
   add('backing',(supportLeft+supportRight)/2,-.1625,(supportNear+supportFar)/2,supportRight-supportLeft,.475,supportFar-supportNear,mortar,backing);
   const paver=add('paver',CENTERS[a],-.17,CENTERS[b],.76,.54,.76,floor,pavers);
   if(floorStyle!=='timber')paver.rotation.y=((grain>>>((a*3+b)%16))&1)*Math.PI;
  }
 }
 // Outline the wet union, leaving only actual water sockets open. Decks then
 // join every passage arm above the water without closing its flowing surface.
 const bankTops=bankBounds(wet,sockets,pit),bridgeTops=bridgeBounds(sockets,pit);
 for(const [left,right,near,far]of bankTops)add('bank',(left+right)/2,-.15,(near+far)/2,right-left,.5,far-near,bank,banks);
 for(const [left,right,near,far]of bridgeTops)add('bridge',(left+right)/2,.10,(near+far)/2,right-left,.08,far-near,bridgeStone,bridges);
 if(bridgeTops.length&&!pit)stoneArches();
 // The host's box is beveled: touching box corners alone can leave pinholes.
 // Flat, continuous top faces close those pinholes without changing shared box
 // geometry. Water remains recessed over its foundation rather than over a void.
 topSurface(dryTops,.0755,mortar,'backing-surface',backing);
 topSurface(waterTops,-.215,waterSurface,'water',water);
 topSurface(bankTops,.101,bank,'bank-surface',banks);
 topSurface(bridgeTops,.141,floor,'bridge-surface',bridges);
 return {group,meshes,foundation:foundations[0],foundations,pavers,water,beds,banks,bridges,backing,surfaces,pit,waterMaterial:waterSurface,canalKind:waterCount===0?'none':waterCount===1?'endcap':waterCount===2?(sockets[0]===2&&sockets[2]===2||sockets[1]===2&&sockets[3]===2?'straight':'bend'):waterCount===3?'junction':'crossing'};
}

