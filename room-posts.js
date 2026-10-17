import {roomContainsWorld} from './room-footprint.js?v=05c9c484d8c647e1ae1ba04d4edb6e7962a3c4cb';
// Decorative posts belong near the perimeter, outside spawn/interaction space.
export function roomPosts(room, size, moduleSize, reservedIndices = []) {
  const center = i => [(i % size - (size-1)/2)*moduleSize, (Math.floor(i/size)-(size-1)/2)*moduleSize];
  const reserved = reservedIndices.map(center), result = [];
  const left = (room.x-(size-1)/2)*moduleSize-moduleSize/2+.7;
  const right = (room.x+room.w-1-(size-1)/2)*moduleSize+moduleSize/2-.7;
  const north = (room.z-(size-1)/2)*moduleSize-moduleSize/2+.7;
  const south = (room.z+room.h-1-(size-1)/2)*moduleSize+moduleSize/2-.7;
  for (const x of [left,right]) for (const z of [north,south]) {
    if (roomContainsWorld(room,x,z,size,moduleSize) && reserved.every(([rx,rz]) => Math.abs(x-rx)>1 || Math.abs(z-rz)>1)) result.push({x,z});
  }
  return result;
}
