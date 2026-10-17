import {normalize} from './wall-model.js?v=d14ae9e96020f46d16650159fcf6f9538e196d06';

export const SIGHT_DAMAGE_PRESETS=Object.freeze({none:'No sight-only damage',slit:'Narrow arrow slit',viewhole:'Jagged viewing hole'});
export function applySightDamagePreset(preset,current={},seed='wall') {
  if(!Object.hasOwn(SIGHT_DAMAGE_PRESETS,preset))preset='none';
  if(preset==='none')return normalize({...current,sightDamage:'none',opening:'none',width:Math.max(.6,current.width??1.1)});
  const shared={...current,height:Math.max(2.4,current.height??2.4),ruin:.18,weather:Math.max(.75,current.weather??0),style:'empty',detail:'plain',offset:current.offset??0,sightSeed:String(seed)};
  if(preset==='slit')return normalize({...shared,sightDamage:'slit',opening:'gothic',width:.14,sill:.7,openingHeight:1.35});
  return normalize({...shared,sightDamage:'viewhole',opening:'square',width:.95,sill:1.1,openingHeight:.6});
}
export function jaggedViewingHole(p) {
  let state=2166136261;for(const c of String(p.sightSeed??'wall'))state=Math.imul(state^c.charCodeAt(0),16777619);
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)|0;return(state>>>0)/4294967296;};
  const center=p.sill+p.openingHeight/2,points=[];
  for(let i=0;i<22;i++){const a=i*Math.PI*2/22,r=.68+random()*.32;points.push([p.offset+Math.cos(a)*p.width/2*r,center+Math.sin(a)*p.openingHeight/2*r]);}
  return points;
}
