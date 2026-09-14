import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTrip, CUMULATIVE, TOTAL_LENGTH, onRoute, projectRoute, isStoppedAt, newStats, scoreRun, driveStep, freeRunSuccess, type DriveState } from '../src/core';
import { Physics } from '../src/physics';

test('300 random trips have ten riders, reachable downstream stops, pavement openings and a reproducible seed',()=>{
  for(let seed=0;seed<300;seed++){
    const a=createTrip(seed);assert.deepEqual(a,createTrip(seed));assert.equal(a.riders.length,10);
    for(const rider of a.riders){assert.ok(rider.dropoff>rider.pickup);assert.ok(a.stops[rider.dropoff].s>a.stops[rider.pickup].s+90);}
    for(const stop of a.stops){assert.ok(stop.s>0&&stop.s<TOTAL_LENGTH);if(!stop.terminal)assert.ok(CUMULATIVE.every(c=>Math.abs(c-stop.s)>20));assert.ok(isStoppedAt(stop,stop.heading,0,stop));}
  }
  assert.notDeepEqual(createTrip(1),createTrip(2));
});
test('boarding checks the door point rather than the whole vehicle footprint',()=>{
  const stop=createTrip(1).stops[0];assert.equal(isStoppedAt(stop,stop.heading,.5,stop),false);
  assert.equal(isStoppedAt({...stop,x:stop.x+3},stop.heading,0,stop),true);
  assert.equal(isStoppedAt({...stop,z:stop.z+6},stop.heading,0,stop),true);
  assert.equal(isStoppedAt({...stop,x:stop.x+5},stop.heading,0,stop),false);
  assert.equal(isStoppedAt({...stop,z:stop.z+10},stop.heading,0,stop),false);
  assert.equal(isStoppedAt(stop,stop.heading+.8,0,stop),true);
});
test('80 km/h braking stops within 0.7 seconds and less than 8 metres without reversing',()=>{
  let s:DriveState={x:0,z:0,heading:0,speed:80/3.6};for(let i=0;i<42;i++)s=driveStep(s,{throttle:-1,steer:0,handbrake:false,reverse:false},1/60,100);
  assert.equal(s.speed,0);assert.ok(Math.abs(s.z)<8);
  for(let i=0;i<60;i++)s=driveStep(s,{throttle:-1,steer:0,handbrake:false,reverse:false},1/60,100);assert.equal(s.speed,0);
});
test('live grade improves with earned route points and free play requires all objectives',()=>{
  const stats=newStats();const start=scoreRun(stats,10,0);stats.picked=10;stats.delivered=8;const mid=scoreRun(stats,10,.8);
  assert.ok(mid.total>start.total);assert.notEqual(mid.grade,'D');assert.equal(scoreRun(stats).grade,'D');
  stats.completed=true;assert.equal(freeRunSuccess(stats),false);stats.delivered=10;assert.equal(freeRunSuccess(stats),true);stats.missed=1;assert.equal(freeRunSuccess(stats),false);
});
test('route projection works around every segment and turn without ambiguity',()=>{for(let s=0;s<TOTAL_LENGTH;s+=5){const p=onRoute(s);assert.ok(Math.abs(projectRoute(p).s-s)<.001);}});
test('grades cannot reward failure or an empty speed run with S',()=>{
  const stats=newStats();stats.completed=true;stats.remaining=50;assert.equal(scoreRun(stats).grade,'B');stats.picked=10;stats.delivered=10;assert.equal(scoreRun(stats).total,1000);assert.equal(scoreRun(stats).grade,'S');stats.people=1;assert.equal(scoreRun(stats).grade,'A');stats.completed=false;assert.equal(scoreRun(stats).grade,'D');
  stats.completed=true;stats.safetyPenalty=1000;stats.overspeed=90;assert.equal(scoreRun(stats).safety,0);assert.ok(scoreRun(stats).total>=0);
});
test('acceleration reaches the warning threshold, braking stops, and reverse is bounded',()=>{
  let s:DriveState={x:0,z:0,heading:0,speed:0};for(let i=0;i<900;i++)s=driveStep(s,{throttle:1,steer:0,handbrake:false},1/60,100);assert.ok(s.speed*3.6>80);assert.ok(s.speed<=31);
  for(let i=0;i<400;i++)s=driveStep(s,{throttle:-1,steer:0,handbrake:false},1/60,100);assert.ok(s.speed>=-5&&s.speed<0);
  for(let i=0;i<180;i++)s=driveStep(s,{throttle:0,steer:0,handbrake:true},1/60,100);assert.ok(Math.abs(s.speed)<.05);
});
test('Rapier blocks a fast vehicle at a wall and emits a collision rather than tunnelling',async()=>{
  await Physics.init();const physics=new Physics([{x:0,z:-20,hx:10,hz:.25,heading:0,kind:'building'}]);let state:DriveState={x:0,z:0,speed:26,heading:0};physics.teleport(state);let hits=0;
  for(let i=0;i<100;i++)state=physics.step(state,{throttle:1,steer:0,handbrake:false},100,false,()=>hits++);
  assert.ok(hits>=1);assert.ok(state.z> -18);physics.world.free();physics.queue.free();
});
