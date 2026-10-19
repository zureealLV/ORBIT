import {csv} from './parser';
import {clamp} from './types';

export type CommandKind='F'|'M'|'MX'|'MY'|'S'|'V'|'R'|'C'|'P';
export interface SBCommand {start:number;end:number;ease:number;from:number[];to:number[];parameter?:string}
export interface SBLoop {start:number;count:number;duration:number}
export interface SBTrack {kind:CommandKind;commands:SBCommand[];loop?:SBLoop}
export interface SBSprite {path:string;layer:number;origin:string;x:number;y:number;animated:boolean;frames:number;delay:number;once:boolean;start:number;end:number;tracks:SBTrack[];order:number}
export interface Storyboard {sprites:SBSprite[];warnings:string[];end:number;widescreen:boolean}
export const assetPath=(path:string)=>path.replace(/\\/g,'/').replace(/^\.\//,'').toLowerCase();
export const safeAsset=(path:string)=>!!path&&!path.includes('\0')&&!/^(\/|[a-z]+:)/i.test(assetPath(path))&&!assetPath(path).split('/').includes('..');
const n=(s:string|undefined,fallback=0)=>s!==undefined&&s!==''&&Number.isFinite(Number(s))?Number(s):fallback;
const layers=['Background','Fail','Pass','Foreground','Overlay'];

/** Parse inline Events first, then shared OSB. No evaluation of script text. */
export function parseStoryboard(sources:string[]):Storyboard {
  const result:Storyboard={sprites:[],warnings:[],end:0,widescreen:false},warnings=new Set<string>();let commandCount=0;
  for(const source of sources){
    if(source.length>16*1048576)throw new Error('故事板脚本超过 16 MB');
    const variables=new Map<string,string>();let section='',sprite:SBSprite|undefined,loop:SBLoop|undefined,skipDepth=Infinity;
    for(const raw of source.replace(/^\uFEFF/,'').split(/\r?\n/)){
      let line=raw.trim();if(!line||line.startsWith('//'))continue;
      if(/^\[.+\]$/.test(line)){section=line.slice(1,-1);continue;}
      if(section==='General'&&/^WidescreenStoryboard\s*:/.test(line)){result.widescreen=line.split(':')[1]?.trim()==='1';continue;}
      if(section==='Variables'){const at=line.indexOf('=');if(at>0)variables.set(line.slice(0,at),line.slice(at+1));continue;}
      if(section!=='Events')continue;
      line=line.replace(/\$[\w]+/g,key=>variables.get(key)??key);
      const depth=raw.match(/^[ _\t]*/)?.[0].length??0,p=csv(line.replace(/^_+/,'' )).map(s=>s.trim()),kind=p[0];
      if(!depth){
        loop=undefined;skipDepth=Infinity;sprite=undefined;
        if(kind==='Sample'||kind==='5'){warnings.add('故事板 Sample 音频暂未混音');continue;}
        if(!['Sprite','Animation','4','6'].includes(kind))continue;
        if(result.sprites.length>=20000)throw new Error('故事板精灵超过 20,000');
        if(!safeAsset(p[3])){warnings.add('已跳过不安全的故事板资源路径');continue;}
        const layer=/^\d$/.test(p[1])?Number(p[1]):layers.indexOf(p[1]);
        if(layer<0||layer>4){warnings.add('已跳过未知故事板图层');continue;}
        sprite={path:p[3],layer,origin:p[2],x:n(p[4],320),y:n(p[5],240),animated:kind==='Animation'||kind==='6',frames:kind==='Animation'||kind==='6'?clamp(Math.floor(n(p[6],1)),1,512):1,delay:Math.max(1,n(p[7],100)),once:p[8]==='LoopOnce'||p[8]==='1',start:Infinity,end:-Infinity,tracks:[],order:result.sprites.length};result.sprites.push(sprite);continue;
      }
      if(!sprite)continue;
      if(depth>skipDepth)continue;skipDepth=Infinity;
      if(depth<=1)loop=undefined;
      if(kind==='T'){warnings.add('T 条件触发器暂未模拟');skipDepth=depth;continue;}
      if(kind==='L'){
        if(depth>1){warnings.add('嵌套循环暂未模拟');skipDepth=depth;continue;}
        loop={start:n(p[1]),count:clamp(Math.floor(n(p[2],1)),1,100000),duration:0};continue;
      }
      if(!['F','M','MX','MY','S','V','R','C','P'].includes(kind)){warnings.add(`未知故事板命令 ${kind}`);continue;}
      const ease=clamp(Math.floor(n(p[1])),0,34),start=n(p[2]),end=Math.max(start,n(p[3],start));
      const dims=kind==='M'||kind==='V'?2:kind==='C'?3:1;
      let track=sprite.tracks.find(t=>t.kind===kind&&t.loop===loop);if(!track){track={kind:kind as CommandKind,commands:[],loop};sprite.tracks.push(track);}
      if(kind==='P'){
        if(!['H','V','A'].includes(p[4])){warnings.add('未知故事板参数');continue;}
        if(++commandCount>250000)throw new Error('故事板命令超过 250,000');
        track.commands.push({start,end,ease,from:[],to:[],parameter:p[4]});if(loop)loop.duration=Math.max(loop.duration,end);continue;
      }
      const values=p.slice(4).map(v=>n(v)),groups=Math.floor(values.length/dims);if(!groups)continue;
      for(let i=0;i<Math.max(1,groups-1);i++){
        if(++commandCount>250000)throw new Error('故事板命令超过 250,000');
        const a=start+i*(end-start),b=end+i*(end-start),from=values.slice(i*dims,(i+1)*dims),to=groups===1?from:values.slice((i+1)*dims,(i+2)*dims);
        track.commands.push({start:a,end:b,ease,from,to});if(loop)loop.duration=Math.max(loop.duration,b);
      }
    }
  }
  for(const sprite of result.sprites){
    for(const loop of new Set(sprite.tracks.map(t=>t.loop).filter((l):l is SBLoop=>!!l))){
      const commands=sprite.tracks.filter(t=>t.loop===loop).flatMap(t=>t.commands);
      let first=Infinity,last=-Infinity;for(const c of commands){first=Math.min(first,c.start);last=Math.max(last,c.end);}
      loop.duration=commands.length?Math.max(0,last-first):0;
    }
    for(const track of sprite.tracks){track.commands.sort((a,b)=>a.start-b.start);for(const c of track.commands){const start=(track.loop?.start??0)+c.start,end=(track.loop?.start??0)+(track.loop?track.loop.duration*(track.loop.count-1):0)+c.end;sprite.start=Math.min(sprite.start,start);sprite.end=Math.max(sprite.end,end);}}
    result.end=Math.max(result.end,Number.isFinite(sprite.end)?sprite.end:0);
  }
  if(result.sprites.some(s=>s.start<0))warnings.add('负时间片头从 0ms 开始预览');
  result.warnings=[...warnings];return result;
}

function bounce(x:number):number {const a=7.5625,b=2.75;if(x<1/b)return a*x*x;if(x<2/b)return a*(x-=1.5/b)*x+.75;if(x<2.5/b)return a*(x-=2.25/b)*x+.9375;return a*(x-=2.625/b)*x+.984375;}
export function easing(id:number,x:number):number {
  x=clamp(x,0,1);if(x===0||x===1)return x;
  if(id===0)return x;if(id===1)id=4;if(id===2)id=3;
  if(id>=3&&id<=14){const power=2+Math.floor((id-3)/3),mode=(id-3)%3;return mode===0?x**power:mode===1?1-(1-x)**power:x<.5?(2*x)**power/2:1-(2-2*x)**power/2;}
  switch(id){
    case 15:return 1-Math.cos(x*Math.PI/2);case 16:return Math.sin(x*Math.PI/2);case 17:return (1-Math.cos(Math.PI*x))/2;
    case 18:return 2**(10*x-10);case 19:return 1-2**(-10*x);case 20:return x<.5?2**(20*x-10)/2:(2-2**(-20*x+10))/2;
    case 21:return 1-Math.sqrt(1-x*x);case 22:return Math.sqrt(1-(x-1)**2);case 23:return x<.5?(1-Math.sqrt(1-(2*x)**2))/2:(Math.sqrt(1-(-2*x+2)**2)+1)/2;
    case 24:return -(2**(10*x-10))*Math.sin((x*10-10.75)*2*Math.PI/3);
    case 25:return 2**(-10*x)*Math.sin((x*10-.75)*2*Math.PI/3)+1;
    case 26:return 2**(-10*x)*Math.sin((x*5-.75)*2*Math.PI/3)+1;
    case 27:return 2**(-10*x)*Math.sin((x*2.5-.75)*2*Math.PI/3)+1;
    case 28:return x<.5?-(2**(20*x-10)*Math.sin((20*x-11.125)*2*Math.PI/4.5))/2:2**(-20*x+10)*Math.sin((20*x-11.125)*2*Math.PI/4.5)/2+1;
    case 29:return 2.70158*x*x*x-1.70158*x*x;
    case 30:return 1+2.70158*(x-1)**3+1.70158*(x-1)**2;
    case 31:{const c=1.70158*1.525;return x<.5?(2*x)**2*((c+1)*2*x-c)/2:((2*x-2)**2*((c+1)*(x*2-2)+c)+2)/2;}
    case 32:return 1-bounce(1-x);case 33:return bounce(x);case 34:return x<.5?(1-bounce(1-2*x))/2:(1+bounce(2*x-1))/2;
    default:return x;
  }
}
export interface SpriteState {x:number;y:number;alpha:number;sx:number;sy:number;rotation:number;color:number[];flipH:boolean;flipV:boolean;additive:boolean}
/** Pure random-access evaluation: seek/backward/loop never depends on previous frames. */
export function spriteState(sprite:SBSprite,time:number):SpriteState|null {
  if(time<sprite.start||time>sprite.end||sprite.layer===1)return null;
  const state:SpriteState={x:sprite.x,y:sprite.y,alpha:1,sx:1,sy:1,rotation:0,color:[255,255,255],flipH:false,flipV:false,additive:false};
  const selected=new Map<string,{at:number;order:number;value:number}>();
  const set=(key:string,value:number,at:number,order:number)=>{const previous=selected.get(key);if(!previous||at>previous.at||at===previous.at&&order>=previous.order)selected.set(key,{at,order,value});};
  sprite.tracks.forEach((track,order)=>{
    const cmds=track.commands;if(!cmds.length)return;let local=time,base=0;
    if(track.loop){const loop=track.loop;const iteration=loop.duration>0?clamp(Math.floor((time-loop.start-cmds[0].start)/loop.duration),0,loop.count-1):0;base=loop.start+iteration*loop.duration;local=time-base;}
    if(track.kind==='P'){for(const c of cmds)if(local>=c.start)set(`p${c.parameter}`,c.start===c.end||local<c.end?1:0,base+c.start,order);return;}
    let lo=0,hi=cmds.length;while(lo<hi){const m=(lo+hi)>>1;if(cmds[m].start<=local)lo=m+1;else hi=m;}
    const c=cmds[Math.max(0,lo-1)],at=local<c.start?-1e15-base-c.start:base+c.start,p=local<c.start?0:c.end===c.start?1:easing(c.ease,(local-c.start)/(c.end-c.start));
    const v=c.from.map((a,i)=>a+(c.to[i]-a)*p);
    switch(track.kind){case 'F':set('alpha',v[0],at,order);break;case 'M':set('x',v[0],at,order);set('y',v[1],at,order);break;case 'MX':set('x',v[0],at,order);break;case 'MY':set('y',v[0],at,order);break;case 'S':set('sx',v[0],at,order);set('sy',v[0],at,order);break;case 'V':set('sx',v[0],at,order);set('sy',v[1],at,order);break;case 'R':set('rotation',v[0],at,order);break;case 'C':v.forEach((value,i)=>set(`c${i}`,value,at,order));break;}
  });
  for(const [key,{value}]of selected){if(key[0]==='c'&&/^c\d$/.test(key))state.color[Number(key[1])]=clamp(value,0,255);else if(key==='pH')state.flipH=!!value;else if(key==='pV')state.flipV=!!value;else if(key==='pA')state.additive=!!value;else (state as unknown as Record<string,number>)[key]=value;}
  state.alpha=clamp(state.alpha,0,1);return state;
}
export function framePath(sprite:SBSprite,time:number):string {
  if(!sprite.animated)return assetPath(sprite.path);
  let frame=Math.max(0,Math.floor((time-sprite.start)/sprite.delay));frame=sprite.once?Math.min(sprite.frames-1,frame):frame%sprite.frames;
  return assetPath(sprite.path.replace(/(\.[^.]+)$/,`${frame}$1`));
}
export function storyboardAssets(scene:Storyboard):string[]{const paths=new Set<string>();const add=(path:string)=>{paths.add(path);if(paths.size>2048)throw new Error('故事板资源超过 2,048 张');};for(const s of scene.sprites){if(!s.animated)add(assetPath(s.path));else for(let i=0;i<s.frames;i++)add(assetPath(s.path.replace(/(\.[^.]+)$/,`${i}$1`)));}return [...paths];}
