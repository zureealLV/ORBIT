import {assetPath,framePath,spriteState,type Storyboard,type SBSprite} from './storyboard';
export interface VideoEvent {path:string;start:number;x:number;y:number}
export interface ScenePayload {storyboard:Storyboard;images:{name:string;bytes:Uint8Array}[];video:{event:VideoEvent;bytes:Uint8Array}|null;videoMissing?:boolean}
export function videoTarget(event:VideoEvent,time:number,duration:number):number|null {const seconds=(time-event.start)/1000;return seconds<0||seconds>=duration?null:seconds;}
export function safeImageHeader(bytes:Uint8Array):boolean {
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const valid=(w:number,h:number)=>w>0&&h>0&&w<=8192&&h<=8192&&w*h<=32*1048576;
  if(bytes.length>=24&&bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71)return valid(view.getUint32(16),view.getUint32(20));
  if(bytes[0]===255&&bytes[1]===216){
    let i=2;while(i+4<bytes.length){if(bytes[i++]!==255)continue;const marker=bytes[i++];if(marker===255){i--;continue;}if(marker===218||marker===217)break;if(marker===1||marker>=208&&marker<=215)continue;const length=view.getUint16(i);if(length<2||i+length>bytes.length)return false;
      if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){if(length<7)return false;return valid(view.getUint16(i+5),view.getUint16(i+3));}i+=length;
    }return false;
  }
  // Unknown formats still receive the post-decode dimensional guard.
  return true;
}
const origins:Record<string,[number,number]>={TopLeft:[0,0],Centre:[.5,.5],CentreLeft:[0,.5],TopRight:[1,0],BottomCentre:[.5,1],TopCentre:[.5,0],Custom:[0,0],CentreRight:[1,.5],BottomLeft:[0,1],BottomRight:[1,1]};
const numericOrigins=Object.keys(origins);
export class BackgroundScene {
  revision=0;videoEnabled=true;storyboardEnabled=true;video?:HTMLVideoElement;duration=0;activeSprites=0;
  readonly warnings:string[];
  private encoded=new Map<string,Uint8Array>();private desired=new Set<string>();private attempted=new Set<string>();private decoding=new Set<string>();private failed=new Set<string>();private imagePixels=0;private preparedAt='';
  private images=new Map<string,ImageBitmap>();private urls:string[]=[];private dead=false;private videoError='';private playPending=false;
  private layers:{sprites:SBSprite[];ends:number[]}[]=[];private tintCache=new Map<string,{canvas:OffscreenCanvas;pixels:number}>();private tintPixels=0;
  private constructor(readonly payload:ScenePayload,private notify:(text:string)=>void){
    this.warnings=[...payload.storyboard.warnings];
    for(let layer=0;layer<5;layer++){const sprites=payload.storyboard.sprites.filter(s=>s.layer===layer&&Number.isFinite(s.start)).sort((a,b)=>a.start-b.start||a.order-b.order);let end=-Infinity;this.layers.push({sprites,ends:sprites.map(s=>end=Math.max(end,s.end))});}
  }
  static async create(payload:ScenePayload,notify:(text:string)=>void){
    const scene=new BackgroundScene(payload,notify);
    try {
      for(const file of payload.images)scene.encoded.set(assetPath(file.name),file.bytes);
      scene.prepare(0);
      if(payload.video){
        const v=document.createElement('video');scene.video=v;v.id='background-video';v.hidden=true;v.muted=true;v.playsInline=true;v.preload='auto';
        const ext=payload.video.event.path.split('.').pop()?.toLowerCase();const mime=ext==='webm'?'video/webm':ext==='ogv'?'video/ogg':ext==='mp4'||ext==='m4v'?'video/mp4':ext==='avi'?'video/x-msvideo':'';
        const url=URL.createObjectURL(new Blob([payload.video.bytes.slice().buffer],{type:mime}));scene.urls.push(url);
        v.addEventListener('error',()=>{if(!scene.dead){scene.videoError='视频编码不受浏览器支持，请换用 H.264 MP4 / WebM';scene.revision++;scene.report();}});
        for(const event of ['loadeddata','seeked'])v.addEventListener(event,()=>scene.revision++);
        const ready=new Promise<void>(resolve=>{const timer=setTimeout(done,10000);function done(){clearTimeout(timer);v.removeEventListener('loadedmetadata',done);v.removeEventListener('error',done);resolve();}v.addEventListener('loadedmetadata',done);v.addEventListener('error',done);});
        document.getElementById('stage')?.append(v);v.src=url;await ready;
        if(Number.isFinite(v.duration))scene.duration=Math.max(0,payload.video.event.start+v.duration*1000);
      }
      scene.revision++;scene.report();return scene;
    }catch(error){scene.dispose();throw error;}
  }
  report(){if(this.dead)return;const parts=[this.payload.storyboard.sprites.length?`故事板 ${this.payload.storyboard.sprites.length.toLocaleString()} 精灵 / ${this.encoded.size} 贴图`:'无故事板',this.videoError||(this.video?'背景视频已载入':this.payload.videoMissing?'视频文件未包含在谱面包':'无背景视频')];if(this.warnings.length)parts.push(this.warnings.join('；'));this.notify(parts.join(' · '));}
  hidesBackground(path:string){return this.storyboardEnabled&&this.payload.storyboard.sprites.some(s=>assetPath(s.path)===assetPath(path));}
  private visible(layer:number,time:number,ahead=0){
    const {sprites,ends}=this.layers[layer];let a=0,b=sprites.length;while(a<b){const m=(a+b)>>1;if(ends[m]<time)a=m+1;else b=m;}const first=a;
    a=first;b=sprites.length;while(a<b){const m=(a+b)>>1;if(sprites[m].start<=time+ahead)a=m+1;else b=m;}
    return sprites.slice(first,a).filter(s=>s.end>=time).sort((a,b)=>a.order-b.order);
  }
  private prepare(time:number){
    const bucket=`${Math.floor(time/100)}|${this.storyboardEnabled}`;if(bucket===this.preparedAt)return;this.preparedAt=bucket;this.desired.clear();this.attempted.clear();
    if(this.storyboardEnabled)for(const layer of [0,2,3,4])for(const s of this.visible(layer,time,1200)){
      this.desired.add(framePath(s,Math.max(time,s.start)));
      if(s.animated)for(let i=1;i<=Math.min(s.frames,4);i++)this.desired.add(framePath(s,Math.max(time,s.start)+s.delay*i));
    }
    this.pump();
  }
  private pump(){
    if(this.dead||this.decoding.size>=4)return;
    for(const path of this.desired){
      if(this.decoding.size>=4)break;
      const bytes=this.encoded.get(path);if(!bytes||this.images.has(path)||this.decoding.has(path)||this.failed.has(path)||this.attempted.has(path))continue;
      if(!safeImageHeader(bytes)){this.failed.add(path);if(this.failed.size===1){this.warnings.push('部分故事板贴图尺寸超过限制或文件损坏');this.report();}continue;}
      this.decoding.add(path);this.attempted.add(path);
      void createImageBitmap(new Blob([bytes.slice().buffer])).then(image=>{
        if(this.dead||!this.desired.has(path)){image.close();return;}
        const pixels=image.width*image.height;
        if(image.width>8192||image.height>8192||pixels>32*1048576){image.close();throw new Error('贴图尺寸超过限制');}
        while(this.imagePixels+pixels>96*1048576&&this.images.size){const [old,bitmap]=this.images.entries().next().value!;this.images.delete(old);this.imagePixels-=bitmap.width*bitmap.height;bitmap.close();}
        this.imagePixels+=pixels;this.images.set(path,image);this.revision++;
      }).catch(()=>{if(this.dead)return;this.failed.add(path);if(this.failed.size===1){this.warnings.push('部分故事板贴图无法解码');this.report();}}).finally(()=>{this.decoding.delete(path);this.pump();});
    }
  }
  sync(time:number,rate:number,playing:boolean){
    this.prepare(time);
    const v=this.video,event=this.payload.video?.event;if(!v||!event||this.dead||this.videoError)return;
    const target=this.videoEnabled&&v.readyState>=1?videoTarget(event,time,v.duration):null;
    if(target===null){if(!v.paused)v.pause();return;}
    v.playbackRate=Math.max(.25,Math.min(4,rate));
    if(!v.seeking&&Math.abs(v.currentTime-target)>(playing?.15:.015)){try{v.currentTime=target;}catch{}this.revision++;}
    if(playing&&v.paused&&!this.playPending){this.playPending=true;void v.play().catch(error=>{if(!this.dead&&error.name!=='AbortError'){this.videoError='视频播放被浏览器阻止，请重新载入';this.report();}}).finally(()=>this.playPending=false);}
    if(!playing&&!v.paused)v.pause();
    if(playing)this.revision++;
  }
  drawVideo(c:CanvasRenderingContext2D,time:number,w:number,h:number){const v=this.video,event=this.payload.video?.event;if(!this.videoEnabled||!v||!event||v.readyState<2||this.videoError||videoTarget(event,time,v.duration)===null)return false;
    const scale=Math.max(w/v.videoWidth,h/v.videoHeight);c.drawImage(v,(w-v.videoWidth*scale)/2+event.x*h/480,(h-v.videoHeight*scale)/2+event.y*h/480,v.videoWidth*scale,v.videoHeight*scale);return true;}
  private tinted(path:string,image:ImageBitmap,color:number[]):CanvasImageSource {
    const rgb=color.map(c=>Math.round(c));if(rgb.every(c=>c===255))return image;
    const key=path+'|'+rgb.join(',');const cached=this.tintCache.get(key);if(cached)return cached.canvas;
    const canvas=new OffscreenCanvas(image.width,image.height),ctx=canvas.getContext('2d')!;
    ctx.drawImage(image,0,0);ctx.globalCompositeOperation='multiply';ctx.fillStyle=`rgb(${rgb.join(',')})`;ctx.fillRect(0,0,image.width,image.height);ctx.globalCompositeOperation='destination-in';ctx.drawImage(image,0,0);
    const pixels=image.width*image.height;
    while(this.tintPixels+pixels>16*1048576&&this.tintCache.size){const [old,value]=this.tintCache.entries().next().value!;this.tintCache.delete(old);this.tintPixels-=value.pixels;value.canvas.width=1;value.canvas.height=1;}
    // Very large tinted images are transient, not cached without a memory bound.
    if(pixels<=16*1048576){this.tintCache.set(key,{canvas,pixels});this.tintPixels+=pixels;}
    return canvas;
  }
  draw(c:CanvasRenderingContext2D,time:number,w:number,h:number,overlay=false){
    if(!this.storyboardEnabled)return;this.prepare(time);c.save();const scale=h/480;c.setTransform(scale,0,0,scale,(w-640*scale)/2,0);c.globalAlpha=1;
    if(!this.payload.storyboard.widescreen){c.beginPath();c.rect(0,0,640,480);c.clip();}
    if(!overlay)this.activeSprites=0;
    for(const layer of overlay?[4]:[0,2,3]){
      const visible=this.visible(layer,time);
      for(const sprite of visible){const state=spriteState(sprite,time);if(!state||state.alpha<=0||state.sx===0||state.sy===0)continue;const path=framePath(sprite,time),image=this.images.get(path);if(!image)continue;this.images.delete(path);this.images.set(path,image);
        const origin=origins[sprite.origin]??origins[numericOrigins[Number(sprite.origin)]]??origins.Centre;
        c.save();c.globalAlpha=state.alpha;c.globalCompositeOperation=state.additive?'lighter':'source-over';c.translate(state.x,state.y);c.rotate(state.rotation);c.scale(state.sx*(state.flipH?-1:1),state.sy*(state.flipV?-1:1));
        c.drawImage(this.tinted(path,image,state.color),-image.width*origin[0],-image.height*origin[1]);c.restore();this.activeSprites++;
      }
    }c.restore();
  }
  dispose(){this.dead=true;this.video?.pause();this.video?.removeAttribute('src');this.video?.load();this.video?.remove();for(const image of this.images.values())image.close();this.images.clear();this.encoded.clear();this.desired.clear();this.tintCache.clear();for(const url of this.urls)URL.revokeObjectURL(url);this.urls=[];}
}
