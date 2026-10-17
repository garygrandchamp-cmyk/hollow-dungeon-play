import {applyPhysicalUVs} from './pixel-density.js?v=b8b6cbf7a249f190b877d02f83550c5a29daf9e3';

const KINDS=new Set(['hatch','grate','ceiling']);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,fallback=0)=>Number.isFinite(v)?v:fallback;
const smooth=v=>{v=clamp(v,0,1);return v*v*(3-2*v);};

/** Visual-only entrances; simulation, placement legality and sounds stay with host.
 * mat(name,color,options) supplies existing pixel materials. This controller owns
 * clones and geometry, never the supplied materials or their shared texture maps.
 * coord(index) -> [x,z]. ceilingHeight is floor clearance in metres, a number or
 * (x,z,index)=>number; point.ceilingY may override it with an absolute height.
 * build([{id,index,kind,d?}]); directions N/E/S/W are 0/1/2/3.
 * tick({time:milliseconds,paused:false,pending:[{ingressId,progress:0..1}]});
 * pending may instead provide startedAt/readyAt in the same millisecond clock.
 * A completed (>=80%) hatch/grate warning holds open for 1s after removal,
 * allowing the host's emerging creature animation to clear the entrance.
 * Ceiling points also accept ceilingHeight clearance. No opening cuts masonry;
 * the parent must choose a compatible wall/ceiling location for the dark inset.
 */
export function createIngressVisuals(THREE,{mat,coord,groundHeight=()=>0,ceilingHeight=3.2,moduleSize=4.8}={}){
 if(typeof mat!=='function'||typeof coord!=='function')throw TypeError('Ingress visuals require mat and coord functions.');
 moduleSize=clamp(finite(moduleSize,4.8),2,20);
 const root=new THREE.Group();root.name='monster-ingress';root.userData.visualOnly=true;
 const records=new Map(),geometries=new Set(),instances=new Set(),materials=new Map();let disposed=false,lastClock=null,elapsed=0;
 function material(kind){
  if(materials.has(kind))return materials.get(kind);
  let value;
  if(kind==='dark')value=new THREE.MeshBasicMaterial({color:0x050605,side:THREE.DoubleSide});
  else{
   const color={stone:0x625e52,wood:0x514031,iron:0x3e3d36}[kind];
   const source=mat('ingress-'+kind,color,{roughness:.97,metalness:kind==='iron'?.35:0});
   if(!source?.clone)throw TypeError('Ingress material factory must return a Three.js material.');
   value=source.clone();
   // Animated lids use baked physical UVs, avoiding world-projection swimming.
   delete value.userData.pixelDensityApplied;
  }
  value.name='ingress-'+kind;materials.set(kind,value);return value;
 }
 function geometry(g){geometries.add(g);return g;}
 function mesh(g,m,parent,name){const node=new THREE.Mesh(geometry(g),m);node.name=name;node.receiveShadow=true;node.castShadow=false;node.userData.visualOnly=true;parent.add(node);return node;}
 function builder(){
  const buckets=new Map();
  return {
   box(kind,w,h,d,x=0,y=0,z=0,rx=0,ry=0,rz=0){
    const g=new THREE.BoxGeometry(w,h,d);g.rotateX(rx);g.rotateY(ry);g.rotateZ(rz);g.translate(x,y,z);applyPhysicalUVs(g,material(kind));
    if(!buckets.has(kind))buckets.set(kind,[]);buckets.get(kind).push(g);
   },
   finish(parent,prefix){
    for(const [kind,parts]of buckets){
     const out=new THREE.BufferGeometry();
     for(const [name,size]of [['position',3],['normal',3],['uv',2]]){
      // Nonindexed triangles preserve independent cuboid face normals/UV seams.
      const values=[];for(const part of parts){const attribute=part.attributes[name];for(const index of part.index.array)for(let j=0;j<size;j++)values.push(attribute.array[index*size+j]);}
      out.setAttribute(name,new THREE.Float32BufferAttribute(values,size));
     }
     for(const part of parts)part.dispose();mesh(out,material(kind),parent,prefix+'-'+kind);
    }
   }
  };
 }
 function hatch(group){
  const frame=builder();frame.box('stone',1.82,.11,.17,0,.045,-.76);frame.box('stone',1.82,.11,.17,0,.045,.76);frame.box('stone',.17,.11,1.35,-.825,.045);frame.box('stone',.17,.11,1.35,.825,.045);frame.finish(group,'hatch-frame');
  const dark=mesh(new THREE.BoxGeometry(1.48,.018,1.35),material('dark'),group,'hatch-dark-inset');dark.position.y=.025;
  const lid=new THREE.Group();lid.name='hatch-lid';lid.position.set(0,.065,-.65);group.add(lid);
  const door=builder();for(let i=0;i<6;i++)door.box('wood',.225,.065,1.28,-.6+i*.24,0,.65);
  for(const z of [.18,1.1]){door.box('iron',1.45,.025,.085,0,.045,z);for(const x of [-.6,-.12,.36,.6])door.box('iron',.045,.025,.045,x,.068,z);}
  for(const x of [-.46,.46])door.box('iron',.18,.08,.13,x,.015,.01);
  door.box('iron',.22,.025,.035,0,.12,1.04);for(const x of [-.095,.095])door.box('iron',.035,.08,.035,x,.075,1.04);
  door.finish(lid,'hatch-lid');return lid;
 }
 function grate(group){
  const frame=builder();
  for(const x of [-.79,.79])for(let i=0;i<4;i++)frame.box('stone',.24,.43,.27,x,.23+i*.45,-.015);
  frame.box('stone',1.8,.25,.32,0,1.96,-.015);frame.box('stone',1.8,.15,.35,0,.055,.025);frame.finish(group,'grate-frame');
  const dark=mesh(new THREE.BoxGeometry(1.38,1.8,.018),material('dark'),group,'grate-dark-inset');dark.position.set(0,.99,.025);
  const door=new THREE.Group();door.name='grate-door';door.position.set(-.64,.13,.09);group.add(door);const bars=builder();
  for(let i=0;i<7;i++)bars.box('iron',.055,1.68,.065,i*.212,.84,.02);
  for(const y of [.055,.58,1.18,1.62])bars.box('iron',1.34,.065,.08,.636,y,.02);
  for(const y of [.23,1.4])bars.box('iron',.12,.15,.13,0,y,.015);bars.finish(door,'grate-bars');return door;
 }
 function ceiling(group){
  const rim=builder();for(const z of [-.68,.68])rim.box('stone',1.58,.13,.22,0,0,z);for(const x of [-.68,.68])rim.box('stone',.22,.13,1.14,x,0,0);
  for(const [x,z,angle]of [[-.45,-.58,.12],[.54,-.36,-.14],[-.57,.4,.16],[.3,.57,-.12]])rim.box('stone',.18,.15,.25,x,-.075,z,angle,angle);rim.finish(group,'ceiling-broken-rim');
  const dark=mesh(new THREE.BoxGeometry(1.22,.018,1.22),material('dark'),group,'ceiling-dark-aperture');dark.position.y=.035;return null;
 }
 function clear(){
  root.clear();records.clear();lastClock=null;elapsed=0;for(const node of instances)node.dispose();instances.clear();for(const g of geometries)g.dispose();geometries.clear();
 }
 function height(x,z){try{return clamp(finite(groundHeight(x,z)), -1000,1000);}catch{return 0;}}
 function build(points=[]){
  if(disposed)return root;clear();
  for(const point of (Array.isArray(points)?points:[]).slice(0,64)){
   if(!point||typeof point.id!=='string'||!/^[\w.:-]{1,128}$/.test(point.id)||records.has(point.id)||!Number.isInteger(point.index)||point.index<0||!KINDS.has(point.kind)||point.kind==='grate'&&point.d!==undefined&&(!Number.isInteger(point.d)||point.d<0||point.d>3))continue;
   let position;try{position=coord(point.index);}catch{continue;}if(!Array.isArray(position)||!position.slice(0,2).every(Number.isFinite)||position.length<2)continue;
   const [x,z]=position,ground=height(x,z),group=new THREE.Group();group.name='ingress-'+point.id;group.position.set(x,ground,z);Object.assign(group.userData,{ingressId:point.id,index:point.index,kind:point.kind,visualOnly:true,nonBlocking:true,pending:false,progress:0});
   if(point.kind==='grate'){const d=point.d??0,offset=moduleSize/2-.16;group.position.x+=[0,1,0,-1][d]*offset;group.position.z+=[-1,0,1,0][d]*offset;group.rotation.y=-d*Math.PI/2;}
   if(point.kind==='ceiling'){
    let clearance=3.2;try{clearance=typeof ceilingHeight==='function'?ceilingHeight(x,z,point.index):ceilingHeight;}catch{}
    group.position.y=Number.isFinite(point.ceilingY)?Math.max(ground+1.8,point.ceilingY)-.06:ground+clamp(finite(point.ceilingHeight,finite(clearance,3.2)),1.8,20)-.06;
   }
   root.add(group);const moving=point.kind==='hatch'?hatch(group):point.kind==='grate'?grate(group):ceiling(group);
   const dustGeometry=new THREE.BoxGeometry(.022,.032,.022);applyPhysicalUVs(dustGeometry,material('stone'));
   const dust=new THREE.InstancedMesh(geometry(dustGeometry),material('stone'),12);dust.name='ingress-warning-dust';dust.visible=false;dust.userData.visualOnly=true;dust.instanceMatrix.setUsage(THREE.DynamicDrawUsage);dust.frustumCulled=false;group.add(dust);instances.add(dust);
   let seed=0;for(const c of point.id)seed=(Math.imul(seed,31)+c.charCodeAt(0))>>>0;
   records.set(point.id,{group,moving,dust,kind:point.kind,seed,base:moving?.position.clone(),wasPending:false,lastProgress:0,holdUntil:null});
  }
  root.updateMatrixWorld(true);return root;
 }
 function pendingProgress(entry,time){
  if(Number.isFinite(entry.progress))return clamp(entry.progress,0,1);
  if(Number.isFinite(entry.startedAt)&&Number.isFinite(entry.readyAt)&&entry.readyAt>entry.startedAt)return clamp((time-entry.startedAt)/(entry.readyAt-entry.startedAt),0,1);
  return 0;
 }
 const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3(1,1,1);
 function tick({pending=[],time=0,paused=false}={}){
  if(disposed)return;time=clamp(finite(time),-1e12,1e12);
  // Re-anchor every tick, even paused/backward ones. A clock rollback cannot
  // leave a door waiting forever to reach an old absolute deadline.
  const delta=lastClock===null?0:Math.max(0,time-lastClock);lastClock=time;if(paused)return;elapsed+=delta;
  const active=new Map();for(const entry of Array.isArray(pending)?pending:[]){if(!entry||typeof entry!=='object')continue;const id=entry.ingressId??entry.id;if(!records.has(id))continue;const progress=pendingProgress(entry,time);active.set(id,Math.max(active.get(id)??0,progress));}
  for(const [id,r]of records){
   const warning=active.has(id),progress=active.get(id)??0,phase=(time+r.seed%2000)*.027;
   if(warning)r.holdUntil=null;
   else if(r.wasPending&&r.lastProgress>=.8&&r.moving)r.holdUntil=elapsed+1000;
   const holding=!warning&&r.holdUntil!==null&&elapsed<r.holdUntil,opening=holding?1:smooth((progress-.55)/.4);
   r.wasPending=warning;r.lastProgress=progress;
   r.group.userData.pending=warning;r.group.userData.progress=progress;r.dust.visible=warning;
   if(r.moving){r.moving.position.copy(r.base);r.moving.rotation.set(0,0,0);if(warning||holding){const rattle=warning?Math.sin(phase)*.008*(1-opening):0;if(r.kind==='hatch'){r.moving.rotation.x=-opening*1.18;r.moving.position.y+=Math.abs(rattle);}else{r.moving.rotation.y=-opening*1.12;r.moving.position.x+=rattle;}}}
   if(warning){
    for(let i=0;i<12;i++){
     const cycle=((time*.00045+i*.0833+r.seed%97/97)%1+1)%1,u=((i*7+r.seed%11)%13)/12-.5,v=((i*5+r.seed%17)%11)/10-.5;
     if(r.kind==='ceiling')position.set(u*.95,-.1-cycle*1.45,v*.95);
     else if(r.kind==='grate')position.set(u*1.15,1.72-cycle*.85,.15+cycle*.26);
     else position.set(u*1.3,.12+cycle*.38,v*1.15);
     const size=(1-cycle)*.65+.25;scale.setScalar(size);matrix.compose(position,rotation,scale);r.dust.setMatrixAt(i,matrix);
    }r.dust.instanceMatrix.needsUpdate=true;
   }
  }
 }
 function retire(){if(disposed)return;disposed=true;clear();for(const value of materials.values())value.dispose();materials.clear();}
 root.userData.disposeMaterials=retire;
 return {root,build,tick,get:id=>records.get(id)?.group??null,dispose(){retire();root.removeFromParent();},get disposed(){return disposed;}};
}
