const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
export function touchVector(dx,dy,radius=48){
 if(!Number.isFinite(dx)||!Number.isFinite(dy)||!Number.isFinite(radius)||radius<=0)return {forward:0,side:0};
 const length=Math.hypot(dx,dy),scale=Math.max(radius,length);if(length<radius*.14)return {forward:0,side:0};
 return {forward:-dy/scale,side:dx/scale};
}

export function createMobileControls({document:doc=globalThis.document,window:win=globalThis,canvas,drawer,getState,onAction=()=>{},onLook=()=>{},onFocus=()=>{},onZoom=()=>{},onCancelGesture=()=>{}}){
 const root=doc.createElement('div');root.id='mobileControls';root.hidden=true;
 const make=(tag,text,parent=root)=>{const el=doc.createElement(tag);if(text)el.textContent=text;parent.appendChild(el);return el;};
 const removers=[],listen=(node,name,fn)=>{node?.addEventListener?.(name,fn,{passive:false});removers.push(()=>node?.removeEventListener?.(name,fn));};
 const stop=e=>{e.preventDefault?.();e.stopPropagation?.();};
 let compact=false,moving=null,looking=null,attack=null,guard=null,repeat=0,lastActor=null,input={forward:0,side:0},destroyed=false;
 const touches=new Map();let pinch=0;
 const state=()=>getState()??{};
 const active=()=>{const s=state();return compact&&s.available&&s.playing&&!s.busy&&!s.dm;};
 const nav=make('nav');nav.className='mobile-view-tabs';nav.setAttribute('aria-label','Active game view');
 const tabs=new Map();for(const [id,label]of [['dm','DM'],['hero-1','Hero 1'],['hero-2','Hero 2'],['hero-3','Hero 3']]){
  const button=make('button',label,nav);button.type='button';button.onclick=()=>{reset();onFocus(id);};tabs.set(id,button);
 }
 const quick=make('div');quick.className='mobile-quick';const quickButtons=new Map();
 for(const [kind,label]of [['menu','Menu'],['inventory','Bag'],['map','Map']]){const b=make('button',label,quick);quickButtons.set(kind,b);b.type='button';b.onclick=()=>{reset();onAction(kind,state().actorId);};}
 const look=make('div');look.className='mobile-look';look.setAttribute('aria-label','Drag here to look around');
 const move=make('div');move.className='mobile-stick';move.setAttribute('role','group');move.setAttribute('aria-label','Movement joystick');
 const knob=make('span','MOVE',move);knob.className='mobile-stick-knob';
 const actions=make('div');actions.className='mobile-actions';const buttons=new Map();
 for(const [kind,label]of [['attack','Strike'],['guard','Off hand'],['interact','Use'],['swap','Swap'],['search','Search traps']]){
  const b=make('button',label,actions);b.type='button';b.dataset.touchAction=kind;buttons.set(kind,b);
  listen(b,'pointerdown',e=>{if(!active())return;stop(e);b.setPointerCapture?.(e.pointerId);const id=state().actorId;
   if(kind==='guard'){if(guard)return;guard={pointer:e.pointerId,actor:id};}
   if(kind==='attack'){attack=e.pointerId;repeat=0;}
   onAction(kind,id);
  });
  const release=e=>{stop(e);if(attack===e.pointerId)attack=null;if(guard?.pointer===e.pointerId){onAction('release',guard.actor);guard=null;}};
  for(const event of ['pointerup','pointercancel','lostpointercapture'])listen(b,event,release);
  listen(b,'contextmenu',stop);
 }
 function updateMove(e){const bounds=move.getBoundingClientRect(),radius=Math.max(24,Math.min(bounds.width,bounds.height)*.4);input=touchVector(e.clientX-bounds.left-bounds.width/2,e.clientY-bounds.top-bounds.height/2,radius);knob.style.transform=`translate(${input.side*radius*.65}px,${-input.forward*radius*.65}px)`;}
 listen(move,'pointerdown',e=>{if(!active()||moving!==null)return;stop(e);moving=e.pointerId;move.setPointerCapture?.(moving);updateMove(e);});
 listen(move,'pointermove',e=>{if(moving===e.pointerId){stop(e);updateMove(e);}});
 const releaseMove=e=>{if(moving!==e.pointerId)return;stop(e);moving=null;input={forward:0,side:0};knob.style.transform='';};
 for(const event of ['pointerup','pointercancel','lostpointercapture'])listen(move,event,releaseMove);
 listen(look,'pointerdown',e=>{if(!active()||looking)return;stop(e);looking={id:e.pointerId,x:e.clientX,y:e.clientY,actor:state().actorId};look.setPointerCapture?.(e.pointerId);});
 listen(look,'pointermove',e=>{if(looking?.id!==e.pointerId)return;stop(e);if(active())onLook(e.clientX-looking.x,e.clientY-looking.y,looking.actor);looking.x=e.clientX;looking.y=e.clientY;});
 const releaseLook=e=>{if(looking?.id===e.pointerId){stop(e);looking=null;}};
 for(const event of ['pointerup','pointercancel','lostpointercapture'])listen(look,event,releaseLook);
 function reset(){if(guard)onAction('release',guard.actor);guard=null;attack=null;moving=null;looking=null;input={forward:0,side:0};repeat=0;if(knob.style.transform!=='')knob.style.transform='';touches.clear();pinch=0;}
 for(const event of ['blur','pagehide','orientationchange'])listen(win,event,reset);
 listen(doc,'visibilitychange',reset);
 // One finger keeps the existing DM drag/orbit interaction; two fingers zoom
 // and cancel any pending placement so releasing a pinch never places a trap.
 listen(canvas,'pointerdown',e=>{if(!compact||!state().dm||e.pointerType!=='touch')return;touches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(touches.size===2){onCancelGesture();const [a,b]=[...touches.values()];pinch=Math.hypot(a.x-b.x,a.y-b.y);stop(e);}});
 listen(canvas,'pointermove',e=>{if(!touches.has(e.pointerId))return;touches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(touches.size===2){stop(e);onCancelGesture();const [a,b]=[...touches.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);if(pinch>5&&distance>5)onZoom(clamp(pinch/distance,.8,1.2));pinch=distance;}});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])listen(canvas,event,e=>{touches.delete(e.pointerId);if(touches.size<2)pinch=0;});
 let fold=null;if(drawer){fold=doc.createElement('button');fold.type='button';fold.id='mobileDrawerToggle';fold.textContent='Collapse tool list';fold.onclick=()=>{const collapsed=drawer.classList.toggle('mobile-collapsed');fold.textContent=collapsed?'Expand tool list':'Collapse tool list';};drawer.prepend(fold);}
 doc.body.appendChild(root);
 let previousTab=null;
 const hide=(node,value)=>{if(node.hidden!==value)node.hidden=value;};
 function tick(dt){
  if(destroyed)return;const s=state(),wasCompact=compact;compact=win.innerWidth<=900||win.innerWidth<=1366&&!!win.matchMedia?.('(pointer: coarse)').matches;if(wasCompact!==compact)reset();
  if(doc.body.classList.contains('mobile-game')!==compact)doc.body.classList.toggle('mobile-game',compact);hide(root,!compact||!s.available||s.busy);hide(nav,!s.party||s.remote);hide(quick,false);for(const [kind,b]of quickButtons)hide(b,!!s.dm&&kind!=='menu');
  if(lastActor!==s.actorId||s.busy||!s.available||!active()&&!s.dm)reset();lastActor=s.actorId;
  const selected=s.dm?'dm':s.actorId;if(previousTab!==selected){previousTab=selected;for(const [id,b]of tabs)b.setAttribute('aria-pressed',String(selected===id));}
  const inactive=!active();hide(look,inactive);hide(move,inactive);hide(actions,inactive);
  if(fold)hide(fold,!compact);
  if(attack!==null&&active()){repeat+=Math.max(0,Math.min(.1,dt||0));if(repeat>=.55){repeat=0;onAction('attack',s.actorId);}}
 }
 return {root,tick,reset,get compact(){return compact;},get input(){return {...input,actorId:lastActor};},destroy(){if(destroyed)return;reset();destroyed=true;removers.forEach(fn=>fn());root.remove();fold?.remove();doc.body.classList.remove('mobile-game');}};
}
