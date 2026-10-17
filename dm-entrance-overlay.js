// Pixel-cut numerals and floor outlines: no canvas, textures, lights or input.
const DIGITS=[
 ['010','110','010','010','111'],['110','001','010','100','111'],
 ['110','001','010','001','110'],['101','101','111','001','001'],
 ['111','100','110','001','110'],['011','100','111','101','111']
];
const KINDS=new Set(['hatch','grate','ceiling']);
const ignoreRaycast=()=>{};

/** Positions are already world coordinates; no actor/input/state getters run.
 * build([{id,index,kind,position:{x,y,z}}]) uses the first six list slots, numbered
 * 1..6 in that original order. Invalid/duplicate slots are skipped, not renumbered.
 * update({selectedId,pending,visible}) accepts pending IDs (array/Set) or records
 * with entranceId, ingressId or id. Pending amber wins over selected brass; an
 * outer corner accent still identifies a selected pending entrance.
 * root.dmOnly requires the caller's normal per-pane DM visibility handling.
 */
export function createDMEntranceOverlay(THREE){
 const root=new THREE.Group();root.name='dm-entrance-overlay';root.userData.dmOnly=true;root.userData.visualOnly=true;root.visible=false;
 const records=new Map(),geometries=new Set(),materials=new Set(),inkGeometries=new Map();let disposed=false;
 function material(name,color){const m=new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,depthTest:false,depthWrite:false,fog:false,toneMapped:false});m.name=name;materials.add(m);return m;}
 const idle=material('dm-entrance-muted-gold',0x9b8d65),selected=material('dm-entrance-selected-brass',0xc1b38a),pendingMaterial=material('dm-entrance-pending-amber',0xb7854c),backing=material('dm-entrance-charcoal',0x171914);
 function shape(draw){
  const positions=[];
  const quad=(x,z,w,h)=>{const l=x-w/2,r=x+w/2,n=z-h/2,s=z+h/2;positions.push(l,0,n,l,0,s,r,0,n,r,0,n,l,0,s,r,0,s);};
  draw(quad);const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeBoundingBox();g.computeBoundingSphere();geometries.add(g);return g;
 }
 const backingGeometry=shape(q=>q(0,0,.96,1.28));
 const selectedGeometry=shape(q=>{for(const x of [-1,1])for(const z of [-1,1]){q(x*1.6,z*1.41,.075,.45);q(x*1.41,z*1.6,.45,.075);}});
 function inkGeometry(number){
  if(inkGeometries.has(number))return inkGeometries.get(number);
  const g=shape(q=>{
   for(const z of [-1.47,1.47])q(0,z,3,.06);for(const x of [-1.47,1.47])q(x,0,.06,2.88);
   DIGITS[number-1].forEach((row,y)=>{for(let x=0;x<3;x++)if(row[x]==='1')q((x-1)*.2,(y-2)*.2,.175,.175);});
  });inkGeometries.set(number,g);return g;
 }
 function mesh(parent,g,m,name,height,order){const node=new THREE.Mesh(g,m);node.name=name;node.position.y=height;node.renderOrder=order;node.raycast=ignoreRaycast;node.userData.visualOnly=true;node.castShadow=false;node.receiveShadow=false;parent.add(node);return node;}
 function build(points=[]){
  if(disposed)return root;root.clear();records.clear();root.visible=false;
  for(const [i,point]of (Array.isArray(points)?points:[]).slice(0,6).entries()){
   const p=point?.position;
   if(typeof point?.id!=='string'||!point.id.length||point.id.length>128||records.has(point.id)||!Number.isSafeInteger(point.index)||point.index<0||!KINDS.has(point.kind)||!p||!['x','y','z'].every(k=>Number.isFinite(p[k])&&Math.abs(p[k])<=1e6))continue;
   const group=new THREE.Group();group.name='dm-entrance-'+point.id;group.position.set(p.x,p.y+.08,p.z);Object.assign(group.userData,{entranceId:point.id,index:point.index,kind:point.kind,number:i+1,selected:false,pending:false,visualOnly:true});root.add(group);
   mesh(group,backingGeometry,backing,'entrance-number-backing',0,90);
   const ink=mesh(group,inkGeometry(i+1),idle,'entrance-number-outline',.006,91),accent=mesh(group,selectedGeometry,selected,'entrance-selected-corners',.012,92);accent.visible=false;
   records.set(point.id,{group,ink,accent});
  }
  return root;
 }
 function update({selectedId=null,pending=[],visible=true}={}){
  if(disposed)return;
  const ids=new Set();
  for(const entry of Array.isArray(pending)||pending instanceof Set?pending:[]){const id=typeof entry==='string'?entry:entry?.entranceId??entry?.ingressId??entry?.id;if(typeof id==='string')ids.add(id);}
  root.visible=!!visible&&records.size>0;
  for(const [id,r]of records){const chosen=id===selectedId,waiting=ids.has(id);r.group.userData.selected=chosen;r.group.userData.pending=waiting;r.accent.visible=chosen;r.ink.material=waiting?pendingMaterial:chosen?selected:idle;}
 }
 function retire(){if(disposed)return;disposed=true;root.visible=false;root.clear();records.clear();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();geometries.clear();materials.clear();inkGeometries.clear();}
 root.userData.disposeMaterials=retire;
 return {root,build,update,dispose(){retire();root.removeFromParent();}};
}
