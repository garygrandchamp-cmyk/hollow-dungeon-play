// Exact bounded state search. Graph edges are directed as supplied; stair
// connections between floors are ordinary edges. No DOM or application state.
const idOK=id=>typeof id==='string'||typeof id==='number'&&Number.isFinite(id);
const countOK=n=>Number.isSafeInteger(n)&&n>0;
const bits=n=>{let c=0;while(n){n&=n-1n;c++;}return c;};

/** Named keys default reusable. key.consumable=true makes that pickup single-use;
 * door.consumable=true forces one matching named token to be spent. Silver keys
 * are always consumable. Every physical pickup is collected only once and every
 * physical door is paid only once, even when crossing back through it.
 */
export function validateDungeon(config={}) {
  config??={};
  const fail=(reason,code='INVALID_INPUT',extra={})=>({valid:false,path:[],actions:[],reason,status:'invalid',diagnostics:{code,...extra}});
  try {
    const nodes=config.nodes,rawDoors=config.doors??[];
    if(!Array.isArray(nodes)||!nodes.length)return fail('No dungeon nodes are configured.');
    if(!Array.isArray(rawDoors))return fail('Doors must be an array.');
    const nodeIndex=new Map(),doorIndex=new Map(),namedIndex=new Map();
    for(let i=0;i<nodes.length;i++){const n=nodes[i];if(!n||!idOK(n.id)||nodeIndex.has(n.id))return fail('Node ids must be unique strings or finite numbers.');nodeIndex.set(n.id,i);}
    if(!nodeIndex.has(config.start))return fail('The start node does not exist.');
    const named=id=>{if(!namedIndex.has(id))namedIndex.set(id,namedIndex.size);return namedIndex.get(id);};
    const doors=rawDoors.map((d,i)=>{
      if(!d||!idOK(d.id)||doorIndex.has(d.id))throw Error('Door ids must be unique strings or finite numbers.');doorIndex.set(d.id,i);
      if(d.kind!==undefined&&!['silver','named','free'].includes(d.kind))throw Error(`Unknown door kind for ${d.id}.`);
      const kind=d.kind??(d.keyId!==undefined?'named':'free'),keyId=d.keyId??d.id,cost=kind==='silver'?(d.cost??1):1;
      if(!countOK(cost))throw Error(`Door ${d.id} has an invalid key cost.`);
      if(kind==='named'&&!idOK(keyId))throw Error(`Door ${d.id} has an invalid named key id.`);
      return {id:d.id,kind,keyId,slot:kind==='named'?named(keyId):-1,cost,consume:d.consumable??d.consume??(d.reusable===false),free:d.locked===false||kind==='free',open:d.open===true};
    });
    let pickupCount=0;
    const sharedPickups=new Map(),pickups=nodes.map((n,node)=>{
      if(n.keys!==undefined&&!Array.isArray(n.keys))throw Error(`Keys at node ${n.id} must be an array.`);
      return (n.keys??[]).map((k,index)=>{
        if(!k||!idOK(k.id))throw Error(`Invalid key at node ${n.id}.`);
        const kind=k.kind??(k.id==='silver'?'silver':'named'),count=k.count??1;
        if(!['silver','named'].includes(kind)||!countOK(count))throw Error(`Invalid key kind/count at node ${n.id}.`);
        const consume=k.consumable??(k.reusable===false),signature=JSON.stringify([kind,k.id,count,!!consume]);
        let bit;
        if(k.pickupId!==undefined){if(!idOK(k.pickupId))throw Error('Invalid physical pickup id.');const old=sharedPickups.get(k.pickupId);if(old&&old.signature!==signature)throw Error('A shared physical pickup id has conflicting definitions.');bit=old?.bit??pickupCount++;sharedPickups.set(k.pickupId,{signature,bit});}
        else bit=pickupCount++;
        return {id:k.id,kind,count,consume:!!consume,slot:kind==='named'?named(k.id):-1,bit:1n<<BigInt(bit),node,index};
      });
    });
    const edges=nodes.map(n=>{
      if(n.neighbors!==undefined&&!Array.isArray(n.neighbors))throw Error(`Neighbors at node ${n.id} must be an array.`);
      return (n.neighbors??[]).map(raw=>{
        const e=typeof raw==='object'&&raw!==null?raw:{to:raw};
        if(!nodeIndex.has(e.to))throw Error(`Node ${n.id} references missing neighbor ${e.to}.`);
        if(e.doorId!==undefined&&!doorIndex.has(e.doorId))throw Error(`Unknown door ${e.doorId} at node ${n.id}.`);
        return {to:nodeIndex.get(e.to),door:e.doorId===undefined?-1:doorIndex.get(e.doorId),via:e.via??e.kind};
      });
    });
    const objectiveLabels=n=>Array.isArray(n.objective)?n.objective:n.objective===true?[n.id]:n.objective!==undefined&&n.objective!==false&&n.objective!==null?[n.objective]:[];
    const wanted=config.requiredObjectives??[...new Set(nodes.flatMap(objectiveLabels))];
    if(!Array.isArray(wanted)||wanted.some(id=>!idOK(id)))return fail('Required objectives must be an array of node ids or objective labels.');
    const objectives=[...new Set(wanted)],goalAt=nodes.map(()=>0n);
    for(let i=0;i<objectives.length;i++){
      const id=objectives[i],targets=nodeIndex.has(id)?[nodeIndex.get(id)]:nodes.flatMap((n,j)=>objectiveLabels(n).includes(id)?[j]:[]);
      if(!targets.length)return fail(`Required objective ${id} does not exist.`,'MISSING_OBJECTIVE');
      for(const j of targets)goalAt[j]|=1n<<BigInt(i);
    }
    const allGoals=(1n<<BigInt(objectives.length))-1n,exits=new Set(nodes.flatMap((n,i)=>n.exit?[i]:[]));
    if(!exits.size&&config.requireExit!==false)return fail('No exit is configured.','MISSING_EXIT');
    const maxStates=config.maxStates??100000;
    if(!Number.isSafeInteger(maxStates)||maxStates<1||maxStates>1000000)return fail('maxStates must be an integer from 1 to 1000000.');
    // Counts stay exact safe integers, even when custom loot grants several keys.
    if(pickups.flat().reduce((n,k)=>n+k.count,0)>Number.MAX_SAFE_INTEGER)return fail('Total key count exceeds exact integer capacity.');
    function arrive(state,actions){
      for(const p of pickups[state.node])if(!(state.picked&p.bit)){
        state.picked|=p.bit;
        if(p.kind==='silver')state.silver+=p.count;else(state[p.consume?'consumable':'reusable'])[p.slot]+=p.count;
        actions.push({type:'pickup',node:nodes[state.node].id,keyId:p.id,kind:p.kind,count:p.count,consumable:p.kind==='silver'||p.consume});
      }
      const fresh=goalAt[state.node]&~state.goals;state.goals|=goalAt[state.node];
      for(let i=0;i<objectives.length;i++)if(fresh&(1n<<BigInt(i)))actions.push({type:'objective',node:nodes[state.node].id,objective:objectives[i]});
    }
    const encode=s=>[s.node,s.silver,s.reusable.join(','),s.consumable.join(','),s.picked.toString(36),s.opened.toString(36),s.goals.toString(36)].join('|');
    let opened=0n;doors.forEach((d,i)=>{if(d.open)opened|=1n<<BigInt(i);});
    const first={node:nodeIndex.get(config.start),silver:0,reusable:Array(namedIndex.size).fill(0),consumable:Array(namedIndex.size).fill(0),picked:0n,opened,goals:0n,parent:-1,actions:[{type:'start',node:config.start}]};
    arrive(first,first.actions);
    const states=[first],seen=new Set([encode(first)]),reachable=new Set([first.node]),blocked=new Map(),frontier=new Map();let cursor=0,best=0,limited=false;
    const bucket=s=>s.node+'|'+s.picked.toString(36);
    const dominates=(a,b)=>a.silver>=b.silver&&(a.opened|b.opened)===a.opened&&(a.goals|b.goals)===a.goals&&a.reusable.every((n,i)=>n>=b.reusable[i])&&a.consumable.every((n,i)=>n>=b.consumable[i]);
    frontier.set(bucket(first),[0]);
    const reconstruct=index=>{const path=[],actions=[],chain=[];while(index>=0){chain.push(states[index]);index=states[index].parent;}chain.reverse();for(const state of chain){path.push(nodes[state.node].id);actions.push(...state.actions);}return {path,actions};};
    while(cursor<states.length){
      const state=states[cursor];
      if(state.goals===allGoals&&(!exits.size||exits.has(state.node))){const route=reconstruct(cursor);if(exits.has(state.node))route.actions.push({type:'exit',node:nodes[state.node].id});return {valid:true,...route,reason:null,status:'valid',diagnostics:{code:'COMPLETE',exploredStates:cursor+1,queuedStates:states.length}};}
      if(bits(state.goals)>bits(states[best].goals))best=cursor;
      for(const e of edges[state.node]){
        const next={...state,node:e.to,reusable:state.reusable.slice(),consumable:state.consumable.slice(),parent:cursor,actions:[]};
        if(e.door>=0&&!(state.opened&(1n<<BigInt(e.door)))){
          const d=doors[e.door];let consumed=false;
          if(!d.free){
            if(d.kind==='silver'){
              if(next.silver<d.cost){blocked.set(d.id,{doorId:d.id,kind:d.kind,keyId:'silver',needed:d.cost,available:next.silver});continue;}
              next.silver-=d.cost;consumed=true;
            }else if(d.kind==='named'){
              const r=next.reusable[d.slot],c=next.consumable[d.slot];
              if(!r&&!c){blocked.set(d.id,{doorId:d.id,kind:d.kind,keyId:d.keyId,needed:1,available:0});continue;}
              // Spending a consumable first preserves an indefinitely reusable key.
              if(d.consume||!r){if(c)next.consumable[d.slot]--;else next.reusable[d.slot]--;consumed=true;}
            }
          }
          next.opened|=1n<<BigInt(e.door);
          next.actions.push({type:'unlock',doorId:d.id,kind:d.kind,keyId:d.kind==='silver'?'silver':d.keyId,consumed:consumed?(d.kind==='silver'?d.cost:1):0,from:nodes[state.node].id,to:nodes[e.to].id});
        }
        next.actions.push({type:'move',from:nodes[state.node].id,to:nodes[e.to].id,...(e.door>=0?{doorId:doors[e.door].id}:{}),...(e.via?{via:e.via}:{})});
        arrive(next,next.actions);const signature=encode(next);if(seen.has(signature))continue;
        const group=frontier.get(bucket(next))??[];
        // Equal physical pickup history is essential: extra uncollected keys in
        // another state can be valuable later, so never dominate across it.
        if(group.some(index=>dominates(states[index],next)))continue;
        if(states.length>=maxStates){limited=true;continue;}
        seen.add(signature);reachable.add(next.node);frontier.set(bucket(next),[...group.filter(index=>!dominates(next,states[index])),states.length]);states.push(next);
      }
      cursor++;
    }
    const partial=reconstruct(best),diagnostics={code:limited?'LIMIT_REACHED':'NO_VALID_SEQUENCE',exploredStates:states.length,blockedDoors:[...blocked.values()],reachableNodes:[...reachable].map(i=>nodes[i].id),bestObjectives:bits(states[best].goals),requiredObjectives:objectives.length,partialPath:partial.path,partialActions:partial.actions};
    if(limited)return {...fail('Validation state limit reached; completion is unknown. Increase maxStates or simplify the layout.','LIMIT_REACHED'),status:'unknown',diagnostics};
    // Necessary-dependency diagnosis with every OTHER lock relaxed. If a key is
    // still unreachable without its own door, no resource ordering can fix it.
    const relaxed=excluded=>{const found=new Set([first.node]),queue=[first.node];for(let i=0;i<queue.length;i++)for(const e of edges[queue[i]])if(e.door!==excluded&&!found.has(e.to)){found.add(e.to);queue.push(e.to);}return found;};
    const selfLocks=[],missingKeys=[];
    for(let i=0;i<doors.length;i++){
      const d=doors[i];if(d.free||d.open)continue;
      const without=relaxed(i),matching=pickups.flat().filter(k=>d.kind==='silver'?k.kind==='silver':k.kind==='named'&&k.id===d.keyId);
      if(!matching.length){missingKeys.push({doorId:d.id,keyId:d.kind==='silver'?'silver':d.keyId});continue;}
      const physical=new Map();for(const k of matching){const id=k.bit.toString(),old=physical.get(id);if(!old)physical.set(id,{count:k.count,accessible:without.has(k.node)});else old.accessible||=without.has(k.node);}
      const accessible=[...physical.values()].filter(k=>k.accessible).reduce((n,k)=>n+k.count,0);
      if(accessible<(d.kind==='silver'?d.cost:1))selfLocks.push({doorId:d.id,keyId:d.kind==='silver'?'silver':d.keyId,availableWithoutDoor:accessible});
    }
    diagnostics.selfLocks=selfLocks;diagnostics.missingKeys=missingKeys;
    const fullyRelaxed=relaxed(-2),disconnected=objectives.filter((id,i)=>!nodes.some((n,j)=>fullyRelaxed.has(j)&&(goalAt[j]&(1n<<BigInt(i)))));
    diagnostics.disconnectedObjectives=disconnected;
    diagnostics.exitDisconnected=exits.size>0&&![...exits].some(i=>fullyRelaxed.has(i));
    let reason='No single valid sequence reaches every required objective and an exit. Check one-way connections and consumable key order; a key cannot be spent twice.';
    if(disconnected.length||diagnostics.exitDisconnected){diagnostics.code='DISCONNECTED';reason='Required objective or exit is disconnected even when all doors are open.';}
    else if(selfLocks.length){diagnostics.code='KEY_BEHIND_OWN_LOCK';reason=`Key ${selfLocks[0].keyId} is behind its own locked door ${selfLocks[0].doorId}, or too few copies are obtainable before that door.`;}
    else if(missingKeys.length){diagnostics.code='MISSING_KEY';reason=`Locked door ${missingKeys[0].doorId} requires missing key ${missingKeys[0].keyId}.`;}
    return {valid:false,path:[],actions:[],reason,status:'invalid',diagnostics};
  }catch(error){return fail(error instanceof Error?error.message:'Invalid dungeon configuration.');}
}
