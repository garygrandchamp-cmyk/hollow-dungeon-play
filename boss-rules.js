export const BOSS_SUMMON_COST=55,BOSS_POSSESSION_COST=35;
/** Shared host/UI eligibility. A summoned guardian and the DM's committed body
 * have different stakes; no random combat stat or geometry work happens here. */
export function bossOptions({phase,actors=[],objectives=0,requiredObjectives=6,boss=null,pending=false,possessed=false,stamina=0,remote=false,paused=false}={}){
 const threshold=Math.max(1,Math.ceil((Number.isFinite(requiredObjectives)?requiredObjectives:6)/2)),remaining=actors.filter(a=>a.alive!==false&&!a.fainted&&!a.escaped&&a.health>0).length;
 const active=phase==='active',committed=possessed||!!boss?.controlled;
 const shared=!active?'Start the expedition first.':remote?'Only the host DM can command bosses.':paused?'Close menus or wait for the dungeon to finish.':remaining===0?'No adventurers remain in the dungeon.':'';
 const summonReason=shared|| (committed?'You have committed to the last-resort body.':boss||pending?'A boss is already present or arriving.':stamina<BOSS_SUMMON_COST?'Need 55 DM stamina to send a boss.':'');
 const possessionReason=shared||(committed?'Possession is already committed for this expedition.':!boss?'Send a boss through an entrance first.':boss.arriving?'Wait for the boss to finish entering.':objectives<threshold&&remaining>1?'Unlocks at '+threshold+' / '+requiredObjectives+' relics, or when one unescaped adventurer remains.':stamina<BOSS_POSSESSION_COST?'Need 35 DM stamina to possess this boss.':'');
 const stakes=committed?'LAST RESORT COMMITTED · If the possessed body dies, the adventurers win immediately.':'Ordinary boss: defeating it does not end the expedition. Possession costs 35 stamina and commits the DM: if that body dies, the adventurers win immediately.';
 return {canSummon:!summonReason,canPossess:!possessionReason,summonReason,possessionReason,threshold,remaining,committed,stakes};
}
