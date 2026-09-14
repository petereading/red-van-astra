import type { UI } from './ui';
import type { GameAudio } from './audio';

export const DEMO_SEED=8521986;
export const INTRO_MS=5000, OUTRO_MS=8000;
export function recordingMime(supports:(mime:string)=>boolean){
  return ['video/webm;codecs=vp8,opus','video/webm','video/mp4'].find(supports)??'';
}

/** Captures the chosen browser tab (including DOM HUD) and our own audio bus.
 * No microphone, system audio, upload, game-state shortcuts or accelerated clock.
 */
export class DemoRecorder {
  busy=false; private epoch=0; private recorder?:MediaRecorder;
  private capture?:MediaStream; private releaseAudio?:()=>void;
  private intro?:ReturnType<typeof setTimeout>; private outro?:ReturnType<typeof setTimeout>;
  private watchdog?:ReturnType<typeof setTimeout>; private chunks:Blob[]=[]; private bytes=0;
  private url?:string; private message='';
  constructor(private ui:Pick<UI,'el'|'text'|'show'|'hide'>,private audio:GameAudio,
    private game:{start:()=>Promise<void>;stop:()=>void}){
    ui.el('demo-open').onclick=()=>this.open();
    ui.el('demo-record').onclick=()=>void this.begin();
    ui.el('demo-cancel').onclick=()=>this.stop('已停止示範；影片保留已錄下的部分。');
    ui.el('demo-close').onclick=()=>{if(this.busy)this.stop('已取消錄影。');ui.hide('demo-dialog');};
    ui.el('recording-close').onclick=()=>{(ui.el('recording-video')as HTMLVideoElement).pause();ui.hide('recording-result');};
    ui.el('recording-reopen').onclick=()=>ui.show('recording-result');
  }
  open(){
    if(this.busy)return;
    const supported=!!navigator.mediaDevices?.getDisplayMedia&&typeof MediaRecorder!=='undefined';
    (this.ui.el('demo-record') as HTMLButtonElement).disabled=!supported;
    this.ui.text('demo-error',supported?'':'此瀏覽器未提供分頁錄影。請在電腦版 Chrome 或 Edge 開啟遊戲。');
    this.ui.show('demo-dialog');
  }
  async begin(){
    if(this.busy)return;
    this.busy=true;const epoch=++this.epoch;
    (this.ui.el('demo-record')as HTMLButtonElement).disabled=true;
    this.ui.text('demo-error','請在分享視窗選擇目前的《紅Van》分頁。');
    try{
      // Must be called directly from the button's user activation, before awaits.
      const capture=await navigator.mediaDevices.getDisplayMedia({
        video:{displaySurface:'browser',frameRate:{ideal:30,max:30},width:{ideal:1920},height:{ideal:1080}},
        audio:false,preferCurrentTab:true,selfBrowserSurface:'include',surfaceSwitching:'exclude',monitorTypeSurfaces:'exclude'
      } as DisplayMediaStreamOptions);
      if(epoch!==this.epoch){capture.getTracks().forEach(t=>t.stop());return;}
      this.capture=capture;
      const video=capture.getVideoTracks()[0];
      if(!video||video.readyState==='ended')throw new Error('未取得畫面，請重新選擇遊戲分頁。');
      const surface=video.getSettings().displaySurface;
      if(surface&&surface!=='browser')throw new Error('請選擇《紅Van》瀏覽器分頁，而非整個螢幕或視窗。');
      video.addEventListener('ended',()=>{if(epoch===this.epoch)this.stop('畫面分享已停止；影片保留已錄下的部分。');},{once:true});
      await this.audio.unlock();
      // Voice loading is bounded so an unavailable asset cannot hold the picker open.
      await Promise.race([this.audio.voicesReady,new Promise(resolve=>setTimeout(resolve,4000))]);
      if(epoch!==this.epoch)return;
      const source=this.audio.recordingSource();this.releaseAudio=source.release;
      const stream=new MediaStream([video,...source.stream.getAudioTracks()]);
      const mimeType=recordingMime(m=>MediaRecorder.isTypeSupported(m));
      this.recorder=new MediaRecorder(stream,{...(mimeType?{mimeType}:{}),videoBitsPerSecond:4_000_000,audioBitsPerSecond:128_000});
      this.chunks=[];this.bytes=0;this.message='自動駕駛示範錄影完成。';this.clearDownload();
      this.recorder.ondataavailable=e=>{if(e.data.size){this.chunks.push(e.data);this.bytes+=e.data.size;if(this.bytes>160*1024*1024)this.stop('影片已達大小上限，已停止並保留錄影。');}};
      this.recorder.onerror=()=>this.stop('瀏覽器錄影中斷；可下載已保留的部分。');
      this.recorder.onstop=()=>this.finalize();
      this.ui.hide('demo-dialog');this.ui.hide('recording-result');this.ui.show('demo-banner');
      document.body.classList.add('demo-active');this.ui.text('demo-status','錄影中 · 5 秒後自動開車');
      this.recorder.start(1000);
      this.intro=setTimeout(()=>{
        this.ui.text('demo-status','錄影中 · 180 秒限時路線');
        void this.game.start().catch(()=>this.stop('示範未能啟動；請重新錄影。'));
      },INTRO_MS);
      this.watchdog=setTimeout(()=>this.stop('錄影超過 10 分鐘，已停止並保留影片。'),600_000);
    }catch(error){
      if(epoch!==this.epoch)return;
      this.epoch++;this.busy=false;this.cleanup();this.recorder=undefined;
      const name=error instanceof Error?error.name:'';
      this.ui.text('demo-error',name==='NotAllowedError'?'未開始錄影。請允許分享目前的遊戲分頁；如系統拒絕，請檢查瀏覽器的螢幕錄影權限。':error instanceof Error?error.message:'未能開始錄影，請重新嘗試。');
      this.ui.show('demo-dialog');
      (this.ui.el('demo-record')as HTMLButtonElement).disabled=false;
    }
  }
  finished(){
    if(!this.busy||!this.recorder||this.recorder.state!=='recording'||this.outro)return;
    this.ui.text('demo-status','錄影中 · 保留計分畫面 8 秒');
    this.outro=setTimeout(()=>this.stop('自動駕駛示範錄影完成，包含主畫面、路線及計分。'),OUTRO_MS);
  }
  stop(message:string){
    if(!this.busy)return;
    this.message=message;this.epoch++;this.clearTimers();
    if(this.recorder&&this.recorder.state!=='inactive'){
      this.ui.text('demo-status','正在整理影片…');this.recorder.stop();
    }else if(this.recorder){return;} // onstop will flush the final chunk and clean up.
    else{this.busy=false;this.cleanup();this.game.stop();(this.ui.el('demo-record')as HTMLButtonElement).disabled=false;}
  }
  private finalize(){
    const type=this.recorder?.mimeType||this.chunks[0]?.type||'video/webm';
    const blob=new Blob(this.chunks,{type});this.chunks=[];this.recorder=undefined;
    this.busy=false;this.cleanup();this.game.stop();
    (this.ui.el('demo-record')as HTMLButtonElement).disabled=false;
    this.ui.text('recording-message',blob.size?this.message:'沒有可下載的影片，請重新錄影。');
    const link=this.ui.el('recording-download')as HTMLAnchorElement;
    const player=this.ui.el('recording-video')as HTMLVideoElement;
    if(blob.size){
      this.url=URL.createObjectURL(blob);player.src=this.url;link.href=this.url;
      link.download=`red-van-auto-demo-${new Date().toISOString().replace(/[:.]/g,'-')}.${type.includes('mp4')?'mp4':'webm'}`;
      this.ui.text('recording-download',`下載影片 · ${(blob.size/1024/1024).toFixed(1)} MB`);
      this.ui.show('recording-download');this.ui.show('recording-video');
      this.ui.show('recording-reopen');
    }else{this.ui.hide('recording-download');this.ui.hide('recording-video');}
    this.ui.show('recording-result');
  }
  private clearTimers(){clearTimeout(this.intro);clearTimeout(this.outro);clearTimeout(this.watchdog);this.intro=this.outro=this.watchdog=undefined;}
  private cleanup(){
    this.clearTimers();this.capture?.getTracks().forEach(t=>t.stop());this.capture=undefined;
    this.releaseAudio?.();this.releaseAudio=undefined;
    this.ui.hide('demo-banner');document.body.classList.remove('demo-active');
  }
  private clearDownload(){
    const video=this.ui.el('recording-video')as HTMLVideoElement;video.pause();video.removeAttribute('src');video.load();
    this.ui.el('recording-download').removeAttribute('href');
    this.ui.hide('recording-reopen');
    if(this.url){URL.revokeObjectURL(this.url);this.url=undefined;}
  }
}
