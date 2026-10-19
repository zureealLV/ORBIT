import {clamp,difficulty,lerp,type Beatmap,type HitObject,type Point,type VisualMods} from './types';
export type ModStatus='preview'|'approx'|'context'|'pending';
export interface ModDefinition {code:string;name:string;category:string;status:ModStatus;description:string;stable?:boolean}
const rows:[string,string,string,ModStatus,string,boolean?][]=[
  ['EZ','Easy','降难','preview','AR / CS / OD / HP 减半。',true],
  ['NF','No Fail','降难','context','不失败；Auto 预览本身没有失败，未实现手动判定。',true],
  ['HT','Half Time','降难','preview','0.75×，保持音高；与 DT / NC / DC 互斥。',true],
  ['DC','Daycore','降难','preview','0.75×，随速度降低音乐音高。'],
  ['HR','Hard Rock','增难','preview','难度提升与纵向翻转；与 EZ / MR 互斥。',true],
  ['SD','Sudden Death','增难','context','MISS 后失败；Auto 全中场景无触发条件，未实现判定。',true],
  ['PF','Perfect','增难','context','非满分后重开；Auto 全中场景无触发条件，未实现判定。',true],
  ['DT','Double Time','增难','preview','1.5×，保持音高，显示等效 AR / OD / BPM。',true],
  ['NC','Nightcore','增难','approx','1.5× 升调 + 合成节拍鼓；不使用游戏原始鼓音。',true],
  ['HD','Hidden','增难','approx','圆圈提前淡出、隐藏缩圈；滑条轨道单独淡出。',true],
  ['TC','Traceable','增难','approx','隐藏圈体和数字，保留缩圈与滑条轮廓。'],
  ['FL','Flashlight','增难','approx','延迟跟随 Auto 光标的手电筒，按 Auto 连击缩小。',true],
  ['BL','Blinds','增难','approx','左右遮挡；按设置中的预览 HP 模拟，非真实血量。'],
  ['ST','Strict Tracking','增难','context','滑条跟随判定更严格；Auto 始终跟随，不模拟失误。'],
  ['AC','Accuracy Challenge','增难','context','要求指定准确率；没有真实判定，不模拟失败。'],
  ['DA','Difficulty Adjust','转换','preview','独立设置 AR / CS / OD / HP。'],
  ['CL','Classic','转换','context','经典判定 / note lock / HP；未实现手动计分。'],
  ['RD','Random','转换','pending','尚未移植官方角度、分段和滑条保形转谱，禁用而非随机乱撒点。'],
  ['MR','Mirror','转换','preview','水平 / 垂直 / 双轴镜像，包含堆叠、滑条和 Auto。'],
  ['AL','Alternate','转换','context','强制交替按键；当前没有玩家按键判定。'],
  ['SG','Single Tap','转换','context','强制单键；当前没有玩家按键判定。'],
  ['TP','Target Practice','转换','pending','会重建整张目标训练谱；尚未移植，不能用画靶圈冒充。',true],
  ['AT','Autoplay','自动','context','本工具始终为 Auto 演示，不是可交互的 AT 成绩。',true],
  ['CN','Cinema','自动','preview','stable 称 CM：隐藏物件和光标、背景不暗化；故事板 / 视频尚不渲染。',true],
  ['RX','Relax','自动','context','自动点击但需玩家移动；本工具不提供手动移动判定。',true],
  ['AP','Autopilot','自动','context','自动移动但需玩家按键；本工具不提供手动按键判定。',true],
  ['SO','Spun Out','自动','context','自动转盘；Auto 预览已自动旋转，不模拟计分惩罚。',true],
  ['TR','Transform','趣味','approx','物件从旋转偏移处移动到目标，确定性视觉近似。'],
  ['WG','Wiggle','趣味','approx','100 ms 随机小幅抖动；使用自有确定性随机函数。'],
  ['SI','Spin In','趣味','approx','旋转 / 压扁入场并隐藏缩圈。'],
  ['GR','Grow','趣味','approx','物件从 0.5× 放大到正常大小。'],
  ['DF','Deflate','趣味','approx','物件从 2× 缩小到正常大小。'],
  ['WU','Wind Up','趣味','approx','从 1× 到 1.5× 逐渐加速；显示当前等效难度。'],
  ['WD','Wind Down','趣味','approx','从 1× 到 0.75× 逐渐减速。'],
  ['BR','Barrel Roll','趣味','approx','游戏区域和 Auto 光标持续旋转；数字朝向为近似。'],
  ['AD','Approach Different','趣味','approx','默认 Gravity 风格非线性缩圈；未覆盖所有动画参数。'],
  ['MU','Muted','趣味','approx','音乐随 Auto 连击淡出；打击音仍保留。'],
  ['NS','No Scope','趣味','approx','达到 10 连击隐藏光标；休息 / 转盘显示。'],
  ['MG','Magnetised','趣味','pending','依赖玩家实时光标和磁力输入处理，Auto 不能验证。'],
  ['RP','Repel','趣味','pending','依赖玩家实时光标排斥输入，未实现。'],
  ['AS','Adaptive Speed','趣味','pending','速度依赖真实准确率反馈；不伪造准确率驱动。'],
  ['FR','Freeze Frame','趣味','approx','同一 Combo 提前一同出现，缩圈保留各自命中时间。'],
  ['BU','Bubbles','趣味','approx','命中后留下扩张并淡出的气泡；自写视觉效果。'],
  ['SY','Synesthesia','趣味','approx','按音符节拍分度着色，覆盖原 Combo 色。'],
  ['DP','Depth','趣味','approx','从远处向平面投影；滑条深度减速为近似。'],
  ['BM','Bloom','趣味','approx','Auto 连击达到 50 时光标放大至 10×。'],
  ['TD','Touch Device','系统','context','系统输入标记；不改变本工具画面，不代表模拟触屏。',true],
  ['SV2','Score V2','系统','context','计分算法标记；没有分数模拟，不伪造 ScoreV2。',true],
];
export const MODS:ModDefinition[]=rows.map(([code,name,category,status,description,stable])=>({code,name,category,status,description,stable}));
export const modOn=(mods:VisualMods,code:string)=>code==='HR'?mods.hr:code==='EZ'?mods.ez:code==='HD'?mods.hd:!!mods.active?.includes(code);
export const defaultMods=():VisualMods=>({hr:false,ez:false,hd:false,active:[],mirror:'horizontal',strength:1,seed:1,speed:1.5});
const conflicts=[['EZ','HR','DA'],['HR','MR'],['HT','DC','DT','NC','WU','WD','AS'],['SD','PF','NF'],['HD','TC','SI','FR'],['TC','AD','DP'],['FL','BL','BM'],['BM','NS'],['GR','DF','SI'],['DP','SI','WG','TR','FR'],['TR','WG','FR'],['BR','BU'],['AL','SG'],['CL','ST'],['AT','RX','AP','CN']];
export function toggleMod(current:VisualMods,code:string):VisualMods {
  const definition=MODS.find(m=>m.code===code);if(!definition||definition.status==='pending')return current;
  const next={...current,active:[...(current.active??[])]};
  const set=(key:string,on:boolean)=>{if(['HR','EZ','HD'].includes(key))next[key.toLowerCase() as 'hr'|'ez'|'hd']=on;next.active=next.active!.filter(c=>c!==key);if(on)next.active!.push(key);};
  const on=!modOn(current,code);if(on)for(const group of conflicts)if(group.includes(code))for(const other of group)if(other!==code)set(other,false);
  set(code,on);return next;
}
export function modSpeed(mods:VisualMods,time=0,duration=1){
  if(modOn(mods,'DT')||modOn(mods,'NC'))return clamp(mods.speed??1.5,.5,2);
  if(modOn(mods,'HT')||modOn(mods,'DC'))return .75;
  if(modOn(mods,'WU'))return 1+.5*clamp(time/Math.max(1,duration),0,1);
  if(modOn(mods,'WD'))return 1-.25*clamp(time/Math.max(1,duration),0,1);
  return 1;
}
export function effectiveStats(map:Beatmap,mods:VisualMods,rate:number){
  const d=difficulty(map,mods),ms=d.preempt/rate;
  return {...d,effectiveAR:ms>1200?(1800-ms)/120:5+(1200-ms)/150,effectiveOD:(80-(80-6*d.od)/rate)/6,bpm:map.bpm*rate};
}
const random=(n:number)=>{const x=Math.sin(n*12.9898+78.233)*43758.5453;return x-Math.floor(x);};
export function objectMotion(o:HitObject,time:number,preempt:number,mods:VisualMods){
  const remaining=clamp((o.time-time)/preempt,0,1),strength=mods.strength??1;
  let x=0,y=0,scale=1,rotation=0,scaleY=1;
  if(modOn(mods,'WG')){const k=Math.floor(time/100),t=(time-k*100)/100,seed=o.time+(mods.seed??1);const sample=(i:number)=>({x:(random(seed+i*2)-.5)*14*strength,y:(random(seed+i*2+1)-.5)*14*strength});const p=lerp(sample(k),sample(k+1),t);x+=p.x;y+=p.y;}
  if(modOn(mods,'TR')){const angle=o.id*.42+remaining*Math.PI,amount=preempt*.3*remaining*remaining;x+=Math.cos(angle)*amount;y+=Math.sin(angle)*amount;}
  if(modOn(mods,'GR'))scale*=1-.5*remaining;
  if(modOn(mods,'DF'))scale*=1+remaining;
  if(modOn(mods,'SI')){const ease=(1-Math.cos((1-remaining)*Math.PI))/2;rotation=(1-ease)*Math.PI*2;scale=o.kind==='slider'?Math.max(.001,ease):2-ease;scaleY=o.kind==='slider'?1:Math.max(.001,ease/scale);}
  return {x,y,scale,rotation,scaleY};
}
export function motionPoint(point:Point,o:HitObject,map:Beatmap,time:number,mods:VisualMods):Point {
  const d=difficulty(map,mods),m=objectMotion(o,time,d.preempt,mods);let p={x:point.x+m.x,y:point.y+m.y};
  if(modOn(mods,'DP')){const depth=clamp((o.time-time)/d.preempt*100,-50,100),scale=200/(200+depth);p={x:256+(p.x-256)*scale,y:192+(p.y-192)*scale};}
  return p;
}
