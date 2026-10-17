import {pixelsForSpan,tagTextureDensity} from './pixel-density.js?v=3f0ffbf381cf1b61530dcf3d344db19a8e832b7d';
/** Tiling pixel ripples: albedo, emission and normals share one moving UV flow. */
export function createCanalWater(THREE){
 const n=pixelsForSpan(2.4),color=new Uint8Array(n*n*4),normal=new Uint8Array(n*n*4),tau=Math.PI*2;
 const wave=(x,y)=>Math.sin(y*tau/n*7+Math.sin(x*tau/n*3)*.9)*.55+Math.sin((y*3-x*2)*tau/n)*.3+Math.cos((x+y)*tau/n*11)*.15;
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const w=wave(x,y),crest=w>.63,foam=w>.78&&Math.sin(x*tau/n*13+y*tau/n*2)>.35,i=(y*n+x)*4;
  const tone=foam?80:crest?49:Math.round((w+1)*3)*5;
  color.set([12+tone*.45,26+tone,27+tone*.9,255],i);
  const dx=(wave(x+1,y)-wave(x-1,y))*2,dy=(wave(x,y+1)-wave(x,y-1))*2,d=Math.hypot(dx,dy,1);
  normal.set([Math.round(128-dx/d*127),Math.round(128-dy/d*127),Math.round(128+127/d),255],i);
 }
 function texture(data,name,srgb){const t=new THREE.DataTexture(data,n,n);t.name=name;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.minFilter=t.magFilter=THREE.NearestFilter;t.generateMipmaps=false;t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;t.repeat.set(2,2);t.needsUpdate=true;return tagTextureDensity(t,[2.4,2.4]);}
 const map=texture(color,'flowing-canal-ripples',true),normalMap=texture(normal,'flowing-canal-normals',false);
 return {map,normalMap,tick(time){for(const t of [map,normalMap])t.offset.set((time*.000011)%1,(time*.000031)%1);},dispose(){map.dispose();normalMap.dispose();}};
}
