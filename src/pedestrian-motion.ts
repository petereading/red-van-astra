import * as T from 'three';
import { clamp, type DriveState } from './core';
import type { Obstacle, PersonModel } from './visuals';

export const DODGE_SECONDS=.78;
export type Dodge={at:number;from:T.Vector3;to:T.Vector3};
export function faceMovement(person:PersonModel,from:T.Vector3,to:T.Vector3){
  const dx=to.x-from.x,dz=to.z-from.z;
  if(Math.hypot(dx,dz)>.0001)person.group.rotation.y=-Math.atan2(dx,-dz);
}
export function dodgeDestination(from:T.Vector3,van:DriveState,obstacles:Obstacle[]){
  const forward=new T.Vector3(Math.sin(van.heading),0,-Math.cos(van.heading)),side=new T.Vector3(Math.cos(van.heading),0,Math.sin(van.heading));
  const relative=from.clone().sub(new T.Vector3(van.x,from.y,van.z)),away=Math.sign(relative.dot(side))||1;
  const clear=(p:T.Vector3)=>!obstacles.some(o=>{if(o.kind!=='building')return false;const dx=p.x-o.x,dz=p.z-o.z;return Math.abs(dx*Math.cos(o.heading)+dz*Math.sin(o.heading))<o.hx+.4&&Math.abs(-dx*Math.sin(o.heading)+dz*Math.cos(o.heading))<o.hz+.4;});
  const candidates=[
    from.clone().addScaledVector(side,away*3.6),
    from.clone().addScaledVector(side,away*2.6).addScaledVector(forward,-2.8),
    from.clone().addScaledVector(side,-away*3.6),
    from.clone().addScaledVector(side,away*1.2).addScaledVector(forward,-4.2),
    from.clone().addScaledVector(forward,-4.4),
    from.clone().addScaledVector(forward,4.4),
  ];
  const safe=candidates.find(p=>[.25,.5,.75,1].every(t=>clear(from.clone().lerp(p,t))))??from.clone().addScaledVector(side,away*3.6);safe.y=.25;return safe;
}
/** Actual world translation, raised arms and tucked legs; no injury pose or gore. */
export function animateDodge(person:PersonModel,dodge:Dodge,time:number){
  const t=clamp((time-dodge.at)/DODGE_SECONDS,0,1),air=Math.sin(t*Math.PI),ease=1-(1-t)**2;
  person.group.position.lerpVectors(dodge.from,dodge.to,ease);person.group.position.y=.25+air*1.25;
  faceMovement(person,dodge.from,dodge.to);person.group.rotation.z=air*.21;
  person.arm.rotation.z=-2.7*air;person.legs[0].rotation.x=-air*.9;person.legs[1].rotation.x=air*.55;
}
