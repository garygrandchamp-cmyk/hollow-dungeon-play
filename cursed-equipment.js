// Canonical affixes: serialized items store an ID, never caller-defined effects.
export const EQUIPMENT_CURSES=Object.freeze({
 bloodbound:Object.freeze({name:'Bloodbound',benefit:'+6 physical damage',drawback:'−18 max HP',effects:Object.freeze({melee:6,hp:-18})}),
 hollowed:Object.freeze({name:'Hollowed',benefit:'+8 magic power',drawback:'−24 max HP',effects:Object.freeze({magic:8,hp:-24})}),
 gravebound:Object.freeze({name:'Gravebound',benefit:'+4 armor',drawback:'−20 max stamina',effects:Object.freeze({armor:4,stamina:-20})}),
});
export function compatibleCurse(item,id){
 if(typeof id!=='string'||!Object.hasOwn(EQUIPMENT_CURSES,id))return false;
 if(!item)return false;const magic=item.slot==='weapon'&&['staff','wand'].includes(item.kind)||item.slot==='offhand'&&item.kind==='magic';
 return id==='bloodbound'?item.slot==='weapon'&&['sword','axe','mace','bow','dagger','hammer'].includes(item.kind):id==='hollowed'?magic:item.kind==='armor'&&['helm','chest','arms','legs'].includes(item.slot)||item.slot==='offhand'&&item.kind==='shield';
}
export function curseEffects(item){return compatibleCurse(item,item?.curse)?EQUIPMENT_CURSES[item.curse].effects:{};}
export function curseDescription(item){const c=compatibleCurse(item,item?.curse)?EQUIPMENT_CURSES[item.curse]:null;return c?'CURSED · '+c.name+': '+c.benefit+' / '+c.drawback+'. While equipped; unequip freely.':'';}
