/** An uncleared cage skips its release while this many of its rats still live. */
export const RAT_CAGE_LIVING_LIMIT=3;
/** Queue cage releases until after hazard iteration, since spawning rebuilds meshes. */
export function createRatCageSpawner({spawn}={}){
 if(typeof spawn!=='function')throw TypeError('A rat spawner is required.');
 let seed=null;const pending=[],seen=new Set();
 function reset(){seed=null;pending.length=0;seen.clear();}
 function scope(value){if(seed!==value){reset();seed=value;}}
 return {reset,enqueue(event,world){scope(world.seed);if(!event||typeof event.id!=='string'||!event.id.length||event.id.length>256||!Number.isInteger(event.index)||event.index<0||!Number.isInteger(world.floor)||world.floor<0||world.floor>1||seen.has(event.id)||pending.length>=8)return false;seen.add(event.id);if(seen.size>256)seen.delete(seen.values().next().value);pending.push({id:event.id,index:event.index,floor:world.floor,seed:world.seed});return true;},flush(world){scope(world.seed);if(!world.enabled){pending.length=0;return false;}while(pending.length){const event=pending.shift();if(event.floor!==world.floor)continue;return spawn(event)!==false;}return false;},get pending(){return pending.length;}};
}
