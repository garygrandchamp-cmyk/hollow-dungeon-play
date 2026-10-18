let worker=null,active=null,sequence=0;
const yieldToPage=()=>new Promise(resolve=>setTimeout(resolve,0));
function abortError(){const error=new Error('Generation canceled by a newer request or cancelGeneration().');error.name='AbortError';return error;}
function releaseWorker(){const old=worker;worker=null;old?.terminate();}
export function cancelGeneration(){const pending=active;active=null;releaseWorker();pending?.reject(abortError());}
function fail(error){const pending=active;active=null;releaseWorker();pending?.reject(error);}
function progress(pending,value){
 if(active!==pending)return;
 try{pending.onProgress?.(value);}catch(error){if(active===pending)fail(error);}
}
function getWorker(){
 if(worker)return worker;
 const instance=new Worker(new URL('./generation-worker.js?v=5ac77501c6c8fbc7bdffe3074112354f4264b8e7',import.meta.url),{type:'module',name:'dungeon-generation'});
 worker=instance;
 instance.addEventListener('message',({data})=>{
  if(worker!==instance||!active||data?.requestId!==active.id)return;
  const pending=active;
  if(data.type==='progress')progress(pending,{floor:data.floor,completed:data.completed,total:data.total,elapsedMs:data.elapsedMs});
  else if(data.type==='result'){active=null;pending.resolve({results:data.results,elapsedMs:data.elapsedMs});}
  else if(data.type==='error'){const error=new Error(data.error?.message??'Dungeon generation failed.');error.name=data.error?.name??'Error';fail(error);}
 });
 instance.addEventListener('error',event=>{if(worker!==instance)return;event.preventDefault?.();fail(event.error??new Error(event.message??'Generation worker failed.'));});
 instance.addEventListener('messageerror',()=>{if(worker===instance)fail(new Error('Could not decode the generation worker response.'));});
 return instance;
}
async function fallback(pending,options){
 try{
  // Yield before importing/solving so a loading state can paint first. A worker
  // is required for responsiveness during each individual synchronous solve.
  await yieldToPage();if(active!==pending)return;
  const {normalizeGenerationOptions,solveGenerationFloor}=await import('./generation-worker.js?v=5ac77501c6c8fbc7bdffe3074112354f4264b8e7');
  if(active!==pending)return;
  const normalized=normalizeGenerationOptions(options),results=[],start=performance.now();
  for(let floor=0;floor<2;floor++){
   if(floor){await yieldToPage();if(active!==pending)return;}
   results.push(solveGenerationFloor(normalized,floor));
   progress(pending,{floor,completed:floor+1,total:2,elapsedMs:performance.now()-start});
   if(active!==pending)return;
  }
  active=null;pending.resolve({results,elapsedMs:performance.now()-start});
 }catch(error){if(active===pending)fail(error);}
}

export async function generateLevels(options,onProgress){
 if(active)cancelGeneration();
 // Snapshot immediately: callers can continue editing their catalog and pins
 // while a worker runs or the fallback waits for its first turn.
 const snapshot=structuredClone({size:options?.size,seed:options?.seed,scale:options?.scale,pins:options?.pins,tiles:options?.tiles});
 return new Promise((resolve,reject)=>{
  const pending={id:++sequence,resolve,reject,onProgress};active=pending;
  if(typeof Worker!=='function'){void fallback(pending,snapshot);return;}
  let instance;
  try{instance=getWorker();}catch{releaseWorker();void fallback(pending,snapshot);return;}
  try{instance.postMessage({type:'generate',requestId:pending.id,options:snapshot});}catch(error){if(active===pending)fail(error);}
 });
}
