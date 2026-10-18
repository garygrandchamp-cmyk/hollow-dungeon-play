const TYPES=new Set(['skeleton','goblin','drowned','skeletal-mage','listener']);
const gap=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export const retrievableCorpse=e=>!!e&&e.hp<=0&&!e.boss&&!e.retrieved&&TYPES.has(e.type)&&!!e.position;
export function parseCrawlerHaul(v,type,size){
 if(v===undefined)return undefined;
 if(type!=='crawler'||!v||typeof v.corpseId!=='string'||!/^enemy:[01]:[1-9][0-9]{0,9}$/.test(v.corpseId)||!Number.isInteger(v.homeIndex)||v.homeIndex<0||v.homeIndex>=size*size||!['approach','drag'].includes(v.phase)||!Number.isFinite(v.remaining)||v.remaining<=0||v.remaining>32)throw TypeError('Invalid crawler retrieval');
 return {corpseId:v.corpseId,homeIndex:v.homeIndex,phase:v.phase,remaining:v.remaining};
}
export function validateCrawlerClaims(enemies){
 const claimed=new Set();
 for(const e of enemies){
  if(e.retrieved!==undefined&&(e.retrieved!==true||e.hp>0||!TYPES.has(e.type)||e.boss))throw TypeError('Invalid retrieved corpse');
  if(!e.haul)continue;
  const corpse=enemies.find(c=>c.id===e.haul.corpseId);
  if(!e.position||e.hp<=0||e.boss||e.controlled||e.intent||!retrievableCorpse(corpse)||claimed.has(corpse.id)||Math.abs(e.position?.y-corpse.position.y)>.45||e.haul.phase==='drag'&&gap(e.position,corpse.position)>1.2)throw TypeError('Invalid corpse claim');
  claimed.add(corpse.id);
 }
}

/** No scene objects or loot ownership here. Only the host ticks these jobs. */
export function createCrawlerRetrieval(){
 const memory=new Map();
 function interrupt(e){delete e.haul;e.target=null;memory.set(e.id,{cooldown:5,scan:0,blocked:0,path:0});}
 function reset(){memory.clear();}
 function tick(e,{dt,now,enemies,heroes,coord,nextStep,visible,move,onEvent=()=>{}}){
  if(e.type!=='crawler'||e.hp<=0||e.boss||e.controlled||e.arrival)return false;
  dt=Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0;
  let m=memory.get(e.id);if(!m){m={cooldown:0,scan:0,blocked:0,path:0};memory.set(e.id,m);}
  m.cooldown=Math.max(0,m.cooldown-dt);m.scan=Math.max(0,m.scan-dt);m.path=Math.max(0,m.path-dt);
  const threatened=heroes.some(p=>Math.abs(p.y-e.position.y)<.6&&gap(p,e.position)<4&&visible(e.position,p));
  if(threatened){if(e.haul)interrupt(e);return false;}
  if(!e.haul){
   if(e.intent||m.cooldown>0||m.scan>0)return false;m.scan=1;
   const claimed=new Set(enemies.filter(c=>c.haul).map(c=>c.haul.corpseId));
   const corpse=enemies.filter(c=>retrievableCorpse(c)&&!claimed.has(c.id)&&Number.isFinite(c.diedAt)&&now-c.diedAt>=1000&&gap(e.position,c.position)<=8&&Math.abs(e.position.y-c.position.y)<.45&&visible(e.position,c.position)).sort((a,b)=>gap(e.position,a.position)-gap(e.position,b.position))[0];
   if(!corpse)return false;
   e.haul={corpseId:corpse.id,homeIndex:e.denIndex??e.index,phase:'approach',remaining:32};e.target=null;m.blocked=0;m.path=0;
  }
  const haul=e.haul,corpse=enemies.find(c=>c.id===haul.corpseId);
  if(!retrievableCorpse(corpse)||Math.abs(e.position.y-corpse.position.y)>.45){interrupt(e);return false;}
  haul.remaining-=dt;if(haul.remaining<=0){interrupt(e);return false;}
  if(haul.phase==='approach'&&gap(e.position,corpse.position)<=.85){haul.phase='drag';e.target=null;m.path=0;onEvent('pickup',e,corpse);}
  const [hx,hz]=coord(haul.homeIndex);
  if(haul.phase==='drag'&&Math.hypot(e.position.x-hx,e.position.z-hz)<.3){corpse.retrieved=true;delete e.haul;e.target=null;m.cooldown=5;onEvent('delivered',e,corpse);return true;}
  const goal=haul.phase==='drag'?haul.homeIndex:corpse.index;
  if(e.target&&gap(e.position,e.target.position)<.12)e.target=null;
  if(!e.target&&m.path===0){
   const next=e.index===goal?goal:nextStep(e.index,goal);m.path=.5;
   if(next!==e.index||next===goal){const [x,z]=next===corpse.index&&haul.phase==='approach'?[corpse.position.x,corpse.position.z]:coord(next);e.target={index:next,position:{x,y:e.position.y,z}};}
  }
  if(e.target){
   const dx=e.target.position.x-e.position.x,dz=e.target.position.z-e.position.z,length=Math.hypot(dx,dz),step=Math.min(length,dt*(haul.phase==='drag'?.6:.75));
   if(length>.01&&step>0){const moved=move(dx/length*step,dz/length*step,haul.phase==='drag'?corpse:null);m.blocked=moved?0:m.blocked+dt;if(!moved&&m.blocked>=.8){interrupt(e);return false;}}
  }else{m.blocked+=dt;if(m.blocked>=1){interrupt(e);return false;}}
  return true;
 }
 return {tick,interrupt,reset,forget(e){delete e.haul;e.target=null;memory.delete(e.id);}};
}
