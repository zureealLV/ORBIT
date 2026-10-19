import type {BackgroundScene} from './scene';
import { autoPosition, displayPoint, objectPosition, upperBound,autoCombo } from './playback';
import { clamp, difficulty, type Beatmap, type HitObject, type Point, type VisualMods } from './types';
import {Skin,type SkinSprite} from '../skin/runtime';
import {modOn,objectMotion} from './mods';
import {SliderTextures,sliderRange,sliceSlider} from './slider';
import {timingAt} from './parser';

export interface RenderOptions { mods: VisualMods; dim: number; cursor: boolean; grid: boolean; trail: boolean; offset: number;skinColors:boolean;cursorScale:number;snakeIn:boolean;snakeOut:boolean;blindsHP:number }
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private map?: Beatmap;
  private bg?: HTMLImageElement;
  private w = 1280; private h = 800;
  private observer: ResizeObserver;
  private lastFrame = '';
  private sliderTextures=new SliderTextures();
  private appearances:{o:HitObject;appear:number;preempt:number;end:number}[]=[];
  private appearanceEnds:number[]=[];
  skin?:Skin;
  scene?:BackgroundScene;
  options: RenderOptions = { mods:{hr:false,ez:false,hd:false}, dim:0.82, cursor:true, grid:false, trail:true, offset:0,skinColors:true,cursorScale:1,snakeIn:true,snakeOut:true,blindsHP:1 };
  fps = 0; drawMs = 0;
  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', {alpha:false}); if (!ctx) throw new Error('浏览器不支持 Canvas 2D'); this.ctx = ctx;
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(canvas.parentElement!); this.resize();
  }
  private resize() {
    const rect = this.canvas.getBoundingClientRect(), ratio = Math.min(devicePixelRatio || 1, 1.75, 1800 / Math.max(1,rect.width));
    this.w = Math.max(1, Math.round(rect.width * ratio)); this.h = Math.max(1, Math.round(rect.height * ratio));
    this.canvas.width = this.w; this.canvas.height = this.h;
    this.lastFrame = '';
  }
  setMap(map: Beatmap, bg?: HTMLImageElement) {
    this.map = map; this.bg = bg;
    this.rebuildPaths();
  }
  rebuildPaths() {
    this.lastFrame = '';
    this.sliderTextures.clear();
    if (!this.map) return;
    const d=difficulty(this.map,this.options.mods);let groupStart=this.map.objects[0]?.time??0;
    this.appearances=this.map.objects.map(o=>{if(o.combo===1)groupStart=o.time;const preempt=d.preempt+(modOn(this.options.mods,'FR')&&o.kind!=='spinner'?o.time-groupStart:0);return {o,preempt,appear:o.time-preempt,end:o.end};}).sort((a,b)=>a.appear-b.appear||a.o.id-b.o.id);
    let maximum=-Infinity;this.appearanceEnds=this.appearances.map(e=>maximum=Math.max(maximum,e.end));

  }
  setSkin(skin?:Skin){this.skin=skin;this.lastFrame='';this.sliderTextures.clear();}
  private sprite(sprite:SkinSprite|undefined,p:Point,scale:number,rotation=0,flip=false){
    if(!sprite)return false;const c=this.ctx;c.save();c.translate(p.x,p.y);c.rotate(rotation);c.scale(flip?-1:1,1);
    const w=sprite.width*scale,h=sprite.height*scale;c.drawImage(sprite.image,-w/2,-h/2,w,h);c.restore();return true;
  }
  private comboColor(o:HitObject){
    if(modOn(this.options.mods,'SY')){
      const timing=timingAt(this.map!.timing,o.time),beat=((o.time-(timing.baseTime??timing.time))/timing.beat)%1;
      if(Math.abs(beat-Math.round(beat))<.015)return '#ffffff';
      if(Math.abs(beat-.5)<.015)return '#ff5555';
      if([.25,.75].some(v=>Math.abs(beat-v)<.015))return '#6688ff';
      if([1/3,2/3].some(v=>Math.abs(beat-v)<.015))return '#bb66ff';return '#ffe066';
    }
    const colors=this.options.skinColors&&this.skin?.config.combos.length?this.skin.config.combos:this.map!.colors;
    return colors[(o.colorIndex??o.color)%colors.length];
  }
  private number(value:number,p:Point,scale:number){
    const skin=this.skin!,digits=String(value).split('').map(d=>skin.sprite(`${skin.config.fontPrefix}-${d}`));
    if(digits.some(d=>!d)){this.ctx.fillStyle='#fff';this.ctx.font=`600 ${50*scale}px sans-serif`;this.ctx.textAlign='center';this.ctx.textBaseline='middle';this.ctx.fillText(String(value),p.x,p.y);return;}
    scale*=.8;const overlap=skin.config.fontOverlap*scale,total=digits.reduce((n,d)=>n+d!.width*scale,0)-overlap*(digits.length-1);
    let x=p.x-total/2;for(const digit of digits){this.sprite(digit,{x:x+digit!.width*scale/2,y:p.y},scale);x+=digit!.width*scale-overlap;}
  }
  private skinCircle(stem:string,overlay:string,p:Point,radius:number,color:string,number?:number){
    const skin=this.skin!,scale=radius/64,base=skin.sprite(stem)?stem:'hitcircle';
    this.sprite(skin.tint(base,color),p,scale);
    const top=skin.sprite(overlay)??(base==='hitcircle'?skin.sprite('hitcircleoverlay'):undefined);
    if(!skin.config.overlayAbove)this.sprite(top,p,scale);
    if(number!==undefined)this.number(number,p,scale);
    if(skin.config.overlayAbove)this.sprite(top,p,scale);
  }
  private ring(p: Point, radius: number, color: string, width = 1.5) {
    const c = this.ctx; c.beginPath(); c.arc(p.x,p.y,Math.max(0.1,radius),0,Math.PI*2); c.strokeStyle=color; c.lineWidth=width; c.stroke();
  }
  private disc(p: Point, radius: number, color: string) { const c=this.ctx; c.beginPath(); c.arc(p.x,p.y,Math.max(0.1,radius),0,Math.PI*2); c.fillStyle=color; c.fill(); }
  draw(time: number) {
    // A paused view does not repaint unchanged canvas pixels on every rAF.
    const key = `${time}|${JSON.stringify(this.options)}|${this.scene?.revision}|${this.scene?.videoEnabled}|${this.scene?.storyboardEnabled}`;
    if (key === this.lastFrame) return;
    this.lastFrame = key;
    const begin = performance.now(), c = this.ctx, map = this.map;
    c.setTransform(1,0,0,1,0,0); c.globalAlpha=1; c.fillStyle='#101218'; c.fillRect(0,0,this.w,this.h);
    if (this.bg && !this.scene?.hidesBackground(map?.background??'')) {
      const scale=Math.max(this.w/this.bg.width,this.h/this.bg.height), w=this.bg.width*scale,h=this.bg.height*scale;
      c.globalAlpha=1; c.drawImage(this.bg,(this.w-w)/2,(this.h-h)/2,w,h); c.globalAlpha=1;
    }
    const sceneTime=time+this.options.offset;
    this.scene?.drawVideo(c,sceneTime,this.w,this.h);
    this.scene?.draw(c,sceneTime,this.w,this.h);
    if(!modOn(this.options.mods,'CN')){c.fillStyle=`rgba(0,0,0,${this.options.dim})`;c.fillRect(0,0,this.w,this.h);}
    if(modOn(this.options.mods,'CN')){this.scene?.draw(c,sceneTime,this.w,this.h,true);this.drawMs=performance.now()-begin;return;}
    const scale=Math.min(this.w/640,this.h/480), ox=(this.w-512*scale)/2,oy=(this.h-384*scale)/2;
    c.setTransform(scale,0,0,scale,ox,oy);
    c.strokeStyle='rgba(211,219,247,0.07)';c.lineWidth=1/scale;
    if (this.options.grid || !map) {
      for(let x=0;x<=512;x+=32){c.beginPath();c.moveTo(x,0);c.lineTo(x,384);c.stroke();}
      for(let y=0;y<=384;y+=32){c.beginPath();c.moveTo(0,y);c.lineTo(512,y);c.stroke();}
    }
    // Four quiet playfield corners, no distracting full border.
    c.strokeStyle='rgba(211,219,247,0.24)';
    for (const [x,y,sx,sy] of [[0,0,1,1],[512,0,-1,1],[0,384,1,-1],[512,384,-1,-1]]) {c.beginPath();c.moveTo(x+sx*9,y);c.lineTo(x,y);c.lineTo(x,y+sy*9);c.stroke();}
    if (!map||modOn(this.options.mods,'CN')) { this.drawMs=performance.now()-begin; return; }
    const t=time+this.options.offset, d=difficulty(map,this.options.mods), cutoff=t-220;
    const mods=this.options.mods;
    if(modOn(mods,'BR')){c.translate(256,192);c.rotate(t/1000*Math.PI/15);c.translate(-256,-192);}
    if(modOn(mods,'BU')){const start=upperBound(map.objects,t-3000),end=upperBound(map.objects,t);for(let i=start;i<end;i++){const o=map.objects[i],age=t-o.end;if(age<0)continue;const p=displayPoint(objectPosition(o,o.end),o,map,mods);c.globalAlpha=.2*(1-age/3000);this.ring(p,d.radius*(1+age/350),this.comboColor(o),Math.max(1,6-age/600));}c.globalAlpha=1;}
    let lo=0,hi=this.appearanceEnds.length;
    while(lo<hi){const mid=(lo+hi)>>1;if(this.appearanceEnds[mid]<cutoff)lo=mid+1;else hi=mid;}
    // Legacy followpoints are skin sprites, not an invented connecting line.
    if(this.skin&&!this.options.mods.hd&&!modOn(mods,'TC')){
      const start=Math.max(1,upperBound(map.objects,t-1000)),end=upperBound(map.objects,t+d.preempt);
      for(let i=start;i<end;i++){const next=map.objects[i],prev=map.objects[i-1];if(next.combo===1||next.kind==='spinner'||prev.kind==='spinner'||prev.end>next.time)continue;
        const from=displayPoint(objectPosition(prev,prev.end),prev,map,mods),to=displayPoint(next,next,map,mods),length=Math.hypot(to.x-from.x,to.y-from.y),angle=Math.atan2(to.y-from.y,to.x-from.x);
        for(let dist=d.radius*1.5;dist<length-d.radius*1.5;dist+=32){const fraction=dist/length,at=prev.end+(next.time-prev.end)*fraction;
          c.globalAlpha=clamp((t-at+d.preempt)/180,0,1)*clamp((at-t)/180,0,1)*.65;
          this.sprite(this.skin.sprite('followpoint',t-at+d.preempt),{x:from.x+(to.x-from.x)*fraction,y:from.y+(to.y-from.y)*fraction},.5,angle);
        }
      }c.globalAlpha=1;
    }
    let a=0,b=this.appearances.length;while(a<b){const mid=(a+b)>>1;if(this.appearances[mid].appear<=t)a=mid+1;else b=mid;}
    const visible=this.appearances.slice(lo,a).filter(e=>e.end>=cutoff).sort((a,b)=>b.o.id-a.o.id);
    for(const item of visible){const {o,preempt}=item,p=displayPoint(o,o,map,mods),m=objectMotion(o,t,d.preempt,mods);c.save();
      if(modOn(mods,'DP')){const depth=clamp((o.time-t)/d.preempt*100,-50,100),s=200/(200+depth);c.translate(256,192);c.scale(s,s);c.translate(-256,-192);}
      c.translate(p.x+m.x,p.y+m.y);c.rotate(m.rotation);c.scale(m.scale,m.scale*m.scaleY);c.translate(-p.x,-p.y);
      this.drawObject(o,t,d.radius,preempt,d.preempt);c.restore();}
    this.scene?.draw(c,sceneTime,this.w,this.h,true);
    const objectCount=upperBound(map.objects,t),count=autoCombo(map,t),lastObject=map.objects[Math.max(0,objectCount-1)],inBreak=map.breaks.some(b=>t>=b.start&&t<=b.end),spinner=lastObject?.kind==='spinner'&&t<=lastObject.end;
    if(modOn(mods,'FL')){
      const p=autoPosition(map,t-120,mods),size=count>=200?75:count>=100?100:125,g=c.createRadialGradient(p.x,p.y,size*.78,p.x,p.y,size);
      g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'#000');c.globalAlpha=1;c.fillStyle=g;c.fillRect(-1024,-1024,2560,2560);
      if(lastObject?.kind==='slider'&&t<lastObject.end){c.fillStyle='rgba(0,0,0,.8)';c.fillRect(-1024,-1024,2560,2560);}
    }
    if(modOn(mods,'BL')&&!inBreak){const width=clamp(this.options.blindsHP,0,1)*230;c.globalAlpha=1;c.fillStyle='#000';c.fillRect(-1024,-1024,1024+width,2560);c.fillRect(512-width,-1024,1536,2560);}
    if(this.options.cursor && (!modOn(mods,'NS')||count<10||inBreak||spinner)&&t>=map.objects[0].time-d.preempt){
      const cursor=this.skin?.sprite('cursor');
      if(cursor){
        const skin=this.skin!,size=this.options.cursorScale*(modOn(mods,'BM')?1+9*clamp(count/50,0,1):1);
        if(this.options.trail){for(let i=24;i>0;i--){c.globalAlpha=(1-i/25)*.45;this.sprite(skin.sprite('cursortrail'),autoPosition(map,t-i*4,this.options.mods),.5*size);}}
        c.globalAlpha=1;const p=autoPosition(map,t,this.options.mods),last=map.objects[Math.max(0,upperBound(map.objects,t)-1)],expand=skin.config.cursorExpand?1+.18*clamp(1-(t-last.time)/120,0,1):1;
        const s=.25*size*expand,at=skin.config.cursorCentre?p:{x:p.x+cursor.width*s/2,y:p.y+cursor.height*s/2};
        this.sprite(cursor,at,s,skin.config.cursorRotate?t/1000:0);this.sprite(skin.sprite('cursormiddle'),p,.25*size);
      }else{
      const size=this.options.cursorScale*(modOn(mods,'BM')?1+9*clamp(count/50,0,1):1);
      if(this.options.trail){
        for(let i=12;i>0;i--){const p=autoPosition(map,t-i*7,this.options.mods);c.globalAlpha=(1-i/13)*0.26;this.disc(p,Math.max(1,6-i*0.32),'#f9d6eb');}
      }
      c.globalAlpha=1;const p=autoPosition(map,t,this.options.mods);this.disc(p,6.5*size,'#e9b3d3');this.ring(p,7.8*size,'rgba(255,255,255,.85)',1.4);this.disc(p,2*size,'#fff');
      }
    }
    c.globalAlpha=1;this.drawMs=performance.now()-begin;
  }
  private drawObject(o: HitObject, t: number, radius: number, preempt: number,normalPreempt=preempt) {
    const c=this.ctx,map=this.map!,age=t-o.time,until=o.time-t,color=this.comboColor(o),p=displayPoint(o,o,map,this.options.mods),skin=this.skin;
    let alpha=clamp((t-(o.time-preempt))/Math.min(400,preempt*0.4),0,1);
    const trace=modOn(this.options.mods,'TC')&&o.id!==0;
    const hd=this.options.mods.hd&&o.kind!=='spinner';
    if(hd&&o.kind==='circle')alpha*=clamp((o.time-preempt*.3-t)/(preempt*.3),0,1);
    if(t>o.end)alpha*=clamp(1-(t-o.end)/180,0,1);
    if(alpha<=0)return;c.globalAlpha=alpha;
    if(o.kind==='spinner'){
      const progress=clamp((t-o.time)/Math.max(1,o.end-o.time),0,1),center={x:256,y:192};
      if(skin?.sprite('spinner-circle')){
        this.sprite(skin.sprite('spinner-background'),center,.8);this.sprite(skin.sprite('spinner-circle'),center,.8,age>0?age/130:0);
        this.sprite(skin.sprite('spinner-approachcircle'),center,.8*(1-progress));return;
      }
      this.ring(center,128,'rgba(229,231,255,.23)',3);this.ring(center,112,color,2);this.ring(center,Math.max(25,120*(1-progress)),'rgba(255,255,255,.55)',1.4);
      c.fillStyle='#e6e8f5';c.font='500 12px sans-serif';c.textAlign='center';c.fillText(age<0?'SPINNER':'AUTO · SPIN',256,198);return;
    }
    if(o.kind==='slider'&&o.path){
      const range=sliderRange(t,o.time,o.end,o.spans,preempt,this.options.snakeIn,this.options.snakeOut);
      // Half a map-unit precision avoids conspicuous jumps on long sliders.
      const steps=Math.max(48,Math.ceil(o.path.length*2)),from=Math.floor(range[0]*steps)/steps,to=Math.ceil(range[1]*steps)/steps;
      const points=sliceSlider(o.path,from,to).map(point=>displayPoint(point,o,map,this.options.mods));
      const bodyAlpha=hd?clamp((o.end-t)/Math.max(1,o.end-o.time+preempt*.3),0,1):1;
      c.globalAlpha=alpha*bodyAlpha;
      if(to>from)this.sliderTextures.draw(c,`${o.id}|${from}|${to}`,points,radius,skin?.config.sliderTrack??color,trace?color:skin?.config.sliderBorder??'#ddd',trace);
      c.globalAlpha=alpha*bodyAlpha;
      const tail=displayPoint(o.path.points.at(-1)!,o,map,this.options.mods);
      if(skin&&!trace&&t<o.end&&to>=.999)this.skinCircle('sliderendcircle','sliderendcircleoverlay',tail,radius,color);
      for(const tick of o.tickTimes){if(tick<=t)continue;const fraction=clamp((tick-o.time)/o.spanDuration,0,o.spans),span=Math.min(o.spans-1,Math.floor(fraction)),progress=span%2?1-(fraction-span):fraction-span;
        if(progress<from||progress>to)continue;const point=displayPoint(objectPosition(o,tick),o,map,this.options.mods);c.globalAlpha=alpha*bodyAlpha;
        if(!this.sprite(skin?.sprite('sliderscorepoint'),point,radius/64))this.disc(point,radius*.1,'#ddd');}
      c.globalAlpha=alpha;
      if(o.spans>1&&t<o.end-o.spanDuration*.08){
        const span=Math.max(0,Math.floor((t-o.time)/Math.max(1,o.spanDuration)));
        const at=span%2?p:tail,other=span%2?displayPoint(o.path.points[1]??o,map.objects[o.id],map,this.options.mods):displayPoint(o.path.points.at(-2)??o,o,map,this.options.mods);
        const angle=Math.atan2(other.y-at.y,other.x-at.x);
        if(!this.sprite(skin?.sprite('reversearrow'),at,radius/64,angle)){c.save();c.translate(at.x,at.y);c.rotate(angle);c.beginPath();c.moveTo(-5,-7);c.lineTo(3,0);c.lineTo(-5,7);c.strokeStyle='#fff';c.lineWidth=2.6;c.stroke();c.restore();}
      }
      if(age>=0&&t<=o.end){
        const ball=displayPoint(objectPosition(o,t),o,map,this.options.mods);
        if(skin?.sprite('sliderb',age)){
          const pulse=1+.06*Math.exp(-Math.max(0,t-(o.tickTimes.filter(n=>n<=t).at(-1)??o.time))/90);this.sprite(skin.sprite('sliderfollowcircle',age),ball,radius/64*pulse);
          const next=displayPoint(objectPosition(o,Math.min(o.end,t+2)),o,map,this.options.mods),angle=Math.atan2(next.y-ball.y,next.x-ball.x),reverse=Math.floor(age/Math.max(1,o.spanDuration))%2===1;
          this.sprite(skin.config.sliderBallTint?skin.tint('sliderb',color,age):skin.sprite('sliderb',age),ball,radius/64,angle,skin.config.sliderBallFlip&&reverse);
        }else{this.ring(ball,radius*1.65,'rgba(255,255,255,.22)',2);this.disc(ball,radius*.78,'#e8eaf5');this.ring(ball,radius*.78,color,3);}
      }
    }
    if(skin){
      const headAlpha=hd&&o.kind==='slider'?clamp((o.time-preempt*.3-t)/(preempt*.3),0,1):1;
      if(age<180&&!trace){c.globalAlpha=alpha*headAlpha*(age>0?1-age/180:1);this.skinCircle(o.kind==='slider'?'sliderstartcircle':'hitcircle',o.kind==='slider'?'sliderstartcircleoverlay':'hitcircleoverlay',p,radius*(age>0?1+age/600:1),color,age>0?undefined:o.combo);}
      if(until>0&&!hd&&!modOn(this.options.mods,'SI')){c.globalAlpha=alpha*.9;const fraction=clamp(until/preempt,0,1),progress=modOn(this.options.mods,'AD')?1+3*(1-(1-fraction)**2):modOn(this.options.mods,'FR')?1+3*until/normalPreempt:1+3*fraction;if(!this.sprite(skin.tint('approachcircle',color),p,radius/64*progress))this.ring(p,radius*progress,color,1.6);}
    }else{
      if(age<90&&!trace){
      const hitScale=age>0?1+age/450:1,r=radius*hitScale;
      c.globalAlpha=alpha*(age>0?1-age/90:1);this.disc(p,r,'#181d2a');
      this.ring(p,r-3,color,3.5);this.ring(p,r,'rgba(255,255,255,.9)',1.7);
      c.fillStyle='#f3f2fa';c.textAlign='center';c.textBaseline='middle';c.font=`600 ${radius*.85}px "Segoe UI",sans-serif`;c.fillText(String(o.combo),p.x,p.y+.5);
    }
      if(until>0&&!this.options.mods.hd&&!modOn(this.options.mods,'SI')){c.globalAlpha=alpha*.7;this.ring(p,radius*(1+3*clamp(until/preempt,0,1)),color,1.6);}
    if(age>=0&&age<160){c.globalAlpha=(1-age/160)*.45;this.ring(p,radius*(1+age/180),'#fff',1.4);}
    }
    c.globalAlpha=1;
  }
  destroy(){this.observer.disconnect();}
}
