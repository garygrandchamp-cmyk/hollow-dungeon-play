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

// Local testing controller. It emits ordinary input/actions; it never assigns
// health, stamina, loot, keys, resources, positions or run outcomes.
export function createLocalAutoplay(adapter){
  let mode='manual',paused=false,humanId='hero-1',route=[],cursor=0,signature='',prepared='',think=0,dmTime=0;
  let inputs={},botIds=[],status='Manual party';const cooldowns=new Map(),steering=new Map(),paths=new Map();let pathClock=0;
  function setMode(value){if(!LOCAL_TEST_MODES.includes(value))throw RangeError('Unknown local test mode');mode=value;paused=false;route=[];cursor=0;signature='';prepared='';inputs={};cooldowns.clear();dmTime=0;}
  function resetRoute(path=[]){route=path.map(point);cursor=0;inputs={};cooldowns.clear();steering.clear();paths.clear();pathClock=0;dmTime=0;think=0;}
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
      while(cursor<route.length-1&&route[cursor].floor===s.floor&&distance(leader.position,adapter.position(route[cursor].index))<ARRIVAL_RADIUS)cursor++;
      destination=route[cursor];
    }
    think+=dt;const decide=think>=.15;if(decide)think=0;
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
      const target=adapter.position(goal.index);
      if(!enemy&&bot.index===goal.index&&distance(bot.position,target)<ARRIVAL_RADIUS){
        if(s.complete&&bot.index===adapter.exit()&&ready){adapter.action(bot,'interact');cooldowns.set(bot.id,1);}
        continue;
      }
      const pathKey=s.floor+':'+bot.index+':'+goal.index,cached=paths.get(bot.id);let path;if(cached?.key===pathKey&&pathClock<cached.until)path=cached.path;else{path=findBotPath(bot.index,goal.index,adapter.neighbors);paths.set(bot.id,{key:pathKey,path,until:pathClock+.3});}
      if(!path){status='Bot route blocked — inspect dungeon or take control';continue;}
      // A visible foe can share a 4.8m cell while still being outside weapon
      // reach. Its actual position remains the aim once no tile step is left.
      const next=path[1]??goal.index,aim=enemy&&next===bot.index?enemy.position:adapter.position(next);adapter.face(bot,aim);
      if(next!==bot.index&&adapter.closedDoor(bot.index,next)){
        if(ready&&decide&&adapter.canOpenDoor?.(bot.index,next)!==false){adapter.action(bot,'interact');cooldowns.set(bot.id,1);}
        continue;
      }
      // Human companions stop nearby instead of constantly pushing the player.
      if(follow&&!enemy&&distance(bot.position,follow.position)<1.6)continue;
      const previous=steering.get(bot.id),stuck=previous&&distance(previous,bot.position)<.002?previous.stuck+dt:0;
      steering.set(bot.id,{x:bot.position.x,z:bot.position.z,stuck});
      inputs[bot.id]={forward:Math.min(1,distance(bot.position,aim)/.5),side:0};
      if(stuck>.8){inputs[bot.id].forward=.5;inputs[bot.id].side=Math.floor(stuck/2)%2?.8:-.8;}
    }
    status=(mode==='adventurer'?'AI DM + bot companions':'Bot expedition')+(controlled?' · '+controlled+' manual control':'')+' · '+(route.length?'route '+Math.min(cursor+1,route.length)+' / '+route.length:'no completion route');
    return snapshot();
  }
  function snapshot(){return {mode,paused,inputs,botIds,status};}
  return {setMode,resetRoute,tick,snapshot,togglePause(){paused=!paused;inputs={};return paused;}};
}
