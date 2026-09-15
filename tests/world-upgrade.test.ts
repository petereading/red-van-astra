import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {ROADS,SIDE_ROADS,nearestRoad,roadPath,navigate} from '../src/roads';
import {onRoute,random} from '../src/core';
import {bodyMotion,WheelSparks} from '../src/driving-effects';
import {setNightMaterials,sign,material} from '../src/visuals';
import {StreetLighting} from '../src/lighting';
import {surpriseWave} from '../src/surprise-sound';
import {headlessGame,disposeGame,stepSeconds} from './harness';

test('every branch reconnects via real roads; recovery guidance returns to the next unvisited route section',()=>{
  const destination=onRoute(135);
  for(const road of SIDE_ROADS){const from={x:(road.a.x+road.b.x)/2,z:(road.a.z+road.b.z)/2};const path=roadPath(from,destination);assert.ok(path.length>1);assert.ok(Math.hypot(path.at(-1)!.x-destination.x,path.at(-1)!.z-destination.z)<1e-5);
    for(let i=1;i<path.length;i++)for(let t=0;t<=1;t+=.05){const p={x:path[i-1].x+(path[i].x-path[i-1].x)*t,z:path[i-1].z+(path[i].z-path[i-1].z)*t};assert.ok(nearestRoad(p).distance<.001,'navigation cannot cut through a city block');}
  }
  const wrong=navigate({x:-60,z:-80,speed:10,heading:-Math.PI/2},120,135);assert.equal(wrong.recovering,true);assert.ok(wrong.target.x>-60);assert.equal(navigate({...onRoute(135,7),speed:10},135,180).recovering,false);
  assert.equal(navigate({...onRoute(480,7),speed:10},120,135).recovering,true,'a shortcut must not skip unvisited route checkpoints');
});
test('the expanded road network has clear driving lanes and does not grant progress on side streets',async()=>{
  const g=await headlessGame();let sampled=0;
  for(const road of ROADS){const dx=road.b.x-road.a.x,dz=road.b.z-road.a.z,len=Math.hypot(dx,dz);
    for(let d=3;d<len;d+=3){const p={x:road.a.x+dx*d/len,z:road.a.z+dz*d/len};for(const o of g.city.obstacles){const x=(p.x-o.x)*Math.cos(o.heading)+(p.z-o.z)*Math.sin(o.heading),z=-(p.x-o.x)*Math.sin(o.heading)+(p.z-o.z)*Math.cos(o.heading);assert.ok(Math.abs(x)>o.hx+1.3||Math.abs(z)>o.hz+1.3,`road ${road.name} blocked at ${p.x},${p.z} by ${o.kind} ${o.x},${o.z}`);}sampled++;}}
  g.state={x:-75,z:-80,heading:-Math.PI/2,speed:5};g.physics.teleport(g.state);stepSeconds(g,.5);assert.equal(g.checkIndex,0);assert.equal(g.progress,0);g.updateHud();assert.equal(g.ui.el('nav-arrow').dataset.recovering,'true');assert.ok(sampled>1000);for(const o of g.city.obstacles)if(o.group&&o.homeRotation)assert.equal(o.group.rotation.y,o.homeRotation.y,'new trips must preserve signal and lamp orientation');disposeGame(g);
});
test('a struck street prop flies clear, damages the challenge van, and resets for the next trip',async()=>{
  const g=await headlessGame();const o=g.city.obstacles.find(o=>o.group&&o.hx>.5&&o.hx<.7)!;assert.ok(o);g.onHit({kind:'object',obstacle:o},18);assert.equal(o.knocked,true);assert.ok(g.health<100);assert.equal(g.stats.objects,1);g.city.animateProps(.15);assert.ok(Math.hypot(o.group!.position.x-o.x,o.group!.position.z-o.z)>.5);assert.ok(o.group!.position.y>.15);g.makeTrip(42);assert.equal(o.knocked,false);assert.equal(o.group!.position.x,o.x);assert.equal(o.group!.position.z,o.z);assert.equal(g.health,100);disposeGame(g);
});
test('night lighting changes windows and signs, with a bounded lamp budget and seeded optional advertising',async()=>{
  const g=await headlessGame();const lights=new StreetLighting(g.scene,g.city),window=material('#d9c88e'),neon=sign('茶','TEA','#183c35','#ffce83',4,2,'neon').material;
  lights.setNight(true);lights.update(.3,0,-80,0);assert.ok(window.emissiveIntensity>1);assert.ok(neon.emissiveIntensity>1);assert.equal(lights.lights.length,6);assert.ok(lights.pools.some(p=>p.visible));
  lights.setNight(false);assert.equal(window.emissiveIntensity,0);assert.ok(lights.pools.every(p=>!p.visible));assert.ok(lights.lights.every(p=>p.intensity===0));
  const variants=new Set(Array.from({length:30},(_,seed)=>random(seed^9187)()>.42));assert.equal(variants.size,2);assert.ok(g.van.ads);setNightMaterials(false);disposeGame(g);
});
test('cosmetic suspension stays subtle and stationary boarding stays level; sparks have a finite reusable pool',()=>{
  const idle=bodyMotion(0,1,11);assert.ok(Object.values(idle).every(value=>Math.abs(value)<1e-8));
  for(let t=0;t<15;t+=.03){const m=bodyMotion(31,1,t,1);assert.ok(m.height>=0&&m.height<.16);assert.ok(Math.abs(m.roll)<.11);assert.ok(Math.abs(m.pitch)<.09);}
  assert.ok(bodyMotion(28,-1,.12).roll<0);assert.ok(bodyMotion(28,1,.12).roll>0);
  const sparks=new WheelSparks();for(let f=0;f<600;f++)sparks.update(1/60,{x:0,z:0,heading:0,speed:29},1,false,true);assert.equal(sparks.particles.length,96);assert.ok(sparks.mesh.visible);for(let f=0;f<60;f++)sparks.update(1/60,{x:0,z:0,heading:0,speed:0},0,false,false);assert.equal(sparks.mesh.visible,false);
});
test('wordless surprise effects have distinct registers, bounded peaks and short non-silent envelopes',()=>{
  const variants=Array.from({length:4},(_,i)=>surpriseWave(22050,i));
  for(const wave of variants){assert.ok(wave.length/22050>.4&&wave.length/22050<.8);assert.ok(wave.every(n=>Number.isFinite(n)&&Math.abs(n)<.5));assert.ok(wave.some(n=>Math.abs(n)>.1));assert.ok(wave[0]===0);assert.ok(Math.abs(wave.at(-1)!)<.001);}
  assert.notDeepEqual(variants[0],variants[1]);assert.notDeepEqual(variants[2],variants[3]);
});
