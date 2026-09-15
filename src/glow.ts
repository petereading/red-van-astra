import * as T from 'three';

const cache=new Map<string,T.CanvasTexture>();
export function glowTexture(shape:'disc'|'zone'|'curtain'){
  if(cache.has(shape))return cache.get(shape)!;
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=shape==='zone'?512:256;
  const c=canvas.getContext('2d')!,w=canvas.width,h=canvas.height;
  if(shape==='disc'){
    const g=c.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);g.addColorStop(0,'rgba(255,255,255,.9)');g.addColorStop(.3,'rgba(255,255,255,.38)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,w,h);
  }else if(shape==='zone'){
    c.shadowColor='white';c.shadowBlur=27;c.strokeStyle='white';c.lineWidth=10;c.strokeRect(32,32,w-64,h-64);c.shadowBlur=0;c.fillStyle='rgba(255,255,255,.09)';c.fillRect(32,32,w-64,h-64);
  }else{
    const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.6,'rgba(255,255,255,.08)');g.addColorStop(1,'rgba(255,255,255,.7)');c.fillStyle=g;c.fillRect(0,0,w,h);
  }
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;cache.set(shape,texture);return texture;
}
/** One gentle breath every 2.6 seconds, never disappearing between pulses. */
export function stopPulse(time:number){return .65+.35*(.5-.5*Math.cos(time*Math.PI*2/2.6));}
