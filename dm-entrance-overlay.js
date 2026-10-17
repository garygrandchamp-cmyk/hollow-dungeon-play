// Screen-readable pixel-cut badges: no canvas, textures, lights or input.
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
 * root.userData.dmOnly requires the caller's normal per-pane visibility handling.
 * Existing mesh render callbacks billboard/size transforms to ~20 CSS px per
 * numeral, independent of overview zoom and renderer pixel ratio. No state/input
 * getters, vertex uploads or texture updates run during rendering.
 */
export function createDMEntranceOverlay(THREE){
 const root=new THREE.Group();root.name='dm-entrance-overlay';root.userData.dmOnly=true;root.userData.visualOnly=true;root.userData.dynamic=true;root.visible=false;root.renderOrder=10000;
 const records=new Map(),geometries=new Set(),materials=new Set(),inkGeometries=new Map();let disposed=false;
 // Opaque-looking transparent-pass UI draws after translucent water/atmosphere,
 // not merely after opaque masonry. A high group order keeps that ordering when
 // nested groups have their own renderOrder; single pass avoids doubled draws.
 function material(name,color){const m=new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:1,forceSinglePass:true,depthTest:false,depthWrite:false,fog:false,toneMapped:false});m.name=name;materials.add(m);return m;}
 const idle=material('dm-entrance-muted-gold',0x9b8d65),selected=material('dm-entrance-selected-brass',0xc1b38a),pendingMaterial=material('dm-entrance-pending-amber',0xb7854c),backing=material('dm-entrance-charcoal',0x171914);
 function shape(draw){
  const positions=[];
  const quad=(x,z,w,h)=>{const l=x-w/2,r=x+w/2,n=z-h/2,s=z+h/2;positions.push(l,-n,0,l,-s,0,r,-n,0,r,-n,0,l,-s,0,r,-s,0);};
  draw(quad);const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeBoundingBox();g.computeBoundingSphere();geometries.add(g);return g;
 }
 const backingGeometry=shape(q=>q(0,0,1.04,1.4));
 const selectedGeometry=shape(q=>{for(const x of [-1,1])for(const z of [-1,1]){q(x*.57,z*.65,.08,.24);q(x*.49,z*.74,.24,.08);}});
 function inkGeometry(number){
  if(inkGeometries.has(number))return inkGeometries.get(number);
  const g=shape(q=>{
   for(const z of [-.62,.62])q(0,z,.96,.055);for(const x of [-.46,.46])q(x,0,.055,1.2);
   DIGITS[number-1].forEach((row,y)=>{for(let x=0;x<3;x++)if(row[x]==='1')q((x-1)*.2,(y-2)*.2,.175,.175);});
  });inkGeometries.set(number,g);return g;
 }
 const viewport=new THREE.Vector4(),renderSize=new THREE.Vector2(),viewPosition=new THREE.Vector3(),parentScale=new THREE.Vector3(),cameraRotation=new THREE.Quaternion(),parentRotation=new THREE.Quaternion();
 function layout(group,renderer,camera){
  if(disposed||!camera?.projectionMatrix||!camera.matrixWorldInverse)return;
  const rawHeight=renderer?.getViewport?.(viewport)?.w??renderer?.domElement?.clientHeight,canvasHeight=renderer?.domElement?.clientHeight,renderHeight=renderer?.getSize?.(renderSize)?.y;
  // Viewports and getSize share logical renderer units; CSS canvas dimensions
  // may differ under low-resolution wrappers. Do not confuse those with DPR.
  const cssRatio=Number.isFinite(canvasHeight)&&canvasHeight>0&&Number.isFinite(renderHeight)&&renderHeight>0?canvasHeight/renderHeight:1,height=rawHeight*cssRatio;
  const projection=Math.abs(camera.projectionMatrix.elements[5]);
  if(!Number.isFinite(height)||height<=0||!Number.isFinite(projection)||projection<=0)return;
  viewPosition.setFromMatrixPosition(group.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
  const depth=camera.isPerspectiveCamera?Math.abs(viewPosition.z):1,worldSize=40*depth/(projection*height);
  if(!Number.isFinite(worldSize)||worldSize<=0)return;
  group.parent.getWorldQuaternion(parentRotation);camera.getWorldQuaternion(cameraRotation);group.quaternion.copy(parentRotation).invert().multiply(cameraRotation);
  group.parent.getWorldScale(parentScale);group.scale.set(worldSize/Math.max(1e-8,Math.abs(parentScale.x)),worldSize/Math.max(1e-8,Math.abs(parentScale.y)),worldSize/Math.max(1e-8,Math.abs(parentScale.z)));
  // Three.js invokes this before computing the current mesh modelViewMatrix.
  group.updateMatrixWorld(true);
 }
 function mesh(parent,g,m,name,height,order){const node=new THREE.Mesh(g,m);node.name=name;node.position.z=height;node.renderOrder=order;node.raycast=ignoreRaycast;node.userData.visualOnly=true;node.userData.dynamic=true;node.frustumCulled=false;node.castShadow=false;node.receiveShadow=false;node.onBeforeRender=(renderer,scene,camera)=>layout(parent,renderer,camera);parent.add(node);return node;}
 function build(points=[]){
  if(disposed)return root;root.clear();records.clear();root.visible=false;
  for(const [i,point]of (Array.isArray(points)?points:[]).slice(0,6).entries()){
   const p=point?.position;
   if(typeof point?.id!=='string'||!point.id.length||point.id.length>128||records.has(point.id)||!Number.isSafeInteger(point.index)||point.index<0||!KINDS.has(point.kind)||!p||!['x','y','z'].every(k=>Number.isFinite(p[k])&&Math.abs(p[k])<=1e6))continue;
   const group=new THREE.Group();group.name='dm-entrance-'+point.id;group.renderOrder=10000;group.position.set(p.x,p.y+.08,p.z);Object.assign(group.userData,{entranceId:point.id,index:point.index,kind:point.kind,number:i+1,selected:false,pending:false,visualOnly:true,dynamic:true});root.add(group);
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
