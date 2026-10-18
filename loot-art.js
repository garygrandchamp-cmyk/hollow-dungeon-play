import {WEAPON_CATALOG,generateWeapon} from './weapon-forge.js?v=096375a8b41b569f9c1ed4904ee997628eeda887';
import {magicEffectPixels,MAGIC_THEMES} from './equipment-magic.js?v=096375a8b41b569f9c1ed4904ee997628eeda887';

export const ARMOR_ART_TYPES=Object.freeze(['leather','brigandine','chainmail','scale','iron','knight','bone','occult','frost','blight']);
export const ARMOR_ART_SLOTS=Object.freeze(['helm','chest','arms','legs']);
export const WEAPON_ART_ROWS=Object.freeze({sword:0,hammer:2,mace:4,axe:6});
const images=new Map(),crops=new Map();
const hash=value=>{let h=2166136261;for(const c of String(value))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
export function armorArtRecipe(item={}){
 const h=hash(item.seed??item.id??'starter'),type=ARMOR_ART_TYPES.includes(item.armorType)?item.armorType:ARMOR_ART_TYPES[h%10];
 const variant=Number.isInteger(item.armorVariant)&&item.armorVariant>=0&&item.armorVariant<10?item.armorVariant:(h>>>8)%10;
 const slot=ARMOR_ART_SLOTS.indexOf(item.slot);if(slot<0)return null;
 return {type,variant,file:'armor-'+type+'.png',column:variant%5,row:slot*2+Math.floor(variant/5)};
}
function canvas(size=96){const c=document.createElement('canvas');c.width=c.height=size;return c;}
function image(file){
 if(images.has(file))return images.get(file);
 const pending=new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Unable to load loot art'));img.src=new URL('./assets/loot/'+file,import.meta.url).href;});
 images.set(file,pending);return pending;
}
async function crop(file,column,row){
 const key=file+':'+column+':'+row;if(crops.has(key))return crops.get(key);
 const pending=(async()=>{
  const img=await image(file),c=canvas(),ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;
  const w=img.width/5,h=img.height/8;ctx.drawImage(img,Math.floor(column*w)+1,Math.floor(row*h)+1,Math.floor(w)-2,Math.floor(h)-2,0,0,96,96);
  const pixels=ctx.getImageData(0,0,96,96).data;let minX=96,minY=96,maxX=-1,maxY=-1;
  for(let y=0;y<96;y++)for(let x=0;x<96;x++)if(pixels[(y*96+x)*4+3]>96){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
  if(maxX<0)throw new Error('Empty loot atlas cell');
  let total=0,sumX=0;for(let y=Math.max(minY,maxY-7);y<=maxY;y++)for(let x=minX;x<=maxX;x++)if(pixels[(y*96+x)*4+3]>96){total++;sumX+=x-minX;}
  const width=maxX-minX+1,height=maxY-minY+1;let guardY=null;if(file==='weapon-bases.png'&&row<2){let best=-1;for(let y=minY;y<minY+height*.6;y++){let left=96,right=-1;for(let x=minX;x<=maxX;x++)if(pixels[(y*96+x)*4+3]>96){left=Math.min(left,x);right=Math.max(right,x);}if(right-left>best){best=right-left;guardY=y-minY;}}}return {image:c,x:minX,y:minY,w:width,h:height,anchorX:total?sumX/total:(maxX-minX)/2,guardY,gripY:guardY===null?null:guardY+(height-1-guardY)*.55};
 })();crops.set(key,pending);return pending;
}
function fitted(ctx,part,x,y,width,height,anchor='center'){
 const ax=anchor==='bottom'?Math.max(1,Math.min(part.w-1,part.anchorX??part.w/2)):part.w/2;const scale=Math.min(width/part.w,height/part.h,x/ax,(ctx.canvas.width-x)/(part.w-ax)),w=Math.max(1,Math.round(part.w*scale)),h=Math.max(1,Math.round(part.h*scale));
 ctx.drawImage(part.image,part.x,part.y,part.w,part.h,Math.round(x-ax*scale),Math.round(anchor==='bottom'?y-h:anchor==='top'?y:y-h/2),w,h);
}
function tint(c,theme,color){
 if((!theme||theme==='steel')&&!color)return;
 const colors={ice:[91,171,199],fire:[198,83,43],poison:[111,151,57],arcane:[145,100,183]};
 let tone=colors[theme];if(typeof color==='string'&&/^#[a-f\d]{6}$/i.test(color))tone=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));if(!tone)return;
 const ctx=c.getContext('2d'),data=ctx.getImageData(0,0,c.width,c.height);
 for(let i=0;i<data.data.length;i+=4){if(!data.data[i+3])continue;const light=(data.data[i]*.3+data.data[i+1]*.59+data.data[i+2]*.11)/155;
  for(let ch=0;ch<3;ch++)data.data[i+ch]=Math.min(255,Math.round(data.data[i+ch]*.42+tone[ch]*light*.58));}
 ctx.putImageData(data,0,0);
}
export async function composeLootArt(item={}){
 if(typeof document==='undefined'||typeof Image==='undefined')return null;
 const c=canvas(),ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;
 if(item.kind==='magic'){const effect=magicEffectPixels(MAGIC_THEMES.includes(item.theme)?item.theme:'arcane'),part=canvas(64),pc=part.getContext('2d'),data=pc.createImageData(64,64);for(let y=0;y<64;y++)data.data.set(effect.data.subarray(y*effect.width*4,y*effect.width*4+256),y*256);pc.putImageData(data,0,0);ctx.drawImage(part,4,4,88,88);return c;}
 const armor=armorArtRecipe(item);
 if(armor){fitted(ctx,await crop(armor.file,armor.column,armor.row),48,48,88,88);tint(c,item.theme,item.color);return c;}
 const kind=item.kind==='dagger'?'sword':item.kind;if(!Object.hasOwn(WEAPON_ART_ROWS,kind))return null;
 const recipe=generateWeapon({...item,kind}),catalog=WEAPON_CATALOG[kind],row=WEAPON_ART_ROWS[kind];
 const headIndex=catalog.blades.indexOf(recipe.parts.blade),baseIndex=catalog.bases.indexOf(recipe.parts.base);
 const [head,base]=await Promise.all([crop('weapon-heads.png',headIndex%5,row+Math.floor(headIndex/5)),crop('weapon-bases.png',baseIndex%5,row+Math.floor(baseIndex/5))]);
 // Shared attachment point. Draw the shaft first so the head covers its socket.
 if(kind==='sword'&&base.guardY!==null&&base.gripY>base.guardY){const scale=Math.min(11/(base.gripY-base.guardY),44/base.w),width=Math.round(base.w*scale),height=Math.round(base.h*scale);ctx.drawImage(base.image,base.x,base.y,base.w,base.h,Math.round(48-base.anchorX*scale),Math.round(62-base.guardY*scale),width,height);}else fitted(ctx,base,48,50,22,43,'top');
 fitted(ctx,head,48,kind==='sword'?63:54,kind==='sword'?43:68,kind==='sword'?58:48,'bottom');
 tint(c,recipe.theme,item.color);return c;
}
export function drawLootIcon(item,target){
 target.width=target.height=96;const ctx=target.getContext('2d');if(!ctx)return;
 ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,96,96);
 // A small neutral loading mark; never show art belonging to a previous item.
 ctx.fillStyle='#807766';ctx.fillRect(42,42,12,12);
 const token={};target._lootArtToken=token;
 void composeLootArt(item).then(c=>{if(target._lootArtToken!==token)return;if(c){ctx.clearRect(0,0,96,96);ctx.drawImage(c,0,0);}else if(item.slot==='weapon'||item.slot==='offhand'){
  const recipe=generateWeapon({...item,kind:item.kind==='wand'?'staff':item.kind==='dagger'?'sword':item.kind}),data=ctx.createImageData(96,96);data.data.set(recipe.pixels);ctx.putImageData(data,0,0);
 }}).catch(()=>{});
}
export function hydrateWeaponArt(root,recipe){
 if(!Object.hasOwn(WEAPON_ART_ROWS,recipe?.kind)||!root?.userData?.setArtPixels)return Promise.resolve(false);
 return composeLootArt({...recipe,...recipe.parts,slot:'weapon'}).then(c=>{if(!c)return false;const data=c.getContext('2d').getImageData(0,0,96,96).data;return root.userData.setArtPixels(new Uint8Array(data))!==false;}).catch(()=>false);
}
