"""Losslessly embed checked-in PixelLab frames, with atomic data publication."""
from pathlib import Path
from PIL import Image
import base64, hashlib, json, struct
HERE=Path(__file__).resolve().parent
manifest=json.loads((HERE/'provenance.json').read_text(encoding='utf-8'))

def encode(image,frames=1):
    raw=image.tobytes();colors={};palette=[];indices=[]
    for offset in range(0,len(raw),4):
        pixel=raw[offset:offset+4]
        if pixel not in colors:colors[pixel]=len(palette);palette.append(pixel)
        indices.append(colors[pixel])
    index_bytes=1 if len(palette)<=256 else 2
    runs=bytearray();last=indices[0];count=0
    for index in indices:
        if index!=last or count==65535:
            runs.extend(struct.pack('<BH' if index_bytes==1 else '<HH',last,count));last=index;count=0
        count+=1
    runs.extend(struct.pack('<BH' if index_bytes==1 else '<HH',last,count))
    return {'width':image.width,'height':image.height,'indexBytes':index_bytes,'frameCount':frames,'palette':b''.join(palette).hex(),'runs':base64.b64encode(runs).decode('ascii')},raw,len(palette)

encoded={}
for asset in manifest['assets']:
    path=HERE/(asset['key']+'.png');image=Image.open(path).convert('RGBA')
    value,raw,colors=encode(image,asset.get('frameCount',1))
    if asset['key']=='left-hand':value['plainHand']=True
    encoded[asset['key']]=value
    asset.update({'file':asset['key']+'.png','width':image.width,'height':image.height,'pngSHA256':hashlib.sha256(path.read_bytes()).hexdigest(),'rgbaSHA256':hashlib.sha256(raw).hexdigest(),'colors':colors,'transparentPixels':sum(raw[i]==0 for i in range(3,len(raw),4)),'visiblePixels':sum(raw[i]>0 for i in range(3,len(raw),4))})
    print(asset['key'],image.width,image.height,colors,'colors')
if 'left-hand' in encoded:
    # Old cached factory code still requests this key. It receives one plain
    # hand frame, never the superseded baked blue-flame art or a doubled atlas.
    alias,_,_=encode(Image.open(HERE/'left-hand-0.png').convert('RGBA'))
    alias['plainHand']=True;encoded['left-magic']=alias
output=(HERE/'../../equipment-sprite-data.js').resolve()
temporary=output.with_suffix('.js.tmp')
temporary.write_text('// Lossless PixelLab frames; atomic output of assets/equipment/pack.py.\nexport const EQUIPMENT_SPRITE_DATA='+json.dumps(encoded,separators=(',',':'))+';\n',encoding='utf-8')
temporary.replace(output)
temporary_manifest=HERE/'provenance.json.tmp'
temporary_manifest.write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
temporary_manifest.replace(HERE/'provenance.json')
