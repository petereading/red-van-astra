import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { groundPatches, PLAYABLE_ROADS } from '../src/pavement';
import { nearestRoad, SIDE_ROADS } from '../src/roads';
import { onRoute } from '../src/core';
import { MAP_BOUNDS, outsideMap, recoveryPose } from '../src/boundary';
import { makeStop, updateStopGlow, setNightMaterials } from '../src/visuals';
import { stopPulse } from '../src/glow';
import { headlessGame, stepSeconds, disposeGame } from './harness';

test('pavement and asphalt have one surface owner at every join, with unobstructed junction mouths',()=>{
  const patches=groundPatches();assert.ok(patches.length>100);
  for(let i=0;i<patches.length;i++)for(let j=i+1;j<patches.length;j++){
    const a=patches[i],b=patches[j];assert.ok(a.x1<=b.x0||b.x1<=a.x0||a.z1<=b.z0||b.z1<=a.z0,'coplanar pavement faces overlap');
  }
  for(const r of PLAYABLE_ROADS)for(let t=.03;t<1;t+=.07){
    const x=r.a.x+(r.b.x-r.a.x)*t,z=r.a.z+(r.b.z-r.a.z)*t;
    const owner=patches.find(p=>x>=p.x0&&x<=p.x1&&z>=p.z0&&z<=p.z1);assert.equal(owner?.material,'@asphalt','a junction may not be blocked by a sidewalk surface');
  }
  assert.ok(new Set(patches.map(p=>p.material)).size>=5);
});

test('bridges fade before the van reaches them, remain faded below the chase camera, then restore',async()=>{
  const g=await headlessGame(),bridge=g.city.occluders.find(o=>o.bounds.max.x-o.bounds.min.x>34)!;assert.ok(bridge);
  const visit=(s:number,dt:number)=>{const p=onRoute(s,7);bridge.update(dt,{...p,speed:20},new T.Vector3(p.x,6.96,p.z+13.2),new T.Vector3(p.x,1.7,p.z-7),true);};
  visit(132,.25);assert.ok(bridge.opacity<.15,'40 m approach must already be transparent');visit(174,.2);assert.ok(bridge.opacity<.12,'bridge remains transparent while the camera is under it');
  for(const m of bridge.materials){assert.notEqual(m.copy,m.original);assert.equal(m.original.opacity,1);assert.equal(m.copy.depthWrite,false);}
  visit(225,1.5);assert.ok(bridge.opacity>.99,'restore the streetscape after the camera clears it');
  setNightMaterials(true);const sign=g.city.occluders.find(o=>o.materials.some(m=>m.original instanceof T.MeshStandardMaterial&&m.original.emissiveIntensity>1))!;
  assert.ok(sign);sign.update(.1,{...onRoute(72,7),speed:20},new T.Vector3(-7,7,-20),new T.Vector3(-7,2,-50),true);
  for(const m of sign.materials)if(m.copy instanceof T.MeshStandardMaterial&&m.original instanceof T.MeshStandardMaterial)assert.equal(m.copy.emissiveIntensity,m.original.emissiveIntensity);
  setNightMaterials(false);disposeGame(g);
});

test('traffic lenses keep saturated signal colors and only the active lens receives a halo',async()=>{
  const g=await headlessGame(),signal=g.signals[0],model=g.city.signalModels.find(m=>m.s===signal.s)!;
  for(const [index,phase]of (['red','amber','green'] as const).entries()){
    signal.phase=phase;g.city.updateSignals(g.signals);
    model.lenses.forEach((m,i)=>{assert.equal(m.toneMapped,false);assert.equal(model.halos[i].opacity>0,i===index);if(i!==index)assert.ok(Math.max(m.color.r,m.color.g,m.color.b)<.05);});
    const c=model.lenses[index].color;assert.ok(c.b<.05);if(index===0)assert.ok(c.r>c.g*10);if(index===2)assert.ok(c.g>c.r*10);
  }
  disposeGame(g);
});

test('stop areas have a slow uninterrupted glow, clear boundaries and physical stop signs',async()=>{
  const g=await headlessGame(),stop=makeStop(g.trip.stops[0]);
  assert.ok(stop.pole.children.length>0);assert.ok(stop.group.position.y>.23);
  for(let t=0;t<5.2;t+=.1){updateStopGlow(stop,t,'#71d2ff');assert.ok(stop.mat.opacity>.9);assert.ok(stop.fill.material.opacity>.25);assert.ok(stop.glow.opacity>.85);assert.ok(stop.curtain.opacity>.2);assert.ok(Math.abs(stopPulse(t)-stopPulse(t+2.6))<1e-8);}
  assert.ok(stopPulse(1.3)>stopPulse(0));assert.equal(stop.glow.blending,T.AdditiveBlending);disposeGame(g);
});

test('walkers, crossing pedestrians and boarding passengers face their actual direction of movement',async()=>{
  const g=await headlessGame();
  const verify=(before:T.Vector3,person:typeof g.pedestrians[0]['person'])=>{const moved=person.group.position.clone().sub(before);moved.y=0;if(moved.length()<.0001)return;const facing=new T.Vector3(0,0,-1).applyQuaternion(person.group.quaternion);assert.ok(moved.normalize().dot(facing)>.98,'model faces against its world movement');};
  for(const time of [0,12,23]){g.time=time;g.animateVehicles(0);const before=g.pedestrians.map(p=>p.person.group.position.clone());g.time+=.05;g.signals.forEach(s=>{s.phase='red';s.elapsed=1.05;});g.animateVehicles(.05);g.pedestrians.forEach((p,i)=>verify(before[i],p.person));}
  const stop=g.trip.stops[0];g.state={...stop,speed:0};g.physics.teleport(g.state);g.toggleDoor();stepSeconds(g,1.2);
  const rider=g.riderVisuals.find(v=>v.moving>0)!;assert.ok(rider);const before=rider.person.group.position.clone();stepSeconds(g,.1);verify(before,rider.person);disposeGame(g);
});

test('a threatened pedestrian really leaps clear during game steps and lands without injury',async()=>{
  const g=await headlessGame(),p=g.pedestrians.find(p=>!p.cross)!;g.qaTraffic=true;
  const from=p.person.group.position.clone(),heading=onRoute(p.s).heading;
  g.state={x:from.x-Math.sin(heading)*10,z:from.z+Math.cos(heading)*10,heading,speed:17};g.physics.teleport(g.state);g.evadePeople();assert.ok(p.dodge);assert.ok(p.dodge.to.distanceTo(from)>3);
  stepSeconds(g,.22);assert.ok(p.person.group.position.y>1.1);assert.ok(Math.hypot(p.person.group.position.x-from.x,p.person.group.position.z-from.z)>1.2);assert.ok(Math.abs(p.person.arm.rotation.z)>1);
  stepSeconds(g,.65);assert.ok(Math.abs(p.person.group.position.y-.25)<1e-6);assert.equal(p.person.group.visible,true);assert.ok(p.hit);disposeGame(g);
});

test('park benches are displaced by actual impacts while trees and pavilion remain solid',async()=>{
  const g=await headlessGame(),bench=g.city.obstacles.find(o=>o.label==='公園長椅')!;
  g.state={x:bench.x,z:bench.z+8,heading:0,speed:18};g.physics.teleport(g.state);g.keys.add('w');stepSeconds(g,.6);
  assert.equal(bench.knocked,true);assert.ok(bench.group!.position.distanceTo(new T.Vector3(bench.x,bench.homeY,bench.z))>.6);assert.ok(g.health<100);assert.ok(bench.fragments!.some(f=>f.part.position.distanceTo(f.position)>.2),'seat slats must separate into broken pieces');
  for(const label of ['樹木','涼亭']){
    g.makeTrip(42);assert.ok(bench.fragments!.every(f=>f.part.position.equals(f.position)));const o=g.city.obstacles.find(o=>o.label===label)!;
    g.state={x:o.x,z:o.z+o.hz+8,heading:0,speed:18};g.physics.teleport(g.state);g.keys.add('w');stepSeconds(g,.8);
    assert.ok(!o.knocked);assert.ok(g.state.z>o.z+o.hz+2.8,'solid park scenery must physically stop the van');assert.ok(g.ui.el('toast').textContent!.includes(label));
    const entry=[...g.physics.targets.entries()].find(([,t])=>t.obstacle===o)!;assert.equal(g.physics.world.getCollider(entry[0]).isEnabled(),true);
    if(o.group)assert.equal(o.group.position.x,o.x);
  }
  disposeGame(g);
});

test('only leaving map bounds starts a warning, then one safe return facing toward the unfinished route',async()=>{
  const g=await headlessGame();
  for(const r of SIDE_ROADS)assert.equal(outsideMap({x:(r.a.x+r.b.x)/2,z:(r.a.z+r.b.z)/2}),false);
  for(const mode of ['challenge','free'] as const){
    g.makeTrip(42);g.gameMode=mode;g.state={x:MAP_BOUNDS.maxX+5,z:-720,heading:Math.PI/2,speed:0};g.physics.teleport(g.state);
    stepSeconds(g,.4);assert.equal(g.stats.resets,0);assert.ok(g.ui.el('boundary-warning').textContent!.includes('超出地圖範圍'));
    stepSeconds(g,.9);assert.equal(g.stats.resets,1);assert.equal(outsideMap(g.state),false);assert.ok(nearestRoad(g.state,PLAYABLE_ROADS).distance<=6.01);assert.equal(g.state.speed,0);assert.equal(g.doorOpen,false);assert.equal(g.checkIndex,0);
    assert.ok(Math.abs(g.stats.remaining-(180-1.3-(mode==='challenge'?5:0)))<.02);
  }
  const end={x:220,z:MAP_BOUNDS.minZ-10};const back=recoveryPose(end,135);assert.ok(Math.cos(back.heading)<-.99,'exit beyond the terminus must face back toward the main route');
  const blocked=recoveryPose(end,135,[back]);assert.ok(Math.hypot(back.x-blocked.x,back.z-blocked.z)>13,'avoid spawning on a nearby vehicle');
  disposeGame(g);
});

test('boarding plays money only, alighting uses a single stop bell, dangerous doors use a wordless gasp',async()=>{
  const g=await headlessGame(),events:string[]=[];g.audio.effect=kind=>events.push(kind);g.audio.gasp=()=>events.push('gasp');
  const stop=g.trip.stops[0];g.state={...stop,speed:0};g.physics.teleport(g.state);g.toggleDoor();stepSeconds(g,2.2);assert.equal(events.filter(e=>e==='coin').length,2);assert.equal(events.includes('gasp'),false);
  g.toggleDoor();stepSeconds(g,.6);events.length=0;const drop=g.trip.stops[g.trip.riders[0].dropoff];g.progress=drop.s-50;g.updatePassengers(0);g.updatePassengers(0);assert.equal(events.filter(e=>e==='bell').length,1);
  g.state={...drop,speed:0};g.physics.teleport(g.state);g.toggleDoor();stepSeconds(g,2.2);assert.ok(g.stats.delivered>0);assert.equal(events.filter(e=>e==='bell').length,1);
  g.toggleDoor();stepSeconds(g,.6);g.state.speed=10;g.toggleDoor();assert.ok(events.includes('gasp'));assert.equal('say'in g.audio,false);disposeGame(g);
});
