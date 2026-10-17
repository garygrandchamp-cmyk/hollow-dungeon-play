import {writeFileSync} from 'node:fs';
import {deflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {MAGIC_THEMES,magicEffectPixels} from '../../equipment-magic.js?v=d254ffd0166a8bf116fdee214c40cf5e7905e9ad';
const crc=bytes=>{let value=0xffffffff;for(const b of bytes){value^=b;for(let n=0;n<8;n++)value=value&1?(value>>>1)^0xedb88320:value>>>1;}return (value^0xffffffff)>>>0;};
function chunk(type,data){const name=Buffer.from(type),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);name.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc(Buffer.concat([name,data])),data.length+8);return out;}
function png({width,height,data}){const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;const row=width*4,raw=Buffer.alloc((row+1)*height);for(let y=0;y<height;y++)Buffer.from(data.subarray(y*row,(y+1)*row)).copy(raw,y*(row+1)+1);return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);}
const manifest={method:'Procedural native-pixel elemental VFX. Independent effect artwork, never baked into the PixelLab hand.',themes:[]};
for(const theme of MAGIC_THEMES){const image=magicEffectPixels(theme),bytes=png(image);writeFileSync(new URL('./magic-effects/'+theme+'.png',import.meta.url),bytes);manifest.themes.push({theme,width:image.width,height:image.height,frames:image.frames,pngSHA256:createHash('sha256').update(bytes).digest('hex'),rgbaSHA256:createHash('sha256').update(image.data).digest('hex')});}
writeFileSync(new URL('./magic-effects/provenance.json',import.meta.url),JSON.stringify(manifest,null,2)+'\n');
