import {createRetroTextures} from './retro-textures.js?v=28087f36e96cab39a5b5228b003dd8e7b5ca069a';
import {createWorldMaterial} from './graphics-compatibility.js?v=28087f36e96cab39a5b5228b003dd8e7b5ca069a';
import {applyPhysicalUVs,tagTextureDensity} from './pixel-density.js?v=28087f36e96cab39a5b5228b003dd8e7b5ca069a';
import {batchStaticGroup} from './mesh-batch.js?v=28087f36e96cab39a5b5228b003dd8e7b5ca069a';

/** Static counter set accepted for the experimental local preparation hub.
 * Original code-native geometry; existing world-texture patches at 64px/m.
 * Origin is the tabletop center/surface.
 * Optional retroTextures are borrowed; caller retains their ownership.
 */
export function makeCounterDressing(THREE,{graphicsProfile='normal',retroTextures=null}={}){
 const retro=retroTextures??createRetroTextures(THREE),root=new THREE.Group(),materials=[],ownedMaps=[];
 // Quantize native 32px patches from existing world textures into restrained
 // material ramps. A .5m patch retains 64px/m without their broad black seams.
 function patch(source,ramp,name){const image=source.image,size=32,values=[];for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(((y+37)%image.height)*image.width+(x+57)%image.width)*4;values.push((image.data[i]+image.data[i+1]+image.data[i+2])/3);}const lo=Math.min(...values),hi=Math.max(...values),data=new Uint8Array(size*size*4);values.forEach((v,i)=>data.set([...ramp[Math.min(3,Math.floor((v-lo)/Math.max(1,hi-lo)*4))],255],i*4));const map=new THREE.DataTexture(data,size,size);map.name='counter-patch-'+name;map.colorSpace=THREE.SRGBColorSpace;map.minFilter=map.magFilter=THREE.NearestFilter;map.generateMipmaps=false;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.needsUpdate=true;tagTextureDensity(map,[.5,.5]);ownedMaps.push(map);return map;}
 const mat=(name,map,color,metalness=0)=>{const m=createWorldMaterial(THREE,{map,color,roughness:.97,metalness},graphicsProfile);if('flatShading' in m)m.flatShading=true;m.name='counter-'+name;materials.push(m);return m;};
 const iron=mat('worn-iron',patch(retro.masonry.basalt.map,[[55,58,55],[79,82,74],[104,104,90],[130,126,105]],'iron'),0xffffff,.08),coin=mat('old-bronze',patch(retro.surfaces.timber,[[97,73,39],[128,101,55],[157,127,74],[179,149,94]],'coin'),0xffffff,.08),cloth=mat('coarse-cloth',patch(retro.surfaces.timber,[[80,79,62],[105,101,79],[130,124,96],[146,139,112]],'cloth'),0xffffff),leather=mat('ledger-leather',patch(retro.surfaces.timber,[[57,39,27],[79,54,33],[105,74,43],[126,93,58]],'leather'),0xffffff),paper=mat('ledger-pages',patch(retro.masonry.stone.map,[[113,106,85],[139,131,105],[161,153,124],[178,169,139]],'paper'),0xffffff);
 if(!retroTextures)new Set([...Object.values(retro.surfaces),...Object.values(retro.masonry).flatMap(Object.values)]).forEach(map=>map.dispose());
 const part=(geometry,material,position=[0,0,0],rotation=[0,0,0])=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...position);mesh.rotation.set(...rotation);mesh.userData.ownGeometry=true;root.add(mesh);return mesh;};
 const box=(w,h,d,m,p,r)=>part(new THREE.BoxGeometry(w,h,d),m,p,r);
 function rod(a,b,r,m){const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),delta=to.clone().sub(from),mesh=part(new THREE.CylinderGeometry(r,r,delta.length(),5),m,from.add(to).multiplyScalar(.5).toArray());mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());}
 // Balance with solid foot, spindle, beam, suspension rods and hollow pans.
 const sx=-.57,sz=-.10;box(.23,.025,.18,iron,[sx,.0125,sz]);box(.13,.025,.10,iron,[sx,.0375,sz]);rod([sx,.05,sz],[sx,.50,sz],.014,iron);box(.53,.023,.025,iron,[sx,.48,sz]);part(new THREE.OctahedronGeometry(.028),iron,[sx,.525,sz]);
 for(const side of [-1,1]){const x=sx+side*.23,y=.28;const points=[[0,0],[.045,0],[.08,.015],[.095,.035],[.084,.035],[.065,.023],[.035,.012],[0,.012]].map(([r,h])=>new THREE.Vector2(r,h));part(new THREE.LatheGeometry(points,10),iron,[x,y,sz]);
  for(let n=0;n<3;n++){const a=n*Math.PI*2/3;rod([x,.478,sz],[x+Math.cos(a)*.079,y+.032,sz+Math.sin(a)*.079],.0038,iron);}
  if(side===1)part(new THREE.CylinderGeometry(.027,.027,.009,8),coin,[x,y+.017,sz]);
 }
 // Shallow solid tray and low stacks. Coins are cylinders, not painted circles.
 const tx=.01,tz=.23;box(.33,.018,.20,iron,[tx,.009,tz]);for(const side of [-1,1]){box(.33,.028,.012,iron,[tx,.032,tz+side*.094]);box(.012,.028,.18,iron,[tx+side*.159,.032,tz]);}
 for(const [x,z,count]of [[-.08,-.025,3],[.015,.025,2],[.09,-.025,1],[-.02,-.045,1]])for(let n=0;n<count;n++)part(new THREE.CylinderGeometry(.028,.028,.008,8),coin,[tx+x,.022+n*.009,tz+z]);
 // Folded coarse cloth supports a closed leather ledger with a real page block.
 const lx=.59,lz=.025;box(.39,.018,.29,cloth,[lx,.009,lz]);box(.35,.017,.265,cloth,[lx-.012,.0265,lz+.005]);for(const x of [-.145,.095])box(.015,.007,.25,cloth,[lx+x,.038,lz]);
 box(.30,.012,.225,leather,[lx,.046,lz],[0,-.16,0]);box(.276,.038,.205,paper,[lx,.071,lz],[0,-.16,0]);box(.30,.012,.225,leather,[lx,.096,lz],[0,-.16,0]);box(.021,.06,.22,leather,[lx-.144,.071,lz-.023],[0,-.16,0]);box(.032,.009,.23,leather,[lx+.06,.106,lz],[0,-.16,0]);
 batchStaticGroup(THREE,root);for(const mesh of root.children){applyPhysicalUVs(mesh.geometry,mesh.material);mesh.castShadow=false;mesh.receiveShadow=true;mesh.name=mesh.material.name;}
 root.name='private-shop-counter-dressing';root.userData.privateCandidate=true;root.userData.staticDressing=true;root.userData.worldTexelsPerMetre=64;root.userData.bounds=new THREE.Box3().setFromObject(root);root.userData.parts=['coin-scale','coin-tray','cloth-ledger'];
 let disposed=false;root.userData.dispose=()=>{if(disposed)return;disposed=true;for(const mesh of root.children)mesh.geometry.dispose();for(const m of materials)m.dispose();ownedMaps.forEach(map=>map.dispose());root.removeFromParent();};return root;
}
