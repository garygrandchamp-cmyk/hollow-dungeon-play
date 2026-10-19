// Small deterministic host state machines. Timers use simulation dt, never wall
// clock deadlines, so menus, rebuilding and guest rendering cannot finish a hit.
export const ENEMY_BEHAVIORS=Object.freeze({
 'crypt-guardian':Object.freeze({name:'guardian heavy sweep',trigger:2.35,reach:2.4,windup:1.2,recovery:2.8,damage:20,punish:1.75,arc:Math.PI*.7,radius:.34}),
 'deathless-pursuer':Object.freeze({name:'deathless grasp',trigger:2.05,reach:2.15,windup:1.1,recovery:2.4,damage:18,arc:Math.PI*.5,radius:.28}),
 spider:Object.freeze({name:'stalking pounce',trigger:2.2,reach:.78,windup:.9,lunge:.4,lungeSpeed:5,maxTravel:1.85,recovery:2.15,damage:7,punish:1.5,arc:Math.PI*.42,radius:.3,stalkRadius:5,stalkSpeed:2}),
 bat:Object.freeze({name:'diving pass',trigger:3,reach:.85,windup:.65,lunge:.55,lungeSpeed:6.2,maxTravel:3.4,overrun:.8,recovery:1.7,retreat:.7,retreatSpeed:2.5,peel:true,damage:5,punish:1.35,arc:Math.PI*.38,radius:.18}),
 slime:Object.freeze({name:'swelling burst',trigger:2.35,reach:2.4,windup:1.3,recovery:2.6,damage:10,punish:1.65,arc:Math.PI*2,radius:.38,radial:true}),
 listener:Object.freeze({name:'blind claw sweep',trigger:2,reach:2.05,windup:1.05,recovery:2.1,damage:14,punish:1.6,arc:Math.PI*.5,radius:.3}),
 skeleton:Object.freeze({name:'measured strike',trigger:1.4,reach:1.55,windup:.75,recovery:1.65,damage:8,arc:Math.PI*.58,radius:.28}),
 goblin:Object.freeze({name:'quick stab',trigger:1.35,reach:1.5,windup:.45,recovery:.95,damage:8,arc:Math.PI*.48,radius:.25}),
 rat:Object.freeze({name:'skirmisher',trigger:1.05,reach:1.12,windup:.45,recovery:1.65,damage:5,arc:Math.PI*.7,retreat:.65,retreatSpeed:2.4,radius:.18}),
 drowned:Object.freeze({name:'heavy sweep',trigger:2.15,reach:2.2,windup:1.1,recovery:2.35,damage:16,punish:1.5,arc:Math.PI*.58,radius:.34}),
 crawler:Object.freeze({name:'committed lunge',trigger:3,reach:.94,windup:.8,lunge:.45,lungeSpeed:5.2,recovery:1.9,damage:8,punish:1.5,arc:Math.PI*.34,radius:.26}),
});
const finite=(n,max=1e6)=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=max;
const vector=p=>p&&finite(p.x)&&finite(p.y)&&finite(p.z);
const identity=id=>typeof id==='string'&&/^[a-zA-Z0-9_.:-]{1,128}$/.test(id);
const point=p=>({x:p.x,y:p.y??0,z:p.z});
export function serializeEnemyIntent(intent){return intent?{phase:intent.phase,remaining:intent.remaining,origin:point(intent.origin),aim:point(intent.aim),targetId:intent.targetId,hit:!!intent.hit}:null;}
export function parseEnemyIntent(value,type){
 if(value===null)return null;
 if(!ENEMY_BEHAVIORS[type]||!value||!['windup','lunge','recover'].includes(value.phase)||!finite(value.remaining,4)||value.remaining<0||!vector(value.origin)||!vector(value.aim)||!identity(value.targetId)||typeof value.hit!=='boolean')throw TypeError('Invalid enemy intent.');
 const profile=ENEMY_BEHAVIORS[type],duration=value.phase==='windup'?profile.windup:value.phase==='lunge'?profile.lunge:profile.recovery;
 if(!duration||value.remaining>duration+1e-8)throw TypeError('Invalid enemy intent duration.');
 if(value.phase==='lunge'&&!profile.lunge||Math.hypot(value.aim.x-value.origin.x,value.aim.z-value.origin.z)>4||Math.abs(value.aim.y-value.origin.y)>.5)throw TypeError('Invalid enemy attack path.');
 return serializeEnemyIntent(value);
}
export function interruptEnemyIntent(enemy){const p=ENEMY_BEHAVIORS[enemy.type],intent=enemy.intent;if(!p||!intent||!['windup','lunge'].includes(intent.phase))return;intent.phase='recover';intent.remaining=Math.max(.55,p.recovery*.5);intent.hit=true;}
const gap=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
// Shared by movement and its floor warning; the captured aim never follows a dodge.
export const enemyLungeTravel=(intent,profile={})=>Math.max(0,Math.min(profile.maxTravel??2.35,gap(intent.origin,intent.aim)+(profile.overrun??-.38)));
function aimDirection(intent){const x=intent.aim.x-intent.origin.x,z=intent.aim.z-intent.origin.z,length=Math.hypot(x,z);return length>.001?{x:x/length,z:z/length}:{x:0,z:-1};}
function inSwing(intent,position,target,profile){
 if(Math.abs(target.y-position.y)>.45||gap(position,target)>profile.reach)return false;
 const direction=aimDirection(intent),dx=target.x-intent.origin.x,dz=target.z-intent.origin.z,length=Math.hypot(dx,dz);
 return length<.1||(dx*direction.x+dz*direction.z)/length>=Math.cos(profile.arc/2);
}

/** Returns true while this enemy consumes its turn, false for ordinary pursuit.
 * move(dx,dz) performs swept collision checks; strike is host-owned damage.
 */
export function tickEnemyBehavior(enemy,{dt,position,target,visible,canStrike,targets,canStrikeTarget,move,strike,telegraph=()=>{}}){
 const profile=!enemy.boss&&!enemy.controlled&&ENEMY_BEHAVIORS[enemy.type];if(!profile)return false;
 dt=Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0;
 let intent=enemy.intent;
 if(intent){
  if(intent.phase!=='recover'&&(!target||target.id!==intent.targetId||target.alive===false||target.escaped||target.health===0)){interruptEnemyIntent(enemy);intent=enemy.intent;}
  const direction=aimDirection(intent);
  if(intent.phase==='recover'){
   // Rats back off; bats peel sideways from their captured line. Neither homes.
   if(profile.retreat&&intent.remaining>profile.recovery-profile.retreat){const side=Math.floor(intent.origin.x+intent.origin.z)%2===0?1:-1;move((profile.peel?-direction.z*side:-direction.x)*profile.retreatSpeed*dt,(profile.peel?direction.x*side:-direction.z)*profile.retreatSpeed*dt);}
   intent.remaining=Math.max(0,intent.remaining-dt);if(intent.remaining===0)enemy.intent=null;return true;
  }
  intent.remaining=Math.max(0,intent.remaining-dt);
  if(intent.phase==='windup'){
   if(intent.remaining>0)return true;
   if(profile.lunge){intent.phase='lunge';intent.remaining=profile.lunge;return true;}
   if(profile.radial){
    const seen=new Set();for(const candidate of targets??[target]){if(!candidate||seen.has(candidate.id)||candidate.alive===false||candidate.fainted||candidate.escaped||candidate.health<=0)continue;seen.add(candidate.id);
     const clear=typeof canStrikeTarget==='function'?canStrikeTarget(candidate):candidate.id===target?.id&&visible&&(typeof canStrike==='function'?canStrike():canStrike);
     if(clear&&inSwing(intent,intent.origin,candidate.position,profile)){strike(profile.damage,candidate.id);intent.hit=true;}
    }
   }else if(target&&visible&&(typeof canStrike==='function'?canStrike():canStrike)&&inSwing(intent,position,target.position,profile)){strike(profile.damage,intent.targetId);intent.hit=true;}
   intent.phase='recover';intent.remaining=profile.recovery;return true;
  }
  if(intent.phase==='lunge'){
   // Aim is captured once. A sidestep never bends a charge after the target.
   const traveled=(position.x-intent.origin.x)*direction.x+(position.z-intent.origin.z)*direction.z;
   const available=Math.max(0,enemyLungeTravel(intent,profile)-traveled),distance=Math.min(available,profile.lungeSpeed*dt);
   if(distance>0)move(direction.x*distance,direction.z*distance);
   if(!intent.hit&&target&&visible&&(typeof canStrike==='function'?canStrike():canStrike)&&inSwing(intent,position,target.position,profile)){intent.hit=true;strike(profile.damage,intent.targetId);}
   if(intent.remaining===0){intent.phase='recover';intent.remaining=profile.recovery;}return true;
  }
 }
 if(!target||!visible||Math.abs(target.position.y-position.y)>.45)return true;
 const distance=gap(position,target.position);
 if(distance>profile.trigger){
  if(profile.stalkRadius&&distance<=profile.stalkRadius){
   // Each spider hooks around one side while still closing distance. A blocked
   // hook falls back to a direct swept step instead of orbiting into a wall.
   const side=[...String(enemy.id??'spider')].reduce((n,c)=>n+c.charCodeAt(0),0)%2?1:-1;
   const dx=(target.position.x-position.x)/distance,dz=(target.position.z-position.z)/distance,step=profile.stalkSpeed*dt;
   if(!move((dx*.8-dz*.6*side)*step,(dz*.8+dx*.6*side)*step))move(dx*step,dz*step);
   return true;
  }
  return false;
 }
 enemy.intent={phase:'windup',remaining:profile.windup,origin:point(position),aim:point(target.position),targetId:target.id,hit:false};
 telegraph(profile);return true;
}

export function enemyPunishMultiplier(enemy,source='melee'){return source==='melee'&&!enemy.boss&&!enemy.controlled&&enemy.intent?.phase==='recover'&&enemy.intent.hit===false?(ENEMY_BEHAVIORS[enemy.type]?.punish??1):1;}
