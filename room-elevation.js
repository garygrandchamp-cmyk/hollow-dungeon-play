import {roomContainsCell} from './room-footprint.js?v=0b2a2cafb09c29e935e1f1032140ea48989343c5';
import {batchStaticGroup} from './mesh-batch.js?v=0b2a2cafb09c29e935e1f1032140ea48989343c5';

/** Two central tile cells in each axis are lowered. Four stepped ring sides
 * stay inside those tiles, so existing room doors/perimeter remain at0m.
 */
export function createRoomElevationPlan(room,size,module=4.8,{depth=.9,stairWidth=1.6,steps=6,enabled=true,avoid=[]}={}) {
  if(!enabled||!room||![room.x,room.z,room.w,room.h,size,module].every(Number.isFinite)||room.w<4||room.h<4||module<=0)return null;
  depth=Number.isFinite(depth)?Math.max(.2,Math.min(1.5,depth)):.9;
  stairWidth=Number.isFinite(stairWidth)?Math.max(.8,Math.min(module*.7,stairWidth)):1.6;
  steps=Number.isFinite(steps)?Math.max(Math.ceil(depth/.2),Math.min(16,Math.round(steps))):6;
  const tileX=room.x+Math.floor((room.w-2)/2),tileZ=room.z+Math.floor((room.h-2)/2),left=(tileX-size/2)*module,north=(tileZ-size/2)*module,right=left+2*module,south=north+2*module;
  if(avoid.some(b=>b&&left<b.right&&right>b.left&&north<b.south&&south>b.north))return null;
  const tileIndices=[];for(let z=tileZ;z<tileZ+2;z++)for(let x=tileX;x<tileX+2;x++)tileIndices.push(z*size+x);
  return {kind:'sunken-room',left,right,north,south,depth,stairWidth,steps,tileX,tileZ,tileIndices,module,size,floorHeight:-depth};
}
/** Find a fully occupied 4×4 patch before cutting a sunken court. Its outer
 * ring remains level, so doors and concave corners never acquire hidden drops.
 * Rectangles retain their saved south-side treatment beside the gallery.
 */
export function roomElevationCore(room){
 if(!room||room.w<5||room.h<5)return null;
 if(!room.footprint)return {...room,z:room.z+room.h-4,w:4,h:4};
 const candidates=[];
 for(let row=0;row<=room.h-4;row++)for(let col=0;col<=room.w-4;col++){
  if(Array.from({length:4},(_,z)=>Array.from({length:4},(_,x)=>roomContainsCell(room,col+x,row+z)).every(Boolean)).every(Boolean))candidates.push({col,row});
 }
 candidates.sort((a,b)=>(a.col+2-room.w/2)**2+(a.row+2-room.h/2)**2-((b.col+2-room.w/2)**2+(b.row+2-room.h/2)**2)||b.row-a.row||a.col-b.col);
 const core=candidates[0];return core?{x:room.x+core.col,z:room.z+core.row,w:4,h:4}:null;
}
export const tileElevationOffset=(plans,index)=>{for(const p of plans??[])if(p?.tileIndices.includes(index))return -p.depth;return 0;};

/** Number on a supported floor/ramp, null for an invalid height jump, undefined
 * outside sunken plans. Caller composes this with gallery/ordinary ground height.
 */
export function sampleRoomElevation(plans,x,z,radius=.18) {
  if(!Number.isFinite(x)||!Number.isFinite(z))return undefined;
  radius=Number.isFinite(radius)?Math.max(0,Math.min(.5,radius)):.18;
  for(const p of plans??[]){if(!p||x<p.left-radius||x>p.right+radius||z<p.north-radius||z>p.south+radius)continue;
    // Highest point under the body disk: no feet clipping into an uphill tread.
    const inset=Math.max(0,Math.min(x-p.left,p.right-x,z-p.north,p.south-z)-radius);
    return -p.depth*Math.min(1,inset/p.stairWidth);
  }
  return undefined;
}
export function roomElevationAt(plans,x,z,previous=0,radius=.18) {
  previous=Number.isFinite(previous)?previous:0;
  const height=sampleRoomElevation(plans,x,z,radius);
  if(height!==undefined)return Math.abs(height-previous)<=.26+1e-8?height:null;
  return previous<-.26?null:undefined;
}

/** Adds/returns one batched stone stair ring. Existing central tile floors
 * should be offset using tileElevationOffset; includeFloor is useful in isolation.
 */
export function buildRoomElevation({THREE,group,mat,plan,material,includeFloor=false}={}) {
  const g=new THREE.Group();g.name='sunken-room-stair-ring';if(!plan){group?.add(g);return g;}
  const p=plan,floor=material??mat('sunkenRoomStone',0x68645e,{roughness:.98});
  function block(x,z,w,d,top,bottom){if(w<=0||d<=0||top<=bottom)return;const geometry=new THREE.BoxGeometry(w,top-bottom,d),pos=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv;
    for(let i=0;i<pos.count;i++){const xx=pos.getX(i)+x,zz=pos.getZ(i)+z,yy=pos.getY(i)+(top+bottom)/2;uv.setXY(i,(Math.abs(n.getX(i))>.5?zz:xx)/2,(Math.abs(n.getY(i))>.5?zz:yy)/2);}
    const mesh=new THREE.Mesh(geometry,floor);mesh.position.set(x,(top+bottom)/2,z);mesh.userData.ownGeometry=true;mesh.castShadow=mesh.receiveShadow=true;g.add(mesh);
  }
  if(includeFloor)block((p.left+p.right)/2,(p.north+p.south)/2,p.right-p.left,p.south-p.north,-p.depth,-p.depth-.16);
  for(let i=0;i<p.steps;i++){
    const outer=p.stairWidth*i/p.steps,inner=p.stairWidth*(i+1)/p.steps,thickness=inner-outer,top=-p.depth*i/p.steps,bottom=-p.depth;
    const l=p.left+outer,r=p.right-outer,n=p.north+outer,s=p.south-outer;
    block((l+r)/2,n+thickness/2,r-l,thickness,top,bottom);
    block((l+r)/2,s-thickness/2,r-l,thickness,top,bottom);
    block(l+thickness/2,(n+s)/2,thickness,s-n-2*thickness,top,bottom);
    block(r-thickness/2,(n+s)/2,thickness,s-n-2*thickness,top,bottom);
  }
  batchStaticGroup(THREE,g);group?.add(g);return g;
}
export const buildSunkenRoom=buildRoomElevation;
