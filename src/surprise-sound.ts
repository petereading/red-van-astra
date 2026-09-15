import { random } from './core';

/** Original, wordless arcade gasps. Breath plus a brief open-vowel resonance, no TTS. */
export function surpriseWave(sampleRate:number,variant:number){
  const high=variant%2===1,duration=variant<2?.52:.68,base=high?255:151;
  const out=new Float32Array(Math.ceil(duration*sampleRate)),rng=random(72143+variant),partials=24;
  const amplitudes=Array.from({length:partials},(_,i)=>{
    const f=base*(i+1),formants=high?[850,1500,2900]:[640,1120,2450];
    return (i===0?.26:0)+formants.reduce((a,center,n)=>a+Math.exp(-(((f-center)/(n===2?370:230))**2))*[.3,.18,.05][n],0)/(1+i*.16);
  });
  let phase=0,lastNoise=0;
  for(let i=0;i<out.length;i++){
    const t=i/sampleRate,u=t/duration,envelope=Math.min(1,t/.045)*Math.max(0,1-u)**1.5;
    const pitch=base*(.88+.38*Math.sin(u*Math.PI)+.012*Math.sin(t*36));phase+=pitch/sampleRate*Math.PI*2;
    let voiced=0;for(let h=1;h<=partials;h++)voiced+=Math.sin(phase*h)*amplitudes[h-1];
    const noise=rng()*2-1,breath=(noise-lastNoise)*(.11+Math.exp(-t*23)*.3);lastNoise=noise;
    out[i]=Math.tanh((voiced*.68+breath)*envelope)*.48;
  }
  return out;
}
