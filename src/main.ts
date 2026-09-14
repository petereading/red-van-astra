import './style.css';
import '@fontsource/noto-sans-tc/700.css';
import { Game } from './game';
async function boot(){let game:Game|undefined;try{game=new Game();await game.init();}catch(err){console.error(err);if(game)game.ui.fail('請使用支援 WebGL 2 的瀏覽器，或更新瀏覽器後再試。'+(import.meta.env.DEV?' '+String(err):''));else document.getElementById('app')!.textContent='此裝置未能啟動 3D 畫面。請使用支援 WebGL 2 的瀏覽器。';}}
void boot();
