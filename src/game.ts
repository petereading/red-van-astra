import * as T from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type RAPIER from '@dimforge/rapier3d-compat';
import { CAPACITY,CUMULATIVE,LENGTHS,RUN_SECONDS,STREETS,TOTAL_LENGTH,angleDiff,clamp,createTrip,newStats,onRoute,projectRoute,random,isStoppedAt,scoreRun,doorPosition,STOP_SPEED,type GameMode,type Controls,type DriveState,type Stop,type Trip,type Stats } from './core';
import { City,makePerson,animatePerson,makeStop,updateStopGlow,makeVehicle,disposeModel,type PersonModel,type VehicleModel } from './visuals';
import { Physics,type HitTarget } from './physics';
import { GameAudio } from './audio';
import { UI } from './ui';
import { DemoRecorder,DEMO_SEED } from './demo';
import { makeSignals,updateSignals,moveTraffic,trafficPoint,type Signal } from './traffic';
import { navigate } from './roads';
import { EXTRA_TEXT } from './streetscape';
import { StreetLighting } from './lighting';
import { WheelSparks, bodyMotion } from './driving-effects';
import { outsideMap, recoveryPose, BOUNDARY_GRACE } from './boundary';
import { animateDodge as dodgeAnimation, dodgeDestination, faceMovement, type Dodge } from './pedestrian-motion';

type Traffic={s:number;speed:number;direction:number;lane:number;model:VehicleModel;body:RAPIER.RigidBody;hitUntil:number;halfLength:number;velocity:number;wrapped:boolean};
type Pedestrian={s:number;lateral:number;offset?:number;person:PersonModel;body:RAPIER.RigidBody;hit:boolean;cross:boolean;phase:number;crossing?:number;dodge?:Dodge};
type RiderVisual={person:PersonModel;from:T.Vector3;to:T.Vector3;moving:number;out:boolean;dodge?:Dodge};
export class Game {
  ui=new UI();audio=new GameAudio();scene=new T.Scene();camera=new T.PerspectiveCamera(55,innerWidth/innerHeight,.1,470);
  renderer:T.WebGLRenderer;city!:City;physics!:Physics;van!:VehicleModel;trip:Trip=createTrip(1986);stats:Stats=newStats();
  state:DriveState={x:-7,z:32,speed:0,heading:0};health=100;mode='menu';gameMode:GameMode='challenge';signals:Signal[]=[];brakeSince=0;brakePeak=0;wasBraking=false;reverseReady=false;brakeJolt=0;
  doorOpen=false;doorAmount=0;unsafeDoor=false;serviceClock=0;terminalOpened=false;
  stopModels:ReturnType<typeof makeStop>[]=[];traffic:Traffic[]=[];pedestrians:Pedestrian[]=[];riderVisuals:RiderVisual[]=[];
  riderBodies:RAPIER.RigidBody[]=[];riderHit=new Set<number>();
  keys=new Set<string>();touch=new Set<string>();time=0;last=0;accumulator=0;count=3;lastCount=4;
  progress=0;checkIndex=0;checks:number[]=[];hitCooldown=new Map<string,number>();toastUntil=0;flash=0;dropAnnounced=new Set<number>();
  menuTime=0;cameraLook=new T.Vector3();cameraPos=new T.Vector3();cameraReady=false;smoke:T.InstancedMesh;smokeDummy=new T.Object3D();
  qa=import.meta.env.DEV&&new URLSearchParams(location.search).get('qa')==='1';autopilot=false;pilotStop=-1;pilotServed=new Set<number>();qaSpeed=1;qaTraffic=true;fps=60;fpsTime=0;frames=0;
  sun:T.DirectionalLight;demoRun=false;demoRecorder?:DemoRecorder;
  ambient:T.HemisphereLight;lighting?:StreetLighting;sparks?:WheelSparks;driveInput:Controls={throttle:0,steer:0,handbrake:false};navigation?:ReturnType<typeof navigate>;nextNavAt=0;boundaryStarted=-1;
  constructor(){
    this.renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.1;
    const generator=new T.PMREMGenerator(this.renderer),room=new RoomEnvironment();this.scene.environment=generator.fromScene(room,.04).texture;room.dispose();generator.dispose();this.scene.environmentIntensity=.6;
    this.renderer.setClearColor('#c9d7d8');this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
    this.ui.el('viewport').append(this.renderer.domElement);this.scene.fog=new T.Fog('#c5d2ce',140,385);
    this.ambient=new T.HemisphereLight('#d5e4f2','#78674e',1.75);this.scene.add(this.ambient);
    this.sun=new T.DirectionalLight('#ffe0ad',3.2);this.sun.position.set(-40,85,35);this.sun.castShadow=true;this.sun.shadow.mapSize.set(1536,1536);this.sun.shadow.camera.left=-35;this.sun.shadow.camera.right=35;this.sun.shadow.camera.top=35;this.sun.shadow.camera.bottom=-35;this.sun.shadow.camera.far=190;this.sun.shadow.bias=-.001;this.scene.add(this.sun);this.scene.add(this.sun.target);
    const smokeMat=new T.MeshBasicMaterial({color:'#455656',transparent:true,opacity:.25,depthWrite:false});this.smoke=new T.InstancedMesh(new T.SphereGeometry(1,7,5),smokeMat,12);this.smoke.visible=false;this.scene.add(this.smoke);
    this.demoRecorder=new DemoRecorder(this.ui,this.audio,{start:()=>this.start(DEMO_SEED,true),stop:()=>{if(this.mode!=='results')this.menu();}});
    this.bind();this.resize();this.applySettings();this.ui.setMode('menu');
  }
  async init(){
    await document.fonts.load('700 24px "Noto Sans TC"',EXTRA_TEXT+'香港日報街坊週刊美食指南汽車世界城中生活恆興士多港灣洗衣榕樹茶室海棠花店德記粥品星光旅館九龍好味道');
    await document.fonts.load('700 24px "Noto Sans TC"','金記茶餐廳旺角電器新發大藥房裕華辦館好運冰室永興五金香港鮮果大眾車行深水埗公共小型巴士北河街福華長沙灣道界限汝州荔枝角當茶藥飯美華理髮陳記燒臘嘉樂餅家聯發布行南洋咖啡銀河唱片春雨花店信和押明記麵家晨光攝影華昌鐘錶海記海味成記鎖匙利達文具樂聲琴行萬通找換請勿急煞');
    await document.fonts.ready;
    this.van=makeVehicle('minibus');this.scene.add(this.van.group);
    this.city=new City();this.scene.add(this.city.group);await Physics.init();this.physics=new Physics(this.city.obstacles);
    this.lighting=new StreetLighting(this.scene,this.city);this.sparks=new WheelSparks();this.scene.add(this.sparks.mesh);this.applyTimeOfDay();
    for(let s=45;s<TOTAL_LENGTH-25;s+=45)this.checks.push(s);
    for(const s of CUMULATIVE.slice(1,-1))this.checks.push(s);this.checks.sort((a,b)=>a-b);
    this.makeTrip(1986);this.ui.ready();if(this.qa)this.makeQa();requestAnimationFrame(t=>this.frame(t));
  }
  bind(){
    this.ui.onStart=()=>void this.start();this.ui.onResume=()=>void this.resume();this.ui.onPause=()=>this.pause();this.ui.onMenu=()=>{if(this.demoRecorder?.busy)this.demoRecorder.stop('示範已停止；影片保留已錄下的部分。');else this.menu();};this.ui.onDoor=()=>{if(!this.demoRecorder?.busy)this.toggleDoor();};this.ui.onSettings=()=>this.applySettings();
    this.ui.onTimeOfDay=()=>this.applyTimeOfDay();
    addEventListener('resize',()=>this.resize());
    addEventListener('keydown',e=>{if((e.target as HTMLElement).matches('input,select'))return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();const key=e.key.toLowerCase();if(this.demoRecorder?.busy&&key!=='escape')return;this.keys.add(key);if(e.repeat)return;if(key==='s'||key==='arrowdown')this.reverseReady=Math.abs(this.state.speed)<.2;if(key==='e')this.toggleDoor();if(key==='r')this.resetVan();if(key==='h'&&this.mode==='playing')this.audio.effect('horn');if(key==='escape'){if(this.mode==='playing'||this.mode==='countdown')this.pause();else if(this.mode==='paused')void this.resume();} });
    addEventListener('keyup',e=>this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur',()=>{this.keys.clear();this.touch.clear();if(this.mode==='playing'||this.mode==='countdown')this.pause();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&(this.mode==='playing'||this.mode==='countdown'))this.pause();});
    document.querySelectorAll<HTMLElement>('[data-control]').forEach(el=>{const key=el.dataset.control!;el.onpointerdown=e=>{e.preventDefault();el.setPointerCapture(e.pointerId);if(key==='brake')this.reverseReady=Math.abs(this.state.speed)<.2;this.touch.add(key);};const end=()=>this.touch.delete(key);el.onpointerup=end;el.onpointercancel=end;el.onlostpointercapture=end;});
  }
  resize(){this.renderer.setSize(innerWidth,innerHeight);this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();}
  applySettings(){this.audio.setLevels(this.ui.settings);this.renderer.setPixelRatio(Math.min(devicePixelRatio,this.ui.settings.quality==='low'?1:1.65));this.renderer.shadowMap.enabled=this.ui.settings.quality==='high';}
  applyTimeOfDay(){const night=this.ui.timeOfDay==='night';this.renderer.setClearColor(night?'#091827':'#c9d7d8');this.renderer.toneMappingExposure=night?1.05:1.1;this.scene.fog=new T.Fog(night?'#102331':'#c5d2ce',night?90:140,night?315:385);this.scene.environmentIntensity=night?.22:.6;this.ambient.color.set(night?'#8ba6d1':'#d5e4f2');this.ambient.groundColor.set(night?'#39434a':'#78674e');this.ambient.intensity=night?.85:1.75;this.sun.color.set(night?'#9cbbdf':'#ffe0ad');this.sun.intensity=night?.6:3.2;this.lighting?.setNight(night);}
  makeTrip(seed:number){
    for(const group of [...this.traffic.map(t=>t.model.group),...this.pedestrians.map(p=>p.person.group),...this.riderVisuals.map(v=>v.person.group),...this.stopModels.map(s=>s.group)]){this.scene.remove(group);disposeModel(group);}
    this.physics.clearMovers();this.traffic=[];this.pedestrians=[];this.riderVisuals=[];this.stopModels=[];this.riderBodies=[];this.riderHit=new Set();
    this.trip=createTrip(seed);this.signals=makeSignals(seed);this.brakeSince=0;this.brakePeak=0;this.wasBraking=false;this.reverseReady=false;this.brakeJolt=0;this.time=0;this.stats=newStats();this.health=100;this.progress=0;this.checkIndex=0;this.doorOpen=false;this.doorAmount=0;this.serviceClock=0;this.unsafeDoor=false;this.terminalOpened=false;this.dropAnnounced.clear();this.hitCooldown.clear();this.pilotServed.clear();this.pilotStop=-1;
    this.state={x:-7,z:32,speed:0,heading:0};this.physics.teleport(this.state);this.physics.reset();this.city.reset();
    this.driveInput={throttle:0,steer:0,handbrake:false};this.navigation=undefined;this.nextNavAt=0;this.boundaryStarted=-1;this.ui.hide('boundary-warning');this.sparks?.reset();if(this.van.ads)this.van.ads.visible=random(seed^9187)()>.42;
    for(const stop of this.trip.stops){const s=makeStop(stop);this.scene.add(s.group);this.stopModels.push(s);}
    for(const r of this.trip.riders){const p=this.trip.stops[r.pickup],point=onRoute(p.s+(r.id%2)*1.5,14.3);const person=makePerson(seed+r.id*31);person.group.position.set(point.x,.25,point.z);person.group.rotation.y=-p.heading-Math.PI/2;this.scene.add(person.group);this.riderVisuals.push({person,from:person.group.position.clone(),to:person.group.position.clone(),moving:0,out:false});}
    for(const r of this.trip.riders)this.riderBodies.push(this.physics.addMover('person',100+r.id,.32,.32));
    const rng=random(this.trip.trafficSeed);
    for(let i=0;i<23;i++){
      const direction=i%3===0?-1:1,s=145+i*(TOTAL_LENGTH-210)/23+(rng()-.5)*30;
      const kind=i%8===0?'bus':i%4===0?'van':i%3===0?'taxi':'car';
      const model=makeVehicle(kind,['#487983','#a74135','#c4b587','#688274','#a29c97'][Math.floor(rng()*5)]);
      this.scene.add(model.group);const body=this.physics.addMover('car',i,kind==='bus'?1.23:.95,kind==='bus'?4.65:kind==='van'?2.6:2.2);
      this.traffic.push({s,speed:8+rng()*5,direction,lane:direction===1?3.05:-3.05,model,body,hitUntil:0,halfLength:kind==='bus'?4.7:kind==='van'?2.65:2.25,velocity:0,wrapped:false});
    }
    for(let i=0;i<46;i++){
      let s=35+rng()*(TOTAL_LENGTH-65);for(const corner of CUMULATIVE)if(Math.abs(s-corner)<30)s=clamp(corner+32,32,TOTAL_LENGTH-32);
      const lateral=(i%2===0?1:-1)*(13.8+rng()*1.4),person=makePerson(seed+i*11+1010),body=this.physics.addMover('person',i,.32,.32);
      this.scene.add(person.group);this.pedestrians.push({s,lateral,person,body,hit:false,cross:false,phase:rng()*10});
    }
    for(const [ci,light]of this.signals.entries())for(let n=0;n<4;n++){const id=this.pedestrians.length,lateral=n%2? -13.8:13.8,person=makePerson(seed+id*11),body=this.physics.addMover('person',id,.32,.32);this.scene.add(person.group);this.pedestrians.push({s:light.s+(n-1.5)*1.1,lateral,person,body,hit:false,cross:true,phase:n*.08,crossing:ci});}
    this.cameraReady=false;this.animateVehicles(0);this.updateHud();
  }
  async start(seed?:number,demo=false){
    if(this.demoRecorder?.busy&&!demo)return;
    await this.audio.unlock();if(demo&&!this.demoRecorder?.busy)return;
    this.keys.clear();this.touch.clear();this.demoRun=demo;this.autopilot=demo;this.gameMode=this.ui.gameMode??'challenge';this.ui.applyGameMode?.(this.gameMode);
    if(demo){this.qaSpeed=1;this.qaTraffic=true;this.time=0;}
    this.makeTrip(seed??crypto.getRandomValues(new Uint32Array(1))[0]);this.mode='countdown';this.count=3;this.lastCount=4;this.accumulator=0;this.ui.setMode('countdown');this.ui.show('countdown');this.toastUntil=0;this.ui.hide('toast');this.ui.hide('help');this.ui.hide('settings');this.ui.hide('credits');
  }
  pause(){if(this.mode!=='playing'&&this.mode!=='countdown')return;this.mode='paused';this.ui.setMode('paused');this.keys.clear();this.touch.clear();this.audio.pause();}
  async resume(){if(this.mode!=='paused')return;await this.audio.unlock();this.mode=this.count>0?'countdown':'playing';this.ui.setMode(this.mode);this.keys.clear();this.touch.clear();}
  menu(){this.sparks?.reset();this.mode='menu';this.autopilot=false;this.demoRun=false;this.ui.setMode('menu');this.ui.hide('settings');this.ui.hide('countdown');this.ui.hide('toast');this.audio.pause();this.state={x:-7,z:32,speed:0,heading:0};this.van.group.position.set(-7,0,32);this.van.group.rotation.set(0,0,0);this.cameraReady=false;}
  toast(text:string,bad=false,duration=2.5){this.ui.text('toast',text);this.ui.el('toast').classList.toggle('bad',bad);this.ui.show('toast');this.toastUntil=this.time+duration;}
  toggleDoor(){if(this.mode!=='playing'||this.doorAmount>.02&&this.doorAmount<.98)return;this.doorOpen=!this.doorOpen;this.serviceClock=0;this.audio.effect('door');if(this.doorOpen&&Math.abs(this.state.speed)>=STOP_SPEED&&!this.unsafeDoor){this.stats.doorViolations++;this.unsafeDoor=true;this.audio.gasp(true);this.notice('未停妥開門！',40);} }
  resetVan(boundary=false){
    if(this.mode!=='playing')return;
    const s=this.checkIndex?this.checks[this.checkIndex-1]:8;
    this.state=boundary?recoveryPose(this.state,this.checks[this.checkIndex]??TOTAL_LENGTH,this.traffic.map(t=>t.model.group.position)):{...onRoute(Math.max(8,s-8),7),speed:0};
    this.physics.teleport(this.state);if(this.gameMode!=='free')this.stats.remaining=Math.max(0,this.stats.remaining-5);this.stats.resets++;
    this.doorOpen=false;this.doorAmount=0;this.unsafeDoor=false;this.serviceClock=0;this.cameraReady=false;this.boundaryStarted=-1;this.navigation=undefined;this.nextNavAt=0;this.ui.hide('boundary-warning');
    this.toast((boundary?'已越界 · 小巴已放回路上，朝返回路線方向':'已返回安全路面')+(this.gameMode==='free'?'':' · −5 秒／駕駛分 −30'),true,3.5);
  }
  updateBoundary(){
    if(!outsideMap(this.state)){this.boundaryStarted=-1;this.ui.hide('boundary-warning');return false;}
    if(this.boundaryStarted<0)this.boundaryStarted=this.time;
    const remaining=BOUNDARY_GRACE-(this.time-this.boundaryStarted);
    this.ui.text('boundary-warning','超出地圖範圍 · '+Math.max(0,remaining).toFixed(1)+' 秒後返回路上');this.ui.show('boundary-warning');
    if(remaining<=0){this.resetVan(true);return true;}return false;
  }
  currentStop(){return this.trip.stops.find(s=>isStoppedAt(this.state,this.state.heading,this.state.speed,s));}
  needsStop(stop:Stop){return stop.terminal||this.trip.riders.some(r=>r.state==='waiting'&&r.pickup===stop.id||r.state==='onboard'&&r.dropoff===stop.id);}
  notice(message:string,penalty=0){this.toast(message+(this.gameMode!=='free'&&penalty?' · 駕駛分 −'+penalty:''),penalty>0,2.6);}
  penalty(points:number){if(this.gameMode!=='free')this.stats.safetyPenalty+=points;}
  onHit(target:HitTarget,speed:number){
    if(this.mode!=='playing')return;const key=target.kind+':'+(target.id??(target.obstacle?.x+','+target.obstacle?.z));if(this.time-(this.hitCooldown.get(key)??-10)<1.5)return;this.hitCooldown.set(key,this.time);
    if(target.kind==='person'){
      if(speed<1.5)return;
      let actor:RiderVisual|Pedestrian;
      if(target.id!>=100){const id=target.id!-100;if(this.riderHit.has(id))return;this.riderHit.add(id);actor=this.riderVisuals[id];}
      else{const p=this.pedestrians[target.id!];if(!p||p.hit)return;p.hit=true;actor=p;}
      const from=actor.person.group.position.clone();
      actor.dodge={at:this.time,from,to:dodgeDestination(from,this.state,this.city.obstacles)};
      this.stats.people++;this.penalty(150);this.audio.gasp(true);this.notice('行人及時跳開，沒有受傷！',150);
    }else if(speed>1.2||target.kind==='car'){
      let damage=0;
      if(target.kind==='car'){this.stats.cars++;this.penalty(60);this.traffic[target.id!].hitUntil=this.time+2;damage=6+speed*.65;this.audio.gasp();this.notice('撞車！',60);}
      else{this.stats.objects++;this.penalty(20);damage=3+speed*.65;this.notice(target.kind==='building'?'撞到'+(target.obstacle?.label??'建築物')+'！請繞行':'撞到'+(target.obstacle?.label??'物件'),20);}
      if(this.gameMode!=='free')this.health-=damage;
      this.audio.effect('hit',speed/13);
      if(target.kind==='object'&&target.obstacle?.group&&speed>3){this.city.knock(target.obstacle,speed,this.state.heading);this.brakeJolt=.8;}
    }else return;
    this.health=Math.max(0,this.health);this.flash=.65;
  }
  animateDodge(actor:RiderVisual|Pedestrian){if(actor.dodge)dodgeAnimation(actor.person,actor.dodge,this.time);}
  animateRiders(dt:number){
    for(const [i,v]of this.riderVisuals.entries()){
      const r=this.trip.riders[i];
      if(v.moving>0){v.moving=Math.max(0,v.moving-dt);v.person.group.position.lerpVectors(v.from,v.to,1-v.moving/.65);faceMovement(v.person,v.from,v.to);animatePerson(v.person,this.time,false,true);if(v.moving===0){animatePerson(v.person,this.time,false,false);if(!v.out)v.person.group.visible=false;}}
      else if(r.state==='waiting'){animatePerson(v.person,this.time,!v.dodge,false);if(v.dodge)this.animateDodge(v);}
    }
  }
  evadePeople(){
    if(Math.abs(this.state.speed)<1.5||this.qa&&!this.qaTraffic)return;
    const danger=(pos:T.Vector3)=>{const dx=pos.x-this.state.x,dz=pos.z-this.state.z,along=(dx*Math.sin(this.state.heading)-dz*Math.cos(this.state.heading))*Math.sign(this.state.speed),across=dx*Math.cos(this.state.heading)+dz*Math.sin(this.state.heading);return Math.abs(across)<1.65&&along> -3&&along<3.4+Math.abs(this.state.speed)*.55;};
    this.pedestrians.forEach((p,id)=>{if(!p.hit&&danger(p.person.group.position))this.onHit({kind:'person',id},Math.abs(this.state.speed));});
    this.riderVisuals.forEach((v,id)=>{if(this.trip.riders[id].state==='waiting'&&!this.riderHit.has(id)&&danger(v.person.group.position))this.onHit({kind:'person',id:id+100},Math.abs(this.state.speed));});
  }
  updatePassengers(dt:number){
    const s=this.currentStop();const pending=s?this.trip.riders.filter(r=>r.state==='onboard'&&(r.dropoff===s.id||s.terminal)||r.state==='waiting'&&r.pickup===s.id):[];
    const onboard=this.trip.riders.filter(r=>r.state==='onboard').length;
    if(s&&this.doorAmount>.97&&this.doorOpen){
      if(s.terminal)this.terminalOpened=true;
      const r=pending.find(r=>r.state==='onboard')??(onboard<CAPACITY?pending.find(r=>r.state==='waiting'):undefined);
      if(r){this.serviceClock+=dt;if(this.serviceClock>=.68){this.serviceClock=0;const v=this.riderVisuals[r.id],doorPoint=doorPosition(this.state,this.state.heading),door=new T.Vector3(doorPoint.x,.25,doorPoint.z);const side=onRoute(s.s+(r.id%2)*1.5,14.3);v.person.group.visible=true;v.moving=.65;v.dodge=undefined;v.person.group.rotation.z=0;
        if(r.state==='waiting'){r.state='onboard';this.stats.picked++;v.from.copy(v.person.group.position);v.to.copy(door);v.out=false;this.audio.effect('coin');this.toast('乘客上車 · 收車費 $12',false,1.1);}
        else{r.state='delivered';this.stats.delivered++;v.from.copy(door);v.to.set(side.x,.25,side.z);v.person.group.position.copy(door);v.out=true;if(!this.dropAnnounced.has(s.id)){this.dropAnnounced.add(s.id);this.audio.effect('bell');}this.toast('乘客安全送達',false,1.1);}
      }}else this.serviceClock=0;
    }else this.serviceClock=0;
    for(const r of this.trip.riders){
      const p=this.trip.stops[r.pickup],d=this.trip.stops[r.dropoff];
      if(r.state==='waiting'&&this.progress>p.s+25){r.state='missed';this.riderVisuals[r.id].person.arm.rotation.z=0;}
      if(r.state==='onboard'&&this.progress>d.s+25&&!d.terminal){r.dropoff=8;this.stats.missed++;this.penalty(25);this.notice('錯過落客位置 · 改於尾站落車',25);}
    }
    const drop=this.trip.stops.find(s=>s.s>=this.progress-8&&s.s-this.progress<90&&this.trip.riders.some(r=>r.state==='onboard'&&r.dropoff===s.id));
    if(drop&&!this.dropAnnounced.has(drop.id)){this.dropAnnounced.add(drop.id);this.audio.effect('bell');this.toast('叮咚 · 前方有乘客落車',false,2.8);}
    if(s?.terminal&&this.terminalOpened&&!this.doorOpen&&this.doorAmount<.02&&onboard===0&&this.checkIndex>=this.checks.length){this.stats.completed=true;this.finish('準時到站！');}
  }
  animateVehicles(dt:number){
    for(const [i,body]of this.riderBodies.entries()){const r=this.trip.riders[i],v=this.riderVisuals[i].person.group.position;const present=r.state==='waiting'&&!this.riderHit.has(i);body.setNextKinematicTranslation(present?{x:v.x,y:1,z:v.z}:{x:15000+i,y:1,z:15000});}
    if(this.mode==='playing'&&this.qaTraffic)moveTraffic(this.traffic,this.signals,dt,this.time,{...this.state,s:projectRoute(this.state).s});
    for(const [i,t]of this.traffic.entries()){
      const a=trafficPoint(t.s-3,t.lane),b=trafficPoint(t.s+3,t.lane),heading=Math.atan2(b.x-a.x,-(b.z-a.z))+(t.direction<0?Math.PI:0);
      let x=(a.x+b.x)*.5,z=(a.z+b.z)*.5;
      if(this.qa&&!this.qaTraffic){x=10000+i*20;z=10000;}
      t.model.group.position.set(x,0,z);t.model.group.rotation.y=-heading;
      if(t.wrapped)t.body.setTranslation({x,y:1.2,z},true);
      t.body.setNextKinematicTranslation({x,y:1.2,z});t.body.setNextKinematicRotation({x:0,y:Math.sin(-heading/2),z:0,w:Math.cos(-heading/2)});
      t.model.wheels.forEach(w=>w.rotation.x-=t.velocity*dt/.5);t.model.group.visible=Math.hypot(this.state.x-x,this.state.z-z)<300;
    }
    this.city.updateSignals?.(this.signals);
    for(const [i,p]of this.pedestrians.entries()){
      let lateral=p.lateral,s=p.s;
      if(p.crossing!==undefined){const signal=this.signals[p.crossing],t=signal.phase==='green'?1:signal.phase==='red'?clamp((signal.elapsed-p.phase)/4.5,0,1):0;lateral=p.lateral*(1-t)+Math.sign(p.lateral)*.8*t;}
      if(!p.cross&&!p.hit)s+=Math.sin(this.time*.22+p.phase)*5;
      const before=p.person.group.position.clone(),pos=onRoute(s,lateral);p.person.group.position.set(pos.x,.25,pos.z);
      const walking=!p.hit&&dt>0&&before.distanceTo(p.person.group.position)>.0001;
      if(walking)faceMovement(p.person,before,p.person.group.position);else if(dt===0)p.person.group.rotation.y=-pos.heading+(p.cross?-Math.sign(p.lateral)*Math.PI/2:Math.cos(this.time*.22+p.phase)<0?Math.PI:0);
      animatePerson(p.person,this.time,false,walking);
      if(p.dodge)this.animateDodge(p);
      let x=pos.x,z=pos.z;if(p.hit||this.qa&&!this.qaTraffic){x=10000+i;z=12000;}
      p.body.setNextKinematicTranslation({x,y:1.0,z});p.person.group.visible=Math.hypot(this.state.x-p.person.group.position.x,this.state.z-p.person.group.position.z)<140;
    }
  }
  controls():Controls {return{throttle:this.keys.has('w')||this.keys.has('arrowup')||this.touch.has('gas')?1:this.keys.has('s')||this.keys.has('arrowdown')||this.touch.has('brake')?-1:0,steer:(this.keys.has('d')||this.keys.has('arrowright')||this.touch.has('right')?1:0)-(this.keys.has('a')||this.keys.has('arrowleft')||this.touch.has('left')?1:0),handbrake:this.keys.has(' '),reverse:this.reverseReady};}
  pilot():Controls{
    if(this.doorOpen||this.doorAmount>.01){
      const at=this.currentStop();
      if(at&&this.doorOpen&&this.doorAmount>.98){const pending=this.trip.riders.some(r=>r.state==='waiting'&&r.pickup===at.id||r.state==='onboard'&&(r.dropoff===at.id||at.terminal));if(!pending){this.toggleDoor();this.pilotServed.add(at.id);}}
      return{throttle:0,steer:0,handbrake:true};
    }
    const p=projectRoute(this.state),stop=this.trip.stops.find(s=>!this.pilotServed.has(s.id)&&this.needsStop(s)&&s.s>=p.s-12);
    const dist=stop?stop.s-p.s:999;
    if(stop&&isStoppedAt(this.state,this.state.heading,this.state.speed,stop)){
      if(!this.doorOpen&&this.doorAmount<.02&&this.pilotStop!==stop.id){this.pilotStop=stop.id;this.toggleDoor();}
      if(this.doorOpen&&this.doorAmount>.98){const pending=this.trip.riders.some(r=>r.state==='waiting'&&r.pickup===stop.id||r.state==='onboard'&&(r.dropoff===stop.id||stop.terminal));if(!pending){this.toggleDoor();this.pilotServed.add(stop.id);}}
      return{throttle:0,steer:0,handbrake:true};
    }
    if(this.doorOpen||this.doorAmount>.01)return{throttle:0,steer:0,handbrake:true};
    const turn=CUMULATIVE.slice(1,-1).find(s=>s>p.s-4);let targetSpeed=19.5;
    if(turn&&turn-p.s<32)targetSpeed=Math.min(targetSpeed,7+Math.max(0,turn-p.s-10)*.38);
    const light=this.signals.find(l=>l.s>p.s&&l.s-p.s<75&&(l.phase==='amber'||l.phase==='red'));
    if(light)targetSpeed=Math.min(targetSpeed,Math.sqrt(Math.max(0,light.s-12-p.s)*10));
    if(stop)targetSpeed=Math.min(targetSpeed,Math.sqrt(Math.max(0,dist-.25)*10));
    const ahead=Math.min(5+Math.abs(this.state.speed)*.50,Math.max(1.4,dist));const target=onRoute(clamp(p.s+ahead,0,TOTAL_LENGTH),7);
    const heading=Math.atan2(target.x-this.state.x,-(target.z-this.state.z)),err=angleDiff(heading,this.state.heading);
    if(Math.abs(err)>.7)targetSpeed=Math.min(targetSpeed,7);
    const throttle=this.state.speed<targetSpeed-.6?1:this.state.speed>targetSpeed+.3?-1:0;
    return{throttle,steer:clamp(err*2.7,-1,1),handbrake:(dist<.8||!!light&&light.s-p.s<12.5)&&Math.abs(this.state.speed)<1,reverse:false};
  }
  step(dt:number){
    if(this.mode==='playing'||this.mode==='countdown')this.time+=dt;
    if(this.mode==='countdown'){this.count-=dt;const n=Math.ceil(this.count);if(n!==this.lastCount&&n>0){this.lastCount=n;this.audio.effect('count');}this.ui.text('countdown',n>0?String(n):'開車！');if(this.count<=0){this.mode='playing';this.ui.setMode('playing');this.ui.hide('countdown');this.audio.effect('start');this.toast('靠左行車 · 留意綠色上客方塊');}return;}
    if(this.mode!=='playing')return;
    this.stats.remaining=Math.max(0,this.stats.remaining-dt);if(this.stats.remaining<=0){this.finish('時間到！');return;}
    const previous=projectRoute(this.state),beforeSpeed=Math.abs(this.state.speed);updateSignals(this.signals,previous.s,dt);
    const input=this.autopilot?this.pilot():this.controls();this.driveInput=input;this.animateVehicles(dt);this.animateRiders(dt);this.evadePeople();this.city.animateProps(dt);
    this.state=this.physics.step(this.state,input,this.health,this.city.distanceToRoad(this.state)>12,(a,b)=>this.onHit(a,b));
    if(this.updateBoundary())return;
    const p=projectRoute(this.state);
    const braking=input.throttle<0||input.handbrake;
    if(braking&&!this.wasBraking){this.brakeSince=this.time;this.brakePeak=beforeSpeed;}
    if(braking&&this.brakePeak>=50/3.6&&Math.abs(this.state.speed)<.5&&this.time-this.brakeSince<1.1&&this.trip.riders.some(r=>r.state==='onboard')){this.stats.harshBrakes++;this.penalty(25);this.brakePeak=0;this.brakeJolt=1;this.audio.gasp(true);this.audio.effect('brake');this.notice('高速急煞！乘客不滿',25);}
    this.wasBraking=braking;
    for(const light of this.signals){const line=light.s-7;if(light.phase==='red'&&!light.violated&&previous.s+3.1<line&&p.s+3.1>=line&&p.distance<12){light.violated=true;this.stats.redLights++;this.penalty(80);this.audio.gasp(true);this.notice('衝紅燈！留意過路行人',80);}}
    while(this.checkIndex<this.checks.length){const c=onRoute(this.checks[this.checkIndex]);if(Math.hypot(this.state.x-c.x,this.state.z-c.z)>22)break;this.checkIndex++;}
    const limit=this.checkIndex<this.checks.length?this.checks[this.checkIndex]+12:TOTAL_LENGTH;
    if(p.distance<20)this.progress=Math.max(this.progress,Math.min(p.s,limit));
    if(Math.abs(this.state.speed)*3.6>80)this.stats.overspeed+=dt;
    this.doorAmount=clamp(this.doorAmount+(this.doorOpen?1:-1)*dt*2,0,1);
    if(this.doorAmount>.03&&Math.abs(this.state.speed)>=STOP_SPEED&&!this.unsafeDoor){this.stats.doorViolations++;this.unsafeDoor=true;this.audio.gasp(true);this.notice('未關門開車！',40);}
    if(this.doorAmount===0)this.unsafeDoor=false;
    this.updatePassengers(dt);
    if(this.health<=0)this.finish('小巴損壞，無法繼續');
    this.audio.tick(this.state.speed,input.throttle,input.throttle<0||input.handbrake,this.stats.remaining,true,input.steer);
  }
  finish(reason:string){if(this.mode!=='playing')return;this.mode='results';this.autopilot=false;this.ui.hide('countdown');this.ui.hide('toast');this.audio.tick(0,0,false,0,false);this.audio.effect('finish');this.ui.results(this.stats,this.trip.seed,reason,this.demoRun,this.gameMode);if(this.demoRun)this.demoRecorder?.finished();}
  frame(now:number){
    const raw=this.last?(now-this.last)/1000:1/60;this.last=now;const dt=Math.min(raw,.12);this.accumulator+=dt*(this.qa?this.qaSpeed:1);
    let steps=0;while(this.accumulator>=1/60&&steps<30){this.step(1/60);this.accumulator-=1/60;steps++;}if(steps===30)this.accumulator=0;
    this.frames++;this.fpsTime+=raw;if(this.fpsTime>.6){this.fps=this.frames/this.fpsTime;this.frames=0;this.fpsTime=0;}
    this.render(dt);if(this.mode==='playing'||this.mode==='countdown')this.updateHud();
    if(this.qa)this.updateQa();requestAnimationFrame(t=>this.frame(t));
  }
  render(dt:number){
    this.brakeJolt=Math.max(0,this.brakeJolt-dt*2.5);const active=this.mode==='playing',input=this.driveInput??this.controls(),motion=bodyMotion(active?this.state.speed:0,active?input.steer:0,this.time,this.brakeJolt);
    this.van.group.position.set(this.state.x+motion.shake*Math.cos(this.state.heading),.14+motion.height,this.state.z+motion.shake*Math.sin(this.state.heading));this.van.group.rotation.set(motion.pitch,-this.state.heading,motion.roll);
    this.van.brake.forEach(l=>l.scale.y=(input.throttle<0||input.handbrake)?1.1:1);
    this.sparks?.update(active?dt:0,this.state,input.steer,input.throttle<0||input.handbrake,active);this.lighting?.update(dt,this.state.x,this.state.z,this.state.heading);this.city.updateVisibility(this.state);
    if(this.van.door){this.van.door.position.z=-2.1+this.doorAmount*1.15;this.van.door.rotation.y=this.doorAmount*.16;}
    if(this.mode==='playing')this.van.wheels.forEach(w=>w.rotation.x-=this.state.speed*dt/.52);
    for(const [i,s]of this.stopModels.entries()){
      const st=this.trip.stops[i],drop=this.trip.riders.some(r=>r.state==='onboard'&&r.dropoff===i),pickup=this.trip.riders.some(r=>r.state==='waiting'&&r.pickup===i);
      s.group.visible=this.mode!=='menu'&&Math.hypot(this.state.x-st.x,this.state.z-st.z)<200;s.zone.visible=(st.terminal||drop||pickup)&&st.s>this.progress-28;
      const col=st.terminal?'#ffd967':drop?'#71d2ff':'#7defa4';updateStopGlow(s,this.time,col);
    }
    if(this.mode==='menu'){
      this.menuTime+=dt;const angle=.72+Math.sin(this.menuTime*.12)*.09;
      const target=new T.Vector3(this.state.x+Math.sin(angle)*13.5,5.4,this.state.z+Math.cos(angle)*13.5);
      this.camera.position.copy(target);this.camera.lookAt(this.state.x-6,1.9,this.state.z-5);
    }else{
      const back=11.2+Math.abs(this.state.speed)*.10,ideal=new T.Vector3(this.state.x-Math.sin(this.state.heading)*back,6.6+Math.abs(this.state.speed)*.018,this.state.z+Math.cos(this.state.heading)*back);
      const look=new T.Vector3(this.state.x+Math.sin(this.state.heading)*7,1.7,this.state.z-Math.cos(this.state.heading)*7);
      // Keep the chase camera outside building walls on tight turns.
      const anchor=new T.Vector3(this.state.x,2.7,this.state.z),delta=ideal.clone().sub(anchor),len=delta.length();
      if(this.physics&&len>0){delta.normalize();const safe=this.physics.cameraDistance(anchor,delta,len);if(safe<len)ideal.copy(anchor).addScaledVector(delta,safe);}
      if(!this.cameraReady){this.cameraPos.copy(ideal);this.cameraLook.copy(look);this.cameraReady=true;}else{this.cameraPos.lerp(ideal,1-Math.exp(-dt*7));this.cameraLook.lerp(look,1-Math.exp(-dt*9));}
      this.camera.position.copy(this.cameraPos);this.camera.lookAt(this.cameraLook);const fov=55+Math.min(7,Math.abs(this.state.speed)*.20);if(Math.abs(this.camera.fov-fov)>.05){this.camera.fov=fov;this.camera.updateProjectionMatrix();}
    }
    this.city.updateOcclusion(dt,this.state,this.camera.position,this.cameraLook,this.mode!=='menu');
    this.sun.position.set(this.state.x-48,65,this.state.z+42);this.sun.target.position.set(this.state.x,0,this.state.z);this.sun.target.updateMatrixWorld();
    this.smoke.visible=this.health<40&&this.mode==='playing';if(this.smoke.visible){for(let i=0;i<12;i++){const age=(this.time*.7+i/12)%1;this.smokeDummy.position.set(this.state.x+Math.sin(i)*age,2.5+age*4,this.state.z+2+age*2);this.smokeDummy.scale.setScalar(.15+age*.7);this.smokeDummy.updateMatrix();this.smoke.setMatrixAt(i,this.smokeDummy.matrix);}this.smoke.instanceMatrix.needsUpdate=true;}
    this.flash=Math.max(0,this.flash-dt*2.8);this.ui.el('damage-flash').style.opacity=String(this.flash*.8);if(this.time>this.toastUntil)this.ui.hide('toast');
    this.renderer.render(this.scene,this.camera);
  }
  updateHud(){
    const kmh=Math.abs(this.state.speed)*3.6,secs=Math.ceil(this.stats.remaining),p=projectRoute(this.state);this.ui.text('timer',`${String(Math.floor(secs/60)).padStart(2,'0')}:${String(secs%60).padStart(2,'0')}`);this.ui.el('timer').parentElement!.classList.toggle('urgent',secs<=30);this.ui.text('speed',String(Math.round(kmh)).padStart(3,'0'));this.ui.el('speed').closest('.speed-unit')!.classList.toggle('alarm',kmh>80);
    this.ui.text('health-value',Math.ceil(this.health)+'%');this.ui.el('health-fill').style.width=this.health+'%';this.ui.el('health-fill').style.background=this.health<35?'#ef6950':'#8fd3a5';if(this.gameMode!=='free'){const live=scoreRun(this.stats,this.trip.riders.length,this.progress/TOTAL_LENGTH);this.ui.text('score',String(live.total).padStart(4,'0'));this.ui.text('live-grade',live.grade);this.ui.el('live-grade').dataset.grade=live.grade;this.ui.text('grade-next',live.next?'距下一級 '+live.next+' 分':'維持安全駕駛');}
    this.ui.text('free-service',this.stats.delivered+' / '+this.trip.riders.length);
    const trafficLight=this.signals.find(l=>l.s>p.s-9&&l.s-p.s<100);if(trafficLight){this.ui.show('traffic-status');this.ui.text('traffic-status',trafficLight.phase==='red'?'● 紅燈 · '+Math.ceil(trafficLight.duration-trafficLight.elapsed)+' 秒 · 行人過路':trafficLight.phase==='amber'?'● 黃燈 · 準備停車':'● 綠燈 · 留意過路處');this.ui.el('traffic-status').dataset.phase=trafficLight.phase;}else this.ui.hide('traffic-status');
    const onboard=this.trip.riders.filter(r=>r.state==='onboard').length;this.ui.text('riders',String(onboard));this.ui.text('delivered',String(this.stats.delivered));this.ui.text('door-status',this.doorAmount>.01?'車門開啟':'車門已關');this.ui.el('door-status').classList.toggle('open',this.doorAmount>.01);this.ui.text('street',STREETS[p.segment]);
    if(!this.navigation||this.time>=this.nextNavAt){this.navigation=navigate(this.state,this.progress,this.checks[this.checkIndex]??TOTAL_LENGTH);this.nextNavAt=this.time+.18;}
    const nav=this.navigation;this.ui.text('nav-title',nav.title);this.ui.text('nav-distance',(nav.recovering?'返回路線 · ':'')+nav.distance+' m');this.ui.el('nav-arrow').style.transform=`rotate(${nav.angle}rad)`;this.ui.el('nav-arrow').dataset.recovering=String(nav.recovering);this.ui.el('nav-title').dataset.recovering=String(nav.recovering);if(nav.recovering)this.ui.text('street',nav.street);
    const stop=this.trip.stops.find(s=>s.s>this.progress-20&&this.needsStop(s));if(stop&&stop.s-this.progress<160){const isDrop=this.trip.riders.some(r=>r.state==='onboard'&&r.dropoff===stop.id);this.ui.show('stop-banner');this.ui.text('stop-label',stop.terminal?'停妥、落客、關門，完成路線':isDrop?'乘客要求落車':'前方有人招手');this.ui.text('stop-name',stop.name);this.ui.text('stop-distance',Math.max(0,Math.round(stop.s-p.s))+' m');this.ui.el('stop-banner').classList.toggle('dropoff',isDrop);}else this.ui.hide('stop-banner');
    const current=this.currentStop();let prompt='停妥後開門上客';if(this.doorOpen){const pending=current&&this.trip.riders.some(r=>r.state==='waiting'&&r.pickup===current.id||r.state==='onboard'&&(r.dropoff===current.id||current.terminal));prompt=pending?'乘客上落中…':'上落客完成 · 按 E 關門';if(!current)prompt='請關門後行車';}else if(this.doorAmount>.02)prompt='正在關門…';else if(current)prompt=current.terminal?'按 E 開門 · 尾站落客':'按 E 開門 · 乘客上落';else if(kmh>2)prompt='將左前車門停入發光方塊';this.ui.text('door-prompt',prompt);this.ui.el('service-fill').style.width=(this.serviceClock/.68*100)+'%';
    const progress=clamp(this.progress/TOTAL_LENGTH*100,0,100);this.ui.text('progress-text',Math.floor(progress)+'%');this.ui.el('progress-fill').style.width=progress+'%';
  }
  makeQa(){
    const panel=document.createElement('div');panel.id='qa-panel';panel.innerHTML='<b>Development QA</b><label>速度<select id="qa-speed"><option value="1">正常速度</option><option value="4">4 倍測試</option></select></label><label><input id="qa-traffic" type="checkbox" checked>交通及行人碰撞</label><button id="qa-pilot">完整路線駕駛測試</button><button id="qa-stop">停站流程測試</button><button id="qa-speeding">超速及車門測試</button><button id="qa-timeout">逾時測試</button><button id="qa-collision">撞車及損壞測試</button><output id="qa-output"></output>';document.body.append(panel);
    (document.getElementById('qa-speed')as HTMLSelectElement).onchange=e=>this.qaSpeed=Number((e.target as HTMLSelectElement).value);(document.getElementById('qa-traffic')as HTMLInputElement).onchange=e=>this.qaTraffic=(e.target as HTMLInputElement).checked;
    document.getElementById('qa-pilot')!.onclick=async()=>{await this.start(8521986);this.autopilot=true;};
    document.getElementById('qa-stop')!.onclick=async()=>{await this.start(8521986);this.mode='playing';this.count=0;this.ui.setMode('playing');this.ui.hide('countdown');const s=this.trip.stops[0];this.state={x:s.x,z:s.z,heading:s.heading,speed:0};this.physics.teleport(this.state);this.progress=s.s;this.checkIndex=this.checks.filter(v=>v<s.s).length;};
    document.getElementById('qa-speeding')!.onclick=()=>{if(this.mode==='paused')void this.resume();const p=onRoute(45,7);this.state={...p,speed:25};this.physics.teleport(this.state);this.mode='playing';this.count=0;this.ui.setMode('playing');this.ui.hide('countdown');};
    document.getElementById('qa-timeout')!.onclick=()=>{this.stats.remaining=.3;if(this.mode==='paused')void this.resume();};
    document.getElementById('qa-collision')!.onclick=()=>{const t=this.traffic[0],p=onRoute(t.s-8,t.lane);this.state={...p,speed:18};this.physics.teleport(this.state);if(this.mode==='paused')void this.resume();};
  }
  updateQa(){this.ui.text('qa-output',`狀態 ${this.mode}\n進度 ${this.progress.toFixed(1)} / ${TOTAL_LENGTH}\n座標 ${this.state.x.toFixed(1)}, ${this.state.z.toFixed(1)}\n車速 ${(this.state.speed*3.6).toFixed(1)}\n檢查點 ${this.checkIndex}/${this.checks.length}\n上車 ${this.stats.picked} · 送達 ${this.stats.delivered}\n超速 ${this.stats.overspeed.toFixed(1)}\n車門違規 ${this.stats.doorViolations}\n碰撞 ${this.stats.people}/${this.stats.cars}/${this.stats.objects}\nFPS ${this.fps.toFixed(0)} · draw ${this.renderer.info.render.calls}\n倒數 ${this.stats.remaining.toFixed(1)}`);}
}
