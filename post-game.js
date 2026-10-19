// Shared result content for solo and party play. Values are copied at the end;
// rendering never revives an actor or starts the next expedition.
export function postGameSummary({phase,endReason,seed='',runNumber=0,objectives=0,requiredObjectives=6,actors=[],inventoryCounts={}}){
 return {winner:phase==='partyVictory'?'ADVENTURERS WIN':'DUNGEON MASTER WINS',reason:phase==='partyVictory'?(endReason==='bossDefeated'?"The DM's possessed last-resort body was slain.":'The surviving adventurers recovered the relics and escaped.'):'The expedition has fallen.',seed,runNumber,objectives,requiredObjectives,
  actors:actors.map(a=>({id:a.name??a.id,classId:a.classId??'adventurer',outcome:!a.alive||a.health<=0?'Fallen':a.escaped?'Escaped':'Survived',kills:a.kills??0,gold:a.gold??0,items:inventoryCounts[a.id]??a.inventory?.length??0,health:Math.ceil(a.health??0),stamina:Math.floor(a.stamina??100)}))};
}
export function renderPostGame(document,element,summary,{onContinue=()=>{},remote=false,listen=(node,event,fn)=>node.addEventListener(event,fn),notify=()=>{}}={}){
 element.replaceChildren();element.setAttribute('aria-label','Post Game');
 const make=(tag,text,parent=element)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);parent.appendChild(n);return n;};
 make('h2','POST GAME');make('h3',summary.winner);make('p',summary.reason);
 make('p',`Expedition ${summary.runNumber} · Relics ${summary.objectives} / ${summary.requiredObjectives} · Seed ${summary.seed}`);
 const scroll=make('div');scroll.className='result-rows';const table=make('table',undefined,scroll),head=make('tr',undefined,make('thead',undefined,table));
 for(const title of ['Adventurer','Outcome','Kills','Gold','Items','HP','Stamina'])make('th',title,head);
 const body=make('tbody',undefined,table);for(const a of summary.actors){const row=make('tr',undefined,body);for(const value of [a.id+' · '+a.classId,a.outcome,a.kills,a.gold,a.items,a.health,a.stamina])make('td',value,row);}
 for(const a of summary.actors)make('p',`${a.id}: ${a.outcome==='Fallen'?'dead · starts next run empty':`survived · ${a.gold} gold / ${a.items} items carry forward`}`);
 make('p','Survivors retain carried loot. Fallen adventurers lose their carried equipment; class starters remain.');
 const status=make('p',remote?'The host prepares the next expedition.':'Continue returns to the lobby before the next expedition.');status.setAttribute('role','status');
 const button=make('button','Continue');button.type='button';let pending=false;
 listen(button,'click',async()=>{if(pending)return;pending=true;button.disabled=true;try{const accepted=await onContinue();if(accepted===false){status.textContent='Could not return to the lobby. Try again.';return;}element.hidden=true;}catch(error){status.textContent='Could not return to the lobby. Try again.';notify(error?.message??String(error));}finally{pending=false;button.disabled=false;}});
 return button;
}
