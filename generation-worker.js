import {tiles as workerTiles} from './wfc.js?v=b23c6bd9298aecfc45e3134840a59c28c03c1dce';
import {generateFloor} from './architecture.js?v=b23c6bd9298aecfc45e3134840a59c28c03c1dce';

export function normalizeGenerationOptions(value){
 if(!value||typeof value!=='object')throw TypeError('Generation options are required.');
 const {size}=value,scale=value.scale??'mixed',catalog=value.tiles,pins=value.pins??[[],[]];
 if(!Number.isInteger(size)||size<8||size>24)throw RangeError('Grid size must be an integer from 8 to 24.');
 if(!['intimate','mixed','grand'].includes(scale))throw RangeError('Unknown chamber scale.');
 if(!Array.isArray(catalog)||!catalog.length||catalog.some(tile=>!Array.isArray(tile?.s)||tile.s.length!==4||tile.s.some(s=>![0,1,2].includes(s))||!Number.isFinite(tile.weight)||tile.weight<=0))throw TypeError('A valid tile catalog is required.');
 if(!Array.isArray(pins)||pins.length!==2||pins.some(floor=>!Array.isArray(floor)))throw TypeError('Pins must contain one array per floor.');
 for(const floor of pins)for(const pin of floor){
  if(!pin||!Number.isInteger(pin.index)||pin.index<0||pin.index>=size*size)throw RangeError('Pinned cell is outside the grid.');
  if(pin.tile!==undefined){if(!Number.isInteger(pin.tile)||pin.tile<0||pin.tile>=catalog.length)throw RangeError('Pinned tile is outside the catalog.');}
  else if(!Array.isArray(pin.sockets)||pin.sockets.length!==4||pin.sockets.some(s=>s!==null&&![0,1,2].includes(s)))throw TypeError('Pinned sockets must contain four wall, passage, canal, or null values.');
 }
 return {size,seed:String(value.seed??''),scale,pins,tiles:catalog};
}

// Swap only for the synchronous solve, then restore the module's array in place.
// In the browser fallback this preserves the main app's live catalog identity;
// progress callbacks run after restoration and may safely alter their own state.
export function solveGenerationFloor(options,floor){
 if(floor!==0&&floor!==1)throw RangeError('Floor must be 0 or 1.');
 const previous=[...workerTiles];
 try{
  workerTiles.splice(0,workerTiles.length,...options.tiles);
  return generateFloor(options.size,options.seed+'-floor-'+floor,options.pins[floor],options.scale);
 }finally{workerTiles.splice(0,workerTiles.length,...previous);}
}

export function runGenerationJob(value,onProgress=()=>{}){
 const options=normalizeGenerationOptions(value),start=performance.now(),results=[];
 for(let floor=0;floor<2;floor++){
  results.push(solveGenerationFloor(options,floor));
  onProgress({floor,completed:floor+1,total:2,elapsedMs:performance.now()-start});
 }
 return {results,elapsedMs:performance.now()-start};
}

// `self` is also supplied by the Node test bridge; no browser objects are used
// by the job itself. Importing this file on the main thread installs nothing.
if(typeof self!=='undefined'&&typeof self.postMessage==='function'&&typeof document==='undefined'){
 self.onmessage=({data})=>{
  if(data?.type!=='generate')return;
  const requestId=data.requestId;
  try{
   const result=runGenerationJob(data.options,progress=>self.postMessage({type:'progress',requestId,...progress}));
   self.postMessage({type:'result',requestId,...result});
  }catch(error){self.postMessage({type:'error',requestId,error:{name:error?.name??'Error',message:error?.message??String(error)}});}
 };
}
