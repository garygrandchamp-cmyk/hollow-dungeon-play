// Independent native-pixel elemental effects: never baked into hand artwork.
export const MAGIC_THEMES=Object.freeze(['fire','ice','poison','arcane']);
const SIZE=64,FRAMES=8,pixelCache=new Map(),gpuCache=new WeakMap();
const clamp=n=>Math.max(0,Math.min(1,n));
const palettes={fire:[[109,33,16],[226,91,23],[255,224,136]],ice:[[34,77,124],[93,172,219],[210,242,249]],poison:[[28,61,30],[96,153,48],[195,217,93]],arcane:[[60,36,103],[132,95,211],[215,193,249]]};
export function magicEffectPixels(theme){
 if(!MAGIC_THEMES.includes(theme))throw RangeError('Unknown magic theme: '+theme);if(pixelCache.has(theme))return pixelCache.get(theme);
 const width=SIZE*FRAMES,height=SIZE,data=new Uint8Array(width*height*4),palette=palettes[theme];
 for(let frame=0;frame<FRAMES;frame++){
  const phase=frame/FRAMES*Math.PI*2;
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
   const u=(x-31.5)/27,v=(y-31.5)/27,r=Math.hypot(u,v),angle=Math.atan2(v,u);let intensity=0,alpha=0;
   if(theme==='fire'){
    const rise=(56-y)/49;for(let k=0;k<3;k++){const h=[1.02,.78,.87][k],center=[0,-.34,.32][k]+Math.sin(rise*8-phase+k*2)*.09,w=.025+.24*(1-rise/h),inside=rise>0&&rise<h&&w>0?clamp(1-Math.abs(u-center)/w):0;if(inside>intensity){intensity=inside*(1-rise*.28);alpha=clamp(inside*4);}}
    if(intensity>0)intensity=clamp(intensity+(rise<.42?.25:0));
    for(let k=0;k<3;k++){const px=31+Math.sin(phase+k*2)*13,py=8+((frame*7+k*17)%35);if(Math.abs(x-px)<1&&Math.abs(y-py)<1.5){intensity=.65;alpha=.85;}}
   }else if(theme==='ice'){
    for(let k=0;k<3;k++){const cx=[-.23,0,.25][k]+Math.sin(phase+k)*.015,cy=[.1,-.05,.12][k],w=[.14,.22,.14][k],h=[.4,.65,.43][k],distance=Math.abs((u-cx)/w)+Math.abs((v-cy)/h);if(distance<1){intensity=clamp((u<cx?.78:.43)+(1-distance)*.2+Math.sin(phase+k)*.06);alpha=.97;}}
    for(let k=0;k<6;k++){const a=k*Math.PI/3+phase*.13,cx=Math.cos(a)*.77,cy=Math.sin(a)*.7;if(Math.abs(u-cx)+Math.abs(v-cy)<.075){intensity=.9;alpha=.9;}}
    if(Math.abs(u)<.018&&Math.abs(v)<.34){intensity=1;alpha=1;}
   }else if(theme==='poison'){
    let cloud=0;for(let k=0;k<5;k++){const cx=Math.sin(k*2.1+phase)*.28,cy=.22-((frame/FRAMES+k*.18)%1)*.8,rr=.24+(k%2)*.1;cloud=Math.max(cloud,clamp(1-Math.hypot(u-cx,v-cy)/rr));}
    if(cloud>.08){intensity=clamp(cloud*.8+.15);alpha=clamp(cloud*2.4);}
    for(let k=0;k<3;k++){const cx=Math.sin(k*2+phase)*.45,cy=.55-((frame/FRAMES+k*.31)%1)*1.3,dist=Math.hypot(u-cx,v-cy);if(Math.abs(dist-.075)<.025){intensity=.7;alpha=.85;}}
   }else{
    const ring=.46+.08*Math.sin(angle*3-phase),line=Math.abs(r-ring);if(line<.04){intensity=.6+clamp(1-line/.04)*.3;alpha=.92;}
    if(r>.22&&r<.67&&Math.abs(Math.sin(angle*6+phase))<.13){intensity=.75;alpha=.8;}
    if(r<.14+.035*Math.sin(phase)){intensity=.95;alpha=.95;}
   }
   if(alpha<=0)continue;const mix=clamp(intensity)*2,index=mix<1?0:1,t=mix-index,p=(y*width+frame*SIZE+x)*4;
   for(let c=0;c<3;c++)data[p+c]=Math.round(palette[index][c]*(1-t)+palette[index+1][c]*t);data[p+3]=Math.round(alpha*255);
  }
 }
 const result={width,height,frameWidth:SIZE,frames:FRAMES,data};pixelCache.set(theme,result);return result;
}
function acquire(THREE,theme){
 let cache=gpuCache.get(THREE);if(!cache){cache=new Map();gpuCache.set(THREE,cache);}let entry=cache.get(theme);
 if(!entry){const a=magicEffectPixels(theme),bottomUp=new Uint8Array(a.data.length),stride=a.width*4;for(let y=0;y<a.height;y++)bottomUp.set(a.data.subarray(y*stride,(y+1)*stride),(a.height-1-y)*stride);const base=new THREE.DataTexture(bottomUp,a.width,a.height,THREE.RGBAFormat,THREE.UnsignedByteType);base.name='magic-effect-'+theme;base.flipY=false;base.colorSpace=THREE.SRGBColorSpace;base.magFilter=base.minFilter=THREE.NearestFilter;base.wrapS=base.wrapT=THREE.ClampToEdgeWrapping;base.generateMipmaps=false;base.needsUpdate=true;entry={base,refs:0};cache.set(theme,entry);}
 entry.refs++;const map=entry.base.clone();map.repeat.set(1/FRAMES,1);map.needsUpdate=true;let released=false;return {map,release(){if(released)return;released=true;map.dispose();if(--entry.refs===0){entry.base.dispose();cache.delete(theme);}}};
}
export function createMagicLayer(THREE,{theme='arcane'}={}){
 if(!MAGIC_THEMES.includes(theme))throw RangeError('Unknown magic theme: '+theme);
 const resources=Object.fromEntries(MAGIC_THEMES.map(name=>[name,acquire(THREE,name)])),material=new THREE.SpriteMaterial({map:resources[theme].map,transparent:true,alphaTest:.02,depthTest:false,depthWrite:false,fog:false,toneMapped:false}),sprite=new THREE.Sprite(material);sprite.name='equipment-magic-effect';sprite.position.set(.03,.82,.015);sprite.scale.set(.42,.42,1);sprite.renderOrder=902;sprite.frustumCulled=false;sprite.userData.modularMagic=true;let disposed=false;
 function setTheme(next){if(!MAGIC_THEMES.includes(next))throw RangeError('Unknown magic theme: '+next);if(disposed)return;theme=next;material.map=resources[theme].map;sprite.userData.theme=theme;}
 function animate({time=0,casting=false}={}){if(disposed)return;time=Number.isFinite(time)?time:0;const frame=((Math.floor(time*(casting?14:9)/1000)%FRAMES)+FRAMES)%FRAMES;material.map.offset.x=frame/FRAMES;material.opacity=casting?.92:.65+.08*Math.sin(time*.003);sprite.userData.frame=frame;}
 function dispose(){if(disposed)return;disposed=true;sprite.removeFromParent();material.dispose();Object.values(resources).forEach(r=>r.release());}
 setTheme(theme);animate();return {sprite,setTheme,animate,dispose,get theme(){return theme;}};
}
