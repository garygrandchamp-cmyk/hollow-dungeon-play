// Ordinary kill currency is physical loot. The dead enemy keeps its claimed
// receipt, so rebuilds, corpse retrieval and repeated snapshots cannot mint it.
const data=(value,keys)=>value&&typeof value==='object'&&[Object.prototype,null].includes(Object.getPrototypeOf(value))&&Reflect.ownKeys(value).length===keys.length&&keys.every(key=>{const d=Object.getOwnPropertyDescriptor(value,key);return d?.enumerable&&Object.hasOwn(d,'value');});
const point=p=>data(p,['x','y','z'])&&['x','y','z'].every(k=>Number.isFinite(p[k])&&Math.abs(p[k])<=1e6);

export function parseEnemyDrop(value,hp){
 if(!data(value,['version','position','amount','claimed'])||value.version!==1||!point(value.position)||!Number.isSafeInteger(value.amount)||value.amount<1||value.amount>1e6||typeof value.claimed!=='boolean'||!Number.isFinite(hp)||hp>0)throw TypeError('Invalid enemy ground drop.');
 return {version:1,position:{...value.position},amount:value.amount,claimed:value.claimed};
}
export function createEnemyDrop(position,amount=15){return parseEnemyDrop({version:1,position:{x:position.x,y:position.y,z:position.z},amount,claimed:false},0);}

export function nearestEnemyDrop(enemies,{position,canReach}={}){
 if(!point({x:position?.x,y:position?.y,z:position?.z})||typeof canReach!=='function')return null;
 let nearest=null,best=Infinity;
 for(const enemy of enemies){
  const drop=enemy.drop;if(!drop||drop.claimed||enemy.hp>0)continue;
  const distance=Math.hypot(position.x-drop.position.x,position.z-drop.position.z);
  if(distance>1.8||Math.abs(position.y-drop.position.y)>.45||distance>best||distance===best&&nearest&&enemy.id>=nearest.id)continue;
  let clear=false;try{clear=canReach(drop.position)===true;}catch{}
  if(clear){nearest=enemy;best=distance;}
 }
 return nearest;
}

export function claimEnemyDrop(enemy,grant){
 if(!enemy?.drop||enemy.hp>0||enemy.drop.claimed)return false;
 // Lock before invoking the synchronous host grant, including reentrant calls.
 const drop=enemy.drop;drop.claimed=true;
 try{if(grant(drop.amount)===true)return true;drop.claimed=false;return false;}catch{return false;}
}

export function makeEnemyDropVisual(THREE){
 const group=new THREE.Group();group.name='enemy-ground-drop';group.userData.dynamic=true;
 const leather=new THREE.MeshStandardMaterial({color:0x51402d,roughness:1}),coin=new THREE.MeshStandardMaterial({color:0x9a8250,roughness:.9,metalness:.25});
 const sack=new THREE.Mesh(new THREE.IcosahedronGeometry(.19,1),leather);sack.scale.set(1,.75,.85);sack.position.y=.15;sack.userData.ownGeometry=true;group.add(sack);
 for(const [x,z]of [[.2,.1],[.27,-.02],[.16,-.13]]){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,.025,8),coin);mesh.position.set(x,.025,z);mesh.userData.ownGeometry=true;group.add(mesh);}
 let disposed=false;group.userData.disposeMaterials=()=>{if(disposed)return;disposed=true;leather.dispose();coin.dispose();};
 return group;
}
