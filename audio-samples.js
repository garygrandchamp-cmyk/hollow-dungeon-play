// Local CC0 recordings. Keep unmapped events on the procedural audio path.
const rpg=(...names)=>names.map(name=>'kenney-rpg/'+name+'.ogg');
const ui=(...names)=>names.map(name=>'kenney-interface/'+name+'.ogg');
const art=(folder,...names)=>names.map(name=>'artisticdude/'+folder+'/'+name+'.wav');
const cue=(files,gain=.22,rate=1,maxDuration=3)=>({files,gain,rate,maxDuration});
export const SAMPLE_CUES={
 'ui-click':cue(ui('click_001','click_002','click_003'),.10,.86),
 'ui-place':cue(ui('drop_001','drop_002'),.15,.8),
 'ui-rotate':cue(ui('scroll_001','scroll_002'),.09,.8),
 'ui-delete':cue(ui('back_001','back_002'),.12,.8),
 'ui-denied':cue(ui('error_001'),.12,.8),
 step:cue(rpg('footstep00','footstep01','footstep02','footstep03','footstep04','footstep05'),.21,.92),
 swing:cue(art('battle','swing','swing2','swing3'),.24,.96),
 bow:cue(ui('pluck_001','pluck_002'),.22,.65),
 hit:cue(rpg('chop'),.30,.85),
 block:cue(art('battle','sword-unsheathe2','sword-unsheathe3'),.22,.85),
 cast:cue(art('battle','magic1','spell'),.20,.9),
 chest:cue(rpg('handleCoins','handleCoins2'),.22,.92),
 door:cue(art('world','door'),.23,.88,4),
 'book-open':cue(rpg('bookOpen','bookFlip1','bookFlip2'),.24,.9),
 'cabinet-open':cue(rpg('creak1','creak2','doorOpen_1'),.22,.9),
 'skeleton-step':cue(art('inventory','chainmail1','chainmail2'),.13,.86),
 'goblin-step':cue(rpg('footstep06','footstep07','footstep08'),.17,.85),
 'goblin-idle':cue(art('NPC/gutteral beast','mnstr1','mnstr2','mnstr3'),.16,1.05),
 'goblin-alert':cue(art('NPC/gutteral beast','mnstr4','mnstr5'),.22,1.04),
 'wraith-idle':cue(art('NPC/shade','shade1','shade2','shade3'),.16,.85),
 'wraith-alert':cue(art('NPC/shade','shade4','shade5'),.24,.9),
 'slime-step':cue(art('NPC/slime','slime1','slime2','slime3'),.18,.82),
 'slime-idle':cue(art('NPC/slime','slime4','slime5','slime6'),.14,.8),
 'slime-alert':cue(art('NPC/slime','slime7','slime8'),.23,.85),
 'drowned-idle':cue(art('NPC/gutteral beast','mnstr8','mnstr9'),.16,.65),
 'drowned-alert':cue(art('NPC/gutteral beast','mnstr10','mnstr11'),.23,.7),
 monster:cue(art('NPC/ogre','ogre1','ogre2','ogre3'),.23,.8),
};

export function createDungeonSampleBank({context,fetchAudio=globalThis.fetch,random=Math.random,onStatus=()=>{}}){
 const buffers=new Map(),failed=new Set(),voices=new Set(),lastFile=new Map();
 let loading=null,disposed=false;
 const files=[...new Set(Object.values(SAMPLE_CUES).flatMap(c=>c.files))];
 function status(){return {ready:buffers.size,failed:failed.size,total:files.length,active:voices.size};}
 function report(){onStatus(status());}
 async function preload(){
  if(loading)return loading;
  if(!context?.decodeAudioData||typeof fetchAudio!=='function')return status();
  loading=(async()=>{
   let cursor=0;
   // Limit concurrent requests/decodes, keeping generation and UI responsive.
   await Promise.all(Array.from({length:4},async()=>{
    while(cursor<files.length&&!disposed){const file=files[cursor++];
     try{
      const response=await fetchAudio(new URL('./assets/audio/'+file,import.meta.url));
      if(!response.ok)throw new Error('Audio request failed');
      const buffer=await context.decodeAudioData(await response.arrayBuffer());
      if(!Number.isFinite(buffer.duration)||buffer.duration<=0)throw new Error('Invalid audio');
      let peak=0;
      for(let ch=0;ch<buffer.numberOfChannels;ch++){const data=buffer.getChannelData(ch);for(let i=0;i<data.length;i++)peak=Math.max(peak,Math.abs(data[i]));}
      if(!disposed)buffers.set(file,{buffer,normalization:Math.min(2,1/Math.max(.05,peak))});
     }catch{failed.add(file);}
     if(!disposed)report();
    }
   }));
   return status();
  })();
  return loading;
 }
 function play(name,bus,{occluded=false}={}){
  const cue=SAMPLE_CUES[name];if(!cue||disposed)return false;
  const ready=cue.files.filter(file=>buffers.has(file));if(!ready.length)return false;
  // A saturated mix consumes the event, avoiding an unbounded fallback chorus.
  if(voices.size>=20)return true;
  const choices=ready.filter(file=>file!==lastFile.get(name));
  const pool=choices.length?choices:ready,file=pool[Math.floor(random()*pool.length)%pool.length];lastFile.set(name,file);
  const {buffer,normalization}=buffers.get(file),source=context.createBufferSource(),gain=context.createGain(),filter=context.createBiquadFilter();
  const rate=cue.rate*(.97+random()*.06),duration=Math.min(cue.maxDuration,buffer.duration/rate),at=context.currentTime;
  source.buffer=buffer;source.playbackRate.value=rate;filter.type='lowpass';filter.frequency.value=occluded?900:4400;
  gain.gain.setValueAtTime(cue.gain*normalization,at);
  gain.gain.setValueAtTime(cue.gain*normalization,at+Math.max(0,duration-.035));
  gain.gain.linearRampToValueAtTime(0,at+duration);
  source.connect(filter);filter.connect(gain);gain.connect(bus);
  const voice={source,cleanup(){voices.delete(voice);source.disconnect();filter.disconnect();gain.disconnect();}};
  voices.add(voice);source.onended=()=>voice.cleanup();source.start(at);source.stop(at+duration);
  return true;
 }
 function stop(){for(const voice of [...voices]){try{voice.source.stop();}catch{}voice.cleanup();}}
 return {preload,play,stop,get status(){return status();},dispose(){disposed=true;stop();buffers.clear();}};
}
