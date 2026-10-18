import {batchStaticGroup} from './mesh-batch.js?v=196054df12b9a11015c9d250d495b86ba916ef97';
import {BRIDGE_TURN_SECONDS,BRIDGE_DM_COST} from './rotating-bridge.js?v=196054df12b9a11015c9d250d495b86ba916ef97';

export function buildRotatingBridge({THREE,world,box,mat,plan,water,surfaceMaps}){
 const root=new THREE.Group();root.name='rotating-stone-bridge';world.add(root);if(!plan)return {root,update(){}};
 const p=plan,fixtures=new THREE.Group(),moving=new THREE.Group();root.add(fixtures,moving);moving.position.set(p.cx,0,p.cz);moving.userData.dynamic=true;
 const stone=mat('turntable-stone',0x777365,{map:surfaceMaps?.flagstone}),iron=mat('turntable-iron',0x3e3a31),bed=mat('turntable-bed-stone',0x393b32);
 const block=(g,x,y,z,w,h,d,m)=>{const mesh=box(g,x,y,z,w,h,d,m);mesh.userData.solidObstacle=false;return mesh;};
 block(fixtures,p.cx,-1.6,p.cz,p.half*2,.3,p.half*2,bed);
 for(const side of [-1,1]){block(fixtures,p.cx+side*(p.half-.09),-.8,p.cz,.18,1.6,p.half*2,stone);block(fixtures,p.cx,-.8,p.cz+side*(p.half-.09),p.half*2,1.6,.18,stone);}
 const pool=new THREE.Mesh(new THREE.PlaneGeometry(p.half*2-.2,p.half*2-.2),water);pool.rotation.x=-Math.PI/2;pool.position.set(p.cx,-1.22,p.cz);fixtures.add(pool);
 const hub=new THREE.Mesh(new THREE.CylinderGeometry(.85,1.05,1.5,12),stone);hub.userData.ownGeometry=true;hub.position.set(p.cx,-.76,p.cz);fixtures.add(hub);
 block(moving,0,-.19,0,p.width,.38,p.length,stone);
 // Low curb stones frame the deck without obscuring first-person sightlines.
 for(const x of [-1,1])for(const z of [-3.8,-2.4,2.4,3.8])block(moving,x*(p.width/2-.09),.07,z,.18,.14,1.1,stone);
 for(const z of [-3.6,-1.2,1.2,3.6])block(moving,0,-.005,z,p.width-.25,.025,.04,iron);
 for(const c of p.controls){block(fixtures,c.x,.4,c.z,.45,.8,.45,stone);const crank=new THREE.Mesh(new THREE.TorusGeometry(.24,.045,4,10),iron);crank.userData.ownGeometry=true;crank.position.set(c.x,.95,c.z);crank.rotation.x=-.4;fixtures.add(crank);block(fixtures,c.x,1,c.z,.42,.05,.05,iron);fixtures.userData.collisionBoxes??=[];fixtures.userData.collisionBoxes.push(new THREE.Box3(new THREE.Vector3(c.x-.26,0,c.z-.26),new THREE.Vector3(c.x+.26,1.2,c.z+.26)));}
 batchStaticGroup(THREE,fixtures,{chunkSize:14.4});batchStaticGroup(THREE,moving); // one-time bake; only the deck group moves
 return {root,moving,update(record){const t=record.turning?Math.min(1,record.elapsed/BRIDGE_TURN_SECONDS):0,ease=t*t*(3-2*t);moving.rotation.y=(record.axis+(record.axis===0?ease:-ease))*Math.PI/2;}};
}

export function createBridgeUI({getState,onTurn,onDMTurn,document:doc=globalThis.document}){
 const root=doc.createElement('details');root.id='rotatingBridgePanel';root.className='rotating-bridge-panel';const heading=doc.createElement('summary'),status=doc.createElement('p'),help=doc.createElement('p'),button=doc.createElement('button');heading.textContent='Stone turntable';root.appendChild(heading);root.appendChild(status);root.appendChild(help);root.appendChild(button);doc.body.appendChild(root);
 const style=doc.createElement('style');style.textContent='.rotating-bridge-panel{box-sizing:border-box;position:fixed;z-index:37;width:270px;max-height:40vh;overflow:auto;border:3px ridge #9a8961;background:#171a21;color:#d8c89f;padding:8px;font:12px/1.5 monospace}.rotating-bridge-panel summary{cursor:pointer;color:#d6bb75}.rotating-bridge-panel p{margin:8px 0}.rotating-bridge-panel button{width:100%;min-height:44px;font:inherit;color:#d8c89f;background:#292e39;border:3px outset #777a7a}.rotating-bridge-panel button:disabled{opacity:.5}';doc.head.appendChild(style);
 let signature='';
 function tick(){const s=getState(),v=s.viewport;root.hidden=!s.available||!s.plan||!v;if(root.hidden)return;root.style.left=v.left+12+'px';root.style.top=v.top+90+'px';root.style.width=Math.min(270,v.width-24)+'px';root.style.maxHeight=Math.max(60,v.height-114)+'px';const r=s.record,key=JSON.stringify([s.dm,s.phase,s.near,r.axis,r.turning,Math.ceil(r.elapsed),s.stamina,s.dmStamina]);if(key===signature)return;signature=key;
  status.textContent=r.turning?'TURNING · keep clear · '+Math.max(1,Math.ceil(BRIDGE_TURN_SECONDS-r.elapsed))+'s':(r.axis?'East–west':'North–south')+' crossing aligned.';
  help.textContent='Four bank cranks turn the stone bridge. Use the dry outer path to reach another crank. Everyone must leave the bridge and its sweep first. '+(s.dm?'DM turn costs 8 stamina and uses the same safety checks.':'Crank costs 2 stamina. E or tap below when beside a crank.');
  button.textContent=(s.dm?'Turn bridge · '+BRIDGE_DM_COST+' DM stamina':s.near?'Turn bridge · 2 stamina':'Approach a bank crank');button.disabled=s.phase!=='active'||r.turning||(s.dm?s.dmStamina<BRIDGE_DM_COST:!s.near||s.stamina<2);button.onclick=()=>s.dm?onDMTurn():onTurn();
 }
 return {root,tick,destroy(){root.remove();style.remove();}};
}
