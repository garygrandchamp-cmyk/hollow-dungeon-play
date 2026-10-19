// Camera-local hardware uses the approved dense HUD pixel grid, not world scale.
export function createHeldTorchHeadMaterials(THREE,{pixelsPerUnit=180}={}){
 const settings={depthTest:false,depthWrite:false,fog:false,toneMapped:false},maps=[],materials=[];
 const palettes={iron:[[39,38,31],[58,54,43],[78,72,55],[105,96,73],[129,116,88]],rag:[[37,28,21],[57,40,26],[78,55,32],[102,75,44],[121,93,58]],char:[[25,21,17],[34,27,20],[45,32,21],[61,40,23],[75,48,27]]};
 function make(kind,span,height){
  const width=Math.max(8,Math.round(span*pixelsPerUnit)),rows=Math.max(3,Math.round(height*pixelsPerUnit)),data=new Uint8Array(width*rows*4),ramp=palettes[kind];
  for(let y=0;y<rows;y++)for(let x=0;x<width;x++){
   const facet=Math.floor(x/width*8),side=facet<3?1:0;let shade;
   if(kind==='rag'){shade=1+side+((Math.floor((x+y)/3)+Math.floor(y/3))%3===0?1:0);if(y>=rows-3)shade=Math.min(shade,1);}
   else if(kind==='iron'){shade=y===0||y===rows-1?3:1+side; if((x+Math.floor(y/2)*7)%19===0)shade=0;}
   else shade=(Math.floor(x/3)+Math.floor(y/2)*3)%3;
   data.set([...ramp[shade],255],(y*width+x)*4);
  }
  const map=new THREE.DataTexture(data,width,rows);map.name='held-torch-'+kind+'-pixels';map.minFilter=map.magFilter=THREE.NearestFilter;map.generateMipmaps=false;map.colorSpace=THREE.SRGBColorSpace;map.wrapS=THREE.RepeatWrapping;map.wrapT=THREE.ClampToEdgeWrapping;map.needsUpdate=true;map.userData.heldSurface={pixelsPerUnit,span,height};maps.push(map);
  const material=new THREE.MeshBasicMaterial({map,...settings});material.name='held-torch-'+kind;materials.push(material);return material;
 }
 return {iron:make('iron',2*Math.PI*.04,.014),rag:make('rag',2*Math.PI*.039,.09),char:make('char',2*Math.PI*.031,.02),maps,materials};
}

/** Cache each resampled frame's visible base once. Sprite quad padding must not
 * create a black gap above a physical wick. Animation only changes its center.
 */
export function seatHeldTorchFlame(flame,{headTop=.37,overlap=.008}={}){
 const {data,width,height}=flame.material.map.image,frames=Math.max(1,Math.round(1/flame.material.map.repeat.x)),frameWidth=width/frames,bases=[];
 const threshold=Math.ceil((flame.material.alphaTest??0)*255/.9);
 for(let frame=0;frame<frames;frame++){
  let base=0,found=false;
  for(let y=0;y<height&&!found;y++)for(let x=0;x<frameWidth;x++)if(data[(y*width+frame*frameWidth+x)*4+3]>threshold){base=y/height;found=true;break;}
  bases.push(base);
 }
 flame.position.set(0,headTop-overlap,.004);flame.center.set(.5,bases[0]);flame.userData.headSeat={headTop,overlap,bases:Object.freeze(bases)};
 return frame=>{flame.center.y=bases[((frame%frames)+frames)%frames];};
}
