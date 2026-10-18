import {random} from './wfc.js?v=112c109deb93b220e4768f4656840e104866606b';

export const defaults=Object.freeze({height:2.4,thickness:.36,ruin:.18,weather:.3,opening:'none',width:1.1,openingHeight:1.7,sill:0,offset:0,style:'wood',growth:.15,history:'ancient',sightDamage:'none'});
const limits={height:[.6,5],thickness:[.15,.9],ruin:[0,1],weather:[0,1],width:[.6,1.8],openingHeight:[.6,3],sill:[0,2.5],offset:[-.25,.25],growth:[0,1]};
export function normalize(params={}){
 const v={...defaults,...params};
 for(const [key,[min,max]] of Object.entries(limits)){
  const raw=v[key],n=(typeof raw==='number'||typeof raw==='string'&&raw.trim()!=='')?Number(raw):NaN;
  const lower=key==='width'&&v.sightDamage==='slit'?.12:min,upper=key==='width'&&v.sightDamage==='slit'?.17:max;
  v[key]=Math.max(lower,Math.min(upper,Number.isFinite(n)?n:defaults[key]));
 }
 for(const [key,values] of Object.entries({opening:['none','square','arch','gothic'],style:['wood','bars','double','empty'],history:['ancient','fire','flood'],sightDamage:['none','slit','viewhole']}))if(!values.includes(v[key]))v[key]=defaults[key];
 return v;
}
export function breached(params={}){return normalize(params).ruin>=.82;}
function ceiling(p,x){
 const u=(x-p.offset)/(p.width*.5);
 if(p.opening==='gothic'){
  // Two circular arcs centered at opposite spring points meet with distinct
  // slopes at the apex. This creates a cusp instead of a rounded crown.
  const rise=Math.min(p.openingHeight,p.width*Math.sqrt(3)/2);
  const profile=Math.sqrt(Math.max(0,4-(1+Math.abs(u))**2))/Math.sqrt(3);
  return p.sill+p.openingHeight-rise*(1-profile);
 }
 return p.sill+p.openingHeight-(p.opening==='arch'?(1-Math.sqrt(Math.max(0,1-u*u)))*p.width*.35:0);
}
export function traversable(params={}){
 const p=normalize(params);
 // Test headroom across a person's full width, including the lower sides of an arch.
 return breached(p)||(p.opening!=='none'&&p.sill<=.15&&p.width>=.65&&ceiling(p,p.offset+.325)>=1.2);
}

// Subtract an opening from a stone, preserving the jamb, sill and lintel fragments.
function carve(brick,p){
 if(p.opening==='none')return [brick];
 const left=brick.x-brick.w/2,right=brick.x+brick.w/2,bottom=brick.y-brick.h/2,top=brick.y+brick.h/2;
 const a=Math.max(left,p.offset-p.width/2),b=Math.min(right,p.offset+p.width/2);
 if(a>=b||top<=p.sill)return [brick];
 const result=[];
 const part=(l,r,lo,hi)=>{if(r-l>1e-8&&hi-lo>1e-8)result.push({...brick,x:(l+r)/2,y:(lo+hi)/2,w:r-l,h:hi-lo});};
 part(left,a,bottom,top);part(b,right,bottom,top);
 part(a,b,bottom,Math.min(top,p.sill));
 // Narrow strips make a stepped arch. Use the highest point in each strip so no
 // stone projects into the advertised clearance envelope.
 const count=p.opening==='arch'||p.opening==='gothic'?Math.ceil((b-a)/.075):1;
 for(let i=0;i<count;i++){
  const l=a+(b-a)*i/count,r=a+(b-a)*(i+1)/count,x=Math.max(l,Math.min(r,p.offset));
  part(l,r,Math.max(bottom,p.sill,ceiling(p,x)),top);
 }
 return result;
}
export function wallRecipe(params,seed){
 const p=normalize(params),rng=random(seed),bricks=[],rubble=[],rows=Math.ceil(p.height/.30);
 for(let r=0;r<rows;r++)for(let c=0;c<(r%2?5:4);c++){
  // Always consume the same draws per original stone, regardless of damage or
  // opening. Moving the ruin slider cannot recolor, move or resurrect survivors.
  const [noise,rotation,depth,tone,moss,debris,scatter,spin]=Array.from({length:8},()=>rng());
  // Half-bond courses alternate full stones with clipped endpoint half-stones.
  const center=(r%2?-1.2:-.9)+c*.6;
  const left=Math.max(-1.2,center-.575/2),right=Math.min(1.2,center+.575/2);
  const x=(left+right)/2,y=(r+.5)*p.height/rows,h=p.height/rows-.025,w=right-left;
  const endpoint=left===-1.2||right===1.2;
  const tilt=p.opening!=='none'||endpoint?0:(rotation-.5)*p.weather*.12;
  const threshold=Math.max(y-h/2<1.2?.82:0,.22+.6*(1-r/rows)+noise*.27);
  // Clear whole intersecting stones so offset courses cannot leave half a brick
  // projecting into the ground-level breach. Include rotation in the envelope.
  const reach=(w*Math.abs(Math.cos(tilt))+h*Math.abs(Math.sin(tilt)))/2;
  const missing=p.ruin>threshold||(breached(p)&&x+reach>-.6&&x-reach<.6);
  // Keep opening boundaries exact even at maximum weathering.
  const brick={x,y,z:(depth-.5)*p.weather*.08,w,h,d:p.thickness,tilt,tone:Math.floor(tone*6),moss:moss<p.growth*.55};
  const pieces=carve(brick,p);
  if(!missing)bricks.push(...pieces);
  // Flat debris stays below the same .15 m step clearance used by traversal.
  if(missing&&pieces.length&&debris<.35)rubble.push({...brick,y:.045,z:(scatter-.5)*1.4,tilt:(spin-.5)*.08,w:w*.5,h:.06,d:p.thickness*.7});
 }
 return {params:p,bricks,rubble,passable:traversable(p)};
}

