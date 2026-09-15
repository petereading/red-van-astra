import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { DemoRecorder, INTRO_MS, OUTRO_MS, recordingMime } from '../src/demo';
import { UI } from '../src/ui';
import { newStats } from '../src/core';

class Track extends EventTarget {
  readyState='live';stops=0;
  constructor(public kind:string,public surface='browser'){super();}
  getSettings(){return {displaySurface:this.surface};}
  stop(){this.readyState='ended';this.stops++;}
  end(){this.readyState='ended';this.dispatchEvent(new Event('ended'));}
}
class Stream {
  constructor(public tracks:Track[]){}
  getTracks(){return this.tracks;}
  getVideoTracks(){return this.tracks.filter(t=>t.kind==='video');}
  getAudioTracks(){return this.tracks.filter(t=>t.kind==='audio');}
}
class Recorder {
  static instances:Recorder[]=[];
  static isTypeSupported(m:string){return m.includes('webm');}
  state='inactive';mimeType:string;
  ondataavailable?: (e:{data:Blob})=>void;onstop?:()=>void;onerror?:()=>void;
  constructor(public stream:Stream,options:{mimeType?:string}){this.mimeType=options.mimeType??'video/webm';Recorder.instances.push(this);}
  start(){this.state='recording';}
  stop(){this.state='inactive';queueMicrotask(()=>{this.ondataavailable?.({data:new Blob(['recorded frames'],{type:this.mimeType})});this.onstop?.();});}
}
function setup(t:TestContext){
  t.mock.timers.enable({apis:['setTimeout']});Recorder.instances=[];
  const globals:Record<string,PropertyDescriptor|undefined>={};
  function define(k:string,value:unknown){globals[k]=Object.getOwnPropertyDescriptor(globalThis,k);Object.defineProperty(globalThis,k,{value,configurable:true,writable:true});}
  const video=new Track('video'),audio=new Track('audio'),capture=new Stream([video]);
  const nodes=new Map<string,any>(),visible=new Set<string>();
  const ui:any={el:(id:string)=>{if(!nodes.has(id))nodes.set(id,{disabled:false,textContent:'',pause(){},load(){},removeAttribute(key:string){delete this[key];}});return nodes.get(id);},show:(id:string)=>visible.add(id),hide:(id:string)=>visible.delete(id),text:(id:string,text:string)=>ui.el(id).textContent=text};
  const calls={starts:0,stops:0,releases:0,options:null as any};
  const media={getDisplayMedia:async(options:unknown)=>{calls.options=options;return capture;}};
  define('navigator',{mediaDevices:media});define('document',{body:{classList:{add(){},remove(){}}}});
  define('MediaRecorder',Recorder);define('MediaStream',Stream);
  const gameAudio:any={unlock:async()=>{},recordingSource:()=>({stream:new Stream([audio]),release:()=>{calls.releases++;audio.stop();}})};
  const demo=new DemoRecorder(ui,gameAudio,{start:async()=>{calls.starts++;},stop:()=>{calls.stops++;}});
  t.after(()=>{demo.stop('test cleanup');for(const[k,v]of Object.entries(globals)){if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);}});
  return {demo,ui,visible,calls,media,video,audio,capture};
}

test('recording includes menu lead-in, game audio and score outro, then flushes a download',async t=>{
  const f=setup(t);f.demo.open();await f.demo.begin();
  assert.equal(f.demo.busy,true);assert.equal(f.calls.options.audio,false); // No mic/system audio.
  assert.deepEqual(Recorder.instances[0].stream.getTracks(),[f.video,f.audio]);
  t.mock.timers.tick(INTRO_MS-1);assert.equal(f.calls.starts,0);
  t.mock.timers.tick(1);assert.equal(f.calls.starts,1);
  f.demo.finished();t.mock.timers.tick(OUTRO_MS-1);assert.equal(f.demo.busy,true);
  t.mock.timers.tick(1);await Promise.resolve();
  assert.equal(f.demo.busy,false);assert.equal(f.calls.releases,1);assert.equal(f.video.readyState,'ended');
  assert.equal(f.visible.has('recording-result'),true);assert.equal(f.visible.has('recording-reopen'),true);
  assert.match(f.ui.el('recording-download').download,/^red-van-auto-demo-.*\.webm$/);
  assert.match(f.ui.el('recording-video').src,/^blob:/);
  URL.revokeObjectURL(f.ui.el('recording-video').src);
});

test('cancelling while source picker is open releases a late stream without starting a game',async t=>{
  const f=setup(t);let resolve!:(stream:Stream)=>void;
  f.media.getDisplayMedia=()=>new Promise(r=>{resolve=r;});
  const preparing=f.demo.begin();f.demo.stop('cancelled');resolve(f.capture);await preparing;
  t.mock.timers.tick(20_000);
  assert.equal(f.video.readyState,'ended');assert.equal(f.calls.starts,0);assert.equal(Recorder.instances.length,0);assert.equal(f.demo.busy,false);
});

test('permission refusal and non-tab selection leave no capture running and permit retry',async t=>{
  const f=setup(t);f.media.getDisplayMedia=async()=>{throw new DOMException('denied','NotAllowedError');};
  await f.demo.begin();assert.equal(f.demo.busy,false);assert.match(f.ui.el('demo-error').textContent,/未開始錄影/);
  f.media.getDisplayMedia=async()=>f.capture;f.video.surface='monitor';
  await f.demo.begin();assert.equal(f.video.readyState,'ended');assert.match(f.ui.el('demo-error').textContent,/而非整個螢幕/);assert.equal(Recorder.instances.length,0);
});

test('browser stop-sharing saves partial video and cancels delayed automatic start',async t=>{
  const f=setup(t);await f.demo.begin();f.video.end();await Promise.resolve();
  t.mock.timers.tick(20_000);assert.equal(f.calls.starts,0);assert.equal(f.demo.busy,false);
  assert.match(f.ui.el('recording-message').textContent,/已停止/);assert.equal(f.calls.releases,1);
  URL.revokeObjectURL(f.ui.el('recording-video').src);
});

test('format fallback and unsupported capture are handled without entering a demo',t=>{
  assert.equal(recordingMime(m=>m==='video/mp4'),'video/mp4');assert.equal(recordingMime(()=>false),'');
  const f=setup(t);Object.defineProperty(globalThis,'navigator',{value:{},configurable:true});f.demo.open();
  assert.equal(f.ui.el('demo-record').disabled,true);assert.match(f.ui.el('demo-error').textContent,/未提供分頁錄影/);
});

test('demonstrations and free play never write the personal best; free play reports all service objectives',t=>{
  const f=setup(t);let writes=0;
  const old=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  Object.defineProperty(globalThis,'localStorage',{value:{getItem:()=>null,setItem:()=>writes++},configurable:true});
  t.after(()=>{if(old)Object.defineProperty(globalThis,'localStorage',old);else Reflect.deleteProperty(globalThis,'localStorage');});
  f.ui.el('grade').dataset={};f.ui.setMode=()=>{};f.ui.updateBest=()=>{};
  const stats={...newStats(),completed:true,delivered:10,picked:10,remaining:30};
  UI.prototype.results.call(f.ui,stats,8521986,'finished',true);assert.equal(writes,0);
  assert.match(f.ui.el('result-subtitle').textContent,/自動駕駛示範/);
  UI.prototype.results.call(f.ui,stats,123,'finished',false,'free');assert.equal(writes,0);
  assert.equal(f.ui.el('grade').textContent,'✓');assert.equal(f.ui.el('result-title').textContent,'全部接送完成！');
  assert.doesNotMatch(f.ui.el('result-stats').innerHTML,/超速|駕駛分|衝紅燈/);
  UI.prototype.results.call(f.ui,{...stats,missed:1},123,'finished',false,'free');assert.equal(writes,0);
  assert.equal(f.ui.el('grade').textContent,'✕');assert.match(f.ui.el('result-title').textContent,/接送未完成/);
  UI.prototype.results.call(f.ui,stats,123,'finished');assert.equal(writes,1);
});
