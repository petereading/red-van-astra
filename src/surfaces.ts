import * as T from 'three';
import { random } from './core';

const maps=new Map<string,T.CanvasTexture>();
const surfaces=new Map<string,T.MeshStandardMaterial>();
/** Small deterministic tileable textures; no external requests during a game. */
export function surface(name:string,tint='#ffffff'){
  const key=name+tint;if(surfaces.has(key))return surfaces.get(key)!;
  if(!maps.has(name)){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
    const c=canvas.getContext('2d')!,rng=random(853+name.length*71),data=c.createImageData(512,512);
    for(let i=0;i<data.data.length;i+=4){const base=name==='asphalt'?65:name==='pavers'?164:218,n=base+(rng()-.5)*(name==='asphalt'?45:28);data.data[i]=n;data.data[i+1]=n;data.data[i+2]=n;data.data[i+3]=255;}c.putImageData(data,0,0);
    if(name==='pavers'||name==='tile'||name==='stone'||name==='concrete'){
      const size=name==='pavers'?64:32;c.lineWidth=name==='pavers'?3:1.5;
      for(let y=0;y<512;y+=size){for(let x=-size;x<512;x+=size*2){const offset=(y/size)%2?size:0;c.fillStyle=`rgba(40,30,20,${rng()*.10})`;c.fillRect(x+offset,y,size*2,size);c.strokeStyle='#646761';c.strokeRect(x+offset,y,size*2,size);}}
    }
    if(name==='redbrick'){
      c.fillStyle='#a49b91';c.fillRect(0,0,512,512);
      // Alternating basket-weave pairs match the small red paving blocks in the references.
      for(let y=0;y<512;y+=64)for(let x=0;x<512;x+=64){const vertical=(x/64+y/64)%2===0;for(let n=0;n<2;n++){c.fillStyle=`rgb(${174+rng()*27},${145+rng()*20},${128+rng()*16})`;c.fillRect(x+2+(vertical?n*32:0),y+2+(vertical?0:n*32),vertical?28:60,vertical?60:28);}}
    }
    if(name==='cardboard'){c.strokeStyle='#b5a18b';c.lineWidth=2;for(let y=0;y<512;y+=8){c.beginPath();c.moveTo(0,y);c.lineTo(512,y);c.stroke();}c.strokeStyle='#807866';c.strokeRect(8,8,496,496);}
    if(name==='glass'){c.fillStyle='#93afb4';c.fillRect(0,0,512,512);const gr=c.createLinearGradient(0,0,512,512);gr.addColorStop(0,'#c4d0cb');gr.addColorStop(.5,'#73949d');gr.addColorStop(1,'#466771');c.fillStyle=gr;c.fillRect(0,0,512,512);c.strokeStyle='#4d686d';c.lineWidth=3;for(let x=0;x<512;x+=128)c.strokeRect(x,0,128,512);}
    if(name==='grass')for(let i=0;i<6000;i++){c.fillStyle=rng()>.5?'#819d73':'#c3c7a1';c.fillRect(rng()*512,rng()*512,1,2+rng()*5);}
    if(name==='plaster'||name==='tile')for(let i=0;i<38;i++){const x=rng()*512,y=rng()*512;c.fillStyle=`rgba(56,49,31,${rng()*.09})`;c.fillRect(x,y,1+rng()*14,8+rng()*88);}
    if(name==='asphalt'){c.strokeStyle='#262c2e77';c.lineWidth=1;for(let i=0;i<7;i++){let x=rng()*512,y=rng()*512;c.beginPath();c.moveTo(x,y);for(let j=0;j<5;j++){x+=(rng()-.5)*30;y+=rng()*16;c.lineTo(x,y);}c.stroke();}}
    const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;map.anisotropy=4;maps.set(name,map);
  }
  const mat=new T.MeshStandardMaterial({color:tint,map:maps.get(name),bumpMap:maps.get(name),bumpScale:name==='asphalt'?.035:name==='glass'?0:.018,roughness:name==='glass'?.22:name==='asphalt'?.76:.88,metalness:name==='glass'?.55:0});surfaces.set(key,mat);return mat;
}
