// Baked geometry stays in memory. This only skips GPU submissions outside each
// explorer's fog range; collision, map data and live simulation are untouched.
export function createStaticCulling(THREE){
 let batches=[],lastRoot=null,lastRevision=-1,lastCount=-1;const origin=new THREE.Vector3();
 return {
  rebuild(root){
   root.updateMatrixWorld(true);lastRoot=root;lastRevision=root.userData.visibilityRevision??0;lastCount=root.children.length;batches=[];
   root.traverse(mesh=>{
    if(!mesh.isMesh||!mesh.userData.staticBatch||mesh.userData.dynamic)return;let parent=mesh.parent;while(parent&&parent!==root){if(parent.userData.dynamic)return;parent=parent.parent;}
    if(mesh.isInstancedMesh){if(!mesh.boundingSphere)mesh.computeBoundingSphere();}
    else if(!mesh.geometry.boundingSphere)mesh.geometry.computeBoundingSphere();
    const sphere=(mesh.isInstancedMesh?mesh.boundingSphere:mesh.geometry.boundingSphere)?.clone();
    if(sphere){mesh.updateMatrix();mesh.matrixAutoUpdate=false;sphere.applyMatrix4(mesh.matrixWorld);batches.push({mesh,sphere});}
   });
   return batches.length;
  },
  prepare(camera,{distance=30,overhead=false}={}){
   if(lastRoot&&((lastRoot.userData.visibilityRevision??0)!==lastRevision||lastRoot.children.length!==lastCount))this.rebuild(lastRoot);
   if(overhead||!Number.isFinite(distance)||distance<=0)return()=>{};
   camera.getWorldPosition(origin);const hidden=[];
   for(const {mesh,sphere}of batches)if(mesh.visible&&sphere.center.distanceToSquared(origin)>(distance+sphere.radius)**2){mesh.visible=false;hidden.push(mesh);}
   return()=>{for(const mesh of hidden)mesh.visible=true;};
  }
 };
}
