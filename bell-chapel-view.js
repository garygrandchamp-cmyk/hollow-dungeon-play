import {batchStaticGroup} from './mesh-batch.js?v=84fc371936953c752f7d36674575129dbb0d8ea1';
/** Low-poly volumetric fixtures, existing masonry/water maps, no new lights. */
export function buildBellChapel({THREE,world,box,mat,plan,coord,groundHeight,court,water}){
 const root=new THREE.Group();root.name='flooded-bell-chapel';world.add(root);if(!plan)return {update(){},root};
 const iron=mat('chapel-iron',0x3b3935),bronze=mat('chapel-bronze',0x77603d),stone=mat('chapelStone',0x746b5c),wood=mat('chapel-wood',0x49392d),fixtures=new THREE.Group();root.add(fixtures);
 let bell,rope,sluice,winch,treasury;
 function block(g,x,y,z,w,h,d,m){const mesh=box(g,x,y,z,w,h,d,m);mesh.userData.solidObstacle=false;return mesh;}
 for(const [kind,p]of Object.entries(plan.nodes)){
  const [x,z]=coord(p.index),g=new THREE.Group();g.name='chapel-'+kind;g.position.set(x,groundHeight(x,z),z);fixtures.add(g);
  // Modest fixtures preserve a broad walk-around and supported tile centre routes.
  g.position.x+=.95;g.position.z+=.95;
  block(g,0,.08,0,.72,.16,.72,stone);
  if(kind==='bell'){
   for(const dx of [-.31,.31])block(g,dx,1.3,0,.12,2.5,.18,wood);block(g,0,2.5,0,.85,.16,.2,wood);
   bell=new THREE.Mesh(new THREE.CylinderGeometry(.15,.34,.54,10,1,true),bronze);bell.userData.ownGeometry=true;bell.userData.dynamic=true;bell.position.y=1.95;fixtures.add(bell);bell.position.add(g.position);
   block(g,0,1.92,0,.06,.68,.06,iron);rope=block(g,.28,1.1,.08,.035,2.1,.035,wood);rope.userData.dynamic=true;
  }else if(kind==='valve'){
   block(g,0,.55,0,.38,.94,.38,stone);sluice=new THREE.Group();sluice.position.set(0,1.16,0);g.add(sluice);const wheel=new THREE.Mesh(new THREE.TorusGeometry(.32,.045,4,12),iron);wheel.userData.ownGeometry=true;wheel.userData.dynamic=true;sluice.add(wheel);
   for(const r of [0,Math.PI/2]){const spoke=block(sluice,0,0,0,.58,.04,.04,bronze);spoke.rotation.z=r;spoke.userData.dynamic=true;}
  }else if(kind==='winch'){
   block(g,0,.46,0,.58,.72,.48,wood);winch=block(g,0,.92,0,.68,.10,.10,iron);block(g,.3,1.06,0,.10,.35,.10,bronze);
  }else{
   block(g,0,.48,0,.72,.78,.7,stone);treasury=block(g,0,.93,0,.84,.16,.8,stone);treasury.userData.dynamic=true;for(const dx of [-.24,.24])block(g,dx,.53,-.36,.05,.7,.06,iron);
  }
  g.userData.collisionBoxes=[new THREE.Box3(new THREE.Vector3(-.38,0,-.38),new THREE.Vector3(.38,kind==='bell'?2.6:1.5,.38))];
 }
 // Only the existing recessed court floods. Door approaches and raised rings stay dry.
 let pool=null;if(court){pool=new THREE.Mesh(new THREE.PlaneGeometry(court.right-court.left-3.2,court.south-court.north-3.2),water);pool.rotation.x=-Math.PI/2;pool.position.set((court.left+court.right)/2,-.26,(court.north+court.south)/2);pool.receiveShadow=true;root.add(pool);}
 batchStaticGroup(THREE,fixtures,{chunkSize:14.4});
 return {root,update(record){if(pool)pool.visible=record.flood>0||!record.drained;if(bell)bell.rotation.z=record.ring>0?Math.sin(record.ring*8)*.12:0;if(rope)rope.visible=!record.silenced;if(sluice)sluice.rotation.z=record.drained?Math.PI/4:0;if(treasury)treasury.position.y=record.treasury?1.16:.93;/* No per-frame re-batching. */}};
}
export function chapelPanelBounds(rect){
 if(!rect||!['left','top','width','height'].every(k=>Number.isFinite(rect[k]))||rect.width<100||rect.height<100)return null;
 const width=Math.min(310,rect.width-24),top=rect.top+42;
 return {left:rect.left+rect.width-width-12,top,width,maxHeight:Math.max(48,rect.height-66)};
}
export function createChapelUI({getState,onAction,onDM}){
 const root=document.createElement('details');root.id='bellChapelPanel';root.className='bell-chapel-panel';const summary=document.createElement('summary');summary.textContent='Flooded bell chapel';root.appendChild(summary);const content=document.createElement('div');root.appendChild(content);document.body.appendChild(root);let signature='',owner='',elements=new Map();
 const style=document.createElement('style');style.textContent='.bell-chapel-panel{box-sizing:border-box;position:fixed;z-index:38;right:12px;top:104px;width:min(310px,calc(100vw - 24px));max-height:48vh;overflow:auto;border:3px ridge #9a8961;background:#171a21;color:#d8c89f;font:12px/1.5 monospace;padding:8px;box-shadow:2px 3px 0 #07080a}.bell-chapel-panel summary{position:sticky;top:-8px;background:#171a21;padding:6px 0;cursor:pointer;color:#d6bb75}.bell-chapel-panel p{margin:8px 0}.bell-chapel-panel button{font:inherit;display:block;min-height:42px;width:100%;margin:5px 0;color:#d8c89f;background:#292e39;border:3px outset #777a7a;padding:5px}.bell-chapel-panel button:disabled{opacity:.5}@media(max-width:700px){.bell-chapel-panel{top:78px;max-height:40vh;width:235px;font-size:11px}}';document.head.appendChild(style);
 function tick(){const s=getState(),bounds=chapelPanelBounds(s.viewport);root.hidden=!bounds||!s.available||!s.plan&&!s.burdened&&!(s.dm&&s.finalReady);if(root.hidden)return;for(const [key,value]of Object.entries(bounds))root.style[key]=value+'px';root.style.right='auto';const key=JSON.stringify([s.phase,s.dm,s.floor,s.actor?.id,s.actor?.index,s.record,s.finalReady,s.dmStamina,s.near,s.floodable,s.burdened,s.homeFloor,s.extracting,s.whisperInterval]);if(key===signature)return;signature=key;summary.textContent=s.burdened&&!s.plan?'Cursed reliquary':'Flooded bell chapel';const nextOwner=s.dm?'dm':s.actor?.id;if(owner!==nextOwner){owner=nextOwner;content.replaceChildren();elements.clear();}let textIndex=0;const used=new Set();
  function element(id,tag){used.add(id);if(!elements.has(id)){const node=document.createElement(tag);elements.set(id,node);content.appendChild(node);}return elements.get(id);}
  function text(value){const p=element('text-'+textIndex++,'p');if(p.textContent!==value)p.textContent=value;}
  function button(label,kind,enabled=true,dm=false){const b=element(kind,'button');if(b.textContent!==label)b.textContent=label;b.disabled=!enabled||s.phase!=='active';b.onclick=()=>dm?onDM(kind):onAction(kind);}
  text(s.plan?'Optional chamber · Floor '+(s.floor+1)+'. Cut the bell rope, drain the court, or risk the treasury. All required routes stay open.':s.burdened?'You carry the chapel’s whispering reliquary.':'Escape is underway. Choose a valid entrance for your one paid final pursuit.');
  text('Alarm '+Math.round(s.record.heat)+'/100 · '+(s.record.silenced?'Bell silenced':s.record.ring>0?'Bellkeeper ringing':'Bell intact')+' · '+(s.floodable===false?'Flat court':s.record.flood>0?'DM flood '+Math.ceil(s.record.flood)+'s':s.record.drained?'Court drained':'Court flooded'));
  if(s.dm){text('False sounds originate at the treasury. Footsteps and rummaging share a 15s cooldown'+(s.record.decoy>0?' · '+Math.ceil(s.record.decoy)+'s remaining':'')+'. Investigators may notice the cold draft and untouched dust.');text('Live powers cost DM stamina. Final pursuit needs a selected, unoccupied entrance and its normal monster cost.');button('False footsteps · 6 stamina','chapel-decoy',!!s.plan&&s.dmStamina>=6&&s.record.decoy<=0,true);button('False rummaging · 8 stamina','chapel-rummage',!!s.plan&&s.dmStamina>=8&&s.record.decoy<=0,true);button('Reverse sluice · 12 stamina / 20s','chapel-flood',!!s.plan&&s.floodable!==false&&s.dmStamina>=12&&s.record.flood<=0,true);button('Ring bell · 8 stamina','chapel-ring',!!s.plan&&s.dmStamina>=8&&!s.record.silenced,true);button('Final pursuit · drowned / 12 stamina','chapel-pursuit',s.finalReady&&s.dmStamina>=12,true);}
  else if(!s.plan){text('The curse follows you between floors: no blocking; whispers every '+(s.whisperInterval||8)+' seconds. '+(s.extracting?'ESCAPE: ':'')+'Return to the treasury on Floor '+(s.homeFloor+1)+' to end it. Cutting that floor’s bell rope keeps whispers at 8s; an intact bell quickens them to 4s during escape.');}
  else{
   if(s.record.decoy>0&&s.near.treasury)text('A cold draft brushes your skin. The dust around the treasury is undisturbed despite the sounds.');
   text('Fixtures: hanging bell, round valve, iron winch, stone treasury. Approach within 3m. Mechanisms cost 2 stamina; release/return are free. Holding the winch prevents blocking and ends when you move away or attack.');
   button(s.record.silenced?'Bell rope cut':'Cut bell rope','chapel-bell',s.near.bell&&!s.record.silenced);button(s.record.drained?'Close sluice':'Drain court','chapel-valve',s.near.valve&&s.floodable!==false);button(s.record.holder===s.actor?.id?'Release winch':'Hold winch for a companion','chapel-winch',s.near.winch);
   button(s.record.treasury?'Treasury opened':'Open treasury · companion holds winch','chapel-treasury',s.near.treasury&&!s.record.treasury);
   text('BARGAIN: extra procedural loot now. DM gains 18 stamina. Carrying the reliquary prevents blocking and makes noise every 8s. ESCAPE COST: every 4s after all relics are found unless you cut this bell’s rope. Return it here to end the curse; keep the loot. Once per floor.');if(s.burdened)text((s.extracting?'ESCAPE · ':'CARRYING · ')+'Whispers every '+(s.whisperInterval||8)+'s. '+(s.whisperInterval===4?'The intact bell is quickening your curse. Cut the rope or return the reliquary.':'Cutting the bell rope protects the slower rhythm.'));
   button(s.record.bargain?'Bargain already claimed':'Accept the cursed bargain','chapel-bargain',s.near.treasury&&s.record.treasury&&!s.record.bargain);
   if(s.record.carrier===s.actor?.id)button('Return cursed reliquary · end burden','chapel-drop',s.near.treasury);
  }
  for(const [id,node]of elements)if(!used.has(id)){node.remove();elements.delete(id);}
 }
 return {tick,root,destroy(){root.remove();style.remove();}};
}
