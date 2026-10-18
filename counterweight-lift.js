export const LIFT_ACTIONS=Object.freeze(['lift-hold','lift-latch','lift-release','lift-lower']);
export const LIFT_SPEED=.85,LIFT_JAM_COST=8;
const live=a=>a&&a.alive!==false&&!a.fainted&&!a.escaped&&a.health>0;
const fresh=()=>({height:0,target:0,holder:null,automatic:false,boarding:0,jam:0,cooldown:0,serial:0,blocked:false});
export function planCounterweightLift({gallery,room,size,floor=0,reserved=[]}){
 if(!gallery||!room||room.footprint)return null;const g=gallery,cx=g.right-g.width-1.25;
 for(let cz=g.north+g.width+3;cz<g.south-3;cz+=2.4){
  const control={x:cx-2,z:cz-2},upper={x:cx+2,z:cz},indices=new Set();
  for(let x=cx-3;x<=cx+2.6;x+=.6)for(let z=cz-3;z<=cz+2;z+=.6){const col=Math.floor(x/4.8+size/2),row=Math.floor(z/4.8+size/2);indices.add(row*size+col);}
  if([...indices].some(i=>reserved.includes(i)))continue;
  return {id:`lift:${floor}:${room.x}:${room.z}:${Math.round(cz*10)}`,floor,room,cx,cz,width:2.5,height:g.height,control,upper,reserved:[...indices],gap:{from:cz-1.4,to:cz+1.4},gallery:g};
 }return null;
}
export const onLift=(p,a,height,radius=.18)=>!!p&&a?.position&&Math.abs(a.position.y-height)<.18&&Math.abs(a.position.x-p.cx)<=p.width/2-radius&&Math.abs(a.position.z-p.cz)<=p.width/2-radius;
export function liftSurface(p,r,x,z,previous=0,radius=.18){
 if(!p||!r||![x,z,previous].every(Number.isFinite))return undefined;
 const docked=Math.abs(r.height-p.height)<1e-7&&Math.abs(previous-p.height)<.26;if(x<p.cx-p.width/2+radius||x>p.cx+p.width/2+(docked?radius+.03:-radius)||Math.abs(z-p.cz)>p.width/2-radius)return undefined;
 if(Math.abs(previous-r.height)<=.26)return r.height;
 return undefined; // Ground underneath an elevated platform remains ordinary ground.
}
export function validateLiftSnapshot(v,seed,plans){
 if(!v||v.version!==1||v.seed!==seed||!Array.isArray(v.floors)||v.floors.length!==2)return null;
 for(let i=0;i<2;i++){const r=v.floors[i],p=plans[i];if(!r||r.id!==(p?.id??null)||!Number.isFinite(r.height)||r.height<0||r.height>(p?.height??0)||![0,1].includes(r.target)||r.holder!==null&&!/^hero-[123]$/.test(r.holder)||typeof r.automatic!=='boolean'||typeof r.blocked!=='boolean'||!Number.isFinite(r.boarding)||r.boarding<0||r.boarding>5||!Number.isFinite(r.jam)||r.jam<0||r.jam>4||!Number.isFinite(r.cooldown)||r.cooldown<0||r.cooldown>12||!Number.isSafeInteger(r.serial)||r.serial<0||r.holder&&r.automatic||r.boarding>0&&!r.automatic||!p&&(r.height||r.target||r.holder||r.automatic||r.boarding||r.jam||r.cooldown||r.serial||r.blocked))return null;}
 return v;
}
export function createCounterweightLift({state,charge=()=>false,spendDM=()=>false,notify=()=>{},clear=()=>false,sound=()=>{}}){
 let seed='',floors=[fresh(),fresh()];const current=()=>floors[state().floor],plan=()=>state().plans[state().floor];
 function reset(value=''){seed=String(value);floors=[fresh(),fresh()];}
 function near(a){const p=plan();return !!p&&live(a)&&[p.control,p.upper].some((c,i)=>Math.abs(a.position.y-(i?p.height:0))<.3&&Math.hypot(a.position.x-c.x,a.position.z-c.z)<=2&&(!state().visible||state().visible(a.position,{x:c.x,y:i?p.height:0,z:c.z})));}
 function rider(a){return live(a)&&onLift(plan(),a,current().height);}
 function release(a){const r=current();if(r.holder===a?.id){r.holder=null;notify('Winch released. The brake holds the lift.');return true;}return false;}
 function action(a,kind){const s=state(),p=plan(),r=current();if(s.remote||s.paused||s.phase!=='active'||!p||!live(a))return false;
  if(kind==='lift-release')return release(a);
  if(kind==='lift-lower'){if(!rider(a)&&!near(a))return false;r.target=0;r.automatic=true;r.holder=null;r.boarding=0;r.jam=0;r.serial++;sound(p);notify('Emergency brake released. Lowering safely; keep the shaft clear.');return true;}
  if(!near(a))return false;
  if(r.jam>0){notify('The lift is jammed. Use emergency lower to release it.');return false;}
  if(r.holder||r.automatic){notify('Release the winch or wait for the current journey.');return false;}
  if(!['lift-hold','lift-latch'].includes(kind)||!charge(a))return false;
  r.target=r.height>=p.height-.01?0:r.height<=.01?1:r.target;
  r.automatic=kind==='lift-latch';r.holder=r.automatic?null:a.id;r.boarding=r.automatic?5:0;r.serial++;r.blocked=false;sound(p);
  notify(r.automatic?'Latch armed: five seconds to board. Emergency lower is always free.':'Winch held. Stay here while a companion rides; moving or attacking releases it.');return true;
 }
 function jam(){const s=state(),r=current();if(s.remote||s.paused||s.phase!=='active'||!plan()||r.cooldown>0||!(r.holder||r.automatic)||r.boarding>0||!spendDM(LIFT_JAM_COST))return false;r.jam=4;r.cooldown=12;r.serial++;notify('The DM jams the gears for four seconds. Emergency lower releases the jam.');sound(plan());return true;}
 function tick(dt){const s=state(),p=plan(),r=current();if(!p||s.remote||s.paused||s.phase!=='active')return;dt=Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0;r.cooldown=Math.max(0,r.cooldown-dt);r.jam=Math.max(0,r.jam-dt);
  if(r.holder&&!near(s.actors.find(a=>a.id===r.holder)))r.holder=null;
  if(!(r.holder||r.automatic)||r.jam>0)return;if(r.boarding>0){r.boarding=Math.max(0,r.boarding-dt);return;}
  const end=r.target?p.height:0,diff=end-r.height;if(Math.abs(diff)<1e-7){r.height=end;r.holder=null;r.automatic=false;r.blocked=false;return;}
  const next=r.height+Math.sign(diff)*Math.min(Math.abs(diff),LIFT_SPEED*dt),riders=s.actors.filter(a=>live(a)&&onLift(p,a,r.height));
  if(!clear(p,next,r.height,riders)){if(!r.blocked)notify('Lift brake engaged: clear the shaft and landing.');r.blocked=true;return;}r.blocked=false;
  r.height=next;for(const actor of riders)actor.position.y=next;
  if(Math.abs(end-next)<1e-7){r.holder=null;r.automatic=false;notify(end?'Lift docked at the gallery.':'Lift docked at ground level.');}
 }
 function snapshot(){return {version:1,seed,floors:floors.map((r,i)=>({id:state().plans[i]?.id??null,...r}))};}
 function apply(v){if(!validateLiftSnapshot(v,seed,state().plans))return false;const s=state(),next=v.floors[s.floor];if(next.serial>current().serial)sound(plan());floors=v.floors.map(({height,target,holder,automatic,boarding,jam,cooldown,serial,blocked})=>({height,target,holder,automatic,boarding,jam,cooldown,serial,blocked}));return true;}
 return {reset,near,rider,release,action,jam,tick,snapshot,apply,get record(){return {...current()};},surface:(x,z,y,r)=>liftSurface(plan(),current(),x,z,y,r)};
}
