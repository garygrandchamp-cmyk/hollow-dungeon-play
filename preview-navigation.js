import {enemyPreviewHubHref,previewRelease} from './enemy-preview.js?v=5d7531948dcd036925fc96b539d81165ba86fa3a';
// Keep every return link on the release the tester opened. No storage, opener
// access, history tricks, embedded renderers or campaign imports are involved.
export function wirePreviewNavigation(doc=document,search=globalThis.location?.search??''){
 const release=previewRelease(new URL(import.meta.url).searchParams.get('v'))??previewRelease(new URLSearchParams(search).get('release'));
 for(const link of doc.querySelectorAll('a[href]')){
  const ref=link.getAttribute('href'),[path,query='']=String(ref??'').split('?');
  if(path==='./enemy-preview.html'){link.href=enemyPreviewHubHref(release);continue;}
  if(!['./encounter-lab.html','./widow-lab.html','./enemy-sprite-lab.html'].includes(path))continue;
  const params=new URLSearchParams(query);if(release)params.set('release',release);else params.delete('release');link.href=path+(params.size?'?'+params:'');
 }

}
