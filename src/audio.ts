import { clamp } from './core';
type VoiceKey = 'welcome' | 'dropoff' | 'slow' | 'crash' | 'thanks' | 'door';
const phrases: Record<VoiceKey,string> = {welcome:'師傅，唔該！',dropoff:'前面有落，唔該！',slow:'師傅，慢啲呀！',crash:'嘩！小心啲呀！',thanks:'唔該晒！',door:'師傅，未閂門呀！'};
export class GameAudio {
  context?: AudioContext; music?: GainNode; sfx?: GainNode; voice?: GainNode;
  engine?: OscillatorNode; engine2?: OscillatorNode; engineGain?: GainNode;
  noise?: AudioBuffer; step=0; nextBeat=0; playing=false; alarmAt=0; lastVoice=-10;
  values={music:.42,sfx:.72,voice:.80}; buffers=new Map<VoiceKey,AudioBuffer>();
  async unlock() {
    if(!this.context) {
      const Ctor=window.AudioContext || (window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext;
      this.context=new Ctor(); const c=this.context;
      const master=c.createDynamicsCompressor();master.threshold.value=-12;master.ratio.value=4;master.connect(c.destination);
      this.music=c.createGain();this.sfx=c.createGain();this.voice=c.createGain();
      this.music.connect(master);this.sfx.connect(master);this.voice.connect(master);
      this.engineGain=c.createGain();this.engineGain.gain.value=0;
      const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=320;this.engineGain.connect(filter);filter.connect(this.sfx);
      this.engine=c.createOscillator();this.engine.type='sawtooth';this.engine.frequency.value=42;this.engine.connect(this.engineGain);this.engine.start();
      this.engine2=c.createOscillator();this.engine2.type='triangle';this.engine2.frequency.value=84;this.engine2.connect(this.engineGain);this.engine2.start();
      this.noise=c.createBuffer(1,c.sampleRate,c.sampleRate);const n=this.noise.getChannelData(0);for(let i=0;i<n.length;i++)n[i]=Math.random()*2-1;
      for(const key of Object.keys(phrases) as VoiceKey[]) fetch(`/audio/${key}.wav`).then(r=>r.ok?r.arrayBuffer():Promise.reject()).then(b=>c.decodeAudioData(b)).then(b=>this.buffers.set(key,b)).catch(()=>{});
      this.setLevels(this.values);
    }
    await this.context.resume();this.nextBeat=this.context.currentTime+.05;
  }
  setLevels(v:typeof this.values){this.values=v;if(this.music)this.music.gain.value=v.music*.3;if(this.sfx)this.sfx.gain.value=v.sfx;if(this.voice)this.voice.gain.value=v.voice;}
  tone(freq:number,time:number,duration:number,volume:number,type:OscillatorType='sine',bus=this.sfx,end?:number){
    if(!this.context||!bus)return;const c=this.context,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,time);if(end)o.frequency.exponentialRampToValueAtTime(Math.max(20,end),time+duration);g.gain.setValueAtTime(.0001,time);g.gain.exponentialRampToValueAtTime(Math.max(.001,volume),time+.008);g.gain.exponentialRampToValueAtTime(.0001,time+duration);o.connect(g);g.connect(bus);o.start(time);o.stop(time+duration+.01);
  }
  hiss(time:number,duration:number,volume:number,freq=1800,bus=this.sfx){if(!this.context||!this.noise||!bus)return;const c=this.context,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=this.noise;f.type='highpass';f.frequency.value=freq;g.gain.setValueAtTime(volume,time);g.gain.exponentialRampToValueAtTime(.0001,time+duration);s.connect(f);f.connect(g);g.connect(bus);s.start(time);s.stop(time+duration);}
  tick(speed:number,throttle:number,brake:boolean,remaining:number,active:boolean){
    const c=this.context;if(!c)return;const t=c.currentTime;
    this.engineGain?.gain.setTargetAtTime(active?.035+Math.abs(speed)*.0015:0,t,.12);
    this.engine?.frequency.setTargetAtTime(34+Math.abs(speed)*3.7+(throttle>0?12:0),t,.09);this.engine2?.frequency.setTargetAtTime(68+Math.abs(speed)*7.4,t,.09);
    if(active&&Math.abs(speed)*3.6>80&&t-this.alarmAt>.72){this.tone(1380,t,.13,.12,'square');this.tone(1380,t+.20,.13,.10,'square');this.alarmAt=t;if(Math.abs(speed)>25)this.say('slow');}
    if(active&&brake&&Math.abs(speed)>10&&Math.random()<.09)this.hiss(t,.13,.055,2600);
    if(!active){this.nextBeat=t+.04;return;}
    while(this.nextBeat<t+.12){
      const b=this.step%16,bar=Math.floor(this.step/16)%8,root=[55,55,65.406,49,55,55,73.416,49][bar],at=this.nextBeat;
      if(b===0||b===6||b===8||b===14)this.tone(130,at,.16,.8,'sine',this.music,42);
      if(b===4||b===12){this.hiss(at,.14,.35,1400,this.music);this.tone(190,at,.10,.21,'triangle',this.music,85);}
      this.hiss(at,.025,b%2===0?.12:.065,7000,this.music);
      if(b%2===0)this.tone(root*[1,1,1.5,1,2,1.5,1.189,1][b/2],at,.145,.22,'sawtooth',this.music);
      if([2,7,10,15].includes(b)){const f=root*([8,6,9,5][Math.floor(b/4)]);this.tone(f,at,.13,.065,'triangle',this.music);this.tone(f*1.5,at+.025,.13,.028,'sine',this.music);}
      if(remaining<30&&b%2===0)this.tone(880,at,.045,.025,'square',this.music);
      this.step++;this.nextBeat+=60/158/4;
    }
  }
  effect(kind:'coin'|'door'|'hit'|'person'|'count'|'start'|'finish'|'horn',intensity=1){const c=this.context;if(!c)return;const t=c.currentTime;
    if(kind==='coin'){this.tone(1568,t,.12,.15);this.tone(2093,t+.09,.2,.13);}
    if(kind==='door'){this.hiss(t,.40,.16,700);this.tone(130,t+.28,.10,.11,'triangle',this.sfx,50);}
    if(kind==='hit'||kind==='person'){this.hiss(t,.22,.24*clamp(intensity,.3,1.5),400);this.tone(85,t,.19,.3,'triangle',this.sfx,25);if(kind==='person')this.say('crash',true);}
    if(kind==='count')this.tone(600,t,.14,.15,'sine');
    if(kind==='start'){this.tone(1100,t,.34,.13);this.say('welcome');}
    if(kind==='finish'){[523,659,784,1047].forEach((f,i)=>this.tone(f,t+i*.14,.5,.13));}
    if(kind==='horn'){this.tone(350,t,.32,.10,'sawtooth');this.tone(440,t,.32,.09,'sawtooth');}
  }
  say(key:VoiceKey,force=false){const c=this.context;if(!c||(!force&&c.currentTime-this.lastVoice<5))return;this.lastVoice=c.currentTime;
    const buffer=this.buffers.get(key);if(buffer){const s=c.createBufferSource();s.buffer=buffer;s.connect(this.voice!);s.start();return;}
    if('speechSynthesis'in window){const voices=speechSynthesis.getVoices(),v=voices.find(v=>/zh[-_]HK|yue/i.test(v.lang));if(v){const u=new SpeechSynthesisUtterance(phrases[key]);u.voice=v;u.lang='zh-HK';u.rate=1.08;u.volume=this.values.voice;speechSynthesis.cancel();speechSynthesis.speak(u);return;}}
    // Always provide a vocal-like surprise even if device speech is unavailable.
    this.tone(370,c.currentTime,.32,.10,'sawtooth',this.voice,740);this.tone(610,c.currentTime+.06,.27,.06,'triangle',this.voice,280);
  }
  pause(){this.playing=false;if(this.engineGain&&this.context)this.engineGain.gain.setTargetAtTime(0,this.context.currentTime,.05);if('speechSynthesis'in window)speechSynthesis.cancel();this.context?.suspend();}
}
