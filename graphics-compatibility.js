export function chooseGraphicsProfile({search='',userAgent='',coarse=false,touchPoints=0}={}){
 const requested=new URLSearchParams(search).get('graphics');
 if(['normal','safe','basic'].includes(requested))return requested;
 return /Android|iPhone|iPad|iPod/i.test(userAgent)||coarse&&touchPoints>1?'safe':'normal';
}
export function createWorldMaterial(THREE,parameters,profile='normal'){
 if(profile==='normal')return new THREE.MeshStandardMaterial(parameters);
 const {normalMap,normalScale,roughness,roughnessMap,metalness,metalnessMap,bumpMap,bumpScale,...simple}=parameters;
 return profile==='basic'?new THREE.MeshBasicMaterial(Object.fromEntries(Object.entries(simple).filter(([key])=>!['emissive','emissiveMap','emissiveIntensity'].includes(key)))):new THREE.MeshLambertMaterial(simple);
}
export function installGraphicsRecovery({THREE,renderer,scene,document:doc=globalThis.document,profile='normal',notify=()=>{}}){
 let lost=false,pending=false,fallback=profile==='basic',disposed=false;const cache=new WeakMap();
 const panel=doc.createElement('div');panel.id='graphicsRecovery';panel.hidden=true;panel.setAttribute('role','alert');
 const message=doc.createElement('p'),button=doc.createElement('button');button.textContent='Reload with compatibility graphics';button.type='button';
 button.onclick=()=>{const url=new URL(globalThis.location.href);url.searchParams.set('graphics','basic');globalThis.location.href=url.href;};panel.appendChild(message);panel.appendChild(button);doc.body.appendChild(panel);
 function simple(material){
  if(!material?.isMeshStandardMaterial&&!material?.isMeshLambertMaterial)return material;
  if(cache.has(material))return cache.get(material);
  const next=new THREE.MeshBasicMaterial({color:material.color.clone().multiplyScalar(.72),map:material.map,alphaMap:material.alphaMap,alphaTest:material.alphaTest,transparent:material.transparent,opacity:material.opacity,side:material.side,fog:material.fog,depthWrite:material.depthWrite,depthTest:material.depthTest,vertexColors:material.vertexColors,toneMapped:false});
  material.addEventListener('dispose',()=>next.dispose());cache.set(material,next);return next;
 }
 function adapt(root=scene){if(!fallback)return;root.traverse(o=>{if(!o.material)return;o.material=Array.isArray(o.material)?o.material.map(simple):simple(o.material);});}
 function contextLost(event){event.preventDefault();lost=true;panel.hidden=false;message.textContent='The phone’s graphics context stopped. Waiting for it to recover. If it stays blank, reload with compatibility graphics.';}
 function restored(){lost=false;panel.hidden=true;notify('Graphics restored.');}
 const prior=renderer.debug.onShaderError;
 renderer.debug.onShaderError=(...args)=>{prior?.(...args);if(!fallback){pending=true;}else{panel.hidden=false;message.textContent='This device could not render the scene. Try compatibility graphics or reload after closing other tabs.';}};
 renderer.domElement.addEventListener('webglcontextlost',contextLost,false);renderer.domElement.addEventListener('webglcontextrestored',restored,false);
 return {get lost(){return lost;},get fallback(){return fallback;},adapt,tick(){if(!pending||disposed)return;pending=false;fallback=true;renderer.shadowMap.enabled=false;adapt();notify('Using compatibility graphics for this device.');},destroy(){disposed=true;renderer.debug.onShaderError=prior;renderer.domElement.removeEventListener('webglcontextlost',contextLost);renderer.domElement.removeEventListener('webglcontextrestored',restored);panel.remove();}};
}
