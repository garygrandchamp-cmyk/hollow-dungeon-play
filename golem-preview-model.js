import {GOLEM_PREVIEW_DATA} from './golem-preview-data.js?v=84fc371936953c752f7d36674575129dbb0d8ea1';
import {createWorldMaterial} from './graphics-compatibility.js?v=84fc371936953c752f7d36674575129dbb0d8ea1';

// Source frames are inclusive. Values and node TRS are never recentered,
// rescaled, retargeted or replaced. Only clip-local time starts at zero.
export const GOLEM_PREVIEW_CLIPS=Object.freeze({
 idle:Object.freeze({first:1,last:48,loop:true,label:'Idle hold'}),
 walk:Object.freeze({first:49,last:97,loop:false,label:'Walk · 0.6 m root advance'}),
 windup:Object.freeze({first:145,last:185,loop:false,label:'Slow slam windup'}),
 slam:Object.freeze({first:186,last:197,loop:false,label:'Committed slam · contact at 0.21 s'}),
 recovery:Object.freeze({first:198,last:240,loop:false,label:'Exposed-core recovery'}),
 hurt:Object.freeze({first:241,last:256,loop:false,label:'Hurt recoil'}),
 death:Object.freeze({first:257,last:312,loop:false,label:'Death · grounded corpse hold'}),
});
const decoded=new WeakMap();
export function decodeGolemArrays(data=GOLEM_PREVIEW_DATA){
 if(decoded.has(data))return decoded.get(data);
 const types={5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
 const arrays=data.arrays.map(a=>{
  const raw=atob(a.bytes),buffer=new ArrayBuffer(raw.length),bytes=new Uint8Array(buffer);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  const Type=types[a.component];if(!Type||raw.length!==a.count*a.size*Type.BYTES_PER_ELEMENT)throw TypeError('Invalid golem preview buffer.');
  return new Type(buffer);
 });decoded.set(data,arrays);return arrays;
}
export function configureGolemTexture(THREE,texture){
 texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=texture.minFilter=THREE.NearestFilter;
 texture.generateMipmaps=false;texture.flipY=false;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=1;
 texture.userData.texelsPerMetre=64;texture.needsUpdate=true;return texture;
}
// One unchanged front idle cell, using the same unlit material, scale and feet
// registration as player-sprites.js, without importing every class/direction.
export function createGolemPlayerReference(THREE,texture,reference=GOLEM_PREVIEW_DATA.playerReference){
 texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=texture.magFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.flipY=true;
 texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;texture.repeat.set(1/reference.columns,1/reference.rows);texture.offset.set(0,1-1/reference.rows);texture.needsUpdate=true;
 const root=new THREE.Group(),height=reference.height*reference.framePixels/reference.bodyPixels,geometry=new THREE.PlaneGeometry(height,height);
 geometry.translate(0,height*(reference.baseline/reference.framePixels-.5),0);
 const material=new THREE.MeshBasicMaterial({map:texture,alphaTest:.5,transparent:false,depthTest:true,depthWrite:true,fog:true,side:THREE.DoubleSide,toneMapped:false}),mesh=new THREE.Mesh(geometry,material);
 root.name='actual-paladin-idle-reference';root.add(mesh);const position=new THREE.Vector3(),eye=new THREE.Vector3(),axis=new THREE.Vector3(0,1,0);let disposed=false;
 mesh.onBeforeRender=(renderer,scene,camera)=>{root.getWorldPosition(position);camera.getWorldPosition(eye);mesh.quaternion.setFromAxisAngle(axis,Math.atan2(eye.x-position.x,eye.z-position.z));mesh.updateMatrixWorld(true);};
 return {root,mesh,dispose(){if(disposed)return;disposed=true;geometry.dispose();material.dispose();root.removeFromParent();}};
}
export function createGolemPreviewModel(THREE,{texture=null,profile='normal',data=GOLEM_PREVIEW_DATA}={}){
 if(!['normal','safe','basic'].includes(profile))throw RangeError('Unknown golem preview graphics profile.');
 const arrays=decodeGolemArrays(data),root=new THREE.Group(),geometry=[],objects=[],materials=[];
 root.name='golem-art-preview';root.userData.artPreview=true;
 if(texture)configureGolemTexture(THREE,texture);
 for(const m of data.materials){
  const material=createWorldMaterial(THREE,{name:m.name,color:new THREE.Color().fromArray(m.color),map:m.texture?texture:null,roughness:m.roughness,metalness:m.metalness,emissive:new THREE.Color().fromArray(m.emissive),emissiveIntensity:1,side:m.doubleSided?THREE.DoubleSide:THREE.FrontSide,fog:true},profile);
  materials.push(material);
 }
 for(const n of data.nodes){
  const object=new THREE.Group();object.name=n.name;object.position.fromArray(n.position);object.quaternion.fromArray(n.quaternion);object.scale.fromArray(n.scale);
  if(n.mesh!==undefined)for(const p of data.meshes[n.mesh].primitives){
   const g=new THREE.BufferGeometry();for(const [name,index,size]of[['position',p.position,3],['normal',p.normal,3],['uv',p.uv,2]])g.setAttribute(name,new THREE.BufferAttribute(arrays[index],size));
   g.setIndex(new THREE.BufferAttribute(arrays[p.index],1));g.computeBoundingSphere();g.computeBoundingBox();geometry.push(g);
   const mesh=new THREE.Mesh(g,materials[p.material]);mesh.name=n.name+'-surface-'+object.children.length;mesh.castShadow=false;mesh.receiveShadow=false;object.add(mesh);
  }
  objects.push(object);
 }
 data.nodes.forEach((n,i)=>n.children.forEach(child=>objects[i].add(objects[child])));data.roots.forEach(i=>root.add(objects[i]));
 const property={translation:'position',rotation:'quaternion',scale:'scale'},clips={};
 for(const [name,range]of Object.entries(GOLEM_PREVIEW_CLIPS)){
  const start=(range.first-1)/24,duration=(range.last-range.first)/24,tracks=[];
  for(const channel of data.channels){
   const sourceTimes=arrays[channel.times],sourceValues=arrays[channel.values],size=data.arrays[channel.values].size,times=[],values=[];
   for(let i=0;i<sourceTimes.length;i++)if(sourceTimes[i]>=start-1e-5&&sourceTimes[i]<=start+duration+1e-5){times.push(Math.max(0,Math.min(duration,sourceTimes[i]-start)));for(let j=0;j<size;j++)values.push(sourceValues[i*size+j]);}
   if(!times.length)throw Error('Empty golem clip channel.');
   const Track=channel.path==='rotation'?THREE.QuaternionKeyframeTrack:THREE.VectorKeyframeTrack;
   tracks.push(new Track(data.nodes[channel.node].name+'.'+property[channel.path],times,values,THREE.InterpolateLinear));
  }
  clips[name]=new THREE.AnimationClip(name,duration,tracks);
 }
 const mixer=new THREE.AnimationMixer(root);let active=null,name=null,paused=false,disposed=false;
 function play(next,{loop=false}={}){
  if(disposed)return false;if(!Object.hasOwn(clips,next))throw RangeError('Unknown golem preview clip.');
  mixer.stopAllAction();name=next;active=mixer.clipAction(clips[next]);active.reset();active.enabled=true;active.clampWhenFinished=true;
  // Death can never repeat or return to idle, even when a caller requests loop.
  const repeats=next!=='death'&&(GOLEM_PREVIEW_CLIPS[next].loop||loop);active.setLoop(repeats?THREE.LoopRepeat:THREE.LoopOnce,repeats?Infinity:1);active.play();mixer.update(0);return true;
 }
 const api={root,objects,clips,materials,mixer,play,
  get activeClip(){return name;},get time(){return active?.time??0;},get duration(){return name?clips[name].duration:0;},get paused(){return paused;},
  get held(){return !!active&&active.loop===THREE.LoopOnce&&active.time>=clips[name].duration-1e-6;},
  setPaused(value){paused=value===true;},
  update(dt,{hidden=false}={}){if(disposed||paused||hidden||!Number.isFinite(dt)||dt<=0)return false;mixer.update(Math.min(dt,.1));return true;},
  seek(seconds){if(disposed||!active||!Number.isFinite(seconds))return false;active.time=Math.max(0,Math.min(clips[name].duration,seconds));mixer.update(0);return true;},
  dispose(){if(disposed)return;disposed=true;mixer.stopAllAction();mixer.uncacheRoot(root);for(const g of geometry)g.dispose();for(const m of materials)m.dispose();root.removeFromParent();}
 };play('idle');return api;
}
export function golemPreviewLinks(search='',moduleURL='http://localhost/golem-preview.js'){
 const valid=v=>/^[a-f0-9]{7,40}$/i.test(v??'')?v:null;
 const release=valid(new URL(moduleURL).searchParams.get('v'))??valid(new URLSearchParams(search).get('release'));
 const query=release?'?release='+encodeURIComponent(release):'';
 return {hub:'./enemy-preview.html'+query,main:'./'+query};
}
