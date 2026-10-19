import {roomCells,roomCenterTile} from './room-footprint.js?v=84fc371936953c752f7d36674575129dbb0d8ea1';

let seedSequence=0;
/** Called by the host/local new-world path only. Reconnect imports its snapshot. */
export function freshExpeditionSeed(previous='',entropy=globalThis.crypto?.randomUUID?.()){
 const suffix=entropy??Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
 let seed='hollow-'+suffix+'-'+(++seedSequence).toString(36);
 if(seed===previous)seed+='-new';return seed;
}

/** One immutable room assignment per cell, including connecting corridors. */
export function planBuildReveal({architecture,size}){
 if(!Number.isInteger(size)||size<1||size>24)throw RangeError('Invalid reveal grid');
 const start=Number.isInteger(architecture?.start)?architecture.start:0,sx=start%size,sz=Math.floor(start/size);
 const rooms=(architecture?.rooms??[]).map(room=>({room,center:roomCenterTile(room)})).filter(r=>r.center).slice(0,24);
 rooms.sort((a,b)=>(a.center.x-sx)**2+(a.center.z-sz)**2-((b.center.x-sx)**2+(b.center.z-sz)**2));
 if(!rooms.length)rooms.push({room:{x:0,z:0,w:size,h:size},center:{x:sx,z:sz}});
 const cells=new Uint8Array(size*size),owned=new Set();
 for(let n=0;n<rooms.length;n++)for(const p of roomCells(rooms[n].room)){if(p.x<0||p.x>=size||p.z<0||p.z>=size)continue;const i=p.z*size+p.x;if(!owned.has(i)){cells[i]=n;owned.add(i);}}
 for(let i=0;i<cells.length;i++)if(!owned.has(i)){let nearest=Infinity;for(let n=0;n<rooms.length;n++){const p=rooms[n].center,d=(p.x-i%size)**2+(p.z-Math.floor(i/size))**2;if(d<nearest){nearest=d;cells[i]=n;}}}
 return {cells,count:rooms.length,interval:rooms.length>1?Math.min(.2,1.5/(rooms.length-1)):0,duration:.55};
}

const declarations='uniform sampler2D buildRevealMap;\nuniform float buildRevealSpan;\nvarying vec2 buildRevealXZ;\n';
/** Temporary GPU presentation only: geometry, layout and object transforms stay
 * frozen. The original material hooks (including physical pixel UVs) survive. */
export function createBuildReveal(THREE,{world,architecture,size,moduleSize=4.8,onSettle=()=>{},reducedMotion=false}={}){
 const plan=planBuildReveal({architecture,size}),data=new Uint8Array(size*size*4),map=new THREE.DataTexture(data,size,size);
 map.minFilter=map.magFilter=THREE.NearestFilter;map.generateMipmaps=false;map.needsUpdate=true;
 const originals=[],copies=new Map(),hidden=[],culling=[],uniforms={buildRevealMap:{value:map},buildRevealSpan:{value:size*moduleSize}};
 let elapsed=0,done=false,lastFrame=-1,settled=0;
 function temporary(source){if(copies.has(source))return copies.get(source);const material=source.clone(),compile=source.onBeforeCompile,key=source.customProgramCacheKey.bind(source);
  material.onBeforeCompile=(shader,renderer)=>{compile.call(source,shader,renderer);Object.assign(shader.uniforms,uniforms);
   shader.vertexShader=declarations+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`vec4 buildRevealWorld = vec4(transformed, 1.0);
    #ifdef USE_BATCHING
     buildRevealWorld = batchingMatrix * buildRevealWorld;
    #endif
    #ifdef USE_INSTANCING
     buildRevealWorld = instanceMatrix * buildRevealWorld;
    #endif
    buildRevealWorld = modelMatrix * buildRevealWorld;
    buildRevealXZ = buildRevealWorld.xz / buildRevealSpan + .5;
    float buildRevealHeight = texture2D(buildRevealMap, clamp(buildRevealXZ, vec2(0.0), vec2(1.0))).r * 3.0;
    #include <project_vertex>
    gl_Position += projectionMatrix * viewMatrix * vec4(0.0, buildRevealHeight, 0.0, 0.0);`);
   shader.fragmentShader=declarations+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif (texture2D(buildRevealMap, clamp(buildRevealXZ, vec2(0.0), vec2(1.0))).g < .5) discard;');
  };
  material.customProgramCacheKey=()=>key()+':generation-room-drop-v1';copies.set(source,material);return material;
 }
 world?.traverse(o=>{if(o.isLight||o.userData.atmosphere){hidden.push([o,o.visible]);o.visible=false;return;}if(!o.isMesh||!o.material)return;
  originals.push([o,o.material]);o.material=Array.isArray(o.material)?o.material.map(temporary):temporary(o.material);
  culling.push([o,o.frustumCulled,o.castShadow]);o.frustumCulled=false;o.castShadow=false;
 });
 // A mesh whose reveal copy was replaced meanwhile (e.g. by the compatibility
 // fallback) keeps that replacement; its source copy stays alive for it.
 function finish(){if(done)return;done=true;const kept=new Set();for(const [o,material]of originals){const sources=[material].flat(),current=[o.material].flat();if(current.length===sources.length&&current.every((m,i)=>m===copies.get(sources[i])))o.material=material;else for(const source of sources)kept.add(copies.get(source));}for(const [o,value]of hidden)o.visible=value;for(const [o,value,shadow]of culling){o.frustumCulled=value;o.castShadow=shadow;}for(const material of copies.values())if(!kept.has(material))material.dispose();copies.clear();map.dispose();}
 function tick(dt){if(done)return {done:true,settled,total:plan.count};elapsed+=Number.isFinite(dt)?Math.max(0,dt):0;
  const frame=Math.floor(elapsed*30);if(frame===lastFrame)return {done:false,settled,total:plan.count};lastFrame=frame;
  let ready=0;const progress=Array.from({length:plan.count},(_,n)=>Math.max(0,Math.min(1,(elapsed-n*plan.interval)/plan.duration)));
  for(const p of progress)if(p>=1)ready++;
  for(let i=0;i<plan.cells.length;i++){const p=progress[plan.cells[i]],at=i*4;data[at]=Math.round((1-p)**3*255);data[at+1]=p>0?255:0;data[at+3]=255;}map.needsUpdate=true;
  // At most one quiet cue after a suspended/background frame, never a burst.
  if(ready>settled){settled=ready;onSettle();}
  if(ready===plan.count)finish();return {done,settled,total:plan.count};
 }
 if(reducedMotion){settled=plan.count;finish();}else tick(0);
 return {tick,finish,dispose:finish,get done(){return done;},get map(){return map;},plan};
}
