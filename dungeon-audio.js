import {createDungeonSampleBank} from './audio-samples.js?v=f07b267ba3b378ae9cbde026bbf48f44495e778f';
// Local CC0 recordings with procedural fallback. Audio starts on a gesture.
export function createDungeonAudio(){
 let samples=null,context=null,master=null,ambience=null,music=null,enabled=false,volume=.35,lastStep=0,nextDrip=0,nextNote=0,noteIndex=0,noise=null,eventBus=null;
 const panel=document.createElement('details');panel.id='audioOptions';panel.innerHTML='<summary>Sound & dread +</summary><button id="soundToggle">Enable dungeon sound</button><label for="soundVolume">Master volume</label><input id="soundVolume" type="range" min="0" max="100" value="35"><label><input id="dreadMusic" type="checkbox" checked> Sparse ambient music</label><p class="editor-help">Recorded weapons, creatures, footsteps and doors with low dungeon drones. Enable sound once to begin; mute any time.</p><p id="sampleStatus" class="editor-help" aria-live="polite">CC0 sound packs · load when sound is enabled.</p>';document.querySelector('aside').appendChild(panel);
 const button=document.getElementById('soundToggle'),quick=document.createElement('button');quick.id='soundQuick';quick.textContent='♪ Sound off';document.body.appendChild(quick);const extraToggles=[];
 function tone(frequency,duration,gain=.05,type='sine',delay=0,slide=frequency,bus=eventBus??master){const at=context.currentTime+delay,o=context.createOscillator(),g=context.createGain();o.type=type;o.frequency.setValueAtTime(frequency,at);o.frequency.exponentialRampToValueAtTime(Math.max(12,slide),at+duration);g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(gain,at+.012);g.gain.exponentialRampToValueAtTime(.0001,at+duration);o.connect(g);g.connect(bus);o.start(at);o.stop(at+duration+.05);}
 function hiss(duration,gain=.05,frequency=500,delay=0,type='lowpass'){const at=context.currentTime+delay,s=context.createBufferSource(),f=context.createBiquadFilter(),g=context.createGain();s.buffer=noise;f.type=type;f.frequency.value=frequency;g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(gain,at+.008);g.gain.exponentialRampToValueAtTime(.0001,at+duration);s.connect(f);f.connect(g);g.connect(eventBus??master);s.start(at);s.stop(at+duration+.05);}
 async function unlock(){try{if(!context){const Audio=globalThis.AudioContext??globalThis.webkitAudioContext;if(!Audio){button.textContent='Audio unavailable';return false;}context=new Audio();master=context.createGain();master.gain.value=volume;master.connect(context.destination);ambience=context.createGain();ambience.gain.value=.22;ambience.connect(master);music=context.createGain();music.gain.value=.45;music.connect(master);noise=context.createBuffer(1,context.sampleRate*2,context.sampleRate);const data=noise.getChannelData(0);let previous=0;for(let i=0;i<data.length;i++){previous=(previous+Math.random()*.08-.04)*.985;data[i]=previous;}for(const f of [39,58.6]){const o=context.createOscillator(),g=context.createGain();o.type='sine';o.frequency.value=f;g.gain.value=.045;o.connect(g);g.connect(ambience);o.start();}const delay=context.createDelay(1),feedback=context.createGain();delay.delayTime.value=.24;feedback.gain.value=.16;delay.connect(feedback);feedback.connect(delay);delay.connect(master);music.connect(delay);}await context.resume();samples??=createDungeonSampleBank({context,onStatus:({ready,failed,total})=>{document.getElementById('sampleStatus').textContent=ready+failed===total?'Sound packs ready · '+ready+' effects'+(failed?' · '+failed+' synthesized fallbacks':''):'Loading sound packs · '+ready+'/'+total;}});void samples.preload();enabled=true;master.gain.setTargetAtTime(volume,context.currentTime,.1);button.textContent='Mute dungeon sound';quick.textContent='♪ Sound on';extraToggles.forEach(b=>b.textContent='♪ Sound on');return true;}catch{button.textContent='Try enabling sound again';return false;}}
 function mute(){enabled=false;samples?.stop();if(master)master.gain.setTargetAtTime(0,context.currentTime,.05);button.textContent='Enable dungeon sound';quick.textContent='♪ Sound off';extraToggles.forEach(b=>b.textContent='♪ Sound off');}
 // Small bone/stone dice on a padded wooden tray. Start once, tick 6–9 times
 // through a 1.1s roll, then play exactly one authoritative outcome sound.
 function playDice(name){
  switch(name){
   case 'dice-roll-start':
    hiss(.14,.018,480);
    for(const [i,delay]of [0,.045,.11,.2].entries()){tone(195-i*18,.075,.018-i*.0025,'triangle',delay,100-i*9);hiss(.035,.014-i*.002,950-i*120,delay,'bandpass');}
    return true;
   case 'dice-roll-tick':{
    const pitch=155+Math.random()*65;
    tone(pitch,.055,.012,'triangle',0,pitch*.58);hiss(.035,.011,650+Math.random()*450,0,'bandpass');
    return true;
   }
   case 'dice-success':
    tone(120,.12,.019,'triangle',0,72);hiss(.055,.012,600);
    // Muted D-minor resonance; no bright treasure fanfare.
    for(const [i,frequency]of [146.83,174.61,220].entries())tone(frequency,.38+i*.045,.017-i*.003,'sine',.055+i*.055,frequency*.997);
    return true;
   case 'dice-failure':
    hiss(.09,.016,420);tone(123.47,.27,.021,'triangle',0,82.41);tone(98,.29,.013,'sine',.12,65.41);
    return true;
   default:return false;
  }
 }
 const creatureTimes=new Map();let creatureTokens=8,creatureTokenAt=0;
 // game.js sends `${type}-step/-idle/-alert` with distance/pan/occluded.
 // Its per-enemy timers are supplemented by a shared mix budget for swarms.
 function allowCreature(name,distance){
  const match=/^(skeleton|goblin|wraith|spider|slime|rat|bat|crawler|skeletal-mage|drowned)-(step|idle|alert)$/.exec(name);
  if(!match)return true;
  const at=context.currentTime,cooldown={step:.28,idle:1.8,alert:1.25}[match[2]];
  const previous=creatureTimes.get(name),within=previous&&at-previous.at<cooldown;
  // A quiet faraway creature must not conceal a much nearer same-kind threat.
  // Allow one closer replacement per cooldown, charged to the same swarm budget.
  const closer=within&&!previous.replaced&&distance<=previous.distance*.5&&previous.distance-distance>=4;
  if(within&&!closer)return false;
  creatureTokens=Math.min(8,creatureTokens+Math.max(0,at-creatureTokenAt)*8);creatureTokenAt=at;
  if(creatureTokens<1)return false;
  creatureTokens--;creatureTimes.set(name,{at:closer?previous.at:at,distance,replaced:!!closer});return true;
 }
 function playCreature(name){
  const match=/^(wraith|spider|slime|rat|bat|crawler|skeletal-mage|drowned)-(step|idle|alert)$/.exec(name);if(!match)return false;
  const [,kind,event]=match,v=.96+Math.random()*.08;
  const note=(f,d,g,type='sine',delay=0,end=f)=>tone(f*v,d,g,type,delay,end*v);
  switch(kind){
   case 'wraith':
    if(event==='step'){hiss(.24,.021,740,0,'bandpass');note(166,.25,.014,'sine',0,132);}
    else if(event==='idle'){hiss(.52,.026,800,0,'bandpass');note(196,.52,.013,'sine',0,185);note(202,.58,.01,'sine',.06,190);}
    else{hiss(.55,.036,1100,0,'bandpass');note(270,.6,.021,'triangle',0,154);note(281,.64,.013,'sine',.03,160);}
    break;
   case 'spider':
    if(event==='step'){for(const delay of [0,.025,.055])hiss(.035,.018,1600*v,delay,'bandpass');note(330,.055,.008,'triangle',0,240);}
    else if(event==='idle'){hiss(.24,.022,2200,0,'bandpass');hiss(.1,.014,900,.14,'bandpass');note(520,.13,.008,'triangle',.1,300);}
    else{hiss(.13,.026,2800,0,'bandpass');note(220,.19,.017,'triangle',.02,390);hiss(.18,.018,1400,.13,'bandpass');}
    break;
   case 'slime':
    if(event==='step'){note(65,.12,.025,'sine',0,112);hiss(.14,.026,250);note(100,.1,.012,'sine',.06,52);}
    else if(event==='idle'){for(const [i,f]of [70,86,65].entries())note(f,.18,.02-i*.002,'sine',[0,.14,.32][i],f*1.35);hiss(.44,.018,300);}
    else{note(79,.4,.033,'triangle',0,43);hiss(.38,.03,450);note(145,.22,.014,'sine',.1,66);}
    break;
   case 'rat':
    if(event==='step'){for(const delay of [0,.035,.075,.11])hiss(.025,.017,1100*v,delay,'bandpass');note(145,.06,.008,'triangle',0,90);}
    else if(event==='idle'){note(780,.105,.018,'triangle',0,470);note(1050,.08,.007,'sine',.04,680);hiss(.1,.009,1600,0,'bandpass');}
    else{note(1150,.12,.026,'triangle',0,690);note(920,.13,.021,'triangle',.155,1450);hiss(.17,.015,2100,0,'bandpass');}
    break;
   case 'bat':
    if(event==='step'){for(const delay of [0,.1,.21])hiss(.095,.022,350,delay,'bandpass');note(88,.1,.009,'sine',.08,55);}
    else if(event==='idle'){note(1450,.055,.014,'sine',0,1050);note(1800,.065,.011,'sine',.085,1250);}
    else{for(const [i,f]of [1600,2100,1750].entries())note(f,.085,.022-i*.002,'sine',i*.075,f*.7);hiss(.12,.011,1800,0,'bandpass');}
    break;
   case 'crawler':
    if(event==='step'){note(175,.105,.019,'triangle',0,102);hiss(.23,.026,900,0,'bandpass');hiss(.05,.018,1800,.11,'bandpass');}
    else if(event==='idle'){note(119,.15,.018,'triangle',0,66);hiss(.38,.023,1200,0,'bandpass');for(const delay of [.12,.23])note(260,.07,.009,'triangle',delay,170);}
    else{for(const delay of [0,.09,.18])note(210,.13,.02,'triangle',delay,90);hiss(.39,.032,1700,0,'bandpass');}
    break;
   case 'skeletal-mage':
    if(event==='step'){hiss(.16,.021,650);for(const delay of [0,.09])note(350,.055,.012,'triangle',delay,260);}
    else if(event==='idle'){hiss(.43,.024,1300,0,'bandpass');note(286,.35,.012,'sine',0,277);note(730,.12,.007,'triangle',.2,590);}
    else{note(146,.44,.026,'triangle',0,220);note(293,.38,.012,'sine',.07,440);hiss(.05,.014,1800,0,'bandpass');}
    break;
   case 'drowned':
    if(event==='step'){note(55,.16,.032,'triangle',0,32);hiss(.22,.03,210);note(92,.13,.012,'sine',.08,47);}
    else if(event==='idle'){hiss(.52,.028,340);note(71,.46,.02,'triangle',0,52);note(109,.12,.009,'sine',.16,68);note(82,.15,.008,'sine',.31,55);}
    else{note(104,.62,.034,'triangle',0,48);note(156,.54,.012,'sine',.04,73);hiss(.57,.032,500);}
    break;
  }
  return true;
 }
 function play(name,{distance=0,pan=0,occluded=false}={}){if(!enabled||!context)return;if(!Number.isFinite(distance))return;distance=Math.max(0,distance);pan=Number.isFinite(pan)?Math.max(-1,Math.min(1,pan)):0;occluded=occluded===true;const level=Math.max(0,1-distance/30);if(level<=0||!allowCreature(name,distance))return;const gain=context.createGain();gain.gain.value=level*level*(occluded?.24:1);let panner=null,spatialFilter=null,output=gain;
  // Apply the same distance/wall colour to recorded and synthesized creatures.
  // Nearby unobstructed effects stay crisp; distant details recede behind combat.
  if(distance>8||occluded){spatialFilter=context.createBiquadFilter();spatialFilter.type='lowpass';spatialFilter.frequency.value=occluded?900:5000-(Math.min(30,distance)-8)/22*3200;gain.connect(spatialFilter);output=spatialFilter;}
  if(context.createStereoPanner){panner=context.createStereoPanner();panner.pan.value=pan;output.connect(panner);panner.connect(master);}else output.connect(master);eventBus=gain;if(!samples?.play(name,gain,{occluded})&&!playDice(name)&&!playCreature(name))switch(name){case 'ui-click':tone(330,.045,.025,'triangle',0,440);break;case 'ui-place':tone(180,.1,.035,'triangle',0,90);hiss(.05,.025,900);break;case 'ui-rotate':tone(220,.08,.025,'sine',0,330);break;case 'ui-delete':hiss(.09,.025,700);tone(110,.1,.025,'triangle',0,60);break;case 'ui-denied':tone(92,.16,.03,'square',0,74);break;case 'step':hiss(.11,.045,700);tone(84,.08,.024,'triangle',0,52);break;case 'swing':hiss(.22,.11,1800,0,'bandpass');break;case 'bow':tone(150,.12,.04,'triangle',0,60);hiss(.18,.045,1900,0,'bandpass');break;case 'hit':hiss(.16,.12,650);tone(108,.13,.075,'triangle',0,40);break;case 'block':for(const f of [490,738,1140])tone(f,.27,.03,'triangle',0,f*.94);break;case 'cast':hiss(.3,.065,2200);tone(240,.32,.07,'sine',0,1040);tone(1040,.25,.035,'sine',.12,420);break;case 'chest':for(let i=0;i<4;i++)tone([660,880,990,1320][i],.28,.045,'sine',i*.07);break;case 'door':hiss(.5,.075,280);tone(90,.48,.025,'sawtooth',0,55);break;case 'heal':for(let i=0;i<3;i++)tone([261,311,392][i],1,.035,'sine',i*.09,undefined,music);break;case 'death':tone(90,1.5,.08,'triangle',0,25);hiss(.8,.1,180);break;case 'drip':tone(1150,.11,.025,'sine',0,420,ambience);tone(630,.15,.012,'sine',.22,280,ambience);break;case 'skeleton-step':hiss(.095,.065,1600,0,'bandpass');tone(270,.12,.025,'triangle',0,180);break;case 'goblin-step':hiss(.13,.06,530);tone(65,.08,.03,'triangle',0,42);break;case 'skeleton-alert':for(let i=0;i<3;i++)tone(170-i*24,.25,.055,'sawtooth',i*.09,90);hiss(.5,.045,2100,0,'bandpass');break;case 'goblin-alert':tone(145,.65,.065,'sawtooth',0,52);tone(210,.3,.025,'triangle',.1,85);hiss(.45,.04,520);break;case 'skeleton-idle':hiss(.35,.045,1900,0,'bandpass');tone(380,.25,.022,'triangle',.1,170);break;case 'goblin-idle':tone(59,.6,.04,'sawtooth',0,75);hiss(.5,.035,240);break;case 'monster':tone(66,.65,.035,'sawtooth',0,42);hiss(.4,.025,300);break;}eventBus=null;setTimeout(()=>{gain.disconnect();spatialFilter?.disconnect();panner?.disconnect();},8500);}
 function step(now){if(now-lastStep>340){lastStep=now;play('step');}}
 function tick(dt,now){if(!enabled||!context)return;music.gain.setTargetAtTime(document.getElementById('dreadMusic').checked?.45:0,context.currentTime,.5);if(now>nextDrip){nextDrip=now+1800+Math.random()*6500;play('drip');}if(now>nextNote){nextNote=now+5500+Math.random()*3500;const f=[65.4,61.7,77.8,58.3,69.3,65.4][noteIndex++%6];tone(f,7,.028,'sine',0,f*.998,music);tone(f*1.5,5,.012,'triangle',.8,f*1.499,music);}}
 button.onclick=quick.onclick=()=>enabled?mute():unlock();document.getElementById('soundVolume').oninput=e=>{volume=+e.target.value/100;if(enabled&&master)master.gain.setTargetAtTime(volume,context.currentTime,.05);};
 document.addEventListener('click',e=>{if(e.target.closest?.('button,summary,select')&&!e.target.closest?.('#soundToggle,#soundQuick'))play('ui-click');});document.addEventListener('change',e=>{if(e.target.matches?.('select,input[type=range],input[type=checkbox]'))play('ui-rotate');});return {unlock,mute,play,step,tick,createToggle(){const toggle=document.createElement('button');toggle.textContent=enabled?'♪ Sound on':'♪ Sound off';toggle.onclick=()=>enabled?mute():unlock();extraToggles.push(toggle);return toggle;},get sampleStatus(){return samples?.status??{ready:0,failed:0,total:0,active:0};},get enabled(){return enabled;}};
}
