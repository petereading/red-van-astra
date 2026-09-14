import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CUMULATIVE, LENGTHS, ROUTE, STREETS, TOTAL_LENGTH, onRoute, random, type Stop, type V2 } from './core';

const materials = new Map<string, T.MeshStandardMaterial>();
export function material(color: string, glow = false) {
  const key = color + glow;
  if (!materials.has(key)) materials.set(key, new T.MeshStandardMaterial({ color, roughness: .78, metalness: .12, ...(glow ? { emissive: color, emissiveIntensity: .65 } : {}) }));
  return materials.get(key)!;
}
const cube = new T.BoxGeometry(1, 1, 1);
export function disposeModel(root:T.Object3D){const seen=new Set<T.BufferGeometry>();root.traverse(o=>{if(o instanceof T.Mesh&&o.geometry!==cube&&!seen.has(o.geometry)){seen.add(o.geometry);o.geometry.dispose();}});}
export function box(parent: T.Object3D, color: string, x: number, y: number, z: number, w: number, h: number, d: number, glow = false) {
  const m = new T.Mesh(cube, material(color, glow)); m.position.set(x, y, z); m.scale.set(w, h, d); parent.add(m); return m;
}
export function cylinder(parent: T.Object3D, color: string, x: number, y: number, z: number, r: number, h: number, sides = 10) {
  const m = new T.Mesh(new T.CylinderGeometry(r, r, h, sides), material(color)); m.position.set(x, y, z); parent.add(m); return m;
}
const textCache = new Map<string, T.MeshBasicMaterial>();
export function sign(text: string, sub: string, bg: string, fg: string, w: number, h: number) {
  const key = [text, sub, bg, fg].join('|');
  if (!textCache.has(key)) {
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 256;
    const c = canvas.getContext('2d')!; c.fillStyle = bg; c.fillRect(0, 0, 768, 256);
    c.strokeStyle = fg; c.lineWidth = 7; c.strokeRect(12, 12, 744, 232);
    c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `900 ${text.length > 7 ? 73 : 94}px "Noto Sans TC", "Noto Sans CJK TC", sans-serif`;
    c.fillText(text, 384, sub ? 106 : 132, 710);
    if (sub) { c.font = '600 28px sans-serif'; c.fillText(sub, 384, 205, 700); }
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
  box(g, mb ? '#eed9ac' : color, 0, bodyHeight / 2 + .6, 0, width, bodyHeight, length);
  box(g, '#253137', 0, .7, 0, width + .04, .27, length - .25);
  if (mb || big || type === 'van') {
    box(g, mb ? '#b91e2c' : color, 0, bodyHeight + .68, 0, width + .06, .28, length - .05);
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
    box(g, type === 'taxi' ? '#e8e5d6' : color, 0, 1.87, .12, 1.75, .83, 2.42);
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
      const rubber = new T.Mesh(new T.CylinderGeometry(.52, .52, .25, 14), material('#152024')); rubber.rotation.z = Math.PI / 2; wheel.add(rubber);
      const hub = new T.Mesh(new T.CylinderGeometry(.28, .28, .27, 10), material('#b8babb')); hub.rotation.z = Math.PI / 2; wheel.add(hub);
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
    box(g, '#d3d1bd', 0, 3.00, .2, 1.32, .08, 1.1);
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
  box(g, shirt, 0, 1.13, 0, .48, .62, .30);
  const head = new T.Mesh(new T.SphereGeometry(.215, 8, 6), material(skin)); head.position.set(0, 1.66, 0); g.add(head);
  box(g, '#292825', 0, 1.8, .015, .38, .15, .33);
  const legs: T.Group[] = [];
  for (const s of [-1, 1]) { const leg = new T.Group(); leg.position.set(s * .13, .8, 0); box(leg, '#35424f', 0, -.31, 0, .19, .65, .21); box(leg, '#1a272f', 0, -.64, -.05, .21, .12, .35); g.add(leg); legs.push(leg); }
  box(g, skin, .31, 1.08, 0, .14, .52, .16);
  const arm = new T.Group(); arm.position.set(-.29, 1.37, 0); box(arm, shirt, 0, -.13, 0, .16, .28, .2); box(arm, skin, 0, -.38, 0, .13, .30, .15); g.add(arm);
  return { group: g, arm, legs, seed };
}
export function animatePerson(p: PersonModel, time: number, wave: boolean, walk: boolean) {
  p.arm.rotation.z = wave ? -2.45 + Math.sin(time * 5 + p.seed) * .3 : Math.sin(time * 7 + p.seed) * (walk ? .3 : .05);
  p.legs.forEach((l, i) => l.rotation.x = Math.sin(time * 8 + i * Math.PI + p.seed) * (walk ? .45 : 0));
}

export type Obstacle = { x: number; z: number; hx: number; hz: number; heading: number; kind: 'object' | 'building'; group?: T.Object3D; knocked?: boolean };
export class City {
  group = new T.Group(); obstacles: Obstacle[] = []; lamps: T.Object3D[] = [];
  batches = new Map<string, T.BufferGeometry[]>();
  constructor() { this.build(); }
  add(color: string, x: number, y: number, z: number, w: number, h: number, d: number, rotation = 0) {
    const geo = new T.BoxGeometry(w, h, d); geo.rotateY(rotation); geo.translate(x, y, z);
    if (!this.batches.has(color)) this.batches.set(color, []); this.batches.get(color)!.push(geo);
  }
  build() {
    const rng = random(8521986);
    this.add('#3e5556', 80, -.36, -370, 1150, .5, 1450);
    // The actual street surface is geometry, with kerbs and markings in world units.
    for (let i = 0; i < LENGTHS.length; i++) {
      const s = CUMULATIVE[i], len = LENGTHS[i], p = onRoute(s + len / 2), h = -p.heading;
      this.add('#85908a', p.x, -.015, p.z, 36, .2, len + 34, h);
    }
    for (let i = 0; i < LENGTHS.length; i++) {
      const s = CUMULATIVE[i], len = LENGTHS[i], p = onRoute(s + len / 2), h = -p.heading;
      this.add('#3a474b', p.x, .105, p.z, 23, .055, len + 23, h);
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
        if ([100,285,475,675,880,1080,1170,1340,TOTAL_LENGTH-12].some(v => Math.abs(d - v) < 30)) continue;
        for (const side of [-1, 1]) {
          const p = onRoute(d, side * 12); const rail = new T.Group(); rail.position.set(p.x, .14, p.z); rail.rotation.y = h;
          for (const z of [-3, 3]) box(rail, '#647a73', 0, .6, z, .075, 1.2, .09);
          for (const y of [.35, 1.08]) box(rail, '#a2aaa0', 0, y, 0, .07, .06, 6);
          this.group.add(rail); this.obstacles.push({ x:p.x, z:p.z, hx:.15, hz:3, heading:p.heading, kind:'object', group:rail });
        }
      }
      // Roadside buildings form varied continuous shopfronts on both sides.
      for (let d = s + 28; d < s + len - 24; d += 23) {
        for (const side of [-1, 1]) {
          const p = onRoute(d, side * 26), bh = 17 + Math.floor(rng() * 9) * 3.1, width = 17 + rng() * 4;
          const colors = ['#8e9c91','#afa98c','#829894','#a78f7e','#82909e','#bdaf91'];
          const col = colors[Math.floor(rng()*colors.length)];
          this.add(col, p.x, bh/2, p.z, 18, bh, width, h);
          this.obstacles.push({x:p.x,z:p.z,hx:9,hz:width/2,heading:p.heading,kind:'building'});
          const facade = onRoute(d, side * 16.91);
          this.add('#425655', facade.x, 2.15, facade.z, .12, 4.2, width - .35, h);
          for (let floor = 0; floor < Math.floor((bh-5)/3.2); floor++) {
            for (let q = -width/2+2; q < width/2-1; q += 3.25) {
              const v = onRoute(d+q, side * 16.83);
              this.add(rng() > .74 ? '#d9c88e' : '#435b5c', v.x, 6.4 + floor*3.2, v.z, .10, 1.55, 1.9, h);
              const sill = onRoute(d+q, side * 16.65); this.add('#c3c1a8', sill.x, 5.6+floor*3.2, sill.z, .38, .15, 2.15,h);
              if (rng()>.57) this.add('#a5aaa0', sill.x, 5.12+floor*3.2, sill.z, .65,.52,.84,h);
            }
          }
          this.add('#455c58',p.x,bh+.3,p.z,18.2,.6,width+.2,h);
          const roof = onRoute(d, side*27); this.add('#626a62',roof.x,bh+1.1,roof.z,3,1.5,2.4,h);
          const signs = [ ['金記茶餐廳','KAM KEE CAFE','#144e44','#f6d475'], ['旺角電器','ELECTRICAL CO.','#b22532','#faeac1'], ['新發大藥房','SUN FAT MEDICINE','#eee0b3','#a3272c'], ['裕華辦館','GROCERIES','#22575d','#f2d6a0'], ['好運冰室','GOOD LUCK CAFE','#c13e28','#f9e3ad'], ['永興五金','WING HING HARDWARE','#e3bd52','#263f41'], ['香港鮮果','FRESH FRUIT','#2c6746','#efe8c4'], ['大眾車行','MOTOR SERVICE','#375b70','#e7e0c7'] ];
          const data = signs[Math.floor(rng()*signs.length)], a = onRoute(d, side*16.53);
          const sg = sign(data[0],data[1],data[2],data[3],width-.7,2.15); sg.position.set(a.x,4.28,a.z); sg.rotation.y = h + (side===1 ? Math.PI/2 : -Math.PI/2); this.group.add(sg);
          const aw = onRoute(d,side*15.98); this.add(data[2],aw.x,2.96,aw.z,1.25,.17,width-.4,h);
          for(let q=-width/2+1;q<width/2-1;q+=3) {const f=onRoute(d+q,side*16.72); this.add('#1c373c',f.x,1.53,f.z,.09,2.75,2.6,h);}
          if (rng()>.55) {
            const psg = onRoute(d-7,side*14.8); const hang=sign(['當','茶','藥','飯'][Math.floor(rng()*4)],'',data[2],data[3],2.0,3.3); hang.position.set(psg.x,8.2,psg.z); hang.rotation.y=h; this.group.add(hang);
            this.add('#3d514f',psg.x,9.7,psg.z,3.8,.12,.10,h);
          }
        }
      }
      const q = onRoute(s + 24,-13.3), street = sign(STREETS[i],['PEI HO STREET','FUK WA STREET','CHEUNG SHA WAN ROAD','BOUNDARY STREET','YU CHAU STREET','LAI CHI KOK ROAD','MONG KOK ROAD'][i],'#e4e2ca','#273a3c',3.4,.95);
      street.position.set(q.x,2.75,q.z); street.rotation.y=h; this.group.add(street);
    }
    for(const [color,geos] of this.batches) { const mesh = new T.Mesh(mergeGeometries(geos),material(color)); mesh.receiveShadow=true; this.group.add(mesh); geos.forEach(g=>g.dispose()); }
    this.batches.clear();
    // Tall skyline blocks beyond the playable streets give the district depth.
    for(let i=0;i<45;i++) { const x=-200+rng()*660,z=130-rng()*1050; if (this.distanceToRoad({x,z})<48) continue; const h=35+rng()*75; box(this.group,'#768c89',x,h/2,z,16+rng()*22,h,18+rng()*18); }
  }
  distanceToRoad(p: V2) {
    let d=Infinity;
    for(let i=0;i<LENGTHS.length;i++){ const a=ROUTE[i],b=ROUTE[i+1], dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(LENGTHS[i]**2))); d=Math.min(d,Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t)); }
    return d;
  }
  reset() { for(const o of this.obstacles) if(o.group) {o.knocked=false; o.group.rotation.x=0; o.group.rotation.z=0;} }
}
export function makeStop(stop: Stop) {
  const g=new T.Group();g.position.set(stop.x,.20,stop.z);g.rotation.y=-stop.heading;
  const fill=new T.Mesh(new T.PlaneGeometry(5.2,12),new T.MeshBasicMaterial({color:'#7ef0a1',transparent:true,opacity:.20,depthWrite:false,side:T.DoubleSide}));fill.rotation.x=-Math.PI/2;g.add(fill);
  const mat=new T.MeshBasicMaterial({color:'#84ffb4',transparent:true,opacity:.9});
  for(const x of [-2.6,2.6]){const line=new T.Mesh(new T.BoxGeometry(.13,.045,12),mat);line.position.x=x;g.add(line);}
  for(const z of [-6,6]){const line=new T.Mesh(new T.BoxGeometry(5.2,.045,.13),mat);line.position.z=z;g.add(line);}
  const label=sign(stop.terminal?'尾 站':'上 落 客',stop.terminal?'TERMINUS':'STOP HERE','#155a47','#e3ffbc',3.6,1.2);label.rotation.x=-Math.PI/2;label.position.set(0,.04,0);g.add(label);
  return {group:g,fill,mat,label};
}
