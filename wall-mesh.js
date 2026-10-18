// One opaque extruded shell. Damage is sampled; authored apertures are analytic.
import {jaggedViewingHole} from './wall-damage.js?v=7ab9ee66430396ccf651b982597738c01913a015';
export function openingHeightAt(p, x) {
  const u = Math.max(-1, Math.min(1, (x - p.offset) / (p.width / 2)));
  if (p.opening === 'arch') return p.sill + p.openingHeight - (1 - Math.sqrt(Math.max(0, 1-u*u))) * p.width * .35;
  if (p.opening === 'gothic') {
    const rise = Math.min(p.openingHeight, p.width * Math.sqrt(3) / 2);
    return p.sill + p.openingHeight - rise * (1 - Math.sqrt(Math.max(0, 4-(1+Math.abs(u))**2)) / Math.sqrt(3));
  }
  return p.sill + p.openingHeight;
}
export function openingTopPoints(p, segments=64) {
  if (p.opening==='square') return [[p.offset-p.width/2,openingHeightAt(p,p.offset-p.width/2)],[p.offset+p.width/2,openingHeightAt(p,p.offset+p.width/2)]];
  return Array.from({length:segments+1},(_,i)=>{const x=p.offset-Math.cos(Math.PI*i/segments)*p.width/2;return [x,openingHeightAt(p,x)];});
}
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]];
const area=points=>points.reduce((n,p,i)=>n+cross(p,points[(i+1)%points.length]),0)/2;
function inside(point, polygon) {
  let result=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[i],b=polygon[j];
    if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])result=!result;
  }
  return result;
}
export const pointInWall=(contours,x,y)=>contours.reduce((value,loop)=>inside([x,y],loop)?!value:value,false);
const snap=p=>p.map(v=>Math.round(v*1e6)/1e6);
const key=p=>p[0]+','+p[1];
function trace(segments) {
  const edges=new Map();
  for(let[a,b]of segments){a=snap(a);b=snap(b);if(key(a)===key(b))continue;const k=key(a);if(!edges.has(k))edges.set(k,new Map());edges.get(k).set(key(b),b);}
  const loops=[];
  while(edges.size){const first=edges.keys().next().value,start=first.split(',').map(Number);let current=start,previous=null,points=[],guard=0;
    do{points.push(current);const k=key(current),choices=edges.get(k);if(!choices?.size)break;let next;
      if(choices.size===1||!previous)next=choices.values().next().value;
      else{const incoming=sub(current,previous);let best=-Infinity;for(const candidate of choices.values()){const d=sub(candidate,current),turn=Math.atan2(cross(incoming,d),incoming[0]*d[0]+incoming[1]*d[1]);if(turn>best){best=turn;next=candidate;}}}
      choices.delete(key(next));if(!choices.size)edges.delete(k);previous=current;current=next;if(++guard>100000)throw Error('Wall contour did not close');
    }while(key(current)!==first);
    if(key(current)!==first)throw Error('Open wall contour');
    points=points.filter((b,i,a)=>Math.abs(cross(sub(b,a[(i+a.length-1)%a.length]),sub(a[(i+1)%a.length],b)))>1e-11);
    if(points.length>=3&&Math.abs(area(points))>1e-9)loops.push(points);
  }
  return loops;
}
function subtractOpening(contours, aperture) {
  const wallEdges=contours.flatMap(loop=>loop.map((a,i)=>({a,b:loop[(i+1)%loop.length],cuts:[0,1]})));
  const holeEdges=aperture.map((a,i)=>({a,b:aperture[(i+1)%aperture.length],cuts:[0,1]}));
  for(const a of wallEdges)for(const b of holeEdges){
    const r=sub(a.b,a.a),s=sub(b.b,b.a),q=sub(b.a,a.a),den=cross(r,s);
    if(Math.abs(den)>1e-12){const t=cross(q,s)/den,u=cross(q,r)/den;if(t>=-1e-8&&t<=1+1e-8&&u>=-1e-8&&u<=1+1e-8){a.cuts.push(Math.max(0,Math.min(1,t)));b.cuts.push(Math.max(0,Math.min(1,u)));}}
    else if(Math.abs(cross(q,r))<1e-10){
      const project=(p,e)=>{const d=sub(e.b,e.a),length=d[0]**2+d[1]**2;return length?((p[0]-e.a[0])*d[0]+(p[1]-e.a[1])*d[1])/length:0;};
      for(const p of[b.a,b.b]){const t=project(p,a);if(t>0&&t<1)a.cuts.push(t);}for(const p of[a.a,a.b]){const t=project(p,b);if(t>0&&t<1)b.cuts.push(t);}
    }
  }
  const solid=p=>pointInWall(contours,p[0],p[1])&&!inside(p,aperture),segments=[];
  for(const edge of [...wallEdges,...holeEdges]){
    const cuts=[...new Set(edge.cuts.map(t=>Math.round(t*1e10)/1e10))].sort((a,b)=>a-b),d=sub(edge.b,edge.a);
    for(let i=1;i<cuts.length;i++){
      const a=[edge.a[0]+d[0]*cuts[i-1],edge.a[1]+d[1]*cuts[i-1]],b=[edge.a[0]+d[0]*cuts[i],edge.a[1]+d[1]*cuts[i]];
      const v=sub(b,a),length=Math.hypot(...v);if(length<1e-8)continue;
      const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2],epsilon=Math.min(2e-6,length*.02),left=solid([mid[0]-v[1]/length*epsilon,mid[1]+v[0]/length*epsilon]),right=solid([mid[0]+v[1]/length*epsilon,mid[1]-v[0]/length*epsilon]);
      if(left!==right)segments.push(left?[a,b]:[b,a]);
    }
  }
  return trace(segments);
}
function baseContours(recipe) {
  const {params:p,bricks}=recipe;
  if(!bricks.length)return [];
  if(p.ruin<=.22)return [[[-1.2,0],[1.2,0],[1.2,p.height],[-1.2,p.height]]];
  const step=.06,nx=40,ny=Math.ceil(p.height/step),dy=p.height/ny,filled=new Uint8Array(nx*ny),rows=Math.ceil(p.height/.30),survivors=new Set();
  // Restore each surviving source stone BEFORE analytically cutting its aperture.
  // wallRecipe fragments conservatively sample arches; they are not the contour.
  for(const b of bricks)survivors.add(Math.min(rows-1,Math.max(0,Math.floor(b.y/p.height*rows)))+','+Math.min(3,Math.max(0,Math.floor((b.x+1.2)/.6))));
  for(const item of survivors){const[r,c]=item.split(',').map(Number),x=-.9+c*.6,y=(r+.5)*p.height/rows,w=.575,h=p.height/rows-.025,margin=.016;
    for(let yy=Math.max(0,Math.floor((y-h/2-margin)/dy));yy<=Math.min(ny-1,Math.floor((y+h/2+margin)/dy));yy++)for(let xx=Math.max(0,Math.floor((x-w/2-margin+1.2)/step));xx<=Math.min(nx-1,Math.floor((x+w/2+margin+1.2)/step));xx++)if(!(p.ruin>=.82&&Math.abs(-1.2+(xx+.5)*step)<.6))filled[yy*nx+xx]=1;
  }
  const has=(x,y)=>x>=0&&x<nx&&y>=0&&y<ny&&filled[y*nx+x],edges=[],point=(x,y)=>[-1.2+x*step,y*dy],add=(x,y,xx,yy)=>edges.push([point(x,y),point(xx,yy)]);
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)if(has(x,y)){if(!has(x,y-1))add(x,y,x+1,y);if(!has(x+1,y))add(x+1,y,x+1,y+1);if(!has(x,y+1))add(x+1,y+1,x,y+1);if(!has(x-1,y))add(x,y+1,x,y);}
  return trace(edges);
}
export function wallBodyBlocked(contours,x,low,high,radius=0) {
  if(high<=low)return false;const left=x-radius,right=x+radius;
  for(const xx of[left,right])for(const y of[low,high])if(pointInWall(contours,xx,y))return true;
  for(const loop of contours)for(let i=0;i<loop.length;i++){
    const a=loop[i],b=loop[(i+1)%loop.length];if(a[0]>=left&&a[0]<=right&&a[1]>=low&&a[1]<=high)return true;
    let t0=0,t1=1;const dx=b[0]-a[0],dy=b[1]-a[1];let valid=true;
    for(const[p,q]of[[-dx,a[0]-left],[dx,right-a[0]],[-dy,a[1]-low],[dy,high-a[1]]]){if(Math.abs(p)<1e-12){if(q<0)valid=false;}else if(p<0)t0=Math.max(t0,q/p);else t1=Math.min(t1,q/p);}
    if(valid&&t0<=t1&&t1>=0&&t0<=1)return true;
  }
  return false;
}
export function buildWallGeometry(THREE,recipe) {
  const p=recipe.params;let contours=baseContours(recipe);
  if(p.opening!=='none'&&contours.length){const top=openingTopPoints(p),bottom=p.sill<=1e-8?-.1:p.sill,aperture=p.sightDamage==='viewhole'?jaggedViewingHole(p):[[p.offset-p.width/2,bottom],[p.offset+p.width/2,bottom],...top.slice().reverse()];contours=subtractOpening(contours,aperture);}
  const outers=contours.filter(loop=>area(loop)>0),holes=contours.filter(loop=>area(loop)<0);
  const shapes=outers.map(loop=>{const shape=new THREE.Shape(loop.map(([x,y])=>new THREE.Vector2(x,y)));for(const hole of holes)if(inside(hole[0],loop))shape.holes.push(new THREE.Path(hole.map(([x,y])=>new THREE.Vector2(x,y))));return shape;});
  let geometry;
  if(shapes.length){geometry=new THREE.ExtrudeGeometry(shapes,{depth:p.thickness,steps:1,bevelEnabled:false,curveSegments:1});geometry.translate(0,0,-p.thickness/2);}
  else{geometry=new THREE.BufferGeometry();for(const[name,size]of[['position',3],['normal',3],['uv',2]])geometry.setAttribute(name,new THREE.Float32BufferAttribute([],size));}
  const pos=geometry.attributes.position,uv=geometry.attributes.uv,normals=geometry.attributes.normal;
  for(let i=0;i<pos.count;i++){if(Math.abs(normals.getZ(i))>.5)uv.setXY(i,(pos.getX(i)+1.2)/2.4,pos.getY(i)/2.4);else if(Math.abs(normals.getY(i))>.5)uv.setXY(i,(pos.getX(i)+1.2)/2.4,(pos.getZ(i)+p.thickness/2)/2.4);else uv.setXY(i,(pos.getZ(i)+p.thickness/2)/4.8,pos.getY(i)/2.4);}
  uv.needsUpdate=true;geometry.userData.wallContours=contours;geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
