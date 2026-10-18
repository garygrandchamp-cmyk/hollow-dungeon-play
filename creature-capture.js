// All durations are simulation seconds. Ownership, target validity, movement,
// damage, resources, cancellation and the six-second release immunity live in
// the caller. This core has no clocks, randomness, actor references or effects.
export const CAPTURE_RULES=Object.freeze({windup:1.2,cocoon:12,actionCooldown:1,escapeActions:4,rescueHits:2,immunity:6});
const KEYS=['enemyId','actorId','floor','origin','phase','remaining','escape','rescue','actionCooldown'];
const CREATE_KEYS=['enemyId','actorId','floor','origin'],POINT_KEYS=['x','y','z'],EPSILON=1e-9;
const plain=value=>value!==null&&typeof value==='object'&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const identity=value=>typeof value==='string'&&/^[a-zA-Z0-9_.:-]{1,128}$/.test(value)&&!['__proto__','prototype','constructor'].includes(value);
const finite=(value,min,max)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
function exact(value,keys,{vector=false}={}){
 if(!value||typeof value!=='object'||!vector&&!plain(value))return false;
 const own=Reflect.ownKeys(value);return own.length===keys.length&&own.every(key=>typeof key==='string'&&keys.includes(key)&&Object.getOwnPropertyDescriptor(value,key)?.enumerable&&Object.hasOwn(Object.getOwnPropertyDescriptor(value,key),'value'));
}
function validIdentity(value){return identity(value.enemyId)&&identity(value.actorId)&&Number.isInteger(value.floor)&&value.floor>=0&&value.floor<=1;}
function validPoint(value,{vector=false}={}){return exact(value,POINT_KEYS,{vector})&&POINT_KEYS.every(key=>finite(value[key],-1e6,1e6));}
function valid(value){
 if(!exact(value,KEYS)||!validIdentity(value)||!validPoint(value.origin)||!Number.isInteger(value.escape)||!Number.isInteger(value.rescue)||!finite(value.escape,0,CAPTURE_RULES.escapeActions)||!finite(value.rescue,0,CAPTURE_RULES.rescueHits)||!finite(value.actionCooldown,0,CAPTURE_RULES.actionCooldown))return false;
 if(value.phase==='released')return value.remaining===0&&value.actionCooldown===0&&!(value.escape===CAPTURE_RULES.escapeActions&&value.rescue===CAPTURE_RULES.rescueHits);
 if(value.phase!=='snare'&&value.phase!=='cocoon'||value.escape>=CAPTURE_RULES.escapeActions||value.rescue>=CAPTURE_RULES.rescueHits)return false;
 if(!finite(value.remaining,0,value.phase==='snare'?CAPTURE_RULES.windup:CAPTURE_RULES.cocoon)||value.remaining===0)return false;
 return value.phase==='snare'?value.escape===0&&value.actionCooldown===0:value.escape>0||value.actionCooldown===0;
}
function requireRecord(record,mutable=false){try{if(valid(record)&&(!mutable||['phase','remaining','escape','rescue','actionCooldown'].every(key=>Object.getOwnPropertyDescriptor(record,key).writable)))return;}catch{}throw TypeError('Invalid creature capture record.');}
const copy=record=>({enemyId:record.enemyId,actorId:record.actorId,floor:record.floor,origin:{x:record.origin.x,y:record.origin.y,z:record.origin.z},phase:record.phase,remaining:record.remaining,escape:record.escape,rescue:record.rescue,actionCooldown:record.actionCooldown});
const result=(changed=false,release=null)=>({changed,release});
function release(record,reason){record.phase='released';record.remaining=0;record.actionCooldown=0;return result(true,reason);}

/** Create from exactly {enemyId,actorId,floor,origin:{x,y,z}}. A Three.js-style
 * vector is accepted for origin here only and copied into plain snapshot data.
 * IDs are 1..128 ASCII letters/digits/_.:-; floor is 0 or 1; XYZ is +/-1e6.
 */
export function createCapture(options){
 try{
  if(exact(options,CREATE_KEYS)&&validIdentity(options)&&validPoint(options.origin,{vector:true}))return {enemyId:options.enemyId,actorId:options.actorId,floor:options.floor,origin:{x:options.origin.x,y:options.origin.y,z:options.origin.z},phase:'snare',remaining:CAPTURE_RULES.windup,escape:0,rescue:0,actionCooldown:0};
 }catch{}
 throw TypeError('Invalid creature capture options.');
}

/** Atomic strict parser: returns a detached mutable record (or null to clear).
 * Throws TypeError for malformed/extra keys, accessors, impossible counters or
 * out-of-range timers. It never repairs, coerces or mutates the input.
 * serializeCapture returns the same detached JSON-safe shape; no JSON text.
 */
export function parseCapture(value){if(value===null)return null;requireRecord(value);return copy(value);}
export function serializeCapture(record){return parseCapture(record);}

/** All operations mutate a valid record and return {changed,release}. release
 * is null or 'timeout'/'escaped'/'rescued', reported exactly once. Terminal
 * phase 'released' remains serializable, and every later operation is a no-op.
 * dt is finite nonnegative seconds clamped to .1; invalid dt acts as zero.
 * Caller pauses by omitting ticks. Time beyond the snare transition carries
 * into the cocoon; it never grants an extra frame of captivity.
 */
export function tickCapture(record,dt){
 requireRecord(record,true);let remaining=Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0;
 if(record.phase==='released'||remaining===0)return result();
 record.actionCooldown=Math.max(0,record.actionCooldown-remaining);if(record.actionCooldown<EPSILON)record.actionCooldown=0;
 if(record.phase==='snare'){
  const used=Math.min(remaining,record.remaining);record.remaining-=used;remaining-=used;
  if(record.remaining<=EPSILON){record.phase='cocoon';record.remaining=CAPTURE_RULES.cocoon;}
 }
 if(record.phase==='cocoon')record.remaining=Math.max(0,record.remaining-remaining);
 if(record.phase==='cocoon'&&record.remaining<=EPSILON)return release(record,'timeout');
 return result(true);
}

/** Each permitted struggle succeeds once, is free, and starts a one-second
 * cooldown. Snare/released/cooldown presses do nothing. Four struggles release.
 */
export function struggleCapture(record){
 requireRecord(record,true);if(record.phase!=='cocoon'||record.actionCooldown>0)return result();
 record.escape++;record.actionCooldown=CAPTURE_RULES.actionCooldown;
 return record.escape===CAPTURE_RULES.escapeActions?release(record,'escaped'):result(true);
}

/** Caller invokes only for a confirmed ordinary melee hit on the restraint.
 * Snare cuts carry into the cocoon; two cuts release. This adds no resource cost
 * or independent hit cooldown; the caller's normal attack timing is authoritative.
 */
export function cutCapture(record){
 requireRecord(record,true);if(record.phase==='released')return result();record.rescue++;
 return record.rescue===CAPTURE_RULES.rescueHits?release(record,'rescued'):result(true);
}
