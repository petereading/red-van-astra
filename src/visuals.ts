import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { surface } from './surfaces';
import { CROSSINGS,trafficPoint,type Signal } from './traffic';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CUMULATIVE, LENGTHS, ROUTE, STREETS, TOTAL_LENGTH, onRoute, random, STOP_HALF_LENGTH, STOP_HALF_WIDTH, type Stop, type V2 } from './core';

const materials = new Map<string, T.MeshStandardMaterial>();
export function material(color: string, glow = false) {
  if(color.startsWith('@')){const [kind,tint]=color.slice(1).split(':');return surface(kind,tint);}
  const key = color + glow;
  if (!materials.has(key)) materials.set(key, new T.MeshStandardMaterial({ color, roughness: .64, metalness: .16, ...(glow ? { emissive: color, emissiveIntensity: .65 } : {}) }));
  const m=materials.get(key)!;if(['#173842','#174450','#153039','#18404b'].includes(color)){m.roughness=.16;m.metalness=.65;}return m;
}
const paintCache=new Map<string,T.MeshStandardMaterial>();
const roundedCache=new Map<string,T.BufferGeometry>();
function roundedBox(parent:T.Object3D,color:string,x:number,y:number,z:number,w:number,h:number,d:number,r=.12){const key=[w,h,d,r].join('/');if(!roundedCache.has(key))roundedCache.set(key,new RoundedBoxGeometry(w,h,d,3,Math.min(r,w/4,h/4,d/4)));const mesh=new T.Mesh(roundedCache.get(key)!,material(color));mesh.position.set(x,y,z);parent.add(mesh);return mesh;}
const cube = new T.BoxGeometry(1, 1, 1);
export function disposeModel(root:T.Object3D){const seen=new Set<T.BufferGeometry>();root.traverse(o=>{if(o instanceof T.Mesh&&o.geometry!==cube&&![...roundedCache.values()].includes(o.geometry)&&!seen.has(o.geometry)){seen.add(o.geometry);o.geometry.dispose();}});}
export function box(parent: T.Object3D, color: string, x: number, y: number, z: number, w: number, h: number, d: number, glow = false) {
  const m = new T.Mesh(cube, material(color, glow)); m.position.set(x, y, z); m.scale.set(w, h, d); parent.add(m); return m;
}
export function cylinder(parent: T.Object3D, color: string, x: number, y: number, z: number, r: number, h: number, sides = 10) {
  const m = new T.Mesh(new T.CylinderGeometry(r, r, h, sides), material(color)); m.position.set(x, y, z); parent.add(m); return m;
}
const textCache = new Map<string, T.MeshBasicMaterial>();
export function sign(text: string, sub: string, bg: string, fg: string, w: number, h: number, style='classic') {
  const key = [text, sub, bg, fg,style].join('|');
  if (!textCache.has(key)) {
    const canvas = document.createElement('canvas'); canvas.width = style==='vertical'?256:768; canvas.height = style==='vertical'?768:256;
    const c = canvas.getContext('2d')!,cw=canvas.width,ch=canvas.height;c.fillStyle=bg;c.fillRect(0,0,cw,ch);
    c.strokeStyle=fg;c.lineWidth=style==='modern'?2:5;c.strokeRect(9,9,cw-18,ch-18);
    if(style==='neon'){c.fillStyle='#101c22';c.fillRect(17,17,cw-34,ch-34);c.shadowColor=fg;c.shadowBlur=13;}
    c.fillStyle=fg;c.textAlign='center';c.textBaseline='middle';
    if(style==='vertical'){const letters=[...text].slice(0,5);c.font='900 116px "Noto Sans TC",sans-serif';letters.forEach((letter,i)=>c.fillText(letter,cw/2,75+i*(610/Math.max(1,letters.length-1)),220));}
    else{c.font=`${style==='modern'?500:900} ${text.length>7?72:96}px "Noto Sans TC",sans-serif`;c.fillText(text,cw/2,sub?103:128,cw-60);c.shadowBlur=0;if(sub){c.font='600 25px Arial';c.fillText(sub,cw/2,204,cw-52);}}
    if(style==='classic'){const rng=random(text.charCodeAt(0));for(let i=0;i<80;i++){c.fillStyle=`rgba(35,31,22,${rng()*.12})`;c.fillRect(rng()*cw,rng()*ch,1+rng()*20,1+rng()*3);}}
    const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
    textCache.set(key, new T.MeshBasicMaterial({ map: texture, side: T.DoubleSide }));
  }
  return new T.Mesh(new T.PlaneGeometry(w, h), textCache.get(key)!);
}
export type VehicleModel = { group: T.Group; wheels: T.Object3D[]; door?: T.Group; brake: T.Mesh[] };
export function makeVehicle(type: 'minibus' | 'taxi' | 'car' | 'van' | 'bus', color = '#c52634'): VehicleModel {
  const g = new T.Group(), wheels: T.Object3D[] = [], brakes: T.Mesh[] = [];
  const mb = type === 'minibus', big = type === 'bus';
  const length = mb ? 6.4 : big ? 9.4 : type === 'van' ? 5.3 : 4.5;
  const width = big ? 2.5 : mb ? 2.2 : 1.95;
  const bodyHeight = big ? 3.8 : mb ? 2.2 : type === 'van' ? 2 : 1.05;
  const shell=roundedBox(g,mb?'#eedfc2':color,0,bodyHeight/2+.6,0,width,bodyHeight,length,.19);const paintKey=mb?'#eedfc2':color;if(!paintCache.has(paintKey)){const m=material(paintKey).clone();m.roughness=.29;m.metalness=.35;paintCache.set(paintKey,m);}shell.material=paintCache.get(paintKey)!;
  box(g, '#253137', 0, .7, 0, width + .04, .27, length - .25);
  if (mb || big || type === 'van') {
    roundedBox(g,mb?'#bf202c':color,0,bodyHeight+.68,0,width+.06,.31,length-.05,.14);
    for (const side of [-1, 1]) {
      for (let z = -length / 2 + .75; z < length / 2 - .4; z += 1.18) {
        box(g, '#173842', side * (width / 2 + .018), bodyHeight + .03, z, .04, .95, 1.02);
        box(g, '#57929b', side * (width / 2 + .045), bodyHeight + .43, z, .02, .065, .97);
      }
      box(g, mb ? '#b91e2c' : '#efe7d3', side * (width / 2 + .04), 1.15, 0, .06, .11, length - .15);
    }
    box(g, '#173842', 0, bodyHeight + .04, -length / 2 - .016, width - .22, .92, .045);
    box(g, '#3e7680', 0, bodyHeight + .40, -length / 2 - .045, width - .29, .11, .016);
    box(g, '#153039', 0, bodyHeight + .04, length / 2 + .02, width - .25, .95, .04);
  } else {
    roundedBox(g,type==='taxi'?'#e8e5d6':color,0,1.87,.12,1.75,.83,2.42,.2);
    box(g, '#174450', 0, 1.88, -1.10, 1.64, .6, .05);
    box(g, '#174450', 0, 1.88, 1.35, 1.64, .6, .05);
    for (const side of [-1, 1]) box(g, '#174450', side * .888, 1.89, .1, .024, .60, 2.16);
    if (type === 'taxi') { box(g, '#f0dfb2', 0, 2.4, 0, .72, .25, .34, true); const s = sign('TAXI', '', '#f1e7ce', '#b12232', .62, .21); s.position.set(0, 2.41, -.18); s.rotation.y = Math.PI; g.add(s); }
  }
  box(g, '#26343c', 0, .53, -length / 2 - .05, width + .12, .23, .21);
  box(g, '#26343c', 0, .56, length / 2 + .06, width + .12, .23, .21);
  box(g, '#434b4e', 0, 1.0, -length / 2 - .035, .8, .26, .04);
  for (const side of [-1, 1]) {
    box(g, '#fff2bc', side * (width / 2 - .28), 1.02, -length / 2 - .07, .37, .23, .07, true);
    brakes.push(box(g, '#eb3c29', side * (width / 2 - .24), 1.0, length / 2 + .06, .24, .43, .055, true));
    box(g, '#1a252a', side * (width / 2 + .16), 2.15, -length / 2 + .28, .29, .15, .13);
    box(g, '#4e6a70', side * (width / 2 + .28), 2.1, -length / 2 + .28, .12, .36, .22);
    for (const z of [-length * .31, length * .31]) {
      const wheel = new T.Group(); wheel.position.set(side * (width / 2), .53, z);
      const rubber = new T.Mesh(new T.CylinderGeometry(.52, .52, .25, 24), material('#152024')); rubber.rotation.z = Math.PI / 2; wheel.add(rubber);
      const hub = new T.Mesh(new T.CylinderGeometry(.28, .28, .27, 18), material('#b8babb')); hub.rotation.z = Math.PI / 2; wheel.add(hub);
      const rim=new T.Mesh(new T.TorusGeometry(.34,.035,6,20),material('#a3a9ac'));rim.rotation.y=Math.PI/2;rim.position.x=side*.15;wheel.add(rim);
      for(let k=0;k<6;k++){const bolt=new T.Mesh(new T.SphereGeometry(.038,6,4),material('#50585e'));bolt.position.set(side*.16,Math.sin(k*Math.PI/3)*.17,Math.cos(k*Math.PI/3)*.17);wheel.add(bolt);}
      g.add(wheel); wheels.push(wheel);
    }
  }
  let door: T.Group | undefined;
  if (mb) {
    door = new T.Group(); door.position.set(-1.13, 1.58, -2.1);
    box(door, '#ead7b0', 0, 0, 0, .1, 2.01, 1.06);
    box(door, '#18404b', -.07, .40, 0, .04, .93, .90);
    box(door, '#c6b58b', -.08, -.58, 0, .035, .59, .04);
    g.add(door);
    const route = sign('深水埗 ⇄ 旺角', 'RED VAN  ·  $12', '#fbebc0', '#b01e2b', 1.9, .48);
    route.position.set(0, 2.87, -3.235); route.rotation.y = Math.PI; g.add(route);
    const backRoute = sign('旺 角', 'MONG KOK', '#fae9bc', '#ab202d', 1.53, .5); backRoute.position.set(0, 2.02, 3.23); g.add(backRoute);
    const plate = sign('LV 1986', '', '#f3ce56', '#172c30', .68, .21); plate.position.set(0, .9, 3.255); g.add(plate);
    const backText = sign('公共小型巴士', 'PUBLIC LIGHT BUS · 16 SEATS', '#ecd9af', '#6c3b27', 1.71, .38); backText.position.set(0, 1.31, 3.245); g.add(backText);
    roundedBox(g,'#aead9f',0,3.12,.6,1.3,.25,1.8,.1);
    for(let z=-.1;z<1.3;z+=.18)box(g,'#626e70',0,3.255,z,1.04,.015,.045);
    for(const side of [-1,1]){for(let z=-1.2;z<2.5;z+=1.18){box(g,'#d8d9d0',side*1.135,2.06,z,.045,.025,1.02);box(g,'#c2c1b3',side*1.14,2.24,z-.5,.045,.87,.035);}box(g,'#c9c4ad',side*1.12,1.56,.6,.035,.024,4.6);box(g,'#b0a893',side*1.12,.86,.4,.035,.024,5.1);}
    for(let x=-.36;x<.4;x+=.12)box(g,'#1e3039',x,.99,-3.26,.045,.17,.05);
    for(const z of [-2,2]){const arch=new T.Mesh(new T.TorusGeometry(.63,.055,6,20,Math.PI),material('#726e60'));arch.rotation.y=Math.PI/2;arch.position.set(-1.13,.52,z);g.add(arch);const other=arch.clone();other.position.x=1.13;g.add(other);}
    box(g,'#c5beb0',-1.27,.65,-2.12,.30,.12,1.12);box(g,'#1b3039',-.96,1.5,-2.1,.22,.03,.16);
    for(const z of [2.6,2.8,3.0])box(g,'#6d6b61',.72,1.38,z,.36,.034,.032);
    const sticker=sign('請勿急煞','MIND THE STEP','#d9bd62','#2e4042',.57,.2);sticker.position.set(-.54,1.64,3.27);g.add(sticker);

    for (const x of [-.65, .65]) { const w = box(g, '#0d252f', x, 2.01, -3.255, .035, .54, .028); w.rotation.z = .27; }
  }
  g.traverse(o => { if (o instanceof T.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { group: g, wheels, door, brake: brakes };
}

export type PersonModel = { group: T.Group; arm: T.Group; legs: T.Group[]; seed: number };
export function makePerson(seed: number): PersonModel {
  const rng = random(seed), g = new T.Group();
  const shirt = ['#f2ac44', '#387d7b', '#e25e55', '#637daf', '#f1e6c8'][Math.floor(rng() * 5)];
  const skin = ['#d6a37f', '#c18b67', '#e0b99a'][Math.floor(rng() * 3)];
  roundedBox(g,shirt,0,1.13,0,.46,.64,.30,.12);
  const head = new T.Mesh(new T.SphereGeometry(.215, 16, 12), material(skin)); head.position.set(0, 1.66, 0); g.add(head);
  roundedBox(g,'#292825',0,1.81,.018,.38,.17,.34,.10);
  for(const x of [-.075,.075])box(g,'#302b2b',x,1.68,-.205,.035,.029,.01);
  if(rng()>.65){roundedBox(g,'#8b6246',.34,.88,.08,.21,.3,.2,.055);}
  const legs: T.Group[] = [];
  for (const s of [-1, 1]) { const leg = new T.Group(); leg.position.set(s * .13, .8, 0); roundedBox(leg,'#35424f',0,-.31,0,.18,.65,.20,.07); box(leg, '#1a272f', 0, -.64, -.05, .21, .12, .35); g.add(leg); legs.push(leg); }
  box(g, skin, .31, 1.08, 0, .14, .52, .16);
  const arm = new T.Group(); arm.position.set(-.29, 1.37, 0); roundedBox(arm,shirt,0,-.13,0,.16,.28,.2,.07);roundedBox(arm,skin,0,-.38,0,.13,.30,.15,.05); g.add(arm);
  return { group: g, arm, legs, seed };
}
export function animatePerson(p: PersonModel, time: number, wave: boolean, walk: boolean) {
  p.arm.rotation.z = wave ? -2.45 + Math.sin(time * 5 + p.seed) * .3 : Math.sin(time * 7 + p.seed) * (walk ? .3 : .05);
  p.legs.forEach((l, i) => l.rotation.x = Math.sin(time * 8 + i * Math.PI + p.seed) * (walk ? .45 : 0));
}

export type Obstacle = { x: number; z: number; hx: number; hz: number; heading: number; kind: 'object' | 'building'; group?: T.Object3D; knocked?: boolean };
export class City {
  group = new T.Group(); obstacles: Obstacle[] = []; lamps: T.Object3D[] = []; signalModels:{s:number;red:T.MeshStandardMaterial;amber:T.MeshStandardMaterial;green:T.MeshStandardMaterial}[]=[];
  batches = new Map<string, T.BufferGeometry[]>();
  constructor() { this.build(); }
  add(color: string, x: number, y: number, z: number, w: number, h: number, d: number, rotation = 0) {
    const geo = new T.BoxGeometry(w, h, d);if(color.startsWith('@')){const uv=geo.getAttribute('uv');for(let n=0;n<uv.count;n++)uv.setXY(n,uv.getX(n)*Math.max(w,d)/3,uv.getY(n)*Math.max(h,Math.min(w,d))/3);}
    geo.rotateY(rotation); geo.translate(x, y, z);
    if (!this.batches.has(color)) this.batches.set(color, []); this.batches.get(color)!.push(geo);
  }
  build() {
    const rng = random(8521986);
    this.add('#3e5556', 80, -.36, -370, 1150, .5, 1450);
    // The actual street surface is geometry, with kerbs and markings in world units.
    for (let i = 0; i < LENGTHS.length; i++) {
      const s = CUMULATIVE[i], len = LENGTHS[i], p = onRoute(s + len / 2), h = -p.heading;
      this.add('@pavers', p.x, -.015, p.z, 36, .2, len + 34, h);
    }
    for (let i = 0; i < LENGTHS.length; i++) {
      const s = CUMULATIVE[i], len = LENGTHS[i], p = onRoute(s + len / 2), h = -p.heading;
      this.add('@asphalt', p.x, .105, p.z, 23, .055, len + 23, h);
      for (let dist = s + 18; dist < s + len - 16; dist += 11) {
        for (const lat of [-5.6, 5.6]) { const a = onRoute(dist, lat); this.add('#d2d1b9', a.x, .14, a.z, .12, .025, 4, h); }
        const a = onRoute(dist); this.add('#efda83', a.x, .14, a.z, .14, .025, 7, h);
      }
      for (const side of [-1, 1]) {
        for (let d = s + 17; d < s + len - 17; d += 5) {
          const p = onRoute(d, side * 11.4); this.add('#e6bd4d', p.x, .15, p.z, .10, .025, 4.9, h);
          const p2 = onRoute(d, side * 10.95); this.add('#e6bd4d', p2.x, .15, p2.z, .10, .025, 4.9, h);
          const curb = onRoute(d, side * 11.9); this.add(d % 10 < 5 ? '#afb8aa' : '#73817b', curb.x, .23, curb.z, .45, .24, 4.95, h);
        }
      }
      for (const dist of [s + 19, s + len - 19]) {
        for (let lane = -9; lane <= 9; lane += 2) { const q = onRoute(dist, lane); this.add('#e6d693', q.x, .15, q.z, 1.05, .025, 3.6, h); }
      }
      for (let d = s + 28; d < s + len - 24; d += 25) {
        for (const side of [-1, 1]) {
          const p = onRoute(d, side * 13.1); const g = new T.Group(); g.position.set(p.x, .14, p.z); g.rotation.y = h;
          cylinder(g, '#525f5d', 0, 3.6, 0, .10, 7.2, 8);
          box(g, '#667773', -side * 1.1, 7.15, 0, 2.3, .12, .14);
          box(g, '#fff0b1', -side * 2.15, 7.08, 0, .74, .10, .40, true);
          this.group.add(g); this.lamps.push(g); this.obstacles.push({ x:p.x, z:p.z, hx:.18, hz:.18, heading:0, kind:'object', group:g });
        }
      }
      for (let d = s + 36; d < s + len - 28; d += 24) {
        const side = rng() > .5 ? 1 : -1, p = onRoute(d, side * 13.3);
        const bin = new T.Group(); bin.position.set(p.x, .14, p.z); bin.rotation.y = h;
        cylinder(bin, '#e78027', 0, .65, 0, .39, 1.3); cylinder(bin, '#ed913e', 0, 1.36, 0, .42, .13);
        box(bin, '#152b2e', 0, 1.1, -.377, .46, .28, .035); this.group.add(bin);
        this.obstacles.push({ x:p.x, z:p.z, hx:.43, hz:.43, heading:0, kind:'object', group:bin });
      }
      for (let d = s + 24; d < s + len - 22; d += 9) {
        // Leave generous pavement openings at all possible passenger positions.
        if ([100,285,475,675,880,1080,1170,1340,TOTAL_LENGTH-12,...CROSSINGS].some(v => Math.abs(d - v) < 30)) continue;
        for (const side of [-1, 1]) {
          const p = onRoute(d, side * 12); const rail = new T.Group(); rail.position.set(p.x, .14, p.z); rail.rotation.y = h;
          for (const z of [-3, 3]) box(rail, '#647a73', 0, .6, z, .075, 1.2, .09);
          for (const y of [.35, 1.08]) box(rail, '#a2aaa0', 0, y, 0, .07, .06, 6);
          this.group.add(rail); this.obstacles.push({ x:p.x, z:p.z, hx:.15, hz:3, heading:p.heading, kind:'object', group:rail });
        }
      }
      // Roadside buildings form varied continuous shopfronts on both sides.
      for (let d = s + 28; d < s + len - 24; d += 24) {
        for (const side of [-1, 1]) {
          const p = onRoute(d, side * 26), bh = 14 + Math.floor(rng() * 15) * 3.1, width = 16 + rng() * 6;
          const colors=['#d1c3a7','#9ab2b0','#c5b68e','#b69587','#a7b5b8','#ddccad','#a9bcac','#d4bfae','#c4c5bc','#b6a19e'];
          const col = colors[Math.floor(rng()*colors.length)];
          this.add((rng()>.45?'@plaster:':'@tile:')+col,p.x,bh/2,p.z,18,bh,width,h);
          this.obstacles.push({x:p.x,z:p.z,hx:9,hz:width/2,heading:p.heading,kind:'building'});
          const facade = onRoute(d, side * 16.91);
          this.add('#425655', facade.x, 2.15, facade.z, .12, 4.2, width - .35, h);
          for (let floor = 0; floor < Math.floor((bh-5)/3.2); floor++) {
            for (let q = -width/2+2; q < width/2-1; q += 3.25) {
              const v = onRoute(d+q, side * 16.83);
              this.add(rng() > .74 ? '#d9c88e' : '#435b5c', v.x, 6.4 + floor*3.2, v.z, .10, 1.55, 1.9, h);
              const sill = onRoute(d+q, side * 16.65); this.add('#c3c1a8', sill.x, 5.6+floor*3.2, sill.z, .38, .15, 2.15,h);
              if(rng()>.57){this.add('#b8b9ad',sill.x,5.15+floor*3.2,sill.z,.70,.58,1.0,h);for(let vent=0;vent<4;vent++)this.add('#747e78',sill.x-side*.36*Math.cos(p.heading),5.02+floor*3.2+vent*.08,sill.z-side*.36*Math.sin(p.heading),.03,.018,.8,h);}
              if(floor%3===1&&rng()>.6){const balcony=onRoute(d+q,side*16.0);this.add('#a49f8d',balcony.x,5.48+floor*3.2,balcony.z,1.8,.17,2.6,h);for(let post=-1;post<=1;post+=.5){const v=onRoute(d+q+post,side*15.2);this.add('#555e5a',v.x,5.99+floor*3.2,v.z,.045,1,.045,h);}this.add('#737d6e',balcony.x-side*.8*Math.cos(p.heading),6.45+floor*3.2,balcony.z-side*.8*Math.sin(p.heading),.05,.04,2.6,h);}

            }
          }
          this.add('#aaa895',p.x,bh+.3,p.z,18.2,.6,width+.2,h);
          for(const q of [-width/2+.25,width/2-.25]){const pipe=onRoute(d+q,side*16.65);this.add('#76796d',pipe.x,bh/2,pipe.z,.1,bh,.12,h);}
          for(let y=4.9;y<bh;y+=6.4){const ledge=onRoute(d,side*16.65);this.add('#c2baa3',ledge.x,y,ledge.z,.48,.14,width,h);}
          const roof = onRoute(d, side*27); this.add('#626a62',roof.x,bh+1.1,roof.z,3,1.5,2.4,h);
          const signs=[['金記茶餐廳','KAM KEE CAFE','#164c43','#f6dc88'],['旺角電器','ELECTRICAL CO.','#a92736','#f5e8ce'],['新發大藥房','SUN FAT MEDICINE','#eee1c5','#a4252e'],['裕華辦館','GROCERIES','#24585c','#f2d6a0'],['好運冰室','GOOD LUCK CAFE','#b64228','#ffe6b3'],['永興五金','WING HING HARDWARE','#dfbe61','#283f41'],['香港鮮果','FRESH FRUIT','#386b47','#e9e5cf'],['大眾車行','MOTOR SERVICE','#385976','#e7e0c7'],['美華理髮','MEI WAH BARBER','#d9ccb4','#4b3a34'],['陳記燒臘','CHAN KEE ROAST','#963326','#ffcc76'],['嘉樂餅家','KA LOK BAKERY','#c9b89b','#883a31'],['聯發布行','TEXTILES','#315a65','#ead9c0'],['南洋咖啡','NANYANG COFFEE','#243b3c','#d9c181'],['銀河唱片','GALAXY RECORDS','#2b3548','#e994bb'],['春雨花店','SPRING FLORIST','#8a9c82','#fff0db'],['信和押','PAWN SHOP','#853330','#ead081'],['明記麵家','MING KEE NOODLES','#e2d1a6','#54422d'],['晨光攝影','MORNING LIGHT PHOTO','#365572','#cee4e2'],['華昌鐘錶','WATCH REPAIRS','#293e3b','#d6b76b'],['海記海味','DRIED SEAFOOD','#82433a','#eee0b6'],['成記鎖匙','KEY CUTTING','#d8c9a4','#344c59'],['利達文具','STATIONERY','#325a4f','#e7d78c'],['樂聲琴行','MUSIC CENTRE','#504357','#dcd1c3'],['萬通找換','MONEY EXCHANGE','#756b38','#f2ecbe']];
          const shops=rng()>.45?2:3,shopWidth=(width-.4)/shops;
          for(let n=0;n<shops;n++){
            const offset=(n-(shops-1)/2)*shopWidth,data=signs[Math.floor(rng()*signs.length)],a=onRoute(d+offset,side*16.50);
            const style=rng()>.72?'neon':rng()>.65?'modern':'classic';
            const sg=sign(data[0],data[1],data[2],data[3],shopWidth-.15,1.35,style);sg.position.set(a.x,4.0+rng()*.3,a.z);sg.rotation.y=h+(side===1?Math.PI/2:-Math.PI/2);this.group.add(sg);
            const aw=onRoute(d+offset,side*15.6);this.add(data[2],aw.x,2.95,aw.z,2.1,.16,shopWidth-.1,h);
            for(let stripe=-shopWidth/2+.2;stripe<shopWidth/2;stripe+=.65){const q=onRoute(d+offset+stripe,side*15.55);this.add('#d5c7a6',q.x,2.965,q.z,2.15,.025,.2,h);}
            const f=onRoute(d+offset,side*16.68),shutter=rng()>.67;
            this.add(shutter?'#7d8077':'#234349',f.x,1.55,f.z,.1,2.7,shopWidth-.35,h);
            if(shutter){for(let y=.35;y<2.8;y+=.17)this.add('#a7a79a',f.x-side*.07*Math.cos(p.heading),y,f.z-side*.07*Math.sin(p.heading),.025,.03,shopWidth-.35,h);}
            else{for(let q=-shopWidth/2+.3;q<shopWidth/2;q+=1.4){const v=onRoute(d+offset+q,side*16.48);this.add('#b6b8a8',v.x,1.52,v.z,.07,2.8,.045,h);}
              const display=onRoute(d+offset,side*16.40);this.add('#dab979',display.x,.7,display.z,.3,.08,shopWidth-.5,h);
              for(let k=0;k<4;k++){const goods=onRoute(d+offset+(k-1.5)*.75,side*16.28);this.add(['#b96640','#a7b683','#d9b05e','#7e9695'][k],goods.x,1,goods.z,.38,.5,.55,h);}
            }
          }
          if(rng()>.25){const data=signs[Math.floor(rng()*signs.length)],psg=onRoute(d-width*.36,side*14.9);const hang=sign(data[0].slice(-4),'',data[2],data[3],1.25,5.1,'vertical');hang.position.set(psg.x,8.5+rng()*3,psg.z);hang.rotation.y=h;this.group.add(hang);this.add('#43514e',psg.x,hang.position.y+2.35,psg.z,4.5,.09,.1,h);}
        }
      }
      const q = onRoute(s + 24,-13.3), street = sign(STREETS[i],['PEI HO STREET','FUK WA STREET','CHEUNG SHA WAN ROAD','BOUNDARY STREET','YU CHAU STREET','LAI CHI KOK ROAD','MONG KOK ROAD'][i],'#e4e2ca','#273a3c',3.4,.95);
      street.position.set(q.x,2.75,q.z); street.rotation.y=h; this.group.add(street);
    }
    // Extend both ends so traffic drives away instead of being clamped at the terminus.
    for(const edge of [-100,TOTAL_LENGTH+100]){const p=trafficPoint(edge);this.add('@asphalt',p.x,.105,p.z,23,.055,210,-p.heading);for(const side of [-1,1]){const q=trafficPoint(edge,side*14.3);this.add('@pavers',q.x,.02,q.z,5,.2,210,-q.heading);}}
    for(const crossing of CROSSINGS){const h=-onRoute(crossing).heading;for(let lat=-10;lat<=10;lat+=2){const p=onRoute(crossing,lat);this.add('#efe1ba',p.x,.16,p.z,1.1,.02,4.4,h);}for(const dir of [-1,1]){const p=onRoute(crossing-dir*7,dir*5.7);this.add('#eadfc9',p.x,.17,p.z,10.5,.025,.35,h);this.signalPole(crossing,dir);} }
    for(const [color,geos] of this.batches) { const mesh = new T.Mesh(mergeGeometries(geos),material(color)); mesh.receiveShadow=true;mesh.castShadow=color.startsWith('@plaster')||color.startsWith('@tile'); this.group.add(mesh); geos.forEach(g=>g.dispose()); }
    this.batches.clear();
    // Tall skyline blocks beyond the playable streets give the district depth.
    for(let i=0;i<45;i++) { const x=-200+rng()*660,z=130-rng()*1050; if (this.distanceToRoad({x,z})<48) continue; const h=35+rng()*75; box(this.group,'#768c89',x,h/2,z,16+rng()*22,h,18+rng()*18); }
  }
  signalPole(s:number,side:number){
    const p=onRoute(s-side*6,side*12.7),g=new T.Group();g.position.set(p.x,.15,p.z);g.rotation.y=-p.heading+(side===1?0:Math.PI);
    cylinder(g,'#424b48',0,2.45,0,.095,4.9,12);roundedBox(g,'#171f21',0,4.35,0,.5,1.4,.33,.10);
    const lenses:T.MeshStandardMaterial[]=[];for(const [i,col]of ['#ff513d','#ffcf54','#69df98'].entries()){const mat=new T.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:.02,roughness:.3});const lens=new T.Mesh(new T.SphereGeometry(.145,14,10),mat);lens.scale.z=.35;lens.position.set(0,4.78-i*.43,.19);g.add(lens);lenses.push(mat);box(g,'#26312f',0,4.95-i*.43,.2,.39,.04,.42);}
    this.group.add(g);this.signalModels.push({s,red:lenses[0],amber:lenses[1],green:lenses[2]});this.obstacles.push({x:p.x,z:p.z,hx:.18,hz:.18,heading:0,kind:'object',group:g});
  }
  updateSignals(signals:Signal[]){for(const model of this.signalModels){const light=signals.find(l=>l.s===model.s);for(const [name,mat]of [['red',model.red],['amber',model.amber],['green',model.green]] as const){const active=light?.phase===name||name==='green'&&light?.phase==='idle';mat.emissiveIntensity=active?2.4:.015;mat.color.setScalar(active?1:.13);}}}
  distanceToRoad(p: V2) {
    let d=Infinity;
    for(let i=0;i<LENGTHS.length;i++){ const a=ROUTE[i],b=ROUTE[i+1], dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(LENGTHS[i]**2))); d=Math.min(d,Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t)); }
    return d;
  }
  reset() { for(const o of this.obstacles) if(o.group) {o.knocked=false; o.group.rotation.x=0; o.group.rotation.z=0;} }
}
export function makeStop(stop: Stop) {
  const g=new T.Group();g.position.set(stop.x,.20,stop.z);g.rotation.y=-stop.heading;
  const fill=new T.Mesh(new T.PlaneGeometry(STOP_HALF_WIDTH*2,STOP_HALF_LENGTH*2),new T.MeshBasicMaterial({color:'#7ef0a1',transparent:true,opacity:.20,depthWrite:false,side:T.DoubleSide}));fill.rotation.x=-Math.PI/2;g.add(fill);
  const mat=new T.MeshBasicMaterial({color:'#84ffb4',transparent:true,opacity:.9});
  for(const x of [-STOP_HALF_WIDTH,STOP_HALF_WIDTH]){const line=new T.Mesh(new T.BoxGeometry(.13,.045,STOP_HALF_LENGTH*2),mat);line.position.x=x;g.add(line);}
  for(const z of [-STOP_HALF_LENGTH,STOP_HALF_LENGTH]){const line=new T.Mesh(new T.BoxGeometry(STOP_HALF_WIDTH*2,.045,.13),mat);line.position.z=z;g.add(line);}
  const label=sign(stop.terminal?'尾 站':'上 落 客',stop.terminal?'TERMINUS':'DOOR IN ZONE','#155a47','#e3ffbc',3.6,1.2);label.rotation.x=-Math.PI/2;label.position.set(0,.04,0);g.add(label);
  return {group:g,fill,mat,label};
}
