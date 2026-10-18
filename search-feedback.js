import {curseDescription} from './cursed-equipment.js?v=096375a8b41b569f9c1ed4904ee997628eeda887';
/** Shared wording for local and host-authoritative search rolls. */
export function searchFeedback({roll,total=roll,dc,success,fainted=false}){
 if(fainted)return `EXHAUSTED — you fainted. Contents remain sealed.`;
 const natural=roll===20?'NATURAL 20 · ':roll===1?'NATURAL 1 · ':'';
 const difference=total-dc;
 const margin=difference===0?'Met the target exactly':difference>0?`${difference} above the target`:`${-difference} below the target`;
 const modifier=total!==roll?` (${roll} ${total-roll>=0?'+':'−'} ${Math.abs(total-roll)})`:'';
 return `${natural}${total}${modifier} ${difference>=0?'≥':'<'} ${dc} · ${success?'SUCCESS — contents revealed':'FAILED — contents remain hidden'}. ${margin}${roll===20?' — critical success':roll===1?' — critical failure':''}.`;
}

export function lootDetails(item){
 if(item.kind==='gold')return 'Currency';
 const labels={hp:'Max HP',armor:'Armor',melee:'Melee',magic:'Magic',stamina:'Stamina'};
 const details=['rarity','theme','slot'].map(k=>item[k]).filter(v=>typeof v==='string'&&v.length<=40);
 for(const [key,label]of Object.entries(labels)){const value=item.stats?.[key];if(Number.isFinite(value)&&value!==0&&Math.abs(value)<=10000)details.push(`${label} ${value>0?'+':''}${value}`);}
 const curse=curseDescription(item);if(curse)details.push(curse);return details.join(' · ');
}

export const searchRollStyles=`
 .search-roll-comparison{display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start;margin:16px 0}
 .search-roll-card{text-align:center;min-width:0}
 .search-roll-label{margin:0 0 8px;color:#b7b2a4;font:11px monospace;letter-spacing:1px}
 #containerSearch .search-roll-comparison .die,.hollow-remote-search .search-roll-comparison .rs-die,.search-target-value{box-sizing:border-box;font:bold 54px/96px monospace;height:100px;width:112px;max-width:100%;margin:0 auto;color:#d8ba7c}
 .search-target-value{border:3px double #817558;background:#10151c;text-align:center}
 .search-target-value strong{font:inherit}
 .search-roll-card small{display:block;min-height:18px;margin-top:7px;color:#b7b2a4;font:11px monospace}
 .search-roll-cost{text-align:center;color:#a9b0af;font-size:11px;margin:8px 0 12px}

 #containerSearch .die,.hollow-remote-search .rs-die{background-image:conic-gradient(from 30deg at 50% 50%,#343b49 0deg 60deg,#242a35 60deg 120deg,#151d29 120deg 180deg,#202938 180deg 240deg,#3c4350 240deg 300deg,#2a3342 300deg 360deg);text-shadow:2px 2px #10151e}
 .search-progress{height:5px;margin:10px 0;background:#080b10;border:1px solid #51493b;overflow:hidden}
 .search-progress span{display:block;width:100%;height:100%;background:#baa071;transform-origin:left;animation:search-progress 1.1s linear both}
 .search-contents-title{padding-top:12px;border-top:2px solid #76654b;color:#d8ba7c;letter-spacing:2px;font-size:13px}
 .search-item-details{display:block;margin:6px 0;color:#9faeae;font-size:11px;line-height:1.5}
 .search-settled{animation:search-impact .28s ease-out}
 @keyframes search-progress{from{transform:scaleX(0)}to{transform:scaleX(1)}}
 @keyframes search-impact{0%{transform:scale(1.25);filter:brightness(1.7)}100%{transform:scale(1);filter:brightness(1)}}
 @media(prefers-reduced-motion:reduce){.search-settled,.rolling,.rs-rolling{animation:none!important}}
`;

/** Shared balanced comparison: die on the left, target on the right. */
export function appendSearchComparison(document,parent,{dc,roll,dieClass='die',settled=false,cost=8}){
 const make=(tag,text,host)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;host.append(n);return n;};
 const row=make('div',undefined,parent);row.className='search-roll-comparison';
 const left=make('section',undefined,row);left.className='search-roll-card';make('p','YOUR D20',left).className='search-roll-label';const die=make('div',roll===undefined?'?':String(roll),left);die.className=dieClass+(settled?' search-settled':'');die.setAttribute('aria-label','D20 roll');
 const right=make('section',undefined,row);right.className='search-roll-card';make('p','TARGET',right).className='search-roll-label';const target=make('div',undefined,right);target.className='search-target-value';make('strong',String(dc),target);make('small','or higher',right);
 make('p','D20 search · '+cost+' stamina',parent).className='search-roll-cost';return die;
}
