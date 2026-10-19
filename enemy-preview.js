import {MONSTER_KINDS,MONSTER_CATALOG} from './monster-sprites.js?v=48c9690caaf071685197edd79934df66b444bc3a';

// Production catalog drives the roster. Only explicitly exercised sandboxes get
// a combat link; the animation viewer does not imply combat test coverage.
const behavior=Object.freeze({
 'crypt-guardian':{path:'dm-boss-lab.html',description:'Killable heavy guardian: warned sweep, missed counters and real damage. Reuses Drowned art.'},
 'deathless-pursuer':{path:'dm-boss-lab.html',description:'Cannot kill: outrun, hide behind the wall for 3 seconds, or strike to repel and pass. Reuses Wraith art.'},
 slime:{path:'encounter-lab.html',description:'Circular burst, party spacing and missed counters.'},
 bat:{path:'encounter-lab.html',description:'Committed dive, sidestep and sideways recovery.'},
 spider:{path:'encounter-lab.html',description:'Crouch warning, fixed pounce and interruption.'},
 'ceiling-widow':{path:'widow-lab.html',description:'Falling snare, cocoon, free struggles and teammate rescue.'},
});
export const ENEMY_PREVIEWS=Object.freeze(MONSTER_KINDS.map(id=>Object.freeze({id,name:MONSTER_CATALOG[id].name,behavior:behavior[id]?Object.freeze({...behavior[id]}):null})));
export function previewRelease(value){return typeof value==='string'&&/^[a-f0-9]{7,40}$/.test(value)?value:null;}
export function enemyPreviewHref(id,mode='animation',release){
 const enemy=ENEMY_PREVIEWS.find(e=>e.id===id);if(!enemy||!['animation','behavior'].includes(mode))return null;
 const path=mode==='animation'?'enemy-sprite-lab.html':enemy.behavior?.path;if(!path)return null;
 const query=new URLSearchParams({kind:id}),version=previewRelease(release);if(version)query.set('release',version);
 return './'+path+'?'+query;
}
export function enemyPreviewHubHref(release){const version=previewRelease(release);return './enemy-preview.html'+(version?'?release='+version:'');}
export function mountEnemyPreview(doc=document,location=globalThis.location){
 const release=previewRelease(new URL(import.meta.url).searchParams.get('v'))??previewRelease(new URLSearchParams(location?.search??'').get('release'));
 const roster=doc.getElementById('enemyPreviewRoster'),status=doc.getElementById('enemyPreviewBuild');
 if(!roster)return false;roster.replaceChildren();if(status)status.textContent=release?'Build '+release.slice(0,8):'Local development build';
 for(const enemy of ENEMY_PREVIEWS){
  const card=doc.createElement('article'),title=doc.createElement('h2');card.dataset.enemy=enemy.id;title.textContent=enemy.name;card.appendChild(title);
  const description=doc.createElement('p');description.textContent=enemy.behavior?.description??'Inspect idle, walk, attack, hurt and death frames. A dedicated combat sandbox is not available yet.';card.appendChild(description);
  const actions=doc.createElement('div');actions.className='preview-actions';
  for(const [mode,label]of [['behavior','Test encounter'],['animation','Inspect animation']]){const href=enemyPreviewHref(enemy.id,mode,release);if(!href)continue;const link=doc.createElement('a');link.href=href;link.textContent=label;link.setAttribute('aria-label',label+' · '+enemy.name);actions.appendChild(link);}
  card.appendChild(actions);roster.appendChild(card);
 }
 return true;
}
