// Small deterministic host state machines. Timers use simulation dt, never wall
// clock deadlines, so menus, rebuilding and guest rendering cannot finish a hit.
export const ENEMY_BEHAVIORS=Object.freeze({
 rat:Object.freeze({name:'skirmisher',trigger:1.05,reach:1.12,windup:.45,recovery:1.65,damage:5,arc:Math.PI*.7,retreat:.65,retreatSpeed:2.4,radius:.18}),
 drowned:Object.freeze({name:'heavy sweep',trigger:2.15,reach:2.2,windup:1.1,recovery:2.35,damage:16,arc:Math.PI*.58,radius:.34}),
 crawler:Object.freeze({name:'committed lunge',trigger:3,reach:.94,windup:.8,lunge:.45,lungeSpeed:5.2,recovery:1.9,damage:8,arc:Math.PI*.34,radius:.26}),
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
 if(value.phase==='lunge'&&type!=='crawler'||Math.hypot(value.aim.x-value.origin.x,value.aim.z-value.origin.z)>4||Math.abs(value.aim.y-value.origin.y)>.5)throw TypeError('Invalid enemy attack path.');
 return serializeEnemyIntent(value);
}
export function interruptEnemyIntent(enemy){const p=ENEMY_BEHAVIORS[enemy.type],intent=enemy.intent;if(!p||!intent)return;intent.phase='recover';intent.remaining=Math.max(.55,p.recovery*.5);intent.hit=true;}
const gap=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
// Shared by movement and its floor warning; the captured aim never follows a dodge.
export const enemyLungeTravel=intent=>Math.max(0,Math.min(2.35,gap(intent.origin,intent.aim)-.38));
function aimDirection(intent){const x=intent.aim.x-intent.origin.x,z=intent.aim.z-intent.origin.z,length=Math.hypot(x,z);return length>.001?{x:x/length,z:z/length}:{x:0,z:-1};}
function inSwing(intent,position,target,profile){
 if(Math.abs(target.y-position.y)>.45||gap(position,target)>profile.reach)return false;
 const direction=aimDirection(intent),dx=target.x-intent.origin.x,dz=target.z-intent.origin.z,length=Math.hypot(dx,dz);
 return length<.1||(dx*direction.x+dz*direction.z)/length>=Math.cos(profile.arc/2);
}

/** Returns true while this enemy consumes its turn, false for ordinary pursuit.
 * move(dx,dz) performs swept collision checks; strike is host-owned damage.
 */
export function tickEnemyBehavior(enemy,{dt,position,target,visible,canStrike,move,strike,telegraph=()=>{}}){
 const profile=!enemy.boss&&!enemy.controlled&&ENEMY_BEHAVIORS[enemy.type];if(!profile)return false;
 dt=Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0;
 let intent=enemy.intent;
 if(intent){
  if(intent.phase!=='recover'&&(!target||target.id!==intent.targetId||target.alive===false||target.escaped||target.health===0)){interruptEnemyIntent(enemy);intent=enemy.intent;}
  const direction=aimDirection(intent);
  if(intent.phase==='recover'){
   // The rat yields a real punish window, backing along its committed heading.
   if(profile.retreat&&intent.remaining>profile.recovery-profile.retreat)move(-direction.x*profile.retreatSpeed*dt,-direction.z*profile.retreatSpeed*dt);
   intent.remaining=Math.max(0,intent.remaining-dt);if(intent.remaining===0)enemy.intent=null;return true;
  }
  intent.remaining=Math.max(0,intent.remaining-dt);
  if(intent.phase==='windup'){
   if(intent.remaining>0)return true;
   if(profile.lunge){intent.phase='lunge';intent.remaining=profile.lunge;return true;}
   if(target&&visible&&(typeof canStrike==='function'?canStrike():canStrike)&&inSwing(intent,position,target.position,profile)){strike(profile.damage,intent.targetId);intent.hit=true;}
   intent.phase='recover';intent.remaining=profile.recovery;return true;
  }
  if(intent.phase==='lunge'){
   // Aim is captured once. A sidestep never bends the crawler's path after you.
   const traveled=(position.x-intent.origin.x)*direction.x+(position.z-intent.origin.z)*direction.z;
   const available=Math.max(0,enemyLungeTravel(intent)-traveled),distance=Math.min(available,profile.lungeSpeed*dt);
   if(distance>0)move(direction.x*distance,direction.z*distance);
   if(!intent.hit&&target&&visible&&(typeof canStrike==='function'?canStrike():canStrike)&&inSwing(intent,position,target.position,profile)){intent.hit=true;strike(profile.damage,intent.targetId);}
   if(intent.remaining===0){intent.phase='recover';intent.remaining=profile.recovery;}return true;
  }
 }
 if(!target||!visible||Math.abs(target.position.y-position.y)>.45)return true;
 if(gap(position,target.position)>profile.trigger)return false;
 enemy.intent={phase:'windup',remaining:profile.windup,origin:point(position),aim:point(target.position),targetId:target.id,hit:false};
 telegraph(profile);return true;
}
