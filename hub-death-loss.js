import {CLASSES} from './party-campaign.js?v=1d78ea79feefea23b13aa344fdb80a6c28d88fec';
const fail=reason=>({ok:false,reason});
/** System-only local preparation step. Actual campaign actors remain dead.
 * Resolve pending shop wallets first; bind ACTUAL actors here, not projections.
 * Loss checkpoint and carried wipe share one inventory-key write. Campaign
 * gold/legacy carry is mirrored and acknowledged before projection can open.
 */
export function createHubDeathLoss({campaign,inventory,withActor}={}){
 const persist=()=>{try{return campaign.persist()===true;}catch{return false;}};
 function clearMirror(a){a.gold=0;a.inventory=[];a.equipment={weapon:{id:CLASSES[a.classId].defaultWeapon},offhand:{id:CLASSES[a.classId].defaultOffhand}};a.offhand=CLASSES[a.classId].defaultOffhand;}
 function prepared(id,epoch){return withActor(id,()=>{const loss=inventory.hubRecord()?.preparationLoss;return loss?.epoch===epoch&&loss.runNumber===campaign.runNumber&&!loss.pendingMirror;});}
 function prepare({epoch}={}){
  if(campaign.phase!=='lobby'||inventory.hubDurable!==true||!inventory.hubStorageCurrent())return fail('death-context');
  for(const actor of campaign.actors){const result=withActor(actor.id,()=>{
   let r=inventory.hubRecord(),loss=r.preparationLoss;
   if(loss?.pendingMirror){
    if(loss.runNumber!==campaign.runNumber||loss.epoch!==epoch||actor.alive!==false||actor.health!==0||![0,loss.goldBefore].includes(actor.gold))return fail('death-wallet-conflict');
    clearMirror(actor);if(!persist())return fail('campaign-storage');if(!inventory.acknowledgePreparationLoss(epoch,loss.runNumber))return fail('death-mirror-pending');r=inventory.hubRecord();loss=r.preparationLoss;
   }
   if(actor.alive!==false)return {ok:true};
   if(actor.health!==0||campaign.runNumber<1)return fail('death-actor');
   if(loss?.runNumber===campaign.runNumber)return loss.epoch===epoch?{ok:true}:fail('death-epoch');
   if(loss?.runNumber>campaign.runNumber||r.hub?.pendingMirror)return fail('death-wallet-conflict');
   if(!persist())return fail('campaign-storage');const before={gold:actor.gold,inventory:actor.inventory,equipment:actor.equipment,offhand:actor.offhand};clearMirror(actor);
   if(!inventory.commitPreparationLoss({epoch,runNumber:campaign.runNumber,goldBefore:before.gold,pendingMirror:true},{expected:r})){Object.assign(actor,before);return fail('death-inventory-storage');}
   if(!persist())return fail('campaign-storage');if(!inventory.acknowledgePreparationLoss(epoch,campaign.runNumber))return fail('death-mirror-pending');return {ok:true};
  });if(!result.ok)return result;}
  return {ok:true};
 }
 return {prepare,prepared};
}
