// Retire only encounter-owned visuals. Static dungeon geometry and shared
// materials belong to the scene builder and must survive an entity refresh.
export function retireEncounterVisuals(roots) {
  const active = [...new Set(roots.filter(root => root?.parent))];
  const owned = new Set(), disposed = new Set();
  for (const root of active) root.traverse(object => {
    if (object.userData.ownGeometry && object.geometry) owned.add(object.geometry);
  });
  const onDispose = event => disposed.add(event.target);
  for (const geometry of owned) geometry.addEventListener('dispose', onDispose);
  try {
    for (const root of active) {
      // A controller may remove children while disposing (blood overlays).
      const objects = []; root.traverse(object => objects.push(object));
      for (const object of objects) object.userData.disposeMaterials?.();
      root.removeFromParent();
    }
    for (const geometry of owned) if (!disposed.has(geometry)) geometry.dispose();
  } finally {
    for (const geometry of owned) geometry.removeEventListener('dispose', onDispose);
  }
  return active.length;
}
