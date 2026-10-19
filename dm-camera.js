import {roomCells} from './room-footprint.js?v=5d7531948dcd036925fc96b539d81165ba86fa3a';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
/** Local presentation state only; never writes dungeon/actor/network state. */
export function createDMCameraNavigation(THREE,{getBounds=()=>({size:18,moduleSize:4.8})}={}){
 const target=new THREE.Vector3(),ray=new THREE.Raycaster(),plane=new THREE.Plane(),a=new THREE.Vector3(),b=new THREE.Vector3();
 let angle=.7,elevation=.76,zoom=1,mode='orbit',overhead=false,focusSpan=null,key;
 function bounds(){const raw=getBounds()??{},size=Number.isInteger(raw.size)&&raw.size>0?raw.size:18,moduleSize=Number.isFinite(raw.moduleSize)&&raw.moduleSize>0?raw.moduleSize:4.8,nextKey=raw.key??size+':'+moduleSize;if(key!==nextKey){key=nextKey;reset();}return {size,moduleSize,span:size*moduleSize};}
 function reset(){target.set(0,0,0);angle=.7;elevation=.76;zoom=1;overhead=false;focusSpan=null;}
 function apply(camera,rect){const {span}=bounds(),aspect=Math.max(.1,rect.width/Math.max(1,rect.height)),extent=focusSpan??span;camera.aspect=aspect;camera.fov=36;camera.clearViewOffset?.();
  const distance=Math.max(3,overhead?extent/(2*Math.tan(Math.PI/10))*1.15*zoom*Math.max(1,1/aspect):extent*2.14*zoom*Math.max(1,1.3/aspect));
  if(overhead){camera.up.set(0,0,-1);camera.position.set(target.x,target.y+distance,target.z);}else{camera.up.set(0,1,0);camera.position.set(target.x+Math.sin(angle)*Math.cos(elevation)*distance,target.y+Math.sin(elevation)*distance,target.z+Math.cos(angle)*Math.cos(elevation)*distance);}
  camera.far=Math.max(600,distance*3);camera.lookAt(target);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);return camera;
 }
 function pan(dx,dy,camera,rect){if(![dx,dy,rect?.width,rect?.height].every(Number.isFinite)||rect.width<=0||rect.height<=0)return false;
  const {span}=bounds();plane.set(new THREE.Vector3(0,1,0),-target.y);camera.updateMatrixWorld(true);ray.setFromCamera(new THREE.Vector2(0,0),camera);if(!ray.ray.intersectPlane(plane,a))return false;ray.setFromCamera(new THREE.Vector2(dx*2/rect.width,-dy*2/rect.height),camera);if(!ray.ray.intersectPlane(plane,b))return false;
  target.x=clamp(target.x+a.x-b.x,-span,span);target.z=clamp(target.z+a.z-b.z,-span,span);return true;
 }
 function focusRoom(room){const {size,moduleSize}=bounds(),cells=roomCells(room);if(!cells.length)return false;const xs=cells.map(p=>p.x),zs=cells.map(p=>p.z),left=Math.min(...xs),right=Math.max(...xs),north=Math.min(...zs),south=Math.max(...zs);target.set(((left+right)/2-(size-1)/2)*moduleSize,0,((north+south)/2-(size-1)/2)*moduleSize);focusSpan=Math.max(right-left+1,south-north+1)*moduleSize+2;zoom=1;overhead=true;return true;}
 return {apply,pan,focusRoom,reset,orbit(dx,dy=0){bounds();if(![dx,dy].every(Number.isFinite))return false;overhead=false;angle+=dx*.006;elevation=clamp(elevation+dy*.004,.4,1.45);return true;},zoomBy(factor){bounds();if(Number.isFinite(factor)&&factor>0)zoom=clamp(zoom*factor,.08,4);},setMode(value){if(['orbit','pan'].includes(value))mode=value;},get mode(){return mode;},get state(){return {angle,elevation,zoom,mode,overhead,focusSpan,target:target.toArray()};}};
}
