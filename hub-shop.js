import {generateInventoryLoot} from './adventurer-inventory.js?v=1d78ea79feefea23b13aa344fdb80a6c28d88fec';
import {curseEffects} from './cursed-equipment.js?v=1d78ea79feefea23b13aa344fdb80a6c28d88fec';

// Initial host-owned tuning. Mundane replacements only; stronger, themed and
// cursed equipment remains dungeon loot. Never derived from request fields.
export const HUB_BUY_PRICES=Object.freeze({helm:30,chest:50,arms:25,legs:35,weapon:55,shield:40});
const weapons=['sword','axe','mace','hammer','dagger','staff','wand','bow'];
export function hubPurchaseEquivalent(item){return HUB_BUY_PRICES[item?.slot==='offhand'?'shield':item?.slot]??0;}
export function hubSellPrice(item){const buy=hubPurchaseEquivalent(item);return buy?Math.max(1,Math.min(buy-1,Math.floor(buy*35/100))):0;}
const statLabels={hp:'HP',armor:'Armor',melee:'Melee',magic:'Magic',stamina:'Stamina'};
const effects=item=>{const curse=item?curseEffects(item):{};return Object.fromEntries(Object.keys(statLabels).map(key=>[key,(item?.stats?.[key]??0)+(curse[key]??0)]));};
export function formatHubStats(stats){return Object.entries(statLabels).filter(([key])=>stats[key]).map(([key,label])=>(stats[key]>0?'+':'')+stats[key]+' '+label).join(' · ')||'No stat change';}
/** Compare owned gear in this slot, including its curse effects. Class base
 * stats remain unchanged when an empty/starter slot receives an item. */
export function compareHubOffer(offer,{items=[],equipped={}}={}){
 const current=items.find(item=>item.id===equipped[offer.item.slot]&&item.slot===offer.item.slot),stats=effects(offer.item),before=effects(current),delta=Object.fromEntries(Object.keys(statLabels).map(key=>[key,stats[key]-before[key]]));
 return {stats,delta,against:current?.name??'starter gear',statsText:formatHubStats(stats),deltaText:formatHubStats(delta)};
}
export function createHubStock(epoch){
 if(typeof epoch!=='string'||epoch.length>64||!/^[a-zA-Z0-9_.:-]+$/.test(epoch))throw TypeError('Invalid preparation epoch');
 return [...['helm','chest','arms','legs'].map(slot=>({id:slot,slot})),...weapons.map(kind=>({id:kind,slot:'weapon',kind})),{id:'shield',slot:'offhand',kind:'shield'}].map(spec=>{
  // Forge rolls stay unchanged. Select a deterministic common steel roll rather
  // than relabeling rare stats, inventing item stats or using a mutable RNG.
  for(let n=0;n<128;n++){const item=generateInventoryLoot({seed:'hub:v1:'+epoch+':'+spec.id+':'+n,slot:spec.slot,kind:spec.kind,level:1,theme:'steel',curse:null});if(item.rarity==='common')return {id:spec.id,price:hubPurchaseEquivalent(item),item};}
  throw Error('Mundane stock could not be generated');
 });
}
