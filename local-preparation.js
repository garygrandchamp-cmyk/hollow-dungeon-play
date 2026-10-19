import {createHubPreparation} from './hub-preparation.js?v=1d78ea79feefea23b13aa344fdb80a6c28d88fec';
import {createHubScene} from './hub-scene.js?v=1d78ea79feefea23b13aa344fdb80a6c28d88fec';
import {createHubDeathLoss} from './hub-death-loss.js?v=1d78ea79feefea23b13aa344fdb80a6c28d88fec';
import {createHubStock,hubSellPrice,compareHubOffer} from './hub-shop.js?v=1d78ea79feefea23b13aa344fdb80a6c28d88fec';
import {CLASSES} from './party-campaign.js?v=1d78ea79feefea23b13aa344fdb80a6c28d88fec';
import {curseDescription} from './cursed-equipment.js?v=1d78ea79feefea23b13aa344fdb80a6c28d88fec';

const TRADE_COOLDOWN_MS=350;

/** Opt-in LOCAL/SOLO WIP. Uses existing durable authorities, no starter grants,
 * demo currency or fixed epoch. Host stock uses initial mundane shop tuning.
 * Fallen actors retain dungeon death state; durable loss precedes projection.
 * Retrieved stash/preparation earnings survive departure without a second wipe.
 */
export function createLocalPreparation({THREE,campaign,inventory,storage,graphicsProfile='normal',withActor,getPaused=()=>false,getFocused=()=>null,getSelected=()=>false,getCompact=()=>false,onClosePanel=()=>{},document:doc=globalThis.document,notify=()=>{},now=()=>globalThis.performance?.now?.()??Date.now()}={}){
 const projectedActors=campaign.actors.map(a=>{const p={...a,position:{...a.position},equipment:JSON.parse(JSON.stringify(a.equipment)),alive:true,health:CLASSES[a.classId].maxHealth,fainted:false,escaped:false};Object.defineProperties(p,{classId:{get:()=>a.classId},gold:{get:()=>a.gold,set:value=>{a.gold=value;}}});return p;});
 let projecting=false;const projectedActor=id=>projectedActors.find(a=>a.id===id),bind=(id,fn)=>withActor(id,fn,projecting?projectedActor(id):undefined);
 const loss=createHubDeathLoss({campaign,inventory,withActor});
 const validPrepared=({epoch})=>campaign.actors.every(a=>a.alive!==false||loss.prepared(a.id,epoch))?{ok:true}:{ok:false,reason:'death-unprepared'};
 const level=createHubScene(THREE,{actors:projectedActors,graphicsProfile}),spawns=Object.fromEntries(campaign.actors.map((a,i)=>[a.id,{x:(i-1)*.8,y:0,z:2.2}]));
 let closed=false,feedback='Experimental hub · Your gold and gear · Initial shop prices.',lastSignature='',elapsed=0,needsRecovery=false;
 const adapter=createHubPreparation({campaign,inventory,storage,withActor:bind,getActor:projectedActor,prepareActors:context=>{projecting=false;const result=loss.prepare(context);projecting=result.ok;return result;},validatePrepared:validPrepared,getRole:()=>getSelected()?'local':'guest',getPaused,stations:level.stations,spawns,blocked:level.blocked,offersForEpoch:createHubStock,sellPrice:hubSellPrice});
 let panel=null,live=null,style=null,recoveryOwner=null,recoveryFallback;
 // O(1) frame check: traverse this separate scene only on entry or fallback.
 function adaptGraphics(recovery){if(closed||!recovery)return;const fallback=recovery.fallback===true;if(recoveryOwner===recovery&&recoveryFallback===fallback)return;recovery.adapt(level.scene);recoveryOwner=recovery;recoveryFallback=fallback;}
 const explain=reason=>({funds:'Not enough gold.',capacity:'Make room in your pack or stash.',proximity:'Move closer to the counter or stash.',station:'Open the matching counter or stash.',ownership:'Choose the adventurer who owns this gear.',actor:'This adventurer is unavailable.',phase:'Prepare between expeditions.',paused:'Close the menu to continue.',item:'This gear is no longer carried.',offer:'The keeper no longer offers that item.'}[reason]??'Could not finish. Try again before leaving.');
 const selected=()=>!closed&&getSelected();
 const enabled=()=>selected()&&campaign.state.phase==='lobby';
 const identity=id=>({actorId:id,ownerId:id});
 function enter(){projecting=false;const result=adapter.enterPreparation();feedback=result.ok?'Experimental hub · E at STASH / SHOP. Mundane level 1 stock; initial prices.':'Preparation unavailable. '+explain(result.reason);notify(feedback);lastSignature='';return result;}
 function canControl(id){const a=projectedActor(id);return enabled()&&adapter.ready&&!getPaused()&&a?.alive&&!a.fainted&&!a.escaped&&a.health>0;}
 function move(actor,input){if(!canControl(actor.id))return false;const before=adapter.getPose(actor.id),result=adapter.move({...identity(actor.id),...input});return result.ok&&(before.position.x!==result.pose.position.x||before.position.z!==result.pose.position.z);}
 function look(id,dx,dy){if(!canControl(id))return false;const p=adapter.getPose(id);return adapter.move({...identity(id),yaw:p.yaw+dx,pitch:p.pitch+dy}).ok;}
 function interact(id){const r=adapter.interact(identity(id));feedback=r.ok?(r.station==='shop'?'Keeper stock is ready.':r.station?'Stash holds saved gear separately from carried capacity.':'Station closed.'):explain(r.reason);renderPanel();return r.ok;}
 function closePanels(){adapter.clearPanels();lastSignature='';if(panel)panel.hidden=true;}
 // A button carries the epoch/sequence it was rendered with, so a repeated
 // press replays that receipt instead of starting a second transaction.
 function transact(id,kind,itemId,rendered){const view=adapter.view(identity(id));if(!view.ok)return view;const sequence=rendered?.sequence??view.nextSequence,r=adapter.execute({epoch:rendered?.epoch??view.epoch,id:'local:'+id+':'+sequence,sequence,kind,targetId:itemId},identity(id));feedback=r.ok?(r.mirrorPending?'Gear saved. Finish saving before departure.':kind==='deposit'?'Gear stored.':kind==='withdraw'?'Gear retrieved. Equip it from carried gear.':kind==='purchase'?'Added to carried gear. Equip in Inventory or at the stash.':'Carried gear sold.'):explain(r.reason);lastSignature='';renderPanel();return r;}
 function equip(id,itemId){if(!canControl(id)||!adapter.getStation(id))return false;const v=adapter.view(identity(id));if(!v.ok||!v.items.some(i=>i.id===itemId))return false;const ok=bind(id,()=>inventory.equip(itemId));feedback=ok&&!inventory.persistenceError?'Carried gear equipped.':'Equipment could not be saved.';lastSignature='';renderPanel();return ok;}
 const el=(tag,text,parent)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;parent?.appendChild(n);return n;};
 const button=(text,fn,parent)=>{const b=el('button',text,parent);b.type='button';b.addEventListener('click',fn);return b;};
 // Rows re-render under the pointer after each trade; the second click of a
 // double-click or double-tap must not trade a different row.
 let lastTrade=-Infinity;const trade=fn=>event=>{const t=now();if(event?.detail>1||t-lastTrade<TRADE_COOLDOWN_MS)return;lastTrade=t;fn();};
 // Keyboard and screen-reader support: a persistent live region outside the
 // re-rendered rows; focus enters the panel when it opens and stays on the same
 // control (data-lp-key) across re-renders after a trade.
 const buttons=(node,out=[])=>{for(const child of Array.from(node?.children??[])){if(String(child.tagName).toUpperCase()==='BUTTON')out.push(child);buttons(child,out);}return out;};
 const curseNote=(item,row)=>{const note=el('small',curseDescription(item),row);note.className='lp-curse';};
 const keyed=(b,key,label)=>{b.dataset.lpKey=key;b.setAttribute('aria-label',label);return b;};
 function renderPanel(){
  if(!doc||!panel)return;const id=getFocused(),a=campaign.actors.find(a=>a.id===id),station=adapter.getStation(id),visible=enabled()&&!getPaused();doc.body.classList.toggle('local-hub-preparation',visible);
  const wasHidden=panel.hidden;panel.hidden=!visible||!station||!a;if(panel.hidden)return;
  const v=adapter.view(identity(id)),signature=JSON.stringify([id,station,v,feedback]);if(signature===lastSignature)return;lastSignature=signature;
  const active=doc.activeElement,focusKey=active&&buttons(panel).includes(active)?active.dataset?.lpKey??'':null;
  panel.replaceChildren();fillPanel(id,station,v);if(live&&live.textContent!==feedback)live.textContent=feedback;
  const enabledButtons=buttons(panel).filter(b=>!b.disabled),firstAction=enabledButtons.find(b=>b.dataset?.lpKey)??enabledButtons[0];
  const subject=key=>String(key??'').split(':').slice(1).join(':'),sameItem=focusKey&&enabledButtons.find(b=>b.dataset?.lpKey===focusKey)||subject(focusKey)&&enabledButtons.find(b=>subject(b.dataset?.lpKey)===subject(focusKey));
  const target=focusKey!==null?sameItem||firstAction:wasHidden?firstAction:null;
  target?.focus?.({preventScroll:true});
 }
 function fillPanel(id,station,v){
  const rendered={epoch:v.epoch,sequence:v.nextSequence};
  const head=el('div',undefined,panel);head.className='lp-head';const heading=el('h3',id.replace('hero-','Hero ')+' · '+station.toUpperCase(),head);el('small','Experimental hub',heading);button(getCompact()?'Close':'Close · E / Esc',()=>{adapter.closePanel(id);onClosePanel();renderPanel();},head);
  if(!v.ok){el('p',explain(v.reason),panel);return;}
  el('p',v.gold+' gold · Carried '+v.items.length+'/'+v.packCapacity+' · Stored '+v.stored.length+'/'+v.stashCapacity,panel);el('p',feedback,panel);
  if(station==='shop'){
   el('p','Initial prices · common steel level 1. Sales pay 35% of slot price; upgrades are found in the dungeon.',panel);el('p','Purchases go to carried gear. Equip in Inventory or at the stash.',panel);el('h4','Keeper stock',panel);
   for(const offer of v.offers){const comparison=compareHubOffer(offer,v),row=el('div',undefined,panel);row.className='lp-item lp-offer';const detail=el('span',undefined,row);el('strong',offer.item.name+' · '+offer.price+' gold',detail);el('small','Stats: '+comparison.statsText,detail);el('small','If equipped vs '+comparison.against+': '+comparison.deltaText,detail);const b=keyed(button('Buy '+offer.price+' G',trade(()=>transact(id,'purchase',offer.id,rendered)),row),'buy:'+offer.id,'Buy '+offer.item.name+' for '+offer.price+' gold');b.disabled=v.gold<offer.price||v.items.length>=v.packCapacity;}
   el('h4','Sell carried gear',panel);if(!v.items.length)el('p','Empty',panel);for(const item of v.items){const row=el('div',undefined,panel);row.className='lp-item';const worn=v.equipped[item.slot]===item.id,price=hubSellPrice(item);el('span',item.name+(worn?' · equipped':''),row);if(item.curse)curseNote(item,row);keyed(button('Sell '+price+' G',trade(()=>transact(id,'sell',item.id,rendered)),row),'sell:'+item.id,'Sell '+item.name+(worn?' (equipped)':'')+' for '+price+' gold');}return;
  }
  for(const [title,items,kind]of [['Carried gear',v.items,'deposit'],['Stored gear',v.stored,'withdraw']]){el('h4',title,panel);if(!items.length)el('p','Empty',panel);for(const item of items){const row=el('div',undefined,panel);row.className='lp-item';el('span',item.name+' · '+Object.entries(item.stats).filter(([,n])=>n).map(([k,n])=>(n>0?'+':'')+n+' '+k).join(', '),row);if(item.curse)curseNote(item,row);keyed(button(kind==='deposit'?'Store':'Retrieve',trade(()=>transact(id,kind,item.id,rendered)),row),kind+':'+item.id,(kind==='deposit'?'Store ':'Retrieve ')+item.name);if(kind==='deposit'){const worn=v.equipped[item.slot]===item.id,label=worn?'Equipped':item.curse?'Equip cursed':'Equip';const b=keyed(button(label,trade(()=>equip(id,item.id)),row),'equip:'+item.id,label+(worn?': ':' ')+item.name);b.disabled=worn;}}}
 }
 if(doc){style=el('style',`.local-prep-panel{position:fixed;right:10px;top:138px;z-index:80;width:min(490px,calc(100vw - 36px));max-height:calc(100vh - 185px);max-height:calc(100dvh - 185px);overflow:auto;background:#131813f5;color:#d8ceb8;border:3px double #857352;padding:10px;box-sizing:border-box;overscroll-behavior:contain;font:12px monospace}.local-prep-panel[hidden]{display:none}.lp-live{position:fixed;left:-9999px;width:1px;height:1px;overflow:hidden}.lp-curse{flex-basis:100%;color:#d49a7a}.lp-head,.lp-item{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.lp-head{justify-content:space-between}.lp-item{padding:6px 0;border-top:1px solid #494939}.lp-item span{flex:1;min-width:130px}.lp-offer small{display:block;margin-top:4px;font-size:11px;line-height:1.4;overflow-wrap:anywhere}.lp-offer strong{font-size:12px}.lp-offer span{min-width:0}.local-prep-panel button{font:inherit;border:1px solid #776b52;background:#2b3026;color:#d8ceb8;padding:6px;min-height:44px;min-width:44px}.local-prep-panel h3{margin:3px 0}.lp-head h3 small{display:block;font:10px monospace;color:#bbaa86;margin-top:3px}.local-prep-panel button:focus-visible{outline:2px solid #d8c191;outline-offset:2px}@media(max-width:640px){.local-prep-panel{left:8px;right:8px;width:auto;top:calc(min(172px,22vh) + env(safe-area-inset-top));bottom:calc(min(190px,24vh) + env(safe-area-inset-bottom));max-height:none;padding:8px;font-size:12px}body.local-hub-preparation #mobileControls .mobile-actions button:not([data-touch-action=interact]){display:none!important}body.local-hub-preparation #mobileControls .mobile-actions{display:block;right:12px;bottom:28px}body.local-hub-preparation #mobileControls [data-touch-action=interact]{min-width:100px;min-height:64px}body.local-hub-preparation .party-loadout-shortcut{top:calc(188px + env(safe-area-inset-top));min-height:44px!important;max-width:calc(100% - 16px);z-index:43}body.local-hub-preparation #runningBuildLabel{bottom:calc(154px + env(safe-area-inset-bottom));left:8px;z-index:75;opacity:1;max-width:calc(100vw - 16px)}.local-prep-panel .lp-item span{min-width:115px}.local-prep-panel .lp-head{align-items:flex-start}.local-prep-panel .lp-head h3{max-width:calc(100% - 90px)}}@media(orientation:landscape) and (max-height:540px){.local-prep-panel{left:auto;right:8px;top:calc(8px + env(safe-area-inset-top));bottom:calc(8px + env(safe-area-inset-bottom));width:min(440px,52vw);max-height:none}body.local-hub-preparation #mobileControls .mobile-actions button:not([data-touch-action=interact]){display:none!important}}`,doc.head??doc.body);panel=el('section',undefined,doc.body);panel.className='local-prep-panel';panel.setAttribute('aria-label','Local preparation station');panel.setAttribute('role','dialog');panel.hidden=true;live=el('p',undefined,doc.body);live.className='lp-live';live.setAttribute('role','status');live.setAttribute('aria-live','polite');}
 function tick(dt){if(!enabled()){closePanels();doc?.body.classList.remove('local-hub-preparation');return;}if(getPaused())closePanels();else elapsed+=Math.max(0,Math.min(.05,dt))*1000;const poses=new Map(campaign.actors.map(a=>[a.id,adapter.getPose(a.id)]));level.update(elapsed,{poses,station:adapter.getStation(getFocused()),paused:getPaused()});renderPanel();}
 function prepareView(id){const poses=new Map(campaign.actors.map(a=>[a.id,adapter.getPose(a.id)]));level.update(elapsed,{poses,activeId:id,station:adapter.getStation(id)});}
 function stationHint(id){const a=campaign.actors.find(a=>a.id===id);if(!adapter.ready)return feedback;if(!a?.alive||a.health<=0){if(!projecting)return 'Finish preparing this adventurer before leaving';}const station=adapter.getStation(id);if(station)return (getCompact()?'Use · Close ':'E / Esc · Close ')+station;const p=adapter.getPose(id)?.position,s=Object.entries(level.stations).find(([,q])=>p&&Math.hypot(p.x-q.x,p.z-q.z)<=2.2)?.[0];return s?(getCompact()?'Use':'E')+' · Open '+s.toUpperCase():getCompact()?'Move and drag to look · Use at stash or shop':'WASD move · drag look · E at STASH / SHOP';}
 function hint(id){return 'Experimental hub · '+stationHint(id);}
 function beforeStart(){closePanels();const r=adapter.beforeStart();if(!r.ok){feedback='Cannot depart yet. '+explain(r.reason);notify(feedback);}return r;}
 function completeStart(){const r=adapter.completeStart();needsRecovery=!r.ok;if(!r.ok)notify('The expedition is held until saving finishes. Choose Resume to retry.');return r;}
 function dispose(){if(closed)return;closed=true;doc?.body.classList.remove('local-hub-preparation');adapter.close();level.dispose();panel?.remove();live?.remove();style?.remove();}
 return {adaptGraphics,enter,move,look,interact,closePanels,canControl,getPose:adapter.getPose,scene:level.scene,tick,prepareView,hint,transact,equip,beforeStart,completeStart,abortStart:adapter.abortStart,dispose,
  get enabled(){return enabled();},get ready(){return adapter.ready;},get departurePending(){return needsRecovery;},projectedActor,preparedActorIds(){const epoch=adapter.snapshot()?.epoch;return campaign.actors.filter(a=>a.alive===false&&loss.prepared(a.id,epoch)).map(a=>a.id);},keepsPreparedCarry(id){return this.preparedActorIds().includes(id);},get adapter(){return adapter;}};
}
