// Keep physical extents and world texture scale identical across render profiles.
export function createMasonryBoxGeometry(THREE,{simple=false}={}){
 if(simple)return new THREE.BoxGeometry(1,1,1);
 const shape=new THREE.Shape();shape.moveTo(-.465,-.465);shape.lineTo(.465,-.465);shape.lineTo(.465,.465);shape.lineTo(-.465,.465);shape.closePath();
 const geometry=new THREE.ExtrudeGeometry(shape,{depth:.93,bevelEnabled:true,bevelThickness:.035,bevelSize:.035,bevelSegments:1,steps:1});geometry.translate(0,0,-.465);return geometry;
}
export function renderPixelRatio(width,height,scale=2,safe=false){
 return 1/Math.max(safe?Math.ceil(Math.max(width,height)/640):1,Math.round(Number(scale)||2),1);
}
