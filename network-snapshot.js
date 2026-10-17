import {CLASSES} from './party-campaign.js?v=3f0ffbf381cf1b61530dcf3d344db19a8e832b7d';
const finite=(x,min,max)=>typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max;
const plain=x=>x&&typeof x==='object'&&!Array.isArray(x);
const id=x=>typeof x==='string'&&/^[a-zA-Z0-9_.:-]{1,128}$/.test(x);
/** Validate host simulation fields before the guest changes any player pose. */
export function validateSessionState(value,size){
 if(!plain(value)||value.version!==1||!Number.isInteger(size)||!Number.isInteger(value.floor)||value.floor<0||value.floor>1||!plain(value.run)||!['lobby','active','partyVictory','dmVictory'].includes(value.run.phase)||!Array.isArray(value.actors)||value.actors.length!==3)return false;
 if(!Number.isSafeInteger(value.run.runNumber)||value.run.runNumber<0||!Number.isInteger(value.run.requiredObjectives)||value.run.requiredObjectives<0||value.run.requiredObjectives>64||!Array.isArray(value.run.objectives)||value.run.objectives.length>64||value.run.objectives.some(k=>!id(k)))return false;
 const bound=size*4.8/2+5;
 for(const [index,a]of value.actors.entries()){
  if(!plain(a)||a.id!=='hero-'+(index+1)||!CLASSES[a.classId]||!plain(a.position)||!finite(a.position.x,-bound,bound)||!finite(a.position.z,-bound,bound)||!finite(a.position.y,-10,20)||!finite(a.yaw,-1e6,1e6)||!finite(a.pitch,-1.6,1.6)||!finite(a.maxHealth,1,11000)||!finite(a.health,0,a.maxHealth)||!finite(a.maxMana,1,10000)||!finite(a.mana,0,a.maxMana)||!finite(a.maxStamina,1,10000)||!finite(a.stamina,0,a.maxStamina)||typeof a.alive!=='boolean'||typeof a.escaped!=='boolean'||typeof a.fainted!=='boolean'||!Number.isSafeInteger(a.gold)||a.gold<0||a.gold>1e9||!plain(a.equipment))return false;
  if(a.offhand!==undefined&&!['shield','magic','torch'].includes(a.offhand)||a.torchFuel!==undefined&&!finite(a.torchFuel,0,120)||a.torchLit!==undefined&&typeof a.torchLit!=='boolean')return false;
  for(const slot of ['weapon','offhand'])if(!id(a.equipment[slot]?.id))return false;
 }
 if(!Array.isArray(value.open)||value.open.length!==2||value.open.some(f=>!Array.isArray(f)||f.length>size*size*4||f.some(k=>typeof k!=='string'||!/^\d+:\d+$/.test(k))))return false;
 if(!Array.isArray(value.collected)||value.collected.length!==2||value.collected.some(f=>!Array.isArray(f)||f.length>64||f.some(i=>!Number.isInteger(i)||i<0||i>=size*size)))return false;
 return true;
}
