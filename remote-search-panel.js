import {compatibleCurse} from './cursed-equipment.js?v=b62f91ca9ddcf47d5a6312b8f4025115d5dbd33a';
import {searchFeedback,searchRollStyles,lootDetails,appendSearchComparison} from './search-feedback.js?v=b62f91ca9ddcf47d5a6312b8f4025115d5dbd33a';
// Presentation only. Host snapshots own outcomes, stamina and loot grants.
export function createRemoteSearchPanel({sendAction,sound=()=>{},drawIcon=null,document:doc=globalThis.document,now=()=>globalThis.performance?.now?.()??Date.now(),setInterval:startInterval=globalThis.setInterval,clearInterval:stopInterval=globalThis.clearInterval,setTimeout:startTimeout=globalThis.setTimeout,clearTimeout:stopTimeout=globalThis.clearTimeout}={}) {
  if(typeof sendAction!=='function'||!doc)throw Error('Remote search requires sendAction and a document.');
  const dialog=doc.createElement('dialog');dialog.className='hollow-remote-search';dialog.setAttribute('aria-label','Search container');dialog.hidden=true;
  const style=doc.createElement('style');style.textContent=`.hollow-remote-search{box-sizing:border-box;width:min(440px,calc(100vw - 24px));max-height:calc(100dvh - 30px);overflow:auto;padding:20px;background:#161b25;color:#d8d0bb;border:5px double #9a845d;font:14px/1.5 monospace;z-index:11000}.hollow-remote-search::backdrop{background:#000b}.hollow-remote-search[hidden]{display:none}.hollow-remote-search h2{font:20px monospace;color:#d8ba7c;margin:0 0 12px}.hollow-remote-search .rs-target{text-align:center;background:#0a1017;padding:12px;border:1px solid #766c59}.hollow-remote-search .rs-die{font:bold 52px/90px monospace;color:#e4c88d;margin:12px auto;width:104px;height:90px;text-align:center;background:#242a35;clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)}.hollow-remote-search .rs-rolling{animation:rs-dice .09s steps(2) infinite}.hollow-remote-search button{margin:8px 8px 0 0;padding:9px 12px;color:#eee2c9;background:#292f39;border:1px solid #8f7f61;font:inherit;cursor:pointer}.hollow-remote-search button:focus-visible{outline:3px solid #e3bf72;outline-offset:2px}.hollow-remote-search button:disabled{opacity:.5;cursor:wait}.hollow-remote-search ul{padding:0;list-style:none}.hollow-remote-search li{padding:10px 0;border-bottom:1px solid #484a47}.hollow-remote-search .rs-success{color:#b4d39c}.hollow-remote-search .rs-failed{color:#e4a08a}@keyframes rs-dice{from{transform:rotate(-6deg)}to{transform:rotate(6deg)}}@media(prefers-reduced-motion:reduce){.hollow-remote-search .rs-rolling{animation:none}}`;
  style.textContent+=searchRollStyles;doc.body.append(style,dialog);let current=null,signature='',epoch=0,open=false,disposed=false,animation=null,retry=null,waiting=false,previousFocus=null,suppressed=null;
  const make=(tag,text,parent=dialog)=>{const el=doc.createElement(tag);if(text!==undefined)el.textContent=text;parent.append(el);return el;};
  const idOK=id=>typeof id==='string'&&/^[a-zA-Z0-9_.:-]{1,128}$/.test(id);
  const text=(value,fallback,max=128)=>typeof value==='string'&&value.length<=max?value:fallback;
  function clean(snapshot){
    if(!snapshot||typeof snapshot!=='object'||!idOK(snapshot.id)||!['ready','rolling','success','failed'].includes(snapshot.status)||!Number.isInteger(snapshot.dc)||snapshot.dc<1||snapshot.dc>20)return null;
    const result={id:snapshot.id,name:text(snapshot.name,'Container'),dc:snapshot.dc,status:snapshot.status,cost:8};
    if(Number.isFinite(snapshot.total)&&Math.abs(snapshot.total)<=1000)result.total=snapshot.total;result.fainted=snapshot.fainted===true;result.exhausted=snapshot.exhausted===true;
    if(Number.isInteger(snapshot.roll)&&snapshot.roll>=1&&snapshot.roll<=20)result.roll=snapshot.roll;
    // Never inspect or retain contents for an unrevealed search, even if supplied.
    if(snapshot.status==='success'){
      result.contents=[];const ids=new Set();
      for(const item of Array.isArray(snapshot.contents)?snapshot.contents.slice(0,128):[]){if(!item||!idOK(item.id)||ids.has(item.id))continue;ids.add(item.id);const entry={id:item.id,name:text(item.name,'Unknown item'),kind:text(item.kind,'item',40)};if(entry.kind==='gold'&&Number.isSafeInteger(item.amount)&&item.amount>=0&&item.amount<=1e9)entry.amount=item.amount;for(const key of ['slot','theme','rarity','seed','blade','base','armorType','color'])if(typeof item[key]==='string'&&item[key].length<=(key==='seed'?128:40))entry[key]=item[key];if(Number.isInteger(item.armorVariant)&&item.armorVariant>=0&&item.armorVariant<10)entry.armorVariant=item.armorVariant;entry.stats={};for(const key of ['hp','armor','melee','magic','stamina'])if(Number.isFinite(item.stats?.[key])&&Math.abs(item.stats[key])<=10000)entry.stats[key]=item.stats[key];if(compatibleCurse(entry,item.curse))entry.curse=item.curse;result.contents.push(entry);}
    }
    return result;
  }
  let waitingKind=null,dieDisplay=null;
  function timers(){if(animation!==null)stopInterval(animation);if(retry!==null)stopTimeout(retry);animation=retry=null;waiting=false;waitingKind=null;}
  function animateDie(die,token){die.className=die.className.replace(' search-settled','')+' rs-rolling';die.textContent='?';let face=0,ticks=0;animation=startInterval(()=>{if(token!==epoch||!open)return;face=(face+7)%20;ticks++;if(ticks<=16&&ticks%2===0)sound('dice-roll-tick');die.textContent=String(face+1);},65);animation?.unref?.();}
  function hide(){epoch++;timers();open=false;current=null;signature='';if(dialog.open)dialog.close?.();dialog.hidden=true;dialog.replaceChildren();previousFocus?.focus?.();}
  function request(kind,targetId,token,button){
    if(disposed||!open||token!==epoch||waiting)return;
    let sent=false;try{sent=sendAction(kind,targetId)!==false;}catch{sent=false;}
    if(!sent){feedback.textContent='Connection unavailable. Try again.';return;}
    // A synchronous host callback may already have applied a newer snapshot.
    if(token!==epoch||!open)return;
    waiting=true;waitingKind=kind;for(const el of dialog.querySelectorAll('button'))if(el.dataset.request||kind==='search-roll')el.disabled=true;
    feedback.textContent=kind==='take-item'?'Waiting for the host to grant this item…':'Waiting for the host to roll…';
    if(kind==='search-roll'){animateDie(dieDisplay,token);sound('dice-roll-start');}
    retry=startTimeout(()=>{if(token!==epoch||disposed||!open)return;retry=null;waiting=false;render();},2000);retry?.unref?.();
  }
  let feedback;
  function render(){
    const c=current;if(!c||disposed)return;epoch++;timers();const token=epoch;dialog.replaceChildren();
    make('h2',c.name);const die=appendSearchComparison(doc,dialog,{dc:c.dc,roll:c.roll,dieClass:'rs-die',settled:['success','failed'].includes(c.status),cost:c.cost});dieDisplay=die;die.setAttribute('aria-hidden','true');
    feedback=make('p','');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
    if(c.status==='rolling'){
      animateDie(die,token);feedback.textContent=`Rolling D20… Need ${c.dc} or higher. −8 stamina.`;const progress=make('div');progress.className='search-progress';make('span','',progress);
    }else if(c.status==='success'||c.status==='failed'){
      const won=c.status==='success';feedback.className=won?'rs-success':'rs-failed';feedback.textContent=c.roll===undefined?(won?'SUCCESS — contents revealed.':'FAILED — contents remain hidden.'):searchFeedback({...c,success:won});
    }else feedback.textContent='Contents concealed. Make a search check.';
    if(c.status==='success'){
      make('h3','CONTAINER CONTENTS').className='search-contents-title';const list=make('ul');if(!c.contents.length)make('li','Empty — everything has been taken.',list);
      for(const item of c.contents){const row=make('li',item.kind==='gold'&&item.amount!==undefined?`${item.amount} gold`:item.name,list),take=make('button','Take',row);make('small',lootDetails(item),row).className='search-item-details';if(drawIcon&&item.kind!=='gold'){const icon=make('canvas',undefined,row);icon.style.cssText='float:left;width:48px;height:48px;image-rendering:pixelated;margin:0 10px 6px 0';drawIcon(item,icon);}take.type='button';take.dataset.request='take';take.setAttribute('aria-label',`Take ${item.kind==='gold'&&item.amount!==undefined?item.amount+' gold':item.name}`);take.addEventListener('click',()=>{if(current?.id===c.id&&current.status==='success'&&current.contents.some(x=>x.id===item.id))request('take-item',item.id,token,take);});}
    }else if(c.status!=='rolling'){
      const roll=make('button',c.fainted||c.exhausted?'Exhausted — cannot search':c.status==='failed'?'Try again · 8 stamina':'Roll D20 · 8 stamina');roll.type='button';roll.dataset.request='roll';roll.disabled=c.fainted||c.exhausted;roll.addEventListener('click',()=>{if(!c.fainted&&!c.exhausted)request('search-roll',undefined,token,roll);});
    }
    const done=make('button','Close');done.type='button';done.disabled=c.status==='rolling';done.addEventListener('click',()=>{if(token===epoch&&current?.id===c.id)api.close();});
  }
  dialog.addEventListener('cancel',event=>{event.preventDefault();api.close();});
  dialog.addEventListener('keydown',event=>event.stopPropagation());
  const api={
    element:dialog,
    get isOpen(){return open;},
    apply(snapshot){
      if(disposed)return false;
      if(snapshot===null||snapshot===undefined){suppressed=null;if(open)hide();return true;}
      const value=clean(snapshot);if(!value){if(open)hide();return false;}
      if(suppressed?.id===value.id&&now()<suppressed.until)return false;
      suppressed=null;const next=JSON.stringify(value);if(open&&signature===next)return true;
      const hadOpen=open,focused=doc.activeElement,previous=current,pendingRoll=waitingKind==='search-roll';current=value;signature=next;open=true;dialog.hidden=false;render();if(previous?.id!==value.id||previous?.status!==value.status){if(value.status==='rolling'&&!pendingRoll)sound('dice-roll-start');else if(value.status==='success'||value.status==='failed')sound(value.status==='success'?'dice-success':'dice-failure');}
      if(!hadOpen){previousFocus=focused;try{if(!dialog.open)dialog.showModal?.();}catch{dialog.setAttribute('open','');}dialog.querySelector('button')?.focus();}
      else if(!dialog.contains?.(focused))dialog.querySelector('button')?.focus();
      return true;
    },
    close(){if(!open||disposed||current?.status==='rolling'||waitingKind==='search-roll')return;suppressed={id:current.id,until:now()+1500};hide();try{sendAction('search-close');}catch{}},
    destroy(){if(disposed)return;hide();disposed=true;dialog.remove();style.remove();}
  };return api;
}
