// One shared silhouette drives the heavy blade mesh and its committed contact.
// Local +Y points up the shaft; +Z is the blade's shallow thickness.
export const AXE_OUTLINE=Object.freeze([
 [-.18,.28],[-.48,.39],[-.9,.43],[-1.08,.24],[-1.1,-.05],
 [-.98,-.32],[-.8,-.49],[-.73,-.41],[-.66,-.57],[-.39,-.66],
 [0,-.7],[.39,-.66],[.68,-.56],[.73,-.44],[.83,-.48],
 [1.01,-.29],[1.1,-.03],[1.08,.24],[.9,.43],[.48,.39],[.18,.28]
].map(p=>Object.freeze(p)));
export const AXE_PIVOT=3.4,AXE_LENGTH=2.75,AXE_DEPTH=.18,AXE_BEVEL=.055;

export function buildPendulumAxe(THREE,parent,{box,mat}){
 const iron=mat('trapIron',0x454b49,{metalness:.6}),edge=mat('axeHonedEdge',0x807f75,{metalness:.35,roughness:.85}),wood=mat('axeShaft',0x493d2c,{roughness:1});
 const mount=box(parent,0,AXE_PIVOT+.07,0,.44,.14,.44,iron);mount.name='trap-axe-ceiling-mount';
 const pendulum=new THREE.Group();pendulum.name='trap-axe-pendulum';pendulum.position.y=AXE_PIVOT;parent.add(pendulum);
 const shaft=box(pendulum,0,-1.32,0,.13,2.64,.13,wood);shaft.name='trap-axe-shaft';
 for(const y of [-.24,-2.42]){const collar=box(pendulum,0,y,0,.2,.16,.2,iron);collar.name='trap-axe-shaft-collar';}
 const pin=new THREE.Mesh(new THREE.CylinderGeometry(.135,.135,.29,8),iron);pin.rotation.x=Math.PI/2;pin.userData.ownGeometry=true;pin.name='trap-axe-pivot';pendulum.add(pin);
 const shape=new THREE.Shape();AXE_OUTLINE.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
 const geometry=new THREE.ExtrudeGeometry(shape,{depth:AXE_DEPTH,steps:1,bevelEnabled:true,bevelSegments:1,bevelSize:AXE_BEVEL,bevelThickness:AXE_BEVEL,curveSegments:1});geometry.translate(0,0,-AXE_DEPTH/2);
 const blade=new THREE.Mesh(geometry,[iron,edge]);blade.position.y=-AXE_LENGTH;blade.userData.ownGeometry=true;blade.name='trap-axe-blade';pendulum.add(blade);
 return {pendulum,blade};
}

const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
function pointSegment(p,a,b){const x=b.x-a.x,y=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*x+(p.y-a.y)*y)/(x*x+y*y||1)));return Math.hypot(p.x-a.x-t*x,p.y-a.y-t*y);}
function segments(a,b,c,d){
 const x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);
 if(x*y<0&&z*w<0)return 0;
 return Math.min(pointSegment(a,c,d),pointSegment(b,c,d),pointSegment(c,a,b),pointSegment(d,a,b));
}
function inside(p){let odd=false;for(let i=0,j=AXE_OUTLINE.length-1;i<AXE_OUTLINE.length;j=i++){const [x,y]=AXE_OUTLINE[i],[u,v]=AXE_OUTLINE[j];if((y>p.y)!==(v>p.y)&&p.x<(u-x)*(p.y-y)/(v-y)+x)odd=!odd;}return odd;}

export function axeHitsActor(position,origin,swing,{radius=.22,height=1.7}={}){
 if(!Number.isFinite(swing)||![position?.x,position?.y,position?.z,origin?.x,origin?.y,origin?.z,radius,height].every(Number.isFinite)||radius<0||height<=.15)return false;
 if(Math.abs(position.z-origin.z)>AXE_DEPTH/2+AXE_BEVEL+radius)return false;
 const c=Math.cos(swing),s=Math.sin(swing),dx=position.x-origin.x;
 const local=y=>{const dy=position.y+y-origin.y-AXE_PIVOT;return {x:dx*c+dy*s,y:-dx*s+dy*c+AXE_LENGTH};};
 const a=local(.15),b=local(height);if(inside(a)||inside(b))return true;
 for(let i=0;i<AXE_OUTLINE.length;i++){const p=AXE_OUTLINE[i],q=AXE_OUTLINE[(i+1)%AXE_OUTLINE.length];if(segments(a,b,{x:p[0],y:p[1]},{x:q[0],y:q[1]})<=radius+AXE_BEVEL)return true;}
 return false;
}
