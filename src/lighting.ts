import * as T from 'three';
import { setNightMaterials, type City } from './visuals';
export class StreetLighting {
  lights=Array.from({length:6},()=>new T.PointLight('#ffd09b',0,27,2));
  headlamps=[new T.SpotLight('#fff0c8',0,54,.48,.6,1.4),new T.SpotLight('#fff0c8',0,54,.48,.6,1.4)];
  pools:T.Mesh[]=[];clock=0;night=false;
  constructor(public scene:T.Scene,public city:City){
    this.lights.forEach(l=>scene.add(l));this.headlamps.forEach(l=>{scene.add(l);scene.add(l.target);});
    const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const c=canvas.getContext('2d')!,gr=c.createRadialGradient(32,32,1,32,32,31);gr.addColorStop(0,'rgba(255,195,104,.42)');gr.addColorStop(.4,'rgba(255,192,102,.18)');gr.addColorStop(1,'rgba(255,181,75,0)');c.fillStyle=gr;c.fillRect(0,0,64,64);
    const map=new T.CanvasTexture(canvas),mat=new T.MeshBasicMaterial({map,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});
    for(const lamp of city.lamps){const pool=new T.Mesh(new T.PlaneGeometry(15,21),mat);pool.rotation.x=-Math.PI/2;pool.position.set(lamp.position.x,.175,lamp.position.z);pool.visible=false;scene.add(pool);this.pools.push(pool);}
  }
  setNight(night:boolean){this.night=night;setNightMaterials(night);this.lights.forEach(l=>l.intensity=night?120:0);this.headlamps.forEach(l=>l.intensity=night?22:0);this.pools.forEach(p=>p.visible=night);}
  update(dt:number,x:number,z:number,heading:number){
    this.clock-=dt;
    if(this.night&&this.clock<=0){this.clock=.2;const lamps=this.city.lamps.map((g,i)=>({g,i,d:(g.position.x-x)**2+(g.position.z-z)**2})).sort((a,b)=>a.d-b.d);
      this.lights.forEach((light,i)=>{const near=lamps[i];light.visible=!!near&&near.d<80**2;if(near)light.position.set(near.g.position.x,6.3,near.g.position.z);});
      this.pools.forEach((p,i)=>{const lamp=this.city.lamps[i];p.visible=this.night&&Math.hypot(lamp.position.x-x,lamp.position.z-z)<135;p.position.set(lamp.position.x,.175,lamp.position.z);});
    }
    this.headlamps.forEach((light,i)=>{const side=i?-.72:.72;light.position.set(x+Math.cos(heading)*side+Math.sin(heading)*3.25,1.12,z+Math.sin(heading)*side-Math.cos(heading)*3.25);light.target.position.set(x+Math.sin(heading)*31,0,z-Math.cos(heading)*31);light.target.updateMatrixWorld();});
  }
}
