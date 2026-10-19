import {PROP_SPRITE_DATA} from './prop-sprite-data.js?v=84fc371936953c752f7d36674575129dbb0d8ea1';
import {makeWorldTorch} from './torch-props.js?v=84fc371936953c752f7d36674575129dbb0d8ea1';

export const PROP_SPRITE_KINDS=Object.freeze(Object.keys(PROP_SPRITE_DATA.kinds));
const DEFAULT_HEIGHT={torch:1.8,chest:1.0,shrine:1.3,relic:.65,crate:.95,rubble:.45,spikes:.65,tomb:1.0,bookshelf:1.9,barrel:1.1,banner:1.8,basin:.8,spiderweb:1.5,drip:1.3};
const atlases=new WeakMap();
function acquire(THREE){
 let entry=atlases.get(THREE);
 if(!entry){
  const a=PROP_SPRITE_DATA,palette=new Uint8Array(a.palette.match(/../g).map(byte=>parseInt(byte,16))),runs=atob(a.runs),topDown=new Uint8Array(a.width*a.height*4);let offset=0;
  const indexBytes=a.indexBytes??1;for(let i=0;i<runs.length;i+=indexBytes+2){const index=runs.charCodeAt(i)|(indexBytes===2?runs.charCodeAt(i+1)<<8:0),color=index*4,count=runs.charCodeAt(i+indexBytes)|(runs.charCodeAt(i+indexBytes+1)<<8);if(color+3>=palette.length||offset+count*4>topDown.length)throw Error('Invalid prop atlas pixels.');for(let n=0;n<count;n++){topDown.set(palette.subarray(color,color+4),offset);offset+=4;}}
  if(offset!==topDown.length)throw Error('Incomplete prop atlas pixels.');
  const bottomUp=new Uint8Array(topDown.length),stride=a.width*4;for(let y=0;y<a.height;y++)bottomUp.set(topDown.subarray(y*stride,(y+1)*stride),(a.height-1-y)*stride);
  const base=new THREE.DataTexture(bottomUp,a.width,a.height,THREE.RGBAFormat,THREE.UnsignedByteType);base.name='dark-fantasy-prop-atlas';base.flipY=false;base.colorSpace=THREE.SRGBColorSpace;base.magFilter=base.minFilter=THREE.NearestFilter;base.generateMipmaps=false;base.wrapS=base.wrapT=THREE.ClampToEdgeWrapping;base.unpackAlignment=1;base.needsUpdate=true;
  entry={base,refs:0};atlases.set(THREE,entry);
 }
 entry.refs++;const map=entry.base.clone();map.needsUpdate=true;let released=false;
 return {map,release(){if(released)return;released=true;map.dispose();if(--entry.refs===0){entry.base.dispose();atlases.delete(THREE);}}};
}

/** Upright ground-anchored pixel prop, one draw, cylindrical billboard per camera.
 * time is absolute milliseconds. Parent owns movement and height/XZ compensation.
 * Actual plane is marked dynamic so batching preserves billboarding/UV animation.
 */
export function makePropSprite(THREE,{kind='crate',height,seed=0}={}){
 if(!PROP_SPRITE_KINDS.includes(kind))throw RangeError('Unknown prop sprite kind: '+kind);
 if(kind==='torch')return makeWorldTorch(THREE,{height:height??DEFAULT_HEIGHT.torch,seed,mount:'standing'});
 height=Number.isFinite(height)?Math.max(.05,Math.min(8,height)):DEFAULT_HEIGHT[kind];
 const definition=PROP_SPRITE_DATA.kinds[kind],width=height*definition.width/definition.height,root=new THREE.Group(),billboard=new THREE.Group();root.name='prop-'+kind;billboard.name='prop-billboard';root.add(billboard);
 const {map,release}=acquire(THREE),material=new THREE.MeshBasicMaterial({map,alphaTest:.5,transparent:false,depthTest:true,depthWrite:true,fog:true,toneMapped:false,side:THREE.DoubleSide});
 let hash=2166136261;for(const c of String(seed))hash=Math.imul(hash^c.charCodeAt(0),16777619);const wear=.93+(hash>>>0)%8*.01;material.color.setRGB(wear,wear,wear);
 const geometry=new THREE.PlaneGeometry(width,height);geometry.translate(0,height/2,0);const mesh=new THREE.Mesh(geometry,material);mesh.name='prop-'+kind+'-cutout';mesh.userData.dynamic=true;mesh.userData.ownGeometry=true;mesh.castShadow=mesh.receiveShadow=false;billboard.add(mesh);
 const cameraPosition=new THREE.Vector3(),location=new THREE.Vector3(),rootRotation=new THREE.Quaternion(),facing=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0);
 function faceCamera(camera){if(!root.userData.billboard||!camera?.getWorldPosition)return;camera.getWorldPosition(cameraPosition);root.getWorldPosition(location);root.getWorldQuaternion(rootRotation);const dx=cameraPosition.x-location.x,dz=cameraPosition.z-location.z;if(dx*dx+dz*dz<1e-12)return;facing.setFromAxisAngle(up,Math.atan2(dx,dz));billboard.quaternion.copy(rootRotation).invert().multiply(facing);billboard.updateMatrixWorld(true);}
 mesh.onBeforeRender=(renderer,scene,camera)=>faceCamera(camera);
 let disposed=false,geometryDisposed=false;
 function animate({time=0,open=false,active=true}={}){
  if(disposed)return;time=Number.isFinite(time)?time:0;
  const frames=definition.frames.length,index=kind==='chest'?(open?1:0):kind==='spikes'?(active?1:0):kind==='torch'||kind==='drip'?((Math.floor(time*definition.fps/1000)+(hash>>>0)%frames)%frames+frames)%frames:0,rect=definition.frames[index];
  map.repeat.set(rect.width/PROP_SPRITE_DATA.width,rect.height/PROP_SPRITE_DATA.height);map.offset.set(rect.x/PROP_SPRITE_DATA.width,1-(rect.y+rect.height)/PROP_SPRITE_DATA.height);root.userData.frame=index;
 }
 function disposeMaterials(){if(disposed)return;disposed=true;material.dispose();release();}
 root.userData.kind=kind;root.userData.dynamic=true;root.userData.billboard=!['spiderweb','drip'].includes(kind);root.userData.spriteSize={width,height,nativeWidth:definition.width,nativeHeight:definition.height,frames:definition.frames.length};root.userData.animate=animate;root.userData.faceCamera=faceCamera;root.userData.disposeMaterials=disposeMaterials;
 root.userData.dispose=()=>{disposeMaterials();if(!geometryDisposed){geometryDisposed=true;geometry.dispose();}root.removeFromParent();};
 animate({time:0});return root;
}

/** Wall-local +Z points into the room. All fixture and flame surfaces are 3D. */
export function makeWallTorch(THREE,options={}){return makeWorldTorch(THREE,{...options,mount:'wall'});}