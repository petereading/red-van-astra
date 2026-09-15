import { clamp, onRoute, type DriveState, type V2 } from './core';
import { nearestRoad, projectRoad, roadPath } from './roads';
import { PLAYABLE_ROADS } from './pavement';

const points=PLAYABLE_ROADS.flatMap(r=>[r.a,r.b]);
export const MAP_BOUNDS={minX:Math.min(...points.map(p=>p.x))-40,maxX:Math.max(...points.map(p=>p.x))+40,minZ:Math.min(...points.map(p=>p.z))-40,maxZ:Math.max(...points.map(p=>p.z))+40};
export const BOUNDARY_GRACE=1.2;
export function outsideMap(p:V2){return p.x<MAP_BOUNDS.minX||p.x>MAP_BOUNDS.maxX||p.z<MAP_BOUNDS.minZ||p.z>MAP_BOUNDS.maxZ;}

/** Return to the nearest street, facing along its path back to the unfinished route. */
export function recoveryPose(from:V2,nextCheckpoint:number,busy:V2[]=[]):DriveState{
  const nearest=nearestRoad(from,PLAYABLE_ROADS),road=PLAYABLE_ROADS[nearest.index],dx=road.b.x-road.a.x,dz=road.b.z-road.a.z,length=Math.hypot(dx,dz),goal=onRoute(nextCheckpoint);
  let best:DriveState|undefined,bestClearance=-1;
  for(const offset of [0,-16,16,-32,32,-48,48]){
    const t=clamp(nearest.t+offset/length,14/length,1-14/length),center={x:road.a.x+dx*t,z:road.a.z+dz*t};
    const path=roadPath(center,goal),target=path.find(p=>Math.hypot(p.x-center.x,p.z-center.z)>3)??goal;
    // Snap the return bearing to this road's axis; do not spawn across a carriageway.
    const heading=projectRoad(center,road).heading+(dx*(target.x-center.x)+dz*(target.z-center.z)<0?Math.PI:0),lane=road.main?6:4;
    const pose={x:center.x-Math.cos(heading)*lane,z:center.z-Math.sin(heading)*lane,heading,speed:0};
    const clearance=Math.min(100,...busy.map(p=>Math.hypot(p.x-pose.x,p.z-pose.z)));
    if(clearance>bestClearance){best=pose;bestClearance=clearance;}if(clearance>13)return pose;
  }
  return best!;
}
