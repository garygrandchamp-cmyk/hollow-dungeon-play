import {stainWeaponPixels} from './combat-blood.js?v=b7b8538579c745f26bca5629102f407c3b7f1f39';
// Native pixel-art parts composer. No Canvas, DOM, assets, or network requests.
const TAU = Math.PI * 2;
const FAMILIES = {
  sword: ['arming', 'falchion', 'needle', 'cleaver', 'flamberge', 'sabre', 'crusader', 'broken', 'estoc', 'zweihander'],
  axe: ['bearded', 'crescent', 'double', 'executioner', 'pick', 'war', 'hook', 'halberd', 'labrys', 'boarding'],
  bow: ['short', 'long', 'recurve', 'horn', 'war', 'elven', 'bone', 'composite'],
  staff: ['orb', 'crystal', 'crescent', 'fork', 'skull', 'sun', 'cage', 'thorn'],
  mace: ['flanged', 'morningstar', 'hammer', 'crown', 'knob', 'cross', 'spiked', 'scepter', 'lantern', 'pear'],
  shield: ['round', 'kite', 'heater', 'tower', 'buckler', 'scalloped', 'pavise', 'diamond'],
  hammer: ['warhammer', 'maul', 'cross-peen', 'ball-peen', 'rune-block', 'claw', 'sledge', 'bell', 'spike-face', 'stone-mallet'],
};
const BASES = {
  sword: ['cross', 'swept', 'basket', 'winged', 'ring', 'forked', 'disk', 'serpent', 'knuckle', 'thorn'], axe: ['short-haft', 'long-haft', 'banded', 'spiked-butt', 'wrapped-haft', 'forked-haft', 'iron-haft', 'bone-haft', 'ring-butt', 'crooked-haft'],
  bow: ['leather', 'corded', 'bone-grip', 'gold-grip'], staff: ['oak', 'twisted', 'iron-bound', 'bone'],
  mace: ['leather', 'chain-grip', 'long-grip', 'spiked-pommel', 'corded', 'knotted', 'iron-shaft', 'bone-haft', 'ring-pommel', 'rune-grip'], shield: ['iron-rim', 'bronze-rim', 'riveted', 'spiked-rim'],
  hammer: ['leather', 'chain-grip', 'long-grip', 'spiked-pommel', 'corded', 'knotted', 'iron-shaft', 'bone-haft', 'ring-pommel', 'rune-grip'],
};
export const WEAPON_THEMES = Object.freeze(['steel', 'ice', 'fire', 'poison', 'arcane']);
export const WEAPON_CATALOG = Object.freeze(Object.fromEntries(Object.keys(FAMILIES).map(kind => [kind, Object.freeze({ blades: Object.freeze([...FAMILIES[kind]]), bases: Object.freeze([...BASES[kind]]) })])));
export const CLASS_WEAPON_DEFAULTS = Object.freeze({
  Mage: {kind:'staff',blade:'crystal',base:'oak',theme:'ice'}, Paladin: {kind:'sword',blade:'crusader',base:'cross',theme:'steel'},
  Barbarian: {kind:'axe',blade:'double',base:'banded',theme:'fire'}, Warlock: {kind:'staff',blade:'skull',base:'bone',theme:'arcane'},
  Thief: {kind:'sword',blade:'needle',base:'swept',theme:'poison'}, Archer: {kind:'bow',blade:'recurve',base:'leather',theme:'steel'},
});
const ramps = {
  steel: [[54,59,65],[96,105,110],[148,157,151]], ice:[[32,74,100],[78,154,181],[174,228,228]],
  fire:[[94,43,32],[175,77,32],[248,180,67]], poison:[[42,66,31],[87,132,42],[176,204,88]], arcane:[[60,39,87],[114,72,151],[211,163,228]],
};
const rgbHex = c => '#' + c.map(v => v.toString(16).padStart(2,'0')).join('');
function customColor(value) {
  if (Array.isArray(value) && value.length >= 3 && value.slice(0,3).every(Number.isFinite)) return value.slice(0,3).map(v=>Math.max(0,Math.min(255,Math.round(v))));
  if (typeof value === 'string' && /^#[a-f\d]{6}$/i.test(value)) return [1,3,5].map(i=>parseInt(value.slice(i,i+2),16));
  return null;
}
function seedHash(value) { let h=2166136261;for(const c of String(value))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0; }

/** blade means blade/head/limbs/focus/body depending on family. base means grip,
 * guard, haft, or rim. Sword/axe/mace/hammer have10x10 parts; other families8x4.
 */
export function generateWeapon(options = {}) {
  const kind=Object.hasOwn(FAMILIES,options.kind)?options.kind:'sword';
  const seed=String(options.seed??0),hash=seedHash(seed);
  const choose=(list,value,offset)=>{const index=typeof value==='number'&&Number.isFinite(value)?Math.abs(Math.floor(value))%list.length:list.indexOf(value);return index>=0?index:(hash>>>offset)%list.length;};
  const head=choose(FAMILIES[kind],options.blade??options.parts?.blade,0),base=choose(BASES[kind],options.base??options.parts?.base,8);
  const theme=WEAPON_THEMES.includes(options.theme)?options.theme:'steel';
  const shieldView=options.shieldView==='firstPerson'?'firstPerson':'inventory';
  const size=[64,96,128].includes(options.size)?options.size:96;
  const ramp=ramps[theme].map(c=>[...c]),custom=customColor(options.color);
  if(custom){ramp[1]=custom;ramp[0]=custom.map(c=>Math.round(c*.52));ramp[2]=custom.map(c=>Math.round(c+(255-c)*.65));}
  const C={ink:[28,28,32],shadow:ramp[0],metal:ramp[1],light:ramp[2],wood:[91,67,46],leather:[58,43,36],gold:[132,109,68],bone:[151,144,119],string:[132,128,109],deep:[30,29,33]};
  const pixels=new Uint8Array(96*96*4);
  const dot=(x,y,color)=>{x=Math.round(x);y=Math.round(y);if(x<0||x>=96||y<0||y>=96)return;pixels.set([...color,255],(y*96+x)*4);};
  function rect(x,y,w,h,color){for(let yy=Math.ceil(y);yy<y+h;yy++)for(let xx=Math.ceil(x);xx<x+w;xx++)dot(xx,yy,color);}
  function line(x0,y0,x1,y1,color,width=1){const steps=Math.max(Math.abs(x1-x0),Math.abs(y1-y0),1);for(let i=0;i<=steps;i++){const x=x0+(x1-x0)*i/steps,y=y0+(y1-y0)*i/steps;rect(Math.round(x-width/2),Math.round(y-width/2),width,width,color);}}
  function poly(points,color){const low=Math.max(0,Math.floor(Math.min(...points.map(p=>p[1])))),high=Math.min(95,Math.ceil(Math.max(...points.map(p=>p[1]))));for(let y=low;y<=high;y++){const cuts=[];for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>y)!==(b[1]>y))cuts.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));}cuts.sort((a,b)=>a-b);for(let i=0;i+1<cuts.length;i+=2)for(let x=Math.ceil(cuts[i]);x<=Math.floor(cuts[i+1]);x++)dot(x,y,color);}}
  function disk(cx,cy,rx,ry,color){for(let y=-Math.ceil(ry);y<=ry;y++)for(let x=-Math.ceil(rx);x<=rx;x++)if(x*x/(rx*rx)+y*y/(ry*ry)<=1)dot(cx+x,cy+y,color);}
  function metalShape(points){poly(points,C.ink);const cx=points.reduce((s,p)=>s+p[0],0)/points.length,cy=points.reduce((s,p)=>s+p[1],0)/points.length;poly(points.map(([x,y])=>[cx+(x-cx)*.86,cy+(y-cy)*.94]),C.shadow);for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];if((a[0]+b[0])/2<=cx)line(a[0]+1,a[1]+1,b[0]+1,b[1]+1,C.light); }line(cx-1,Math.min(...points.map(p=>p[1]))+4,cx-1,Math.max(...points.map(p=>p[1]))-3,C.metal,2);}
  function handle(top=42,bottom=83){if(base>=4){extendedHandle(top,bottom);return;}const shift=base===1?2:0;line(48,top,48+shift,bottom,C.ink,8);line(47,top+1,47+shift,bottom-1,base===3?C.bone:C.wood,5);for(let y=top+3;y<bottom;y+=base===2?4:7){line(45,y,51,y-1,base===2?C.metal:C.leather,2);dot(45,y-1,C.gold);}disk(48+shift,bottom,5,4,C.ink);disk(47+shift,bottom-1,3,2,base===3?C.metal:C.gold);}
  function extendedHandle(top,bottom){
    const end=base===8?bottom-5:bottom,mid=(top+end)/2,crooked=kind==='axe'&&base===9;
    const points=crooked?[[48,top],[44,mid-5],[50,end]]:[[48,top],[48,end]];
    for(let i=1;i<points.length;i++){line(...points[i-1],...points[i],C.ink,9);line(points[i-1][0]-1,points[i-1][1],points[i][0]-1,points[i][1],base===6?C.shadow:base===7?C.bone:C.wood,5);}
    if(base===4){for(let y=top+3;y<end-1;y+=3){line(44,y,51,y+2,C.leather,2);dot(45,y,C.gold);}rect(44,end-2,8,5,C.shadow);line(45,end+1,50,end+1,C.light);}
    if(base===5){for(const y of [top+7,mid,end-5]){disk(48,y,5,3,C.ink);disk(47,y-1,3,2,C.wood);}if(kind==='axe'){line(48,top+13,41,top,C.ink,4);line(47,top+12,41,top+1,C.wood,2);}disk(48,end,5,4,C.ink);disk(47,end-1,3,2,C.bone);}
    if(base===6){line(46,top+2,46,end-3,C.light);for(let y=top+5;y<end-2;y+=8){rect(43,y,10,3,C.ink);rect(44,y,8,2,C.metal);}metalShape([[43,end-2],[53,end-2],[55,end+3],[48,end+7],[41,end+3]]);}
    if(base===7){for(let y=top+5;y<end;y+=9){disk(48,y,5,3,C.ink);disk(47,y-1,4,2,C.bone);line(45,y-1,50,y,C.shadow);}metalShape([[43,end-2],[42,end+4],[46,end+2],[48,end+7],[51,end+2],[55,end+4],[53,end-2]]);}
    if(base===8){for(let y=top+3;y<end-2;y+=6)line(44,y,51,y-1,C.leather,2);for(let i=1;i<=16;i++){const a=(i-1)*TAU/16,b=i*TAU/16;line(48+Math.cos(a)*6,bottom+1+Math.sin(a)*6,48+Math.cos(b)*6,bottom+1+Math.sin(b)*6,C.ink,3);line(48+Math.cos(a)*5,bottom+1+Math.sin(a)*5,48+Math.cos(b)*5,bottom+1+Math.sin(b)*5,C.metal);}}
    if(base===9){for(let y=top+5;y<end-2;y+=7){if(kind==='axe'){line(44,y,51,y-2,C.leather,2);}else{rect(44,y-2,8,5,C.shadow);line(46,y-1,49,y+1,C.light);line(49,y-1,46,y+1,C.metal);}}metalShape([[42,end-1],[44,end+5],[48,end+1],[52,end+7],[54,end-1]]);}
  }
  if(kind==='sword'){
    handle(61,83);const w=[5,9,3,12,7,6,7,8,4,9][head];
    const right=head===1?[[48+w,25],[49+w,44],[52,60]]:head===5?[[56,12],[57,30],[52,60]]:head===7?[[52,33],[48,35],[52,39],[48+w,44],[51,60]]:head===4?[[53,20],[50,28],[54,36],[50,44],[52,60]]:head===8?[[52,15],[50,60]]:head===9?[[57,20],[55,40],[52,60]]:[[48+w,18],[51,60]];
    metalShape([[45,60],[48-w,20],[head===7?49:48,head===7?30:head>=8?4:8],...right]);
    if(head===6){rect(46,18,3,32,C.shadow);line(47,20,47,44,C.gold);}
    const guards=[[[33,62],[34,57],[45,60],[51,60],[62,57],[63,62]],[[32,59],[36,57],[43,61],[53,62],[62,67],[61,70],[51,65]],[[36,58],[42,57],[56,61],[57,72],[52,76],[51,72],[53,69],[52,65],[42,62]],[[30,57],[38,59],[42,55],[46,60],[50,60],[55,55],[58,59],[66,57],[61,64],[35,64]]];
    guards.push([[34,59],[37,55],[43,55],[46,59],[52,59],[55,55],[61,55],[64,59],[61,64],[35,64]],[[33,55],[38,57],[41,60],[45,60],[48,55],[51,60],[55,60],[58,57],[63,55],[60,64],[36,64]],[[35,59],[61,59],[64,61],[61,64],[35,64],[32,61]],[[31,56],[37,53],[42,58],[46,61],[53,61],[57,57],[63,56],[65,60],[59,64],[37,65]],[[34,58],[43,57],[55,60],[61,66],[60,76],[54,80],[51,77],[56,74],[57,67],[52,64],[34,63]],[[29,58],[38,60],[40,53],[45,60],[51,60],[56,53],[58,60],[67,58],[60,66],[54,63],[37,66]]);
    metalShape(guards[base]);if(base===4){for(const side of [-1,1]){line(48+side*9,58,48+side*13,66,C.gold,2);line(48+side*13,66,48+side*5,69,C.gold,2);}}if(base===6){disk(48,62,12,4,C.shadow);line(37,61,58,61,C.light);}if(head===9)metalShape([[37,50],[44,52],[48,49],[52,52],[59,50],[54,56],[42,56]]);disk(48,62,3,3,C.gold);
  }else if(kind==='axe'){
    handle(base===0?33:26,84);const cy=head===7?29:34;
    const outline=[[[48,26],[29,20],[22,27],[21,43],[30,49],[44,43],[48,43]],[[48,27],[35,19],[22,20],[28,28],[25,38],[18,43],[30,48],[48,41]],[[48,27],[26,18],[20,22],[23,43],[29,49],[48,42],[67,49],[73,43],[76,22],[70,18]],[[48,24],[26,20],[17,25],[17,48],[28,54],[45,44]],[[48,27],[25,27],[18,35],[41,34],[47,43],[66,31],[75,27],[62,25]],[[48,24],[31,23],[24,30],[25,43],[36,46],[48,40]],[[48,25],[29,21],[20,31],[25,47],[34,50],[31,38],[46,38]],[[48,10],[54,26],[50,39],[29,42],[19,33],[23,20],[31,29],[44,27]],[[48,24],[34,17],[22,17],[17,25],[20,43],[31,51],[48,43],[65,51],[76,43],[79,25],[74,17],[62,17]],[[47,23],[34,18],[23,21],[19,32],[25,41],[34,40],[31,32],[45,34],[54,28],[72,24],[67,18],[55,20]]][head];
    metalShape(outline);rect(44,cy-5,9,15,C.shadow);line(45,cy-4,45,cy+7,C.light,2);if(base===3)metalShape([[44,81],[48,91],[53,81]]);
  }else if(kind==='bow'){
    const spread=[17,23,25,20,29,22,19,26][head],top=[17,8,10,13,6,9,16,11][head];
    const points=[[50,top],[42,top+8],[48-spread,31],[25,47],[48-spread,64],[42,88-top/2],[50,91-top/2]];
    if(head===2||head===5){points[0][0]=58;points[points.length-1][0]=58;}
    for(let i=1;i<points.length;i++){line(...points[i-1],...points[i],C.ink,7);line(points[i-1][0]-1,points[i-1][1],points[i][0]-1,points[i][1],head===6?C.bone:C.wood,4);}
    line(...points[0],61,47,C.string);line(61,47,...points[points.length-1],C.string);
    line(25,40,25,56,C.ink,8);line(24,41,24,55,base===3?C.gold:base===2?C.bone:C.leather,5);
    for(let y=42;y<56;y+=base===1?2:4)line(22,y,27,y-1,C.shadow);
    line(20,47,74,47,C.wood,2);metalShape([[74,43],[83,47],[74,51]]);poly([[26,45],[20,40],[20,46],[25,48]],C.bone);
    if(head===3||head===7)for(const y of [25,69])metalShape([[33,y],[39,y-4],[38,y+4],[31,y+5]]);
  }else if(kind==='staff'){
    handle(31,85);
    if(head===0){disk(48,23,12,12,C.ink);disk(48,22,9,9,C.metal);disk(45,19,3,3,C.light);}
    if(head===1)metalShape([[48,7],[58,20],[53,36],[44,36],[39,20]]);
    if(head===2){poly([[55,9],[43,12],[36,23],[41,35],[54,38],[48,32],[43,24],[48,16]],C.ink);poly([[52,12],[43,15],[39,23],[43,32],[49,34],[43,25],[45,18]],C.metal);}
    if(head===3){metalShape([[33,13],[39,13],[43,27],[46,10],[50,10],[53,27],[57,13],[63,13],[59,33],[50,39],[44,38],[37,31]]);}
    if(head===4){disk(48,22,12,12,C.ink);disk(48,20,10,9,C.bone);rect(42,27,12,6,C.bone);disk(43,21,3,3,C.deep);disk(53,21,3,3,C.deep);poly([[48,23],[45,27],[50,27]],C.deep);for(let x=43;x<=53;x+=3)line(x,29,x,32,C.shadow);}
    if(head===5){for(let i=0;i<8;i++){const a=i*Math.PI/4;line(48+Math.cos(a)*7,23+Math.sin(a)*7,48+Math.cos(a)*16,23+Math.sin(a)*16,C.gold,3);}disk(48,23,10,10,C.ink);disk(48,23,7,7,C.metal);disk(46,21,3,3,C.light);}
    if(head===6){disk(48,23,9,12,C.ink);disk(48,22,5,7,C.metal);for(const x of[38,48,58])line(x,14,x,32,C.gold,2);line(38,14,58,14,C.gold,2);line(38,32,58,32,C.gold,2);}
    if(head===7){for(const s of[-1,1]){metalShape([[48,36],[48+s*7,26],[48+s*10,10],[48+s*15,8],[48+s*13,28],[48+s*5,40]]);}disk(48,26,4,5,C.metal);}
    rect(43,36,11,4,C.gold);
  }else if(kind==='hammer'){
    handle(36,84);
    const heads=[
      [[31,18],[53,18],[57,23],[72,24],[69,29],[56,32],[52,38],[31,38],[28,33],[28,23]],
      [[26,14],[68,14],[72,19],[72,35],[67,40],[26,40],[22,35],[22,19]],
      [[30,15],[49,15],[52,22],[64,23],[73,27],[64,31],[52,32],[49,40],[30,40],[27,35],[27,20]],
      [[44,18],[68,18],[71,23],[71,34],[67,38],[44,38],[39,34],[39,22]],
      [[29,11],[64,11],[68,16],[68,38],[63,43],[29,43],[25,38],[25,16]],
      [[25,17],[46,17],[50,22],[61,19],[72,12],[69,23],[61,29],[71,31],[67,37],[56,34],[48,33],[45,39],[25,39]],
      [[23,18],[73,18],[76,23],[76,32],[72,37],[23,37],[19,32],[19,23]],
      [[26,16],[37,11],[45,17],[57,19],[65,15],[70,21],[67,36],[57,39],[45,34],[35,40],[24,35]],
      [[24,16],[55,16],[59,21],[68,24],[68,32],[58,35],[55,40],[24,40],[17,36],[23,33],[17,28],[23,23],[17,19]],
      [[25,13],[37,10],[65,14],[72,22],[69,37],[61,43],[29,40],[22,31]],
    ];
    metalShape(heads[head]);
    if(head===3){disk(31,28,13,13,C.ink);disk(30,27,10,10,C.shadow);disk(27,24,4,5,C.metal);line(24,20,29,17,C.light,2);}
    if(head===4){rect(35,18,20,18,C.metal);line(38,20,49,31,C.light,2);line(49,20,38,31,C.shadow,2);line(43,18,43,36,C.gold);}
    if(head===6){rect(22,21,7,13,C.metal);line(24,21,24,33,C.light,2);rect(66,21,7,13,C.shadow);}
    if(head===7){for(const x of [29,34,61,66])line(x,21,x,34,C.gold);}
    if(head===8){for(const y of [21,28,35])line(22,y,30,y,C.light);}
    if(head===9){line(38,15,44,25,C.deep,2);line(44,25,39,35,C.deep);line(44,25,54,31,C.deep);for(const [x,y]of [[29,22],[59,19],[64,33],[32,36]])dot(x,y,C.light);}
    rect(44,36,9,5,C.shadow);line(45,36,45,40,C.light);
  }else if(kind==='mace'){
    handle(36,84);const cy=28;
    if(head===8){metalShape([[35,14],[42,10],[54,10],[61,14],[61,19],[35,19]]);metalShape([[35,35],[61,35],[58,41],[38,41]]);for(const x of [35,42,53,60])metalShape([[x,17],[x+2,17],[x+2,36],[x,36]]);line(37,24,59,24,C.gold);}
    else if(head===9){disk(48,25,15,20,C.ink);disk(47,25,12,17,C.shadow);disk(44,23,5,9,C.metal);line(44,9,44,34,C.light);metalShape([[42,39],[54,39],[51,45],[45,45]]);}
    else if(head===2){metalShape([[28,17],[65,17],[68,25],[66,36],[27,37],[24,30]]);line(31,19,31,34,C.light,2);}
    else {if([1,3,6].includes(head))for(let i=0;i<(head===6?10:8);i++){const a=i*TAU/(head===6?10:8);metalShape([[48+Math.cos(a-.25)*12,cy+Math.sin(a-.25)*12],[48+Math.cos(a)*23,cy+Math.sin(a)*23],[48+Math.cos(a+.25)*12,cy+Math.sin(a+.25)*12]]);}disk(48,cy,head===4?14:12,head===7?18:13,C.ink);disk(47,cy-1,head===4?11:9,head===7?15:10,C.shadow);disk(44,cy-4,4,6,C.metal);if(head===0||head===5){for(const x of[38,45,52,59])metalShape([[x,16],[x+3,13],[x+5,35],[x+1,39]]);}if(head===3)metalShape([[36,17],[37,8],[45,15],[48,5],[52,15],[60,8],[60,20]]);if(head===7)rect(38,18,20,3,C.gold);}
    if(head===5)metalShape([[28,22],[42,22],[42,11],[54,11],[54,22],[68,22],[68,33],[54,33],[54,42],[42,42],[42,33],[28,33]]);
  }else{
    const outlines=[Array.from({length:16},(_,i)=>[48+Math.cos(i*TAU/16)*26,44+Math.sin(i*TAU/16)*29]),[[27,17],[48,10],[69,17],[65,52],[48,83],[31,52]],[[24,16],[72,16],[68,52],[48,78],[28,52]],[[25,10],[71,10],[73,73],[48,82],[23,73]],Array.from({length:12},(_,i)=>[48+Math.cos(i*TAU/12)*22,45+Math.sin(i*TAU/12)*22]),[[28,15],[39,20],[48,10],[57,20],[68,15],[73,40],[67,62],[48,80],[29,62],[23,40]],[[25,12],[71,12],[69,82],[27,82]],[[48,9],[76,43],[48,84],[20,43]]];
    const outline=outlines[head];
    if(shieldView==='firstPerson'){
      // The left forearm sits behind the shield; only its cuff exits the rim.
      line(33,87,47,56,C.ink,13);line(33,86,47,56,C.leather,9);line(33,84,39,70,C.shadow,7);line(31,82,36,70,C.metal,2);
    }
    poly(outline,C.ink);const cy=head===4?45:44;
    poly(outline.map(([x,y])=>[48+(x-48)*.9,cy+(y-cy)*.93]),base===1?C.gold:C.metal);
    poly(outline.map(([x,y])=>[48+(x-48)*.73,cy+(y-cy)*.78]),C.leather);
    line(34,23,34,65,C.wood,3);line(43,20,43,70,C.wood,3);line(53,20,53,70,C.wood,3);line(62,23,62,65,C.wood,3);
    if(base>=2)for(let i=0;i<outline.length;i++){const [x,y]=outline[i];disk(48+(x-48)*.84,cy+(y-cy)*.87,base===3?2:1.2,base===3?3:1.2,C.light);}
    if(shieldView==='firstPerson'){
      // Interior straps and central handgrip. No boss, insignia or face spikes.
      for(const y of[31,59]){line(31,y,64,y+2,C.ink,6);line(32,y,63,y+2,C.leather,4);for(const x of[33,62])rect(x,y-1,2,3,C.gold);}
      line(45,37,45,55,C.ink,7);line(45,38,45,54,C.wood,3);
      poly([[39,49],[42,43],[49,42],[53,46],[51,54],[46,59],[40,56]],C.ink);
      poly([[41,49],[44,45],[49,45],[51,48],[48,55],[44,57],[41,54]],C.leather);
      for(let i=0;i<3;i++)line(44+i*2,46,43+i*2,51,C.metal);
      if(base===1)rect(59,40,3,10,C.gold);
      if(base===3){line(29,21,35,19,C.shadow,3);line(65,22,68,27,C.shadow,3);}
    }else{
      disk(48,44,10,10,C.ink);disk(47,43,7,7,C.shadow);disk(45,41,3,3,C.light);
      if(base===3)metalShape([[44,44],[48,30],[53,44],[48,49]]);
    }
  }
  // Elemental geometry is painted around the head/body, not just tint applied.
  if(theme!=='steel'){
    const cy=kind==='shield'?35:kind==='bow'?26:kind==='sword'?24:23;
    for(let i=0;i<5;i++){
      const side=i%2?-1:1,x=48+side*(kind==='shield'?22:kind==='bow'?18:11)+(hash>>>(i*3)&3),y=cy+i*5-9;
      if(theme==='ice'){poly([[x,y-9],[x-3,y],[x,y+4],[x+3,y]],C.shadow);line(x,y-7,x,y+2,C.light);dot(x-1,y,C.metal);}
      if(theme==='fire'){poly([[x-4,y+8],[x-5,y+2],[x-2,y-3],[x+1,y-10],[x+3,y-2],[x+5,y+5],[x+2,y+9]],C.shadow);poly([[x-2,y+6],[x,y-4],[x+3,y+6]],C.metal);line(x,y+5,x,y+1,C.light,2);}
      if(theme==='poison'){line(x,y,x,y+8+(i%3)*2,C.metal,2);disk(x,y+10+(i%3)*2,2,3,C.shadow);dot(x-1,y+9+(i%3)*2,C.light);}
      if(theme==='arcane'){const yy=y-2;line(x-3,yy,x+3,yy,C.metal);line(x,yy-3,x,yy+3,C.light);dot(x+1,yy+1,C.shadow);}
    }
  }
  // Seeded scars and grip wear provide variation without erasing silhouettes.
  for(let i=0;i<14;i++){const n=seedHash(seed+':'+i),x=38+n%21,y=16+(n>>>8)%52,offset=(y*96+x)*4;if(pixels[offset+3]&&pixels[offset]>40)dot(x,y,i%3===0?C.light:C.shadow);}
  // Brushed/hammered pigment and tarnish, in small painterly pixel clusters.
  // Keep masks exact: weathering changes surface values rather than adding a
  // thick black contour or unrelated silhouette noise.
  const matches=(i,c)=>pixels[i]===c[0]&&pixels[i+1]===c[1]&&pixels[i+2]===c[2];
  for(let y=1;y<95;y++)for(let x=1;x<95;x++){
    const i=(y*96+x)*4;if(!pixels[i+3])continue;
    const metal=matches(i,C.shadow)||matches(i,C.metal)||matches(i,C.light);
    const wood=matches(i,C.wood)||matches(i,C.leather),edge=matches(i,C.ink);
    const grain=seedHash(`${seed}:${x>>1}:${y>>1}`),fine=seedHash(`${seed}:${x}:${y}:wear`);
    const variation=((grain>>>4)%7-3)+((fine>>>5)%5-2);
    if(metal||wood){
      const shadow=metal&&grain%29===0?-9:0;
      for(let c=0;c<3;c++)pixels[i+c]=Math.max(16,Math.min(248,pixels[i+c]+variation+shadow));
      if(metal&&theme==='steel'&&fine%101===0){pixels[i]=76+(grain%8);pixels[i+1]=61+(grain%7);pixels[i+2]=48+(grain%5);}
    }else if(edge){
      const exposed=!pixels[i-4+3]||!pixels[i+4+3]||!pixels[i-96*4+3]||!pixels[i+96*4+3];
      if(exposed)for(let c=0;c<3;c++)pixels[i+c]=Math.max(24,Math.min(45,C.ink[c]+6+variation));
    }
  }
  let output=pixels;
  if(size!==96){output=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(Math.floor(y*96/size)*96+Math.floor(x*96/size))*4;output.set(pixels.subarray(i,i+4),(y*size+x)*4);}}
  const parts={blade:FAMILIES[kind][head],base:BASES[kind][base]},id=`${kind}-${parts.blade}-${parts.base}-${theme}-${seedHash(seed+JSON.stringify(custom)+shieldView).toString(36)}`;
  const names={sword:'Sword',axe:'Axe',bow:'Bow',staff:'Staff',mace:'Mace',shield:'Shield',hammer:'Hammer'};
  const stats={damage:kind==='shield'?2:kind==='bow'?9:kind==='staff'?11:kind==='axe'?15:kind==='mace'?13:kind==='hammer'?16:10,speed:Number((1.1-(kind==='axe'?.25:kind==='mace'?.18:kind==='hammer'?.28:0)+head*.015).toFixed(2)),reach:kind==='bow'?12:kind==='staff'?10:kind==='shield'?1:1.8,defense:kind==='shield'?12+head:base===2?2:1,element:theme==='steel'?'physical':theme};
  const grip=kind==='bow'?{x:25/96,y:48/96}:kind==='shield'?{x:45/96,y:49/96}:{x:.5,y:(kind==='sword'?73:67)/96};
  return {id,name:`${theme[0].toUpperCase()+theme.slice(1)} ${parts.blade} ${names[kind]}`,kind,seed,theme,color:custom?rgbHex(custom):undefined,shieldView,parts,anchors:{bottom:{x:.5,y:1},grip},palette:Object.fromEntries(Object.entries(C).map(([k,c])=>[k,rgbHex(c)])),width:size,height:size,pixels:output,stats,description:`${parts.blade} ${kind} with ${parts.base}; ${theme} finish${custom?' and custom pigment':''}${kind==='shield'?`; ${shieldView} view`:''}.`};
}

/** Camera-local by default when firstPerson=true; otherwise an upright billboard.
 * Art points upward. Anchor is bottom center; call animate with absolute seconds.
 */
export function makeWeaponSprite(THREE, recipe, { firstPerson = false, height = 0.8, shieldView } = {}) {
  if(!recipe?.pixels)recipe=generateWeapon(recipe??{});
  if(recipe.kind==='shield'){
    const view=shieldView??(firstPerson?'firstPerson':'inventory');
    if(view!==recipe.shieldView)recipe=generateWeapon({kind:'shield',seed:recipe.seed,theme:recipe.theme,color:recipe.color,...recipe.parts,size:recipe.width,shieldView:view});
  }
  height=Number.isFinite(height)?Math.max(.05,Math.min(5,height)):.8;
  const root=new THREE.Group();root.name=`forged-${recipe.kind}`;
  const data=new Uint8Array(recipe.pixels.length),stride=recipe.width*4;
  for(let y=0;y<recipe.height;y++)data.set(recipe.pixels.subarray(y*stride,(y+1)*stride),(recipe.height-1-y)*stride);
  const map=new THREE.DataTexture(data,recipe.width,recipe.height,THREE.RGBAFormat,THREE.UnsignedByteType);
  map.flipY=false;map.colorSpace=THREE.SRGBColorSpace;map.minFilter=map.magFilter=THREE.NearestFilter;map.generateMipmaps=false;map.needsUpdate=true;
  const material=new THREE.MeshBasicMaterial({map,alphaTest:.5,transparent:false,depthTest:!firstPerson,depthWrite:!firstPerson,fog:!firstPerson,side:THREE.DoubleSide,toneMapped:false});
  const geometry=new THREE.PlaneGeometry(height*recipe.width/recipe.height,height);geometry.translate(0,height/2,0);
  const pivot=new THREE.Group();root.add(pivot);const mesh=new THREE.Mesh(geometry,material);mesh.userData.ownGeometry=true;mesh.userData.dynamic=true;mesh.renderOrder=firstPerson?1000:0;pivot.add(mesh);
  const position=new THREE.Vector3(),target=new THREE.Vector3(),parentQ=new THREE.Quaternion(),facing=new THREE.Quaternion(),axis=new THREE.Vector3(0,1,0);
  mesh.onBeforeRender=(renderer,scene,camera)=>{if(firstPerson)return;root.getWorldPosition(position);camera.getWorldPosition(target);root.getWorldQuaternion(parentQ);facing.setFromAxisAngle(axis,Math.atan2(target.x-position.x,target.z-position.z));pivot.quaternion.copy(parentQ).invert().multiply(facing);pivot.updateMatrixWorld(true);};
  let stainKey='',currentStain=null,basePixels=new Uint8Array(recipe.pixels);
  function uploadArt(){const stained=stainWeaponPixels(basePixels,recipe.width,recipe.height,currentStain);for(let y=0;y<recipe.height;y++)data.set(stained.subarray(y*stride,(y+1)*stride),(recipe.height-1-y)*stride);map.needsUpdate=true;}
  root.userData.setStain=stain=>{if(disposed)return;const key=stain?stain.kind+':'+stain.level:'';if(key===stainKey)return;stainKey=key;currentStain=stain?{kind:stain.kind,level:stain.level}:null;uploadArt();};
  root.userData.setArtPixels=pixels=>{if(disposed||!(pixels instanceof Uint8Array)||pixels.length!==recipe.width*recipe.height*4)return false;basePixels=new Uint8Array(pixels);uploadArt();return true;};
  root.userData.weapon=recipe;root.userData.anchor='bottom-center';root.userData.firstPerson=firstPerson;
  root.userData.animate=({time=0,moving=false,attacking=false}={})=>{time=Number.isFinite(time)?time:0;const phase=typeof attacking==='number'&&Number.isFinite(attacking)?Math.max(0,Math.min(1,attacking)):((time%.65+.65)%.65)/.65;const swing=attacking?Math.sin(phase*Math.PI):0;mesh.rotation.z=-swing*.8;mesh.position.x=swing*.06;mesh.position.y=(moving?Math.abs(Math.sin(time*7))*.015:0)-swing*.025;};
  let disposed=false;root.userData.disposeMaterials=()=>{if(disposed)return;disposed=true;material.dispose();map.dispose();};
  return root;
}
