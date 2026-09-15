import * as T from 'three';
import { clamp, type DriveState } from './core';

/** Bounded cosmetic suspension; it never changes traction, doors or scoring positions. */
export function bodyMotion(speed:number,steer:number,time:number,brakeJolt=0){
  const fast=clamp((Math.abs(speed)-18)/13,0,1),turn=clamp(Math.abs(speed)*Math.abs(steer)/20,0,1);
  return{height:fast*(.012+Math.sin(time*37)*.008)+turn*.13*Math.max(0,Math.sin(time*10))**4,
    roll:steer*clamp(Math.abs(speed)/22,0,1)*.095+Math.sin(time*31)*fast*.007,
    pitch:-brakeJolt*.055+Math.sin(time*25)*fast*.009+turn*Math.sin(time*10)*.013,
    shake:Math.sin(time*43)*fast*.014};
}

export class WheelSparks {
  mesh:T.InstancedMesh;dummy=new T.Object3D();cursor=0;carry=0;
  particles=Array.from({length:96},()=>({x:0,y:0,z:0,vx:0,vy:0,vz:0,life:0,max:.3}));
  constructor(){this.mesh=new T.InstancedMesh(new T.SphereGeometry(1,4,3),new T.MeshBasicMaterial({color:'#ffcf6c',toneMapped:false}),96);this.mesh.frustumCulled=false;this.mesh.visible=false;}
  reset(){this.particles.forEach(p=>p.life=0);this.carry=0;this.mesh.visible=false;}
  update(dt:number,state:DriveState,steer:number,braking:boolean,active:boolean){
    const speed=Math.abs(state.speed),strength=active?Math.max(clamp((speed-22)/9,0,1),clamp((speed*Math.abs(steer)-8)/13,0,1),braking?clamp((speed-14)/15,0,1):0):0;
    this.carry+=strength*90*dt;
    while(this.carry>=1){this.carry--;const n=this.cursor++%96,p=this.particles[n],side=n%2?1:-1,ax=side*1.16,az=n%4<2?1.98:-1.98,c=Math.cos(state.heading),s=Math.sin(state.heading);p.x=state.x+c*ax-s*az;p.z=state.z+s*ax+c*az;p.y=.23;p.vx=side*c*(1.4+(n%5)*.3)-s*speed*.25;p.vz=side*s*1.8+c*speed*.25;p.vy=1+(n%7)*.28;p.max=p.life=.18+(n%6)*.04;}
    let visible=false;
    this.particles.forEach((p,i)=>{p.life=Math.max(0,p.life-dt);if(p.life>0){visible=true;p.vy-=12*dt;p.x+=p.vx*dt;p.z+=p.vz*dt;p.y=Math.max(.16,p.y+p.vy*dt);this.dummy.position.set(p.x,p.y,p.z);this.dummy.scale.set(.032,.026,.14*(p.life/p.max)+.035);this.dummy.rotation.y=-state.heading;}else this.dummy.scale.setScalar(0);this.dummy.updateMatrix();this.mesh.setMatrixAt(i,this.dummy.matrix);});
    this.mesh.visible=visible;this.mesh.instanceMatrix.needsUpdate=true;
  }
}
