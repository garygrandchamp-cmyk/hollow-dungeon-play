import {makeTorchHardware,makeStandingTorchHardware} from './solid-props.js?v=b62f91ca9ddcf47d5a6312b8f4025115d5dbd33a';
import {tagTextureDensity,applyPhysicalUVs} from './pixel-density.js?v=b62f91ca9ddcf47d5a6312b8f4025115d5dbd33a';

const fireTextures=new WeakMap();
function acquireFire(THREE){
 let entry=fireTextures.get(THREE);
 if(!entry){
  const width=16,height=32,data=new Uint8Array(width*height*4),ramp=[[184,155,116],[208,182,139],[229,208,169],[202,174,131]];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)data.set([...ramp[(Math.floor(x/3)+Math.floor(y/4)*3)%ramp.length],255],(y*width+x)*4);
  const map=new THREE.DataTexture(data,width,height);map.name='torch-ember-pixels';map.colorSpace=THREE.SRGBColorSpace;map.minFilter=map.magFilter=THREE.NearestFilter;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.generateMipmaps=false;map.needsUpdate=true;tagTextureDensity(map,[.25,.5]);
  entry={map,refs:0};fireTextures.set(THREE,entry);
 }
 entry.refs++;let released=false;return {map:entry.map,release(){if(released)return;released=true;if(--entry.refs===0){entry.map.dispose();fireTextures.delete(THREE);}}};
}
function flameGeometry(THREE,height,material){
 const positions=[],colors=[],ramp=[0x9f3e20,0xc66c2c,0xd99a46,0xe6bc76],color=new THREE.Color();
 const triangle=(a,b,c,tint)=>{positions.push(...a,...c,...b);color.setHex(tint);for(let i=0;i<3;i++)colors.push(color.r,color.g,color.b);};
 function tongue(h,offset,turn){
  const rings=[[0,.12,0],[.18,.23,0],[.45,.17,.03],[.72,.085,.065],[1,0,.1]],points=rings.map(([y,r,lean])=>Array.from({length:6},(_,i)=>{const a=i*Math.PI/3+turn;return [offset+Math.cos(a)*r*h+lean*h,y*h,Math.sin(a)*r*h];}));
  for(let j=0;j<points.length-1;j++)for(let i=0;i<6;i++){const next=(i+1)%6,tint=ramp[(j+(i%3===0?1:0))%ramp.length];triangle(points[j][i],points[j][next],points[j+1][i],tint);if(j<points.length-2)triangle(points[j][next],points[j+1][next],points[j+1][i],tint);}
  for(let i=0;i<6;i++)triangle([offset,0,0],points[0][(i+1)%6],points[0][i],ramp[0]);
 }
 tongue(height,0,0);tongue(height*.65,-height*.16,.4);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(positions.length/3*2),2));geometry.computeVertexNormals();applyPhysicalUVs(geometry,material);geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

/** Fully volumetric world fixtures. Local +Z projects off the wall into the
 * room; standing roots sit on their iron foot. Parent owns lights/placement.
 * Three merged draws, no billboards/alpha cards, and transform-only 8Hz fire.
 */
export function makeWorldTorch(THREE,{height=1.5,projection=.3,seed=0,mount='wall'}={}){
 height=Number.isFinite(height)?Math.max(.2,Math.min(5,height)):1.5;projection=Number.isFinite(projection)?Math.max(.12,Math.min(.6,projection)):.3;
 const wall=mount==='wall',root=new THREE.Group(),fixtureHeight=height*.67,hardware=wall?makeTorchHardware(THREE,{height:fixtureHeight,projection,seed}):makeStandingTorchHardware(THREE,{height:fixtureHeight,seed});
 root.name=wall?'wall-torch':'prop-torch';hardware.name='torch-solid-hardware';root.add(hardware);hardware.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(hardware),size=bounds.getSize(new THREE.Vector3()),fire=acquireFire(THREE),material=new THREE.MeshBasicMaterial({map:fire.map,vertexColors:true,fog:true,toneMapped:false,depthTest:true,depthWrite:true});material.name='torch-faceted-fire';
 const flame=new THREE.Mesh(flameGeometry(THREE,height-fixtureHeight,material),material);flame.name='torch-volumetric-flame';flame.position.set(0,fixtureHeight,wall?projection*.62:0);flame.userData.dynamic=flame.userData.ownGeometry=true;root.add(flame);
 let hash=2166136261;for(const c of String(seed))hash=Math.imul(hash^c.charCodeAt(0),16777619);const phase=(hash>>>0)%8;let disposed=false,full=false,last=-1;
 Object.assign(root.userData,{kind:'torch',torchMount:wall?'wall':'standing',billboard:false,dynamic:true,solid:true,solidSize:{width:size.x,height:size.y,depth:size.z},collisionBounds:bounds.clone(),projection:wall?projection:0,flamePosition:flame.position.clone().add(new THREE.Vector3(0,(height-fixtureHeight)*.4,0)),worldSize:{height},frame:0});
 root.userData.animate=({time=0,active=true}={})=>{if(disposed)return;time=Number.isFinite(time)?time:0;flame.visible=!!active;const frame=((Math.floor(time/125)+phase)%8+8)%8;if(frame===last)return;last=frame;root.userData.frame=frame;flame.scale.set(.94+(frame%3)*.03,.88+((frame*3)%5)*.03,.94+((frame+1)%3)*.03);flame.rotation.y=(frame%2?1:-1)*.06;};
 root.userData.disposeMaterials=()=>{if(disposed)return;disposed=true;hardware.userData.disposeMaterials();material.dispose();fire.release();};
 root.userData.dispose=()=>{root.userData.disposeMaterials();if(full)return;full=true;const geometries=new Set();root.traverse(o=>{if(o.userData.ownGeometry&&o.geometry)geometries.add(o.geometry);});for(const g of geometries)g.dispose();root.removeFromParent();};
 root.userData.animate({time:0});return root;
}
