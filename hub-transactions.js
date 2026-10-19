import {normalizeInventoryItem,INVENTORY_CAPACITY,HUB_STASH_CAPACITY,HUB_RECEIPT_LIMIT} from './adventurer-inventory.js?v=1d78ea79feefea23b13aa344fdb80a6c28d88fec';
const token=(v,max=128)=>typeof v==='string'&&v.length<=max&&/^[a-zA-Z0-9_.:-]+$/.test(v);
const integer=(v,min=0,max=1e9)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const clone=v=>JSON.parse(JSON.stringify(v));
const fail=reason=>({ok:false,reason});
const point=p=>p&&['x','z'].every(k=>typeof p[k]==='number'&&Number.isFinite(p[k]))&&(p.y===undefined||typeof p.y==='number'&&Number.isFinite(p.y));

/** Host-only safe-level economy, independent of scene/input code.
 * getContext(actorId) supplies trusted {role,phase,epoch,position,stations:{stash,shop}}.
 * epoch is a persisted profile/run token (<=64 chars), rotated before each run;
 * request epochs and actor ownership must come through a trusted transport bridge.
 * withActor synchronously binds inventory.actor. persistCampaign saves the gold
 * mirror. One inventory-key write commits items/stash/wallet/receipt atomically;
 * the wallet checkpoint repairs a failed campaign mirror before another commit.
 */
export function createHubTransactions({inventory,getActor,withActor=(_id,fn)=>fn(),getContext,offers=[],sellPrice=()=>0,persistCampaign,interactionRadius=2.2}={}){
 if(!inventory?.commitHubRecord||!inventory?.acknowledgeHubMirror||!inventory?.hubStorageCurrent||typeof getActor!=='function'||typeof getContext!=='function'||typeof withActor!=='function'||typeof persistCampaign!=='function'||typeof sellPrice!=='function'||!Number.isFinite(interactionRadius)||interactionRadius<=0||interactionRadius>3)throw TypeError('Invalid hub transaction dependencies');
 const catalog=new Map();for(const offer of offers){const item=normalizeInventoryItem(offer?.item);if(!token(offer?.id,64)||catalog.has(offer.id)||!integer(offer.price,1)||!item)throw TypeError('Invalid host shop offer');catalog.set(offer.id,{id:offer.id,price:offer.price,item});}
 let locked=false;
 function access(actorId,ownerId){
  if(!token(actorId,96)||ownerId!==actorId)return fail('ownership');const context=getContext(actorId);
  if(!context||!['host','local'].includes(context.role))return fail('authority');if(context.phase!=='lobby')return fail('phase');if(!token(context.epoch,64))return fail('epoch');
  const actor=getActor(actorId);if(!actor||actor.id!==actorId||actor.alive===false||actor.fainted||actor.escaped||Number.isFinite(actor.health)&&actor.health<=0)return fail('actor');
  if(inventory.actor?.id!==actorId)return fail('actor-context');if(!integer(actor.gold))return fail('gold');return {ok:true,actor,context};
 }
 function mirror(actor,record,epoch){
  if(record.hub?.pendingMirror&&record.hub.epoch!==epoch)return fail('epoch-recovery');
  const wallet=record.hub?.epoch===epoch?record.hub:null;if(wallet&&actor.gold!==wallet.gold){if(!wallet.pendingMirror||actor.gold!==wallet.previousGold)return fail('wallet-conflict');actor.gold=wallet.gold;}
  return {ok:true,wallet};
 }
 function persist(){try{return persistCampaign()===true;}catch{return false;}}
 function settle(wallet){return persist()&&(!wallet?.pendingMirror||inventory.acknowledgeHubMirror(wallet.epoch,wallet.sequence));}
 function bound(actorId,ownerId,fn){if(locked)return fail('busy');if(!token(actorId,96)||ownerId!==actorId)return fail('ownership');locked=true;try{return withActor(actorId,()=>{const gate=access(actorId,ownerId);return gate.ok?fn(gate):gate;})??fail('actor-context');}catch{return fail('context');}finally{locked=false;}}
 function execute(request,{actorId,ownerId}={}){return bound(actorId,ownerId,({actor,context})=>{
  if(!request||typeof request!=='object'||Array.isArray(request)||Object.keys(request).length!==5||Object.keys(request).some(k=>!['epoch','id','sequence','kind','targetId'].includes(k))||request.epoch!==context.epoch||!token(request.id)||!integer(request.sequence,1,Number.MAX_SAFE_INTEGER)||!['deposit','withdraw','purchase','sell'].includes(request.kind)||!token(request.targetId))return fail('request');
  let before=inventory.hubRecord();if(!before)return fail('actor-context');if(!inventory.hubStorageCurrent())return fail('inventory-stale');const checked=mirror(actor,before,context.epoch);if(!checked.ok)return checked;const wallet=checked.wallet,last=wallet?.sequence??0;
  const cached=wallet?.receipts.find(r=>r.sequence===request.sequence);
  if(cached){if(cached.id!==request.id||cached.kind!==request.kind||cached.targetId!==request.targetId)return fail('conflict');return {ok:true,durable:inventory.hubDurable===true,replayed:true,receipt:clone(cached),nextSequence:last+1,mirrorPending:!settle(wallet)};}
  if(request.sequence!==last+1)return fail('sequence');if(wallet?.receipts.some(r=>r.id===request.id))return fail('conflict');
  if(wallet?.pendingMirror){if(!settle(wallet))return fail('mirror-pending');before=inventory.hubRecord();}
  const station=['deposit','withdraw'].includes(request.kind)?context.stations?.stash:context.stations?.shop,p=context.position;
  if(!point(p)||!point(station)||Math.hypot(p.x-station.x,(p.y??0)-(station.y??0),p.z-station.z)>interactionRadius)return fail('proximity');
  const next=clone(before);next.stored??=[];let item,price=0,gold=actor.gold;
  if(request.kind==='purchase'){
   const offer=catalog.get(request.targetId);if(!offer)return fail('offer');if(next.items.length>=INVENTORY_CAPACITY)return fail('capacity');price=offer.price;if(gold<price)return fail('funds');
   item={...clone(offer.item),id:'shop:'+context.epoch+':'+actorId+':'+request.sequence};if(!token(item.id)||[...next.items,...next.stored].some(i=>i.id===item.id))return fail('identity');next.items.push(item);gold-=price;
  }else{
   const source=request.kind==='withdraw'?next.stored:next.items;item=source.find(i=>i.id===request.targetId);if(!item)return fail('item');
   if(request.kind==='deposit'&&next.stored.length>=HUB_STASH_CAPACITY||request.kind==='withdraw'&&next.items.length>=INVENTORY_CAPACITY)return fail('capacity');
   if(request.kind==='sell'){
    try{price=sellPrice(clone(item));}catch{return fail('price');}if(!integer(price,1))return fail('price');
    // Host policy may undervalue a purchase but cannot create a shop round-trip
    // profit for its own unchanged catalog gear.
    if(item.id.startsWith('shop:'))for(const offer of catalog.values())if(offer.item.seed===item.seed&&offer.item.slot===item.slot&&offer.item.kind===item.kind)price=Math.min(price,offer.price);
    if(!integer(gold+price))return fail('gold-limit');gold+=price;
   }
   source.splice(source.indexOf(item),1);if(request.kind==='deposit')next.stored.push(item);if(request.kind==='withdraw')next.items.push(item);
   if(request.kind!=='withdraw'&&next.equipped[item.slot]===item.id)next.equipped[item.slot]=null;
  }
  const receipt={id:request.id,sequence:request.sequence,kind:request.kind,targetId:request.targetId,itemId:item.id,goldBefore:actor.gold,goldAfter:gold};
  next.hub={epoch:context.epoch,sequence:request.sequence,gold,previousGold:actor.gold,pendingMirror:true,receipts:[...(wallet?.receipts??[]),receipt].slice(-HUB_RECEIPT_LIMIT)};
  // Persist the baseline first: at most one inventory commit can await repair
  // of the campaign mirror, even after repeated disk failures or a restart.
  if(!persist())return fail('campaign-storage');const previousGold=actor.gold;actor.gold=gold;let committed=false;
  try{committed=inventory.commitHubRecord(next,{expected:before});}catch{committed=false;}
  if(!committed){actor.gold=previousGold;return fail('inventory-storage');}
  return {ok:true,durable:inventory.hubDurable===true,replayed:false,receipt:clone(receipt),nextSequence:request.sequence+1,mirrorPending:!settle(next.hub)};
 });}
 function recover({actorId,ownerId}={}){return bound(actorId,ownerId,({actor,context})=>{const record=inventory.hubRecord();if(!record)return fail('actor-context');if(!inventory.hubStorageCurrent())return fail('inventory-stale');const checked=mirror(actor,record,context.epoch);if(!checked.ok)return checked;return {ok:true,durable:inventory.hubDurable===true,recovered:!!checked.wallet,mirrorPending:!settle(checked.wallet),nextSequence:(checked.wallet?.sequence??0)+1};});}
 return {execute,recover,catalog:()=>[...catalog.values()].map(clone)};
}
