import {roomContainsWorld,roomCells} from './room-footprint.js?v=b91d921906b17f837908fbc4821fb42dd44188f9';
// Local, low-level atmosphere: three batched draws, no canvas/assets/lights.
const TAU=Math.PI*2;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function random(seed){let a=2166136261;for(const c of String(seed))a=Math.imul(a^c.charCodeAt(0),16777619);return()=>{a+=0x6d2b79f5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const QUALITY={low:{mist:48,dust:12},medium:{mist:96,dust:24},high:{mist:144,dust:36}};

export function createDungeonAtmosphere(THREE){
 const root=new THREE.Group();root.name='dungeon-atmosphere';root.visible=false;root.userData.atmosphere=true;
 let disposed=false,intensity=.45,batches=[],maps=[],heightAt=()=>0,elapsed=0,enabled=true,firstPerson=true;
 function stats(){root.userData.particleCount=batches.reduce((n,b)=>n+b.particles.length,0);root.userData.drawCalls=batches.length;root.userData.intensity=intensity;}
 function visibility(){root.visible=!disposed&&enabled&&firstPerson&&intensity>0&&batches.length>0;}
 function retire(){
  // May run inside world.traverse(): clear our children, never detach root or
  // mutate the parent's child list. Each owned resource is released once.
  const old=batches;batches=[];root.clear();for(const b of old){b.geometry.dispose();b.material.dispose();}for(const map of maps)map.dispose();maps=[];stats();visibility();
 }
 root.userData.disposeMaterials=retire;
 function softMap(dust=false){
  const n=dust?24:64,data=new Uint8Array(n*n*4);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
   const nx=(x+.5-n/2)/(n*(dust?.45:.46)),ny=(y+.5-n/2)/(n*(dust?.45:.19)),r=Math.hypot(nx,ny),edge=clamp((1.12-r)/.65,0,1),cloud=dust?1:.73+.17*Math.sin(nx*7+ny*4)+.1*Math.sin(nx*17-ny*9),alpha=Math.exp(-r*r*(dust?5:2.1))*edge*edge*cloud*(dust?.9:.72),i=(y*n+x)*4;
   // Deliberate small grayscale/alpha ramps keep mist pixel-coherent while
   // its low opacity and graduated shape remain soft in the dungeon.
   const grey=dust?255:Math.round((214+cloud*22)/4)*4,softAlpha=Math.round(clamp(alpha,0,1)*15)*17;data.set([grey,grey,grey,softAlpha],i);
  }
  const map=new THREE.DataTexture(data,n,n,THREE.RGBAFormat,THREE.UnsignedByteType);map.name=dust?'faint-soft-dust':'soft-low-mist';map.minFilter=map.magFilter=THREE.NearestFilter;map.generateMipmaps=false;map.wrapS=map.wrapT=THREE.ClampToEdgeWrapping;map.flipY=false;map.colorSpace=THREE.SRGBColorSpace;map.needsUpdate=true;maps.push(map);return map;
 }
 function ground(x,z){try{const y=heightAt(x,z);return Number.isFinite(y)?clamp(y,-1000,1000):0;}catch{return 0;}}
 function roomsFor({size,moduleSize,architecture}){
  const rooms=[],seen=new Set();for(const r of [...(Array.isArray(architecture?.rooms)?architecture.rooms:[]),...(Array.isArray(architecture?.dampAreas)?architecture.dampAreas:[])].slice(0,64)){
   if(!r||!['x','z','w','h'].every(k=>Number.isFinite(r[k]))||r.w<2||r.h<2||r.w*r.h<9)continue;
   const x=clamp(r.x,0,size),z=clamp(r.z,0,size),w=clamp(r.w,0,size-x),h=clamp(r.h,0,size-z);if(w<2||h<2||w*h<9)continue;
   const key=[x,z,w,h].join(':');if(seen.has(key))continue;seen.add(key);
   const width=w*moduleSize,depth=h*moduleSize,margin=Math.min(moduleSize*.65,width*.24,depth*.24),left=(x-size/2)*moduleSize,right=left+width,north=(z-size/2)*moduleSize,south=north+depth,damp=r.damp===true||/damp|sunken|archive|cistern|flood|crypt/i.test(String(r.name??r.theme??''));
   rooms.push({left,right,north,south,margin,weight:(r.footprint?roomCells(r).length:w*h)*(damp?1.45:1),width,depth,accept:(px,pz)=>!r.footprint||roomContainsWorld(r,px,pz,size,moduleSize),fallback:roomCells(r).map(p=>({x:(p.x-(size-1)/2)*moduleSize,z:(p.z-(size-1)/2)*moduleSize}))});
  }return rooms.slice(0,8);
 }
 function addBatch(name,count,rooms,rng,map,dust,layer,moduleSize){
  const particles=[],positions=new Float32Array(count*3),colors=dust?new Float32Array(count*3):null,total=rooms.reduce((n,r)=>n+r.weight,0);
  for(let i=0;i<count;i++){
   let choice=rng()*total,room=rooms.at(-1);for(const r of rooms){choice-=r.weight;if(choice<=0){room=r;break;}}
   const margin=room.margin,rangeX=room.right-room.left-margin*2,rangeZ=room.south-room.north-margin*2,centerX=(room.left+room.right)/2,centerZ=(room.north+room.south)/2;
   let x=dust?centerX+(rng()-.5)*Math.min(rangeX,moduleSize*1.5):room.left+margin+rng()*rangeX,z=dust?centerZ+(rng()-.5)*Math.min(rangeZ,moduleSize*1.5):room.north+margin+rng()*rangeZ;
   if(!room.accept(x,z)){const cell=room.fallback[Math.floor(rng()*room.fallback.length)];x=cell.x;z=cell.z;}
   const p={x,z,phase:rng()*TAU,speed:.045+rng()*.04,height:dust?.65+rng()*1.4:.3+rng()*(layer?.45:.25),room};particles.push(p);positions.set([x,ground(x,z)+p.height,z],i*3);
   if(colors){const value=.52+rng()*.2;colors.set([value,value*.83,value*.59],i*3);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));if(colors)geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.computeBoundingSphere();
  const material=new THREE.PointsMaterial({map,size:dust?moduleSize*.015:moduleSize*(layer?.73:1.12),sizeAttenuation:true,color:dust?0xffffff:layer?0x87969a:0x94a0a2,opacity:0,transparent:true,depthTest:true,depthWrite:false,alphaTest:.002,fog:true,toneMapped:false,vertexColors:dust,blending:THREE.NormalBlending});
  const points=new THREE.Points(geometry,material);points.name=name;points.frustumCulled=false;points.castShadow=points.receiveShadow=false;points.renderOrder=dust?3:2;points.userData.ownGeometry=true;points.userData.dynamic=true;points.userData.atmosphere=true;root.add(points);batches.push({points,geometry,material,particles,positions,dust,layer});
 }
 function applyIntensity(){for(const b of batches)b.material.opacity=intensity*(b.dust?.26:b.layer?.13:.18);stats();visibility();}
 const api={
  root,
  build({size,moduleSize=4.8,architecture,seed='dungeon-mist',groundHeight,quality='medium'}={}){
   if(disposed)return root;retire();elapsed=0;heightAt=typeof groundHeight==='function'?groundHeight:()=>0;
   if(!Number.isInteger(size)||size<1||size>128||!Number.isFinite(moduleSize)||moduleSize<=0||moduleSize>32||quality==='off'||quality===false)return root;
   const rooms=roomsFor({size,moduleSize,architecture});if(!rooms.length)return root;
   const budget=typeof quality==='string'&&Object.hasOwn(QUALITY,quality)?QUALITY[quality]:QUALITY.medium,rng=random(seed),mist=softMap(),dust=softMap(true),primary=Math.ceil(budget.mist*.65);
   addBatch('low-cool-mist',primary,rooms,rng,mist,false,0,moduleSize);addBatch('thin-drifting-wisps',budget.mist-primary,rooms,rng,mist,false,1,moduleSize);addBatch('warm-room-dust',budget.dust,rooms,rng,dust,true,0,moduleSize);applyIntensity();return root;
  },
  tick(dt,now,{enabled:show=true,firstPerson:fp=true,position}={}){
   if(disposed)return;enabled=show!==false;firstPerson=fp!==false;visibility();if(!root.visible)return;
   elapsed=Number.isFinite(now)?Math.max(0,now)*.001:elapsed+clamp(Number.isFinite(dt)?dt:0,0,.1);
   // Points face each actual render camera, including split-screen views. A
   // single optional player position never culls atmosphere for other heroes.
   for(const b of batches){
    const data=b.positions;for(let i=0;i<b.particles.length;i++){
     const p=b.particles[i],t=elapsed*p.speed,drift=b.dust?.18:.6,dx=(Math.sin(t+p.phase)-Math.sin(p.phase))*drift,dz=(Math.cos(t*.81+p.phase)-Math.cos(p.phase))*drift*.8,r=p.room,x=clamp(p.x+dx,r.left+r.margin*.5,r.right-r.margin*.5),z=clamp(p.z+dz,r.north+r.margin*.5,r.south-r.margin*.5),rise=Math.sin(elapsed*(b.dust?.17:.11)+p.phase)* (b.dust?.14:.06);
     const px=r.accept(x,z)?x:p.x,pz=r.accept(x,z)?z:p.z;data.set([px,ground(px,pz)+p.height+rise,pz],i*3);
    }b.geometry.attributes.position.needsUpdate=true;
   }
  },
  setIntensity(value){if(Number.isFinite(value))intensity=clamp(value,0,1);applyIntensity();return intensity;},
  dispose(){if(disposed)return;retire();disposed=true;root.visible=false;root.removeFromParent();}
 };
 stats();return api;
}
