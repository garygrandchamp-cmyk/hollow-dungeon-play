import {openingHeightAt,openingTopPoints} from './wall-mesh.js?v=c83e4d4daa13c7855e4b7f872c6ac80790f66cde';
import {batchStaticGroup} from './mesh-batch.js?v=c83e4d4daa13c7855e4b7f872c6ac80790f66cde';

// Root wall X scaling is cancelled for hinges, then baked into leaf widths so
// doors retain their real width as they rotate rather than squashing in depth.
export function addArchedDoors({THREE,group,params:p,wood,iron,box,key,xScale=1}) {
  const assembly=new THREE.Group();assembly.name='arched-door-assembly';assembly.scale.x=1/xScale;group.add(assembly);
  const gap=.018,min=p.offset-p.width/2+gap,max=p.offset+p.width/2-gap,bottom=p.sill+.015,depth=.12;
  const leaves=p.style==='double'?[[min,p.offset,min,-1],[p.offset,max,max,1]]:[[min,max,min,-1]],result=[];
  for(const[left,right,pivot,sign]of leaves){
    const hinge=new THREE.Group();hinge.name='arched-door-hinge';hinge.position.set(pivot*xScale,0,-.02);hinge.userData.dynamic=true;assembly.add(hinge);
    const top=openingTopPoints(p).filter(([x])=>x>left&&x<right);
    top.unshift([left,openingHeightAt(p,left)]);top.push([right,openingHeightAt(p,right)]);
    const roof=top.map(([x,y])=>[(x-pivot)*xScale,Math.min(p.height-.025,y-.025)]);
    const l=(left-pivot)*xScale,r=(right-pivot)*xScale,points=[[l,bottom],[r,bottom],...roof.slice().reverse()];
    const shape=new THREE.Shape(points.map(([x,y])=>new THREE.Vector2(x,y)));
    if(p.style!=='bars'){
      const geo=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false});geo.translate(0,0,-depth/2);
      const mesh=new THREE.Mesh(geo,wood);mesh.userData.ownGeometry=true;hinge.add(mesh);
    }else{
      const n=Math.max(3,Math.ceil((right-left)*xScale/.17));
      for(let i=0;i<=n;i++){const x=left+(right-left)*i/n,high=Math.min(p.height-.025,openingHeightAt(p,x)-.025);if(high>bottom)box(hinge,(x-pivot)*xScale,(high+bottom)/2,0,.035,high-bottom,.06,iron);}
      const path=new THREE.CurvePath(),border=[[l,bottom],...roof,[r,bottom]];
      for(let i=1;i<border.length;i++)path.add(new THREE.LineCurve3(new THREE.Vector3(border[i-1][0],border[i-1][1],0),new THREE.Vector3(border[i][0],border[i][1],0)));
      const frame=new THREE.Mesh(new THREE.TubeGeometry(path,border.length*2,.023,5,false),iron);frame.userData.ownGeometry=true;hinge.add(frame);
    }
    const maxY=Math.max(...roof.map(p=>p[1]));
    for(const y of[bottom+.24,Math.min(bottom+1.12,maxY-.18)]){
      // Clip iron straps to the actual roof at this elevation.
      const above=points.filter(point=>point[1]>y+.025);let a=l,b=r;
      for(let i=0;i<roof.length-1;i++){const v=roof[i],w=roof[i+1];if((v[1]>y+.025)!==(w[1]>y+.025)){const x=v[0]+(w[0]-v[0])*(y+.025-v[1])/(w[1]-v[1]);if(v[1]<w[1])a=Math.max(a,x);else b=Math.min(b,x);}}
      if(above.length&&b>a)box(hinge,(a+b)/2,y,-depth/2-.018,b-a,.045,.025,iron);
    }
    const handleX=(sign===-1?r-.09:l+.09),handleY=Math.min(bottom+.85,maxY-.12);
    box(hinge,handleX,handleY,-depth/2-.035,.035,.13,.04,iron);
    // Root's box helper tags tall narrow props as static obstacles. Door bars
    // move with the hinge and are handled by doorBlocksBody, so they must not
    // leave frozen closed-pose AABBs in the architecture collider collection.
    hinge.traverse(o=>{if(o.isMesh)delete o.userData.solidObstacle;});
    batchStaticGroup(THREE,hinge);delete hinge.userData.collisionBoxes;
    hinge.traverse(o=>{if(o.isMesh){o.userData.dynamic=true;o.castShadow=o.receiveShadow=true;}});
    hinge.userData.doorProfile=points;hinge.userData.doorDepth=depth;
    result.push({hinge,key,sign});
  }
  return result;
}

// Exact horizontal circle vs transformed leaf prism, with its curved head
// clipped against the body's vertical span. Optional angle is logical target
// pose; it preserves the editor's immediate open/closed collision semantics.
export function doorBlocksBody(hinge,x,z,radius,low,high,angle=hinge.rotation.y) {
  const points=hinge.userData.doorProfile;if(!points?.length||high<=Math.min(...points.map(p=>p[1])))return false;
  const clipped=[];
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];if(a[1]>=low)clipped.push(a);
    if((a[1]>=low)!==(b[1]>=low))clipped.push([a[0]+(b[0]-a[0])*(low-a[1])/(b[1]-a[1]),low]);
  }
  if(!clipped.length)return false;
  const left=Math.min(...clipped.map(p=>p[0])),right=Math.max(...clipped.map(p=>p[0])),depth=hinge.userData.doorDepth;
  hinge.parent.updateWorldMatrix(true,false);
  const rotation=hinge.quaternion.clone().setFromAxisAngle(hinge.position.clone().set(0,1,0),angle);
  const matrix=hinge.parent.matrixWorld.clone().multiply(hinge.matrix.clone().compose(hinge.position,rotation,hinge.scale));
  const quad=[[left,-depth/2],[right,-depth/2],[right,depth/2],[left,depth/2]].map(([xx,zz])=>hinge.position.clone().set(xx,0,zz).applyMatrix4(matrix));
  let inside=false;
  for(let i=0,j=quad.length-1;i<quad.length;j=i++){
    const a=quad[i],b=quad[j];if((a.z>z)!==(b.z>z)&&x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)inside=!inside;
    const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));
    if((x-a.x-t*dx)**2+(z-a.z-t*dz)**2<radius*radius+1e-10)return true;
  }
  return inside;
}
