import {createWorldMaterial} from './graphics-compatibility.js?v=1d78ea79feefea23b13aa344fdb80a6c28d88fec';
import {makeCounterDressing} from './hub-counter-dressing.js?v=1d78ea79feefea23b13aa344fdb80a6c28d88fec';
import {makeKeeperCandidate} from './hub-keeper.js?v=1d78ea79feefea23b13aa344fdb80a6c28d88fec';
import {createRetroTextures} from './retro-textures.js?v=1d78ea79feefea23b13aa344fdb80a6c28d88fec';
import {applyPhysicalUVs} from './pixel-density.js?v=1d78ea79feefea23b13aa344fdb80a6c28d88fec';
import {makeDungeonProp} from './dungeon-props.js?v=1d78ea79feefea23b13aa344fdb80a6c28d88fec';
import {makeWorldTorch} from './torch-props.js?v=1d78ea79feefea23b13aa344fdb80a6c28d88fec';
import {makePlayerSprite} from './model-actors.js?v=1d78ea79feefea23b13aa344fdb80a6c28d88fec';
import {batchStaticGroup} from './mesh-batch.js?v=1d78ea79feefea23b13aa344fdb80a6c28d88fec';

export const HUB_EYE_HEIGHT=1.48,HUB_BODY_RADIUS=.23;
const GLYPHS={S:['111','100','111','001','111'],T:['111','010','010','010','010'],A:['010','101','111','101','101'],H:['101','101','111','101','101'],O:['111','101','101','101','111'],P:['111','101','111','100','100']};
/** Feature-flagged local preparation: a sealed safe level with ordinary volume/collision. No live
 * dungeon, encounters, loot rolls or campaign mutation. Accepted static keeper only. */
export function createHubScene(THREE,{actors=[],showHeroes=true,graphicsProfile='normal'}={}){
 const scene=new THREE.Scene(),root=new THREE.Group(),shell=new THREE.Group(),retro=createRetroTextures(THREE),props=[],torches=[],bodies=new Map(),bodyClasses=new Map();scene.name='local-safe-preparation';scene.background=new THREE.Color(0x101310);scene.fog=new THREE.FogExp2(0x101310,.012);scene.add(root);root.add(shell);
 const stone=createWorldMaterial(THREE,{map:retro.masonry.stone.map,roughness:1},graphicsProfile),floor=createWorldMaterial(THREE,{map:retro.surfaces.flagstone,roughness:1},graphicsProfile),wood=createWorldMaterial(THREE,{map:retro.surfaces.timber,color:0xb3a18a,roughness:1},graphicsProfile),ink=new THREE.MeshBasicMaterial({color:0xc5b48d});
 const materials=[stone,floor,wood,ink],obstacles=[],stations={stash:{x:-3.2,y:0,z:-3.7},shop:{x:3.1,y:0,z:-3.7}};let disposed=false;
 function box(x,y,z,w,h,d,material=stone){const geometry=new THREE.BoxGeometry(w,h,d);applyPhysicalUVs(geometry,material);const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.userData.ownGeometry=true;shell.add(mesh);return mesh;}
 box(0,-.12,0,12,.24,10,floor);box(0,3.5,0,12,.25,10);box(-6,1.7,0,.35,3.4,10);box(6,1.7,0,.35,3.4,10);box(0,1.7,-5,12,3.4,.35);box(0,1.7,5,12,3.4,.35);
 // Actual timber counter: front panel, slab top, legs. Its closed body footprint
 // is authoritative for walking, not a decorative 2D prop or invisible gate.
 box(3.1,.85,-3.7,2.2,.16,.95,wood);box(3.1,.45,-3.56,2,.8,.1,wood);for(const x of [2.18,4.02])for(const z of [-4.06,-3.34])box(x,.4,z,.13,.8,.13,wood);
 obstacles.push(new THREE.Box3(new THREE.Vector3(2,0,-4.2),new THREE.Vector3(4.2,1,-3.2)));
 const keeper=makeKeeperCandidate(THREE,{height:1.7});keeper.position.set(3.1,0,-4.45);root.add(keeper);
 const counterDressing=makeCounterDressing(THREE,{graphicsProfile,retroTextures:retro});counterDressing.position.set(3.1,.93,-3.7);root.add(counterDressing);
 function prop(kind,x,z,height){const p=makeDungeonProp(THREE,{kind,height,seed:'safe-hub-'+kind});p.position.set(x,0,z);root.add(p);props.push(p);const b=p.userData.collisionBounds.clone().translate(p.position);obstacles.push(b);return p;}
 const stash=prop('chest',-3.2,-3.7,1.05);prop('cabinet',-5,-4.1,1.9);prop('bookshelf',5.15,-4.2,1.9);
 function sign(text,x){box(x,2.1,-4.76,1.85,.42,.07,wood);const size=.055,width=(text.length*4-1)*size;for(let n=0;n<text.length;n++)for(let row=0;row<5;row++)for(let col=0;col<3;col++)if(GLYPHS[text[n]][row][col]==='1')box(x-width/2+(n*4+col+.5)*size,2.1+(2-row)*size,-4.712,size*.86,size*.86,.014,ink);}
 sign('STASH',-3.2);sign('SHOP',3.1);
 for(const x of [-5.76,5.76]){const p=makeWorldTorch(THREE,{height:1.1,projection:.3,seed:'hub-torch-'+x});p.position.set(x,1.1,-.6);p.rotation.y=x<0?Math.PI/2:-Math.PI/2;root.add(p);torches.push(p);const light=new THREE.PointLight(0xe7b77c,6,9,2);light.position.set(x*.94,2,-.6);root.add(light);}
 scene.add(new THREE.HemisphereLight(0xb9b9ad,0x40362a,1.7));
 function retireBody(body){if(!body)return;body.userData.disposeMaterials();body.traverse(o=>{if(o.userData.ownGeometry)o.geometry.dispose();});body.removeFromParent();}
 function syncBodies(){if(!showHeroes)return;for(const actor of actors){if(bodyClasses.get(actor.id)===actor.classId)continue;retireBody(bodies.get(actor.id));const body=makePlayerSprite(THREE,{height:1.7,classId:actor.classId,seed:actor.id,actor});body.name='hub-character-'+actor.id;root.add(body);bodies.set(actor.id,body);bodyClasses.set(actor.id,actor.classId);}}
 syncBodies();
 batchStaticGroup(THREE,shell);root.userData.localPreparation=true;root.userData.worldObjects3D=true;
 function blocked(x,z,radius=HUB_BODY_RADIUS){if(![x,z,radius].every(Number.isFinite)||radius<0||x-radius< -5.8||x+radius>5.8||z-radius< -4.8||z+radius>4.8)return true;return obstacles.some(b=>{const dx=x-Math.max(b.min.x,Math.min(b.max.x,x)),dz=z-Math.max(b.min.z,Math.min(b.max.z,z));return dx*dx+dz*dz<radius*radius;});}
 function update(time,{poses=new Map(),activeId,station,paused=false}={}){if(disposed||paused)return;syncBodies();for(const p of torches)p.userData.animate({time});stash.userData.animate({time,open:station==='stash'});for(const [id,body]of bodies){const p=poses.get(id);if(!p)continue;body.visible=id!==activeId;body.position.copy(p.position);body.rotation.y=p.yaw;body.userData.animate({time:time*.001,moving:false,dead:actors.find(a=>a.id===id)?.alive===false});}}
 function dispose(){if(disposed)return;disposed=true;keeper.userData.dispose();counterDressing.userData.dispose();for(const p of [...props,...torches])p.userData.dispose();for(const body of bodies.values())retireBody(body);const geometries=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());const maps=new Set([...Object.values(retro.surfaces),...Object.values(retro.masonry).flatMap(Object.values)]);maps.forEach(m=>m.dispose());scene.clear();}
 return {scene,root,stations,obstacles,blocked,update,dispose};
}
