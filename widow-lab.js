import * as THREE from './vendor/three.module.js?v=096375a8b41b569f9c1ed4904ee997628eeda887';
import {CAPTURE_RULES,serializeCapture} from './creature-capture.js?v=096375a8b41b569f9c1ed4904ee997628eeda887';
import {WIDOW_RULES,ceilingWidowPerch} from './ceiling-widow.js?v=096375a8b41b569f9c1ed4904ee997628eeda887';
import {createWidowEncounters} from './widow-encounters.js?v=096375a8b41b569f9c1ed4904ee997628eeda887';
import {makeWidowCaptureVisual} from './widow-visuals.js?v=096375a8b41b569f9c1ed4904ee997628eeda887';
import {makeMonsterSprite,MONSTER_CATALOG} from './monster-sprites.js?v=096375a8b41b569f9c1ed4904ee997628eeda887';
import {makePlayerSprite} from './player-sprites.js?v=096375a8b41b569f9c1ed4904ee997628eeda887';
import {createRetroTextures} from './retro-textures.js?v=096375a8b41b569f9c1ed4904ee997628eeda887';
import {applyWorldMaterialDensity} from './pixel-density.js?v=096375a8b41b569f9c1ed4904ee997628eeda887';
import {combatTiming} from './combat-timing.js?v=096375a8b41b569f9c1ed4904ee997628eeda887';

// A private, in-memory scene controller. No campaign, inventory or save APIs.
// All capture transitions run through the actual production coordinator/core.
export function createWidowLabSimulation(){
 const enemy={id:'enemy:0:1',type:'ceiling-widow',hp:MONSTER_CATALOG['ceiling-widow'].hp,wait:0,position:{x:0,y:0,z:0}};
 const actors=[{id:'hero-1',alive:true,health:140,fainted:false,escaped:false,position:{x:3.5,y:0,z:1.3}},{id:'hero-2',alive:true,health:100,fainted:false,escaped:false,position:{x:1.6,y:0,z:1.7}}];
 let armed=false,paused=false,elapsed=0,allyRecovery=0,releaseDelay=0,notice='The Widow waits above. Provoke to enter its reach.';
 const encounters=createWidowEncounters({state:()=>({floor:0,remote:false,paused,partyMode:true,partyPhase:'active',party:armed?actors:[],actor:actors[0]}),enemies:()=>[enemy],clear:()=>true,notify:text=>{notice=text;}});
 const allowed=()=>!paused;
 function provoke(){if(!allowed()||encounters.current||enemy.wait>0||releaseDelay>0||armed)return false;Object.assign(actors[0].position,{x:.6,y:0,z:1.3});armed=true;notice='Silk above — dodge before the 1.2-second warning ends.';return true;}
 function dodge(){if(!allowed()||encounters.current?.phase!=='snare')return false;actors[0].position.x+=1.2;return true;}
 function struggle(){if(!allowed())return false;const accepted=encounters.struggle(actors[0].id);if(accepted&&!encounters.current){armed=false;releaseDelay=CAPTURE_RULES.immunity;}return accepted;}
 function cut(){if(!allowed()||allyRecovery>0||!encounters.current)return false;const ally=actors[1],origin=encounters.current.origin,dx=origin.x-ally.position.x,dz=origin.z-ally.position.z,length=Math.max(.001,Math.hypot(dx,dz));const accepted=encounters.cut(ally.position,ally.id,{x:dx/length,z:dz/length},2.25);if(accepted){allyRecovery=combatTiming('sword').recoveryMs/1000;ally.attackUntil=elapsed+.28;if(!encounters.current){armed=false;releaseDelay=CAPTURE_RULES.immunity;}}return accepted;}
 function tick(dt){if(paused)return;const step=Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0;if(!step)return;elapsed+=step;releaseDelay=Math.max(0,releaseDelay-step);allyRecovery=Math.max(0,allyRecovery-step);const previous=encounters.current;encounters.tick(step,true);if(previous&&!encounters.current){armed=false;releaseDelay=CAPTURE_RULES.immunity;}}
 function reset(){encounters.reset();enemy.wait=0;enemy.hp=MONSTER_CATALOG['ceiling-widow'].hp;armed=false;paused=false;elapsed=0;allyRecovery=0;releaseDelay=0;Object.assign(actors[0].position,{x:3.5,y:0,z:1.3});Object.assign(actors[1].position,{x:1.6,y:0,z:1.7});for(const actor of actors){actor.health=actor.id==='hero-1'?140:100;actor.alive=true;actor.fainted=false;actor.escaped=false;delete actor.attackUntil;}notice='The Widow waits above. Provoke to enter its reach.';}
 return {enemy,actors,provoke,dodge,struggle,cut,tick,reset,togglePause(){paused=!paused;return paused;},get capture(){return encounters.current;},get paused(){return paused;},get elapsed(){return elapsed;},get allyRecovery(){return allyRecovery;},snapshot(){return {paused,elapsed,armed,notice,cooldown:Math.max(enemy.wait,releaseDelay),capture:serializeCapture(encounters.current),actors:actors.map(a=>({...a,position:{...a.position}}))};}};
}

export function mountWidowLab(doc=document,win=window){
 const $=id=>doc.getElementById(id),sim=createWidowLabSimulation(),scene=new THREE.Scene(),world=new THREE.Group(),camera=new THREE.PerspectiveCamera(49,1,.1,40);scene.background=new THREE.Color(0x0c0e12);scene.fog=new THREE.FogExp2(0x0c0e12,.025);scene.add(world);
 let renderer=null;try{renderer=new THREE.WebGLRenderer({antialias:false,alpha:false});renderer.setPixelRatio(1);$('view').appendChild(renderer.domElement);}catch{$('view').textContent='WebGL unavailable. The controls still run the isolated capture simulation.';}
 const retro=createRetroTextures(THREE),floorMaterial=applyWorldMaterialDensity(new THREE.MeshLambertMaterial({map:retro.surfaces.flagstone,color:0xbbb6a8})),wallMaterial=applyWorldMaterialDensity(new THREE.MeshLambertMaterial({map:retro.masonry.stone.map,color:0xaaa69a}));
 const addBox=(x,y,z,w,h,d,material)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);world.add(mesh);};
 addBox(0,-.15,1,10,.3,10,floorMaterial);addBox(0,1.9,-3.3,10,3.8,.3,wallMaterial);addBox(0,3.78,-.15,5.4,.28,.55,wallMaterial);addBox(-2.5,1.9,-.15,.35,3.8,.55,wallMaterial);
 scene.add(new THREE.AmbientLight(0x8190a1,.85));const light=new THREE.DirectionalLight(0xd8ba8c,2);light.position.set(-3,6,6);scene.add(light);
 const spider=makeMonsterSprite(THREE,{kind:'spider',height:.85,seed:'widow-lab-original-spider'}),perch=ceilingWidowPerch(sim.enemy);spider.position.set(perch.x,perch.y,perch.z);
 // Hang the original species cutout beneath its stone perch. Its lower body
 // remains at2.8m; no second spider billboard is placed on the floor.
 const cutout=spider.getObjectByName('enemy-sprite-cutout');cutout.rotation.z=Math.PI;cutout.position.y=.85;world.add(spider);
 const sprites=['paladin','thief'].map((classId,i)=>{const sprite=makePlayerSprite(THREE,{classId,height:1.7,seed:'widow-lab-hero-'+i});world.add(sprite);return sprite;}),silk=makeWidowCaptureVisual(THREE);world.add(silk.group);
 const listeners=[];for(const [id,action]of [['provoke',()=>sim.provoke()],['dodge',()=>sim.dodge()],['struggle',()=>sim.struggle()],['cut',()=>sim.cut()],['pause',()=>sim.togglePause()],['reset',()=>sim.reset()]]){const button=$(id),listener=()=>{action();refresh();};button.addEventListener('click',listener);listeners.push(()=>button.removeEventListener('click',listener));}
 const setText=(node,text)=>{if(node.textContent!==text)node.textContent=text;},disable=(id,value)=>{if($(id).disabled!==value)$(id).disabled=value;};
 function refresh(){const capture=sim.capture,s=sim.snapshot();setText($('status'),(capture?capture.phase.toUpperCase()+' · '+capture.remaining.toFixed(1)+'s remaining':'PERCHED · cooldown '+s.cooldown.toFixed(1)+'s')+'\nStruggles '+(capture?.escape??0)+' / '+CAPTURE_RULES.escapeActions+' · cuts '+(capture?.rescue??0)+' / '+CAPTURE_RULES.rescueHits+'\n'+(sim.paused?'PAUSED · all timers frozen':'Warning '+WIDOW_RULES.warning+'s · cocoon '+CAPTURE_RULES.cocoon+'s'));
  setText($('notice'),s.notice);setText($('pause'),sim.paused?'Resume':'Pause');disable('provoke',sim.paused||!!capture||s.cooldown>0||s.armed);disable('dodge',sim.paused||capture?.phase!=='snare');disable('struggle',sim.paused||capture?.phase!=='cocoon'||capture.actionCooldown>0);disable('cut',sim.paused||!capture||sim.allyRecovery>0);}
 function resize(){const box=$('view').getBoundingClientRect();if(renderer)renderer.setSize(Math.max(1,Math.floor(box.width/2)),Math.max(1,Math.floor(box.height/2)),false);camera.aspect=Math.max(1,box.width)/Math.max(1,box.height);camera.position.set(5.2,4.2,7.8);camera.lookAt(.5,1.5,.6);camera.updateProjectionMatrix();}
 let stopped=false,frameId,last=performance.now(),nextUI=0;function frame(now){if(stopped)return;const dt=Math.max(0,Math.min(.1,(now-last)/1000));last=now;sim.tick(dt);spider.userData.animate?.({time:sim.elapsed});silk.update(sim.capture,sim.enemy.position);for(let i=0;i<sprites.length;i++){const actor=sim.actors[i];sprites[i].position.set(actor.position.x,actor.position.y,actor.position.z);sprites[i].userData.animate?.({time:sim.elapsed,attacking:(actor.attackUntil??0)>sim.elapsed});}if(now>=nextUI){refresh();nextUI=now+100;}renderer?.render(scene,camera);frameId=win.requestAnimationFrame(frame);}
 function dispose(){if(stopped)return;stopped=true;win.cancelAnimationFrame(frameId);win.removeEventListener('resize',resize);win.removeEventListener('pagehide',dispose);listeners.forEach(remove=>remove());silk.dispose();const geometries=new Set(),materials=new Set(),maps=new Set();scene.traverse(o=>{o.userData.disposeMaterials?.();if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});for(const geo of geometries)geo.dispose();for(const material of materials)material.dispose();for(const family of Object.values(retro.masonry))for(const map of Object.values(family))maps.add(map);for(const map of Object.values(retro.surfaces))maps.add(map);for(const map of maps)map.dispose();renderer?.dispose();}
 win.addEventListener('resize',resize);win.addEventListener('pagehide',dispose);resize();refresh();frameId=win.requestAnimationFrame(frame);return {simulation:sim,dispose};
}
