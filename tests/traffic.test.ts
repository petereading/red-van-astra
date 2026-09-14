import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeSignals,updateSignals,moveTraffic,trafficPoint,type TrafficState} from '../src/traffic';
import {TOTAL_LENGTH} from '../src/core';

test('a crossing gives one amber warning, five seconds red and clears its pedestrians',()=>{
  const lights=makeSignals(42),l=lights[0];updateSignals(lights,l.s-l.trigger+.1,.5);assert.equal(l.phase,'amber');
  updateSignals(lights,l.s-15,.5);assert.equal(l.phase,'red');
  updateSignals(lights,l.s-15,4.9);assert.equal(l.phase,'red');
  updateSignals(lights,l.s-15,.1);assert.equal(l.phase,'green');
  updateSignals(lights,l.s-15,60);assert.equal(l.phase,'green');
});
function car(s:number,direction=1,halfLength=2.25):TrafficState{return{s,speed:12,direction,lane:direction*3.05,halfLength,hitUntil:0,velocity:0,wrapped:false};}
test('NPC buses and cars stop before a red stop line and preserve full body headways',()=>{
  const lights=makeSignals(1),l=lights[0];l.phase='red';const cars=[car(l.s-17,1,4.7),car(l.s-36),car(l.s-52,1,4.7)];
  for(let n=0;n<600;n++)moveTraffic(cars,lights,1/60,n/60);
  assert.ok(cars[0].s+cars[0].halfLength<=l.s-7);
  assert.ok(cars[0].s-cars[1].s>=cars[0].halfLength+cars[1].halfLength+2);
  l.phase='green';for(let n=0;n<300;n++)moveTraffic(cars,lights,1/60,n/60);
  assert.ok(cars[0].s>l.s+10);
});
test('traffic keeps moving beyond both ends and re-enters without endpoint overlap',()=>{
  const a=trafficPoint(TOTAL_LENGTH+20,3.05),b=trafficPoint(TOTAL_LENGTH+50,3.05);
  assert.ok(Math.hypot(a.x-b.x,a.z-b.z)>29.9);
  const cars=Array.from({length:16},(_,i)=>car(70+i*75,i%3===0?-1:1,i%5===0?4.7:2.25));let wraps=0;
  for(let frame=0;frame<60*400;frame++){
    moveTraffic(cars,[],1/60,frame/60);wraps+=cars.filter(c=>c.wrapped).length;
    for(const c of cars)for(const d of cars)if(c!==d&&c.direction===d.direction)assert.ok(Math.abs(c.s-d.s)>=c.halfLength+d.halfLength+1.9);
  }
  assert.ok(wraps>20);
});
