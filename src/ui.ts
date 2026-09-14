import { scoreRun, type Stats } from './core';
export class UI {
  root:HTMLElement; onStart=()=>{};onResume=()=>{};onMenu=()=>{};onPause=()=>{};onDoor=()=>{};onReset=()=>{};
  onSettings=(values:{music:number;sfx:number;voice:number;quality:string})=>{};
  mode='menu'; settings={music:.42,sfx:.72,voice:.8,quality:'high'};
  constructor(){
    try{this.settings={...this.settings,...JSON.parse(localStorage.getItem('redvan-settings')||'{}')};}catch{}
    this.root=document.querySelector('#app')!;
    this.root.innerHTML=`
      <div id="viewport" aria-label="紅Van 3D 遊戲場景"></div><div class="vignette"></div>
      <div id="menu" class="screen menu">
        <div class="menu-top"><span class="stamp">香港街頭駕駛挑戰</span><span class="edition">VOL. 01 · 九龍</span></div>
        <div class="menu-content"><div class="route-tag"><span>深水埗</span><i>↔</i><span>旺角</span></div>
        <h1>紅<span>Van</span><b>RED VAN</b></h1><p class="english-title">FAST AND FURIOUS</p>
        <div class="menu-rule"></div><p class="pitch">三分鐘，一條街。<br>接得多，揸得穩，先係好車手。</p>
        <button id="start" class="primary" disabled><span id="start-text">正在準備街道…</span><span>↗</span></button>
        <button id="demo-open" class="demo-launch" disabled>自動示範＋錄影 <span>●</span></button>
        <div class="menu-links"><button id="help-open">玩法及操作</button><button id="settings-open">聲音及畫質</button></div>
        <div class="record"><span>個人最佳</span><strong id="best">—</strong><span id="best-grade">等你開車</span></div></div>
        <div class="menu-bottom"><span>限時 <b>180</b> 秒</span><span>左側行車 · 手動上落客</span><button id="credits-open">製作及素材</button></div>
      </div>
      <div id="hud" class="hidden">
        <div class="hud-top"><div class="route-card"><span class="route-number">紅V</span><div><b id="street">北河街</b><small>深水埗 → 旺角總站</small></div></div>
        <div class="timer"><small>到站限時</small><strong id="timer">03:00</strong></div>
        <div class="score"><small>本局得分</small><strong id="score">0200</strong><button id="pause" aria-label="暫停遊戲">Ⅱ</button></div></div>
        <div class="navigation"><svg id="nav-arrow" viewBox="0 0 64 64" aria-hidden="true"><path d="M32 3 58 32 40 29 40 60 24 60 24 29 6 32Z"/></svg><div><b id="nav-title">沿路直行</b><small id="nav-distance">220 m</small></div></div>
        <div id="stop-banner" class="stop-banner hidden"><span id="stop-label">前方有人招手</span><strong id="stop-name">北河街街市</strong><span id="stop-distance"></span></div>
        <div id="toast" class="toast hidden" role="status"></div><div id="countdown" class="countdown hidden"></div>
        <div class="hud-bottom"><div class="speed-unit"><div class="speed-label">車速顯示器 <span id="alarm-label">80 km/h 警示</span></div><div class="speed-reading"><strong id="speed">000</strong><span>km/h</span></div><div class="health"><span>車況</span><div><i id="health-fill"></i></div><b id="health-value">100%</b></div></div>
        <div class="service-card"><div class="service-summary"><span><i class="person-icon">♟</i> <b id="riders">0</b><small> / 16</small></span><span id="door-status">車門已關</span><span>送達 <b id="delivered">0</b></span></div><button id="door-action"><kbd>E</kbd><strong id="door-prompt">停妥後開門上客</strong><span>↔</span></button><div class="service-bar"><i id="service-fill"></i></div></div>
        <div class="progress-unit"><span>路線進度 <b id="progress-text">0%</b></span><div class="progress-line"><i id="progress-fill"></i></div><small>WASD 駕駛 · SPACE 手掣<br>E 車門 · R 復位 · ESC 暫停</small></div></div>
        <div id="touch-controls"><div class="touch-steer"><button data-control="left" aria-label="向左轉">◀</button><button data-control="right" aria-label="向右轉">▶</button></div><div class="touch-pedals"><button data-control="brake">剎車</button><button data-control="gas">油門</button></div></div>
        <div id="damage-flash"></div>
      </div>
      <div id="pause-screen" class="overlay hidden"><div class="panel"><span class="eyebrow">TAKE A BREATHER</span><h2>稍事休息</h2><p>倒數已暫停。準備好就繼續上路。</p><button id="resume" class="primary">繼續駕駛 <span>↗</span></button><button id="pause-settings" class="secondary">聲音及畫質</button><button id="quit" class="text-button">返回主畫面</button></div></div>
      <div id="help" class="overlay hidden"><div class="panel wide"><span class="eyebrow">HOW TO PLAY</span><h2>上路之前</h2><div class="help-grid"><div><b>01 / 跟箭嘴行</b><p>180 秒內沿路線抵達旺角。箭嘴指向下一個轉彎，駛錯方向可以循箭嘴返回。</p></div><div><b>02 / 停妥先開門</b><p>綠色方塊有乘客上車，藍色方塊有乘客落車。將整架車停入方塊，按 E 開門，完成後再按 E 關門。</p></div><div><b>03 / 留意車速</b><p>超過 80 km/h 會響及扣分。撞到行人、車輛、路邊物件或危險操作車門亦會扣分。</p></div><div><b>04 / 挑戰 S 級</b><p>完成路線、接載及送達乘客、剩餘時間和駕駛表現共同計分。尾站停妥並完成落客關門才算到站。</p></div></div><div class="key-list"><span><kbd>W / ↑</kbd> 油門</span><span><kbd>S / ↓</kbd> 剎車／倒車</span><span><kbd>A D / ← →</kbd> 轉向</span><span><kbd>SPACE</kbd> 手掣</span><span><kbd>E</kbd> 開關門</span><span><kbd>R</kbd> 復位（扣分及 5 秒）</span></div><button class="primary close-modal">明白，準備開車 <span>↗</span></button></div></div>
      <div id="settings" class="overlay hidden"><div class="panel"><span class="eyebrow">MAKE IT YOUR RIDE</span><h2>聲音及畫質</h2><label>背景音樂<input id="music" type="range" min="0" max="1" step="0.05"></label><label>引擎及音效<input id="sfx" type="range" min="0" max="1" step="0.05"></label><label>乘客人聲<input id="voice" type="range" min="0" max="1" step="0.05"></label><label>畫質<select id="quality"><option value="high">高 · 陰影及較高解像度</option><option value="low">流暢 · 較低解像度</option></select></label><button class="primary close-modal">完成 <span>✓</span></button></div></div>
      <div id="credits" class="overlay hidden"><div class="panel wide"><span class="eyebrow">MADE FOR THE STREETS</span><h2>《紅Van》第一版</h2><p>香港市區風格的原創街機駕駛遊戲。街道配置、商店名稱、3D 模型及背景音樂為本作製作；參考真實街景的建築比例、街道設施及小巴外形。</p><p>街景參考：Wikimedia Commons 的旺角紅色小巴、東京街夜景、深水埗商店招牌及香港橙色垃圾桶圖片。詳細來源見專案的素材文件。</p><p>技術：Three.js · Rapier · Web Audio<br>粵語短句：eSpeak NG 合成語音。音樂由原創音序即時合成。</p><p>以 Crazy Taxi 的街機節奏為靈感；本作與 SEGA 沒有關聯。</p><button class="primary close-modal">返回 <span>↗</span></button></div></div>
      <div id="results" class="overlay hidden"><div class="result-panel"><div class="result-heading"><div><span class="eyebrow">SHIFT COMPLETE</span><h2 id="result-title">準時到站！</h2><p id="result-subtitle">今日這一轉，辛苦晒。</p></div><div id="grade" class="grade">S</div></div><div class="total-row"><span>本局總分</span><strong id="result-score">1,000</strong><span>/ 1,000</span></div><div id="score-breakdown" class="score-breakdown"></div><div id="result-stats" class="result-stats"></div><div class="result-actions"><button id="retry" class="primary">再開一轉 <span>↗</span></button><button id="result-menu" class="secondary">返回主畫面</button></div><small id="run-seed"></small></div></div>
      <div id="demo-dialog" class="overlay hidden"><div class="panel wide"><span class="eyebrow">AUTO DRIVE · LOCAL RECORDING</span><h2>錄一轉《紅Van》</h2><p>這是自動駕駛示範，並非人工實玩。使用固定路況，以正常速度完成限時 180 秒的路線；上落客、交通、碰撞及計分照常運作，示範不計入個人最佳。</p><ol class="demo-steps"><li>按下錄影，在瀏覽器分享視窗選擇<strong>目前的《紅Van》分頁</strong>。</li><li>保持遊戲分頁在前景。錄下主畫面 5 秒後會自動開車；離開分頁會暫停，返回後按「繼續駕駛」。</li><li>提早到站即計分，保留計分畫面 8 秒後停止；可預覽及下載 WebM／MP4 影片。</li></ol><p class="demo-note">錄影包含介面、音樂及遊戲音效，不使用咪高峰。影片只保留在你的瀏覽器，不會上載；請在重新載入或開始下一段錄影前下載。請使用電腦版 Chrome／Edge，先在「聲音及畫質」調整音量。</p><p id="demo-error" role="status"></p><button id="demo-record" class="primary">選擇遊戲分頁並錄影 <span>●</span></button><button id="demo-close" class="text-button">返回</button></div></div>
      <div id="demo-banner" class="hidden" role="status"><strong>● 自動駕駛示範</strong><span id="demo-status"></span><button id="demo-cancel">停止並保存</button></div>
      <button id="recording-reopen" class="hidden">查看／下載錄影</button>
      <div id="recording-result" class="overlay hidden"><div class="panel wide"><span class="eyebrow">YOUR RECORDING</span><h2>示範影片</h2><p id="recording-message" role="status"></p><video id="recording-video" controls playsinline preload="metadata"></video><a id="recording-download" class="primary" download>下載影片</a><p class="demo-note">請在離開、重新載入或開始另一段錄影前下載。這段影片是自動駕駛示範。</p><button id="recording-close" class="text-button">關閉</button></div></div>
      <div id="error" class="overlay hidden"><div class="panel"><h2>未能啟動遊戲</h2><p id="error-text"></p><button class="primary" onclick="location.reload()">重新載入</button></div></div>`;
    this.el('start').onclick=()=>this.onStart();this.el('retry').onclick=()=>this.onStart();this.el('resume').onclick=()=>this.onResume();this.el('quit').onclick=()=>this.onMenu();this.el('result-menu').onclick=()=>this.onMenu();this.el('pause').onclick=()=>this.onPause();this.el('door-action').onclick=()=>this.onDoor();
    this.el('help-open').onclick=()=>this.show('help');this.el('credits-open').onclick=()=>this.show('credits');this.el('settings-open').onclick=()=>this.show('settings');this.el('pause-settings').onclick=()=>this.show('settings');
    document.querySelectorAll<HTMLElement>('.close-modal').forEach(el=>el.onclick=()=>el.closest('.overlay')!.classList.add('hidden'));
    for(const name of ['music','sfx','voice','quality'] as const){const e=this.el(name) as HTMLInputElement;e.value=String(this.settings[name]);e.oninput=()=>{this.settings={music:+(this.el('music')as HTMLInputElement).value,sfx:+(this.el('sfx')as HTMLInputElement).value,voice:+(this.el('voice')as HTMLInputElement).value,quality:(this.el('quality')as HTMLSelectElement).value};try{localStorage.setItem('redvan-settings',JSON.stringify(this.settings));}catch{}this.onSettings(this.settings);};}
    this.updateBest();
  }
  el(id:string){return document.getElementById(id)!;}
  text(id:string,value:string){const el=this.el(id);if(el.textContent!==value)el.textContent=value;}
  show(id:string){this.el(id).classList.remove('hidden');}
  hide(id:string){this.el(id).classList.add('hidden');}
  ready(){(this.el('start')as HTMLButtonElement).disabled=false;this.text('start-text','開車！');(this.el('demo-open')as HTMLButtonElement).disabled=false;}
  setMode(mode:string){this.mode=mode;for(const id of ['menu','hud','pause-screen','results'])this.hide(id);if(mode==='menu')this.show('menu');else if(mode==='playing'||mode==='countdown')this.show('hud');else if(mode==='paused'){this.show('hud');this.show('pause-screen');}else if(mode==='results')this.show('results');document.body.dataset.mode=mode;}
  updateBest(){try{const b=JSON.parse(localStorage.getItem('redvan-best')||'null');if(b){this.text('best',b.score.toLocaleString());this.text('best-grade',b.grade+' 級車手');}}catch{}}
  results(stats:Stats,seed:number,reason:string,demo=false){const sc=scoreRun(stats);this.setMode('results');this.text('grade',sc.grade);this.el('grade').dataset.grade=sc.grade;this.text('result-title',stats.completed?'準時到站！':reason);this.text('result-subtitle',stats.completed?'今日這一轉，辛苦晒。':'再開一轉，路況又會不同。');this.text('result-score',sc.total.toLocaleString());
    this.el('score-breakdown').innerHTML=[['路線完成',sc.route,400],['乘客服務',sc.service,300],['時間表現',sc.time,100],['駕駛表現',sc.safety,200]].map(([label,v,max])=>`<div><span>${label}</span><div><i style="width:${Number(v)/Number(max)*100}%"></i></div><b>${v}<small> / ${max}</small></b></div>`).join('');
    this.el('result-stats').innerHTML=[['上車／送達',`${stats.picked} / ${stats.delivered}`],['剩餘時間',`${Math.max(0,stats.remaining).toFixed(1)} 秒`],['超速時間',`${stats.overspeed.toFixed(1)} 秒`],['危險車門操作',stats.doorViolations],['碰撞：人／車／物',`${stats.people} / ${stats.cars} / ${stats.objects}`],['錯過落客／復位',`${stats.missed} / ${stats.resets}`]].map(([a,b])=>`<div><span>${a}</span><b>${b}</b></div>`).join('');this.text('run-seed','路況編號 '+seed);
    if(demo)this.text('result-subtitle','自動駕駛示範 · 不計入個人最佳');
    if(stats.completed&&!demo){try{const best=JSON.parse(localStorage.getItem('redvan-best')||'null');if(!best||sc.total>best.score)localStorage.setItem('redvan-best',JSON.stringify({score:sc.total,grade:sc.grade}));}catch{}}this.updateBest();}
  fail(error:string){this.text('error-text',error);this.show('error');}
}
