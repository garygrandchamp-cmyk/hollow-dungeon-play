import {batchStaticGroup} from './mesh-batch.js?v=3a935cc6f4441f417ac4e7ea28a8fd66890685b1';
export function buildCounterweightLift({THREE,world,box,mat,plan:p,surfaceMaps}){
 const root=new THREE.Group();root.name='counterweight-lift';world.add(root);if(!p)return {root,update(){}};
 const frame=new THREE.Group(),deck=new THREE.Group(),weight=new THREE.Group();root.add(frame,deck,weight);deck.userData.dynamic=weight.userData.dynamic=true;
 deck.position.set(p.cx,0,p.cz);weight.position.set(p.cx-1.7,0,p.cz+1.5);
 const stone=mat('lift-stone',0x6f6b61),iron=mat('lift-iron',0x45423a),wood=mat('lift-wood',0x50402f,{map:surfaceMaps?.timber});
 const block=(g,x,y,z,w,h,d,m)=>{const b=box(g,x,y,z,w,h,d,m);b.userData.solidObstacle=false;return b;};
 for(const dx of [-1.45,1.45])for(const dz of [-1.45,1.45]){const b=block(frame,p.cx+dx,2.7,p.cz+dz,.14,5.4,.14,iron);b.userData.solidObstacle=true;}
 block(frame,p.cx,5.35,p.cz,3.2,.2,3.2,stone);block(deck,0,-.12,0,2.5,.24,2.5,stone);
 for(const z of [-1.17,1.17]){block(deck,0,.6,z,2.4,.1,.1,iron);for(const x of [-1.15,1.15])block(deck,x,.3,z,.1,.6,.1,iron);}block(deck,-1.17,.6,0,.1,.1,2.4,iron);
 block(weight,0,.45,0,.45,.9,.45,stone);block(frame,p.cx-1.7,2.7,p.cz+1.5,.055,5.4,.055,iron);
 const c=p.control;const crank=block(frame,c.x,.55,c.z,.55,1.1,.55,wood);crank.userData.solidObstacle=true;const wheel=new THREE.Mesh(new THREE.TorusGeometry(.26,.045,4,10),iron);wheel.userData.ownGeometry=true;wheel.position.set(c.x,1.25,c.z);frame.add(wheel);
 const upper=block(frame,p.upper.x,p.height+.35,p.upper.z,.3,.7,.3,wood);upper.userData.solidObstacle=true;block(frame,p.upper.x,p.height+.8,p.upper.z,.4,.08,.08,iron);frame.userData.collisionBoxes=[new THREE.Box3(new THREE.Vector3(p.cx-2,0,p.cz+1.22),new THREE.Vector3(p.cx-1.4,4.5,p.cz+1.78))];
 // Thin red-brown brake block reads physically without emissive UI lights.
 block(frame,p.cx-1.5,1.4,p.cz,.16,.32,.36,wood);
 batchStaticGroup(THREE,frame,{chunkSize:14.4});batchStaticGroup(THREE,deck);batchStaticGroup(THREE,weight);
 return {root,deck,weight,update(r){deck.position.y=r.height;weight.position.y=p.height-r.height;}};
}
export function createLiftUI({getState,onAction,onJam,document:doc=globalThis.document}){
 const root=doc.createElement('details');root.id='counterweightLiftPanel';const summary=doc.createElement('summary');summary.textContent='Counterweight lift';root.appendChild(summary);const info=doc.createElement('p'),help=doc.createElement('p');root.appendChild(info);const buttons=new Map();for(const [kind,label]of [['lift-lower','Emergency lower · free'],['lift-hold','Hold winch · 2 stamina'],['lift-release','Release winch · free'],['lift-latch','Latch · board within 5s · 2 stamina'],['jam','Jam gears · 8 DM stamina']]){const b=doc.createElement('button');b.textContent=label;b.onclick=()=>kind==='jam'?onJam():onAction(kind);root.appendChild(b);buttons.set(kind,b);}root.appendChild(help);doc.body.appendChild(root);root.addEventListener?.('toggle',()=>{if(root.open){for(const id of ['rotatingBridgePanel','sluicePanel']){const other=doc.getElementById?.(id);if(other)other.open=false;}}});
 const style=doc.createElement('style');style.textContent='#counterweightLiftPanel{box-sizing:border-box;position:fixed;z-index:38;width:280px;overflow:auto;padding:8px;border:3px ridge #9a8961;background:#171a21;color:#d8c89f;font:12px/1.5 monospace}#counterweightLiftPanel summary{color:#d6bb75;cursor:pointer}#counterweightLiftPanel button{width:100%;min-height:42px;background:#292e39;color:#d8c89f;border:3px outset #777a7a;font:inherit;margin:3px 0}#counterweightLiftPanel button:disabled{opacity:.5}';doc.head.appendChild(style);
 let signature='';function tick(){const s=getState(),v=s.viewport;root.hidden=!s.available||!s.plan||!v;if(root.hidden)return;root.style.left=v.left+12+'px';root.style.top=v.top+132+'px';root.style.width=Math.min(280,v.width-24)+'px';root.style.maxHeight=Math.max(60,v.height-156)+'px';const r=s.record,key=JSON.stringify([r.height.toFixed(1),r.target,r.holder,r.automatic,Math.ceil(r.boarding),Math.ceil(r.jam),Math.ceil(r.cooldown),r.blocked,s.near,s.rider,s.dm,s.actorId,s.stamina,s.dmStamina,s.phase]);if(signature===key)return;signature=key;
  info.textContent=(r.blocked?'BRAKE: clear shaft. ':r.jam>0?'JAMMED '+Math.ceil(r.jam)+'s. ':r.boarding>0?'BOARD IN '+Math.ceil(r.boarding)+'s. ':'')+r.height.toFixed(1)+'m / '+s.plan.height.toFixed(1)+'m · '+(r.holder?'Winch held':r.automatic?'Latched travel':'Brake secured');
  help.textContent='Hold the winch for a teammate, or latch and board for a solo ride. Move or attack to release a held winch. Emergency lower is free and clears a jam. Keep the shaft clear; the original stairs remain open.';
  for(const [kind,b]of buttons){b.hidden=s.dm?kind!=='jam':kind==='jam';b.disabled=s.phase!=='active'||(kind==='jam'?s.dmStamina<8||r.cooldown>0||!(r.holder||r.automatic)||r.boarding>0:kind==='lift-release'?r.holder!==s.actorId:kind==='lift-lower'?!(s.near||s.rider):!s.near||s.stamina<2||!!r.holder||r.automatic||r.jam>0);}
 }return {root,tick,destroy(){root.remove();style.remove();}};
}
