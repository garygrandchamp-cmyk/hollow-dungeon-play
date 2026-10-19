/** Explicit player-requested transition only. No inventory writes, revival,
 * dungeon pose changes or implicit execution on role selection. The preparation
 * adapter subsequently recovers wallets and applies death loss once per run. */
export function abandonSavedExpedition(campaign){
 if(campaign?.phase!=='active'||!campaign.state?.objectives?.clear||!Array.isArray(campaign.actors)||typeof campaign.persist!=='function')return {ok:false,reason:'phase'};
 const before={phase:campaign.state.phase,objectives:new Set(campaign.state.objectives),endReason:campaign.state.endReason,escaped:campaign.actors.map(a=>a.escaped)};
 campaign.state.phase='lobby';campaign.state.objectives.clear();delete campaign.state.endReason;for(const a of campaign.actors)a.escaped=false;
 let saved=false;try{saved=campaign.persist()===true;}catch{}
 if(!saved){campaign.state.phase=before.phase;campaign.state.objectives.clear();for(const k of before.objectives)campaign.state.objectives.add(k);if(before.endReason!==undefined)campaign.state.endReason=before.endReason;campaign.actors.forEach((a,i)=>a.escaped=before.escaped[i]);return {ok:false,reason:'campaign-storage'};}
 return {ok:true};
}
