import {WIDOW_RULES} from './ceiling-widow.js?v=b7b8538579c745f26bca5629102f407c3b7f1f39';

// The caller owns floor visibility and adds group to the world. enemyPosition
// is the widow's supported floor point (not its already elevated perch).
// capture.origin remains the hero's original ground point. Nothing moves them.
export function makeWidowCaptureVisual(THREE){
 const group=new THREE.Group();group.name='widow-capture-visual';group.userData.dynamic=true;group.visible=false;
 const strandGeometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,1,0)]);
 const silk=new THREE.LineBasicMaterial({color:0xa39a80,transparent:true,opacity:.55,depthTest:true,depthWrite:false,fog:true,toneMapped:false});
 const strands=[];for(let i=0;i<4;i++){const line=new THREE.Line(strandGeometry,silk);line.name='widow-silk-strand';group.add(line);strands.push(line);}
 const cocoon=new THREE.Group();cocoon.name='widow-cocoon';cocoon.visible=false;group.add(cocoon);
 const bodyGeometry=new THREE.SphereGeometry(1,8,6),bandGeometry=new THREE.TorusGeometry(1,.025,3,12);
 // A one-time nearest-sampled fibre tile breaks up the otherwise clean egg
 // silhouette. No smooth noise, gloss, animation uploads or generated assets.
 const pixels=new Uint8Array(128*128*4),palette=[[99,95,82],[122,115,98],[145,135,113],[164,152,127]];
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){const grain=(x*13+y*7+Math.floor(x/3)*Math.floor(y/5))%23,fibre=(x+Math.floor(y/2))%13<2,color=palette[grain<3?0:fibre?3:grain<15?1:2];pixels.set([...color,255],(y*128+x)*4);}
 const fibreMap=new THREE.DataTexture(pixels,128,128);fibreMap.name='dirty-widow-silk';fibreMap.colorSpace=THREE.SRGBColorSpace;fibreMap.minFilter=fibreMap.magFilter=THREE.NearestFilter;fibreMap.generateMipmaps=false;fibreMap.needsUpdate=true;
 const wrap=new THREE.MeshStandardMaterial({map:fibreMap,color:0xffffff,roughness:1,metalness:0,depthTest:true,fog:true});
 const binding=new THREE.MeshStandardMaterial({map:fibreMap,color:0xb0a58b,roughness:1,metalness:0,depthTest:true,fog:true});
 const body=new THREE.Mesh(bodyGeometry,wrap);body.name='widow-cocoon-wrap';body.position.y=.96;body.scale.set(.43,.9,.39);cocoon.add(body);
 for(const y of [.35,.68,1.03,1.4,1.68]){const ring=new THREE.Mesh(bandGeometry,binding),radius=.44*Math.sqrt(Math.max(.12,1-((y-.96)/.92)**2));ring.name='widow-cocoon-binding';ring.position.y=y;ring.rotation.set(Math.PI/2,0,(y-.96)*.2);ring.scale.set(radius,radius*.9,1);cocoon.add(ring);}
 const up=new THREE.Vector3(0,1,0),delta=new THREE.Vector3(),start=new THREE.Vector3(),end=new THREE.Vector3();
 const valid=p=>p&&['x','y','z'].every(k=>typeof p[k]==='number'&&Number.isFinite(p[k])&&Math.abs(p[k])<=1e6);
 let disposed=false;
 function update(capture,enemyPosition){
  if(disposed)return;const shown=capture&&['snare','cocoon'].includes(capture.phase)&&valid(capture.origin);group.visible=!!shown;if(!shown)return;
  const origin=capture.origin,source=valid(enemyPosition)?enemyPosition:origin;group.position.set(origin.x,origin.y,origin.z);cocoon.visible=capture.phase==='cocoon';
  for(let i=0;i<strands.length;i++){
   const angle=i*Math.PI/2+.35;
   start.set(source.x-origin.x+Math.cos(angle)*.1,source.y-origin.y+WIDOW_RULES.elevationOffset,source.z-origin.z+Math.sin(angle)*.1);
   end.set(Math.cos(angle)*.33,.82+(i%2)*.38,Math.sin(angle)*.3);delta.subVectors(end,start);const length=delta.length();
   const strand=strands[i];strand.position.copy(start);strand.quaternion.setFromUnitVectors(up,delta.multiplyScalar(1/Math.max(.001,length)));strand.scale.set(1,length,1);
  }
 }
 function dispose(){if(disposed)return;disposed=true;group.visible=false;group.removeFromParent();for(const geometry of [strandGeometry,bodyGeometry,bandGeometry])geometry.dispose();for(const material of [silk,wrap,binding])material.dispose();fibreMap.dispose();}
 return {group,update,dispose};
}
