import {tagTextureDensity} from './pixel-density.js?v=b62f91ca9ddcf47d5a6312b8f4025115d5dbd33a';
const caches=new WeakMap();
/** Shared one-metre pixel tiles; physical UVs preserve grain through hinge turns. */
export function acquireDoorMaterials(THREE,wood,iron){
 let entry=caches.get(THREE);
 if(!entry){const maps=['wood','iron'].map(kind=>{const pixels=new Uint8Array(64*64*4);for(let y=0;y<64;y++)for(let x=0;x<64;x++){
  const board=Math.floor(x/12),seam=x%12<1,grain=((x*13+Math.floor(y/3)*7)%17)-8,worn=(x*11+y*23)%101<5;
  const color=kind==='wood'?(seam?[39,29,21]:[96+board%3*5+grain,70+grain,45+grain/2]):worn?[103,72,45]:[67+grain,65+grain,58+grain];
  const at=(y*64+x)*4;for(let c=0;c<3;c++)pixels[at+c]=Math.max(0,Math.min(255,color[c]));pixels[at+3]=255;
 }const map=new THREE.DataTexture(pixels,64,64);map.name='door-worn-'+kind;map.colorSpace=THREE.SRGBColorSpace;map.minFilter=map.magFilter=THREE.NearestFilter;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.generateMipmaps=false;map.needsUpdate=true;tagTextureDensity(map,[1,1]);return map;});entry={maps,refs:0};caches.set(THREE,entry);}
 entry.refs++;const materials=[wood,iron].map((source,i)=>{const m=source.clone();m.name=i?'door-aged-iron':'door-worn-timber';m.color.setHex(0xffffff);m.map=entry.maps[i];m.roughness=i?.94:.98;m.metalness=i?.35:0;return m;});let disposed=false;
 return {wood:materials[0],iron:materials[1],dispose(){if(disposed)return;disposed=true;materials.forEach(m=>m.dispose());if(--entry.refs===0){entry.maps.forEach(m=>m.dispose());caches.delete(THREE);}}};
}
