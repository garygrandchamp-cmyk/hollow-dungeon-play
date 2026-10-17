"""Weathered code-native props plus losslessly packed PixelLab torch artwork."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import base64, hashlib, json, struct
HERE=Path(__file__).resolve().parent
INK='#111319'; DARK='#24282d'; DEEP='#30363b'; STEEL='#59656a'; EDGE='#8a9593'; LIGHT='#bcc1af'
WOOD='#493326'; WARM='#705039'; GRAIN='#98704b'; GOLD='#bd8c38'; GLOW='#f5c65a'; MOSS='#46533a'
W,H=64,96

def canvas():
 im=Image.new('RGBA',(W,H));return im,ImageDraw.Draw(im)
def poly(d,xy,fill,outline=INK):
 d.polygon(xy,fill=fill);d.line(xy+[xy[0]],fill=outline,width=1)
def rect(d,xy,fill,outline=INK):d.rectangle(xy,fill=fill,outline=outline)
def shadow(d):d.ellipse((6,85,59,94),fill=(9,11,14,95))
def rivet(d,x,y):d.rectangle((x,y,x+2,y+2),fill=INK);d.point((x,y),fill=EDGE)
def torch(frame):
 im,d=canvas();rect(d,(25,39,38,91),DARK);rect(d,(28,41,35,88),DEEP);rivet(d,30,44);rivet(d,30,83)
 poly(d,[(33,69),(46,61),(46,49),(41,49),(41,58),(31,63)],STEEL);d.line((34,65,43,59,43,52),fill=EDGE,width=1)
 rect(d,(35,31,42,57),WOOD);rect(d,(36,33,38,55),GRAIN)
 for y in [35,42,49]:d.line((35,y,42,y),fill=INK,width=2)
 poly(d,[(28,47),(49,47),(46,58),(33,58)],DARK);d.line((29,48,48,48),fill=EDGE,width=2);d.line((34,56,45,56),fill=STEEL)
 shift=[-2,0,2,-1][frame];tip=[7,3,6,9][frame]
 poly(d,[(33,45),(27,36),(30,22),(35+shift,27),(37+shift,tip),(44+shift,19),(43,28),(49,22),(50,35),(44,46)],'#9a3c26')
 poly(d,[(34,44),(31,35),(35,24),(38+shift,31),(40+shift,14),(44,27),(43,37),(46,31),(45,43)],'#e57a2a',outline='#b65125')
 poly(d,[(36,43),(35,34),(39,28),(39,37),(43,34),(42,43)],'#ffd875',outline='#f5bd46')
 d.point((37+shift,tip-3),fill=GLOW);d.point((47,17+frame*2),fill='#d96d2d');return im

def chest(opened):
 im,d=canvas();shadow(d)
 poly(d,[(8,53),(48,49),(58,58),(56,86),(16,91),(7,81)],WOOD)
 poly(d,[(16,62),(56,58),(56,84),(16,89)],WARM);d.line((19,66,52,62),fill=GRAIN);d.line((19,78,53,74),fill=WOOD)
 for x in [18,44]:poly(d,[(x,61),(x+5,60),(x+5,87),(x,88)],STEEL);rivet(d,x+1,66);rivet(d,x+1,81)
 if opened:
  poly(d,[(8,50),(7,28),(18,17),(50,23),(56,46)],WOOD);poly(d,[(12,46),(12,29),(20,23),(47,28),(50,44)],DARK)
  d.line((13,28,47,27),fill=GRAIN,width=2)
  for x in [14,44]:d.line((x,27,x+2,45),fill=STEEL,width=4)
  poly(d,[(10,52),(48,48),(55,56),(16,62)],INK)
  for x,y in [(21,54),(27,52),(35,54),(42,51),(46,56),(31,57)]:d.ellipse((x-3,y-2,x+3,y+2),fill=GOLD,outline=WOOD);d.point((x,y-1),fill=GLOW)
 else:
  poly(d,[(7,54),(9,42),(18,34),(46,32),(56,42),(58,57),(16,63)],WARM)
  poly(d,[(16,59),(18,42),(45,39),(54,44),(55,55)],GRAIN,outline=WOOD)
  for x in [18,44]:poly(d,[(x-2,37),(x+3,36),(x+7,58),(x+2,60)],STEEL);d.line((x,39,x+4,56),fill=EDGE)
 rect(d,(31,58,38,72),GOLD);rect(d,(33,62,36,69),INK);d.point((34,63),fill=LIGHT);return im

def shrine():
 im,d=canvas();shadow(d);poly(d,[(11,81),(24,73),(52,77),(58,85),(44,93),(8,88)],DEEP);poly(d,[(18,73),(19,52),(47,49),(48,80),(26,86)],STEEL)
 d.line((21,55,22,78,29,82),fill=EDGE,width=2);poly(d,[(14,51),(26,44),(51,48),(48,57),(23,61)],EDGE)
 rect(d,(29,63,37,76),DARK);d.line((33,65,30,69,35,69,32,74),fill='#75d8db',width=1)
 poly(d,[(34,11),(46,27),(40,44),(29,47),(22,30)],'#214b69');poly(d,[(34,13),(34,43),(25,30)],'#4c9cbd',outline='#274f70');poly(d,[(35,13),(43,27),(36,39)],'#9ce6ee',outline='#5ac3d6')
 for x,y in [(17,26),(48,20),(19,43),(48,41)]:d.line((x-2,y,x+2,y),fill='#73cfd5');d.line((x,y-2,x,y+2),fill='#73cfd5')
 return im

def relic():
 im,d=canvas();d.ellipse((10,40,55,66),outline='#805c2c',width=2);poly(d,[(33,12),(48,37),(39,65),(27,70),(15,43)],'#a65b25');poly(d,[(32,16),(30,63),(18,42)],'#f1b447',outline='#bc762b');poly(d,[(34,17),(44,37),(34,58)],'#ffe08c',outline='#df9e37');d.line((21,43,39,44),fill='#8e4a21')
 for x,y in [(13,28),(51,51),(32,78),(51,20)]:d.line((x-2,y,x+2,y),fill=GLOW);d.line((x,y-2,x,y+2),fill=GLOW)
 return im

def crate():
 im,d=canvas();shadow(d);poly(d,[(8,38),(43,29),(58,41),(56,84),(22,92),(8,81)],WOOD);poly(d,[(11,42),(43,36),(43,85),(22,88),(11,79)],WARM);poly(d,[(45,37),(55,44),(54,81),(45,85)],WOOD)
 for x in [17,27,37]:d.line((x,43,x,83),fill=WOOD)
 for y in [50,65,78]:d.line((12,y,40,y-3),fill=GRAIN)
 poly(d,[(12,43),(17,42),(41,81),(37,85)],GRAIN);poly(d,[(36,38),(41,37),(17,84),(12,81)],GRAIN)
 for x,y in [(9,40),(39,33),(51,42),(9,75),(44,80)]:rect(d,(x,y,x+6,y+6),DARK);rivet(d,x+2,y+2)
 return im

def rubble():
 im,d=canvas();shadow(d)
 stones=[([(8,85),(10,74),(21,69),(28,79),(24,91)],DEEP), ([(19,80),(22,62),(35,60),(44,72),(37,87)],STEEL), ([(34,87),(38,69),(51,71),(58,86),(47,94)],DEEP), ([(11,92),(16,84),(31,85),(35,93)],STEEL), ([(34,69),(36,56),(44,52),(50,63),(46,73)],'#72766b')]
 for pts,c in stones:poly(d,pts,c);d.line(pts[:3],fill=EDGE,width=1)
 for x,y in [(9,91),(53,92),(30,94),(17,71)]:rect(d,(x,y,x+3,y+2),DEEP)
 d.line((23,67,32,64,29,73),fill=DARK);d.line((41,76,48,73),fill=MOSS,width=2);return im

def spikes(active):
 im,d=canvas();shadow(d);poly(d,[(7,77),(28,68),(58,77),(39,93),(9,86)],DARK);poly(d,[(10,77),(29,72),(54,78),(38,88),(11,83)],STEEL)
 places=[(17,80,47),(29,77,35),(42,80,43),(28,86,53)]
 for x,y,tip in places:
  d.ellipse((x-5,y-2,x+5,y+3),fill=INK)
  if active:poly(d,[(x-4,y),(x,tip),(x+4,y+1)],STEEL);poly(d,[(x-3,y),(x,tip+2),(x,y)],LIGHT,outline=EDGE)
  else:d.line((x-3,y,x+2,y-1),fill=EDGE,width=2)
 for x,y in [(10,78),(45,78),(36,88)]:rivet(d,x,y)
 return im

def tomb():
 im,d=canvas();shadow(d);poly(d,[(9,52),(24,31),(47,38),(59,73),(49,91),(15,84),(7,69)],DEEP);poly(d,[(8,46),(23,24),(44,31),(57,66),(47,84),(14,76)],'#71766c');poly(d,[(14,46),(25,31),(40,36),(49,64),(43,75),(19,69)],STEEL)
 d.line((12,46,24,28,43,35),fill=LIGHT,width=2);d.line((16,75,45,82,55,67),fill=EDGE)
 d.ellipse((25,36,36,46),fill=LIGHT,outline=DEEP);d.rectangle((28,42,34,46),fill=DARK);d.point((28,40),fill=INK);d.point((33,41),fill=INK)
 poly(d,[(26,48),(36,47),(41,65),(31,68),(23,59)],EDGE);d.line((25,52,38,59,27,61,37,52),fill=DEEP,width=2)
 d.line((11,61,17,65,15,69),fill=MOSS,width=2);d.line((44,70,49,65),fill=DARK);return im

def bookshelf():
 im,d=canvas();shadow(d);rect(d,(9,10,55,91),WOOD);rect(d,(14,16,50,87),INK);rect(d,(7,7,57,15),WARM);rect(d,(6,88,58,94),WARM)
 colors=['#6b3c38','#4e615a','#746348','#51445e','#8a7657','#334953']
 for row,y in enumerate([18,41,64]):
  x=15
  for i in range(7):
   height=15+(i*3+row)%7;rect(d,(x,y+21-height,x+4,y+20),colors[(i+row)%len(colors)]);d.line((x+1,y+23-height,x+3,y+23-height),fill=GOLD);d.point((x+1,y+17),fill=EDGE);x+=5
  rect(d,(12,y+22,52,y+25),WARM);d.line((13,y+22,51,y+22),fill=GRAIN)
 d.line((10,18,10,86),fill=GRAIN);d.line((53,18,53,86),fill=DARK);return im

def barrel():
 im,d=canvas();shadow(d);poly(d,[(14,28),(23,20),(43,21),(52,30),(56,64),(50,86),(35,92),(17,85),(9,63)],WARM)
 for x in [18,26,35,44]:d.line((x,31,x-3,62,x,86),fill=WOOD,width=2)
 d.ellipse((13,17,51,36),fill=GRAIN,outline=INK);d.ellipse((17,21,47,31),fill=WOOD,outline=WARM);d.line((20,24,44,28),fill=GRAIN);d.line((31,21,28,30),fill=INK)
 for y in [37,70]:poly(d,[(11,y),(53,y-1),(55,y+5),(10,y+6)],STEEL);d.line((13,y+1,51,y),fill=EDGE);rivet(d,18,y+2);rivet(d,44,y+1)
 d.line((18,82,27,88,43,87),fill=GRAIN);return im

def banner():
 im,d=canvas();rect(d,(8,12,56,16),STEEL);d.line((11,12,53,12),fill=EDGE);rivet(d,7,12);rivet(d,55,12)
 poly(d,[(15,17),(49,17),(48,87),(42,83),(38,92),(32,85),(26,90),(22,82),(15,86)],'#662e35');poly(d,[(19,21),(26,20),(24,81),(20,79)],'#8a4142',outline='#78373c');rect(d,(44,20,47,79),'#48252e',outline='#48252e')
 poly(d,[(32,34),(40,48),(32,64),(24,48)],GOLD);poly(d,[(32,41),(35,48),(32,56),(29,48)],'#edce73');d.line((25,69,39,69),fill=GOLD,width=2);return im

def basin():
 im,d=canvas();shadow(d);poly(d,[(6,53),(15,43),(48,43),(58,54),(54,83),(39,93),(12,85)],STEEL);d.ellipse((6,40,58,65),fill=EDGE,outline=INK);d.ellipse((12,45,52,60),fill='#24434d',outline=DEEP);d.arc((14,46,50,59),0,180,fill='#588b91',width=2);d.line((19,50,25,48,30,50),fill='#7aaeb2')
 d.line((8,62,14,81,38,89,53,80),fill=EDGE,width=2);rect(d,(24,68,37,78),DEEP);d.line((26,71,34,72,28,75),fill='#727969');d.line((49,66,47,77),fill=MOSS,width=2);return im

def spiderweb():
 im,d=canvas();anchor=(8,8);rays=[(58,10),(55,29),(45,50),(29,73),(10,91)];web=(145,155,147,190)
 for end in rays:d.line([anchor,end],fill=web,width=1)
 for fraction in [.22,.44,.66,.88,1.0]:
  points=[(round(anchor[0]+(x-anchor[0])*fraction),round(anchor[1]+(y-anchor[1])*fraction)) for x,y in rays]
  for i in range(len(points)-1):
   a,b=points[i],points[i+1];middle=((a[0]+b[0])//2-2,(a[1]+b[1])//2+2);d.line([a,middle,b],fill=web,width=1)
 d.line((29,38,29,53),fill=(159,171,164,170));d.ellipse((26,52,32,58),fill=INK);d.ellipse((27,48,31,53),fill=DARK)
 for side in [-1,1]:
  for y in [51,53,55]:d.line((29+side*2,y,29+side*6,y-3,29+side*8,y-1),fill=INK)
 return im

def drip(frame):
 im,d=canvas();d.line((30,5,32,15,30,26,34,35,33,48),fill=(42,71,77,200),width=4);d.line((30,7,31,18,30,27,33,37,32,47),fill=(105,151,155,210),width=1)
 d.line((35,12,37,25,36,39),fill=(42,71,77,150),width=2)
 y=[53,65,77,89][frame];poly(d,[(32,y-6),(29,y),(29,y+3),(32,y+5),(35,y+2),(35,y)],(83,137,150,255),outline=(35,69,82,255));d.line((31,y-1,30,y+2,32,y+3),fill=(156,198,199,255))
 if frame>1:d.point((32,53),fill=(105,151,155,200))
 return im

def weather(image,kind):
 if kind in ('spiderweb','drip'):return image
 # Clustered material wear stays on existing opaque interior pixels. It creates
 # pitted metal and irregular wood grain without growing a comic-book outline.
 out=image.copy();src=image.load();dst=out.load()
 for y in range(1,H-1):
  for x in range(1,W-1):
   r,g,b,a=src[x,y]
   if a<128 or min(src[x-1,y][3],src[x+1,y][3],src[x,y-1][3],src[x,y+1][3])<128:continue
   if max(r,g,b)<32 or max(r,g,b)>205:continue
   h=((x//2)*73856093)^((y//3)*19349663)^((x+y)*83492791)
   shade=[-20,-10,-5,0,3,8][h%6]
   if kind in ('crate','chest','barrel','bookshelf','banner') and x%7==2 and h%3:shade-=8
   if max(r,g,b)-min(r,g,b)<24 and h%13==0:r,g,b=(r*3+76)//4,(g*3+52)//4,(b*3+36)//4
   dst[x,y]=(max(0,min(255,r+shade)),max(0,min(255,g+shade)),max(0,min(255,b+shade)),a)
 return out

recipes={'torch':[torch(i) for i in range(4)],'chest':[chest(False),chest(True)],'shrine':[shrine()],'relic':[relic()],'crate':[crate()],'rubble':[rubble()],'spikes':[spikes(False),spikes(True)],'tomb':[tomb()],'bookshelf':[bookshelf()],'barrel':[barrel()],'banner':[banner()],'basin':[basin()],'spiderweb':[spiderweb()],'drip':[drip(i) for i in range(4)]}
torch_files=[HERE/('torch-'+str(i)+'.png') for i in range(4)]
pixellab_torch=all(path.exists() for path in torch_files)
if not pixellab_torch:raise RuntimeError('All four genuine PixelLab torch frames are required; refusing the old procedural torch fallback.')
if pixellab_torch:recipes['torch']=[Image.open(path).convert('RGBA') for path in torch_files]
for kind in recipes:
 if kind!='torch':recipes[kind]=[weather(frame,kind) for frame in recipes[kind]]
painterly_path=HERE/'painterly-provenance.json'
painterly=json.loads(painterly_path.read_text()) if painterly_path.exists() else {'assets':[]}
pixellab_kinds=set()
for asset in painterly['assets']:
 paths=[HERE/name for name in asset['files']]
 if not all(path.exists() for path in paths):raise RuntimeError('Missing painterly source frames for '+asset['key']+'; refusing to replace them with flat procedural art.')
 if all(path.exists() for path in paths):
  recipes[asset['key']]=[Image.open(path).convert('RGBA') for path in paths];pixellab_kinds.add(asset['key'])
  asset['sourceFiles']=[{'file':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()} for path in paths]
columns=5;frame_count=sum(len(frames) for frames in recipes.values())
atlas_width=512;placements=[];px=py=row_height=0
for frames in recipes.values():
 for frame in frames:
  if px+frame.width>atlas_width:px=0;py+=row_height;row_height=0
  placements.append((px,py));px+=frame.width;row_height=max(row_height,frame.height)
atlas=Image.new('RGBA',(atlas_width,py+row_height));metadata={};index=0
for kind,frames in recipes.items():
 bounds=[im.getchannel('A').point(lambda a: 255 if a >= 128 else 0).getbbox() for im in frames];left=min(b[0] for b in bounds);top=min(b[1] for b in bounds);right=max(b[2] for b in bounds);bottom=max(b[3] for b in bounds)
 locations=[]
 for frame in frames:
  x,y=placements[index];atlas.paste(frame,(x,y));locations.append({'x':x+left,'y':y+top,'width':right-left,'height':bottom-top});index+=1
 metadata[kind]={'frames':locations,'width':right-left,'height':bottom-top,'trim':[left,top,right,bottom],'nativeFrame':list(frames[0].size),'fps':8 if kind=='torch' else 6 if kind=='drip' else 0,'source':'PixelLab Pixen + animate_image' if kind=='torch' and pixellab_torch else 'PixelLab Pixen + edit_image_pixen' if kind=='chest' and kind in pixellab_kinds else 'PixelLab Pixen' if kind in pixellab_kinds else 'code-native weathered pixels'}
atlas.save(HERE/'prop-atlas.png')
raw=atlas.tobytes();colors={};palette=[];indices=[]
for offset in range(0,len(raw),4):
 pixel=raw[offset:offset+4]
 if pixel not in colors:colors[pixel]=len(palette);palette.append(pixel)
 indices.append(colors[pixel])
index_bytes=1 if len(palette)<=256 else 2
runs=bytearray();last=indices[0];count=0
for value in indices:
 if value!=last or count==65535:runs.extend(struct.pack('<BH' if index_bytes==1 else '<HH',last,count));last=value;count=0
 count+=1
runs.extend(struct.pack('<BH' if index_bytes==1 else '<HH',last,count))
data={'width':atlas.width,'height':atlas.height,'indexBytes':index_bytes,'palette':b''.join(palette).hex(),'runs':base64.b64encode(runs).decode(),'kinds':metadata}
(HERE/'../../prop-sprite-data.js').resolve().write_text('// Mixed PixelLab torch and weathered code-native prop atlas; see assets/props/provenance.json.\nexport const PROP_SPRITE_DATA='+json.dumps(data,separators=(',',':'))+';\n',encoding='utf-8')
manifest={'method':'Genuine PixelLab torch and painterly key furnishings; remaining props are hand-authored code-native pixels with clustered wear shading. No 3D-rendered props.','permission':'User requested gritty realistic Diablo-II-inspired pixel shading, with all props remaining sprites.','nativeFrame':[W,H],'torchNativeFrame':[128,192] if pixellab_torch else [W,H],'atlasSize':list(atlas.size),'colors':len(palette),'pngSHA256':hashlib.sha256((HERE/'prop-atlas.png').read_bytes()).hexdigest(),'rgbaSHA256':hashlib.sha256(raw).hexdigest(),'kinds':metadata,'painterly':painterly}
if pixellab_torch:
 manifest['torch']=json.loads((HERE/'torch-provenance.json').read_text())
 manifest['torch']['files']=[{'file':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()} for path in torch_files]
(HERE/'provenance.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
# An inspection sheet composites only for review; runtime atlas keeps true alpha.
rows=(frame_count+columns-1)//columns
sheet=Image.new('RGB',(columns*W*2,rows*(H*2+22)),(18,21,25));d=ImageDraw.Draw(sheet);index=0
for kind,frames in recipes.items():
 for f,frame in enumerate(frames):
  x=(index%columns)*W*2;y=(index//columns)*(H*2+22);scale=min(W*2/frame.width,H*2/frame.height);large=frame.resize((round(frame.width*scale),round(frame.height*scale)),Image.Resampling.NEAREST);sheet.paste(large,(x+(W*2-large.width)//2,y+H*2-large.height),large);d.text((x+5,y+H*2+3),kind+' '+str(f),fill=(205,193,160));index+=1
sheet.save(HERE/'contact-sheet.png')
print('Props:',len(recipes),'kinds,',frame_count,'frames,',atlas.size,',',len(palette),'colors,',len(runs),'RLE bytes')

