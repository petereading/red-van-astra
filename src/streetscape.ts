import * as T from 'three';
import { SIDE_ROADS, ROADS, projectRoad, nearestRoad, nearSideRoad } from './roads';
import { onRoute, random, CUMULATIVE, type V2 } from './core';
import { box, cylinder, sign, material, type City } from './visuals';

const ROAD_NAMES=['海棠街','景業道','學園街','霓虹街'];
export const EXTRA_TEXT='海棠街景業道學園街霓虹街榕樹公園社區休憩花園德明書院求知力行景業中心星港商廈公共電話報紙雜誌今日早報紅Van茶餐廳奶茶菠蘿油九龍麵食龍鳳酒樓金龍押明記電器寶聲唱片霓虹香港紅Van快速到站公共小型巴士16座位小巴站深水埗旺角總站';
function at(city:City,point:V2,heading:number,build:(g:T.Group)=>void,hx:number,hz:number){
  const g=new T.Group();g.position.set(point.x,.16,point.z);g.rotation.y=-heading;build(g);city.group.add(g);
  city.obstacles.push({x:point.x,z:point.z,hx,hz,heading,kind:'object',group:g});return g;
}
function mountedSign(g:T.Object3D,text:string,sub:string,bg:string,fg:string,w:number,h:number,x:number,y:number,z:number,style='classic'){
  const s=sign(text,sub,bg,fg,w,h,style);s.position.set(x,y,z);g.add(s);return s;
}

export function streetProp(city:City,p:V2,heading:number,type:number){
  return at(city,p,heading,g=>{
    if(type===0){ // Open-sided public telephone kiosk, handset, keypad and hood.
      box(g,'#426b65',0,1.2,0,1.05,2.4,.75);box(g,'#263a3e',0,1.25,.4,.81,1.67,.08);
      box(g,'#c4d0c8',0,1.25,.46,.48,.62,.17);box(g,'#171f24',-.16,1.36,.59,.09,.4,.08);
      for(let y=0;y<3;y++)for(let x=0;x<3;x++)box(g,'#303d40',.02+x*.08,1.18+y*.09,.56,.04,.045,.025);
      box(g,'#90b6ae',0,2.46,.16,1.24,.18,1.12);mountedSign(g,'公共電話','TELEPHONE','#e8dbbd','#315e59',.94,.31,0,2.13,.42,'modern');
    }else if(type===1){ // Corrugated cardboard with tape, not solid street furniture.
      for(let i=0;i<3;i++){box(g,'@cardboard:#b99463',(i%2)*.35-.2,.23+i*.26,(i%2)*.13,.75,.46,.62);box(g,'#d7c18c',(i%2)*.35-.2,.47+i*.26,(i%2)*.13,.11,.02,.63);}
      box(g,'@cardboard:#ae8a5b',-.22,.14,-.48,.88,.14,.5).rotation.z=.12;
    }else if(type===2){ // Folding table and plastic chairs.
      box(g,'#a0a79c',0,.86,0,1.25,.09,.88);
      for(const s of [-1,1]){const leg=box(g,'#4f5959',s*.43,.43,0,.055,.86,.72);leg.rotation.z=s*.24;}
      for(const side of [-1,1]){const z=side*.93;box(g,side>0?'#568355':'#ce6044',0,.44,z,.54,.09,.5);box(g,side>0?'#568355':'#ce6044',0,.73,z+side*.22,.53,.54,.07);for(const x of [-.2,.2])for(const dz of [-.18,.18])box(g,'#52734e',x,.22,z+dz,.06,.42,.06);}
      cylinder(g,'#f4e8cf',-.3,.98,0,.10,.17,12);cylinder(g,'#e1d6ba',.25,.95,0,.18,.08,16);
    }else if(type===3){ // Pavement newsstand: canopy, magazines, stacks and stool.
      box(g,'#60716b',0,.69,0,2.3,1.38,1.1);box(g,'#213d39',0,1.55,-.48,2.4,1.15,.10);
      for(const x of [-1.2,1.2])cylinder(g,'#707c75',x,1.27,-.43,.045,2.54);
      box(g,'#264d43',0,2.6,.12,2.9,.14,1.95).rotation.x=.12;
      for(let i=0;i<18;i++){const x=(i%6-2.5)*.38,y=1.1+Math.floor(i/6)*.4;const cover=sign(['香港日報','街坊週刊','美食指南','汽車世界','今日早報','城中生活'][i%6],String(12+i),['#c64435','#275367','#e4c063'][i%3],'#f4efdb',.33,.38,'magazine');cover.position.set(x,y,.59);g.add(cover);}
      for(let i=0;i<5;i++){box(g,'#e1d9bb',-.9+i*.45,.22,.86,.39,.43,.57);for(let n=0;n<5;n++)box(g,'#9faaa0',-.9+i*.45,.05+n*.08,1.15,.38,.011,.02);}
      mountedSign(g,'報紙 · 雜誌','DAILY NEWS','#f1dd96','#34594c',2.15,.33,0,2.25,.6);
      cylinder(g,'#689653',1.6,.43,.4,.3,.16);for(const x of [1.4,1.8])box(g,'#527c42',x,.22,.4,.07,.44,.07);
    }else{ // Bilingual street fingerpost, restrained HK palette.
      cylinder(g,'#65736d',0,1.75,0,.06,3.5,10);
      mountedSign(g,ROAD_NAMES[type%4],'KOWLOON','#ede8d6','#283f3e',1.9,.54,0,3.15,.06,'modern');
      mountedSign(g,'慢駛','SLOW','#eee6cb','#a52631',.7,.5,0,2.52,.06);
    }
  },type===3?1.35:type===2?.8:type===0?.57:.55,type===3?.9:type===2?1.25:.6);
}

function tree(city:City,x:number,z:number,size=1){
  cylinder(city.group,'#655c43',x,2*size,z,.24*size,4*size,9);
  const geometry=new T.IcosahedronGeometry(2.15*size,1);
  for(let i=0;i<3;i++){const m=new T.Mesh(geometry,material(['#3d6852','#567753','#396552'][i]));m.position.set(x+Math.sin(i*2)*size,4.4*size+i*.6,z+Math.cos(i*2)*size);m.scale.y=.85;m.castShadow=true;city.group.add(m);}
}

function park(city:City){
  const x=-63,z=-210;city.add('@grass:#698755',x,.06,z,62,.12,78);
  city.add('@concrete:#d0c1a3',x,.16,z,6,.12,78);city.add('@concrete:#d0c1a3',x,.16,z,62,.12,5);
  for(let i=0;i<12;i++){const xx=x+(i%2?24:-24),zz=z-32+Math.floor(i/2)*12;tree(city,xx,zz,.85+(i%3)*.18);}
  for(const dx of [-14,14])for(const dz of [-24,24]){city.add('#947957',x+dx,.76,z+dz,3,.16,.58);city.add('#947957',x+dx,1.15,z+dz+.3,3,.6,.1);for(const n of [-1,1])city.add('#43554c',x+dx+n,.43,z+dz,.13,.7,.46);}
  const pavilion=new T.Group();pavilion.position.set(x,.17,z);for(const dx of [-3,3])for(const dz of [-3,3])cylinder(pavilion,'#ad5944',dx,1.8,dz,.18,3.6);const roof=new T.Mesh(new T.ConeGeometry(5.6,1.7,4),material('#46766b'));roof.position.y=4.3;roof.rotation.y=Math.PI/4;pavilion.add(roof);city.group.add(pavilion);
  const board=sign('榕樹公園','BANYAN GARDEN','#325949','#f4e5b8',4.8,1.0);board.position.set(-30,2.35,z+4);board.rotation.y=Math.PI/2;city.group.add(board);
}
function school(city:City){
  const x=-77,z=-557;city.add('@concrete:#dec7a7',x,7,z,50,14,27);city.obstacles.push({x,z,hx:25,hz:13.5,heading:0,kind:'building'});
  for(let floor=0;floor<3;floor++)for(let i=0;i<12;i++){city.add(['#cf6c56','#e0bc5b','#78a9a2'][floor],x-23+i*4,3+floor*4,z+13.56,3.8,.45,.18);city.add(i%3?'#405759':'#d9c88e',x-23+i*4,4.2+floor*4,z+13.6,2.6,2,.15);}
  city.add('@redbrick:#bb6655',x,.16,z+32,52,.12,35);city.add('#557c67',x,.24,z+33,33,.04,22);
  for(const dx of [-16,16]){city.add('#e0dec5',x+dx,.28,z+33,.08,.02,22);city.add('#778b81',x+dx,2.2,z+33,.08,4,.09);city.add('#e4e1ca',x+dx,4.0,z+33,1.8,1.05,.12);}
  city.add('#e0dec5',x,.28,z+33,.1,.02,22);
  const s=sign('德明書院','TAK MING COLLEGE · 求知力行','#efe0bc','#a13835',14,1.6);s.position.set(x,13.15,z+13.7);city.group.add(s);
  for(const dx of [-25,25])tree(city,x+dx,z+44,.85);
}
function offices(city:City){
  for(let i=0;i<2;i++){const x=262+i*29,z=-390-i*15,h=69+i*27,w=24;city.add('@glass:#5c8e95',x,h/2,z,w,h,30);city.obstacles.push({x,z,hx:w/2,hz:15,heading:0,kind:'building'});
    for(let y=4;y<h;y+=3.7){city.add('#95aeb0',x,y,z+15.05,w,.18,.12);for(let n=0;n<5;n++){city.add((n+i+Math.floor(y))%4===0?'#d9c88e':'#26434d',x-10+n*5,y+1.5,z+15.1,4.7,2.5,.09);}}
    for(let n=-10;n<=10;n+=5){city.add('#a4b8b5',x+n,h/2,z+15.2,.15,h,.14);}
    city.add('@stone:#b3bbb3',x,2,z+20,26,4,10);const s=sign(i?'星港商廈':'景業中心',i?'STAR HARBOUR':'KING YIP CENTRE','#143a49','#e6d5ad',11,1.4,'modern');s.position.set(x,5.2,z+25.1);city.group.add(s);
  }
}
function footbridge(city:City,s:number){
  const p=onRoute(s),h=-p.heading;
  const g=new T.Group();g.position.set(p.x,0,p.z);g.rotation.y=h;
  box(g,'@concrete:#d8c29e',0,6.0,0,35,.65,3.8);box(g,'#629590',0,8.8,0,36,.18,4.4);
  for(const x of [-16,16]){box(g,'#b8b9a9',x,3,0,.7,6,.75);city.obstacles.push({x:p.x+Math.cos(p.heading)*x,z:p.z+Math.sin(p.heading)*x,hx:.45,hz:.45,heading:0,kind:'object'});}
  for(let x=-17;x<=17;x+=1.3)for(const z of [-1.85,1.85]){box(g,'#547a74',x,7.5,z,.07,2.6,.07);box(g,'#a1b6a9',x,6.9,z,.75,.9,.04);}
  for(const z of [-1.85,1.85])box(g,'#63837b',0,7.4,z,35,.07,.07);
  for(const side of [-1,1])for(let i=0;i<22;i++){box(g,'@concrete:#c8bc9f',side*16,3-i*.13,3+i*.52,2,6-i*.26,.53);}
  city.group.add(g);
}

/** Additional streets are genuinely drivable and connect through open junction mouths. */
export function addDistricts(city:City){
  const rng=random(8522026);
  for(const r of SIDE_ROADS){const dx=r.b.x-r.a.x,dz=r.b.z-r.a.z,len=Math.hypot(dx,dz),heading=Math.atan2(dx,-dz),h=-heading,c=Math.cos(heading),s=Math.sin(heading),x=(r.a.x+r.b.x)/2,z=(r.a.z+r.b.z)/2;
    city.add('@concrete:#b8b5a2',x,.01,z,29,.2,len+28,h);city.add('@asphalt',x,.106,z,18,.056,len+18,h);
    for(let d=19;d<len-12;d+=14){const px=r.a.x+dx*d/len,pz=r.a.z+dz*d/len;if(ROADS.some(other=>other!==r&&projectRoad({x:px,z:pz},other).distance<13))continue;city.add('#ddd7b9',px,.15,pz,.14,.02,5,h);}
    for(let d=24;d<len-22;d+=30){const px=r.a.x+dx*d/len,pz=r.a.z+dz*d/len;
      for(const side of [-1,1]){const bx=px+c*side*27,bz=pz+s*side*27;
        if(ROADS.some(other=>other!==r&&projectRoad({x:bx,z:bz},other).distance<27))continue;
        // Reserve landmark plots and their pedestrian approaches.
        if(Math.hypot(bx+63,(bz+210)*.8)<58||Math.hypot(bx+77,(bz+557)*1.1)<58||Math.hypot(bx-275,bz+400)<57)continue;
        const bh=12+Math.floor(rng()*18)*3.2,bw=18+rng()*6,color=['#b9b6a1','#c88d76','#91aaa2','#cac3ad','#88999e'][Math.floor(rng()*5)];
        city.add(['@plaster:','@tile:','@stone:'][Math.floor(rng()*3)]+color,bx,bh/2,bz,18,bh,bw,h);city.obstacles.push({x:bx,z:bz,hx:9,hz:bw/2,heading,kind:'building'});
        for(let floor=6;floor<bh-1;floor+=3.6)for(let q=-bw/2+2;q<bw/2;q+=3.4){const wx=bx-c*side*9.1+Math.sin(heading)*q,wz=bz-s*side*9.1-Math.cos(heading)*q;city.add(rng()<.3?'#d9c88e':'#365660',wx,floor,wz,.11,1.65,2,h);city.add('#b4b4a6',wx-c*side*.2,floor-1,wz-s*side*.2,.5,.16,2.1,h);}
        city.add('#8b978b',bx,bh+.4,bz,18.3,.8,bw+.4,h);
        const names=['恆興士多','港灣洗衣','榕樹茶室','海棠花店','德記粥品','星光旅館','九龍麵食','寶聲唱片'];const label=sign(names[Math.floor(rng()*names.length)],'HONG KONG',color,'#f8e9bd',bw-.5,1.55,rng()>.5?'neon':'classic');label.position.set(bx-c*side*9.4,4,bz-s*side*9.4);label.rotation.y=h+(side<0?Math.PI/2:-Math.PI/2);city.group.add(label);
      }
    }
    for(let d=22;d<len-18;d+=38){const p={x:r.a.x+dx*d/len+c*11.5,z:r.a.z+dz*d/len+s*11.5};if(ROADS.some(other=>other!==r&&projectRoad(p,other).distance<12))continue;
      const g=at(city,p,heading,g=>{cylinder(g,'#61716b',0,3.5,0,.08,7);box(g,'#71837d',-1,7,0,2.2,.13,.13);box(g,'#fff0b1',-1.95,6.91,0,.64,.09,.38,true);},.18,.18);city.lamps.push(g);
    }
  }
  park(city);school(city);offices(city);footbridge(city,170);footbridge(city,970);
  // Props use separate collision bodies so every object can be knocked away.
  for(let s=42,i=0;s<1390;s+=18,i++){const side=i%3===0?-1:1,p=onRoute(s,side*(i%5===3?14.9:14.25));if(nearSideRoad(p,16)||CUMULATIVE.some(c=>Math.abs(s-c)<26))continue;streetProp(city,p,onRoute(s).heading+(side===1?Math.PI/2:-Math.PI/2),i%5);}
  // Oversized steel-supported signs reach over the carriageway with safe headroom.
  const signs=[['龍鳳酒樓','DRAGON & PHOENIX','#361d32','#ff7d73','neon-noodles'],['金龍押','GOLDEN DRAGON PAWN','#202331','#ffd55d','pawn'],['紅Van茶餐廳','MILK TEA · PINEAPPLE BUN','#183f36','#70ffcd','neon-tea'],['明記電器','MING KEE ELECTRICAL','#243657','#81cfff','neon'],['寶聲唱片','PO SHING RECORDS','#362741','#ff9dde','neon-record']];
  for(let s=72,i=0;s<1370;s+=74,i++){const p=onRoute(s,4.4),h=onRoute(s).heading;if(nearSideRoad(p,22))continue;const d=signs[i%signs.length],height=7.2+(i%3)*1.05,g=new T.Group();g.position.set(p.x,0,p.z);g.rotation.y=-h;
    for(const z of [-.17,.17]){box(g,'#434f4b',-3.8,height+1.5,z,15,.13,.10);box(g,'#434f4b',-7.5,height+2.1,z,.1,1.5,.1);}
    mountedSign(g,d[0],d[1],d[2],d[3],i%5===1?4.3:8.4,i%5===1?4.0:2.25,0,height,0,d[4]);city.group.add(g);
  }
}
