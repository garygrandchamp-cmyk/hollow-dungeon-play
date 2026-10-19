import {buildPendulumAxe,axeHitsActor} from './pendulum-axe.js?v=28087f36e96cab39a5b5228b003dd8e7b5ca069a';
import {roomContainsTile} from './room-footprint.js?v=28087f36e96cab39a5b5228b003dd8e7b5ca069a';
import {random} from './wfc.js?v=28087f36e96cab39a5b5228b003dd8e7b5ca069a';
import {makeDungeonProp as makePropSprite} from './dungeon-props.js?v=28087f36e96cab39a5b5228b003dd8e7b5ca069a';
import {batchStaticGroup} from './mesh-batch.js?v=28087f36e96cab39a5b5228b003dd8e7b5ca069a';

export const HAZARD_KINDS=Object.freeze(['pit','spikes','crate','rubble','swinging-axe','rolling-ball','rat-cage','wall-spikes']);
const TRAPS=new Set(HAZARD_KINDS.filter(k=>!['crate','rubble'].includes(k)));
function reservedCells(s){
 const {architecture:a,size:n}=s,out=new Set([a.start,a.start+1,a.stair,a.stair+1,a.stair-1,a.stair-n,a.stair+n,a.start-n-1,a.start-n+1]);
 for(const list of [s.objectives,s.relics,s.keyLocations,s.keys,s.reservedIndices,a.objectives,a.relics,a.keys,a.keyLocations]){
  if(!Array.isArray(list)&&!(list instanceof Set))continue;
  for(const item of list){const i=Number.isInteger(item)?item:item?.index;if(Number.isInteger(i))out.add(i);}
 }
 return out;
}
export function canPlaceHazard(s,index,kind,requireMount=true){
 if(!s?.architecture||!Number.isInteger(index)||index<0||index>=s.size*s.size||!s.tiles?.[s.grid?.[index]]?.s.some(v=>v===1))return false;
 const x=index%s.size,z=Math.floor(index/s.size),a=s.architecture;
 if(kind==='wall-spikes')return !s.tiles[s.grid[index]].s.includes(2)&&!reservedCells(s).has(index)&&Math.abs(x-a.start%s.size)+Math.abs(z-Math.floor(a.start/s.size))>2&&(!requireMount||!!wallMount(s,index));
 return s.tiles[s.grid[index]].s.every(v=>v===1)&&!reservedCells(s).has(index)&&Math.abs(x-a.start%s.size)+Math.abs(z-Math.floor(a.start/s.size))>2&&a.rooms.some(r=>[[0,0],[0,-1],[1,0],[0,1],[-1,0]].every(([dx,dz])=>roomContainsTile(r,x+dx,z+dz)));
}
function wallMount(s,index){
 try{const m=s.wallMount?.(index);return m&&['x','z','dx','dz'].every(k=>Number.isFinite(m[k]))&&Math.abs(Math.hypot(m.dx,m.dz)-1)<1e-6?m:null;}catch{return null;}
}
export function hazardPlan(s){
 if(s.enabled===false)return [];
 const rng=random(s.seed+'-hazards'),candidates=[];
 for(let index=0;index<s.size*s.size;index++)if(canPlaceHazard(s,index))candidates.push({index,order:rng()});
 candidates.sort((a,b)=>a.order-b.order);
 // First four legacy kinds remain present before the three additional traps.
 return candidates.slice(0,9).map(({index},j)=>({index,kind:HAZARD_KINDS[j%HAZARD_KINDS.length]==='wall-spikes'?'spikes':HAZARD_KINDS[j%HAZARD_KINDS.length],phase:rng()*5,cleared:false}));
}
export function createHazards({THREE,world,box,mat,coord,state,hurt,reward,respawn,notify,sfx=()=>{},canReach=()=>true,onReset=()=>{}}){
 let items=[],visuals=[],guides=[],saved=new Map(),enabled=true,activeKey=null,clock=0,noticeEpoch=0;
 const panel=document.createElement('details');panel.innerHTML='<summary>Traps & obstacles +</summary><div class="toggle-row"><label for="hazardsEnabled">Pits, spike plates & barricades</label><input id="hazardsEnabled" type="checkbox" checked></div><p class="editor-help">Search tiles to mark traps. E disarms mechanisms or searches containers. Hidden traps give a brief positional sound just before firing. Search your current tile to reveal mechanisms.</p>';document.querySelector('aside').appendChild(panel);
 document.getElementById('hazardsEnabled').onchange=e=>{enabled=e.target.checked;state().rebuild?.();};
 function checkedNotice(message,check){if(!Number.isInteger(check?.roll)){notify(message);return;}const token=noticeEpoch,s=state(),key=s.seed+':'+s.floor,owner=s.actorId;const timer=setTimeout(()=>{const current=state();if(token===noticeEpoch&&key===current.seed+':'+current.floor)notify((owner&&owner!=='solo'?owner+' - ':'')+message);},1120);timer?.unref?.();}
 function ground(position,index){const s=state();if(!s.groundHeight)return 0;const y=s.groundHeight({x:position.x,y:position.y,z:position.z,index});return Number.isFinite(y)?y:null;}
 function onGround(position,index){const y=ground(position,index);return y!==null&&Math.abs(position.y-y)<.3;}
 const allowed=()=>{const s=state();return !s.remote&&!s.paused&&onGround(s.position);};
 function prepare(){
  const s=state();activeKey=s.seed+':'+s.floor;
  if(!saved.has(activeKey)){if(saved.size>=32)saved.delete(saved.keys().next().value);saved.set(activeKey,hazardPlan({...s,enabled:true}));}
  items=enabled?saved.get(activeKey).filter(i=>canPlaceHazard(s,i.index,i.kind,false)):[];visuals=[];guides=[];
 }
 function own(mesh){mesh.userData.ownGeometry=true;return mesh;}
 function syncVisibility(v){
  if(!TRAPS.has(v.item.kind))return;
  const revealed=!!(v.item.activated||v.item.discovered||v.item.cleared);
  v.g.visible=revealed;if(v.marker)v.marker.visible=!!v.item.discovered&&!v.item.cleared;
  if(v.cover)v.cover.visible=!revealed;
 }
 function prepareView({overhead=false}={}){
  const old=[];const set=(o,value)=>{if(o){old.push([o,o.visible]);o.visible=value;}};
  for(const v of visuals)if(TRAPS.has(v.item.kind)){
   const revealed=!!(v.item.activated||v.item.discovered||v.item.cleared);
   set(v.g,overhead||revealed);set(v.marker,!v.item.cleared&&(overhead||!!v.item.discovered));set(v.cover,!overhead&&!revealed);
  }
  for(const guide of guides)set(guide,overhead);
  return()=>{for(const [o,visible]of old)o.visible=visible;};
 }
 function cue(v,key){
  if(v.soundKey===key)return;v.soundKey=key;const s=state();
  const listeners=(s.listeners??[{position:s.position,forward:s.forward}]).filter(a=>a?.position);
  const listener=listeners.sort((a,b)=>a.position.distanceToSquared(v.g.position)-b.position.distanceToSquared(v.g.position))[0];if(!listener)return;
  const dx=v.g.position.x-listener.position.x,dz=v.g.position.z-listener.position.z,distance=Math.hypot(dx,dz,v.g.position.y-listener.position.y);
  const forward=listener.forward??{x:0,z:-1};
  sfx('trap-ready',{distance,pan:(dx*-forward.z+dz*forward.x)/Math.max(1,distance),occluded:!!s.combatVisible&&!s.combatVisible(listener.position,v.g.position)});
 }
 function mechanism(v,period,fire,active){
  const seconds=clock*.001+v.item.phase,cycle=((seconds%period)+period)%period;
  if(v.item.cleared)return;
  if(active&&!state().remote)v.item.activated=true;
  for(const at of fire)if(cycle>=at-.3&&cycle<at)cue(v,Math.floor(seconds/period)+':'+at);
 }
 function buildOne(item){
  const stone=mat('pitStone',0x514f48),black=mat('pitBottom',0x090a0b),iron=mat('trapIron',0x454b49,{metalness:.6}),wood=mat('supplyCrate',0x59452e);
  let [x,z]=coord(item.index);const mount=item.kind==='wall-spikes'?wallMount(state(),item.index):null;if(item.kind==='wall-spikes'&&!mount)throw Error('Wall spikes need a solid mounting wall.');if(mount){x=mount.x;z=mount.z;}const g=new THREE.Group();g.name='hazard:'+item.kind;g.userData.hazardIndex=item.index;
  const y=ground({x,y:state().position.y,z},item.index);g.position.set(x,y??state().position.y,z);world.add(g);const v={item,g,mount,lastHit:new Map(),pulses:new Map()};g.userData.dynamic=TRAPS.has(item.kind);
  if(TRAPS.has(item.kind)){
   const marker=own(new THREE.Mesh(new THREE.RingGeometry(.9,1,4),new THREE.MeshBasicMaterial({color:0x7eb9ae,side:THREE.DoubleSide,depthWrite:false})));
   marker.rotation.x=-Math.PI/2;marker.position.y=.18;marker.visible=!!item.discovered;marker.userData.dynamic=true;marker.userData.disposeMaterials=()=>marker.material.dispose();g.add(marker);v.marker=marker;
  }
  if(item.kind==='pit'){
   for(const sign of [-1,1]){box(g,sign*1.64,-1.15,0,.10,2.4,3.28,stone);box(g,0,-1.15,sign*1.64,3.28,2.4,.10,stone);}box(g,0,-2.4,0,3.35,.1,3.35,black);
   for(const dx of [-1.75,1.75])for(const dz of [-1.4,0,1.4]){const b=box(g,dx,.12,dz,.24,.21,.35,stone);b.rotation.y=dx+dz;}batchStaticGroup(THREE,g);
   const cover=new THREE.Group();cover.name='hidden-pit-floor';cover.position.copy(g.position);cover.userData.dynamic=true;cover.userData.hazardIndex=item.index;world.add(cover);v.cover=cover;
   box(cover,0,-.1625,0,3.2,.475,3.2,mat('module-floor-mortar',0x454337));
   const floorMaterial=mat('paver-'+(state().floorStyleAt?.(item.index)??state().floorStyle??'flagstone'),0xd9d1c1);
   for(const cx of [-1.6,0,1.6])for(const cz of [-1.6,0,1.6]){const l=Math.max(-1.6,cx-.76),r=Math.min(1.6,cx+.76),n=Math.max(-1.6,cz-.76),f=Math.min(1.6,cz+.76);box(cover,(l+r)/2,-.17,(n+f)/2,r-l,.54,f-n,floorMaterial);}
  }
  if(item.kind==='spikes'){
   const plate=own(new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.2,.1,12),iron));plate.position.y=.06;g.add(plate);
   v.spikes=new THREE.Group();v.spikes.userData.kind='spikes';v.spikes.userData.dynamic=true;g.add(v.spikes);
   const columns=new THREE.Group();v.spikes.add(columns);const geometry=new THREE.ConeGeometry(.14,1.1,4);
   for(const xx of [-.9,-.45,0,.45,.9])for(const zz of [-.9,-.45,0,.45,.9])if(Math.hypot(xx,zz)<=1.05){const spike=own(new THREE.Mesh(geometry,iron));spike.position.set(xx,.65,zz);columns.add(spike);}
   batchStaticGroup(THREE,columns);v.spikes.userData.animate=({active=false})=>{columns.position.y=active?0:-1.3;v.spikes.userData.frame=active?1:0;};v.spikes.userData.animate({});
  }
  if(item.kind==='crate'){g.position.x+=.9;g.add(makePropSprite(THREE,{kind:'crate',height:1.05,seed:item.index}));g.visible=!item.cleared;}
  if(item.kind==='rubble'){g.position.x-=.9;g.add(makePropSprite(THREE,{kind:'rubble',height:.7,seed:item.index}));}
  if(item.kind==='swinging-axe'){v.pendulum=buildPendulumAxe(THREE,g,{box,mat}).pendulum;}
  if(item.kind==='rolling-ball'){
   v.ball=own(new THREE.Mesh(new THREE.IcosahedronGeometry(1.05,1),stone));v.ball.position.set(0,1.05,-1.75);g.add(v.ball);
   for(const dz of [-1.95,1.95])box(g,0,.1,dz,1.55,.2,.16,iron);
  }
  if(item.kind==='rat-cage'){
   v.cage=new THREE.Group();v.cage.position.y=2.5;v.cage.scale.set(1.6,1.4,1.6);g.add(v.cage);
   for(const dx of [-.55,.55])for(const dz of [-.55,.55])box(v.cage,dx,.55,dz,.07,1.1,.07,iron);
   for(const yy of [0,1.1])box(v.cage,0,yy,0,1.2,.08,1.2,iron);
   for(const d of [-.25,0,.25])for(const sign of [-1,1]){box(v.cage,d,.55,sign*.55,.04,1.1,.04,iron);box(v.cage,sign*.55,.55,d,.04,1.1,.04,iron);}
   box(g,0,3.5,0,.06,1.8,.06,iron);
  }
  if(item.kind==='wall-spikes'){
   g.rotation.y=Math.atan2(mount.dx,mount.dz);
   box(g,0,1.05,0,2.6,1.8,.18,iron);v.thrust=new THREE.Group();g.add(v.thrust);
   for(const xx of [-1,-.5,0,.5,1])for(const yy of [.55,1.15,1.75]){
    const spike=own(new THREE.Mesh(new THREE.ConeGeometry(.12,1.9,4),iron));spike.rotation.x=Math.PI/2;spike.position.set(xx,yy,.95);v.thrust.add(spike);
   }
   v.thrust.scale.z=.001;
  }
  syncVisibility(v);visuals.push(v);return v;
 }
 function build(){for(const item of items)if(item.kind!=='wall-spikes'||wallMount(state(),item.index))buildOne(item);}
 function blocks(x,z,r=.18,feet=state().position.y){return visuals.some(({item,g})=>!item.cleared&&['crate','rubble'].includes(item.kind)&&Math.abs(feet-g.position.y)<.3&&Math.abs(x-g.position.x)<.57+r&&Math.abs(z-g.position.z)<.57+r);}
 function nearby(kind){if(!allowed())return null;const s=state();return visuals.find(v=>(typeof kind==='function'?kind(v.item):v.item.kind===kind)&&!v.item.cleared&&v.g.position.distanceTo(s.position)<1.8&&canReach(v.item.index,v.g.position));}
 function stop(v){v.item.cleared=true;v.spikes?.userData.animate?.({active:false});syncVisibility(v);}
 function interact(){
  const v=nearby(i=>TRAPS.has(i.kind)&&i.kind!=='pit'&&(i.discovered||i.activated));
  if(!v){
   const container=nearby('crate')??nearby('rubble');if(!container)return false;
   const s=state(),id='hazard:'+s.floor+':'+container.item.index;
   if(s.searchContainer)return s.searchContainer({id,name:container.item.kind==='crate'?'Supply crate':'Rubble cache',dc:10,onUnlock:()=>{container.item.searched=true;}});
   if(container.item.searched)return false;const roll=s.attemptAction?.('search',{dc:10});if(roll&&!roll.allowed)return true;if(roll&&!roll.success){checkedNotice('Search failed. Nothing found.',roll);return true;}
   container.item.searched=true;reward(8);s.onLoot?.(container.item.index);checkedNotice('Cache searched. +8 gold.',roll);return true;
  }
  const roll=state().attemptAction?.('disarm',{dc:v.item.kind==='spikes'?11:13});if(roll&&!roll.allowed)return true;if(roll&&!roll.success){checkedNotice('Disarm failed. The trap is still armed.',roll);return true;}
  stop(v);reward(5);checkedNotice('Trap mechanism disarmed. +5 gold.',roll);return true;
 }
 function attack(){const v=nearby('crate');if(!v)return false;if(state().attemptAction&&!state().attemptAction('attack').allowed)return true;v.item.cleared=true;v.g.visible=false;reward(12);notify('Supply crate smashed. +12 gold.');return true;}
 function strike(v,amount,message,range=1){const s=state(),p=s.position,id=s.actorId??'solo';if(allowed()&&Math.abs(p.y-v.g.position.y)<.3&&Math.hypot(p.x-v.g.position.x,p.z-v.g.position.z)<range&&clock-(v.lastHit.get(id)??-Infinity)>=700){v.lastHit.set(id,clock);hurt(amount,message);}}
 function tick(dt,now){
  if(state().paused)return;clock+=state().remote?0:Math.max(0,Math.min(.1,Number.isFinite(dt)?dt:0))*1000;
  for(const v of visuals){
   const {item,g}=v,trapPhase=(clock*.001+item.phase)%4;
   if(item.kind==='spikes'){
    const raised=trapPhase>2.8&&!item.cleared;v.spikes.visible=true;v.spikes.userData.animate({time:clock,active:raised});mechanism(v,4,[2.8],raised);
    if(raised)strike(v,12,'Spikes! Disarm the copper plate with E.',1.2);
   }
   if(item.kind==='swinging-axe'){
    const swing=Math.sin(trapPhase*Math.PI/2)*.95;v.pendulum.rotation.z=item.cleared ? .95 : swing;
    const edge=2-Math.asin(Math.acos((3.4-1.6)/2.75)/.95)/(Math.PI/2);mechanism(v,4,[edge,edge+2],3.4-Math.cos(swing)*2.75<1.6);
    const bladeY=3.4-Math.cos(swing)*2.75,p=state().position;
    if(!item.cleared&&bladeY<1.6&&axeHitsActor(p,g.position,swing))strike(v,18,'The pendulum axe sweeps through the lane!',3.1);
   }
   if(item.kind==='rolling-ball'){
    const cycle=(clock*.001+item.phase)%5,travel=cycle>=1.2&&cycle<3.6,t=Math.max(0,Math.min(1,(cycle-1.2)/2.4));
    v.ball.position.z=-1.75+t*3.5;v.ball.rotation.x=t*6;mechanism(v,5,[1.2],travel);v.ball.visible=!item.cleared;
    const p=state().position;if(travel&&!item.cleared&&Math.hypot(p.x-g.position.x,p.z-g.position.z-v.ball.position.z)<1.2)strike(v,16,'A rolling boulder crashes through the lane!',3.2);
   }
   if(item.kind==='rat-cage'){
    const cycle=(clock*.001+item.phase)%6;v.cage.position.y=item.cleared?2.5:cycle<1.2?2.5:Math.max(0,2.5-(cycle-1.2)*8);mechanism(v,6,[1.2],cycle>=1.2&&cycle<4.8);
    if(!item.cleared&&cycle>=1.5&&cycle<4.8){
     const pulse=Math.floor((cycle-1.5)/.8),lap=Math.floor((clock*.001+item.phase)/6),id=state().actorId??'solo',key=lap+':'+pulse;
     if(v.pulses.get(id)!==key){v.pulses.set(id,key);strike(v,6,'Rats swarm from the fallen cage!',1.7);}
     if(v.pulse!==pulse||v.cycle!==lap){
      v.pulse=pulse;v.cycle=lap;
      if(pulse===0&&!state().remote&&state().spawnRats){try{state().spawnRats({index:item.index,position:g.position.clone(),id:'rat-cage:'+activeKey+':'+item.index+':'+lap});}catch{/* Optional host spawner unavailable. */}}
     }
    }
   }
   if(item.kind==='wall-spikes'){
    const cycle=(clock*.001+item.phase)%4,extended=cycle>=1.2&&cycle<1.85&&!item.cleared;mechanism(v,4,[1.2],extended);v.thrust.scale.z=extended?1:.001;
    const p=state().position,dx=p.x-g.position.x,dz=p.z-g.position.z,along=dx*v.mount.dx+dz*v.mount.dz,across=dx*v.mount.dz-dz*v.mount.dx;
    if(extended&&along>=0&&along<2&&Math.abs(across)<1.3)strike(v,16,'Wall spikes thrust from the masonry!',2.5);
   }
   if(item.kind==='pit'&&!state().remote&&!item.cleared&&item.pitTriggerAt!==undefined&&clock>=item.pitTriggerAt+.3*1000)item.activated=true;
   syncVisibility(v);
  }
  if(!allowed())return;const s=state();for(const v of visuals)if(v.item.kind==='pit'&&!v.item.cleared&&Math.abs(s.position.y-v.g.position.y)<.3&&Math.abs(s.position.x-v.g.position.x)<1.45&&Math.abs(s.position.z-v.g.position.z)<1.45){if(!v.item.activated){if(v.item.pitTriggerAt===undefined){v.item.pitTriggerAt=clock;cue(v,'pit');}continue;}hurt(20,'You fell into a broken floor. The shrine returns you to safety.');respawn();break;}
 }
 function hint(){return nearby(i=>TRAPS.has(i.kind)&&i.kind!=='pit'&&(i.discovered||i.activated))?'E · Disarm trap mechanism':nearby('crate')?'Space · Smash supply crate':nearby('rubble')?'E · Search rubble cache':'';}
 function searchTile(index){
  if(!allowed()||!Number.isInteger(index)||index<0||index>=state().grid.length)return false;const [cx,cz]=coord(index);if(Math.abs(state().position.x-cx)>2.4||Math.abs(state().position.z-cz)>2.4)return false;
  const check=state().attemptAction?.('search',{dc:12});if(check&&!check.allowed)return true;if(check&&!check.success){checkedNotice('Trap search failed. This tile remains uncertain.',check);return true;}
  const traps=visuals.filter(v=>v.item.index===index&&TRAPS.has(v.item.kind)&&!v.item.cleared);for(const v of traps){v.item.discovered=true;syncVisibility(v);}
  checkedNotice(traps.length?'Trap search succeeded: '+traps.length+' trap(s) marked on this tile.':'Trap search succeeded: no traps on this tile.',check);return true;
 }
 function removeVisual(v){const geometry=new Set();v.g.traverse(o=>{o.userData.disposeMaterials?.();if(o.userData.ownGeometry&&o.geometry)geometry.add(o.geometry);});geometry.forEach(g=>g.dispose());v.g.removeFromParent();v.cover?.removeFromParent();visuals=visuals.filter(other=>other!==v);}
 function place(index,kind){
  if(typeof kind!=='string')return false;kind=kind.replace(/^trap:/,'');const s=state();if(!enabled||!HAZARD_KINDS.includes(kind)||!canPlaceHazard(s,index,kind))return false;
  if(activeKey!==s.seed+':'+s.floor)prepare();const stored=saved.get(activeKey);if(stored.some(i=>i.index===index))return false;
  const item={index,kind,phase:random(s.seed+':'+s.floor+':'+index+':'+kind)()*5,cleared:false};
  // Build first: the host charges only a successful committed placement.
  const before=new Set(world.children);
  try{buildOne(item);}catch{for(const g of [...world.children])if(!before.has(g)&&g.userData.hazardIndex===index)removeVisual({g});return false;}stored.push(item);items.push(item);return true;
 }
 function erase(index){const s=state();if(activeKey!==s.seed+':'+s.floor)prepare();const stored=saved.get(activeKey),at=stored.findIndex(i=>i.index===index);if(at<0)return false;stored.splice(at,1);items=items.filter(i=>i.index!==index);for(const v of [...visuals])if(v.item.index===index)removeVisual(v);return true;}
 function exportState(){return {seed:state().seed,floor:state().floor,clock,items:items.map(i=>({...i}))};}
 function applyState(value){const s=state();if(!value||value.seed!==s.seed||value.floor!==s.floor||!Number.isFinite(value.clock)||value.clock<0||!Array.isArray(value.items)||value.items.length>64)return false;const seen=new Set(),next=[];for(const item of value.items){if(!Number.isInteger(item.index)||item.index<0||item.index>=s.size*s.size||seen.has(item.index)||!HAZARD_KINDS.includes(item.kind)||!Number.isFinite(item.phase)||typeof item.cleared!=='boolean'||item.activated!==undefined&&typeof item.activated!=='boolean'||item.pitTriggerAt!==undefined&&(!Number.isFinite(item.pitTriggerAt)||item.pitTriggerAt<0||item.pitTriggerAt>value.clock))return false;seen.add(item.index);next.push({index:item.index,kind:item.kind,phase:item.phase,cleared:item.cleared,discovered:!!item.discovered,searched:!!item.searched,activated:!!item.activated,...(item.pitTriggerAt!==undefined?{pitTriggerAt:item.pitTriggerAt}:{})});}const changed=items.length!==next.length||items.some((i,j)=>i.index!==next[j].index||i.kind!==next[j].kind||i.cleared!==next[j].cleared);clock=value.clock;if(changed){saved.set(s.seed+':'+s.floor,next);items=next;}else for(let j=0;j<items.length;j++)Object.assign(items[j],next[j]);for(const v of visuals)syncVisibility(v);return {rebuild:changed};}
 return {exportState,applyState,prepare,build,prepareView,registerGuide:mesh=>guides.push(mesh),blocks,tick,interact,attack,hint,searchTile,place,erase,get discovered(){return items.filter(i=>i.discovered&&!i.cleared).map(i=>({index:i.index,kind:i.kind}));},reset:()=>{noticeEpoch++;onReset();saved.clear();items=[];visuals=[];activeKey=null;clock=0;},hasPit:index=>items.some(i=>i.index===index&&i.kind==='pit'&&!i.cleared)};
}
