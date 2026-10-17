/** Character art is the reference; changing density must not shrink motifs. */
export const CHARACTER_PIXELS=104;
export const CHARACTER_HEIGHT=1.7;
export const CHARACTER_TEXELS_PER_UNIT=CHARACTER_PIXELS/CHARACTER_HEIGHT;
export const WORLD_TEXELS_PER_UNIT=64;
export const WORLD_PATTERN_SPANS=Object.freeze({stone:Object.freeze([2.4,1.2]),basalt:Object.freeze([2.4,1.2]),brick:Object.freeze([1.6,1.6]),rubble:Object.freeze([2.4,2.4]),flagstone:Object.freeze([4.8,4.8]),mosaic:Object.freeze([4.8,4.8]),timber:Object.freeze([4.8,4.8]),water:Object.freeze([2.4,2.4])});
export function pixelsForSpan(span){if(!Number.isFinite(span)||span<=0)throw RangeError('Positive world texture span required');return Math.max(1,Math.round(span*WORLD_TEXELS_PER_UNIT));}
export function tagTextureDensity(texture,span){if(!Array.isArray(span)||span.length!==2)throw TypeError('Texture span requires two world lengths');span.forEach(pixelsForSpan);texture.userData.pixelWorldSpan=[...span];return texture;}
export function resamplePixelTile(data,width,height,outWidth,outHeight){
 if(!ArrayBuffer.isView(data)||data.length!==width*height*4||![width,height,outWidth,outHeight].every(n=>Number.isInteger(n)&&n>0))throw TypeError('Invalid pixel tile');
 const output=new Uint8Array(outWidth*outHeight*4);
 for(let y=0;y<outHeight;y++)for(let x=0;x<outWidth;x++){const source=(Math.min(height-1,Math.floor((y+.5)*height/outHeight))*width+Math.min(width-1,Math.floor((x+.5)*width/outWidth)))*4;output.set(data.subarray(source,source+4),(y*outWidth+x)*4);}
 return output;
}
const CHANNELS=[['map','MAP','vMapUv','mapTransform'],['normalMap','NORMALMAP','vNormalMapUv','normalMapTransform'],['roughnessMap','ROUGHNESSMAP','vRoughnessMapUv','roughnessMapTransform'],['bumpMap','BUMPMAP','vBumpMapUv','bumpMapTransform'],['emissiveMap','EMISSIVEMAP','vEmissiveMapUv','emissiveMapTransform']];
const number=n=>Number(n).toFixed(8);
/** Opaque architecture only. Projects physical world units including instance
 * transforms, preserving existing batching. All matching map channels agree.
 * Texture transforms/animated offsets still work; legacy repeats are factored
 * out so they cannot silently alter the declared physical pattern size. */
export function applyWorldMaterialDensity(material){
 if(material.userData.pixelDensityApplied)return material;
 const channels=CHANNELS.filter(([key])=>material[key]?.userData?.pixelWorldSpan);
 if(!channels.length)return material;
 const configuration=channels.map(([key,define,varying,transform])=>{const t=material[key],span=t.userData.pixelWorldSpan;return {define,varying,transform,u:span[0]*(t.repeat?.x??1),v:span[1]*(t.repeat?.y??1)};});
 const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey?.bind(material);
 material.onBeforeCompile=function(shader,renderer){
  previous?.call(this,shader,renderer);
  const projection=`
    vec4 densityPosition = vec4(position, 1.0);
    vec3 densityNormal = normal;
    #ifdef USE_INSTANCING
      densityPosition = instanceMatrix * densityPosition;
      mat3 densityInstance = mat3(instanceMatrix);
      densityNormal = densityInstance * (densityNormal / max(vec3(dot(densityInstance[0],densityInstance[0]),dot(densityInstance[1],densityInstance[1]),dot(densityInstance[2],densityInstance[2])),vec3(0.000001)));
    #endif
    densityPosition = modelMatrix * densityPosition;
    mat3 densityModel = mat3(modelMatrix);
    densityNormal = abs(densityModel * (densityNormal / max(vec3(dot(densityModel[0],densityModel[0]),dot(densityModel[1],densityModel[1]),dot(densityModel[2],densityModel[2])),vec3(0.000001))));
    vec2 densityPlane = densityNormal.y > densityNormal.x && densityNormal.y > densityNormal.z ? densityPosition.xz : densityNormal.x > densityNormal.z ? densityPosition.zy : densityPosition.xy;
  `+configuration.map(c=>`\n#ifdef USE_${c.define}\n${c.varying} = (${c.transform} * vec3(densityPlane / vec2(${number(c.u)},${number(c.v)}),1.0)).xy;\n#endif\n`).join('');
  shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\n'+projection);
 };
 const key=JSON.stringify(configuration);material.customProgramCacheKey=()=>String(previousKey?.()??'')+':world-pixel-density:'+key;material.userData.pixelDensityApplied=true;material.needsUpdate=true;return material;
}
/** Bake UVs after a solid prop's dimensions are finalized. Its texture follows
 * animated lids/doors rather than swimming through a world-space projection. */
export function applyPhysicalUVs(geometry,material,{scale=[1,1,1]}={}){
 const texture=material?.map,span=texture?.userData?.pixelWorldSpan;if(!span)return geometry;
 const p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv;if(!p||!n||!uv)return geometry;
 const write=(i,nx,ny,nz)=>{const x=p.getX(i)*scale[0],y=p.getY(i)*scale[1],z=p.getZ(i)*scale[2];uv.setXY(i,(ny>nx&&ny>nz?x:nx>nz?z:x)/(span[0]*texture.repeat.x),(ny>nx&&ny>nz?z:y)/(span[1]*texture.repeat.y));};
 if(!geometry.index){
  // Select one projection per actual triangle. Smooth sphere/rock vertex
  // normals must not choose different planes at the corners of one facet.
  for(let i=0;i<p.count;i+=3){const ax=(p.getX(i+1)-p.getX(i))*scale[0],ay=(p.getY(i+1)-p.getY(i))*scale[1],az=(p.getZ(i+1)-p.getZ(i))*scale[2],bx=(p.getX(i+2)-p.getX(i))*scale[0],by=(p.getY(i+2)-p.getY(i))*scale[1],bz=(p.getZ(i+2)-p.getZ(i))*scale[2],nx=Math.abs(ay*bz-az*by),ny=Math.abs(az*bx-ax*bz),nz=Math.abs(ax*by-ay*bx);for(let j=i;j<i+3;j++)write(j,nx,ny,nz);}
 }else for(let i=0;i<p.count;i++)write(i,Math.abs(n.getX(i)/scale[0]),Math.abs(n.getY(i)/scale[1]),Math.abs(n.getZ(i)/scale[2]));
 uv.needsUpdate=true;return geometry;
}
