// Original procedural assets for Hollow. Physical coordinates are metres.
// No canvas, remote asset service, or renderer is needed to build this theme.
export const FROZEN_CAVERN = Object.freeze({id:'frozen-cavern',name:'Frozen Cavern',moduleSize:4.8,wallHeight:3.8,texelsPerMetre:64,textureSize:256,textureSpan:4,socketOrder:['north','east','south','west'],socketTypes:{wall:0,open:1,canal:2},floorVariants:['ice','rock','snow']});
export const FROZEN_PRESETS = Object.freeze({chamber:{name:'Sheltered cavern',sockets:[0,0,1,0]},crossroads:{name:'Open chamber',sockets:[1,1,1,1]},doorway:{name:'Carved ice arch',sockets:[0,0,1,0],doorway:true},canal:{name:'Frozen canal crossing',sockets:[2,1,2,1]},bend:{name:'Canal bend / no bridge',sockets:[2,2,0,0]}});
const HALF=2.4,HEIGHT=3.8,DIRS=[[0,-1],[1,0],[0,1],[-1,0]],EDGES=[-2.4,-.6,.6,2.4];
function rng(seed){let a=2166136261;for(const c of String(seed))a=Math.imul(a^c.charCodeAt(0),16777619);return()=>{a+=0x6d2b79f5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
function hash(x,y,s){let v=Math.imul(x+1949,374761393)^Math.imul(y+7919,668265263)^s;v=Math.imul(v^(v>>>13),1274126177);return((v^(v>>>16))>>>0)/4294967296;}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ramps={rock:[[28,32,36],[36,41,45],[44,50,54],[53,59,62],[63,69,72],[74,80,82],[88,93,94],[103,107,106]],ice:[[35,48,56],[47,62,70],[62,78,86],[77,94,101],[92,110,117],[109,127,132],[129,146,150],[151,166,168]],snow:[[54,63,66],[67,78,81],[81,92,95],[96,108,110],[114,125,126],[132,142,142],[150,158,155],[169,175,170]],water:[[8,20,25],[11,25,30],[15,30,36],[19,35,40],[24,41,46],[30,47,52],[39,57,61],[52,70,72]]};

/** A repeat covers exactly 4 m: 256 nearest-filtered texels / 4 = 64 texels/m. */
export function frozenTexturePixels(kind='rock',seed='frost'){
 if(!ramps[kind])throw RangeError('Unknown frozen material: '+kind);
 const random=rng(seed+':'+kind),salt=Math.floor(random()*0xffffffff),size=256,data=new Uint8Array(size*size*4),ramp=ramps[kind];
 const plates=Array.from({length:18},()=>({x:random()*size,y:random()*size,level:2+Math.floor(random()*3)}));
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  // Related two/four/eight-pixel clusters, not smooth photographic noise.
  const coarse=hash(x>>4,y>>4,salt),mid=hash(x>>2,y>>2,salt+13),fine=hash(x>>1,y>>1,salt+39),grain=hash(x,y,salt+97);
  let level=clamp(Math.floor(coarse*3+mid*1.4+fine*.7+(grain>.94?1:0)),0,7);
  if(kind==='ice'){
   let first=Infinity,second=Infinity,plate=plates[0];
   for(const site of plates){const dx=Math.min(Math.abs(x-site.x),size-Math.abs(x-site.x)),dy=Math.min(Math.abs(y-site.y),size-Math.abs(y-site.y)),d=Math.hypot(dx,dy);if(d<first){second=first;first=d;plate=site;}else if(d<second)second=d;}
   const edge=second-first;level=edge<.8?0:edge<1.8?5:plate.level+(fine>.85?1:0)+(grain>.985?1:0);
  }
  if(kind==='snow')level=clamp(3+Math.floor(coarse*2+mid*.7+(grain>.96?1:0)),0,7);
  if(kind==='water')level=clamp(Math.floor((Math.sin(y*.14+x*.025)+1)*1.2+mid*1.4+coarse),0,6);
  const rgb=ramp[level],i=(y*size+x)*4;data.set([...rgb,255],i);
 }
 const put=(x,y,level)=>{x=(x+size)%size;y=(y+size)%size;const i=(y*size+x)*4;data.set([...ramp[clamp(level,0,7)],255],i);};
 // Sparse branching fissures; every pixel remains opaque, including cracks.
 for(let n=0;n<(kind==='water'?16:kind==='snow'?6:kind==='ice'?8:34);n++){
  let x=Math.floor(random()*size),y=Math.floor(random()*size),dx=random()<.5?-1:1,dy=random()<.5?-1:1;
  const len=14+Math.floor(random()*65);
  for(let j=0;j<len;j++){put(x,y,kind==='ice'?1:0);if(kind==='ice'&&j%3!==0)put(x+1,y,5);if(random()<.7)x+=dx;if(random()<.6)y+=dy;if(random()<.07)dx=-dx;}
 }
 return {data,width:size,height:size,texelsPerMetre:64,spanMetres:4};
}

function makeBatch(THREE,material,group,role,uvOrigin){
 const positions=[],normals=[],uv=[];
 function tri(a,b,c){
  const ax=b[0]-a[0],ay=b[1]-a[1],az=b[2]-a[2],bx=c[0]-a[0],by=c[1]-a[1],bz=c[2]-a[2];
  let nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx,l=Math.hypot(nx,ny,nz)||1;nx/=l;ny/=l;nz/=l;
  for(const p of [a,b,c]){positions.push(...p);normals.push(nx,ny,nz);uv.push((Math.abs(nx)>.5?p[2]+uvOrigin[1]:p[0]+uvOrigin[0])/4,(Math.abs(ny)>.5?p[2]+uvOrigin[1]:p[1])/4);}
 }
 const quad=(a,b,c,d)=>{tri(a,b,c);tri(a,c,d);};
 function box(x,y,z,w,h,d){let a=x-w/2,b=x+w/2,c=y-h/2,e=y+h/2,f=z-d/2,g=z+d/2;
  quad([a,c,g],[b,c,g],[b,e,g],[a,e,g]);quad([b,c,f],[a,c,f],[a,e,f],[b,e,f]);quad([a,c,f],[a,c,g],[a,e,g],[a,e,f]);quad([b,c,g],[b,c,f],[b,e,f],[b,e,g]);quad([a,e,g],[b,e,g],[b,e,f],[a,e,f]);quad([a,c,f],[b,c,f],[b,c,g],[a,c,g]);
 }
 function finish(){if(!positions.length)return null;const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.computeBoundingBox();geometry.computeBoundingSphere();const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=role!=='water';mesh.receiveShadow=true;mesh.userData.frozenRole=role;group.add(mesh);return mesh;}
 return {tri,quad,box,finish};
}
const contains=(x,z,b)=>x>=b.minX&&x<=b.maxX&&z>=b.minZ&&z<=b.maxZ;
const rect=(a,b,c,d)=>({minX:a,maxX:b,minZ:c,maxZ:d});

/** Compose support across module seams before checking actual solid props.
 * placements = [{tile, x: worldOriginX, z: worldOriginZ}]. This deliberately
 * probes neighboring supports; a module edge is not a collision wall. */
export function frozenCanStand(placements,x,z,radius=.22,y=0){
 if(!Array.isArray(placements)||![x,z,radius,y].every(Number.isFinite)||radius<0)return false;
 for(const [dx,dz]of [[0,0],[-radius,0],[radius,0],[0,-radius],[0,radius]])if(!placements.some(p=>p.tile.supportHeight(x+dx-p.x,z+dz-p.z)!==null))return false;
 return !placements.some(p=>p.tile.blockers.some(b=>{
  if(y+1.7<=b.minY||y>=b.maxY)return false;const lx=x-p.x,lz=z-p.z;
  if(b.shape==='circle')return Math.hypot(lx-b.x,lz-b.z)<radius+b.radius;
  return lx+radius>b.minX&&lx-radius<b.maxX&&lz+radius>b.minZ&&lz-radius<b.maxZ;
 }));
}

/** Shared materials; tile geometries are owned/disposed by each tile. */
export function createFrozenCavernTheme(THREE,{seed='frost'}={}){
 if(!THREE?.DataTexture||!THREE?.BufferGeometry)throw TypeError('Frozen Cavern needs the THREE namespace.');
 const textures={},materials={},tiles=new Set();let disposed=false;
 for(const kind of Object.keys(ramps)){
  const p=frozenTexturePixels(kind,seed),texture=new THREE.DataTexture(p.data,p.width,p.height,THREE.RGBAFormat);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.magFilter=texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.colorSpace=THREE.SRGBColorSpace;texture.userData={texelsPerMetre:64,spanMetres:4};texture.needsUpdate=true;textures[kind]=texture;
  materials[kind]=new THREE.MeshStandardMaterial({map:texture,color:0xffffff,roughness:kind==='water'?.77:.96,metalness:0,side:THREE.DoubleSide});
 }
 // Opaque, rough ice. Highlights come from local light, not broad emissive cyan.
 const crystalMaterial=new THREE.MeshStandardMaterial({map:textures.ice,color:0x9baeb1,roughness:.78,metalness:0,side:THREE.DoubleSide});materials.crystal=crystalMaterial;
 function buildTile({sockets=[0,0,1,0],variant='ice',doorway=false,doorwayDirection=null,ceiling=false,decor=true,seed:tileSeed='tile',uvOrigin=[0,0]}={}){
  if(disposed)throw Error('Frozen theme is disposed.');
  if(!Array.isArray(sockets)||sockets.length!==4||sockets.some(s=>![0,1,2].includes(s)))throw TypeError('Sockets must be [north,east,south,west] with wall=0, open=1, canal=2.');
  if(!FROZEN_CAVERN.floorVariants.includes(variant))throw RangeError('Unknown frozen floor variant.');
  if(!Array.isArray(uvOrigin)||uvOrigin.length!==2||!uvOrigin.every(Number.isFinite))throw TypeError('uvOrigin must be [worldX, worldZ].');
  if(doorwayDirection!==null&&(!Number.isInteger(doorwayDirection)||doorwayDirection<0||doorwayDirection>3||sockets[doorwayDirection]!==1))throw RangeError('A doorway direction must select an open socket.');
  sockets=[...sockets];const random=rng(seed+':'+tileSeed),root=new THREE.Group(),blockers=[],supports=[],canals=[],bridges=[];
  root.name='Frozen cavern module';root.userData={theme:'frozen-cavern',sockets,footprint:rect(-HALF,HALF,-HALF,HALF),texelsPerMetre:64};
  const batches={};for(const [key,material]of Object.entries(materials))batches[key]=makeBatch(THREE,material,root,key,uvOrigin);
  const rock=batches.rock,ice=batches.ice,floor=batches[variant],crystal=batches.crystal;
  const wet=new Set();if(sockets.includes(2)){wet.add('1:1');for(let d=0;d<4;d++)if(sockets[d]===2){const [dx,dz]=DIRS[d];wet.add(`${1+dx}:${1+dz}`);}}
  // One sealed volume beneath each dry cell. Decorative fissures are texture,
  // never cracks through the floor into another room or the void.
  for(let a=0;a<3;a++)for(let b=0;b<3;b++){
   const r=rect(EDGES[a],EDGES[a+1],EDGES[b],EDGES[b+1]),x=(r.minX+r.maxX)/2,z=(r.minZ+r.maxZ)/2,w=r.maxX-r.minX,d=r.maxZ-r.minZ;
   if(wet.has(`${a}:${b}`)){batches.water.box(x,-.39,z,w,.04,d);rock.box(x,-.75,z,w,.25,d);canals.push(r);}
   else{floor.box(x,-.19,z,w,.38,d);supports.push({...r,height:0,role:'floor'});}
  }
  // Match the solver's coherent straight crossing: a bridge spans just the
  // water, with solid dry approaches rather than floating board-like arms.
  const ns=sockets[0]===2&&sockets[2]===2&&sockets[1]===1&&sockets[3]===1,ew=sockets[1]===2&&sockets[3]===2&&sockets[0]===1&&sockets[2]===1;
  if(ns||ew){
   const w=ns?1.38:1.72,d=ns?1.72:1.38,r=rect(-w/2,w/2,-d/2,d/2);floor.box(0,-.14,0,w,.28,d);supports.push({...r,height:0,role:'bridge'});bridges.push(r);
   // Real stone abutments beneath the deck, and a shallow smooth segmental
   // arch on both exposed faces. These never alter the walkable deck height.
   const span=1.2,archBottom=-.62,archTop=-.25,depth=.1;
   for(const side of [-1,1])for(let j=0;j<18;j++){
    const u=-span/2+j*span/18,v=u+span/18,ya=archBottom+.30*Math.sqrt(Math.max(0,1-(u/(span/2))**2)),yb=archBottom+.30*Math.sqrt(Math.max(0,1-(v/(span/2))**2));
    const p=(q,y,z)=>ns?[q,y,z]:[z,y,q],z=side*(ns?d:w)/2;
    rock.quad(p(u,ya,z),p(v,yb,z),p(v,archTop,z),p(u,archTop,z));rock.quad(p(u,ya,z),p(u,ya,z-side*depth),p(v,yb,z-side*depth),p(v,yb,z));
   }
  }
  // Canal banks seal every dry/wet junction; open canal sockets remain open.
  for(const cell of wet){const [a,b]=cell.split(':').map(Number);for(let d=0;d<4;d++){const [dx,dz]=DIRS[d],aa=a+dx,bb=b+dz;if(wet.has(`${aa}:${bb}`))continue;const out=aa<0||aa>2||bb<0||bb>2;if(out&&sockets[d]===2)continue;const x=dx?(dx<0?EDGES[a]:EDGES[a+1]):(EDGES[a]+EDGES[a+1])/2,z=dz?(dz<0?EDGES[b]:EDGES[b+1]):(EDGES[b]+EDGES[b+1])/2,w=dx?.08:EDGES[a+1]-EDGES[a],depth=dz?.08:EDGES[b+1]-EDGES[b];rock.box(clamp(x,-2.36,2.36),-.26,clamp(z,-2.36,2.36),w,.52,depth);supports.push({...rect(clamp(x-w/2,-2.4,2.4),clamp(x+w/2,-2.4,2.4),clamp(z-depth/2,-2.4,2.4),clamp(z+depth/2,-2.4,2.4)),height:0,role:'bank'});}}
  // Transform north-edge local coordinates around the module center.
  const turn=(p,d)=>{const a=d*Math.PI/2,c=Math.cos(a),s=Math.sin(a);return [p[0]*c-p[2]*s,p[1],p[0]*s+p[2]*c];};
  const edgeQuad=(batch,d,...p)=>batch.quad(...p.map(v=>turn(v,d)));
  function wall(d){
   const nx=8,ny=4,points=[];
   for(let y=0;y<=ny;y++){points[y]=[];for(let x=0;x<=nx;x++)points[y][x]=[-HALF+x*4.8/nx,y*HEIGHT/ny,-HALF+.25+random()*.09];}
   for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)edgeQuad(y===ny-1||random()<.16?ice:rock,d,points[y][x],points[y][x+1],points[y+1][x+1],points[y+1][x]);
   edgeQuad(rock,d,[-HALF,0,-HALF],[HALF,0,-HALF],[HALF,HEIGHT,-HALF],[-HALF,HEIGHT,-HALF]);
   for(let x=0;x<nx;x++)edgeQuad(rock,d,points[ny][x],points[ny][x+1],[points[ny][x+1][0],HEIGHT,-HALF],[points[ny][x][0],HEIGHT,-HALF]);
   for(const x of [0,nx])for(let y=0;y<ny;y++)edgeQuad(rock,d,points[y][x],[points[y][x][0],points[y][x][1],-HALF],[points[y+1][x][0],points[y+1][x][1],-HALF],points[y+1][x]);
   const bb=d%2?rect(d===1?2.06:-2.4,d===1?2.4:-2.06,-2.4,2.4):rect(-2.4,2.4,d===0?-2.4:2.06,d===0?-2.06:2.4);blockers.push({...bb,minY:0,maxY:HEIGHT,role:'wall'});
  }
  for(let d=0;d<4;d++)if(sockets[d]===0)wall(d);
  // Carved rounded arch on the first open edge. Side pillars block only their
  // real footprints; the 2 m center opening remains traversable at ground level.
  if(doorway){const d=doorwayDirection??sockets.findIndex(s=>s===1);if(d>=0){
   const segments=28,depth=.34,opening=1.0,spring=2.15,crown=3.0;
   const archY=x=>spring+(crown-spring)*Math.sqrt(Math.max(0,1-(x/opening)**2));
   for(const side of [-1,1]){const x0=side<0?-2.4:opening,x1=side<0?-opening:2.4;
    edgeQuad(ice,d,[x0,0,-2.4],[x1,0,-2.4],[x1,HEIGHT,-2.4],[x0,HEIGHT,-2.4]);edgeQuad(ice,d,[x1,0,-2.4+depth],[x0,0,-2.4+depth],[x0,HEIGHT,-2.4+depth],[x1,HEIGHT,-2.4+depth]);
    for(const x of [x0,x1])edgeQuad(ice,d,[x,0,-2.4],[x,HEIGHT,-2.4],[x,HEIGHT,-2.4+depth],[x,0,-2.4+depth]);
    const corners=[turn([x0,0,-2.4],d),turn([x1,0,-2.4+depth],d)];blockers.push({...rect(Math.min(...corners.map(p=>p[0])),Math.max(...corners.map(p=>p[0])),Math.min(...corners.map(p=>p[2])),Math.max(...corners.map(p=>p[2]))),minY:0,maxY:HEIGHT,role:'arch-pillar'});
   }
   for(let j=0;j<segments;j++){const x=-opening+j*2*opening/segments,xx=x+2*opening/segments,y=archY(x),yy=archY(xx);
    for(const z of [-2.4,-2.4+depth])edgeQuad(ice,d,[x,y,z],[xx,yy,z],[xx,HEIGHT,z],[x,HEIGHT,z]);edgeQuad(ice,d,[x,y,-2.4],[x,y,-2.4+depth],[xx,yy,-2.4+depth],[xx,yy,-2.4]);
   }
  }}
  // Large props have volume and explicit round blockers. Keep them against
  // closed walls, outside the approach lanes and all bridges.
  function spike(batch,x,z,h,r,y=0,down=false){const sides=5,base=[];for(let j=0;j<sides;j++){const a=j*Math.PI*2/sides;base.push([x+Math.cos(a)*r,y,z+Math.sin(a)*r]);}const tip=[x+r*.18,y+(down?-h:h),z-r*.12];for(let j=0;j<sides;j++)batch.tri(base[j],base[(j+1)%sides],tip);for(let j=1;j<sides-1;j++)batch.tri(base[0],base[j+1],base[j]);}
  if(decor)for(let d=0;d<4;d++)if(sockets[d]===0){
   for(let j=0;j<6;j++){const p=turn([-1.75+j*.67+random()*.15,0,-1.99],d);spike(ice,p[0],p[2],.2+random()*.65,.045+random()*.07,3.74,true);}
   const p=turn([-1.65+random()*.28,0,-1.65],d);
   for(let j=0;j<5;j++)spike(crystal,p[0]+(random()-.5)*.32,p[2]+(random()-.5)*.32,.3+random()*.72,.065+random()*.055);
   blockers.push({shape:'circle',x:p[0],z:p[2],radius:.34,minY:0,maxY:1.1,role:'crystal'});
  }
  if(ceiling){rock.box(0,HEIGHT+.12,0,4.8,.24,4.8);root.userData.ceilingVisible=true;}
  for(const batch of Object.values(batches))batch.finish();
  let tileDisposed=false;
  const tile={root,sockets,variant,supports,canals,bridges,blockers,bounds:{minX:-2.4,maxX:2.4,minZ:-2.4,maxZ:2.4,minY:-.875,maxY:ceiling?4.04:3.8},
   supportHeight(x,z){if(!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>HALF||Math.abs(z)>HALF)return null;return supports.some(b=>contains(x,z,b))?0:null;},
   canStand(x,z,radius=.22,y=0){if(![x,z,radius,y].every(Number.isFinite)||radius<0)return false;for(const [dx,dz]of [[0,0],[-radius,0],[radius,0],[0,-radius],[0,radius]])if(this.supportHeight(x+dx,z+dz)===null)return false;
    return !blockers.some(b=>{if(y+1.7<=b.minY||y>=b.maxY)return false;if(b.shape==='circle')return Math.hypot(x-b.x,z-b.z)<radius+b.radius;return x+radius>b.minX&&x-radius<b.maxX&&z+radius>b.minZ&&z-radius<b.maxZ;});},
   dispose(){if(tileDisposed)return;tileDisposed=true;root.traverse(o=>o.geometry?.dispose());root.clear();tiles.delete(tile);root.userData.disposed=true;}
  };
  root.userData.frozenTile=tile;tiles.add(tile);return tile;
 }
 return {metadata:FROZEN_CAVERN,textures,materials,buildTile,dispose(){if(disposed)return;disposed=true;for(const tile of [...tiles])tile.dispose();for(const m of Object.values(materials))m.dispose();for(const t of Object.values(textures))t.dispose();}};
}
