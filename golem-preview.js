import * as THREE from './vendor/three.module.js?v=1d78ea79feefea23b13aa344fdb80a6c28d88fec';
import {GOLEM_PREVIEW_DATA} from './golem-preview-data.js?v=1d78ea79feefea23b13aa344fdb80a6c28d88fec';
import {createGolemPreviewModel,createGolemPlayerReference,GOLEM_PREVIEW_CLIPS,golemPreviewLinks} from './golem-preview-model.js?v=1d78ea79feefea23b13aa344fdb80a6c28d88fec';
import {createGolemPreviewClock,GOLEM_REVIEW_LIGHTS,applyGolemReviewLighting,golemPoseLabel} from './golem-preview-state.js?v=1d78ea79feefea23b13aa344fdb80a6c28d88fec';
import {createRetroTextures} from './retro-textures.js?v=1d78ea79feefea23b13aa344fdb80a6c28d88fec';
import {chooseGraphicsProfile,createWorldMaterial,installGraphicsRecovery} from './graphics-compatibility.js?v=1d78ea79feefea23b13aa344fdb80a6c28d88fec';
import {applyPhysicalUVs} from './pixel-density.js?v=1d78ea79feefea23b13aa344fdb80a6c28d88fec';
import {renderPixelRatio} from './render-budget.js?v=1d78ea79feefea23b13aa344fdb80a6c28d88fec';

const $=id=>document.getElementById(id),links=golemPreviewLinks(location.search,import.meta.url);
$('backHub').href=links.hub;$('backMain').href=links.main;
const profile=chooseGraphicsProfile({search:location.search,userAgent:navigator.userAgent,coarse:matchMedia('(pointer: coarse)').matches,touchPoints:navigator.maxTouchPoints??0});
$('graphics').value=profile;
$('graphics').onchange=()=>{const url=new URL(location.href);url.searchParams.set('graphics',$('graphics').value);url.searchParams.set('lighting',$('lighting').value);if(model)url.searchParams.set('clip',model.activeClip);location.assign(url.href);};
const scene=new THREE.Scene();scene.background=new THREE.Color('#080706');scene.fog=new THREE.FogExp2('#080706',1.8/24);
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:false,alpha:false,powerPreference:'default'});}catch(error){$('error').textContent='WebGL is unavailable. Enable hardware acceleration to inspect the 3D golem.';throw error;}
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;renderer.shadowMap.enabled=false;
const canvas=renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('aria-label','Golem preview: drag or arrow keys to orbit, wheel or plus/minus to zoom');$('renderSurface').appendChild(canvas);
const recovery=installGraphicsRecovery({THREE,renderer,scene,profile,notify:message=>$('error').textContent=message});
const camera=new THREE.PerspectiveCamera(55,1,.1,80);scene.add(camera);
const ambient=new THREE.HemisphereLight(0x8c8c91,0x20150d,.76),moon=new THREE.DirectionalLight(0xa6a3a4,1.38);moon.position.set(-40,70,20);scene.add(ambient,moon);
const lantern=new THREE.PointLight(0xc6c3ba,1.7,8,2);lantern.position.set(.1,-.2,-.2);camera.add(lantern);
// Local inspection lights, not a room-wide exposure/material change. No shadow
// maps or custom shader patches; these replace the moon/lantern in Torch mode.
const key=new THREE.SpotLight(0xe1c9aa,80,10,.65,.6,2),rim=new THREE.SpotLight(0x9ba7b2,40,8,.7,.65,2);
key.name='golem-review-local-key';rim.name='golem-review-local-rim';key.position.set(-2.4,3.8,3.6);rim.position.set(2.7,3.3,-2.2);
key.target.position.set(0,1.4,-.3);rim.target.position.set(0,1.2,-.2);scene.add(key,rim,key.target,rim.target);
const retro=createRetroTextures(THREE),room=new THREE.Group();room.name='isolated-stone-review-room';scene.add(room);
const ownedMaterials=new Set(),ownedGeometry=new Set(),roomTextures=new Set();
for(const maps of Object.values(retro.masonry))for(const t of Object.values(maps))roomTextures.add(t);for(const t of Object.values(retro.surfaces))roomTextures.add(t);
function material(parameters){const m=createWorldMaterial(THREE,parameters,profile);ownedMaterials.add(m);return m;}
const stone=material({map:retro.masonry.stone.map,roughness:.95,color:0xffffff}),floor=material({map:retro.surfaces.flagstone,roughness:.95,color:0xd9d1c1}),wood=material({map:retro.surfaces.timber,color:0x88715b,roughness:1}),bracket=material({map:retro.masonry.basalt.map,color:0x81715a,roughness:1}),flame=new THREE.MeshBasicMaterial({map:retro.masonry.stone.map,color:0xf0b35e,fog:true});ownedMaterials.add(flame);
function box(x,y,z,w,h,d,m){const g=new THREE.BoxGeometry(w,h,d);applyPhysicalUVs(g,m);ownedGeometry.add(g);const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);room.add(mesh);return mesh;}
box(0,-.13,0,12,.26,12,floor);box(0,2.2,-4.3,10.4,4.4,.4,stone);box(-5,2.2,0,.4,4.4,8.6,stone);box(5,2.2,0,.4,4.4,8.6,stone);
for(const x of [-4.3,4.3]){box(x,2.2,-4, .55,4.4,.8,stone);box(x,4.15,-3.9,.85,.35,1,stone);}
const torches=[];
for(const x of [-3.5,3.5]){box(x,1.85,1.4,.48,3.7,.48,stone);box(x,1.75,1.73,.16,.45,.16,wood);box(x,1.55,1.70,.3,.12,.4,bracket);box(x,2.02,1.73,.20,.22,.16,flame);const light=new THREE.PointLight(0xe7ac66,6,7,2);light.position.set(x,2.1,1.95);scene.add(light);torches.push(light);}
let paladin=null,playerTexture=null,model=null,texture=null,disposed=false,raf=0,paused=false,statusAt=-Infinity;
const clock=createGolemPreviewClock(),target=new THREE.Vector3(.55,1.45,0),pointers=new Map();let yaw=.12,elevation=.08,radius=5.4,pinch=0;
function aim(){camera.position.set(target.x+Math.sin(yaw)*Math.cos(elevation)*radius,target.y+Math.sin(elevation)*radius,target.z+Math.cos(yaw)*Math.cos(elevation)*radius);camera.lookAt(target);camera.updateMatrixWorld();}
function resize(){if(disposed)return;const rect=$('renderSurface').getBoundingClientRect(),width=Math.max(1,Math.floor(rect.width)),height=Math.max(1,Math.floor(rect.height));renderer.setPixelRatio(renderPixelRatio(width,height,2,profile!=='normal'));renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();radius=Math.max(radius,3.2/(Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect)+1.2);radius=Math.min(18,radius);aim();}
function clip(name){if(!model)return;paused=false;model.play(name);model.setPaused(false);clock.reset();$('pause').textContent='Pause';$('timeline').value=0;for(const b of $('clips').querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.clip===name));statusAt=-Infinity;}
for(const [name,entry]of Object.entries(GOLEM_PREVIEW_CLIPS)){const b=document.createElement('button');b.type='button';b.textContent=name[0].toUpperCase()+name.slice(1);b.title=entry.label;b.dataset.clip=name;b.setAttribute('aria-pressed','false');b.onclick=()=>clip(name);$('clips').appendChild(b);}
$('pause').onclick=()=>{paused=!paused;model?.setPaused(paused);clock.reset();$('pause').textContent=paused?'Resume':'Pause';};
$('replay').onclick=()=>{if(model)clip(model.activeClip);};
$('timeline').oninput=()=>{if(!model)return;paused=true;model.setPaused(true);$('pause').textContent='Resume';model.seek(model.duration*Number($('timeline').value)/1000);statusAt=-Infinity;};
function inspect(name,frame){if(!model)return;clip(name);model.seek((frame-GOLEM_PREVIEW_CLIPS[name].first)/24);paused=true;model.setPaused(true);$('pause').textContent='Resume';statusAt=-Infinity;}
$('impact').onclick=()=>inspect('slam',191);$('corpse').onclick=()=>inspect('death',312);
$('front').onclick=()=>{yaw=0;elevation=0;target.set(.55,1.45,0);aim();};
$('orbit').onclick=()=>{yaw=.55;elevation=.22;aim();};
function reviewLight(){const p=applyGolemReviewLighting({scene,ambient,moon,lantern,torches,key,rim},$('lighting').value);$('lightingCaption').textContent=p.label.toUpperCase()+' · '+p.note;}
const requestedLight=new URLSearchParams(location.search).get('lighting');$('lighting').value=Object.hasOwn(GOLEM_REVIEW_LIGHTS,requestedLight)?requestedLight:'torch';$('lighting').onchange=reviewLight;reviewLight();
canvas.addEventListener('pointerdown',event=>{canvas.focus();canvas.setPointerCapture(event.pointerId);pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});pinch=0;});
canvas.addEventListener('pointermove',event=>{const old=pointers.get(event.pointerId);if(!old)return;pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(pointers.size===1){yaw-=(event.clientX-old.x)*.006;elevation=THREE.MathUtils.clamp(elevation+(event.clientY-old.y)*.005,-.12,1.25);}else{const [a,b]=[...pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);if(pinch>0&&distance>0)radius=THREE.MathUtils.clamp(radius*pinch/distance,4.5,18);pinch=distance;}aim();});
const releasePointer=event=>{pointers.delete(event.pointerId);pinch=0;};for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,releasePointer);
canvas.addEventListener('wheel',event=>{event.preventDefault();radius=THREE.MathUtils.clamp(radius*Math.exp(event.deltaY*.001),4.5,18);aim();},{passive:false});
canvas.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'].includes(event.key))return;event.preventDefault();if(event.key==='ArrowLeft')yaw-=.08;if(event.key==='ArrowRight')yaw+=.08;if(event.key==='ArrowUp')elevation=Math.min(1.25,elevation+.06);if(event.key==='ArrowDown')elevation=Math.max(-.12,elevation-.06);if(event.key==='+'||event.key==='=')radius=Math.max(4.5,radius*.9);if(event.key==='-')radius=Math.min(18,radius*1.1);aim();});
function frame(now){
 raf=0;if(disposed||document.hidden)return;
 const dt=clock.tick(now,{paused,hidden:document.hidden});recovery.tick();
 if(!recovery.lost){
  model?.update(dt);renderer.render(scene,camera);
  let sourceFrame=0,phaseChanged=false;
  if(model){
   const range=GOLEM_PREVIEW_CLIPS[model.activeClip];sourceFrame=Math.min(range.last,range.first+Math.floor(model.time*24+1e-4));
   const title=golemPoseLabel(model.activeClip,sourceFrame);phaseChanged=$('poseTitle').textContent!==title;
   if(phaseChanged)$('poseTitle').textContent=title;
  }
  // Show phase/contact changes immediately, but do not repaint the numeric
  // clock every render frame on a phone. Fixed banner height avoids camera jitter.
  if(phaseChanged||now-statusAt>180){
   statusAt=now;
   if(model){
    $('poseDetail').textContent=`Source frame ${sourceFrame} · ${model.time.toFixed(2)} / ${model.duration.toFixed(2)} s${model.held?' · HELD':''}${paused?' · PAUSED':''}`;
    const held=model.held?' · final pose held':'';
    $('state').textContent=`${GOLEM_PREVIEW_CLIPS[model.activeClip].label}\n${model.time.toFixed(2)} / ${model.duration.toFixed(2)} s${held}${paused?' · PAUSED':''}`;
    $('timeline').value=Math.round(model.time/model.duration*1000);
   }
   $('diagnostics').textContent=`${profile}${recovery.fallback?' · compatibility fallback':''} · ${renderer.domElement.width}×${renderer.domElement.height} buffer · scene ${renderer.info.render.calls} draws / ${renderer.info.render.triangles} triangles · model 20 draws / 886 triangles`;
  }
 }
 raf=requestAnimationFrame(frame);
}
function start(){if(!disposed&&!document.hidden&&!raf){clock.reset();raf=requestAnimationFrame(frame);}}
function suspend(){if(raf)cancelAnimationFrame(raf);raf=0;clock.reset();pointers.clear();pinch=0;}
document.addEventListener('visibilitychange',()=>document.hidden?suspend():start());window.addEventListener('blur',()=>{pointers.clear();pinch=0;});window.addEventListener('resize',resize);
function dispose(){if(disposed)return;disposed=true;suspend();model?.dispose();texture?.dispose();paladin?.dispose();playerTexture?.dispose();for(const g of ownedGeometry)g.dispose();for(const m of ownedMaterials)m.dispose();for(const t of roomTextures)t.dispose();recovery.destroy();renderer.dispose();}
window.addEventListener('pagehide',event=>event.persisted?suspend():dispose());window.addEventListener('pageshow',start);
resize();start();
try{
 const loader=new THREE.TextureLoader(),loaded=await Promise.allSettled([loader.loadAsync(new URL('./'+GOLEM_PREVIEW_DATA.textureFile,import.meta.url).href),loader.loadAsync(new URL('./'+GOLEM_PREVIEW_DATA.playerReference.textureFile,import.meta.url).href)]);
 texture=loaded[0].status==='fulfilled'?loaded[0].value:null;playerTexture=loaded[1].status==='fulfilled'?loaded[1].value:null;
 if(disposed){texture?.dispose();playerTexture?.dispose();}
 else if(loaded.some(r=>r.status==='rejected')){texture?.dispose();playerTexture?.dispose();texture=playerTexture=null;throw Error('Preview texture load failed.');}
 else{model=createGolemPreviewModel(THREE,{texture,profile});model.root.position.z=-1;scene.add(model.root);paladin=createGolemPlayerReference(THREE,playerTexture);paladin.root.position.set(2.85,0,-.25);scene.add(paladin.root);recovery.adapt(model.root);const requested=new URLSearchParams(location.search).get('clip');clip(Object.hasOwn(GOLEM_PREVIEW_CLIPS,requested)?requested:'idle');$('error').textContent='';}
}catch(error){$('error').textContent='The golem asset could not load. Return to Enemy Preview or reload this preview.';console.error(error);}
