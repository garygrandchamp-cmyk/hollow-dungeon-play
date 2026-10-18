import {roomContainsTile} from './room-footprint.js?v=196054df12b9a11015c9d250d495b86ba916ef97';
import {random} from './wfc.js?v=196054df12b9a11015c9d250d495b86ba916ef97';
import {makeDungeonProp as makePropSprite} from './dungeon-props.js?v=196054df12b9a11015c9d250d495b86ba916ef97';
import {batchStaticGroup} from './mesh-batch.js?v=196054df12b9a11015c9d250d495b86ba916ef97';

export const HAZARD_KINDS=Object.freeze(['pit','spikes','crate','rubble','swinging-axe','rolling-ball','rat-cage']);
const TRAPS=new Set(HAZARD_KINDS.filter(k=>!['crate','rubble'].includes(k)));
function reservedCells(s){
 const {architecture:a,size:n}=s,out=new Set([a.start,a.start+1,a.stair,a.stair+1,a.stair-1,a.stair-n,a.stair+n,a.start-n-1,a.start-n+1]);
 for(const list of [s.objectives,s.relics,s.keyLocations,s.keys,s.reservedIndices,a.objectives,a.relics,a.keys,a.keyLocations]){
  if(!Array.isArray(list)&&!(list instanceof Set))continue;
  for(const item of list){const i=Number.isInteger(item)?item:item?.index;if(Number.isInteger(i))out.add(i);}
 }
 return out;
}
export function canPlaceHazard(s,index){
 if(!s?.architecture||!Number.isInteger(index)||index<0||index>=s.size*s.size||!s.tiles?.[s.grid?.[index]]?.s.every(v=>v===1))return false;
 const x=index%s.size,z=Math.floor(index/s.size),a=s.architecture;
 return !reservedCells(s).has(index)&&Math.abs(x-a.start%s.size)+Math.abs(z-Math.floor(a.start/s.size))>2&&a.rooms.some(r=>[[0,0],[0,-1],[1,0],[0,1],[-1,0]].every(([dx,dz])=>roomContainsTile(r,x+dx,z+dz)));
}
export function hazardPlan(s){
 if(s.enabled===false)return [];
 const rng=random(s.seed+'-hazards'),candidates=[];
 for(let index=0;index<s.size*s.size;index++)if(canPlaceHazard(s,index))candidates.push({index,order:rng()});
 candidates.sort((a,b)=>a.order-b.order);
 // First four legacy kinds remain present before the three additional traps.
 return candidates.slice(0,9).map(({index},j)=>({index,kind:HAZARD_KINDS[j%HAZARD_KINDS.length],phase:rng()*5,cleared:false}));
}
export function createHazards({THREE,world,box,mat,coord,state,hurt,reward,respawn,notify,canReach=()=>true,onReset=()=>{}}){
 let items=[],visuals=[],saved=new Map(),enabled=true,activeKey=null,clock=0,noticeEpoch=0;
 const panel=document.createElement('details');panel.innerHTML='<summary>Traps & obstacles +</summary><div class="toggle-row"><label for="hazardsEnabled">Pits, spike plates & barricades</label><input id="hazardsEnabled" type="checkbox" checked></div><p class="editor-help">Search tiles to mark traps. E disarms mechanisms or searches containers. Pendulums, boulders and cages warn before striking; leave the marked lane.</p>';document.querySelector('aside').appendChild(panel);
 document.getElementById('hazardsEnabled').onchange=e=>{enabled=e.target.checked;state().rebuild?.();};
 function checkedNotice(message,check){if(!Number.isInteger(check?.roll)){notify(message);return;}const token=noticeEpoch,s=state(),key=s.seed+':'+s.floor,owner=s.actorId;const timer=setTimeout(()=>{const current=state();if(token===noticeEpoch&&key===current.seed+':'+current.floor)notify((owner&&owner!=='solo'?owner+' - ':'')+message);},1120);timer?.unref?.();}
 function ground(position,index){const s=state();if(!s.groundHeight)return 0;const y=s.groundHeight({x:position.x,y:position.y,z:position.z,index});return Number.isFinite(y)?y:null;}
 function onGround(position,index){const y=ground(position,index);return y!==null&&Math.abs(position.y-y)<.3;}
 const allowed=()=>{const s=state();return !s.remote&&!s.paused&&onGround(s.position);};
 function prepare(){
  const s=state();activeKey=s.seed+':'+s.floor;
  if(!saved.has(activeKey)){if(saved.size>=32)saved.delete(saved.keys().next().value);saved.set(activeKey,hazardPlan({...s,enabled:true}));}
  items=enabled?saved.get(activeKey).filter(i=>canPlaceHazard(s,i.index)):[];visuals=[];
 }
 function own(mesh){mesh.userData.ownGeometry=true;return mesh;}
 function warning(g,width=.85,length=.85){
  const mesh=own(new THREE.Mesh(new THREE.PlaneGeometry(width,length),new THREE.MeshBasicMaterial({color:0xba572c,transparent:true,opacity:.3,depthWrite:false,side:THREE.DoubleSide})));
  mesh.rotation.x=-Math.PI/2;mesh.position.y=.16;mesh.visible=false;mesh.userData.dynamic=true;mesh.userData.disposeMaterials=()=>mesh.material.dispose();g.add(mesh);return mesh;
 }
 function buildOne(item){
  const stone=mat('pitStone',0x514f48),black=mat('pitBottom',0x090a0b),iron=mat('trapIron',0x454b49,{metalness:.6}),wood=mat('supplyCrate',0x59452e);
  const [x,z]=coord(item.index),g=new THREE.Group();g.name='hazard:'+item.kind;g.userData.hazardIndex=item.index;
  const y=ground({x,y:state().position.y,z},item.index);g.position.set(x,y??state().position.y,z);world.add(g);const v={item,g,lastHit:new Map(),pulses:new Map()};
  if(TRAPS.has(item.kind)){
   const marker=own(new THREE.Mesh(new THREE.RingGeometry(.9,1,4),new THREE.MeshBasicMaterial({color:0x7eb9ae,side:THREE.DoubleSide,depthWrite:false})));
   marker.rotation.x=-Math.PI/2;marker.position.y=.18;marker.visible=!!item.discovered;marker.userData.dynamic=true;marker.userData.disposeMaterials=()=>marker.material.dispose();g.add(marker);v.marker=marker;
  }
  if(item.kind==='pit'){
   for(const sign of [-1,1]){box(g,sign*.84,-1.15,0,.10,2.4,1.68,stone);box(g,0,-1.15,sign*.84,1.68,2.4,.10,stone);}box(g,0,-2.4,0,1.75,.1,1.75,black);
   for(const dx of [-.95,.95])for(const dz of [-.7,0,.7]){const b=box(g,dx,.12,dz,.24,.21,.35,stone);b.rotation.y=dx+dz;}batchStaticGroup(THREE,g);
  }
  if(item.kind==='spikes'){v.spikes=makePropSprite(THREE,{kind:'spikes',height:.8,seed:item.index});g.add(v.spikes);v.glow=warning(g);}
  if(item.kind==='crate'){g.position.x+=.9;g.add(makePropSprite(THREE,{kind:'crate',height:1.05,seed:item.index}));g.visible=!item.cleared;}
  if(item.kind==='rubble'){g.position.x-=.9;g.add(makePropSprite(THREE,{kind:'rubble',height:.7,seed:item.index}));}
  if(item.kind==='swinging-axe'){
   for(const dx of [-1.65,1.65])box(g,dx,1.8,0,.16,3.6,.2,wood);box(g,0,3.55,0,3.5,.16,.2,iron);
   v.pendulum=new THREE.Group();v.pendulum.position.y=3.4;g.add(v.pendulum);box(v.pendulum,0,-1.3,0,.09,2.6,.09,wood);
   const blade=own(new THREE.Mesh(new THREE.CylinderGeometry(.65,.65,.12,3),iron));blade.rotation.x=Math.PI/2;blade.position.y=-2.75;v.pendulum.add(blade);v.glow=warning(g,3.4,1.1);
  }
  if(item.kind==='rolling-ball'){
   v.ball=own(new THREE.Mesh(new THREE.IcosahedronGeometry(.62,1),stone));v.ball.position.set(0,.64,-1.75);g.add(v.ball);
   for(const dz of [-1.95,1.95])box(g,0,.1,dz,1.55,.2,.16,iron);v.glow=warning(g,1.4,4);
  }
  if(item.kind==='rat-cage'){
   v.cage=new THREE.Group();v.cage.position.y=2.5;g.add(v.cage);
   for(const dx of [-.55,.55])for(const dz of [-.55,.55])box(v.cage,dx,.55,dz,.07,1.1,.07,iron);
   for(const yy of [0,1.1])box(v.cage,0,yy,0,1.2,.08,1.2,iron);
   for(const d of [-.25,0,.25])for(const sign of [-1,1]){box(v.cage,d,.55,sign*.55,.04,1.1,.04,iron);box(v.cage,sign*.55,.55,d,.04,1.1,.04,iron);}
   box(g,0,3.5,0,.06,1.8,.06,iron);v.glow=warning(g,2.7,2.7);
  }
  visuals.push(v);return v;
 }
 function build(){for(const item of items)buildOne(item);}
 function blocks(x,z,r=.18,feet=state().position.y){return visuals.some(({item,g})=>!item.cleared&&['crate','rubble'].includes(item.kind)&&Math.abs(feet-g.position.y)<.3&&Math.abs(x-g.position.x)<.57+r&&Math.abs(z-g.position.z)<.57+r);}
 function nearby(kind){if(!allowed())return null;const s=state();return visuals.find(v=>(typeof kind==='function'?kind(v.item):v.item.kind===kind)&&!v.item.cleared&&v.g.position.distanceTo(s.position)<1.8&&canReach(v.item.index,v.g.position));}
 function stop(v){v.item.cleared=true;v.spikes?.userData.animate?.({active:false});if(v.glow)v.glow.visible=false;}
 function interact(){
  const v=nearby(i=>TRAPS.has(i.kind)&&i.kind!=='pit');
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
  if(state().paused)return;clock+=Math.max(0,Math.min(.1,Number.isFinite(dt)?dt:0))*1000;
  for(const v of visuals){
   const {item,g}=v,trapPhase=(clock*.001+item.phase)%4;
   if(item.kind==='spikes'){
    const raised=trapPhase>2.8&&!item.cleared;v.spikes.visible=true;v.spikes.userData.animate({time:clock,active:raised});v.glow.visible=trapPhase>1.8&&!item.cleared;v.glow.material.opacity=.25+Math.sin(clock*.02)*.18;
    if(raised)strike(v,12,'Spikes! Disarm the copper plate with E.',.64);
   }
   if(item.kind==='swinging-axe'){
    const swing=Math.sin(trapPhase*Math.PI/2)*.95;v.pendulum.rotation.z=item.cleared ? .95 : swing;
    v.glow.visible=!item.cleared&&(trapPhase<.6||trapPhase>1.4&&trapPhase<2.6||trapPhase>3.4);v.glow.material.opacity=.25+.15*Math.abs(Math.sin(clock*.01));
    const bladeX=Math.sin(swing)*2.75,bladeY=3.4-Math.cos(swing)*2.75,p=state().position;
    if(!item.cleared&&bladeY<1.6&&Math.abs(p.x-g.position.x-bladeX)<.65&&Math.abs(p.z-g.position.z)<.55)strike(v,18,'The pendulum axe sweeps through the lane!',2.5);
   }
   if(item.kind==='rolling-ball'){
    const cycle=(clock*.001+item.phase)%5,travel=cycle>=1.2&&cycle<3.6,t=Math.max(0,Math.min(1,(cycle-1.2)/2.4));
    v.ball.position.z=-1.75+t*3.5;v.ball.rotation.x=t*6;v.glow.visible=!item.cleared&&cycle<1.2;v.ball.visible=!item.cleared;
    const p=state().position;if(travel&&!item.cleared&&Math.hypot(p.x-g.position.x,p.z-g.position.z-v.ball.position.z)<.85)strike(v,16,'A rolling boulder crashes through the lane!',2.8);
   }
   if(item.kind==='rat-cage'){
    const cycle=(clock*.001+item.phase)%6;v.cage.position.y=item.cleared?2.5:cycle<1.2?2.5:Math.max(0,2.5-(cycle-1.2)*8);v.glow.visible=!item.cleared&&cycle<1.5;
    if(!item.cleared&&cycle>=1.5&&cycle<4.8){
     const pulse=Math.floor((cycle-1.5)/.8),lap=Math.floor((clock*.001+item.phase)/6),id=state().actorId??'solo',key=lap+':'+pulse;
     if(v.pulses.get(id)!==key){v.pulses.set(id,key);strike(v,6,'Rats swarm from the fallen cage!',1.35);}
     if(v.pulse!==pulse||v.cycle!==lap){
      v.pulse=pulse;v.cycle=lap;
      if(pulse===0&&state().spawnRats){try{state().spawnRats({index:item.index,position:g.position.clone(),id:'rat-cage:'+activeKey+':'+item.index+':'+lap});}catch{/* Optional host spawner unavailable. */}}
     }
    }
   }
  }
  if(!allowed())return;const s=state();for(const v of visuals)if(v.item.kind==='pit'&&!v.item.cleared&&Math.abs(s.position.y-v.g.position.y)<.3&&Math.abs(s.position.x-v.g.position.x)<.69&&Math.abs(s.position.z-v.g.position.z)<.69){hurt(20,'You fell into a broken floor. The shrine returns you to safety.');respawn();break;}
 }
 function hint(){return nearby(i=>TRAPS.has(i.kind)&&i.kind!=='pit')?'E · Disarm trap mechanism':nearby('crate')?'Space · Smash supply crate':nearby('rubble')?'E · Search rubble cache':'';}
 function searchTile(index){
  if(!allowed()||!Number.isInteger(index)||index<0||index>=state().grid.length)return false;const [cx,cz]=coord(index);if(Math.abs(state().position.x-cx)>2.4||Math.abs(state().position.z-cz)>2.4)return false;
  const check=state().attemptAction?.('search',{dc:12});if(check&&!check.allowed)return true;if(check&&!check.success){checkedNotice('Trap search failed. This tile remains uncertain.',check);return true;}
  const traps=visuals.filter(v=>v.item.index===index&&TRAPS.has(v.item.kind)&&!v.item.cleared);for(const v of traps){v.item.discovered=true;if(v.marker)v.marker.visible=true;}
  checkedNotice(traps.length?'Trap search succeeded: '+traps.length+' trap(s) marked on this tile.':'Trap search succeeded: no traps on this tile.',check);return true;
 }
 function removeVisual(v){const geometry=new Set();v.g.traverse(o=>{o.userData.disposeMaterials?.();if(o.userData.ownGeometry&&o.geometry)geometry.add(o.geometry);});geometry.forEach(g=>g.dispose());v.g.removeFromParent();visuals=visuals.filter(other=>other!==v);}
 function place(index,kind){
  if(typeof kind!=='string')return false;kind=kind.replace(/^trap:/,'');const s=state();if(!enabled||!HAZARD_KINDS.includes(kind)||!canPlaceHazard(s,index))return false;
  if(activeKey!==s.seed+':'+s.floor)prepare();const stored=saved.get(activeKey);if(stored.some(i=>i.index===index))return false;
  const item={index,kind,phase:random(s.seed+':'+s.floor+':'+index+':'+kind)()*5,cleared:false};
  // Build first: the host charges only a successful committed placement.
  const before=new Set(world.children);
  try{buildOne(item);}catch{for(const g of [...world.children])if(!before.has(g)&&g.userData.hazardIndex===index)removeVisual({g});return false;}stored.push(item);items.push(item);return true;
 }
 function erase(index){const s=state();if(activeKey!==s.seed+':'+s.floor)prepare();const stored=saved.get(activeKey),at=stored.findIndex(i=>i.index===index);if(at<0)return false;stored.splice(at,1);items=items.filter(i=>i.index!==index);for(const v of [...visuals])if(v.item.index===index)removeVisual(v);return true;}
 function exportState(){return {seed:state().seed,floor:state().floor,clock,items:items.map(i=>({...i}))};}
 function applyState(value){const s=state();if(!value||value.seed!==s.seed||value.floor!==s.floor||!Number.isFinite(value.clock)||value.clock<0||!Array.isArray(value.items)||value.items.length>64)return false;const seen=new Set(),next=[];for(const item of value.items){if(!Number.isInteger(item.index)||item.index<0||item.index>=s.size*s.size||seen.has(item.index)||!HAZARD_KINDS.includes(item.kind)||!Number.isFinite(item.phase)||typeof item.cleared!=='boolean')return false;seen.add(item.index);next.push({index:item.index,kind:item.kind,phase:item.phase,cleared:item.cleared,discovered:!!item.discovered,searched:!!item.searched});}const changed=items.length!==next.length||items.some((i,j)=>i.index!==next[j].index||i.kind!==next[j].kind||i.cleared!==next[j].cleared);clock=value.clock;if(changed){saved.set(s.seed+':'+s.floor,next);items=next;}else for(let j=0;j<items.length;j++)Object.assign(items[j],next[j]);return {rebuild:changed};}
 return {exportState,applyState,prepare,build,blocks,tick,interact,attack,hint,searchTile,place,erase,get discovered(){return items.filter(i=>i.discovered&&!i.cleared).map(i=>({index:i.index,kind:i.kind}));},reset:()=>{noticeEpoch++;onReset();saved.clear();items=[];visuals=[];activeKey=null;clock=0;},hasPit:index=>items.some(i=>i.index===index&&i.kind==='pit'&&!i.cleared)};
}
