import RAPIER from '@dimforge/rapier3d-compat';
import { type DriveState, type Controls, driveStep } from './core';
import type { Obstacle } from './visuals';
export type HitTarget = { kind:'object'|'building'|'car'|'person'; obstacle?:Obstacle; id?:number };
export class Physics {
  world:RAPIER.World; queue:RAPIER.EventQueue; player:RAPIER.RigidBody; playerCollider:RAPIER.Collider;
  targets=new Map<number,HitTarget>(); props:RAPIER.Collider[]=[]; moving:RAPIER.RigidBody[]=[];
  recoil={x:0,z:0};
  constructor(obstacles:Obstacle[]){
    this.world=new RAPIER.World({x:0,y:0,z:0});this.world.timestep=1/60;this.queue=new RAPIER.EventQueue(true);
    this.player=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(-7,1.5,40).enabledTranslations(true,false,true).enabledRotations(false,false,false).setCcdEnabled(true).setLinearDamping(0));
    this.playerCollider=this.world.createCollider(RAPIER.ColliderDesc.cuboid(1.04,1.24,3.1).setMass(2800).setFriction(.08).setRestitution(.08).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),this.player);
    for(const o of obstacles){const c=this.world.createCollider(RAPIER.ColliderDesc.cuboid(o.hx,o.height?o.height/2:o.kind==='building'?20:1.0,o.hz).setTranslation(o.x,o.height?o.height/2:o.kind==='building'?20:1,o.z).setRotation({x:0,y:Math.sin(-o.heading/2),z:0,w:Math.cos(-o.heading/2)}).setFriction(.1).setRestitution(.1));this.targets.set(c.handle,{kind:o.kind,obstacle:o});this.props.push(c);}
  }
  static async init(){await RAPIER.init();}
  addMover(kind:'car'|'person',id:number,hx:number,hz:number){
    const b=this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0,1,10000));
    const c=this.world.createCollider(RAPIER.ColliderDesc.cuboid(hx,.8,hz).setSensor(kind==='person'),b);this.targets.set(c.handle,{kind,id});this.moving.push(b);return b;
  }
  clearMovers(){for(const b of this.moving){for(let i=0;i<b.numColliders();i++)this.targets.delete(b.collider(i).handle);this.world.removeRigidBody(b);}this.moving=[];}
  teleport(s:DriveState){this.recoil={x:0,z:0};this.player.setTranslation({x:s.x,y:1.5,z:s.z},true);this.player.setLinvel({x:0,y:0,z:0},true);this.player.setRotation({x:0,y:Math.sin(-s.heading/2),z:0,w:Math.cos(-s.heading/2)},true);}
  reset(){this.recoil={x:0,z:0};for(const c of this.props)c.setEnabled(true);}
  cameraDistance(origin:{x:number;y:number;z:number},dir:{x:number;y:number;z:number},length:number){
    const hit=this.world.castRay(new RAPIER.Ray(origin,dir),length,true,undefined,undefined,this.playerCollider,this.player,c=>this.targets.get(c.handle)?.kind==='building');
    return hit?Math.max(2,hit.timeOfImpact-.6):length;
  }
  step(state:DriveState,input:Controls,health:number,offroad:boolean,onHit:(target:HitTarget,speed:number)=>void):DriveState{
    const next=driveStep(state,input,1/60,health,offroad);
    this.recoil.x*=.88;this.recoil.z*=.88;
    this.player.setLinvel({x:Math.sin(next.heading)*next.speed+this.recoil.x,y:0,z:-Math.cos(next.heading)*next.speed+this.recoil.z},true);
    this.player.setRotation({x:0,y:Math.sin(-next.heading/2),z:0,w:Math.cos(-next.heading/2)},true);
    this.world.step(this.queue);
    let impact=false;
    this.queue.drainCollisionEvents((h1,h2,started)=>{if(!started)return;const other=h1===this.playerCollider.handle?h2:h2===this.playerCollider.handle?h1:undefined;if(other===undefined)return;const target=this.targets.get(other);if(!target)return;onHit(target,Math.abs(next.speed));if(target.kind!=='person'&&Math.abs(next.speed)>3){impact=true;const pos=this.player.translation(),otherPos=this.world.getCollider(other)?.translation();let dx=pos.x-(otherPos?.x??pos.x),dz=pos.z-(otherPos?.z??pos.z),length=Math.hypot(dx,dz)||1;const strength=Math.min(4,Math.abs(next.speed)*.18);this.recoil.x=dx/length*strength;this.recoil.z=dz/length*strength;}if(target.kind==='object'&&target.obstacle?.group&&Math.abs(next.speed)>3){target.obstacle.knocked=true;this.world.getCollider(other)?.setEnabled(false);}});
    const p=this.player.translation(),v=this.player.linvel();let speed=v.x*Math.sin(next.heading)-v.z*Math.cos(next.heading);
    if(Math.abs(speed)<.15&&Math.abs(next.speed)>1)speed=0;
    return{x:p.x,z:p.z,heading:next.heading,speed:impact?speed*.4:speed};
  }
}
