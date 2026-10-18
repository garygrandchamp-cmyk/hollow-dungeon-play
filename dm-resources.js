export const DM_COSTS=Object.freeze({
 'chapel-decoy':6,'chapel-flood':12,'chapel-ring':8,
 'monster:skeleton':6,'monster:goblin':8,'monster:rat':3,'monster:bat':4,'monster:crawler':6,'monster:slime':10,'monster:spider':10,'monster:wraith':14,'monster:skeletal-mage':18,'monster:drowned':12,'monster:boss':55,'action:possess-boss':35,
 'trap:spikes':5,'trap:pit':7,'trap:crate':2,'trap:rubble':2,'trap:swinging-axe':12,'trap:rolling-ball':14,'trap:rat-cage':16,
 'door:locked':3,'door:silver':3,'door:named':5,'key:silver':0,'key:named':0,'loot:chest':2,'loot:cabinet':2,
});
export function createDMResources({budget=120,maxStamina=100}={}){
 if(!Number.isFinite(budget)||budget<0||!Number.isFinite(maxStamina)||maxStamina<0)throw TypeError('Invalid DM resources');
 const placements=new Map();let spent=0,stamina=maxStamina;
 function price(kind){return DM_COSTS[kind]??null;}
 function canSpend(kind,phase='setup'){if(typeof kind!=='string')return false;if(phase!=='setup'&&(kind.startsWith('door:')||kind.startsWith('key:')))return false;const cost=price(kind);return cost!==null&&cost<=(phase==='setup'?budget-spent:stamina);}
 // Call only after the host has validated and committed a placement.
 function spend(id,kind,phase='setup'){if(placements.has(id))return false;if(!canSpend(kind,phase))return false;const cost=price(kind);if(phase==='setup')spent+=cost;else stamina-=cost;placements.set(id,{id,kind,cost,phase});return true;}
 function remove(id,phase='setup'){const p=placements.get(id);if(!p)return false;placements.delete(id);if(p.phase==='setup'&&phase==='setup')spent-=p.cost;return true;}
 return {price,canSpend,spend,remove,get placements(){return [...placements.values()].map(x=>({...x}));},get snapshot(){return {budget,spent,remainingBudget:budget-spent,stamina,maxStamina};},reset(){spent=0;stamina=maxStamina;placements.clear();},beginRun(){stamina=maxStamina;},restoreStamina(amount){if(Number.isFinite(amount)&&amount>0)stamina=Math.min(maxStamina,stamina+amount);return stamina;}};
}
