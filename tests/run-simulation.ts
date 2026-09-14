// Runs the actual Game.step and Rapier world without a browser renderer.
// The test driver supplies throttle/steering/door inputs; it never teleports during a route.
import { createCanvas } from '@napi-rs/canvas';
import * as T from 'three';
import { Game } from '../src/game';
import { Physics } from '../src/physics';
import { GameAudio } from '../src/audio';
import { City,makeVehicle } from '../src/visuals';
import { CUMULATIVE,TOTAL_LENGTH,scoreRun } from '../src/core';

Object.defineProperty(globalThis,'document',{value:{createElement:(tag:string)=>{if(tag==='canvas')return createCanvas(768,256);throw new Error(tag);}},configurable:true});
const nodes=new Map<string,any>();
function node(id:string):any{if(!nodes.has(id)){const el:any={style:{},dataset:{},textContent:'',innerHTML:'',classList:{toggle(){},add(){},remove(){}},closest:()=>el};el.parentElement=el;nodes.set(id,el);}return nodes.get(id);}
const ui:any={el:node,text:(id:string,s:string)=>node(id).textContent=s,show(){},hide(){},setMode(){},results(){}};
await Physics.init();
const seeds=process.argv.slice(2).map(Number);if(!seeds.length)seeds.push(8521986);
let failures=0;
for(const seed of seeds){
  const g=Object.create(Game.prototype) as Game;
  Object.assign(g,{ui,audio:new GameAudio(),scene:new T.Scene(),van:makeVehicle('minibus'),city:new City(),traffic:[],pedestrians:[],riderVisuals:[],stopModels:[],keys:new Set(),touch:new Set(),time:0,checks:[],dropAnnounced:new Set(),hitCooldown:new Map(),pilotServed:new Set(),autopilot:true,qa:true,qaTraffic:!process.env.NO_TRAFFIC,mode:'playing',count:0,doorAmount:0,flash:0,toastUntil:0});
  g.physics=new Physics(g.city.obstacles);
  for(let s=45;s<TOTAL_LENGTH-25;s+=45)g.checks.push(s);g.checks.push(...CUMULATIVE.slice(1,-1));g.checks.sort((a,b)=>a-b);
  g.makeTrip(seed);g.mode='playing';g.autopilot=true;
  for(let frame=0;frame<60*185&&g.mode==='playing';frame++){
    g.step(1/60);
    if(frame%1800===0)console.log(JSON.stringify({at:(frame/60).toFixed(0),seed,progress:g.progress.toFixed(1),x:g.state.x.toFixed(1),z:g.state.z.toFixed(1),speed:(g.state.speed*3.6).toFixed(1),health:g.health,picked:g.stats.picked,delivered:g.stats.delivered,door:g.doorOpen}));
  }
  const result={seed,...g.stats,...scoreRun(g.stats),health:g.health,progress:g.progress,checkpoints:`${g.checkIndex}/${g.checks.length}`,mode:g.mode};
  console.log('RESULT '+JSON.stringify(result));
  if(!g.stats.completed||g.stats.delivered<8||g.stats.overspeed>0||g.stats.doorViolations>0)failures++;
  g.physics.world.free();g.physics.queue.free();
}
if(failures)process.exitCode=1;
