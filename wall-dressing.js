import {createWorldMaterial as defaultCreateWorldMaterial} from './graphics-compatibility.js?v=1d78ea79feefea23b13aa344fdb80a6c28d88fec';
// Reviewed framed wall art and shallow solid wall props.
import {batchStaticGroup} from './mesh-batch.js?v=1d78ea79feefea23b13aa344fdb80a6c28d88fec';
import {applyPhysicalUVs,tagTextureDensity} from './pixel-density.js?v=1d78ea79feefea23b13aa344fdb80a6c28d88fec';

export const PAINTINGS=Object.freeze({
 ancestor:Object.freeze({width:1,height:1.25,title:'Ancestral portrait'}),
 castle:Object.freeze({width:1.5,height:1,title:'Ruined castle'}),
 devotion:Object.freeze({width:1,height:1.25,title:'Scratched devotional panel'})
});
export const DRESSING_KINDS=Object.freeze([...Object.keys(PAINTINGS).map(k=>'painting:'+k),'shackles','crypt-plaque']);

export function createWallDressingFactory(THREE,{paintingMaps={},graphicsProfile='normal',createWorldMaterial=defaultCreateWorldMaterial}={}){
 const materials=new Map(),ownedMaps=[],roots=new Set();let disposed=false;
 const ramps={plaque:[[76,73,63],[95,91,79],[112,107,92],[130,124,106]],bone:[[85,81,67],[111,106,88],[137,130,108],[160,151,126]],wood:[[34,27,21],[48,36,25],[67,49,31],[88,67,42]],iron:[[37,39,36],[51,53,48],[69,70,61],[88,86,71]],stone:[[49,48,43],[64,62,54],[80,77,65],[96,91,76]],wax:[[93,82,61],[117,104,77],[141,128,99],[161,148,117]],dark:[[20,20,18],[26,26,22],[31,31,26],[38,36,30]]};
 function material(kind){
  if(materials.has(kind))return materials.get(kind);
  let map=paintingMaps[kind];if(!map){
   const data=new Uint8Array(32*32*4),ramp=ramps[kind];if(!ramp)throw Error('Unknown wall material '+kind);
   for(let y=0;y<32;y++)for(let x=0;x<32;x++){
    const grain=kind==='wood'?(Math.floor(x/2)*7+Math.floor(y/9))%9:(Math.floor(x/4)*11+Math.floor(y/3)*7)%13;
    const shade=(x+3*y)%31===0?3:grain===0?0:1+grain%2;data.set([...ramp[shade],255],(y*32+x)*4);
   }
   map=new THREE.DataTexture(data,32,32);tagTextureDensity(map,[.5,.5]);ownedMaps.push(map);
  }
  map.colorSpace=THREE.SRGBColorSpace;map.magFilter=map.minFilter=THREE.NearestFilter;map.generateMipmaps=false;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.needsUpdate=true;
  const value=createWorldMaterial(THREE,{map,roughness:.98,metalness:kind==='iron'?.18:0},graphicsProfile);value.name='wall-dressing-'+kind;materials.set(kind,value);return value;
 }
 function make(kind){
  if(disposed||!DRESSING_KINDS.includes(kind))throw Error('Invalid private wall dressing');
  const root=new THREE.Group();root.name=kind;root.userData.wallDressing=true;root.userData.kind=kind;
  const part=(geometry,type,p=[0,0,0],r=[0,0,0])=>{const mesh=new THREE.Mesh(geometry,material(type));mesh.position.set(...p);mesh.rotation.set(...r);mesh.userData.ownGeometry=true;root.add(mesh);return mesh;};
  const box=(w,h,d,type,p)=>part(new THREE.BoxGeometry(w,h,d),type,p);
  let paintedFace=null;
  if(kind.startsWith('painting:')){
   const key=kind.slice(9),{width:w,height:h}=PAINTINGS[key];if(!paintingMaps[key])throw Error('Painting texture not loaded: '+key);
   // A solid backing and two tiers of timber form the depth, never a billboard.
   box(w+.12,h+.12,.07,'wood',[0,0,.035]);
   for(const sign of [-1,1]){box(.085,h+.25,.13,'wood',[sign*(w/2+.075),0,.085]);box(w+.065,.085,.13,'wood',[0,sign*(h/2+.075),.085]);box(.025,h+.06,.035,'wood',[sign*(w/2+.017),0,.145]);box(w,.025,.035,'wood',[0,sign*(h/2+.017),.145]);}
   for(const x of [-1,1])for(const y of [-1,1]){box(.12,.028,.025,'iron',[x*(w/2+.055),y*(h/2+.1),.162]);box(.028,.10,.025,'iron',[x*(w/2+.1),y*(h/2+.055),.162]);}
   paintedFace=part(new THREE.PlaneGeometry(w,h),key,[0,0,.078]);paintedFace.userData.dynamic=true;paintedFace.name='painting-surface';
  }else if(kind==='shackles'){
   for(const side of [-1,1]){
    const x=side*.29;box(.16,.22,.055,'iron',[x,.2,.027]);
    for(const yy of [.15,.25])part(new THREE.SphereGeometry(.022,5,4),'iron',[x,yy,.065]);
    for(let i=0;i<4;i++)part(new THREE.TorusGeometry(.045,.012,4,8),'iron',[x,.07-i*.075,.11],[0,i%2?Math.PI/2:0,0]);
    part(new THREE.TorusGeometry(.11,.025,5,10),'iron',[x,-.31,.12],[.25,0,side*.12]);
   }
    }else{
   const shape=new THREE.Shape();shape.moveTo(-.38,-.25);shape.lineTo(.35,-.25);shape.lineTo(.4,-.18);shape.lineTo(.4,.16);shape.lineTo(.15,.28);shape.lineTo(-.12,.28);shape.lineTo(-.4,.16);shape.closePath();
   const slab=new THREE.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:true,bevelSegments:1,bevelSize:.025,bevelThickness:.025,steps:1});part(slab,'plaque');
   const rim=new THREE.Shape();const outer=[[-.35,-.215],[.32,-.215],[.365,-.15],[.365,.14],[.14,.245],[-.11,.245],[-.365,.14]];outer.forEach(([x,y],i)=>i?rim.lineTo(x,y):rim.moveTo(x,y));rim.closePath();const hole=new THREE.Path();[...outer].reverse().forEach(([x,y],i)=>i?hole.lineTo(x*.88,y*.82):hole.moveTo(x*.88,y*.82));hole.closePath();rim.holes.push(hole);part(new THREE.ExtrudeGeometry(rim,{depth:.025,bevelEnabled:false,steps:1}),'bone',[0,0,.142]);
   box(.035,.31,.04,'iron',[0,.025,.165]);box(.22,.035,.04,'iron',[0,.08,.165]);
   for(const y of [-.15,-.19])for(const [x,w]of [[-.2,.14],[0,.13],[.20,.11]])box(w,.012,.015,'dark',[x,y,.158]);
  }
  batchStaticGroup(THREE,root);for(const mesh of root.children)if(mesh!==paintedFace)applyPhysicalUVs(mesh.geometry,mesh.material);
  root.userData.drawCalls=root.children.length;root.userData.triangles=root.children.reduce((n,m)=>n+(m.geometry.index?.count??m.geometry.attributes.position.count)/3,0);
  let retired=false;root.userData.dispose=()=>{if(retired)return;retired=true;for(const mesh of root.children)mesh.geometry.dispose();root.removeFromParent();roots.delete(root);};roots.add(root);return root;
 }
 return {make,dispose(){if(disposed)return;disposed=true;for(const root of [...roots])root.userData.dispose();for(const m of materials.values())m.dispose();ownedMaps.forEach(m=>m.dispose());materials.clear();}};
}
