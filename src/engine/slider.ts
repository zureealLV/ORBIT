import {pathPosition} from './geometry';
import {clamp,type Point,type SliderPath} from './types';

function rgb(color:string):number[]{
  if(color.startsWith('#')){const hex=color.slice(1);const value=hex.length===3?hex.split('').map(c=>c+c).join(''):hex;return [0,2,4].map(i=>parseInt(value.slice(i,i+2),16)||0);}
  return color.match(/[\d.]+/g)?.slice(0,3).map(Number)??[255,255,255];
}
// Own radial profile, informed by ppy's documented legacy path colour algorithm.
export function sliderProfile(distance:number,track:string,border:string):number[]{
  if(distance>1)return [0,0,0,0];
  if(distance>.9375)return [0,0,0,.25*clamp((1-distance)/.0625,0,1)];
  if(distance>=.8125)return [...rgb(border),1];
  const colour=rgb(track),t=clamp(distance/.8125,0,1);
  return [...colour.map(c=>Math.round((Math.min(255,c*1.125+63.75))*(1-t)+c*.9*t)),.7];
}
export function sliderRange(time:number,start:number,end:number,spans:number,preempt:number,snakeIn:boolean,snakeOut:boolean):[number,number]{
  if(time<start)return [0,snakeIn?clamp((time-start+preempt)/(preempt*.5),0,1):1];
  const span=(end-start)/spans;
  if(!snakeOut||time<end-span)return [0,1];
  const progress=clamp((time-(end-span))/span,0,1);
  return spans%2?[progress,1]:[0,1-progress];
}
export function sliceSlider(path:SliderPath,start:number,end:number):Point[]{
  const from=path.length*clamp(start,0,1),to=path.length*clamp(end,0,1);
  return [pathPosition(path,start),...path.points.filter((_,i)=>path.distances[i]>from&&path.distances[i]<to),pathPosition(path,end)];
}
interface Texture {canvas:HTMLCanvasElement;x:number;y:number;width:number;height:number;pixels:number}
export class SliderTextures {
  private cache=new Map<string,Texture>();private pixels=0;
  clear(){this.cache.clear();this.pixels=0;}
  draw(ctx:CanvasRenderingContext2D,key:string,points:Point[],radius:number,track:string,border:string,outline=false){
    const id=`${key}|${radius.toFixed(2)}|${track}|${border}|${outline}`;let texture=this.cache.get(id);
    if(texture){this.cache.delete(id);this.cache.set(id,texture);}
    else{
      let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
      for(const p of points){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);}
      const pad=radius+2,x=minX-pad,y=minY-pad;
      const width=Math.max(1,maxX-x+pad),height=Math.max(1,maxY-y+pad);
      const ratio=Math.min(2,1024/Math.max(width,height)),canvas=document.createElement('canvas');
      canvas.width=Math.ceil(width*ratio);canvas.height=Math.ceil(height*ratio);
      const c=canvas.getContext('2d')!;c.setTransform(ratio,0,0,ratio,-x*ratio,-y*ratio);
      const path=new Path2D();points.forEach((p,i)=>i?path.lineTo(p.x,p.y):path.moveTo(p.x,p.y));
      // A zero-length slider still has a round cap in Canvas implementations.
      if(points.length<2||points.every(p=>p.x===points[0].x&&p.y===points[0].y))path.lineTo(points[0].x+.001,points[0].y);
      c.lineCap='round';c.lineJoin='round';
      c.strokeStyle='rgba(0,0,0,.18)';c.lineWidth=radius*2;c.stroke(path);
      c.strokeStyle=border;c.lineWidth=radius*2*.9375;c.stroke(path);
      const bands=36;
      for(let i=bands;i>=1;i--){const d=.8125*i/bands,p=sliderProfile(Math.max(0,d-.8125/bands/2),track,border);c.strokeStyle=`rgb(${p.slice(0,3).join(',')})`;c.lineWidth=radius*2*d;c.stroke(path);}
      // Apply opacity once, not once per overlapping stroke or path segment.
      c.globalCompositeOperation='destination-out';c.strokeStyle=outline?'#000':'rgba(0,0,0,.3)';c.lineWidth=radius*2*.8125;c.stroke(path);
      texture={canvas,x,y,width:canvas.width/ratio,height:canvas.height/ratio,pixels:canvas.width*canvas.height};
      while(this.cache.size&&(this.cache.size>=48||this.pixels+texture.pixels>12*1048576)){const oldest=this.cache.keys().next().value!;this.pixels-=this.cache.get(oldest)!.pixels;this.cache.delete(oldest);}
      this.cache.set(id,texture);this.pixels+=texture.pixels;
    }
    ctx.drawImage(texture.canvas,texture.x,texture.y,texture.width,texture.height);
  }
}
