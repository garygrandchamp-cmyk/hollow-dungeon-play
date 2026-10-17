// Milliseconds from an accepted action's start, not from its impact. Recovery
// includes windup and follow-through; it is not added after animationMs.
const bounded=(value,min,max,fallback)=>Math.round(Math.max(min,Math.min(max,Number.isFinite(value)?value:fallback)));
function timing(impact,recovery,animation){
 const recoveryMs=bounded(recovery,400,2000,700),animationMs=bounded(animation,140,recoveryMs,280),impactMs=bounded(impact,0,animationMs,140);
 return Object.freeze({impactMs,recoveryMs,animationMs});
}
const sword=timing(140,700,280),heavy=timing(140,900,280);
const catalog=Object.freeze({
 dagger:timing(140,500,280),
 sword,axe:heavy,mace:heavy,hammer:heavy,
 // Staff/wand strikes are melee. Casting explicitly asks for "magic".
 staff:sword,wand:sword,
 bow:timing(0,800,280),
 magic:timing(0,650,380)
});

/** Pure immutable timing profile for a weapon family (not a generated item ID).
 * Unknown/malformed kinds use sword timing. Melee impacts match the midpoint
 * of the established 280ms sweep; recovery is deliberately longer than motion.
 * Bow keeps immediate projectile release; this adds recovery, not a draw phase.
 * Magic keeps its existing immediate release and 650ms cooldown. This catalog
 * does not schedule actions, spend resources, change guard or resolve hits.
 */
export function combatTiming(kind){
 const key=typeof kind==='string'?kind.trim().toLowerCase():'';
 return Object.hasOwn(catalog,key)?catalog[key]:sword;
}

/** A raised shield covers a 120-degree horizontal arc in front of its owner.
 * Unknown/overlapping origins cannot establish a block direction. */
export function shieldCovers({guarding,position,yaw,forward,source}={}){
 if(!guarding||![position?.x,position?.z,source?.x,source?.z].every(Number.isFinite))return false;
 const dx=source.x-position.x,dz=source.z-position.z,length=Math.hypot(dx,dz);
 if(length<.05)return false;
 let fx,fz;if(Number.isFinite(yaw)){fx=-Math.sin(yaw);fz=-Math.cos(yaw);}else{fx=forward?.x;fz=forward?.z;}
 if(![fx,fz].every(Number.isFinite))return false;const heading=Math.hypot(fx,fz);if(heading<.001)return false;
 return (dx*fx+dz*fz)/(length*heading)>=.5-1e-9;
}
