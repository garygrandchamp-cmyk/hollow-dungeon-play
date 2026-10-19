// Read the version of this loaded module, never the latest server manifest or
// the page's optional release link: screenshots must identify the running code.
export function runningBuildLabel(moduleURL){
 const revision=new URL(moduleURL).searchParams.get('v');
 return /^[a-f0-9]{7,40}$/i.test(revision??'')
  ? {text:'HOLLOW · '+revision.slice(0,8),revision}
  : {text:'HOLLOW · DEV',revision:'local development'};
}
export function installBuildLabel(doc=globalThis.document,moduleURL=import.meta.url){
 if(!doc||doc.getElementById('runningBuildLabel'))return;
 const build=runningBuildLabel(moduleURL),badge=doc.createElement('div');
 badge.id='runningBuildLabel';badge.textContent=build.text;badge.title='Running build: '+build.revision;
 badge.setAttribute('aria-label',badge.title);
 const style=doc.createElement('style');
 style.textContent=`:root{--hollow-build-label:${JSON.stringify(build.text)}}
 #runningBuildLabel,dialog[open]::after{position:fixed;left:max(4px,env(safe-area-inset-left));bottom:max(3px,env(safe-area-inset-bottom));z-index:2147483647;padding:3px 5px;border:1px solid #6e6653;background:#101319ed;color:#c8bea6;font:11px/1.2 monospace;letter-spacing:.3px;pointer-events:none;user-select:none;white-space:nowrap}
 dialog[open]::after{content:var(--hollow-build-label)}`;
 doc.head.appendChild(style);doc.body.appendChild(badge);return badge;
}
if(typeof document!=='undefined')installBuildLabel();
