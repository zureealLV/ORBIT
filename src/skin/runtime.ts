import {chooseSkinImage,type SkinArchive,type SkinConfig} from './archive';

export interface SkinSprite {image:CanvasImageSource;width:number;height:number}
export class Skin {
  readonly sprites=new Map<string,SkinSprite>();
  private tinted=new Map<string,SkinSprite>();
  private spriteIds=new WeakMap<SkinSprite,number>();
  private nextSpriteId=0;
  readonly config:SkinConfig;
  private constructor(readonly archive:SkinArchive){this.config=archive.config;}
  static async create(archive:SkinArchive){
    const skin=new Skin(archive),names=archive.files.filter(f=>/\.png$/i.test(f.name)).map(f=>f.name);
    const stems=[...new Set(names.map(n=>n.replace(/(@2x)?\.png$/i,'')))];
    let cursor=0,totalPixels=0;
    await Promise.all(Array.from({length:4},async()=>{
      while(cursor<stems.length){
        const stem=stems[cursor++],chosen=chooseSkinImage(names,stem)!;
        const bytes=archive.files.find(f=>f.name===chosen.name)!.bytes;
        if(bytes.length<24||bytes[0]!==137||bytes[1]!==80||bytes[2]!==78||bytes[3]!==71)continue;
        const header=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),w=header.getUint32(16),h=header.getUint32(20);
        if(!w||!h||w>4096||h>4096||(totalPixels+=w*h)>32*1048576)throw new Error('皮肤贴图分辨率超过限制。');
        const image=new Image(),url=URL.createObjectURL(new Blob([bytes.slice().buffer as ArrayBuffer],{type:'image/png'}));
        try{image.src=url;await image.decode();skin.sprites.set(stem,{image,width:image.naturalWidth/chosen.scale,height:image.naturalHeight/chosen.scale});}
        catch{/* Optional malformed sprites use vector fallback. */}
        finally{URL.revokeObjectURL(url);}
      }
    }));
    if(!skin.sprites.has('hitcircle'))throw new Error('皮肤 hitcircle 贴图无法解码。');
    return skin;
  }
  sprite(stem:string,time=0):SkinSprite|undefined {
    const animation=stem==='sliderb'?stem+'0':stem+'-0';
    if(this.sprites.has(animation)){
      let count=1;while(count<240&&this.sprites.has(stem+(stem==='sliderb'?'':'-')+count))count++;
      return this.sprites.get(stem+(stem==='sliderb'?'':'-')+(Math.max(0,Math.floor(time*this.config.fps/1000))%count));
    }
    return this.sprites.get(stem);
  }
  tint(stem:string,color:string,time=0):SkinSprite|undefined {
    const sprite=this.sprite(stem,time);if(!sprite)return;
    // Cache each decoded frame/colour instead of compositing every render frame.
    if(!this.spriteIds.has(sprite))this.spriteIds.set(sprite,++this.nextSpriteId);
    const key=`${this.spriteIds.get(sprite)}|${color}`;const found=this.tinted.get(key);if(found)return found;
    const image=sprite.image as HTMLImageElement,canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
    const c=canvas.getContext('2d')!;c.drawImage(image,0,0);c.globalCompositeOperation='multiply';c.fillStyle=color;c.fillRect(0,0,canvas.width,canvas.height);c.globalCompositeOperation='destination-in';c.drawImage(image,0,0);
    const result={image:canvas,width:sprite.width,height:sprite.height};
    if(this.tinted.size>=128)this.tinted.delete(this.tinted.keys().next().value!);
    this.tinted.set(key,result);return result;
  }
  get audioFiles(){return this.archive.files.filter(f=>/\.(wav|ogg|mp3)$/i.test(f.name));}
}
