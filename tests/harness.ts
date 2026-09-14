import { createCanvas } from '@napi-rs/canvas';
import * as T from 'three';
import { Game } from '../src/game';
import { Physics } from '../src/physics';
import { GameAudio } from '../src/audio';
import { City,makeVehicle } from '../src/visuals';
import { CUMULATIVE,TOTAL_LENGTH } from '../src/core';

Object.defineProperty(globalThis,'document',{value:{createElement:(tag:string)=>{if(tag==='canvas')return createCanvas(768,256);throw new Error(tag);}},configurable:true});
Object.defineProperty(globalThis,'window',{value:globalThis,configurable:true});
export async function headlessGame(seed=8521986,traffic=false){
  const nodes=new Map<string,any>();
  function node(id:string):any{if(!nodes.has(id)){const el:any={style:{},dataset:{},textContent:'',innerHTML:'',classList:{toggle(){},add(){},remove(){}},closest:()=>el};el.parentElement=el;nodes.set(id,el);}return nodes.get(id);}
  const ui:any={el:node,text:(id:string,s:string)=>node(id).textContent=s,show(){},hide(){},setMode(){},results(){}};
  await Physics.init();
  const g=Object.create(Game.prototype) as Game;
  Object.assign(g,{ui,audio:new GameAudio(),scene:new T.Scene(),van:makeVehicle('minibus'),city:new City(),traffic:[],pedestrians:[],riderVisuals:[],stopModels:[],keys:new Set(),touch:new Set(),time:0,checks:[],dropAnnounced:new Set(),hitCooldown:new Map(),pilotServed:new Set(),autopilot:true,qa:true,qaTraffic:traffic,mode:'playing',count:0,doorAmount:0,flash:0,toastUntil:0});
  g.physics=new Physics(g.city.obstacles);
  for(let s=45;s<TOTAL_LENGTH-25;s+=45)g.checks.push(s);g.checks.push(...CUMULATIVE.slice(1,-1));g.checks.sort((a,b)=>a-b);
  g.makeTrip(seed);g.mode='playing';g.autopilot=false;
  return g;
}
export function stepSeconds(g:Game,seconds:number){for(let i=0;i<Math.ceil(seconds*60);i++)g.step(1/60);}
export function disposeGame(g:Game){g.physics.world.free();g.physics.queue.free();}
