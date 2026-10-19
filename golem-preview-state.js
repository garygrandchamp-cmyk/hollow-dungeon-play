// A hidden or paused interval never becomes catch-up animation on resuming.
export function createGolemPreviewClock(){
 let last=null;
 return {reset(){last=null;},tick(now,{hidden=false,paused=false}={}){
  if(!Number.isFinite(now)){last=null;return 0;}
  if(hidden){last=null;return 0;}
  const dt=last===null?0:Math.max(0,Math.min(.05,(now-last)/1000));last=now;
  return paused?0:dt;
 }};
}

// Preview-only illumination. The original game values remain an explicit
// baseline; inspection does not change the asset's albedo/emission or shaders.
export const GOLEM_REVIEW_LIGHTS=Object.freeze({
 torch:Object.freeze({label:'Torch review',note:'Local key + rim · dungeon mood',sky:0x8c8c91,ground:0x20150d,ambient:.76,moon:0xa6a3a4,moonPower:0,moonPosition:[-40,70,20],lantern:0xc6c3ba,lanternPower:0,lanternRange:8,torchPower:6,torchRange:7,keyPower:80,rimPower:40,fog:1.8/24,background:'#080706'}),
 neutral:Object.freeze({label:'Neutral review',note:'Even light · surfaces and contact',sky:0xd0d4d8,ground:0x80796f,ambient:3.8,moon:0xffffff,moonPower:2,moonPosition:[-3,5,4],lantern:0xbfc4cb,lanternPower:0,lanternRange:12,torchPower:0,torchRange:9,keyPower:0,rimPower:0,fog:.006,background:'#171c21'}),
 game:Object.freeze({label:'Game baseline',note:'Original first-person light values · dark',sky:0x8c8c91,ground:0x20150d,ambient:.76,moon:0xa6a3a4,moonPower:1.38,moonPosition:[-40,70,20],lantern:0xc6c3ba,lanternPower:1.7,lanternRange:8,torchPower:6,torchRange:7,keyPower:0,rimPower:0,fog:1.8/24,background:'#080706'}),
});
export function applyGolemReviewLighting({scene,ambient,moon,lantern,torches,key,rim},mode){
 if(!Object.hasOwn(GOLEM_REVIEW_LIGHTS,mode))throw RangeError('Unknown golem review light.');
 const p=GOLEM_REVIEW_LIGHTS[mode];ambient.color.set(p.sky);ambient.groundColor.set(p.ground);ambient.intensity=p.ambient;
 moon.color.set(p.moon);moon.intensity=p.moonPower;moon.position.fromArray(p.moonPosition);moon.visible=p.moonPower>0;
 lantern.color.set(p.lantern);lantern.intensity=p.lanternPower;lantern.distance=p.lanternRange;lantern.visible=p.lanternPower>0;
 for(const light of torches){light.intensity=p.torchPower;light.distance=p.torchRange;light.visible=p.torchPower>0;}
 key.intensity=p.keyPower;key.visible=p.keyPower>0;rim.intensity=p.rimPower;rim.visible=p.rimPower>0;
 scene.fog.density=p.fog;scene.background.set(p.background);scene.fog.color.copy(scene.background);return p;
}
export function golemPoseLabel(clip,frame){
 switch(clip){
  case 'idle':return 'IDLE / STANDING HOLD';
  case 'walk':return frame<73?'WALK / RIGHT STEP · LEFT FOOT PLANTED':frame<97?'WALK / LEFT STEP · RIGHT FOOT PLANTED':'WALK / CYCLE END · 0.6 m ADVANCE';
  case 'windup':return frame<177?'WINDUP / RAISING ARMS':'WINDUP / RAISED-ARM HOLD';
  case 'slam':return frame<191?'SLAM / DOWNSTROKE':'SLAM / GROUND CONTACT · FISTS PLANTED';
  case 'recovery':return frame<209?'RECOVERY / CHEST OPENING':frame<234?'RECOVERY / CORE EXPOSED':'RECOVERY / CHEST CLOSING';
  case 'hurt':return frame<248?'HURT / RECOIL':frame<256?'HURT / SETTLING':'HURT / RECOIL COMPLETE';
  case 'death':return frame<265?'DEATH / STUMBLE':frame<281?'DEATH / COLLAPSE':'DEATH / GROUNDED CORPSE HOLD';
  default:throw RangeError('Unknown golem review pose.');
 }
}
