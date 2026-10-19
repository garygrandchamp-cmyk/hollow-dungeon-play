export const SECRET_REVEAL_SECONDS=1.65;
export function validateSecretReveals(value,{plans=[],opened=new Set()}={}){
 if(!Array.isArray(value)||value.length>2)return null;const known=new Set(plans.map(p=>p.id)),seen=new Set();
 for(const r of value){if(!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).length!==2||!known.has(r.id)||opened.has(r.id)||seen.has(r.id)||typeof r.elapsed!=='number'||!Number.isFinite(r.elapsed)||r.elapsed<0||r.elapsed>=SECRET_REVEAL_SECONDS)return null;seen.add(r.id);}
 return value.map(r=>({id:r.id,elapsed:r.elapsed}));
}
/** Simulation seconds are host-owned; guests may predict motion but cannot open
 * collision. Session snapshots resume an in-flight slab rather than restarting. */
export function createSecretReveal({plans=()=>[],opened=new Set(),onStart=()=>{},onOpened=()=>{}}={}){
 const pending=new Map();
 const find=id=>plans().find(p=>p.id===id);
 function begin(id){if(!find(id)||opened.has(id)||pending.has(id))return false;pending.set(id,0);onStart(find(id));return true;}
 function snapshot(){return [...pending].map(([id,elapsed])=>({id,elapsed}));}
 function apply(value){const checked=validateSecretReveals(value,{plans:plans(),opened});if(!checked)return false;const prior=new Map(pending);pending.clear();for(const r of checked){pending.set(r.id,Math.max(r.elapsed,prior.get(r.id)??0));if(!prior.has(r.id)&&r.elapsed<.25)onStart(find(r.id));}return true;}
 function tick(dt,{paused=false,remote=false}={}){if(paused)return;dt=Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0;for(const [id,elapsed]of pending){if(opened.has(id)||!find(id)){pending.delete(id);continue;}const next=elapsed+dt;if(next>=SECRET_REVEAL_SECONDS&&!remote){pending.delete(id);onOpened(find(id));}else pending.set(id,Math.min(SECRET_REVEAL_SECONDS-.0001,next));}}
 function motion(id){const elapsed=pending.get(id);if(elapsed===undefined)return null;const t=Math.max(0,Math.min(1,(elapsed-.2)/(SECRET_REVEAL_SECONDS-.2))),ease=t*t*(3-2*t),shake=(1-t)*.012;return {lift:ease*3.9,push:Math.min(1,t*6)*.12,jitterX:Math.sin(elapsed*67)*shake,jitterZ:Math.sin(elapsed*53)*shake};}
 return {begin,tick,motion,snapshot,apply,reset(){pending.clear();},has:id=>pending.has(id)};
}
