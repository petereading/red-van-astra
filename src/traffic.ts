import { onRoute, TOTAL_LENGTH, random, type V2 } from './core';
export const CROSSINGS=[350,745,1290];
export type Signal={s:number;phase:'idle'|'amber'|'red'|'green';elapsed:number;duration:number;trigger:number;violated:boolean};
export function makeSignals(seed:number):Signal[]{const rng=random(seed^0x1af);return CROSSINGS.map(s=>({s,phase:'idle',elapsed:0,duration:5,trigger:52+rng()*12,violated:false}));}
export function updateSignals(signals:Signal[],progress:number,dt:number){
  for(const light of signals){
    if(light.phase==='idle'&&progress>=light.s-light.trigger&&progress<light.s){light.phase='amber';light.elapsed=0;}
    if(light.phase==='amber'||light.phase==='red'){
      light.elapsed+=dt;
      if(light.phase==='amber'&&light.elapsed>=1){light.phase='red';light.elapsed-=1;}
      if(light.phase==='red'&&light.elapsed>=light.duration){light.phase='green';light.elapsed=light.duration;}
    }
  }
}
export function trafficPoint(s:number,lateral=0){
  const edge=onRoute(Math.max(0,Math.min(TOTAL_LENGTH,s)),lateral);
  const extra=s<0?s:s>TOTAL_LENGTH?s-TOTAL_LENGTH:0;
  return {...edge,x:edge.x+Math.sin(edge.heading)*extra,z:edge.z-Math.cos(edge.heading)*extra};
}
export type TrafficState={s:number;speed:number;direction:number;lane:number;halfLength:number;hitUntil:number;velocity:number;wrapped:boolean};
/** Snapshot-based headways include both vehicles' lengths. Exit lanes extend beyond the route. */
export function moveTraffic(cars:TrafficState[],signals:Signal[],dt:number,time:number,player?:V2&{s:number;speed:number}){
  const rates=cars.map(car=>{
    let rate=time<car.hitUntil?0:car.speed;
    for(const other of cars){
      if(other===car||other.direction!==car.direction)continue;
      const gap=(other.s-car.s)*car.direction;
      if(gap>0)rate=Math.min(rate,Math.max(0,(gap-car.halfLength-other.halfLength-2.4)*1.8));
    }
    for(const light of signals){if(light.phase!=='red'&&light.phase!=='amber')continue;
      const gap=(light.s-car.direction*7-car.s)*car.direction-car.halfLength;
      if(gap>=-.1)rate=Math.min(rate,Math.max(0,gap*1.8));
    }
    if(player){const p=trafficPoint(car.s,car.lane),along=((player.x-p.x)*Math.sin(p.heading)-(player.z-p.z)*Math.cos(p.heading))*car.direction,side=Math.abs((player.x-p.x)*Math.cos(p.heading)+(player.z-p.z)*Math.sin(p.heading));if(side<2.5&&along>0)rate=Math.min(rate,Math.max(0,(along-car.halfLength-3.2-2)*1.5));}
    return rate;
  });
  cars.forEach((car,i)=>{car.wrapped=false;car.velocity=rates[i];car.s+=rates[i]*car.direction*dt;
    if(car.s>TOTAL_LENGTH+180||car.s< -180){
      const entry=car.direction>0?-150:TOTAL_LENGTH+150;
      if(cars.every(other=>other===car||other.direction!==car.direction||Math.abs(other.s-entry)>car.halfLength+other.halfLength+16)){car.s=entry;car.wrapped=true;}
    }
  });
}
