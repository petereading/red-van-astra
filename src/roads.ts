import { ROUTE, TOTAL_LENGTH, CUMULATIVE, onRoute, projectRoute, clamp, angleDiff, type V2, type DriveState } from './core';

export type Road = { a: V2; b: V2; name: string; main: boolean };
const branches: { name:string; points:V2[] }[] = [
  {name:'海棠街',points:[{x:0,z:-80},{x:-120,z:-80},{x:-120,z:-280},{x:80,z:-280},{x:80,z:-180}]},
  {name:'景業道',points:[{x:180,z:-280},{x:320,z:-280},{x:320,z:-480},{x:80,z:-480},{x:80,z:-380}]},
  {name:'學園街',points:[{x:-20,z:-480},{x:-140,z:-480},{x:-140,z:-660},{x:100,z:-660},{x:100,z:-580}]},
  {name:'霓虹街',points:[{x:220,z:-680},{x:350,z:-680},{x:350,z:-860},{x:220,z:-860},{x:220,z:-760}]},
];
export const SIDE_ROADS:Road[]=branches.flatMap(r=>r.points.slice(1).map((b,i)=>({a:r.points[i],b,name:r.name,main:false})));
export const ROADS:Road[]=[...ROUTE.slice(1).map((b,i)=>({a:ROUTE[i],b,name:'主路線',main:true})),...SIDE_ROADS];
const distance=(a:V2,b:V2)=>Math.hypot(a.x-b.x,a.z-b.z);
export function projectRoad(p:V2,road:Road){const dx=road.b.x-road.a.x,dz=road.b.z-road.a.z,t=clamp(((p.x-road.a.x)*dx+(p.z-road.a.z)*dz)/(dx*dx+dz*dz),0,1),point={x:road.a.x+dx*t,z:road.a.z+dz*t};return{...point,t,distance:distance(p,point),heading:Math.atan2(dx,-dz)};}
export function nearestRoad(p:V2,roads=ROADS){let index=0,best=projectRoad(p,roads[0]);roads.forEach((r,i)=>{const q=projectRoad(p,r);if(q.distance<best.distance){best=q;index=i;}});return{...best,index,name:roads[index].name};}
export function nearSideRoad(p:V2,margin:number){return SIDE_ROADS.some(r=>projectRoad(p,r).distance<margin);}
export function roadDistance(p:V2){return nearestRoad(p).distance;}

function intersection(a:Road,b:Road):V2|undefined{
  const av=a.a.x===a.b.x,bv=b.a.x===b.b.x;if(av===bv)return;
  const v=av?a:b,h=av?b:a,p={x:v.a.x,z:h.a.z};
  if(p.x>=Math.min(h.a.x,h.b.x)&&p.x<=Math.max(h.a.x,h.b.x)&&p.z>=Math.min(v.a.z,v.b.z)&&p.z<=Math.max(v.a.z,v.b.z))return p;
}
/** Roads are split at every real intersection. Recovery never points through a building. */
export function roadPath(from:V2,to:V2):V2[]{
  const start=nearestRoad(from),goal=nearestRoad(to),points:V2[][]=ROADS.map(r=>[r.a,r.b]);
  for(let i=0;i<ROADS.length;i++)for(let j=i+1;j<ROADS.length;j++){const p=intersection(ROADS[i],ROADS[j]);if(p){points[i].push(p);points[j].push(p);}}
  points[start.index].push(start);points[goal.index].push(goal);
  const vertices:V2[]=[],edges:Map<number,number>[]=[];const ids=new Map<string,number>();
  const id=(p:V2)=>{const key=p.x.toFixed(4)+','+p.z.toFixed(4);if(!ids.has(key)){ids.set(key,vertices.length);vertices.push({x:p.x,z:p.z});edges.push(new Map());}return ids.get(key)!;};
  for(let i=0;i<points.length;i++){points[i].sort((a,b)=>distance(a,ROADS[i].a)-distance(b,ROADS[i].a));for(let j=1;j<points[i].length;j++){const a=id(points[i][j-1]),b=id(points[i][j]);if(a!==b){const d=distance(vertices[a],vertices[b]);edges[a].set(b,d);edges[b].set(a,d);}}}
  const s=id(start),g=id(goal),cost=vertices.map(()=>Infinity),previous=vertices.map(()=>-1),open=new Set(vertices.map((_,i)=>i));cost[s]=0;
  while(open.size){let n=-1;for(const i of open)if(n<0||cost[i]<cost[n])n=i;if(n===g||!Number.isFinite(cost[n]))break;open.delete(n);for(const [b,d]of edges[n])if(cost[n]+d<cost[b]){cost[b]=cost[n]+d;previous[b]=n;}}
  if(!Number.isFinite(cost[g]))return [{x:start.x,z:start.z}];
  const result:V2[]=[];for(let n=g;n>=0;n=previous[n]){result.unshift(vertices[n]);if(n===s)break;}return result;
}

export function navigate(state:DriveState,progress:number,nextCheckpoint:number){
  const p=projectRoute(state),mainHeading=onRoute(p.s).heading;
  const recovering=p.distance>17||p.s>nextCheckpoint+23||Math.abs(angleDiff(mainHeading,state.heading))>1.85;
  if(recovering){
    const destination=onRoute(Math.min(nextCheckpoint,TOTAL_LENGTH));const path=roadPath(state,destination);
    let target=path.find(v=>distance(v,state)>16)??destination;
    // Keep a driver off the pavement until they have reached the road itself.
    const nearest=nearestRoad(state);if(nearest.distance>12)target=nearest;
    return{recovering:true,angle:angleDiff(Math.atan2(target.x-state.x,-(target.z-state.z)),state.heading),distance:Math.round(path.reduce((d,p,i)=>d+(i?distance(path[i-1],p):distance(state,p)),0)),title:'走錯路 · 跟紅箭嘴返回',street:nearest.name,target};
  }
  const turn=CUMULATIVE.find(s=>s>p.s+13)??TOTAL_LENGTH,dist=turn-p.s;
  let title='沿路直行',angle=0;
  if(dist<75&&turn<TOTAL_LENGTH){angle=angleDiff(onRoute(turn+2).heading,onRoute(turn-2).heading);title=angle>0?'前方右轉':'前方左轉';}
  else if(progress>TOTAL_LENGTH-85)title='尾站就在前面';
  return{recovering:false,angle,distance:Math.max(0,Math.round(dist)),title,street:'主路線',target:onRoute(turn)};
}
