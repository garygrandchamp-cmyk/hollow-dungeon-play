// Host-owned rat job. Cargo is bounded simulation data, never an inventory item.
export function parseRatCargo(value,type){
 if(value===undefined)return undefined;
 if(type!=='rat'||!value||typeof value.ownerId!=='string'||!/^hero-[123]$|^solo$/.test(value.ownerId)||!Number.isInteger(value.amount)||value.amount<1||value.amount>12||!Number.isFinite(value.remaining)||value.remaining<0||value.remaining>6)throw TypeError('Invalid stolen rat purse');
 return {ownerId:value.ownerId,amount:value.amount,remaining:value.remaining};
}
export function stealRatGold(enemy,victim,{landed=false,blocked=false,ownerId=victim?.id}={}){
 if(enemy.type!=='rat'||enemy.boss||enemy.controlled||enemy.cargo||enemy.hp<=0||!landed||blocked||!victim||victim.alive===false||victim.fainted||victim.escaped||!Number.isFinite(victim.health)||victim.health<=0||!Number.isFinite(victim.gold)||victim.gold<1||!/^hero-[123]$|^solo$/.test(ownerId))return 0;
 const amount=Math.min(12,Math.floor(victim.gold));
 victim.gold-=amount;enemy.cargo={ownerId,amount,remaining:6};enemy.intent=null;enemy.target=null;return amount;
}
export function recoverRatGold(enemy){const cargo=enemy.cargo;if(!cargo)return null;delete enemy.cargo;enemy.target=null;return {...cargo};}

/** Run toward a farther reachable tile for six simulation seconds, then hide.
 * Four-neighbor choice only; actual movement still uses swept world collision. */
export function tickRatScavenger(enemy,{dt,size,coord,threats,canCross,move}){
 if(!enemy.cargo||enemy.type!=='rat'||enemy.hp<=0)return false;
 dt=Math.max(0,Math.min(.1,Number.isFinite(dt)?dt:0));enemy.cargo.remaining=Math.max(0,enemy.cargo.remaining-dt);
 if(enemy.cargo.remaining===0||!threats.length){enemy.target=null;return true;}
 const p=enemy.position;
 if(enemy.target&&Math.hypot(enemy.target.position.x-p.x,enemy.target.position.z-p.z)<.16)enemy.target=null;
 if(!enemy.target){
  const score=(x,z)=>Math.min(...threats.map(t=>(t.x-x)**2+(t.z-z)**2));
  let best=score(p.x,p.z),choice=null;const x=enemy.index%size,z=Math.floor(enemy.index/size);
  for(const [dx,dz]of [[0,-1],[1,0],[0,1],[-1,0]]){
   const xx=x+dx,zz=z+dz,j=zz*size+xx;if(xx<0||zz<0||xx>=size||zz>=size||!canCross(enemy.index,j))continue;
   const [cx,cz]=coord(j),value=score(cx,cz);if(value>best+.01){best=value;choice={index:j,position:{x:cx,y:p.y,z:cz}};}
  }
  enemy.target=choice;
 }
 if(enemy.target){const dx=enemy.target.position.x-p.x,dz=enemy.target.position.z-p.z,length=Math.hypot(dx,dz),step=Math.min(length,Math.max(0,Math.min(.1,dt))*1.65);if(length>.001&&!move(dx/length*step,dz/length*step,.18))enemy.target=null;}
 return true;
}
