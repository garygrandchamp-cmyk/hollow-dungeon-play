import {batchStaticGroup} from './mesh-batch.js?v=1908281481c3818581fa62f1b68e946e615fba61';
import {createCurvedStair,curvedStairHeight,buildCurvedStair} from './gallery-curved-stair.js?v=1908281481c3818581fa62f1b68e946e615fba61';

// A room-local upper floor, independent of the dungeon's discrete floor index.
export function galleryPlan(room,size,module=4.8,enabled=true,stairStyle='straight'){
 if(!enabled||room.w<4||room.h<4)return null;
 const left=(room.x-size/2)*module+.55,right=(room.x+room.w-size/2)*module-.55;
 const north=(room.z-size/2)*module+.55,south=(room.z+room.h-size/2)*module-.55;
 const width=2.25,height=3.4,run=Math.min(11,(south-north)-width-1.4),top=north+width;
 return {left,right,north,south,width,height,stairStyle,curve:stairStyle==='curved'?createCurvedStair({left,north,width,height}):null,stair:{x:left+width/2,z0:top,z1:top+run,width},eaves:7.2};
}
// Return supported geometry separately from the ambient ground fallback. The
// movement controller uses this to avoid applying ground tile/socket masks to
// a real stair, landing, or upper deck (including the first 0cm landing).
export function gallerySurfaceAt(plans,x,z,previous=0,radius=.18){
 for(const p of plans){
  const s=p.stair,onStair=Math.abs(x-s.x)<=s.width/2-radius&&z>=s.z0&&z<=s.z1;
  const inside=x>=p.left+radius&&x<=p.right-radius&&z>=p.north+radius&&z<=p.south-radius;
  const deck=inside&&(z<=p.north+p.width-radius||x>=p.right-p.width+radius||x<=p.left+p.width-radius&&z<=s.z0);
  if(Math.abs(previous-p.height)<=.26&&(deck||inside&&Math.abs(x-s.x)<=s.width/2-radius&&z<=s.z0))return {height:p.height,kind:'deck',plan:p};
  if(p.curve){const h=curvedStairHeight(p.curve,x,z,previous,radius);if(h!==undefined)return h===null?null:{height:h,kind:'stair',plan:p};}
  if(!p.curve&&onStair){const h=p.height*(s.z1-z)/(s.z1-s.z0);return Math.abs(h-previous)<.26?{height:h,kind:'stair',plan:p}:null;}
  if(!p.curve&&Math.abs(x-s.x)<=s.width/2-radius&&z>s.z1&&z<=s.z1+.8+radius&&Math.abs(previous)<=.26)return {height:0,kind:'landing',plan:p};
  if(!p.curve&&Math.abs(x-s.x)<s.width/2+radius&&z>=s.z0&&z<=s.z1&&p.height*(s.z1-z)/(s.z1-s.z0)>previous+.26)return null;
 }
 return undefined;
}
export function galleryHeight(plans,x,z,previous=0,radius=.18){
 const surface=gallerySurfaceAt(plans,x,z,previous,radius);if(surface===null)return null;if(surface)return surface.height;
 return previous>.26?null:0;
}
export function buildGallery({THREE,world,box,mat,plan:p,surfaceMaps,floorStyle='flagstone'}){
 const g=new THREE.Group();world.add(g);const stone=mat('galleryStone',0x736859),trim=mat('galleryEdge',0x8a7a61),iron=mat('galleryIron',0x343733,{metalness:.6});
 const floor=mat('paver-gallery-'+floorStyle,0xd9d1c1,surfaceMaps?.[floorStyle]?{map:surfaceMaps[floorStyle],bumpMap:surfaceMaps[floorStyle],bumpScale:.035}:{});
 function masonryBlock(x,y,z,w,h,d,material){const geometry=new THREE.BoxGeometry(w,h,d),positions=geometry.attributes.position,normals=geometry.attributes.normal,uv=geometry.attributes.uv;for(let i=0;i<uv.count;i++){const nx=Math.abs(normals.getX(i)),ny=Math.abs(normals.getY(i));uv.setXY(i,(nx>.5?positions.getZ(i):positions.getX(i))/2,(ny>.5?positions.getZ(i):positions.getY(i))/2);}const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.userData.ownGeometry=true;mesh.castShadow=mesh.receiveShadow=true;g.add(mesh);return mesh;}
 const slab=(x,z,w,d)=>masonryBlock(x,p.height-.12,z,w,.24,d,floor);
 slab((p.left+p.right)/2,p.north+p.width/2,p.right-p.left,p.width);
 slab(p.right-p.width/2,(p.north+p.width+p.south)/2,p.width,p.south-p.north-p.width);
 const s=p.stair,n=32,run=(s.z1-s.z0)/n;
 if(!p.curve)masonryBlock(s.x,-.08,s.z1+.4,s.width,.16,.8,floor);
 if(p.curve)buildCurvedStair({THREE,group:g,box,mat,plan:p.curve});else for(let j=0;j<n;j++){const h=p.height*(j+1)/n;box(g,s.x,h/2,s.z1-(j+.5)*run,s.width,h,run+.015,stone);}
 const railing=(x1,z1,x2,z2)=>{const len=Math.hypot(x2-x1,z2-z1),steps=Math.ceil(len/.7);for(let j=0;j<=steps;j++)box(g,x1+(x2-x1)*j/steps,p.height+.5,z1+(z2-z1)*j/steps,.09,1,.09,iron);const rail=box(g,(x1+x2)/2,p.height+1,(z1+z2)/2,len,.11,.11,trim);rail.rotation.y=-Math.atan2(z2-z1,x2-x1);};
 railing(p.left+p.width,p.north+p.width,p.right-p.width,p.north+p.width);
 railing(p.right-p.width,p.north+p.width,p.right-p.width,p.south);
 railing(p.right-p.width,p.south,p.right,p.south);
 // Sloping stair handrails; the landing remains open at both ends.
 if(!p.curve)for(const sign of [-1,1]){const x=s.x+sign*s.width/2;for(let j=0;j<=12;j++){const t=j/12;box(g,x,p.height*t+.5,s.z1-(s.z1-s.z0)*t,.08,1,.08,iron);}const rail=box(g,x,p.height/2+1,(s.z0+s.z1)/2,.10,.10,Math.hypot(s.z1-s.z0,p.height),trim);rail.rotation.x=Math.atan(p.height/(s.z1-s.z0));}
 // Upper masonry is continuous: no light leaks through individual brick joints.
 const h=p.eaves-3.6;for(const x of [p.left-.3,p.right+.3])masonryBlock(x,3.6+h/2,(p.north+p.south)/2,.55,h,p.south-p.north+1.1,stone);
 for(const z of [p.north-.3,p.south+.3])masonryBlock((p.left+p.right)/2,3.6+h/2,z,p.right-p.left+1.1,h,.55,stone);
 for(let x=p.left+1;x<p.right;x+=3.2){box(g,x,5.35,p.north+.05,.26,3.4,.48,trim);box(g,x,p.height-.4,p.north+p.width-.25,.35,.7,.5,trim);}
 batchStaticGroup(THREE,g);return g;
}
