import {deployment} from './deployment';
import {mountSearch,searchId} from './search';
import {BackgroundScene} from './engine/scene';
import './style.css';
import { Renderer } from './engine/renderer';
import { PlaybackClock, Hitsounds } from './engine/audio';
import { applyStacking } from './engine/parser';
import { density, upperBound,autoCombo } from './engine/playback';
import { clamp, difficulty, type Beatmap } from './engine/types';
import { beatmapId } from './input';
import type { CatalogEntry } from './archive.worker';
import {Skin} from './skin/runtime';
import type {SkinArchive} from './skin/archive';
import {defaultMods,modOn,modSpeed,effectiveStats} from './engine/mods';
import {restoreMods,previewQuery} from './engine/preset';
import {mountModPanel} from './mod-panel';
import {mountSettingsTabs} from './settings-tabs';
import type {VisualMods} from './engine/types';

const icons = {
  play:'<path d="m8 5 11 7-11 7Z"/>', pause:'<path d="M8 5v14M16 5v14"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  orbit:'<circle cx="12" cy="12" r="6"/><ellipse cx="12" cy="12" rx="11" ry="4" transform="rotate(-35 12 12)"/>',
  back:'<path d="m10 5-7 7 7 7m10-14-7 7 7 7"/>',next:'<path d="m4 5 7 7-7 7m10-14 7 7-7 7"/>',
  link:'<path d="m10 14 4-4m-6 7-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2-1 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',
};
const icon=(name:keyof typeof icons)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
document.querySelector<HTMLDivElement>('#app')!.innerHTML=`
  <header class="site-header"><a class="brand" href="${deployment.appBase}" aria-label="ORBIT 首页">${icon('orbit')}<span>ORBIT<span class="brand-dot">.</span></span></a><div class="header-divider"></div><span class="header-caption">osu! map reader</span><span class="header-tag"><i></i> 独立读谱引擎</span><a class="source-link" href="https://osu.ppy.sh/beatmapsets" target="_blank" rel="noreferrer">寻找谱面 <span>↗</span></a></header>
  <main>
    <section class="intro"><div><h1>谱面工作台<span class="intro-label">osu!standard</span></h1></div></section>
    <form id="search-form" class="search-row"><div class="search-input-wrap">${icon('search')}<label class="sr-only" for="beatmap-input">谱面 ID 或 osu! 链接</label><input id="beatmap-input" autocomplete="off" placeholder="输入谱面 / 谱面集 ID，自动匹配封面与难度" spellcheck="false"/><kbd>Enter ↵</kbd></div><button class="primary" id="load-button" type="submit">读取谱面 <span>↗</span></button><button class="import-button" id="import-button" type="button">${icon('upload')}<span>导入 .osz</span></button><input id="file-input" class="sr-only" type="file" accept=".osz" tabindex="-1"/></form>
    <section id="search-results" class="search-results" aria-label="谱面搜索结果" hidden></section>
    <div id="status" class="load-status" role="status" aria-live="polite"><span class="status-dot"></span><span id="status-text">就绪。输入 ID，或者试试下方的 No title。</span><span id="load-detail"></span></div>
    <div class="workspace">
      <section class="player-panel" aria-label="谱面播放器">
        <div class="map-info"><div class="cover" id="map-cover">${icon('orbit')}</div><div class="map-title"><p id="artist">WAITING FOR A BEATMAP</p><h2 id="title">你的下一张谱面</h2><p id="mapper">在线 ID / 链接读取 · 本地谱面导入</p></div><button id="share" class="icon-button" disabled title="复制谱面预览链接" aria-label="复制谱面预览链接">${icon('link')}</button></div>
        <header class="player-header"><span class="mode-badge">osu!standard</span><span class="player-state" id="player-state">待载入</span><div class="player-header-right"><span id="fps">CANVAS 2D</span><button id="fullscreen" class="icon-button" title="全屏 (F)" aria-label="全屏播放器">${icon('expand')}</button></div></header>
        <div class="stage" id="stage"><canvas id="playfield" aria-label="osu!standard 谱面预览"></canvas>
          <div class="empty-state" id="empty-state"><div class="orbital-mark"><i></i><b></b><span></span></div><p class="empty-overline">YOUR NEXT MAP, IN ORBIT</p><h2>先看一遍，再上场。</h2><p>圆圈、滑条、节奏。完整谱面，一眼有数。</p><button id="demo-button" class="demo-button">${icon('play')}加载示例 <strong>No title</strong><span>738063 ↗</span></button><small>或将本地 .osz 谱面包拖到这里</small></div>
          <div class="stage-meta" id="stage-meta" hidden><span>AUTO PREVIEW</span><span id="stage-objects">0 OBJECTS</span></div>
          <div class="pause-overlay" id="pause-overlay" hidden>${icon('play')}<span>已暂停 · 点击画面继续</span></div>
          <div class="busy-overlay" id="busy-overlay" hidden><span class="spinner"></span><p id="busy-text">正在定位谱面…</p><small>首次加载需要下载音乐与谱面资源</small></div>
        </div>
        <div class="timeline-section"><div class="timeline-labels"><span>物件密度 <b>NOTES / TIME</b></span><span id="loop-label">点击或拖动时间轴跳转</span></div><div class="density-track"><canvas id="density" aria-hidden="true"></canvas><label class="sr-only" for="seek">播放进度</label><input type="range" min="0" max="1" step="1" value="0" id="seek" disabled aria-valuetext="00:00"/></div><div class="time-labels"><span id="current-time">00:00</span><span id="total-time">--:--</span></div></div>
        <div class="transport"><div class="transport-left"><button class="icon-button" id="rewind" title="后退 5 秒 (←)" aria-label="后退5秒">${icon('back')}</button><button class="play-button" id="play" disabled aria-label="播放">${icon('play')}</button><button class="icon-button" id="forward" title="前进 5 秒 (→)" aria-label="前进5秒">${icon('next')}</button><span id="play-caption">准备好，再出发</span></div><div class="loop-controls"><button id="mark-a" title="把当前位置标为循环起点 ([)">A <span>起点</span></button><button id="mark-b" title="把当前位置标为循环终点 (])">B <span>终点</span></button><button id="clear-loop" class="text-button" disabled>清除</button></div></div>

      </section>
      <aside class="reading-desk" aria-label="读谱设置"><div class="desk-heading"><h2>预览设置</h2><span>SETTINGS</span></div>
        <div class="settings-tabs" role="tablist" aria-label="预览设置分类">
          <button id="tab-reading" type="button" role="tab" aria-selected="true" aria-controls="settings-reading">读谱</button>
          <button id="tab-skin" type="button" role="tab" aria-selected="false" aria-controls="settings-skin" tabindex="-1">皮肤</button>
          <button id="tab-sound" type="button" role="tab" aria-selected="false" aria-controls="settings-sound" tabindex="-1">声画</button>
        </div>
        <div id="settings-reading" class="settings-panel" role="tabpanel" aria-labelledby="tab-reading" tabindex="0">
        <section class="desk-section"><div class="section-heading"><h2>谱面信息</h2><a id="official-link" hidden target="_blank" rel="noreferrer">官网 ↗</a></div><label class="sr-only" for="difficulty">当前难度</label><select id="difficulty" disabled><option>载入谱面后选择</option></select><div class="stat-grid"><div><b id="stat-ar">—</b><span>AR</span></div><div><b id="stat-cs">—</b><span>CS</span></div><div><b id="stat-od">—</b><span>OD</span></div><div><b id="stat-bpm">—</b><span>BPM</span></div></div><div class="object-counts"><span><i class="circle-symbol"></i><b id="count-circle">—</b> 圆圈</span><span><i class="slider-symbol"></i><b id="count-slider">—</b> 滑条</span><span><i class="spinner-symbol"></i><b id="count-spinner">—</b> 转盘</span></div></section>
        <section class="desk-section playback-section"><h2 class="sr-only">播放与读谱</h2><span class="field-label">播放速度 <b id="rate-value">1.00×</b></span><div class="rate-presets" role="group" aria-label="播放速度">${[.5,.75,1,1.25,1.5,2].map(r=>`<button data-rate="${r}" aria-pressed="${r===1}" class="${r===1?'active':''}">${r}×</button>`).join('')}</div><div class="section-heading mod-label"><span class="field-label">MODS · stable + lazer</span><button id="mods-open" class="small-tag" type="button">完整目录 48 ↗</button></div><p id="mods-summary" class="mods-summary">NM · 无 MOD</p><div class="mod-quick">${['EZ','HR','HD','DT','NC','FL','MR','DA'].map(m=>`<button data-mod="${m}" aria-pressed="false">${m}</button>`).join('')}</div><p id="mods-selection-note" class="control-hint"></p></section>
        </div>
        <div id="settings-skin" class="settings-panel" role="tabpanel" aria-labelledby="tab-skin" tabindex="0" hidden>
        <section class="desk-section skin-section"><div class="section-heading"><h2>游戏皮肤</h2><span class="small-tag">OSK</span></div>
          <label class="field-label" for="skin-select">游玩外观</label><div class="skin-picker"><select id="skin-select"><option value="default">BTMC × Spoo · Freedom DiVE</option><option value="builtin">ORBIT · 简约矢量</option></select><button id="skin-import" type="button" aria-label="导入 OSK 皮肤" title="导入本地 .osk">＋</button></div><input type="file" accept=".osk" id="skin-file" class="sr-only" tabindex="-1"/>
          <p id="skin-status" class="control-hint" role="status">正在读取本地默认皮肤…</p><div class="toggle-row"><label for="skin-colors">使用皮肤 Combo 配色</label><input type="checkbox" role="switch" id="skin-colors" checked/></div><div class="toggle-row"><label for="skin-sounds">优先使用皮肤打击音</label><input type="checkbox" role="switch" id="skin-sounds" checked/></div><label class="range-label" for="cursor-size">光标大小 <output id="cursor-size-value">1.00×</output></label><input type="range" id="cursor-size" min="50" max="200" step="5" value="100"/><details class="advanced-settings"><summary>滑条动画设置</summary><div class="toggle-row"><label for="snake-in">滑条渐入 Snake-in</label><input type="checkbox" role="switch" id="snake-in" checked/></div><div class="toggle-row"><label for="snake-out">末段收尾 Snake-out</label><input type="checkbox" role="switch" id="snake-out" checked/></div></details>
        </section>
        </div>
        <div id="settings-sound" class="settings-panel" role="tabpanel" aria-labelledby="tab-sound" tabindex="0" hidden>
        <section class="desk-section sound-section"><div class="section-heading"><h2>画面与声音</h2><button id="sound-toggle" class="small-tag" aria-pressed="true">打击音 ON</button></div><div class="toggle-row"><label for="video-enabled">背景视频</label><input id="video-enabled" type="checkbox" role="switch" checked/></div><div class="toggle-row"><label for="storyboard-enabled">故事板</label><input id="storyboard-enabled" type="checkbox" role="switch" checked/></div><p id="media-status" class="media-status" role="status">尚未载入媒体</p><div id="blinds-control" class="context-setting" hidden><label class="range-label" for="blinds-hp">Blinds 预览血量 <output id="blinds-hp-value">100%</output></label><input type="range" id="blinds-hp" min="0" max="100" value="100"/></div><label class="range-label" for="dim">背景暗化 <output id="dim-value">82%</output></label><input type="range" id="dim" min="0" max="100" value="82"/><label class="range-label" for="volume">音乐音量 <output id="volume-value">50%</output></label><input type="range" id="volume" min="0" max="100" value="50"/><label class="range-label" for="hit-volume">打击音音量 <output id="hit-volume-value">35%</output></label><input type="range" id="hit-volume" min="0" max="100" value="35"/><div class="toggle-row"><label for="cursor">Auto 光标与拖尾</label><input type="checkbox" id="cursor" checked role="switch"/></div><div class="toggle-row"><label for="grid">辅助网格</label><input type="checkbox" id="grid" role="switch"/></div><label class="offset-label" for="offset">画面偏移 <div><input id="offset" type="number" min="-300" max="300" step="5" value="0" aria-label="画面偏移毫秒"/><span>ms</span></div></label><p class="control-hint">正值让画面提前。音画对齐可手动微调。</p></section>
        </div>

      </aside>
    </div>
    <footer class="page-footer"><span>ORBIT <b>v0.1</b><i>/</i>独立 osu! 读谱工具</span><div><kbd>Space</kbd> 播放 / 暂停 <kbd>← →</kbd> 跳转 <kbd>F</kbd> 全屏</div><span>本地解析 · Canvas 2D</span></footer>
  </main><div id="toast" role="status" hidden></div>
`;

const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
mountSettingsTabs(document.querySelector<HTMLElement>('.reading-desk')!);
const clock=new PlaybackClock(),sounds=new Hitsounds(),renderer=new Renderer($<HTMLCanvasElement>('playfield'));
clock.audio.volume=.5;
const search=mountSearch($<HTMLInputElement>('beatmap-input'),$('search-results'),id=>void loadOnline(id));
let practiceRate=1,musicVolume=.5;
renderer.options.mods=defaultMods();
const worker=new Worker(new URL('./archive.worker.ts',import.meta.url),{type:'module'});
let requestId=0;
const pending=new Map<number,{resolve:(result:any)=>void;reject:(error:Error)=>void}>();
worker.onmessage=({data})=>{const task=pending.get(data.request);if(task){pending.delete(data.request);if(data.error)task.reject(new Error(data.error));else task.resolve(data.result);}};
worker.onerror=()=>{for(const task of pending.values())task.reject(new Error('谱面处理线程异常，请刷新后重试。'));pending.clear();};
const rpc=(action:string,data:Record<string,unknown>,transfer:Transferable[]=[])=>new Promise<any>((resolve,reject)=>{const request=++requestId;pending.set(request,{resolve,reject});worker.postMessage({action,request,...data},transfer);});
let map:Beatmap|undefined,catalog:CatalogEntry[]=[],busy=false,loadToken=0,archiveId=0;
let assetUrls:string[]=[],bins:number[]=[],loopA:number|null=null,loopB:number|null=null,frame=0,fpsFrames=0,fpsStart=performance.now(),lastUI=0,lastDensity=0;
const densityCanvas=$<HTMLCanvasElement>('density'),densityContext=densityCanvas.getContext('2d')!;
let densityFrame='';
const format=(ms:number)=>{const seconds=Math.max(0,Math.floor(ms/1000));return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;};
function toast(message:string){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3300);}
let toastTimer:ReturnType<typeof setTimeout>;
function status(message:string,kind='ready'){ $('status-text').textContent=message;$('status').dataset.kind=kind; }
function setBusy(value:boolean,message=''){busy=value;$('busy-overlay').hidden=!value;$('busy-text').textContent=message;$<HTMLButtonElement>('load-button').disabled=value;$<HTMLButtonElement>('import-button').disabled=value;$<HTMLSelectElement>('difficulty').disabled=value||!catalog.length;$<HTMLButtonElement>('play').disabled=value||!map;$<HTMLButtonElement>('demo-button').disabled=value;if(value){clock.pause();sounds.reset(clock.time());syncPlay();}}
function syncPlay(){const playing=clock.playing;$('play').innerHTML=icon(playing?'pause':'play');$('play').setAttribute('aria-label',playing?'暂停':'播放');$('play-caption').textContent=map?(playing?'正在播放 · AUTO':'点击播放 · AUTO'):'准备好，再出发';$('player-state').textContent=map?(playing?'播放中':'已暂停'):'待载入';$('player-state').classList.toggle('playing',playing);$('pause-overlay').hidden=!map||playing||busy;$('pause-overlay').querySelector('span')!.textContent=clock.time()>=clock.duration-50?'播放结束 · 点击重新播放':'已暂停 · 点击画面继续';}
function clearAssets(){for(const url of assetUrls)URL.revokeObjectURL(url);assetUrls=[];}
function blobUrl(bytes:Uint8Array,type:string){const url=URL.createObjectURL(new Blob([bytes.slice().buffer as ArrayBuffer],{type}));assetUrls.push(url);return url;}
function audioMime(filename:string){return /\.ogg$/i.test(filename)?'audio/ogg':/\.wav$/i.test(filename)?'audio/wav':/\.flac$/i.test(filename)?'audio/flac':'audio/mpeg';}
let skinToken=0,activeSkinPreset='builtin',customSkin:Skin|undefined;
async function applySkin(skin:Skin,preset:string,token:number){
  if(token!==skinToken)return;
  await sounds.setSkin(skin.audioFiles,skin.config.layeredSounds);if(token!==skinToken)return;
  sounds.reset(clock.time());renderer.setSkin(skin);activeSkinPreset=preset;
  const selector=$<HTMLSelectElement>('skin-select');
  if(preset==='custom'){
    let option=selector.querySelector<HTMLOptionElement>('option[value="custom"]');if(!option){option=document.createElement('option');option.value='custom';selector.add(option);}option.textContent=skin.config.name;
  }
  selector.value=preset;
  $('skin-status').textContent=`${skin.config.name} · ${skin.config.author} / ${skin.sprites.size} 张贴图 · ${sounds.skinLoaded} 个音效`;
  try{localStorage.setItem('orbit.skin.mode',preset==='builtin'?'builtin':'default');}catch{}
}
async function loadSkin(bytes:ArrayBuffer,preset:string,token:number){
  const payload:SkinArchive=await rpc('skin',{bytes},[bytes]);
  const skin=await Skin.create(payload);if(token!==skinToken)return;
  if(preset==='custom')customSkin=skin;
  await applySkin(skin,preset,token);
}
async function selectSkin(preset:string){
  const token=++skinToken;
  if(preset==='builtin'){
    renderer.setSkin();await sounds.setSkin([]);sounds.reset(clock.time());activeSkinPreset='builtin';
    $('skin-status').textContent='ORBIT 简约矢量外观';try{localStorage.setItem('orbit.skin.mode','builtin');}catch{}return;
  }
  $('skin-status').textContent='正在解包并解码皮肤…';
  try{
    if(preset==='custom'&&customSkin){await applySkin(customSkin,'custom',token);return;}
    const res=await fetch(deployment.api('skins/default'));if(!res.ok)throw new Error('尚未安装默认皮肤，可点击 ＋ 导入 .osk。');
    await loadSkin(await res.arrayBuffer(),'default',token);
  }catch(error){if(token===skinToken){$<HTMLSelectElement>('skin-select').value=activeSkinPreset;$('skin-status').textContent=(error as Error).message;}}
}
async function importSkin(file:File){
  if(!/\.osk$/i.test(file.name)){toast('请选择 .osk 皮肤压缩包');return;}
  if(file.size>128*1048576){toast('皮肤包超过 128 MB 上限');return;}
  const token=++skinToken;$('skin-status').textContent='正在本地解析皮肤，不会上传…';
  try{await loadSkin(await file.arrayBuffer(),'custom',token);}catch(error){if(token===skinToken){$<HTMLSelectElement>('skin-select').value=activeSkinPreset;$('skin-status').textContent=(error as Error).message;}}
}
async function setArchive(bytes:ArrayBuffer,id=0,binding:Record<string,unknown>={}){
  const info=await rpc('open',{bytes,id,...binding},[bytes]);catalog=info.catalog;archiveId=id;
  const selector=$<HTMLSelectElement>('difficulty');selector.replaceChildren();for(const item of catalog){const option=document.createElement('option');option.value=item.entry;option.textContent=item.version;selector.add(option);}
  const selected=id?catalog.find(c=>c.id===id):catalog[Math.floor(catalog.length/2)];
  if(!selected)throw new Error('下载的谱面包不包含请求的单难度 ID；可能谱面已更新。请导入最新版 .osz。');
  selector.value=selected.entry;await selectDifficulty(selected.entry);
}
async function selectDifficulty(entry:string){
  const result=await rpc('select',{entry});
  const next:Beatmap=result.map;clock.pause();sounds.reset(0);renderer.scene?.dispose();renderer.scene=undefined;clearAssets();
  $('media-status').textContent='正在解码故事板与视频…';
  const scene=await BackgroundScene.create(result.scene,text=>$('media-status').textContent=text);
  scene.videoEnabled=$<HTMLInputElement>('video-enabled').checked;scene.storyboardEnabled=$<HTMLInputElement>('storyboard-enabled').checked;renderer.scene=scene;next.duration=Math.max(next.duration,Math.min(scene.duration,3600000));
  let bg:HTMLImageElement|undefined;
  if(result.background){const url=blobUrl(result.background,'');bg=new Image();bg.src=url;try{await bg.decode();}catch{bg=undefined;}}
  let audioError='';
  try{await clock.load(result.audio?blobUrl(result.audio,audioMime(next.audio)):undefined,next.duration);}catch(error){audioError=(error as Error).message;}
  map=next;bins=density(map);densityFrame='';renderer.setMap(map,bg);loopA=null;loopB=null;updateLoop();
  await sounds.load(map,result.samples);sounds.configureNightcore(map);setMods(renderer.options.mods);
  $('empty-state').hidden=true;$('stage-meta').hidden=false;$('artist').textContent=map.artist;$('title').textContent=map.title;$('mapper').textContent=`${map.version}  /  mapped by ${map.creator}`;
  const cover=$('map-cover');cover.style.backgroundImage=bg?`url("${bg.src}")`:'';cover.innerHTML=bg?'':icon('orbit');
  $('stat-ar').textContent=map.ar.toFixed(1);$('stat-cs').textContent=map.cs.toFixed(1);$('stat-od').textContent=map.od.toFixed(1);$('stat-bpm').textContent=String(Math.round(map.bpm));
  for(const kind of ['circle','slider','spinner'])$(`count-${kind}`).textContent=String(map.objects.filter(o=>o.kind===kind).length);
  $('stage-objects').textContent=`${map.objects.length} OBJECTS`;
  $<HTMLInputElement>('seek').disabled=false;$<HTMLInputElement>('seek').max=String(Math.ceil(map.duration));$('total-time').textContent=format(map.duration);
  const official=$<HTMLAnchorElement>('official-link');official.hidden=map.id<=0;official.href=`https://osu.ppy.sh/beatmaps/${map.id}`;
  $<HTMLButtonElement>('share').disabled=!archiveId||map.id<=0;
  document.title=`${map.title} [${map.version}] · ORBIT`;
  const params=new URLSearchParams();if(archiveId&&map.id>0)params.set('b',String(map.id));history.replaceState(null,'',deployment.page(params));
  if(archiveId)$<HTMLInputElement>('beatmap-input').value=map.id>0?String(map.id):'';
  status(audioError||(!result.audio?'音乐文件缺失，当前仅播放画面。':`已载入 ${map.objects.length} 个物件 · ${sounds.customLoaded?'已解码 '+sounds.customLoaded+' 个谱面音效':'使用原创合成打击音'}`),audioError||!result.audio?'warning':'ready');
  if(map.warnings.length)toast(map.warnings.join('；'));
  syncPlay();syncStats();drawDensity();
}
async function loadOnline(value:string){
  if(busy)return;search.hide();let id:number;try{id=beatmapId(value);}catch(error){status((error as Error).message,'error');$<HTMLInputElement>('beatmap-input').focus();return;}
  const token=++loadToken,start=performance.now();setBusy(true,'正在定位谱面…');status('正在连接谱面资源…','loading');$('load-detail').textContent='';
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),150000);
  const poll=deployment.pollProgress?setInterval(async()=>{try{const res=await fetch(deployment.api(`beatmaps/${id}/progress`));if(token!==loadToken)return;const info=await res.json();if(info.detail){$('busy-text').textContent=info.detail;status(info.detail,'loading');}}catch{}},700):undefined;
  try{
    const res=await fetch(deployment.api(`beatmaps/${id}/archive?media=full-v1`),{signal:controller.signal});if(!res.ok)throw new Error((await res.json()).error||`HTTP ${res.status}`);
    const source=res.headers.get('X-Resource-Source')??'online',bytes=await res.arrayBuffer();
    clearInterval(poll);$('busy-text').textContent='解包、解析滑条与音频…';await setArchive(bytes,id,{checksum:res.headers.get('X-Beatmap-Checksum'),setId:Number(res.headers.get('X-Beatmap-Set'))});
    $('load-detail').textContent=`${source==='cache'?'CACHE':source.toUpperCase()} · ${((performance.now()-start)/1000).toFixed(1)}s`;
    $<HTMLInputElement>('beatmap-input').value=String(id);
  }catch(error){status((error as Error).name==='AbortError'?'加载超时，请重试或导入本地 .osz。':(error as Error).message,'error');}
  finally{clearTimeout(timeout);clearInterval(poll);setBusy(false);syncPlay();}
}
async function loadLocal(file:File){
  if(busy)return;if(!/\.osz$/i.test(file.name)){status('请选择 .osz 谱面包，单独 .osu 不包含音乐。','error');return;}
  if(file.size>128*1048576){status('谱面包超过 128 MB 上限。','error');return;}
  setBusy(true,'正在读取本地谱面包…');status('本地资源仅在浏览器解析，不会上传。','loading');
  try{await setArchive(await file.arrayBuffer());$('load-detail').textContent='LOCAL · 浏览器内处理';}catch(error){status((error as Error).message,'error');}finally{setBusy(false);syncPlay();}
}
async function togglePlay(){if(!map||busy)return;try{if(clock.playing){clock.pause();sounds.reset(clock.time());}else{await sounds.unlock();sounds.reset(clock.time()>=clock.duration-50?0:clock.time());await clock.play();}syncPlay();}catch(error){status(`播放失败：${(error as Error).message}`,'error');}}
function seek(time:number){if(!map||busy)return;clock.seek(time);sounds.reset(clock.time());syncPlay();drawDensity();}
function updateLoop(){
  $('mark-a').classList.toggle('active',loopA!==null);$('mark-b').classList.toggle('active',loopB!==null);$<HTMLButtonElement>('clear-loop').disabled=loopA===null&&loopB===null;
  $('loop-label').textContent=loopA!==null?(loopB!==null?`循环 ${format(loopA)} — ${format(loopB)}`:`起点 ${format(loopA)} · 再标记 B`):'点击或拖动时间轴跳转';
}
function markA(){if(!map)return;loopA=clock.time();if(loopB!==null&&loopB<=loopA)loopB=null;updateLoop();toast(`循环起点 A · ${format(loopA)}`);}
function markB(){if(!map)return;if(loopA===null){toast('请先标记起点 A');return;}if(clock.time()-loopA<300){toast('终点 B 需要比起点 A 晚至少 0.3 秒');return;}loopB=clock.time();updateLoop();toast('A/B 循环已开启');}
function drawDensity(){
  const rect=densityCanvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,2),w=Math.max(1,Math.floor(rect.width*ratio)),h=Math.max(1,Math.floor(rect.height*ratio));
  const key=`${w}|${h}|${clock.time()}|${loopA}|${loopB}`;if(densityFrame===key)return;densityFrame=key;
  if(densityCanvas.width!==w||densityCanvas.height!==h){densityCanvas.width=w;densityCanvas.height=h;}
  const c=densityContext;c.clearRect(0,0,w,h);if(!map)return;const max=Math.max(1,...bins),current=clock.time()/map.duration*w;
  if(loopA!==null){const a=loopA/map.duration*w,b=(loopB??clock.time())/map.duration*w;c.fillStyle='rgba(232,173,210,.1)';c.fillRect(a,0,b-a,h);c.fillStyle='#e9b2d4';c.fillRect(a,0,ratio,h);if(loopB!==null)c.fillRect(b,0,ratio,h);}
  bins.forEach((n,i)=>{const x=i/bins.length*w,height=(n/max*.86+.06)*h;c.fillStyle=x<=current?'#ddb0d0':'#383b4b';c.fillRect(x,h-height,Math.max(1,w/bins.length-2*ratio),height);});
  for(const time of map.bookmarks){const x=time/map.duration*w;c.fillStyle='#d6c598';c.fillRect(x,0,ratio,5*ratio);}
  c.fillStyle='#f4d2e6';c.fillRect(current,0,1.5*ratio,h);
}
function syncStats(){if(!map)return;const d=effectiveStats(map,renderer.options.mods,clock.rate);$('stat-ar').textContent=d.effectiveAR.toFixed(1);$('stat-cs').textContent=d.cs.toFixed(1);$('stat-od').textContent=d.effectiveOD.toFixed(1);$('stat-bpm').textContent=String(Math.round(d.bpm));}
function updateModPlayback(){const mods=renderer.options.mods,rate=modSpeed(mods,clock.time(),map?.duration??1)*practiceRate;if(Math.abs(rate-clock.rate)>.0005)clock.setRate(rate);clock.audio.preservesPitch=!(modOn(mods,'NC')||modOn(mods,'DC'));sounds.nightcore=modOn(mods,'NC');clock.audio.volume=musicVolume*(modOn(mods,'MU')&&map?Math.max(0,1-autoCombo(map,clock.time())/100):1);const label=clock.rate.toFixed(2)+'×';if($('rate-value').textContent!==label)$('rate-value').textContent=label;}
function setMods(mods:VisualMods){$('blinds-control').hidden=!modOn(mods,'BL');renderer.options.mods=mods;updateModPlayback();sounds.reset(clock.time());if(map){const d=difficulty(map,mods);applyStacking(map,d.ar,d.cs);renderer.rebuildPaths();syncStats();}}
const syncMods=mountModPanel(()=>renderer.options.mods,setMods);
$('mods-open').addEventListener('click',()=>{clock.pause();sounds.reset(clock.time());syncPlay();});
$('search-form').addEventListener('submit',async e=>{e.preventDefault();if(busy)return;const value=$<HTMLInputElement>('beatmap-input').value,id=searchId(value);if(!id){status('请输入有效的谱面 / 谱面集 ID 或 osu! 链接','error');return;}search.hide();try{const res=await fetch(deployment.api(`search?q=${id}`)),data=await res.json();if(!res.ok)throw new Error(data.error);const row=data.results.find((r:any)=>r.exact)??data.results[0];if(!row)throw new Error('没有匹配的 osu!standard 谱面');await loadOnline(String(row.id));}catch(error){status((error as Error).message,'error');}});
for(const [id,key]of [['video-enabled','videoEnabled'],['storyboard-enabled','storyboardEnabled']] as const)$<HTMLInputElement>(id).addEventListener('change',e=>{if(renderer.scene){renderer.scene[key]=(e.target as HTMLInputElement).checked;renderer.scene.revision++;}});
$('demo-button').addEventListener('click',()=>void loadOnline('738063'));
$<HTMLSelectElement>('skin-select').addEventListener('change',e=>void selectSkin((e.target as HTMLSelectElement).value));
$('skin-import').addEventListener('click',()=>$<HTMLInputElement>('skin-file').click());
$<HTMLInputElement>('skin-file').addEventListener('change',e=>{const input=e.target as HTMLInputElement,file=input.files?.[0];if(file)void importSkin(file);input.value='';});
$<HTMLInputElement>('skin-colors').addEventListener('change',e=>renderer.options.skinColors=(e.target as HTMLInputElement).checked);
$<HTMLInputElement>('skin-sounds').addEventListener('change',e=>{sounds.preferSkin=(e.target as HTMLInputElement).checked;sounds.reset(clock.time());});
$<HTMLInputElement>('cursor-size').addEventListener('input',e=>{const size=Number((e.target as HTMLInputElement).value)/100;renderer.options.cursorScale=size;$('cursor-size-value').textContent=size.toFixed(2)+'×';});
$('import-button').addEventListener('click',()=>$<HTMLInputElement>('file-input').click());
$<HTMLInputElement>('file-input').addEventListener('change',e=>{const file=(e.target as HTMLInputElement).files?.[0];if(file)void loadLocal(file);(e.target as HTMLInputElement).value='';});
$<HTMLSelectElement>('difficulty').addEventListener('change',async e=>{if(busy)return;setBusy(true,'正在切换难度…');try{await selectDifficulty((e.target as HTMLSelectElement).value);}catch(error){status((error as Error).message,'error');}finally{setBusy(false);syncPlay();}});
$('play').addEventListener('click',()=>void togglePlay());$('playfield').addEventListener('click',()=>void togglePlay());$('pause-overlay').addEventListener('click',()=>void togglePlay());
$('rewind').addEventListener('click',()=>seek(clock.time()-5000));$('forward').addEventListener('click',()=>seek(clock.time()+5000));
$<HTMLInputElement>('seek').addEventListener('input',e=>seek(Number((e.target as HTMLInputElement).value)));
document.querySelectorAll<HTMLButtonElement>('[data-rate]').forEach(button=>button.addEventListener('click',()=>{practiceRate=Number(button.dataset.rate);updateModPlayback();sounds.reset(clock.time());syncStats();document.querySelectorAll('[data-rate]').forEach(b=>{const selected=(b as HTMLElement).dataset.rate===button.dataset.rate;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});}));
for(const [id,key] of [['snake-in','snakeIn'],['snake-out','snakeOut']] as const)$<HTMLInputElement>(id).addEventListener('change',e=>renderer.options[key]=(e.target as HTMLInputElement).checked);
$<HTMLInputElement>('blinds-hp').addEventListener('input',e=>{const n=Number((e.target as HTMLInputElement).value);renderer.options.blindsHP=n/100;$('blinds-hp-value').textContent=n+'%';});
$<HTMLInputElement>('cursor').addEventListener('change',e=>renderer.options.cursor=(e.target as HTMLInputElement).checked);
$<HTMLInputElement>('grid').addEventListener('change',e=>renderer.options.grid=(e.target as HTMLInputElement).checked);
for(const name of ['dim','volume','hit-volume'])$<HTMLInputElement>(name).addEventListener('input',e=>{const n=Number((e.target as HTMLInputElement).value);$(`${name}-value`).textContent=n+'%';if(name==='dim')renderer.options.dim=n/100;else if(name==='volume'){musicVolume=n/100;updateModPlayback();}else sounds.volume=n/100;});
$<HTMLInputElement>('offset').addEventListener('input',e=>renderer.options.offset=clamp(Number((e.target as HTMLInputElement).value)||0,-300,300));
$('sound-toggle').addEventListener('click',()=>{sounds.enabled=!sounds.enabled;sounds.reset(clock.time());$('sound-toggle').textContent='打击音 '+(sounds.enabled?'ON':'OFF');$('sound-toggle').setAttribute('aria-pressed',String(sounds.enabled));});
$('mark-a').addEventListener('click',markA);$('mark-b').addEventListener('click',markB);$('clear-loop').addEventListener('click',()=>{loopA=loopB=null;updateLoop();});
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('.player-panel')!.requestFullscreen();}catch{toast('当前浏览器不允许全屏。');}}
$('fullscreen').addEventListener('click',()=>void fullscreen());
$('share').addEventListener('click',async()=>{if(!map||!archiveId)return;try{await navigator.clipboard.writeText(deployment.share(location.origin,previewQuery(map.id,clock.time(),renderer.options.mods,practiceRate)));toast('已复制预览链接（对方需能访问当前服务）');}catch{toast('浏览器未允许复制，请复制地址栏链接。');}});
document.addEventListener('keydown',e=>{const target=e.target as HTMLElement;if(document.querySelector('dialog[open]')||target.closest('input,select,textarea,button')||e.ctrlKey||e.metaKey||e.altKey)return;if(e.code==='Space'){e.preventDefault();void togglePlay();}else if(e.key==='ArrowLeft'){e.preventDefault();seek(clock.time()-5000);}else if(e.key==='ArrowRight'){e.preventDefault();seek(clock.time()+5000);}else if(e.key.toLowerCase()==='f')void fullscreen();else if(e.key==='[')markA();else if(e.key===']')markB();});
document.addEventListener('dragover',e=>{e.preventDefault();$('stage').classList.add('drag-over');});document.addEventListener('dragleave',e=>{if(!e.relatedTarget)$('stage').classList.remove('drag-over');});document.addEventListener('drop',e=>{e.preventDefault();$('stage').classList.remove('drag-over');const file=e.dataTransfer?.files[0];if(file){if(/\.osk$/i.test(file.name))void importSkin(file);else void loadLocal(file);}});
clock.onEnd=()=>{sounds.reset(clock.duration);syncPlay();};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&clock.playing){clock.pause();sounds.reset(clock.time());syncPlay();}});
function tick(now:number){
  frame=requestAnimationFrame(tick);
  if(map&&clock.playing){if(loopA!==null&&loopB!==null&&clock.time()>=loopB)seek(loopA);else if(clock.time()>=clock.duration){clock.pause();sounds.reset(clock.duration);syncPlay();}}
  // Audio scheduling stays off the DOM update path.
  updateModPlayback();sounds.tick(clock);renderer.scene?.sync(clock.time()+renderer.options.offset,clock.rate,clock.playing);renderer.draw(clock.time());fpsFrames++;
  if(now-fpsStart>=1000){renderer.fps=Math.round(fpsFrames*1000/(now-fpsStart));fpsFrames=0;fpsStart=now;}
  if(now-lastUI>100){lastUI=now;syncStats();const time=clock.time();$('current-time').textContent=format(time);$<HTMLInputElement>('seek').value=String(Math.round(time));$('seek').setAttribute('aria-valuetext',format(time));$('fps').textContent=map?(clock.playing?`${renderer.fps||'—'} FPS · ${renderer.drawMs.toFixed(1)} ms`:'PAUSED · CANVAS 2D'):'CANVAS 2D';if(map)$('stage-objects').textContent=`${upperBound(map.objects,time)} / ${map.objects.length} OBJECTS`;}
  if(now-lastDensity>100){lastDensity=now;drawDensity();}
}
frame=requestAnimationFrame(tick);
window.addEventListener('beforeunload',()=>{cancelAnimationFrame(frame);clock.dispose();void sounds.dispose();renderer.scene?.dispose();search.dispose();renderer.destroy();worker.terminate();clearAssets();});
const params=new URLSearchParams(location.search),initial=params.get('b');if(initial)void loadOnline(initial).then(()=>{setMods(restoreMods(params));syncMods();practiceRate=clamp(Number(params.get('r'))||1,.5,2);document.querySelectorAll<HTMLButtonElement>('[data-rate]').forEach(b=>{const selected=Number(b.dataset.rate)===practiceRate;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});updateModPlayback();const time=Number(params.get('t'));if(Number.isFinite(time)&&time>0)seek(time);});
let preferredSkin='default';try{preferredSkin=localStorage.getItem('orbit.skin.mode')||'default';}catch{}
$<HTMLSelectElement>('skin-select').value=preferredSkin;void selectSkin(preferredSkin);
