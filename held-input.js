// Local keyboard state is latched until key-up or an explicit lifecycle clear.
// Embedded browsers and simultaneous keys do not reliably emit key repeats.
// A finite lease is opt-in for callers which receive periodic remote packets.
export function createHeldInput({now=()=>performance.now(),timeout=Infinity}={}){
 const held=new Map();
 return {press(key){held.set(key,now()+timeout);},release(key){held.delete(key);},clear(){held.clear();},has(key){const until=held.get(key);if(until===undefined)return false;if(now()>until){held.delete(key);return false;}return true;},get size(){for(const key of held.keys())this.has(key);return held.size;},add(key){this.press(key);},delete(key){this.release(key);}};
}
