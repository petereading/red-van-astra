import * as T from 'three';
import type { DriveState } from './core';

function crossesBox(from:T.Vector3,to:T.Vector3,box:T.Box3){
  const delta=to.clone().sub(from),length=delta.length();
  if(box.containsPoint(from))return true;
  const hit=new T.Ray(from,delta.normalize()).intersectBox(box,new T.Vector3());
  return !!hit&&hit.distanceTo(from)<=length;
}
/** Predict the camera corridor before a bridge or sign can cover the van. */
export function obstructsView(bounds:T.Box3,state:DriveState,camera:T.Vector3,look:T.Vector3){
  const expanded=bounds.clone().expandByVector(new T.Vector3(3,2.5,3));
  if(crossesBox(camera,look,expanded))return true;
  const forward=new T.Vector3(Math.sin(state.heading),0,-Math.cos(state.heading));
  const height=T.MathUtils.clamp(camera.y,bounds.min.y,bounds.max.y);
  const origin=new T.Vector3(state.x,height,state.z).addScaledVector(forward,-20);
  const ahead=new T.Vector3(state.x,height,state.z).addScaledVector(forward,28+Math.abs(state.speed)*.65);
  return crossesBox(origin,ahead,expanded);
}
export class ViewOccluder {
  bounds:T.Box3; opacity=1;
  materials:{original:T.Material;copy:T.Material}[]=[];
  constructor(public root:T.Object3D){
    root.updateMatrixWorld(true);this.bounds=new T.Box3().setFromObject(root);
    const clones=new Map<T.Material,T.Material>();
    root.traverse(o=>{if(!(o instanceof T.Mesh))return;
      const clone=(m:T.Material)=>{if(!clones.has(m)){const copy=m.clone();clones.set(m,copy);this.materials.push({original:m,copy});}return clones.get(m)!;};
      o.material=Array.isArray(o.material)?o.material.map(clone):clone(o.material);
    });
  }
  update(dt:number,state:DriveState,camera:T.Vector3,look:T.Vector3,active:boolean){
    const target=active&&obstructsView(this.bounds,state,camera,look)?.09:1;
    this.opacity=T.MathUtils.lerp(this.opacity,target,1-Math.exp(-dt*(target<1?18:5)));
    if(Math.abs(this.opacity-target)<.002)this.opacity=target;
    for(const {copy,original}of this.materials){
      copy.opacity=original.opacity*this.opacity;copy.transparent=original.transparent||this.opacity<1;copy.depthWrite=this.opacity<.99?false:original.depthWrite;
      if(copy instanceof T.MeshStandardMaterial&&original instanceof T.MeshStandardMaterial){copy.emissive.copy(original.emissive);copy.emissiveIntensity=original.emissiveIntensity;}
    }
  }
}
