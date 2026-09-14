import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headlessGame,stepSeconds,disposeGame } from './harness';

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
test('waiting passengers can be hit, hits cannot be farmed, and new runs reset damage and riders',async()=>{
  const g=await headlessGame();g.onHit({kind:'person',id:100},15);assert.equal(g.stats.people,1);assert.equal(g.trip.riders[0].state,'missed');g.time+=2;g.onHit({kind:'person',id:100},15);assert.equal(g.stats.people,1);
  g.makeTrip(42);assert.equal(g.stats.people,0);assert.equal(g.health,100);assert.equal(g.trip.riders.filter(r=>r.state==='waiting').length,10);assert.equal(g.riderHit.size,0);disposeGame(g);
});
