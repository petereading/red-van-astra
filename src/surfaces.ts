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
    if(name==='pavers'||name==='tile'){
      const size=name==='pavers'?64:32;c.lineWidth=name==='pavers'?3:1.5;
      for(let y=0;y<512;y+=size){for(let x=-size;x<512;x+=size*2){const offset=(y/size)%2?size:0;c.fillStyle=`rgba(40,30,20,${rng()*.10})`;c.fillRect(x+offset,y,size*2,size);c.strokeStyle='#646761';c.strokeRect(x+offset,y,size*2,size);}}
    }
    if(name==='plaster'||name==='tile')for(let i=0;i<38;i++){const x=rng()*512,y=rng()*512;c.fillStyle=`rgba(56,49,31,${rng()*.09})`;c.fillRect(x,y,1+rng()*14,8+rng()*88);}
    if(name==='asphalt'){c.strokeStyle='#262c2e77';c.lineWidth=1;for(let i=0;i<7;i++){let x=rng()*512,y=rng()*512;c.beginPath();c.moveTo(x,y);for(let j=0;j<5;j++){x+=(rng()-.5)*30;y+=rng()*16;c.lineTo(x,y);}c.stroke();}}
    const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;map.anisotropy=4;maps.set(name,map);
  }
  const mat=new T.MeshStandardMaterial({color:tint,map:maps.get(name),bumpMap:maps.get(name),bumpScale:name==='asphalt'?.035:.018,roughness:name==='asphalt'?.76:.88,metalness:0});surfaces.set(key,mat);return mat;
}
