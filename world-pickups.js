import {batchStaticGroup} from './mesh-batch.js?v=84fc371936953c752f7d36674575129dbb0d8ea1';
import {applyPhysicalUVs,tagTextureDensity} from './pixel-density.js?v=84fc371936953c752f7d36674575129dbb0d8ea1';
import {createWorldMaterial} from './graphics-compatibility.js?v=84fc371936953c752f7d36674575129dbb0d8ea1';

// 32px covers .5m: deliberate worn-metal/bone clusters at the shared 64px/m.
const ramps={iron:[[59,63,61],[81,86,81],[105,109,102],[135,137,124]],bronze:[[65,56,40],[89,75,49],[114,96,62],[143,124,84]],bone:[[79,76,61],[103,98,77],[131,125,102],[155,148,121]]};
const banks=new WeakMap();
function acquire(THREE,kind,profile){
 let bank=banks.get(THREE);if(!bank){bank=new Map();banks.set(THREE,bank);}const key=profile+':'+kind;let entry=bank.get(key);
 if(!entry){
  const size=32,data=new Uint8Array(size*size*4),ramp=ramps[kind];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const cluster=(Math.imul(Math.floor(x/3)+7,37)^Math.imul(Math.floor(y/2)+11,19))>>>0;
   const shade=(x+2*y)%23===0?0:cluster%11===0?3:1+cluster%2;data.set([...ramp[shade],255],(y*size+x)*4);
  }
  const map=new THREE.DataTexture(data,size,size);map.name='pickup-worn-'+kind;map.colorSpace=THREE.SRGBColorSpace;map.magFilter=map.minFilter=THREE.NearestFilter;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.generateMipmaps=false;map.needsUpdate=true;tagTextureDensity(map,[.5,.5]);
  const material=createWorldMaterial(THREE,{map,color:0xffffff,roughness:.95,metalness:kind==='bone'?0:.22},profile);material.name='pickup-'+kind;if('flatShading' in material)material.flatShading=true;
  entry={map,material,refs:0};bank.set(key,entry);
 }
 entry.refs++;let released=false;return {material:entry.material,release(){if(released)return;released=true;if(--entry.refs===0){entry.material.dispose();entry.map.dispose();bank.delete(key);}}};
}
function builder(THREE,profile){
 const group=new THREE.Group(),resources=new Map();
 const material=kind=>{if(!resources.has(kind))resources.set(kind,acquire(THREE,kind,profile));return resources.get(kind).material;};
 const part=(geometry,kind,position=[0,0,0],rotation=[0,0,0])=>{const mesh=new THREE.Mesh(geometry,material(kind));mesh.position.set(...position);mesh.rotation.set(...rotation);mesh.userData.ownGeometry=true;group.add(mesh);return mesh;};
 function finish(name,{single=false}={}){
  batchStaticGroup(THREE,group);
  // Bake density after component transforms and optional physical scaling.
  for(const mesh of group.children)applyPhysicalUVs(mesh.geometry,mesh.material);
  const root=single?group.children[0]:group;if(single)root.removeFromParent();root.name=name;root.userData.dynamic=true;root.userData.worldPickup=true;
  root.userData.ownGeometry=single;let disposed=false;root.userData.disposeMaterials=()=>{if(disposed)return;disposed=true;for(const value of resources.values())value.release();};
  return root;
 }
 return {group,part,finish};
}

export function makeKeyPickup(THREE,named=false,{profile='normal'}={}){
 const {part,finish}=builder(THREE,profile),kind=named?'bronze':'iron';
 part(new THREE.TorusGeometry(named?.16:.145,.04,4,named?4:12),kind,[-.22,.04,0],[0,0,named?Math.PI/4:0]);
 part(new THREE.CylinderGeometry(.045,.045,.46,6),kind,[.115,.04,0],[0,0,Math.PI/2]);
 part(new THREE.BoxGeometry(.075,.09,.11),kind,[-.075,.04,0]);
 for(const x of [.20,.32])part(new THREE.BoxGeometry(.065,.16,.095),kind,[x,-.065,0]);
 if(named)part(new THREE.BoxGeometry(.065,.105,.095),kind,[.26,-.14,0]);
 const root=finish(named?'named-key-volume':'silver-key-volume',{single:true});root.rotation.y=.35;root.rotation.z=-.12;root.userData.pickupKind=named?'named-key':'silver-key';return root;
}

export function makeRelicPickup(THREE,{height=.55,profile='normal'}={}){
 if(!Number.isFinite(height)||height<.2||height>1)throw RangeError('Invalid relic height');
 const {group,part,finish}=builder(THREE,profile),scale=height/.55;
 const rings=[[.095,-.26],[.16,-.22],[.19,-.13],[.19,.06],[.135,.19],[.025,.25]].map(([x,y])=>new THREE.Vector2(x,y));
 part(new THREE.LatheGeometry(rings,6), 'bone');
 part(new THREE.CylinderGeometry(.15,.11,.065,6),'bronze',[0,-.24,0]);
 part(new THREE.CylinderGeometry(.14,.19,.055,6),'bronze',[0,.14,0]);
 part(new THREE.ConeGeometry(.14,.16,6),'bronze',[0,.235,0]);
 for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5])part(new THREE.BoxGeometry(.035,.35,.035),'bronze',[Math.sin(a)*.17,-.035,Math.cos(a)*.17]);
 for(const mesh of group.children){mesh.geometry.scale(scale,scale,scale);mesh.position.multiplyScalar(scale);}
 const root=finish('gothic-relic-volume');root.userData.pickupKind='relic';root.rotation.y=Math.PI/6;return root;
}
