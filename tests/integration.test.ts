import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headlessGame,stepSeconds,disposeGame } from './harness';
import { DEMO_SEED } from '../src/demo';
import { onRoute } from '../src/core';

test('boarding, closing doors, unsafe door episodes, pausing and timeout use actual game state',async()=>{
  const g=await headlessGame();const stop=g.trip.stops[0];g.state={...stop,speed:0};g.physics.teleport(g.state);
  stepSeconds(g,1);assert.equal(g.stats.picked,0,'closed doors must never board');
  g.toggleDoor();stepSeconds(g,2.1);assert.equal(g.stats.picked,2);assert.equal(g.trip.riders.filter(r=>r.state==='onboard').length,2);assert.equal(g.stats.doorViolations,0);
  g.toggleDoor();stepSeconds(g,.6);assert.equal(g.doorAmount,0);g.keys.add('w');stepSeconds(g,2);assert.equal(g.stats.doorViolations,0);
  g.toggleDoor();assert.equal(g.stats.doorViolations,1);stepSeconds(g,1);assert.equal(g.stats.doorViolations,1,'one event, not one penalty per frame');
  g.pause();const remaining=g.stats.remaining;stepSeconds(g,2);assert.equal(g.stats.remaining,remaining,'paused time must freeze');assert.equal(g.mode,'paused');
  g.mode='playing';g.count=0;g.stats.remaining=.05;stepSeconds(g,.1);assert.equal(g.mode,'results');assert.equal(g.stats.completed,false);
  disposeGame(g);
});
test('dropoff completes only in the correct stop; terminal needs the route and a door cycle',async()=>{
  const g=await headlessGame();const rider=g.trip.riders[0];rider.state='onboard';g.stats.picked=1;
  const stop=g.trip.stops[rider.dropoff];g.state={...stop,speed:0};g.physics.teleport(g.state);g.toggleDoor();stepSeconds(g,1.4);assert.equal(rider.state,'delivered');assert.equal(g.stats.delivered,1);
  g.toggleDoor();stepSeconds(g,.6);const end=g.trip.stops.at(-1)!;g.state={...end,speed:0};g.physics.teleport(g.state);stepSeconds(g,1);assert.equal(g.stats.completed,false,'arrival alone must not complete');
  g.toggleDoor();stepSeconds(g,.6);g.toggleDoor();stepSeconds(g,.6);assert.equal(g.stats.completed,false,'cannot bypass route checkpoints');
  g.checkIndex=g.checks.length;stepSeconds(g,.1);assert.equal(g.stats.completed,true);assert.equal(g.mode,'results');disposeGame(g);
});
test('moving away interrupts boarding, overspeed accumulates, and recovery costs are applied',async()=>{
  const g=await headlessGame();const stop=g.trip.stops[0];g.state={...stop,speed:0};g.physics.teleport(g.state);g.toggleDoor();stepSeconds(g,.6);g.keys.add('w');stepSeconds(g,1);assert.equal(g.stats.picked,0);assert.equal(g.stats.doorViolations,1);
  g.doorOpen=false;g.doorAmount=0;g.unsafeDoor=false;g.state.speed=25;stepSeconds(g,.5);assert.ok(g.stats.overspeed>=.45);
  const remaining=g.stats.remaining;g.resetVan();assert.equal(g.stats.resets,1);assert.ok(Math.abs(g.stats.remaining-(remaining-5))<.001);assert.equal(g.state.speed,0);assert.equal(g.doorOpen,false);disposeGame(g);
});
test('waiting passengers dodge without injury, remain available, and repeated contacts do not farm penalties',async()=>{
  const g=await headlessGame();g.onHit({kind:'person',id:100},15);assert.equal(g.stats.people,1);assert.equal(g.trip.riders[0].state,'waiting');assert.equal(g.health,100);assert.ok(g.riderVisuals[0].dodge);g.time+=.85;g.animateDodge(g.riderVisuals[0]);assert.ok(Math.abs(g.riderVisuals[0].person.group.position.y-.25)<1e-6);assert.ok(Math.abs(g.riderVisuals[0].person.group.rotation.z)<.01);g.time+=2;g.onHit({kind:'person',id:100},15);assert.equal(g.stats.people,1);
  g.makeTrip(42);assert.equal(g.stats.people,0);assert.equal(g.health,100);assert.equal(g.trip.riders.filter(r=>r.state==='waiting').length,10);assert.equal(g.riderHit.size,0);disposeGame(g);
});
test('production demonstration entry completes the countdown and whole timed route with traffic',async()=>{
  const g=await headlessGame(DEMO_SEED,true);let finished=0,markedDemo=false;
  g.audio.unlock=async()=>{};g.qa=false;g.qaSpeed=4;g.time=500;
  g.demoRecorder={busy:true,finished:()=>finished++} as any;
  g.ui.results=(_stats,_seed,_reason,demo)=>{markedDemo=!!demo;};
  await g.start(DEMO_SEED,true);
  assert.equal(g.mode,'countdown');assert.equal(g.demoRun,true);assert.equal(g.qaSpeed,1);assert.equal(g.time,0);
  for(let frame=0;frame<60*184&&String(g.mode)!=='results';frame++)g.step(1/60);
  assert.equal(g.mode,'results');assert.equal(g.stats.completed,true);assert.equal(g.stats.delivered,10);
  assert.equal(g.stats.overspeed,0);assert.equal(g.stats.doorViolations,0);assert.equal(g.stats.resets,0);
  assert.equal(g.checkIndex,g.checks.length);assert.equal(finished,1);assert.equal(markedDemo,true);
  assert.ok(g.stats.remaining>0&&g.stats.remaining<180);
  console.log('Production demo:',JSON.stringify({remaining:g.stats.remaining,delivered:g.stats.delivered,people:g.stats.people,cars:g.stats.cars,objects:g.stats.objects}));
  disposeGame(g);
});
test('a fast full stop upsets onboard passengers once, while free play has no score or damage penalties',async()=>{
  const g=await headlessGame();g.trip.riders[0].state='onboard';g.state={...onRoute(40,7),speed:22};g.physics.teleport(g.state);g.keys.add('s');
  stepSeconds(g,.8);assert.equal(g.state.speed,0);assert.equal(g.stats.harshBrakes,1);assert.equal(g.stats.safetyPenalty,25);
  stepSeconds(g,1);assert.equal(g.stats.harshBrakes,1);
  g.makeTrip(42);g.gameMode='free';g.mode='playing';g.trip.riders[0].state='onboard';g.state={...onRoute(40,7),speed:22};g.physics.teleport(g.state);g.keys.add('s');stepSeconds(g,.8);
  assert.equal(g.stats.harshBrakes,1);assert.equal(g.stats.safetyPenalty,0);
  g.onHit({kind:'building'},20);assert.equal(g.health,100);assert.equal(g.stats.safetyPenalty,0);
  const remaining=g.stats.remaining;g.resetVan();assert.equal(g.stats.remaining,remaining);disposeGame(g);
});
test('crossing a red stop line triggers exactly one offence',async()=>{
  const g=await headlessGame();const light=g.signals[0];light.phase='red';light.elapsed=1;g.state={...onRoute(light.s-11,7),speed:12};g.physics.teleport(g.state);g.keys.add('w');
  stepSeconds(g,.4);assert.equal(g.stats.redLights,1);assert.equal(g.stats.safetyPenalty,80);
  stepSeconds(g,.3);assert.equal(g.stats.redLights,1);disposeGame(g);
});
