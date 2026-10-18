import {LIFT_ACTIONS} from './counterweight-lift.js?v=b7b8538579c745f26bca5629102f407c3b7f1f39';
import {CHAPEL_ACTIONS} from './bell-chapel.js?v=b7b8538579c745f26bca5629102f407c3b7f1f39';
// Host owns simulation; guests send controls, never actor state or coordinates.
export const NETWORK_ACTIONS = Object.freeze([...LIFT_ACTIONS,...CHAPEL_ACTIONS,'sluice-turn','bridge-turn','attack','cast','interact','search','search-roll','search-close','take-item','jump','block','guard','release','swap','offhand','switch-offhand','escape','use']);
const CLASSES = new Set(['mage','paladin','barbarian','warlock','thief','archer']);
const MAX_BYTES = 2 * 1024 * 1024, CHUNK = 6000, encoder = new TextEncoder();
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const finite = (x, limit) => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= limit;
const sequence = x => Number.isSafeInteger(x) && x > 0;
const keys = (x, allowed) => object(x) && Object.keys(x).every(k => allowed.includes(k));
const stampOK = x => typeof x === 'string' && /^[\w.:-]{1,128}$/.test(x);
const hash = text => { let h=2166136261; for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);} return (h>>>0).toString(16); };
function jsonSafe(value) {
  let count=0; const visit=(x,depth)=>{
    if(++count>200000 || depth>32) throw Error('Snapshot structure exceeds limits.');
    if(x===null || typeof x==='string' || typeof x==='boolean' || typeof x==='number'&&Number.isFinite(x))return;
    if(typeof x!=='object' || !Array.isArray(x)&&Object.getPrototypeOf(x)!==Object.prototype&&Object.getPrototypeOf(x)!==null)throw Error('Expected plain JSON data.');
    for(const k of Object.keys(x)){if(['__proto__','constructor','prototype'].includes(k))throw Error('Unsafe snapshot key.');visit(x[k],depth+1);}
  }; visit(value,0); return value;
}
function inputOf(input) {
  if(!keys(input,['forward','strafe','yaw','pitch','blocking','sprint']) || !finite(input.forward,1) || !finite(input.strafe,1) || !finite(input.yaw,Math.PI*2) || !finite(input.pitch,Math.PI/2) || input.blocking!==undefined&&typeof input.blocking!=='boolean' || input.sprint!==undefined&&typeof input.sprint!=='boolean')throw Error('Invalid directional input.');
  const magnitude=Math.max(1,Math.hypot(input.forward,input.strafe));
  return {forward:input.forward/magnitude,strafe:input.strafe/magnitude,yaw:input.yaw,pitch:input.pitch,blocking:input.blocking??false,sprint:input.sprint??false};
}
function loadoutOf(value) {
  if(keys(value,['slot','id'])&&['helm','chest','arms','legs','weapon','offhand'].includes(value.slot)&&typeof value.id==='string'&&/^[a-zA-Z0-9_.:-]{1,96}$/.test(value.id))return {slot:value.slot,id:value.id};
  if(!keys(value,['weapon','offhand']) || !['weapon','offhand'].every(k=>typeof value[k]==='string'&&/^[a-zA-Z0-9_.:-]{1,96}$/.test(value[k])))throw Error('Loadout must contain a valid {slot,id} or {weapon,offhand} pair.');
  return {weapon:value.weapon,offhand:value.offhand};
}

export function createNetworkGame({session,getSnapshot=()=>({world:null,state:null}),onWorld=()=>{},onState=()=>{},onInput=()=>{},onAction=()=>{},onClass=()=>{},onLoadout=()=>{},notify=()=>{},now:clock=()=>globalThis.performance?.now?.()??Date.now()}={}) {
  if(!session || !['host','guest'].includes(session.role))throw Error('Network game requires a host or guest peer session.');
  const role=session.role, peers=new Map(), bundles=new Map();let closed=false, seq=0,worldSeq=0,worldCache=null,lastStateAt=-Infinity,lastInputAt=-Infinity,lastHelloAt=-Infinity,latestInput=null,actorId=role==='host'?'dm':null,appliedStamp=null,appliedVersion=null,appliedWorldSeq=0,appliedStateSeq=0,applying=null,pendingWorld=null,pendingState=null,lastClock=clock();
  const report=message=>notify(String(message));
  const context=(slot,extra={})=>({slot,actorId:'hero-'+slot,...extra});
  const connected=slot=>Number.isInteger(slot)&&slot>=1&&slot<=3&&session.connected.includes(slot);
  function time(value=clock()){if(!Number.isFinite(value))return lastClock;lastClock=Math.max(lastClock,value);return lastClock;}
  function peer(slot){let p=peers.get(slot);if(!p){p={slot,queue:[],last:{},buckets:{},ready:null,input:null,inputAt:0};peers.set(slot,p);}return p;}
  function permit(p,kind,rate,capacity){const t=time(), b=p.buckets[kind]??{tokens:capacity,at:t};b.tokens=Math.min(capacity,b.tokens+Math.max(0,t-b.at)*rate/1000);b.at=t;p.buckets[kind]=b;if(b.tokens<1)return false;b.tokens--;return true;}
  function fresh(p,kind,value){if(!sequence(value)||value<=(p.last[kind]??0))return false;p.last[kind]=value;return true;}
  function packet(kind,data,meta={}){return {v:1,kind,seq:++seq,...meta,data};}
  function wire(value){
    jsonSafe(value);const text=JSON.stringify(value),bytes=encoder.encode(text).length;
    if(bytes>MAX_BYTES)throw Error('Network snapshot exceeds 2 MiB.');
    if(bytes<=12000)return [{type:'net',payload:value}];
    const total=Math.ceil(text.length/CHUNK),checksum=hash(text),id=value.kind+'-'+value.seq+'-'+checksum;
    return Array.from({length:total},(_,part)=>({type:'net',payload:{v:1,kind:'chunk',id,part,total,bytes,checksum,text:text.slice(part*CHUNK,(part+1)*CHUNK)}}));
  }
  function flush(p){while(!closed&&p.queue.length){const batch=p.queue[0];if(!session.send(p.slot,batch.messages[batch.index]))break;if(++batch.index===batch.messages.length)p.queue.shift();}}
  function enqueue(p,value){const messages=wire(value);if(['state','world','welcome'].includes(value.kind))p.queue=p.queue.filter(b=>b.kind!==value.kind||b.index>0);p.queue.push({kind:value.kind,messages,index:0});flush(p);}
  function sendGuest(value){const slot=session.connected[0];if(!slot||closed)return false;try{return session.send(slot,{type:'net',payload:value});}catch(error){report(error.message);return false;}}
  function snapshot(force=false){
    const result=getSnapshot();if(!object(result)||!Object.hasOwn(result,'world')||!Object.hasOwn(result,'state'))throw Error('getSnapshot must return {world,state,version?,layoutStamp?}.');
    const version=result.version??result.world?.version??1;
    if(!Number.isInteger(version)||version<1||version>65535)throw Error('Invalid world version.');
    const explicit=result.layoutStamp??result.layoutstamp??result.world?.layoutStamp;
    let stamp=explicit;
    if(explicit!==undefined&&!stampOK(explicit))throw Error('Invalid layoutStamp.');
    if(stamp===undefined){if(!force&&worldCache?.world===result.world&&worldCache.version===version)stamp=worldCache.stamp;else{jsonSafe(result.world);stamp='layout-'+hash(JSON.stringify(result.world));}}
    if(force||!worldCache||worldCache.stamp!==stamp||worldCache.version!==version){jsonSafe(result.world);worldCache={world:result.world,version,stamp,packet:packet('world',result.world,{stamp,version})};worldSeq=worldCache.packet.seq;}
    return {...result,stamp,version};
  }
  function sendWorld(p,force=false){const snap=snapshot(force);p.ready=null;p.lastWorldSeq=worldSeq;enqueue(p,packet('welcome',{actorId:'hero-'+p.slot},{stamp:snap.stamp,version:snap.version}));enqueue(p,worldCache.packet);}
  function hello(){lastHelloAt=time();return sendGuest(packet('hello',{}));}
  function applyState(value){
    if(value.stamp!==appliedStamp||value.version!==appliedVersion||value.seq<=appliedStateSeq)return;
    if(applying){if(!pendingState||value.seq>pendingState.seq)pendingState=value;return;}
    appliedStateSeq=value.seq;onState(value.data,{stamp:value.stamp,version:value.version,seq:value.seq,actorId});
  }
  function receiveGuest(value,slot){
    if(value.kind==='welcome'){
      if(!keys(value.data,['actorId'])||value.data.actorId!=='hero-'+slot)return false;
      actorId=value.data.actorId;return true;
    }
    if(!['world','state'].includes(value.kind)||!stampOK(value.stamp)||!Number.isInteger(value.version)||value.version<1||value.version>65535)return false;
    if(value.kind==='state'){applyState(value);return true;}
    if(value.seq===appliedWorldSeq&&value.stamp===appliedStamp&&value.version===appliedVersion){sendGuest(packet('ready',{stamp:appliedStamp,version:appliedVersion,worldSeq:appliedWorldSeq}));return true;}
    if(value.seq<=appliedWorldSeq||applying&&value.seq<=applying.seq)return false;
    if(applying){if(!pendingWorld||value.seq>pendingWorld.value.seq)pendingWorld={value,slot};return true;}
    const task={seq:value.seq};applying=task;pendingState=null;
    // Defer to let synchronous callers install their own adapter reference first.
    Promise.resolve().then(()=>{if(closed||applying!==task)return;return onWorld(value.data,{stamp:value.stamp,version:value.version,seq:value.seq,actorId});}).then(()=>{
      if(closed||applying!==task)return;
      appliedStamp=value.stamp;appliedVersion=value.version;appliedWorldSeq=value.seq;appliedStateSeq=value.seq;applying=null;
      if(pendingWorld){const next=pendingWorld;pendingWorld=null;receiveGuest(next.value,next.slot);return;}
      sendGuest(packet('ready',{stamp:appliedStamp,version:appliedVersion,worldSeq:appliedWorldSeq}));
      if(pendingState){const state=pendingState;pendingState=null;applyState(state);}
    }).catch(error=>{if(applying===task){applying=null;report('World could not load: '+error.message);if(pendingWorld){const next=pendingWorld;pendingWorld=null;receiveGuest(next.value,next.slot);}}});return true;
  }
  function receiveHost(value,slot){
    const p=peer(slot),meta=context(slot,{seq:value.seq});
    if(value.kind==='hello'){
      if(!keys(value.data,[])||!fresh(p,'hello',value.seq)||!permit(p,'hello',.5,2))return false;sendWorld(p);return true;
    }
    if(value.kind==='ready'){
      if(!keys(value.data,['stamp','version','worldSeq'])||value.data.stamp!==worldCache?.stamp||value.data.version!==worldCache?.version||value.data.worldSeq!==worldSeq||!fresh(p,'ready',value.seq))return false;p.ready=value.data.stamp;return true;
    }
    if(!['input','action','class','loadout'].includes(value.kind))return false;
    if(!p.ready||p.ready!==worldCache?.stamp)return false;
    if(value.kind==='input'){
      const input=inputOf(value.data);if(!fresh(p,'input',value.seq)||!permit(p,'input',30,12))return false;p.input=input;p.inputAt=time();onInput(input,meta);return true;
    }
    if(value.kind==='action'){
      if(!keys(value.data,['kind','targetId'])||!NETWORK_ACTIONS.includes(value.data.kind))return false;
      if(value.data.kind==='take-item'){if(typeof value.data.targetId!=='string'||!/^[a-zA-Z0-9_.:-]{1,128}$/.test(value.data.targetId))return false;}
      else if(Object.hasOwn(value.data,'targetId'))return false;
      if(!fresh(p,'action',value.seq)||!permit(p,'action',8,6))return false;if(value.data.kind==='take-item')meta.targetId=value.data.targetId;onAction(value.data.kind,meta);return true;
    }
    if(value.kind==='class'){
      if(!keys(value.data,['classId'])||!CLASSES.has(value.data.classId)||!fresh(p,'class',value.seq)||!permit(p,'config',2,3))return false;onClass(value.data.classId,meta);return true;
    }
    const loadout=loadoutOf(value.data);if(!fresh(p,'loadout',value.seq)||!permit(p,'config',2,3))return false;onLoadout(loadout,meta);return true;
  }
  function consume(value,slot){
    if(!keys(value,['v','kind','seq','stamp','version','data'])||value.v!==1||!sequence(value.seq)||typeof value.kind!=='string'||!Object.hasOwn(value,'data'))return false;
    jsonSafe(value);return role==='host'?receiveHost(value,slot):receiveGuest(value,slot);
  }
  function chunk(value,slot){
    // Guests have no reason to send bulk data. Reject before allocating memory.
    if(role!=='guest'||!keys(value,['v','kind','id','part','total','bytes','checksum','text'])||typeof value.id!=='string'||!/^\w+-\d+-[a-f0-9]{1,8}$/.test(value.id)||!Number.isInteger(value.total)||value.total<1||value.total>512||!Number.isInteger(value.part)||value.part<0||value.part>=value.total||!Number.isInteger(value.bytes)||value.bytes<1||value.bytes>MAX_BYTES||typeof value.text!=='string'||value.text.length>CHUNK||typeof value.checksum!=='string'||!/^[a-f0-9]{1,8}$/.test(value.checksum))return false;
    let bundle=bundles.get(value.id);
    if(!bundle){if(bundles.size>=4)return false;bundle={...value,parts:new Map(),at:time(),size:0};bundles.set(value.id,bundle);}
    if(bundle.total!==value.total||bundle.bytes!==value.bytes||bundle.checksum!==value.checksum){bundles.delete(value.id);return false;}
    if(bundle.parts.has(value.part)){if(bundle.parts.get(value.part)!==value.text)bundles.delete(value.id);return false;}
    bundle.parts.set(value.part,value.text);bundle.size+=encoder.encode(value.text).length;
    if(bundle.size>MAX_BYTES||[...bundles.values()].reduce((sum,b)=>sum+b.size,0)>MAX_BYTES*2){bundles.delete(value.id);return false;}
    if(bundle.parts.size!==bundle.total)return true;
    bundles.delete(value.id);const text=Array.from({length:bundle.total},(_,i)=>bundle.parts.get(i)).join('');
    // Byte counts are checked after rejoining because a surrogate pair may cross chunk boundaries.
    if(encoder.encode(text).length!==bundle.bytes||hash(text)!==bundle.checksum)return false;
    return consume(JSON.parse(text),slot);
  }
  const api={
    get role(){return role;},get actorId(){return actorId;},get layoutStamp(){return appliedStamp??worldCache?.stamp??null;},
    receive(message,slot){
      if(closed||!connected(slot)||!keys(message,['type','payload'])||message.type!=='net'||!object(message.payload)||message.payload.v!==1)return false;
      try{return message.payload.kind==='chunk'?chunk(message.payload,slot):consume(message.payload,slot);}catch(error){report('Ignored network message: '+error.message);return false;}
    },
    onPeer(event){
      if(closed||!Number.isInteger(event?.slot)||event.slot<1||event.slot>3)return;
      if(!event.connected){const p=peers.get(event.slot);if(role==='host'&&p?.input)onInput({forward:0,strafe:0,yaw:p.input.yaw,pitch:p.input.pitch,blocking:false,sprint:false},context(event.slot,{disconnected:true}));peers.delete(event.slot);if(role==='guest'){appliedStamp=null;appliedVersion=null;actorId=null;applying=null;pendingWorld=null;pendingState=null;latestInput=null;bundles.clear();}return;}
      const p=peer(event.slot);if(p.linked)return;p.linked=true;if(role==='host'){try{sendWorld(p);}catch(error){report(error.message);}}else hello();
    },
    tick(dt,now=clock()){
      if(closed)return;const t=time(now);for(const [id,b]of bundles)if(t-b.at>10000)bundles.delete(id);
      for(const p of peers.values())flush(p);
      if(role==='guest'){
        if(!appliedStamp&&t-lastHelloAt>=3000)hello();
        if(latestInput&&appliedStamp&&t-lastInputAt>=1000/15){if(sendGuest(packet('input',latestInput)))lastInputAt=t;}
        return;
      }
      for(const p of peers.values())if(p.input&&t-p.inputAt>350){onInput({forward:0,strafe:0,yaw:p.input.yaw,pitch:p.input.pitch,blocking:false,sprint:false},context(p.slot,{timeout:true}));p.input=null;}
      if(t-lastStateAt<1000/12)return;lastStateAt=t;
      try{
        const snap=snapshot();const state=packet('state',snap.state,{stamp:snap.stamp,version:snap.version});
        for(const p of peers.values())if(connected(p.slot)){if(p.ready!==snap.stamp){if(!p.queue.some(b=>b.kind==='world')&&p.lastWorldSeq!==worldSeq){sendWorld(p);p.lastWorldSeq=worldSeq;}}else enqueue(p,state);}
      }catch(error){report(error.message);}
    },
    sendInput(input){if(closed||role!=='guest')return false;latestInput=inputOf(input);return true;},
    sendAction(kind,targetId){if(closed||role!=='guest'||!NETWORK_ACTIONS.includes(kind))return false;if(kind==='take-item'){if(typeof targetId!=='string'||!/^[a-zA-Z0-9_.:-]{1,128}$/.test(targetId))return false;}else if(targetId!==undefined)return false;return sendGuest(packet('action',kind==='take-item'?{kind,targetId}:{kind}));},
    sendClass(classId){if(closed||role!=='guest'||!CLASSES.has(classId))return false;return sendGuest(packet('class',{classId}));},
    sendLoadout(loadout){if(closed||role!=='guest')return false;return sendGuest(packet('loadout',loadoutOf(loadout)));},
    broadcastWorld(){if(closed||role!=='host')return false;try{snapshot(true);for(const slot of session.connected)sendWorld(peer(slot));return true;}catch(error){report(error.message);return false;}},
    close(){if(closed)return;for(const p of peers.values())if(role==='host'&&p.input)onInput({forward:0,strafe:0,yaw:p.input.yaw,pitch:p.input.pitch,blocking:false,sprint:false},context(p.slot,{disconnected:true}));closed=true;peers.clear();bundles.clear();applying=null;pendingWorld=null;pendingState=null;latestInput=null;}
  };
  for(const slot of session.connected)api.onPeer({slot,connected:true});return api;
}
