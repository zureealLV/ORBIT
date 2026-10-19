import { unzipSync, strFromU8 } from 'fflate';

export interface SkinConfig {
  name:string;author:string;version:string;fps:number;
  combos:string[];sliderBorder:string;sliderTrack?:string;
  fontPrefix:string;fontOverlap:number;overlayAbove:boolean;
  cursorCentre:boolean;cursorRotate:boolean;cursorExpand:boolean;
  sliderBallTint:boolean;sliderBallFlip:boolean;layeredSounds:boolean;
}
export interface SkinFile {name:string;bytes:Uint8Array}
export interface SkinArchive {config:SkinConfig;files:SkinFile[]}
export const normalizeSkinPath=(name:string)=>name.replace(/\\/g,'/').replace(/^\.\//,'').toLowerCase();
export function safeSkinPath(name:string){const n=normalizeSkinPath(name);return !n.startsWith('/')&&!/^[a-z]:/.test(n)&&!n.split('/').includes('..');}
const color=(value:string|undefined)=>{
  if(!value)return undefined;const parts=value.split(',').map(v=>Number(v.trim()));
  return parts.length===3&&parts.every(n=>Number.isFinite(n)&&n>=0&&n<=255)?`rgb(${parts.map(Math.round).join(',')})`:undefined;
};
export function parseSkinIni(source:string):SkinConfig {
  const sections:Record<string,Record<string,string>>=Object.create(null);let section='';
  for(const raw of source.replace(/^\uFEFF/,'').split(/[\r\n]+/)){
    const line=raw.replace(/\/\/.*$/,'').trim();if(!line)continue;
    if(/^\[.*\]$/.test(line)){section=line.slice(1,-1).toLowerCase();sections[section]??=Object.create(null);continue;}
    const colon=line.indexOf(':');if(colon<0||!section)continue;
    sections[section][line.slice(0,colon).trim().toLowerCase()]=line.slice(colon+1).trim();
  }
  const general=sections.general??{},colours=sections.colours??{},fonts=sections.fonts??{};
  const bool=(key:string,fallback:boolean)=>general[key]===undefined?fallback:general[key]==='1';
  const number=(value:string|undefined,fallback:number,min:number,max:number)=>value!==undefined&&Number.isFinite(Number(value))?Math.max(min,Math.min(max,Number(value))):fallback;
  const combos=Array.from({length:8},(_,i)=>color(colours[`combo${i+1}`])).filter((c):c is string=>!!c);
  // Legacy osu! starts with Combo2 and wraps back to Combo1.
  if(combos.length>1)combos.push(combos.shift()!);
  const prefix=normalizeSkinPath(fonts.hitcircleprefix||'default');
  return {
    name:(general.name||'Unnamed skin').slice(0,160),author:(general.author||'Unknown').slice(0,100),version:general.version||'latest',
    fps:number(general.animationframerate,60,1,240),combos,
    sliderBorder:color(colours.sliderborder)||'rgb(255,255,255)',sliderTrack:color(colours.slidertrackoverride),
    fontPrefix:safeSkinPath(prefix)?prefix:'default',fontOverlap:number(fonts.hitcircleoverlap,-2,-128,128),
    overlayAbove:bool('hitcircleoverlayabovenumber',bool('hitcircleoverlayabovenumer',true)),
    cursorCentre:bool('cursorcentre',true),cursorRotate:bool('cursorrotate',true),cursorExpand:bool('cursorexpand',true),
    sliderBallTint:bool('allowsliderballtint',false),sliderBallFlip:bool('sliderballflip',true),layeredSounds:bool('layeredhitsounds',true),
  };
}
export function chooseSkinImage(names:string[],stem:string){
  const normalized=new Map(names.map(name=>[normalizeSkinPath(name),name]));
  const hd=normalized.get(`${stem.toLowerCase()}@2x.png`),sd=normalized.get(`${stem.toLowerCase()}.png`);
  return hd?{name:hd,scale:2}:sd?{name:sd,scale:1}:undefined;
}
export function unpackSkinArchive(bytes:Uint8Array):SkinArchive {
  if(bytes.byteLength>128*1048576)throw new Error('皮肤包超过 128 MB 上限。');
  let count=0,expanded=0,iniExpanded=0;
  // First inspect only skin.ini; unsupported executables/text are never run or interpreted.
  const configs=unzipSync(bytes,{filter:file=>{
    if(++count>4096)throw new Error('皮肤文件数超过 4096。');
    if(!safeSkinPath(file.name))throw new Error('皮肤包含不安全路径。');
    if(!/(^|\/)skin\.ini$/i.test(file.name))return false;
    if(file.originalSize>256*1024||(iniExpanded+=file.originalSize)>1048576)throw new Error('skin.ini 过大。');return true;
  }});
  const ini=Object.keys(configs).sort((a,b)=>a.length-b.length)[0];
  if(!ini)throw new Error('皮肤中没有 skin.ini。');
  const config=parseSkinIni(strFromU8(configs[ini])),parent=ini.includes('/')?ini.slice(0,ini.lastIndexOf('/')+1):'';
  const roots=/^(hitcircle(?:overlay)?|approachcircle|followpoint(?:-\d+)?|hit300(?:-\d+)?|slider(?:startcircle(?:overlay)?|endcircle(?:overlay)?|followcircle(?:-\d+)?|b\d*|scorepoint)|reversearrow|cursor(?:trail|middle)?|spinner-(?:circle|background|approachcircle|spin|clear|bottom|top|middle|middle2|glow))(@2x)?\.png$/i;
  const images=unzipSync(bytes,{filter:file=>{
    const relative=normalizeSkinPath(file.name).slice(normalizeSkinPath(parent).length);
    if(!normalizeSkinPath(file.name).startsWith(normalizeSkinPath(parent)))return false;
    const font=relative.startsWith(config.fontPrefix+'-')&&/\d(@2x)?\.png$/i.test(relative);
    const sample=/^(normal|soft|drum)-(hitnormal|hitclap|hitfinish|hitwhistle|slidertick)\.(wav|ogg|mp3)$/i.test(relative);
    if(!(roots.test(relative)||font||sample))return false;
    if(file.originalSize>8*1048576||(expanded+=file.originalSize)>64*1048576)throw new Error('皮肤游玩素材超过大小限制。');return true;
  }});
  const files=Object.entries(images).map(([name,bytes])=>({name:normalizeSkinPath(name.slice(parent.length)),bytes}));
  if(files.length>300)throw new Error('皮肤游玩素材过多。');
  if(!chooseSkinImage(files.map(f=>f.name),'hitcircle'))throw new Error('皮肤缺少 hitcircle.png / @2x 素材。');
  return {config,files};
}
