import {buildWallVines} from './vines.js?v=b8b6cbf7a249f190b877d02f83550c5a29daf9e3';
import {buildWallGeometry} from './wall-mesh.js?v=b8b6cbf7a249f190b877d02f83550c5a29daf9e3';
import {wallRecipe} from './wall-model.js?v=b8b6cbf7a249f190b877d02f83550c5a29daf9e3';
import {buildModuleFloor} from './canal-module.js?v=b8b6cbf7a249f190b877d02f83550c5a29daf9e3';

export const TILE_CATALOG_KEY='hollow:tile-lab:catalog:v1';
const MAX_RECIPES=32;
const FLOORS=['flagstone','mosaic','timber'],MASONRY=['dressed','basalt','brick','rubble'],OPENINGS=['none','gothic','arch','square'];
const blank=()=>({name:'Untitled module',s:[0,0,0,0],weight:1,rotations:true,recipe:{height:3.6,ruin:.18,growth:.15,masonry:'dressed',opening:'none',floorStyle:'flagstone'}});
function storageOf(storage){try{return storage??globalThis.localStorage;}catch{return null;}}
export function validateTileRecipe(value){
 const errors=[];
 if(!value||typeof value!=='object')return {valid:false,errors:['Choose a tile recipe.']};
 if(typeof value.name!=='string'||!value.name.trim()||value.name.trim().length>60)errors.push('Give the module a name of 1–60 characters.');
 if(!Array.isArray(value.s)||value.s.length!==4||value.s.some(s=>![0,1,2].includes(s)))errors.push('Choose four sockets: wall, passage, or canal.');
 else{
  if(!value.s.some(s=>s===1||s===2))errors.push('Add a passage or canal socket before saving this blank module.');
 }
 if(!Number.isFinite(value.weight)||value.weight<.05||value.weight>5)errors.push('Frequency weight must be between 0.05 and 5.');
 const r=value.recipe;
 if(!r||typeof r!=='object')errors.push('Wall and floor settings are missing.');
 else{
  for(const [key,min,max]of [['height',.6,5],['ruin',0,1],['growth',0,1]])if(!Number.isFinite(r[key])||r[key]<min||r[key]>max)errors.push(`${key} must be between ${min} and ${max}.`);
  if(!FLOORS.includes(r.floorStyle)||!MASONRY.includes(r.masonry)||!OPENINGS.includes(r.opening))errors.push('Choose a supported floor, masonry, and opening.');
 }
 return {valid:errors.length===0,errors};
}
function clean(value){return {name:value.name.trim(),s:[...value.s],weight:value.weight,rotations:value.rotations===true,recipe:{height:value.recipe.height,ruin:value.recipe.ruin,growth:value.recipe.growth,masonry:value.recipe.masonry,opening:value.recipe.opening,floorStyle:value.recipe.floorStyle}};}
export function tileVariants(value){
 const check=validateTileRecipe(value);if(!check.valid)throw Error(check.errors.join(' '));
 const def=clean(value),variants=[],seen=new Set();let s=[...def.s];
 for(let rotation=0;rotation<(def.rotations?4:1);rotation++){
  const key=s.join('');if(!seen.has(key)){seen.add(key);variants.push({s:[...s],weight:def.weight,name:def.name+(rotation?` · ${rotation*90}°`:''),recipe:{...def.recipe},rotation});}
  s=[s[3],s[0],s[1],s[2]];
 }
 return variants;
}
function readCatalog(storage){
 try{
  if(!storage)return {recipes:[],error:'Browser storage is unavailable. Saving is disabled.'};
  const raw=storage.getItem(TILE_CATALOG_KEY);if(!raw)return {recipes:[],error:null};
  const parsed=JSON.parse(raw);
  if(parsed?.version!==1||!Array.isArray(parsed.recipes)||parsed.recipes.length>MAX_RECIPES)throw Error('Unsupported tile catalog.');
  const recipes=[],ids=new Set();let skipped=0;
  for(const value of parsed.recipes){
   if(!Number.isSafeInteger(value?.id)||value.id<1||ids.has(value.id)||!validateTileRecipe(value).valid){skipped++;continue;}
   ids.add(value.id);recipes.push({id:value.id,...clean(value)});
  }
  return {recipes,error:null,skipped};
 }catch{return {recipes:[],error:'Saved tile catalog could not be read. Existing generator tiles are unchanged.'};}
}
export function loadTileCatalog(tiles,storage){
 if(!Array.isArray(tiles))throw TypeError('Tile catalog must be a mutable array.');
 const catalog=readCatalog(storageOf(storage)),keys=new Set(tiles.map(t=>t.catalogKey).filter(Boolean));let added=0;
 for(const def of catalog.recipes)for(const variant of tileVariants(def)){
  const catalogKey=`hollow-tile:${def.id}:r${variant.rotation}`;
  if(keys.has(catalogKey))continue;
  tiles.push({...variant,catalogKey,catalogId:def.id,custom:true});keys.add(catalogKey);added++;
 }
 return {...catalog,added};
}
export function saveTileRecipe(tiles,value,storage){
 const check=validateTileRecipe(value);if(!check.valid)throw Error(check.errors.join(' '));
 const target=storageOf(storage),catalog=readCatalog(target);if(catalog.error)throw Error(catalog.error);
 const def=clean(value),existing=catalog.recipes.find(r=>JSON.stringify(clean(r))===JSON.stringify(def));
 if(existing)return {...loadTileCatalog(tiles,target),id:existing.id,duplicate:true};
 if(catalog.recipes.length>=MAX_RECIPES)throw Error(`The catalog holds ${MAX_RECIPES} recipes. Browse a saved recipe to reuse it.`);
 const id=Math.max(0,...catalog.recipes.map(r=>r.id))+1;
 // Persist first: a quota/security failure must not create volatile tile ids.
 target.setItem(TILE_CATALOG_KEY,JSON.stringify({version:1,recipes:[...catalog.recipes,{id,...def}]}));
 return {...loadTileCatalog(tiles,target),id,duplicate:false};
}

export function createTileLab({THREE,tiles,box,mat,surfaceMaps,waterMaterial,onCatalogChange=()=>{},notify=()=>{}}){
 const aside=document.querySelector('aside');if(!aside)throw Error('Tile Lab needs the generator sidebar.');
 const existing=document.getElementById('hollow-tile-lab');if(existing)throw Error('Tile Lab is already mounted.');
 const launcher=document.createElement('button');launcher.textContent='＋ Tile Lab · create a module';launcher.type='button';launcher.className='secondary';aside.insertBefore(launcher,document.getElementById('editorPanel')??aside.firstChild);
 const style=document.createElement('style');style.textContent=`
 #hollow-tile-lab{box-sizing:border-box;color:#e2d9c8;background:#171815;border:1px solid #66604a;border-radius:12px;width:min(980px,96vw);max-height:92dvh;padding:0;box-shadow:0 28px 100px #000b;font:14px/1.45 system-ui,sans-serif}
 #hollow-tile-lab::backdrop{background:#000b}#hollow-tile-lab *{box-sizing:border-box}#hollow-tile-lab [hidden]{display:none!important}
 #hollow-tile-lab .tl-head,#hollow-tile-lab .tl-actions{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:16px 20px;border-bottom:1px solid #414235}#hollow-tile-lab h2{font:24px Georgia,serif;margin:0;color:#f2e9d6}#hollow-tile-lab p{margin:8px 0;color:#c1baa9;font-size:13px}
 #hollow-tile-lab .tl-grid{display:grid;grid-template-columns:minmax(240px,1fr) minmax(270px,1fr);gap:22px;padding:20px}#hollow-tile-lab label{display:block;font:12px/1.4 system-ui,sans-serif;margin:10px 0 5px;color:#e2d9c8;text-transform:none;letter-spacing:0}#hollow-tile-lab input,#hollow-tile-lab select{width:100%;margin:0;padding:8px;background:#25271f;color:#eee5d3;border:1px solid #5c5e4b;border-radius:5px;font:14px system-ui,sans-serif}#hollow-tile-lab input[type=range]{padding:0;accent-color:#d9b971}#hollow-tile-lab input[type=checkbox]{width:auto;margin-right:7px}
 #hollow-tile-lab button{min-height:36px;padding:8px 12px;background:#34382a;color:#eee5d3;border:1px solid #686d53;border-radius:5px;font:13px system-ui,sans-serif;cursor:pointer}#hollow-tile-lab button:disabled{opacity:.5;cursor:not-allowed}#hollow-tile-lab .tl-save{background:#bda05b;color:#181b13;font-weight:700}#hollow-tile-lab .tl-row{display:flex;gap:8px;align-items:center}#hollow-tile-lab .tl-row>*{flex:1}#hollow-tile-lab .tl-sockets{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}#hollow-tile-lab .tl-preview{width:100%;height:340px;overflow:hidden;background:#0e110e;border:1px solid #414b37;border-radius:8px;touch-action:none}#hollow-tile-lab .tl-preview canvas{display:block;width:100%;height:100%}#hollow-tile-lab .tl-status{min-height:48px;padding:10px;border-left:3px solid #ad945b;background:#24271e}#hollow-tile-lab output{color:#e5c985}#hollow-tile-lab .tl-actions{border-top:1px solid #414235;border-bottom:0;flex-wrap:wrap}#hollow-tile-lab .tl-actions p{flex:1;min-width:180px}#hollow-tile-lab :focus-visible{outline:2px solid #e5c985;outline-offset:2px}
 @media(max-width:700px){#hollow-tile-lab .tl-grid{grid-template-columns:1fr;padding:14px;gap:8px}#hollow-tile-lab .tl-preview{height:240px}#hollow-tile-lab .tl-preview-col{grid-row:1}#hollow-tile-lab .tl-head{padding:12px}#hollow-tile-lab h2{font-size:21px}}`;
 document.head.appendChild(style);
 const dialog=document.createElement('dialog');dialog.id='hollow-tile-lab';dialog.setAttribute('aria-labelledby','tl-title');
 // Static markup only; all names and persisted text are assigned via textContent/value.
 dialog.innerHTML=`<div class="tl-head"><div><h2 id="tl-title">Tile Lab</h2><p>Build a 4.8 m module, then add it to the generator.</p></div><button type="button" data-close aria-label="Close Tile Lab">Close ×</button></div><form><div class="tl-grid"><div><label for="tl-saved">Browse saved recipes</label><select id="tl-saved"><option value="">New blank module</option></select><div class="tl-row" style="margin-top:8px"><button type="button" data-new>New blank</button><button type="button" data-clear>Clear sockets</button></div><label for="tl-name">Module name</label><input id="tl-name" maxlength="60" autocomplete="off" required><div class="tl-sockets">${['North','East','South','West'].map((name,i)=>`<div><label for="tl-socket-${i}">${name} edge</label><select id="tl-socket-${i}"><option value="0">Wall · 0</option><option value="1">Passage · 1</option><option value="2">Canal · 2</option></select></div>`).join('')}</div><label><input id="tl-rotations" type="checkbox">Include unique quarter-turn rotations</label><label for="tl-weight">Frequency weight</label><input id="tl-weight" type="number" min=".05" max="5" step=".05"><label for="tl-floor">Floor surface</label><select id="tl-floor"><option value="flagstone">Cracked flagstone</option><option value="mosaic">Ancient mosaic</option><option value="timber">Worn timber</option></select><label for="tl-masonry">Wall masonry</label><select id="tl-masonry"><option value="dressed">Dressed limestone</option><option value="basalt">Dark basalt</option><option value="brick">Worn red brick</option><option value="rubble">Rough rubble</option></select><label for="tl-opening">Openings in wall edges</label><select id="tl-opening"><option value="none">Solid masonry</option><option value="gothic">Pointed Gothic arch</option><option value="arch">Rounded arch</option><option value="square">Rectangular opening</option></select>${[['height','Wall height',.6,5,.1],['ruin','Ruination',0,1,.01],['growth','Overgrowth',0,1,.01]].map(([id,label,min,max,step])=>`<label for="tl-${id}">${label} <output id="tl-out-${id}"></output></label><input id="tl-${id}" type="range" min="${min}" max="${max}" step="${step}">`).join('')}</div><div class="tl-preview-col"><div class="tl-preview" aria-label="Module preview"></div><p data-preview-caption>Drag to orbit the preview. North is the far edge.</p><p class="tl-status" role="status" aria-live="polite" data-status></p><p>Socket order: north, east, south, west. The generator matches equal sockets. A saved tile is eligible for selection; its weight affects frequency. Canal ends are sealed basins; water-only tiles and junctions are allowed. Water sockets match locally without a global flow rule.</p><p>Wall openings are elevated windows, keeping wall sockets sealed. Passage sockets control walking connections. Preview omits room furnishings.</p></div></div><div class="tl-actions"><p data-count></p><button type="button" data-close>Cancel</button><button type="submit" class="tl-save">Save & generate</button></div></form>`;
 document.body.appendChild(dialog);
 const q=s=>dialog.querySelector(s),controls={name:q('#tl-name'),weight:q('#tl-weight'),rotations:q('#tl-rotations'),floor:q('#tl-floor'),masonry:q('#tl-masonry'),opening:q('#tl-opening'),height:q('#tl-height'),ruin:q('#tl-ruin'),growth:q('#tl-growth')};
 const sockets=[0,1,2,3].map(i=>q('#tl-socket-'+i)),host=q('.tl-preview'),status=q('[data-status]'),save=q('.tl-save'),browse=q('#tl-saved');
 let renderer=null,scene=null,group=null,camera=null,observer=null,plan=null,opened=false,destroyed=false,azimuth=.7,current=blank(),drag=null;
 function read(){return {name:controls.name.value,s:sockets.map(el=>+el.value),weight:+controls.weight.value,rotations:controls.rotations.checked,recipe:{height:+controls.height.value,ruin:+controls.ruin.value,growth:+controls.growth.value,masonry:controls.masonry.value,opening:controls.opening.value,floorStyle:controls.floor.value}};}
 function fill(def){controls.name.value=def.name;controls.weight.value=def.weight;controls.rotations.checked=def.rotations;def.s.forEach((s,i)=>sockets[i].value=s);for(const key of ['height','ruin','growth','masonry','opening'])controls[key].value=def.recipe[key];controls.floor.value=def.recipe.floorStyle;update();}
 function refreshCatalog(selected=''){
  const catalog=readCatalog(storageOf());browse.replaceChildren();const option=document.createElement('option');option.value='';option.textContent='New blank module';browse.appendChild(option);
  for(const def of catalog.recipes){const o=document.createElement('option');o.value=String(def.id);o.textContent=def.name;browse.appendChild(o);}
  browse.value=selected;q('[data-count]').textContent=`${catalog.recipes.length}/${MAX_RECIPES} saved recipes · ${tiles.filter(t=>t.custom).length} custom variants`;
  return catalog;
 }
 function message(text){status.textContent=text;}
 function update(){
  current=read();for(const key of ['height','ruin','growth'])q('#tl-out-'+key).textContent=key==='height'?current.recipe.height.toFixed(1)+' m':Math.round(current.recipe[key]*100)+'%';
  const check=validateTileRecipe(current),catalog=readCatalog(storageOf());save.disabled=!check.valid||!!catalog.error;
  const canals=current.s.filter(s=>s===2).length,waterLabel=canals===0?'No canals.':canals===1?'Sealed canal endcap.':canals===2?(current.s[0]===2&&current.s[2]===2||current.s[1]===2&&current.s[3]===2?'Straight canal.':'Canal bend.'):canals===3?'Three-way canal junction.':'Four-way canal junction.';
  message(catalog.error??(!check.valid?check.errors.join(' '):`${tileVariants(current).length} unique orientation(s) ready. ${waterLabel} ${!current.s.includes(1)?'Water-only module; no walking connection. ':''}${current.recipe.opening!=='none'?'Wall openings do not change edge socket rules.':''}`));
  if(opened)drawPreview();
 }
 function resize(){if(!opened)return;const width=Math.min(640,Math.max(1,host.clientWidth)),height=Math.max(1,host.clientHeight);if(renderer){renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();render();}else if(plan){plan.width=Math.min(640,width);plan.height=height;drawPlan();}}
 function render(){if(renderer&&camera&&scene){camera.position.set(Math.sin(azimuth)*10,8,Math.cos(azimuth)*10);camera.lookAt(0,1,0);renderer.render(scene,camera);}}
 function startPreview(){
  try{
   if(!THREE||!box||!mat)throw Error('3D unavailable');
   renderer=new THREE.WebGLRenderer({antialias:false,alpha:false,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,1.25));renderer.shadowMap.enabled=false;host.appendChild(renderer.domElement);
   scene=new THREE.Scene();scene.background=new THREE.Color(0x111710);scene.add(new THREE.HemisphereLight(0xdcd6be,0x353a28,2));const light=new THREE.DirectionalLight(0xffe5bd,2);light.position.set(-4,8,3);scene.add(light);group=new THREE.Group();scene.add(group);camera=new THREE.PerspectiveCamera(42,1,.1,50);
   renderer.domElement.addEventListener('pointerdown',e=>{drag=e.clientX;renderer.domElement.setPointerCapture(e.pointerId);});renderer.domElement.addEventListener('pointermove',e=>{if(drag===null)return;azimuth+=(e.clientX-drag)*.01;drag=e.clientX;render();});renderer.domElement.addEventListener('pointerup',()=>drag=null);renderer.domElement.addEventListener('pointercancel',()=>drag=null);
  }catch{
   renderer?.dispose();renderer?.forceContextLoss?.();renderer=null;host.replaceChildren();plan=document.createElement('canvas');host.appendChild(plan);q('[data-preview-caption]').textContent='3D unavailable — showing a north-up plan. Wall and surface settings are saved normally.';
  }
  if(globalThis.ResizeObserver){observer=new ResizeObserver(resize);observer.observe(host);}resize();drawPreview();
 }
 function drawPreview(){
  if(!renderer){drawPlan();return;}clearPreviewGeometry();const r=current.recipe;
  const colors={dressed:0x8b8271,basalt:0x424b46,brick:0x915f48,rubble:0x757263};
  const stone=mat('tilelab-masonry-'+r.masonry,colors[r.masonry]);
  const floorGroup=new THREE.Group();floorGroup.scale.set(2,1,2);group.add(floorGroup);
  buildModuleFloor({THREE,group:floorGroup,box,mat,sockets:current.s,floorStyle:r.floorStyle,surfaceMaps,waterMaterial,seed:'tile-lab'});
  for(let d=0;d<4;d++){
   const [dx,dz]=[[0,-1],[1,0],[0,1],[-1,0]][d];
   if(current.s[d]!==0)continue;
   const wall=new THREE.Group();wall.position.set(dx*2.4,0,dz*2.4);wall.rotation.y=d%2?Math.PI/2:0;group.add(wall);
   const model=wallRecipe({...r,weather:.25,width:1.1,openingHeight:1.7,sill:r.opening==='none'?0:1},'tile-lab-'+d);
   const geo=buildWallGeometry(THREE,model),mesh=new THREE.Mesh(geo,stone);mesh.scale.x=2;mesh.userData.ownGeometry=true;wall.add(mesh);const vines=buildWallVines(THREE,{seed:'tile-lab-'+d,coverage:r.growth,height:r.height,thickness:.36,bricks:model.bricks,style:'ivy'});vines.scale.x=2;wall.add(vines);
  }
  render();
 }
 function drawPlan(){
  if(!plan)return;const ctx=plan.getContext('2d');if(!ctx)return;const w=plan.width,h=plan.height,span=Math.min(w-80,h-70),x=(w-span)/2,y=(h-span)/2;
  ctx.fillStyle='#10170f';ctx.fillRect(0,0,w,h);ctx.fillStyle={flagstone:'#777562',mosaic:'#aaa079',timber:'#795b3d'}[current.recipe.floorStyle];ctx.fillRect(x,y,span,span);
  ctx.lineWidth=10;ctx.lineCap='butt';
  const edges=[[x,y,x+span,y],[x+span,y,x+span,y+span],[x+span,y+span,x,y+span],[x,y+span,x,y]];
  for(let d=0;d<4;d++){
   const [a,b,c,e]=edges[d];if(current.s[d]===0){ctx.strokeStyle='#b1aa91';ctx.beginPath();ctx.moveTo(a,b);ctx.lineTo(c,e);ctx.stroke();}
   if(current.s[d]===2){ctx.strokeStyle='#4eafb5';ctx.lineWidth=span*.15;ctx.beginPath();ctx.moveTo((a+c)/2,(b+e)/2);ctx.lineTo(x+span/2,y+span/2);ctx.stroke();ctx.lineWidth=10;}
  }
  if(current.s.includes(2)&&current.s.includes(1)){
   ctx.fillStyle='#a88a55';const deck=span*.36;ctx.fillRect(x+span/2-deck/2,y+span/2-deck/2,deck,deck);
   for(let d=0;d<4;d++)if(current.s[d]===1){ctx.strokeStyle='#a88a55';ctx.lineWidth=deck;ctx.beginPath();ctx.moveTo((edges[d][0]+edges[d][2])/2,(edges[d][1]+edges[d][3])/2);ctx.lineTo(x+span/2,y+span/2);ctx.stroke();}
  }
  ctx.fillStyle='#f4e8c7';ctx.font='13px system-ui';ctx.textAlign='center';const labels=[['N',w/2,y-14],['E',x+span+23,y+span/2],['S',w/2,y+span+24],['W',x-23,y+span/2]];for(const [label,a,b]of labels)ctx.fillText(label,a,b);
 }
 function clearPreviewGeometry(){group?.traverse(o=>{o.userData.disposeMaterials?.();if(o.userData.ownGeometry)o.geometry?.dispose();});group?.clear();}
 function stopPreview(){clearPreviewGeometry();observer?.disconnect();observer=null;renderer?.dispose();renderer?.forceContextLoss?.();renderer=null;scene?.clear();scene=null;group=null;camera=null;plan=null;drag=null;host.replaceChildren();}
 function open(){if(destroyed||opened)return;document.exitPointerLock?.();opened=true;refreshCatalog();dialog.showModal();q('[data-preview-caption]').textContent='Drag to orbit the preview. North is the far edge.';startPreview();update();controls.name.focus();}
 function close(){if(!opened)return;opened=false;stopPreview();if(dialog.open)dialog.close();launcher.focus();}
 launcher.addEventListener('click',open);dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('close',()=>{if(opened)close();});dialog.addEventListener('keydown',e=>e.stopPropagation());dialog.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',close));
 q('[data-new]').addEventListener('click',()=>{browse.value='';fill(blank());controls.name.focus();});q('[data-clear]').addEventListener('click',()=>{sockets.forEach(el=>el.value='0');update();});browse.addEventListener('change',()=>{const def=readCatalog(storageOf()).recipes.find(r=>String(r.id)===browse.value);fill(def??blank());});q('form').addEventListener('input',update);q('form').addEventListener('change',update);
 q('form').addEventListener('submit',e=>{e.preventDefault();const value=read();try{const result=saveTileRecipe(tiles,value);refreshCatalog(String(result.id));message(result.duplicate?'This recipe is already in the catalog.':`Saved ${result.added} tile orientation(s). Generating the dungeon…`);notify(result.duplicate?'Tile recipe already saved.':`Tile Lab: ${value.name} added to the generator.`);if(!result.duplicate||result.added)onCatalogChange();}catch(error){message('Could not save: '+error.message);notify('Tile Lab could not save the recipe.');}});
 fill(blank());refreshCatalog();
 return {open,close,get isOpen(){return opened;},destroy(){close();destroyed=true;launcher.remove();dialog.remove();style.remove();}};
}

