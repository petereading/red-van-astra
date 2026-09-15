import { ROADS, type Road } from './roads';
import { TOTAL_LENGTH } from './core';
import { trafficPoint } from './traffic';

export type GroundPatch = { x0:number; x1:number; z0:number; z1:number; material:string; y:number };
type Region = GroundPatch & { priority:number };
export const END_ROADS:Road[]=[
  {a:trafficPoint(-205),b:trafficPoint(0),name:'頭站引道',main:true},
  {a:trafficPoint(TOTAL_LENGTH),b:trafficPoint(TOTAL_LENGTH+205),name:'總站引道',main:true},
];
export const PLAYABLE_ROADS=[...ROADS,...END_ROADS];

/** Each square centimetre has one owner, including T-junctions and material joins. */
export function groundPatches():GroundPatch[]{
  const regions:Region[]=[];
  for(const [i,r] of PLAYABLE_ROADS.entries()){
    for(const asphalt of [false,true]){
      const half=asphalt?(r.main?11.5:9):(r.main?18:14.5);
      regions.push({x0:Math.min(r.a.x,r.b.x)-half,x1:Math.max(r.a.x,r.b.x)+half,z0:Math.min(r.a.z,r.b.z)-half,z1:Math.max(r.a.z,r.b.z)+half,
        material:asphalt?'@asphalt':r.main?['@redbrick:#b47762','@concrete:#c5c0ad','@pavers:#cdc8b5'][i%3]:'@concrete:#b8b5a2',y:asphalt?.133:.19,priority:asphalt?100:r.main?2:1});
    }
  }
  const xs=[...new Set(regions.flatMap(r=>[r.x0,r.x1]))].sort((a,b)=>a-b),zs=[...new Set(regions.flatMap(r=>[r.z0,r.z1]))].sort((a,b)=>a-b),patches:GroundPatch[]=[];
  for(let zi=1;zi<zs.length;zi++){
    let run:GroundPatch|undefined;
    for(let xi=1;xi<xs.length;xi++){
      const x=(xs[xi-1]+xs[xi])/2,z=(zs[zi-1]+zs[zi])/2;
      const owner=regions.filter(r=>x>r.x0&&x<r.x1&&z>r.z0&&z<r.z1).sort((a,b)=>b.priority-a.priority)[0];
      if(!owner){run=undefined;continue;}
      if(run&&run.x1===xs[xi-1]&&run.material===owner.material){run.x1=xs[xi];continue;}
      run={x0:xs[xi-1],x1:xs[xi],z0:zs[zi-1],z1:zs[zi],material:owner.material,y:owner.y};patches.push(run);
    }
  }
  return patches;
}
