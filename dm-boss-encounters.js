export const DM_BOSS_ENCOUNTERS=Object.freeze({
 'crypt-guardian':Object.freeze({name:'Crypt Guardian · killable',cost:45,sprite:'drowned',cue:'CRYPT GUARDIAN — killable. Its armored windup cannot be interrupted: dodge the heavy sweep, then punish the recovery.'}),
 'deathless-pursuer':Object.freeze({name:'Deathless Pursuer · cannot kill',cost:65,sprite:'wraith',cue:'DEATHLESS PURSUER — cannot kill. Run, break sight and hide for 3 seconds. A hit repels it briefly.'}),
});
export const PURSUER_RULES=Object.freeze({sight:18,memory:3,repel:2.5,repelCooldown:4,speed:2.5,spawnClearance:8});
const phases=['idle','hunt','search','return','repelled'];
export function parsePursuit(value,type,size){
 if(type!=='deathless-pursuer'||!value||!phases.includes(value.phase)||!Number.isInteger(value.homeIndex)||value.homeIndex<0||value.homeIndex>=size*size||!Number.isInteger(value.lastIndex)||value.lastIndex<0||value.lastIndex>=size*size||!Number.isFinite(value.remaining)||value.remaining<0||value.remaining>3||!Number.isFinite(value.cooldown)||value.cooldown<0||value.cooldown>4||value.targetId!==null&&(typeof value.targetId!=='string'||!/^[-a-zA-Z0-9_:]{1,128}$/.test(value.targetId)))throw TypeError('Invalid deathless pursuit.');
 return {phase:value.phase,homeIndex:value.homeIndex,lastIndex:value.lastIndex,remaining:value.remaining,cooldown:value.cooldown,targetId:value.targetId};
}
export function pursuitState(enemy){return enemy.pursuit??(enemy.pursuit={phase:'idle',homeIndex:enemy.index,lastIndex:enemy.index,remaining:0,cooldown:0,targetId:null});}
export function repelPursuer(enemy){
 if(enemy.type!=='deathless-pursuer')return false;
 const p=pursuitState(enemy);if(p.cooldown>0)return false;
 p.phase='repelled';p.remaining=PURSUER_RULES.repel;p.cooldown=PURSUER_RULES.repelCooldown;enemy.intent=null;enemy.target=null;return true;
}
export const pursuerBlocks=enemy=>enemy.type!=='deathless-pursuer'||['hunt','search'].includes(enemy.pursuit?.phase);
// Returns true when the pursuit owns this turn. Only a currently visible quarry
// can enter the ordinary warned melee state machine. No hidden position tracking.
export function tickDeathlessPursuit(enemy,{dt,target,visible,moveToward,onAcquire=()=>{}}){
 const p=pursuitState(enemy),step=Number.isFinite(dt)?Math.min(.1,Math.max(0,dt)):0;
 p.cooldown=Math.max(0,p.cooldown-step);
 if(p.phase==='repelled'){p.remaining=Math.max(0,p.remaining-step);enemy.target=null;enemy.intent=null;if(!p.remaining)p.phase='return';return true;}
 if(visible&&target&&target.alive!==false&&!target.escaped&&target.health>0){
  if(!['hunt','search'].includes(p.phase))onAcquire();p.phase='hunt';p.remaining=PURSUER_RULES.memory;p.lastIndex=target.index;p.targetId=target.id;return false;
 }
 enemy.intent=null;enemy.target=null;
 if(['hunt','search'].includes(p.phase)){p.phase='search';p.remaining=Math.max(0,p.remaining-step);if(p.remaining>0){moveToward(p.lastIndex,PURSUER_RULES.speed);return true;}p.phase='return';p.targetId=null;}
 if(p.phase==='return'&&moveToward(p.homeIndex,PURSUER_RULES.speed*.7))p.phase='idle';
 return true;
}
