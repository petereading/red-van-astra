// Optional asset-generation tool. Install @echogarden/espeak-ng-emscripten separately.
// Usage: node scripts/generate-voices.mjs [absolute path to espeak-ng.js]
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const { default: factory } = await import(process.argv[2] || '@echogarden/espeak-ng-emscripten');
const module = await factory();
const worker = new module.eSpeakNGWorker();
worker.set_rate(215);
worker.set_volume(115);
const phrases = {thanks:'唔該',complaint:'搞錯呀',wow:'嘩',gasp:'啊'};
const out = resolve('public/audio'); mkdirSync(out, {recursive:true});
for (const gender of ['male','female']) for (const [phrase,text] of Object.entries(phrases)) {
  const key=phrase+'-'+gender;
  worker.set_voice(gender==='female'?'yue+f3':'yue+m3','yue',gender==='female'?2:1,gender==='female'?26:36,0);
  worker.set_pitch(gender==='female'?69:37);
  worker.set_rate(phrase==='gasp'?185:215);
  const chunks=[];
  const cb=module.addFunction((ptr,count,_events)=>{if(ptr&&count)chunks.push(new Int16Array(module.HEAP16.subarray(ptr/2,ptr/2+count)));return 0;},'iiii');
  worker.synth_(text,cb); module.removeFunction(cb);
  const length=chunks.reduce((n,c)=>n+c.length,0);
  if(!length)throw new Error('No audio samples for '+key);
  const wav=Buffer.alloc(44+length*2);wav.write('RIFF',0);wav.writeUInt32LE(36+length*2,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(22050,24);wav.writeUInt32LE(44100,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(length*2,40);
  let offset=44;for(const chunk of chunks)for(const sample of chunk){wav.writeInt16LE(sample,offset);offset+=2;}
  writeFileSync(resolve(out,key+'.wav'),wav);console.log(key,`${(length/22050).toFixed(2)}s`,wav.length+' bytes');
}
