import {pixelsForSpan,tagTextureDensity,applyPhysicalUVs} from './pixel-density.js?v=c83e4d4daa13c7855e4b7f872c6ac80790f66cde';
// Volumetric low-poly furnishings with synchronous, repeating pixel materials.
const textureCaches=new WeakMap();
const DEFAULTS={tomb:1,sarcophagus:1,chest:1,crate:.95,rubble:.45,barrel:1.1,bookshelf:1.9,basin:.8,cabinet:1.7,drawers:1.05,'rat-cage':.9,boulder:1.3,shrine:1.2};
export const SOLID_PROP_KINDS=Object.freeze(Object.keys(DEFAULTS));
function random(seed){let n=2166136261;for(const c of String(seed))n=Math.imul(n^c.charCodeAt(0),16777619);return()=>{n|=0;n=n+0x6d2b79f5|0;let t=Math.imul(n^n>>>15,1|n);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function acquireTexture(THREE,kind){
 let cache=textureCaches.get(THREE);if(!cache){cache=new Map();textureCaches.set(THREE,cache);}let entry=cache.get(kind);
 if(!entry){
  const size=pixelsForSpan(1),data=new Uint8Array(size*size*4),rng=random('solid-material-'+kind),base={wood:[94,66,43],metal:[82,80,72],stone:[113,108,93],cloth:[151,139,115],water:[53,91,94],crystal:[64,109,137]}[kind];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const u=x*32/size,v=y*32/size;let grain=(rng()-.5)*(kind==='crystal'?12:25);if(kind==='wood')grain+=Math.sin(u*.8+Math.sin(v*.16)*.8)*12-(u%8<.5?20:0);if(kind==='stone'&&(y===0||x===0))grain-=10;if(kind==='metal'&&rng()<.1)grain-=25;if(kind==='water')grain+=Math.sin(u*.5+v*.7)*11;if(kind==='crystal')grain=Math.round((grain+(x%17===0?5:0))/3)*3;
   const p=(y*size+x)*4;for(let c=0;c<3;c++)data[p+c]=Math.max(0,Math.min(255,base[c]+grain+(kind==='metal'&&grain<-12?[8,-3,-11][c]:0)));data[p+3]=255;
  }
  const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat,THREE.UnsignedByteType);texture.name='solid-prop-'+kind;texture.flipY=false;texture.magFilter=texture.minFilter=THREE.NearestFilter;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.generateMipmaps=false;texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;tagTextureDensity(texture,[1,1]);entry={texture,refs:0};cache.set(kind,entry);
 }
 entry.refs++;let released=false;return {texture:entry.texture,release(){if(released)return;released=true;if(--entry.refs===0){entry.texture.dispose();cache.delete(kind);}}};
}
function kit(THREE,seed){
 const rng=random(seed),root=new THREE.Group(),materials=new Map(),releases=[],buckets=new Map();
 function material(kind){if(materials.has(kind))return materials.get(kind);const source=acquireTexture(THREE,kind),m=new THREE.MeshStandardMaterial({map:source.texture,color:0xffffff,vertexColors:true,flatShading:true,roughness:kind==='crystal'?.28:kind==='water'?.3:.93,metalness:kind==='metal'?.5:kind==='water'?.12:kind==='crystal'?.05:0});if(kind==='crystal'){m.name='shrine-blue-crystal';m.emissive.setHex(0x143a52);m.emissiveIntensity=.18;}materials.set(kind,m);releases.push(source.release);return m;}
 function part(geometry,kind,{x=0,y=0,z=0,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1,tint=0xffffff,bucket=buckets,matrix}={}){
  const raw=geometry.index?geometry.toNonIndexed():geometry;if(raw!==geometry)geometry.dispose();
  const transform=matrix??new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz)),new THREE.Vector3(sx,sy,sz));raw.applyMatrix4(transform);
  const position=raw.attributes.position,normal=raw.attributes.normal,colors=new Float32Array(position.count*3),uv=new Float32Array(position.count*2),color=new THREE.Color(tint);
  for(let i=0;i<position.count;i++){
   const nx=normal.getX(i),ny=normal.getY(i),nz=normal.getZ(i),shade=Math.max(.66,Math.min(1.06,.88+ny*.09+nz*.04-nx*.045));colors[i*3]=color.r*shade;colors[i*3+1]=color.g*shade;colors[i*3+2]=color.b*shade;
   const ax=Math.abs(nx),ay=Math.abs(ny),az=Math.abs(nz);uv[i*2]=ay>ax&&ay>az?position.getX(i):ax>az?position.getZ(i):position.getX(i);uv[i*2+1]=ay>ax&&ay>az?position.getZ(i):position.getY(i);
  }
  raw.setAttribute('color',new THREE.BufferAttribute(colors,3));raw.setAttribute('uv',new THREE.BufferAttribute(uv,2));const m=material(kind);applyPhysicalUVs(raw,m);if(!bucket.has(m))bucket.set(m,[]);bucket.get(m).push(raw);
 }
 function box(w,h,d,kind,options={}){part(new THREE.BoxGeometry(w,h,d),kind,options);}
 function beam(a,b,r,kind,options={}){const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),delta=to.clone().sub(from),matrix=new THREE.Matrix4().compose(from.add(to).multiplyScalar(.5),new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize()),new THREE.Vector3(1,1,1));part(new THREE.CylinderGeometry(r,r,delta.length(),6),kind,{...options,matrix});}
 function finish(bucket=buckets,parent=root,dynamic=false){
  for(const [m,list]of bucket){const g=new THREE.BufferGeometry();for(const [name,itemSize]of [['position',3],['normal',3],['uv',2],['color',3]]){const count=list.reduce((sum,geo)=>sum+geo.attributes[name].array.length,0),data=new Float32Array(count);let offset=0;for(const geo of list){data.set(geo.attributes[name].array,offset);offset+=geo.attributes[name].array.length;}g.setAttribute(name,new THREE.BufferAttribute(data,itemSize));}g.computeBoundingBox();g.computeBoundingSphere();list.forEach(g=>g.dispose());const mesh=new THREE.Mesh(g,m);mesh.userData.ownGeometry=true;mesh.userData.dynamic=true;mesh.userData.solidProp=true;mesh.userData.articulated=dynamic;mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);}bucket.clear();
 }
 function lifecycle(){let disposed=false,full=false;root.userData.disposeMaterials=()=>{if(disposed)return;disposed=true;materials.forEach(m=>m.dispose());releases.forEach(release=>release());};root.userData.dispose=()=>{root.userData.disposeMaterials();if(full)return;full=true;const geometries=new Set();root.traverse(o=>{if(o.userData.ownGeometry&&o.geometry)geometries.add(o.geometry);});geometries.forEach(g=>g.dispose());root.removeFromParent();};return()=>disposed;}
 return {root,rng,part,box,beam,finish,buckets,lifecycle};
}
function normalizeSize(THREE,root,height){
 root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(root),lift=-bounds.min.y,scale=height/(bounds.max.y-bounds.min.y);
 for(const child of root.children){if(child.isMesh)child.geometry.translate(0,lift,0);else child.position.y+=lift;}
 root.traverse(node=>{if(node!==root)node.position.multiplyScalar(scale);if(node.isMesh){node.geometry.scale(scale,scale,scale);applyPhysicalUVs(node.geometry,node.material);node.geometry.computeBoundingBox();node.geometry.computeBoundingSphere();}});root.updateMatrixWorld(true);const size=new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());root.userData.solidSize={width:size.x,height:size.y,depth:size.z};
}

/** Ground-anchored solid furnishings. Root position/rotation/scale remain caller
 * owned; requested height is baked into geometry, not hidden in root.scale.
 * time is milliseconds. Chest lid is an actual moving, volumetric hinged mesh.
 */
export function makeSolidProp(THREE,{kind='crate',height,seed=0}={}){
 if(!SOLID_PROP_KINDS.includes(kind))throw RangeError('Unknown solid prop kind: '+kind);height=Number.isFinite(height)?Math.max(.05,Math.min(8,height)):DEFAULTS[kind];kind=kind==='sarcophagus'?'tomb':kind;
 const k=kit(THREE,'solid-'+kind+'-'+seed),{root,rng,part,box,beam,finish}=k;root.name='solid-'+kind;let lid=null,lastTime=null,opened=0;const doors=[],drawers=[];
 if(kind==='crate'){
  box(1,.9,.9,'wood',{y:.49});for(const z of [-.48,.48]){for(const y of [.12,.86])box(1.12,.1,.08,'wood',{y,z,tint:0xd2c1a0});for(const x of [-.5,.5])box(.1,.85,.08,'wood',{x,y:.49,z});box(1.13,.085,.07,'wood',{y:.49,z,rz:.59,tint:0xb8a180});}
  for(const x of [-.49,.49])for(const z of [-.45,.45]){box(.12,.97,.12,'wood',{x,y:.49,z});for(const y of [.12,.87])part(new THREE.SphereGeometry(.027,5,4),'metal',{x,y,z:z+Math.sign(z)*.065,tint:0x777268});}
 }else if(kind==='barrel'){
  const points=[[.27,0],[.34,.05],[.4,.22],[.42,.52],[.39,.8],[.32,.98]].map(([r,y])=>new THREE.Vector2(r,y));part(new THREE.LatheGeometry(points,12),'wood');
  for(const [y,r]of [[.22,.41],[.76,.405]])part(new THREE.CylinderGeometry(r,r,.07,12),'metal',{y,tint:0x827e75});
  part(new THREE.CylinderGeometry(.32,.32,.035,12),'wood',{y:.98,tint:0xb0a080});part(new THREE.CylinderGeometry(.27,.27,.035,12),'wood',{y:.015,tint:0x7c6c50});
  for(let i=0;i<12;i++){const angle=i*Math.PI/6;for(const y of [.22,.76])part(new THREE.SphereGeometry(.014,4,3),'metal',{x:Math.sin(angle)*.417,y,z:Math.cos(angle)*.417,tint:0xc8c5af});}
 }else if(kind==='boulder'){
  const g=new THREE.IcosahedronGeometry(1,1),positions=g.attributes.position,phase=rng()*100;
  for(let i=0;i<positions.count;i++){const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i),noise=Math.sin(x*17.3+y*31.7+z*11.1+phase)*.045;positions.setXYZ(i,x*(1+noise)*1.03,y*(1+noise)*.94,z*(1+noise)*.98);}g.computeVertexNormals();part(g,'stone',{tint:0x999d8b});
 }else if(kind==='rubble'){
  for(let i=0;i<7;i++){const shape=new THREE.IcosahedronGeometry(1,0),sx=.28+rng()*.35,sy=.2+rng()*.35,sz=.3+rng()*.32,rx=rng(),ry=rng()*6,rz=rng();const matrix=new THREE.Matrix4().compose(new THREE.Vector3((rng()-.5)*1.8,0,(rng()-.5)*1.6),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz)),new THREE.Vector3(sx,sy,sz));const sample=shape.clone().applyMatrix4(matrix);sample.computeBoundingBox();matrix.elements[13]=-sample.boundingBox.min.y;sample.dispose();part(shape,'stone',{matrix,tint:[0xb3b19b,0x858c7b,0xc6bfa8][i%3]});}
 }else if(kind==='tomb'){
  box(1.05,.13,2.08,'stone',{y:.065,tint:0x999784});box(.9,.56,1.85,'stone',{y:.4});box(1.02,.12,2,'stone',{y:.73,tint:0xc5c0a9});box(.97,.06,1.95,'stone',{y:.82,tint:0xd3cab2});
  part(new THREE.SphereGeometry(1,7,5),'stone',{x:0,y:.89,z:-.56,sx:.105,sy:.075,sz:.13,tint:0xd1c8ae});box(.28,.055,.62,'stone',{y:.88,z:-.03,tint:0xc4bba1});
  box(.35,.045,.07,'stone',{y:.92,z:-.15,ry:.55,tint:0xb7b39d});box(.35,.045,.07,'stone',{y:.925,z:-.12,ry:-.55,tint:0xb7b39d});
  for(const z of [-.62,0,.62])for(const x of [-.46,.46])box(.045,.29,.16,'stone',{x,y:.42,z,tint:0x656959});
 }else if(kind==='bookshelf'){
  box(1.1,.96,.045,'wood',{y:.5,z:-.13,tint:0x75614d});for(const x of [-.52,.52])box(.1,1,.31,'wood',{x,y:.5});for(const y of [.035,.29,.54,.79,1.02])box(1.16,.065,.36,'wood',{y});
  const colors=[0x584339,0x526054,0x6e5941,0x564d62,0x8d8166,0x434e57];
  for(let row=0;row<4;row++){let x=-.45;while(x<.43){const width=.045+rng()*.045,h=.14+rng()*.06;box(width,h,.2,'cloth',{x:x+width/2,y:.085+row*.25+h/2,z:.015,rz:(rng()-.5)*.06,tint:colors[Math.floor(rng()*colors.length)]});box(width*.68,.009,.008,'metal',{x:x+width/2,y:.085+row*.25+h*.8,z:.121,tint:0x8c774b});x+=width+.012;}}
 }else if(kind==='cabinet'){
  box(.98,.09,.5,'wood',{y:.045});box(.98,.09,.5,'wood',{y:1.32});box(.88,1.22,.045,'wood',{y:.67,z:-.23,tint:0x8d7c61});for(const x of [-.44,.44])box(.08,1.25,.47,'wood',{x,y:.68});for(const y of [.38,.79])box(.82,.05,.43,'wood',{y,tint:0xa49579});
  for(const side of [-1,1]){const door=new THREE.Group(),bucket=new Map();door.name=side<0?'cabinet-left-door':'cabinet-right-door';door.position.set(side*.44,0,.25);root.add(door);box(.425,1.1,.055,'wood',{x:-side*.2125,y:.69,bucket});box(.32,.88,.012,'wood',{x:-side*.2125,y:.69,z:.033,tint:0xa99a7b,bucket});part(new THREE.SphereGeometry(.026,6,4),'metal',{x:-side*.36,y:.67,z:.062,tint:0xaa9c75,bucket});finish(bucket,door,true);doors.push({node:door,sign:side});}
 }else if(kind==='drawers'){
  box(1.15,.09,.57,'wood',{y:.045});box(1.15,.08,.57,'wood',{y:.84});box(1.04,.75,.045,'wood',{y:.45,z:-.26,tint:0x887357});for(const x of [-.54,.54])box(.075,.78,.53,'wood',{x,y:.45});
  for(let i=0;i<3;i++){const drawer=new THREE.Group(),bucket=new Map(),y=.17+i*.245;drawer.name='drawer-'+i;root.add(drawer);box(.97,.205,.055,'wood',{y,z:.285,bucket});box(.94,.025,.45,'wood',{y:y-.085,z:.035,tint:0x756447,bucket});for(const x of [-.46,.46])box(.025,.16,.44,'wood',{x,y:y+.005,z:.035,tint:0x8b7759,bucket});box(.94,.16,.025,'wood',{y:y+.005,z:-.18,tint:0x8b7759,bucket});beam([-.08,y,.33],[.08,y,.33],.016,'metal',{bucket,tint:0xa59b85});finish(bucket,drawer,true);drawers.push(drawer);}
 }else if(kind==='rat-cage'){
  box(1.14,.08,.84,'wood',{y:.04,tint:0x807354});for(const x of [-.54,.54])for(const z of [-.39,.39])beam([x,.08,z],[x,.85,z],.024,'metal');
  for(const y of [.11,.83]){beam([-.54,y,-.39],[.54,y,-.39],.022,'metal');for(const x of [-.54,.54])beam([x,y,-.39],[x,y,.39],.022,'metal');}
  for(let i=0;i<7;i++){const x=-.45+i*.15;beam([x,.12,-.4],[x,.81,-.4],.009,'metal');beam([x,.83,-.39],[x,.83,.39],.009,'metal');}for(const x of [-.54,.54])for(let i=0;i<5;i++){const z=-.3+i*.15;beam([x,.12,z],[x,.81,z],.009,'metal');}
  const door=new THREE.Group(),bucket=new Map();door.name='rat-cage-door';door.position.set(-.5,0,.415);root.add(door);for(const y of [.12,.8])beam([0,y,0],[1,y,0],.017,'metal',{bucket});for(let i=0;i<8;i++){const x=i/7;beam([x,.12,0],[x,.8,0],.009,'metal',{bucket});}box(.045,.08,.025,'metal',{x:.94,y:.45,z:.018,bucket,tint:0xb0a383});finish(bucket,door,true);doors.push({node:door,sign:-1});
 }else if(kind==='shrine'){
  // Lathed four-sided closed profiles make real beveled square foot/collars.
  const beveled=(width,depth,low,high,inset,tint)=>{const radius=width/Math.SQRT2,inner=radius-inset,points=[[0,low],[inner,low],[radius,low+.025],[radius,high-.025],[inner,high],[0,high]].map(([r,y])=>new THREE.Vector2(r,y));part(new THREE.LatheGeometry(points,4),'stone',{ry:Math.PI/4,sz:depth/width,tint});};
  beveled(1.08,1.08,0,.14,.065,0xa5a28e);beveled(.74,.74,.14,.23,.045,0xb1ac96);box(.5,.53,.5,'stone',{y:.495,tint:0x898c7c});
  // Thin ridges around a recessed core leave physical vertical carving grooves
  // on all four faces; no painted faux indentation or front-only sprite.
  for(const sign of [-1,1])for(const offset of [-.245,-.1225,0,.1225,.245]){box(.065,.48,.075,'stone',{x:offset,y:.495,z:sign*.285,tint:0xaaa58f});box(.075,.48,.065,'stone',{x:sign*.285,y:.495,z:offset,tint:0xaaa58f});}
  beveled(.78,.78,.76,.86,.05,0xb4ae98);
  const bowl=[[0,.84],[.34,.84],[.49,.9],[.58,1.04],[.58,1.1],[.55,1.13],[.43,1.13],[.4,1.09],[.36,.94],[0,.94]].map(([r,y])=>new THREE.Vector2(r,y));part(new THREE.LatheGeometry(bowl,8),'stone',{tint:0xb4ae99});part(new THREE.CircleGeometry(.345,8),'stone',{y:.942,rx:-Math.PI/2,tint:0x747c74});
  const angle=rng()*Math.PI*2;
  part(new THREE.CylinderGeometry(.14,0,.09,6),'crystal',{y:1.025,ry:angle,tint:0x9cbdc8});part(new THREE.CylinderGeometry(.13,.14,.34,6),'crystal',{y:1.24,ry:angle,tint:0xb4ccd3});part(new THREE.ConeGeometry(.13,.25,6),'crystal',{y:1.535,ry:angle,tint:0xbed4db});
 }else if(kind==='basin'){
  const profile=[[0,0],[.44,0],[.56,.13],[.61,.68],[.57,.83],[.42,.83],[.38,.24],[0,.24]].map(([r,y])=>new THREE.Vector2(r,y));part(new THREE.LatheGeometry(profile,12),'stone');part(new THREE.CircleGeometry(.39,12),'water',{y:.42,rx:-Math.PI/2});for(let i=0;i<8;i++){const angle=i*Math.PI/4;box(.07,.22,.035,'stone',{x:Math.sin(angle)*.58,y:.48,z:Math.cos(angle)*.58,ry:angle,tint:0x777b69});}
 }else if(kind==='chest'){
  box(1.3,.1,.86,'wood',{y:.07,tint:0x6c5b41});for(const z of [-.42,.42])box(1.3,.52,.08,'wood',{y:.37,z});for(const x of [-.62,.62])box(.08,.52,.76,'wood',{x,y:.37});
  for(const x of [-.43,.43])for(const z of [-.465,.465])box(.075,.55,.035,'metal',{x,y:.36,z,tint:0x999383});box(.14,.18,.035,'metal',{y:.48,z:.49,tint:0xb59a5f});
  for(let i=0;i<12;i++)part(new THREE.CylinderGeometry(.038,.038,.012,8),'metal',{x:(rng()-.5)*.9,y:.14+rng()*.02,z:(rng()-.5)*.5,tint:0xb0924b});
  lid=new THREE.Group();lid.name='chest-hinge';lid.position.set(0,.64,-.44);root.add(lid);const bucket=new Map();
  part(new THREE.CylinderGeometry(.44,.44,1.36,10,1,false,0,Math.PI),'wood',{z:.44,rz:Math.PI/2,bucket});box(1.36,.025,.88,'wood',{y:.006,z:.44,tint:0x67553f,bucket});
  for(const x of [-.43,.43])part(new THREE.CylinderGeometry(.455,.455,.075,10,1,false,0,Math.PI),'metal',{x,z:.44,rz:Math.PI/2,bucket,tint:0x999383});finish(bucket,lid,true);
  for(const x of [-.43,.43])beam([x-.07,.64,-.47],[x+.07,.64,-.47],.035,'metal');
 }
 finish();if(kind==='bookshelf')root.traverse(o=>{if(o.isMesh)o.geometry.scale(.6,1,1);});normalizeSize(THREE,root,height);root.userData.collisionBounds=new THREE.Box3().setFromObject(root);const isDisposed=k.lifecycle();root.userData.kind=kind;root.userData.solid=true;root.userData.billboard=false;root.userData.lid=lid;root.userData.doors=doors.map(item=>item.node);root.userData.drawers=drawers;
 if(kind==='shrine'){root.traverse(mesh=>{if(mesh.isMesh){mesh.userData.solidObstacle=true;if(mesh.material.name==='shrine-blue-crystal')mesh.name='shrine-crystal';else mesh.name='shrine-stone-pedestal';}});root.userData.shrineFeatures={scale:height/1.66,basinFloor:.942*height/1.66,rimTop:1.13*height/1.66,grooveHeight:.495*height/1.66};}
 const drawerScale=drawers.length?root.userData.solidSize.height/.88:1;
 let pivot=null;if(kind==='boulder'){pivot=new THREE.Group();pivot.name='boulder-center-pivot';pivot.position.y=height/2;for(const mesh of [...root.children]){mesh.geometry.translate(0,-height/2,0);root.remove(mesh);pivot.add(mesh);}root.add(pivot);root.userData.rotationPivot=pivot;}
 root.userData.animate=({time=0,open=false,rolling=false}={})=>{if(isDisposed())return;time=Number.isFinite(time)?time:0;if(kind==='shrine')root.getObjectByName('shrine-crystal').material.emissiveIntensity=.18+Math.sin(time*.0018)*.025;if(pivot&&rolling)pivot.rotation.x=-time*.002;if(!lid&&!doors.length&&!drawers.length)return;const dt=lastTime===null?1/60:Math.max(0,Math.min(.05,(time-lastTime)/1000));lastTime=time;opened+=((open?1:0)-opened)*(1-Math.exp(-dt*15));if(lid)lid.rotation.x=-opened*1.68;for(const {node,sign}of doors)node.rotation.y=opened*1.4*sign;for(const drawer of drawers)drawer.position.z=opened*.34*drawerScale;root.userData.openAmount=opened;};
 root.userData.animate({time:0});return root;
}

/** Wall-local hardware: wall is z=0, room is +Z, feet at y=0. No lights. */
export function makeTorchHardware(THREE,{height=1,projection=.3,seed=0}={}){
 height=Number.isFinite(height)?Math.max(.1,height):1;projection=Number.isFinite(projection)?Math.max(.12,Math.min(.6,projection)):.3;
 const k=kit(THREE,'torch-hardware-'+seed),{root,part,box,beam,finish}=k;
 box(.13,height*.66,.035,'metal',{y:height*.35,z:.02,tint:0x716b5c});for(const y of [height*.1,height*.58])part(new THREE.SphereGeometry(.025,5,4),'metal',{y,z:.05,tint:0xa49a7d});
 beam([0,height*.25,.035],[0,height*.43,projection*.62],.018,'metal');beam([0,height*.43,projection*.62],[0,height*.8,projection*.62],.018,'metal');
 part(new THREE.CylinderGeometry(.09,.055,height*.2,8),'metal',{y:height*.88,z:projection*.62,tint:0x5c574a});part(new THREE.CylinderGeometry(.07,.07,height*.02,8),'wood',{y:height*.99,z:projection*.62,tint:0x3a3027});
 finish();k.lifecycle();root.userData.solid=true;root.userData.projection=projection;return root;
}
