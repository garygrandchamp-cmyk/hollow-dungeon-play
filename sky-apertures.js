import {random,DIRS} from './wfc.js?v=28087f36e96cab39a5b5228b003dd8e7b5ca069a';
import {roomContainsTile} from './room-footprint.js?v=28087f36e96cab39a5b5228b003dd8e7b5ca069a';

export function skyOccupied(level,index,tiles,size){
 if(index<0||index>=size*size)return false;
 const data=level?.result??level,tile=tiles[data?.grid?.[index]];
 // Missing data is sealed: uncertain occupancy must never reveal a sky hole.
 return !tile||tile.s.some(v=>v!==0)||(data.architecture?.rooms??[]).some(r=>roomContainsTile(r,index%size,Math.floor(index/size)));
}
export function planSkyApertures({levels,tiles,size,floor,seed,blockedIndices=[],blockedEdges=[],rooms}={}){
 if(!Array.isArray(levels)||levels.length!==2||![0,1].includes(floor)||!Number.isInteger(size)||size<1||!Array.isArray(tiles))return [];
 if(levels.some(level=>!(level?.result??level)?.grid||((level?.result??level).grid.length!==size*size)))return [];const data=levels[floor]?.result??levels[floor];
 const rng=random(String(seed)+':sky-apertures:'+floor),blocked=new Set(blockedIndices),edges=new Set(blockedEdges),candidates=[];
 const occupied=(f,i)=>skyOccupied(levels[f],i,tiles,size),allRooms=rooms??data.architecture?.rooms??[];
 for(let index=0;index<size*size;index++){
  const tile=tiles[data.grid[index]],x=index%size,z=Math.floor(index/size);if(!tile||!tile.s.some(v=>v===1)||tile.s.includes(2)||blocked.has(index))continue;
  if((floor===0||!occupied(0,index))&&!allRooms.some(r=>!r.footprint&&roomContainsTile(r,x,z)))candidates.push({kind:'roof',index,rank:rng()});
  for(let d=0;d<4;d++){
   if(tile.s[d]!==0)continue;const [dx,dz]=DIRS[d],nx=x+dx,nz=z+dz,neighbor=nx<0||nz<0||nx>=size||nz>=size?-1:nz*size+nx,rawNeighbor=index+dx+dz*size,key=Math.min(index,rawNeighbor)+':'+Math.max(index,rawNeighbor);
   if(edges.has(key)||neighbor>=0&&(occupied(0,neighbor)||occupied(1,neighbor)))continue;
   candidates.push({kind:'window',index,d,edgeKey:key,rank:rng()});
  }
 }
 // At most one of each: fixed seeded plans, no runtime particle/generation work.
 const out=[];for(const kind of ['window','roof']){const choices=candidates.filter(c=>c.kind===kind).sort((a,b)=>a.rank-b.rank);if(choices.length&&rng()<.72){const {rank,...plan}=choices[0];if(!out.some(p=>p.index===plan.index))out.push(plan);}}
 return out;
}

export function skyUV(point,camera){const x=point.x-camera.x,y=point.y-camera.y,z=point.z-camera.z,length=Math.hypot(x,y,z)||1;return {u:Math.atan2(z,x)/(Math.PI*2)+.5,v:Math.asin(Math.max(-1,Math.min(1,y/length)))/Math.PI+.5};}

function makeSkyTexture(THREE){
 const width=128,height=64,data=new Uint8Array(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const cloud=(Math.floor(x/5)*17+Math.floor(y/3)*11)%19,moon=Math.hypot(x-39,(y-47)*1.1),star=(x*73+y*131)%997===0&&y>32;
  const color=moon<4.5?[107+(x+y)%3*6,110+(x+y)%3*6,106+(x+y)%3*5]:cloud<4&&y>34?[24,28,32]:star?[58,61,63]:[10+Math.floor(y/20),14+Math.floor(y/20),21+Math.floor(y/16)];
  data.set([...color,255],(y*width+x)*4);
 }
 const map=new THREE.DataTexture(data,width,height);map.name='angular-pixel-night-sky';map.magFilter=map.minFilter=THREE.NearestFilter;map.generateMipmaps=false;map.wrapS=THREE.RepeatWrapping;map.wrapT=THREE.ClampToEdgeWrapping;map.needsUpdate=true;return map;
}

/** Portal planes remain fixed in architecture. Camera-relative angular sampling
 * provides Quake-style infinite distance, including distinct split-screen views.
 */
export function createSkyApertures(THREE,{mat}={}){
 const root=new THREE.Group();root.name='exterior-sky-apertures';root.userData.dynamic=true;
 let material=null,map=null,disposed=false;const eye=new THREE.Vector3();
 const retire=()=>{const geometry=new Set();root.traverse(o=>{if(o.geometry)geometry.add(o.geometry);});geometry.forEach(g=>g.dispose());root.clear();material?.dispose();map?.dispose();material=null;map=null;};
 root.userData.disposeMaterials=retire;
 function build(plans,{coord,moduleSize=4.8}={}){
  retire();if(disposed||!plans.length)return root;
  map=makeSkyTexture(THREE);material=new THREE.ShaderMaterial({uniforms:{skyMap:{value:map}},side:THREE.DoubleSide,depthWrite:true,
   vertexShader:'varying vec3 skyWorld; void main(){vec4 p=modelMatrix*vec4(position,1.0);skyWorld=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}',
   fragmentShader:'uniform sampler2D skyMap; varying vec3 skyWorld; void main(){vec3 d=normalize(skyWorld-cameraPosition);vec2 uv=vec2(atan(d.z,d.x)/6.2831853+.5,asin(clamp(d.y,-1.,1.))/3.14159265+.5);gl_FragColor=texture2D(skyMap,uv);}'
  });material.name='camera-relative-distant-sky';
  const stone=mat('sky-aperture-stone',0x5b5850,{roughness:1});
  for(const plan of plans.slice(0,2)){
   const g=new THREE.Group();g.name='sky-'+plan.kind;g.userData.plan={...plan};root.add(g);const [x,z]=coord(plan.index),roof=plan.kind==='roof',w=roof?1.8:1.3,h=roof?1.8:1.1;
   if(roof){g.position.set(x,3.7,z);g.rotation.x=-Math.PI/2;}else{const [dx,dz]=DIRS[plan.d];g.position.set(x+dx*moduleSize/2,2.65,z+dz*moduleSize/2);g.rotation.y=Math.atan2(dx,dz);}
   const add=(width,height,x,y)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(width,height,.7),stone);mesh.position.set(x,y,.12);mesh.userData.ownGeometry=true;mesh.name='sky-stone-reveal';g.add(mesh);};
   add(.18,h+.36,-w/2-.09,0);add(.18,h+.36,w/2+.09,0);add(w,.18,0,h/2+.09);add(w,.18,0,-h/2-.09);
   const sky=new THREE.Mesh(new THREE.PlaneGeometry(w+2,h+2),material);sky.position.z=.49;sky.userData.ownGeometry=true;sky.userData.dynamic=true;sky.name='fixed-sky-surface';g.add(sky);
  }
  return root;
 }
 return {root,build,prepareView({overhead=false,camera,distance=40}={}){const previous=root.visible,old=root.children.map(g=>g.visible);root.visible=!overhead;const p=camera?.getWorldPosition?camera.getWorldPosition(eye):camera?.position;for(const g of root.children)g.visible=!p||g.position.distanceToSquared(p)<=distance*distance;return()=>{root.visible=previous;root.children.forEach((g,i)=>g.visible=old[i]);};},dispose(){if(disposed)return;retire();disposed=true;root.removeFromParent();}};
}

export function buildSkyRoofTile(parent,{box,stone,x,z,moduleSize=4.8,opening=1.8}){
 const half=moduleSize/2,hole=opening/2,strip=half-hole;
 box(parent,x-(half+hole)/2,3.7,z,strip,.2,moduleSize+.02,stone);box(parent,x+(half+hole)/2,3.7,z,strip,.2,moduleSize+.02,stone);
 box(parent,x,3.7,z-(half+hole)/2,opening,.2,strip,stone);box(parent,x,3.7,z+(half+hole)/2,opening,.2,strip,stone);
}
