import { timingAt } from './parser';
import { upperBound } from './playback';
import { clamp, type Beatmap, type HitObject, type Sample } from './types';

export class PlaybackClock {
  readonly audio = new Audio();
  playing = false; hasAudio = false; rate = 1; duration = 1;
  private position = 0; private anchor = 0;
  private tail = false;
  onEnd = () => {};
  constructor(){this.audio.preload='auto';this.audio.preservesPitch=true;this.audio.addEventListener('ended',()=>{
    // Some maps have objects after the music ends: keep a silent visual tail.
    if(!this.playing)return;
    this.position=Math.min(this.duration,this.audio.currentTime*1000);this.anchor=performance.now();this.tail=true;
    if(this.position>=this.duration){this.playing=false;this.onEnd();}
  });}
  async load(url: string | undefined, duration: number){
    this.pause();this.audio.removeAttribute('src');this.audio.load();this.hasAudio=false;this.tail=false;this.position=0;this.duration=duration;
    if(!url)return;
    this.audio.src=url;
    try {
      await new Promise<void>((resolve,reject)=>{
        const timer=setTimeout(()=>{cleanup();reject(new Error('音乐加载超时'));},15000);
        const success=()=>{cleanup();resolve();};const failure=()=>{cleanup();reject(new Error('浏览器无法解码谱面音乐，可换一张 MP3/OGG 谱面。'));};
        const cleanup=()=>{clearTimeout(timer);this.audio.removeEventListener('loadedmetadata',success);this.audio.removeEventListener('error',failure);};
        this.audio.addEventListener('loadedmetadata',success);this.audio.addEventListener('error',failure);
        this.audio.load();
      });
      this.hasAudio=true;this.audio.playbackRate=this.rate;
    } catch(error){this.audio.removeAttribute('src');this.audio.load();throw error;}
  }
  time(){if(!this.playing)return this.position;return this.hasAudio&&!this.tail?this.audio.currentTime*1000:Math.min(this.duration,this.position+(performance.now()-this.anchor)*this.rate);}
  async play(){
    if(this.time()>=this.duration-50)this.seek(0);
    if(this.hasAudio&&!this.tail)await this.audio.play();
    this.anchor=performance.now();this.playing=true;
  }
  pause(){this.position=this.time();this.audio.pause();this.playing=false;}
  seek(ms:number){
    this.position=clamp(ms,0,this.duration);this.anchor=performance.now();
    if(this.hasAudio){
      const wasTail=this.tail;this.tail=Number.isFinite(this.audio.duration)&&this.position>=this.audio.duration*1000;
      this.audio.currentTime=Math.min(this.position/1000,this.audio.duration||this.position/1000);
      if(this.tail)this.audio.pause();else if(wasTail&&this.playing)void this.audio.play().catch(()=>this.pause());
    }
  }
  setRate(rate:number){const position=this.time();this.position=position;this.anchor=performance.now();this.rate=clamp(rate,.25,4);this.audio.playbackRate=this.rate;}
  dispose(){this.pause();this.audio.removeAttribute('src');this.audio.load();}
}
interface SoundEvent {time:number; object:HitObject; sound:number; edge:number; tick:boolean}
export class Hitsounds {
  private context?: AudioContext; private master?: GainNode;
  private samples = new Map<string,AudioBuffer>(); private fallback?: AudioBuffer;
  private skinSamples=new Map<string,AudioBuffer>();private skinGeneration=0;
  private events:SoundEvent[]=[];private index=0;private sources=new Set<AudioBufferSourceNode>();
  private map?:Beatmap;private generation=0;
  enabled=true;volume=.35;customLoaded=0;preferSkin=true;skinLoaded=0;layeredSounds=true;
  nightcore=false;private beatIndex=0;private beats:{time:number;kind:'kick'|'clap'|'hat'}[]=[];
  private drums=new Map<string,AudioBuffer>();
  private prepare(){
    this.context??=new AudioContext();
    if(!this.master){this.master=this.context.createGain();this.master.connect(this.context.destination);}
    if(!this.fallback){
      // Original synthesized click: no borrowed skin or game audio assets.
      const n=Math.floor(this.context.sampleRate*.027),buffer=this.context.createBuffer(1,n,this.context.sampleRate),data=buffer.getChannelData(0);
      let seed=12345;
      for(let i=0;i<n;i++){const t=i/this.context.sampleRate;seed=(seed*1664525+1013904223)>>>0;data[i]=(Math.sin(2*Math.PI*1150*t)*.65+((seed/4294967296)*2-1)*.25)*Math.exp(-t*170);}
      this.fallback=buffer;
    }
  }
  async unlock(){this.prepare();await this.context!.resume();}
  async setSkin(files:{name:string;bytes:Uint8Array}[],layered=true){
    this.prepare();const generation=++this.skinGeneration,next=new Map<string,AudioBuffer>();let cursor=0;
    await Promise.all(Array.from({length:4},async()=>{
      while(cursor<files.length){const file=files[cursor++];try{
        // Tiny header-only samples intentionally disable a sound in many skins.
        const buffer=file.bytes.length<=128?this.context!.createBuffer(1,1,this.context!.sampleRate):await this.context!.decodeAudioData(file.bytes.slice().buffer as ArrayBuffer);
        next.set(file.name.toLowerCase(),buffer);
      }catch{/* Unsupported optional codec uses another set or synthesized fallback. */}}
    }));
    if(generation!==this.skinGeneration)return;
    this.skinSamples=next;this.skinLoaded=next.size;this.layeredSounds=layered;
  }
  async load(map:Beatmap, files:{name:string;bytes:Uint8Array}[]){
    this.prepare();
    const generation=++this.generation;this.reset(0);this.map=map;this.samples.clear();this.customLoaded=0;
    this.events=[];
    for(const o of map.objects){
      this.events.push({time:o.time,object:o,sound:o.kind==='slider'?(o.edgeSounds[0]??o.sound):o.sound,edge:0,tick:false});
      if(o.kind==='slider'){
        for(let edge=1;edge<=o.spans;edge++)this.events.push({time:o.time+edge*o.spanDuration,object:o,sound:o.edgeSounds[edge]??0,edge,tick:false});
        for(const time of o.tickTimes)this.events.push({time,object:o,sound:0,edge:0,tick:true});
      }
    }
    this.events.sort((a,b)=>a.time-b.time);
    if(!this.context)return;
    // Bounded concurrency, custom assets are optional and unsupported codecs fall back.
    let cursor=0;
    await Promise.all(Array.from({length:4},async()=>{
      while(cursor<files.length){const file=files[cursor++];try{const buffer=await this.context!.decodeAudioData(file.bytes.slice().buffer as ArrayBuffer);if(generation!==this.generation)return;this.samples.set(file.name.replace(/\\/g,'/').toLowerCase(),buffer);}catch{/* fallback click */}}
    }));
    this.customLoaded=this.samples.size;
  }
  reset(time:number){
    for(const source of this.sources){try{source.stop();}catch{}}this.sources.clear();
    let lo=0,hi=this.events.length;while(lo<hi){const mid=(lo+hi)>>1;if(this.events[mid].time<time-1)lo=mid+1;else hi=mid;}this.index=lo;
    lo=0;hi=this.beats.length;while(lo<hi){const mid=(lo+hi)>>1;if(this.beats[mid].time<time-1)lo=mid+1;else hi=mid;}this.beatIndex=lo;
  }
  configureNightcore(map:Beatmap){
    this.beats=[];
    const sections=map.timing.filter(t=>Number.isFinite(t.time)&&t.baseTime===t.time);
    if(!sections.length)sections.push({...map.timing[0],time:0,baseTime:0});
    sections.forEach((timing,i)=>{const end=sections[i+1]?.time??map.duration,origin=timing.time,meter=timing.meter??4;
      for(let beat=Math.max(0,Math.ceil(-origin/timing.beat));this.beats.length<40000;beat++){
        const at=origin+beat*timing.beat;if(at>=end)break;
        this.beats.push({time:at,kind:beat%2?'clap':'kick'});
        if(beat%(meter*4)===0)this.beats.push({time:at,kind:'hat'});
      }
    });
    this.beats.sort((a,b)=>a.time-b.time);this.reset(0);
  }
  private drum(kind:'kick'|'clap'|'hat'){
    const found=this.drums.get(kind);if(found)return found;const context=this.context!,duration=kind==='hat'?.18:.13,n=Math.floor(context.sampleRate*duration),buffer=context.createBuffer(1,n,context.sampleRate),data=buffer.getChannelData(0);let seed=37;
    for(let i=0;i<n;i++){const t=i/context.sampleRate;seed=(seed*1664525+1013904223)>>>0;const noise=seed/4294967296*2-1;data[i]=kind==='kick'?Math.sin(2*Math.PI*(55*t+6*(1-Math.exp(-t*35))))*Math.exp(-t*28):noise*Math.exp(-t*(kind==='hat'?35:48))*.55;}
    this.drums.set(kind,buffer);return buffer;
  }
  private schedule(buffer:AudioBuffer,volume:number,at:number){const source=this.context!.createBufferSource(),gain=this.context!.createGain();source.buffer=buffer;gain.gain.value=volume;source.connect(gain);gain.connect(this.master!);source.onended=()=>{this.sources.delete(source);gain.disconnect();};this.sources.add(source);source.start(at);}
  private lookup(name:string){
    const normalized=name.replace(/\\/g,'/').toLowerCase();return this.samples.get(normalized)??[...this.samples.entries()].find(([key])=>key.endsWith('/'+normalized))?.[1];
  }
  private resolve(event:SoundEvent){
    const map=this.map!,o=event.object,timing=timingAt(map.timing,event.time),sample:Sample={...o.sample};
    if(o.edgeSets[event.edge]){const [n,a]=o.edgeSets[event.edge].split(':').map(Number);sample.normal=n;sample.addition=a;}
    const normal=sample.normal||timing.sampleSet||map.sampleSet,addition=sample.addition||normal,index=sample.index||timing.sampleIndex;
    const volume=(sample.volume||timing.volume)/100;
    if(sample.filename&&!event.tick&&(!this.preferSkin||!this.skinSamples.size)){const found=this.lookup(sample.filename);return {buffers:[found??this.fallback!],volume};}
    const setName=(n:number)=>['normal','normal','soft','drum'][n]??'normal';
    const additions=[...(event.sound&2?['hitwhistle']:[]),...(event.sound&4?['hitfinish']:[]),...(event.sound&8?['hitclap']:[])];
    const kinds=event.tick?['slidertick']:[...(this.layeredSounds||!additions.length?['hitnormal']:[]),...additions];
    const buffers=kinds.map(kind=>{
      const set=setName(kind==='hitnormal'||event.tick?normal:addition),stem=`${set}-${kind}${index>1?index:''}`;
      const skinStem=`${set}-${kind}`;
      const skinSample=()=>{for(const ext of ['wav','ogg','mp3']){const buffer=this.skinSamples.get(`${skinStem}.${ext}`);if(buffer)return buffer;}return undefined;};
      if(this.preferSkin){const buffer=skinSample();if(buffer)return buffer;}
      for(const ext of ['wav','ogg','mp3']){const buffer=this.lookup(`${stem}.${ext}`);if(buffer)return buffer;}
      const buffer=skinSample();if(buffer)return buffer;
      return this.fallback!;
    });
    return {buffers,volume:volume*(event.tick ? .45 : 1)};
  }
  tick(clock:PlaybackClock){
    if(!clock.playing||!this.context||!this.master||!this.map)return;
    const time=clock.time();this.master.gain.value=this.volume;
    if(this.nightcore){while(this.beatIndex<this.beats.length&&this.beats[this.beatIndex].time<=time+80*clock.rate){const beat=this.beats[this.beatIndex++];if(beat.time<time-70)continue;this.schedule(this.drum(beat.kind),.45,this.context.currentTime+Math.max(0,(beat.time-time)/1000/clock.rate));}}
    if(!this.enabled)return;
    // Re-align rather than burst old notes after tab suspension.
    if(this.events[this.index]&&time-this.events[this.index].time>250)this.reset(time);
    while(this.index<this.events.length&&this.events[this.index].time<=time+80*clock.rate){
      const event=this.events[this.index++];if(event.time<time-70)continue;
      const {buffers,volume}=this.resolve(event);
      for(const buffer of buffers){if(buffer)this.schedule(buffer,volume,this.context.currentTime+Math.max(0,(event.time-time)/1000/clock.rate));}
    }
  }
  async dispose(){this.generation++;this.skinGeneration++;this.reset(0);await this.context?.close();}
}
