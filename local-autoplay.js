export const LOCAL_TEST_MODES = Object.freeze(['manual','adventurer','dm']);
const alive=a=>a&&a.alive!==false&&!a.fainted&&!a.escaped&&a.health>0;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const point=id=>{const [floor,index]=String(id).split(':').map(Number);return {floor,index};};
// Movement arrival and route advancement must agree; a wider movement stop
// radius leaves a permanent dead zone before the route cursor can advance.
const ARRIVAL_RADIUS=.55;

export function findBotPath(start,goal,neighbors,limit=1024){
  if(start===goal)return [start];
  const previous=new Map([[start,null]]),queue=[start];
  for(let head=0;head<queue.length&&head<limit;head++)for(const next of neighbors(queue[head])){
    if(previous.has(next))continue;previous.set(next,queue[head]);
    if(next===goal){const path=[];for(let i=next;i!==null;i=previous.get(i))path.push(i);return path.reverse();}
    queue.push(next);
  }
  return null;
}

// Bounded local detour, not another dungeon route search. Every short edge is
// sampled through the host's capsule/support query so a thin wall or bookcase
// cannot be crossed by jumping between otherwise clear grid endpoints.
export function findBotWalkPath(start,goal,canStand,{step=.6,margin=1.8,limit=192,canTraverse}={}){
 const clear=(a,b)=>{if(canTraverse)return canTraverse(a,b);const n=Math.max(1,Math.ceil(distance(a,b)/.15));for(let i=1;i<=n;i++){const t=i/n;if(!canStand({x:a.x+(b.x-a.x)*t,y:start.y??0,z:a.z+(b.z-a.z)*t}))return false;}return true;};
 if(clear(start,goal))return [start,goal];if(!canStand(goal))return null;
 // Most room obstructions are a single cabinet/bookcase. Try a few fully
 // checked side lanes first, keeping the rare grid search off ordinary frames.
 const length=distance(start,goal),sideX=length>0?-(goal.z-start.z)/length:1,sideZ=length>0?(goal.x-start.x)/length:0;
 for(const width of [.9,1.2,1.8])for(const sign of [1,-1]){
  if(width>margin)continue;const a={x:start.x+sideX*width*sign,y:start.y??0,z:start.z+sideZ*width*sign},b={x:goal.x+sideX*width*sign,y:start.y??0,z:goal.z+sideZ*width*sign};
  if(clear(start,a)&&clear(a,b)&&clear(b,goal))return [start,a,b,goal];
 }
 const left=Math.min(start.x,goal.x)-margin,right=Math.max(start.x,goal.x)+margin,north=Math.min(start.z,goal.z)-margin,south=Math.max(start.z,goal.z)+margin;
 const records=new Map([['0:0',{x:0,z:0,position:start,g:0,f:distance(start,goal),previous:null}]]),open=new Set(['0:0']),closed=new Set();
 for(let count=0;open.size&&count<limit;count++){
  let id;for(const key of open)if(id===undefined||records.get(key).f<records.get(id).f)id=key;const node=records.get(id);open.delete(id);closed.add(id);
  if(distance(node.position,goal)<=step*1.5&&clear(node.position,goal)){const result=[goal];for(let at=id;at!==null;at=records.get(at).previous)result.push(records.get(at).position);return result.reverse();}
  for(const [dx,dz]of [[0,-1],[1,0],[0,1],[-1,0],[-1,-1],[1,-1],[1,1],[-1,1]]){
   const x=node.x+dx,z=node.z+dz,key=x+':'+z;if(closed.has(key))continue;const position={x:start.x+x*step,y:start.y??0,z:start.z+z*step};if(position.x<left||position.x>right||position.z<north||position.z>south)continue;
   const g=node.g+Math.hypot(dx,dz)*step,previous=records.get(key);if(previous&&previous.g<=g||!clear(node.position,position))continue;
   records.set(key,{x,z,position,g,f:g+distance(position,goal),previous:id});open.add(key);
  }
 }
 return null;
}

// Local testing controller. It emits ordinary input/actions; it never assigns
// health, stamina, loot, keys, resources, positions or run outcomes.
// Optional adapter.canTraverse(bot,from,to) is a pure, sampled normal movement
// query (including capsule/support/edge/prop checks), returning a boolean. It
// enables cached local detours and reachable centre alternatives;
// every resulting move still goes through the ordinary movement adapter.
export function createLocalAutoplay(adapter){
  let mode='manual',paused=false,humanId='hero-1',route=[],cursor=0,signature='',prepared='',think=0,dmTime=0;
  let inputs={},botIds=[],status='Manual party';const cooldowns=new Map(),steering=new Map(),paths=new Map();let pathClock=0;
  const waypoints=new Map(),walkPaths=new Map();
  const navigates=()=>typeof adapter.canTraverse==='function'||typeof adapter.canStand==='function';
  const traverse=(bot,a,b)=>{try{return adapter.canTraverse(bot,a,b)===true;}catch{return false;}};
  const stand=(bot,p)=>{if(typeof adapter.canTraverse==='function')return traverse(bot,p,p);try{return adapter.canStand(bot,p)===true;}catch{return false;}};
  function waypoint(bot,index,floor){
    const centre=adapter.position(index);if(!navigates())return {position:centre,radius:ARRIVAL_RADIUS};
    const key=floor+':'+index+':'+Math.round((bot.position.y??0)*4),cached=waypoints.get(bot.id);if(cached?.key===key&&pathClock<cached.until)return cached.value;
    const position={x:centre.x,y:bot.position.y??0,z:centre.z};let value=null;
    if(stand(bot,position)||typeof adapter.canTraverse==='function'&&traverse(bot,bot.position,position))value={position,radius:ARRIVAL_RADIUS};
    else{
      let score=Infinity;for(const radius of [.6,.9,1.05])for(let i=0;i<16;i++){
        const angle=i*Math.PI/8,p={x:centre.x+Math.cos(angle)*radius,y:position.y,z:centre.z+Math.sin(angle)*radius},rank=distance(bot.position,p)+radius*.15;
        if(rank<score&&stand(bot,p)){score=rank;value={position:p,radius:Math.min(.2,1.15-radius)};}
      }
    }
    waypoints.set(bot.id,{key,value,until:pathClock+1});return value;
  }
  const reached=(bot,index,floor)=>{const target=waypoint(bot,index,floor);return target&&bot.index===index&&distance(bot.position,target.position)<target.radius;};
  function walkAim(bot,target,floor){
    if(!navigates())return target;
    const key=floor+':'+target.x.toFixed(2)+':'+target.z.toFixed(2)+':'+Math.round((bot.position.y??0)*4);let cached=walkPaths.get(bot.id);
    if(cached?.key!==key||pathClock>=cached.until){const route=findBotWalkPath({x:bot.position.x,y:bot.position.y??0,z:bot.position.z},target,p=>stand(bot,p),{canTraverse:typeof adapter.canTraverse==='function'?(a,b)=>traverse(bot,a,b):undefined});cached={key,route,cursor:1,until:pathClock+(route?1:.5)};walkPaths.set(bot.id,cached);}
    if(!cached.route)return null;while(cached.cursor<cached.route.length-1&&distance(bot.position,cached.route[cached.cursor])<.18)cached.cursor++;return cached.route[cached.cursor];
  }
  function setMode(value){if(!LOCAL_TEST_MODES.includes(value))throw RangeError('Unknown local test mode');mode=value;paused=false;route=[];cursor=0;signature='';prepared='';inputs={};cooldowns.clear();dmTime=0;}
  function resetRoute(path=[]){route=path.map(point);cursor=0;inputs={};cooldowns.clear();steering.clear();paths.clear();waypoints.clear();walkPaths.clear();pathClock=0;dmTime=0;think=0;}
  function tick(dt){
    const s=adapter.state();dt=Number.isFinite(dt)?Math.min(.1,Math.max(0,dt)):0;
    inputs={};botIds=[];pathClock+=dt;
    if(mode==='manual'||!s.enabled||s.networked){status=s.networked?'Bots disabled during network play':'Manual party';return snapshot();}
    if(s.focusedId&&s.focusedId!=='dm')humanId=s.focusedId;
    const controlled=mode==='adventurer'?humanId:s.focusedId==='dm'?null:s.focusedId;
    const bots=s.actors.filter(a=>alive(a)&&a.id!==controlled);botIds=bots.map(a=>a.id);
    if(paused||s.busy){status=paused?'Automation paused':'Automation waiting for menu / dungeon';return snapshot();}
    const key=s.seed+':'+s.runNumber;
    if(signature!==key){signature=key;resetRoute();}
    if(s.phase==='lobby'){
      status=mode==='adventurer'?'AI DM ready; choose loadout, then Start expedition':'Build as DM, validate, then Start expedition';
      const setupKey=s.seed+':'+(s.generation??0);
      if(mode==='adventurer'&&prepared!==setupKey){prepared=setupKey;adapter.prepareDM?.();}
      return snapshot();
    }
    if(s.phase!=='active'){status='Expedition ended — choose Next expedition';return snapshot();}
    if(!route.length){const result=adapter.plan?.();if(result?.valid)resetRoute(result.path);}
    for(const [id,time]of cooldowns)cooldowns.set(id,Math.max(0,time-dt));
    if(mode==='adventurer'){dmTime+=dt;if(dmTime>=10){dmTime=0;adapter.liveDM?.();}}
    const leader=bots[0],human=s.actors.find(a=>a.id===controlled),follow=alive(human)?human:null;
    if(!leader){status='No living bot adventurers';return snapshot();}
    // This test navigator knows the validated route. Physical movement, locked
    // doors and attacks still go through exactly the player's runtime rules.
    let destination=null;
    if(!follow&&route.length){
      while(cursor<route.length-1&&route[cursor].floor===s.floor&&reached(leader,route[cursor].index,s.floor))cursor++;
      destination=route[cursor];
    }
    think+=dt;const decide=think>=.15;if(decide)think=0;let blocked=false;
    for(const bot of bots){
      const ready=(cooldowns.get(bot.id)??0)<=0;
      const enemy=adapter.enemy?.(bot);
      let goal=follow?{floor:s.floor,index:follow.index}:destination;
      if(bot!==leader&&!follow&&distance(bot.position,leader.position)>1.3)goal={floor:s.floor,index:leader.index};
      if(enemy){
        adapter.face(bot,enemy.position);
        if(ready&&decide&&adapter.attack?.(bot,enemy)){cooldowns.set(bot.id,.85);continue;}
        if(enemy.distance>1.5)goal={floor:s.floor,index:enemy.index};else continue;
      }
      if(!goal)continue;
      if(goal.floor!==s.floor){
        const stairs=adapter.stairs();goal={floor:s.floor,index:stairs};
        if(bot.index===stairs&&ready&&s.actors.filter(alive).every(a=>distance(a.position,adapter.position(stairs))<4.5)){
          adapter.action(bot,'interact');cooldowns.set(bot.id,1);if(adapter.state().floor!==s.floor)return {...snapshot(),inputs:{}};
        }
      }
      const target=waypoint(bot,goal.index,s.floor);if(!target){blocked=true;continue;}
      if(!enemy&&bot.index===goal.index&&distance(bot.position,target.position)<target.radius){
        if(s.complete&&bot.index===adapter.exit()&&ready){adapter.action(bot,'interact');cooldowns.set(bot.id,1);}
        continue;
      }
      const pathKey=s.floor+':'+bot.index+':'+goal.index,cached=paths.get(bot.id);let path;if(cached?.key===pathKey&&pathClock<cached.until)path=cached.path;else{path=findBotPath(bot.index,goal.index,adapter.neighbors);paths.set(bot.id,{key:pathKey,path,until:pathClock+.3});}
      if(!path){blocked=true;continue;}
      // A visible foe can share a 4.8m cell while still being outside weapon
      // reach. Its actual position remains the aim once no tile step is left.
      const next=path[1]??goal.index;adapter.face(bot,adapter.position(next));
      if(next!==bot.index&&adapter.closedDoor(bot.index,next)){
        if(ready&&decide&&adapter.canOpenDoor?.(bot.index,next)!==false){adapter.action(bot,'interact');cooldowns.set(bot.id,1);}
        continue;
      }
      // Human companions stop nearby instead of constantly pushing the player.
      if(follow&&!enemy&&distance(bot.position,follow.position)<1.6)continue;
      let targetPoint=waypoint(bot,next,s.floor)?.position;if(enemy&&next===bot.index){const gap=distance(bot.position,enemy.position),fraction=Math.max(0,gap-1.4)/Math.max(.001,gap);targetPoint={x:bot.position.x+(enemy.position.x-bot.position.x)*fraction,y:bot.position.y??0,z:bot.position.z+(enemy.position.z-bot.position.z)*fraction};}
      const aim=targetPoint&&walkAim(bot,targetPoint,s.floor);if(!aim){blocked=true;continue;}adapter.face(bot,aim);
      const previous=steering.get(bot.id),stuck=previous&&distance(previous,bot.position)<.002?previous.stuck+dt:0;
      steering.set(bot.id,{x:bot.position.x,z:bot.position.z,stuck});
      inputs[bot.id]={forward:Math.min(1,distance(bot.position,aim)/.5),side:0};
      if(stuck>.8){inputs[bot.id].forward=.5;inputs[bot.id].side=Math.floor(stuck/2)%2?.8:-.8;}
    }
    status=(mode==='adventurer'?'AI DM + bot companions':'Bot expedition')+(controlled?' · '+controlled+' manual control':'')+' · '+(route.length?'route '+Math.min(cursor+1,route.length)+' / '+route.length:'no completion route')+(blocked?' · route blocked — inspect dungeon or take control':'');
    return snapshot();
  }
  function snapshot(){return {mode,paused,inputs,botIds,status};}
  return {setMode,resetRoute,tick,snapshot,togglePause(){paused=!paused;inputs={};return paused;}};
}
