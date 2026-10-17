// Read-only local diagnostics. No telemetry, network, or gameplay mutations.
export function summarizeFrames(samples){
 if(!samples.length)return null;
 const times=samples.map(s=>s.ms).sort((a,b)=>a-b),sum=samples.reduce((n,s)=>n+s.ms,0),average=key=>samples.reduce((n,s)=>n+(s[key]??0),0)/samples.length,last=samples.at(-1);
 return {fps:sum>0?1000*samples.length/sum:0,averageMs:sum/samples.length,p95Ms:times[Math.max(0,Math.ceil(times.length*.95)-1)],worstMs:times.at(-1),workMs:average('workMs'),drawMs:average('drawMs'),gameMs:average('gameMs'),calls:average('calls'),triangles:average('triangles'),views:last.views,width:last.width,height:last.height,profile:last.profile,build:last.build,samples:samples.length};
}
export function createPerformanceDiagnostics({document:doc=globalThis.document,clock=()=>performance.now()}={}){
 const control=doc.createElement('button');control.type='button';control.textContent='Show diagnostics';
 const panel=doc.createElement('section');panel.id='performanceDiagnostics';panel.hidden=true;panel.setAttribute('aria-label','Performance diagnostics');
 const heading=doc.createElement('h3');heading.textContent='LIVE PERFORMANCE';const output=doc.createElement('pre');output.textContent='Waiting for frames…';
 const record=doc.createElement('button');record.type='button';record.textContent='Record 10 seconds';const live=doc.createElement('button');live.type='button';live.textContent='Live';const close=doc.createElement('button');close.type='button';close.textContent='Close';panel.append(heading,output,record,live,close);doc.body.appendChild(panel);
 const style=doc.createElement('style');style.textContent='#performanceDiagnostics{position:fixed;left:8px;top:calc(172px + env(safe-area-inset-top));z-index:950;width:274px;max-width:calc(100vw - 16px);box-sizing:border-box;background:#11151cf2;color:#ded8c6;border:3px double #9f8b62;padding:10px;font:12px monospace;pointer-events:auto}#performanceDiagnostics[hidden]{display:none}#performanceDiagnostics h3{font:12px monospace;color:#d5b779;margin:0 0 7px}#performanceDiagnostics pre{font:12px/1.5 monospace;white-space:pre-wrap;margin:0 0 8px}#performanceDiagnostics button{font:11px monospace;min-height:36px;padding:5px;margin-right:5px}';doc.head.appendChild(style);
 for(const event of ['pointerdown','pointerup','click'])panel.addEventListener(event,e=>e.stopPropagation());
 let visible=false,samples=[],recording=false,frozen=false,started=0,lastPaint=-Infinity,report=null;
 function show(value){visible=value;panel.hidden=!value;control.textContent=value?'Hide diagnostics':'Show diagnostics';if(value){samples=[];lastPaint=-Infinity;frozen=false;recording=false;heading.textContent='LIVE PERFORMANCE';record.disabled=false;}}
 control.onclick=()=>show(!visible);close.onclick=()=>show(false);
 record.onclick=()=>{samples=[];started=clock();recording=true;frozen=false;record.disabled=true;lastPaint=-Infinity;heading.textContent='RECORDING · 10 seconds';};
 live.onclick=()=>{samples=[];recording=false;frozen=false;record.disabled=false;lastPaint=-Infinity;heading.textContent='LIVE PERFORMANCE';};
 function paint(now){report=summarizeFrames(samples);if(!report)return;const r=report;output.textContent=`${r.fps.toFixed(1)} FPS · ${r.samples} frames
Frame avg ${r.averageMs.toFixed(1)} ms
p95 ${r.p95Ms.toFixed(1)} · worst ${r.worstMs.toFixed(1)} ms
Work ${r.workMs.toFixed(1)} ms · draw ${r.drawMs.toFixed(1)}
Game ${r.gameMs.toFixed(1)} · other ${Math.max(0,r.workMs-r.drawMs-r.gameMs).toFixed(1)} ms
Draw calls ${Math.round(r.calls)} avg
Triangles ${Math.round(r.triangles).toLocaleString()} avg
Buffer ${r.width} × ${r.height}
Views ${r.views} · ${r.profile}
Build ${r.build}`;lastPaint=now;}
 return {control,get visible(){return visible;},get report(){return report;},sample(frame){if(!visible||frozen||!Number.isFinite(frame.ms)||frame.ms<=0)return;const now=clock();samples.push({...frame});if(!recording){let span=samples.reduce((n,s)=>n+s.ms,0);while(samples.length>2&&span-samples[0].ms>=2000){span-=samples.shift().ms;}}if(recording){const left=Math.max(0,10-(now-started)/1000);if(now-lastPaint>=500)heading.textContent='RECORDING · '+left.toFixed(1)+' s left';if(now-started>=10000){recording=false;frozen=true;record.disabled=false;heading.textContent='10 SECOND CAPTURE · screenshot this';paint(now);return;}}if(now-lastPaint>=500)paint(now);},destroy(){panel.remove();style.remove();control.remove();}};
}
