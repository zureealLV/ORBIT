import { pathPosition } from './geometry';
import { clamp, difficulty, lerp, type Beatmap, type HitObject, type Point, type VisualMods } from './types';
import {modOn,motionPoint} from './mods';

export function upperBound(objects: HitObject[], time: number) {
  let lo = 0, hi = objects.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (objects[mid].time <= time) lo = mid + 1; else hi = mid; }
  return lo;
}
export function objectPosition(o: HitObject, time: number): Point {
  if (o.kind === 'slider' && o.path && o.spanDuration > 0) {
    const progress = clamp((time - o.time) / o.spanDuration, 0, o.spans);
    const span = Math.min(o.spans - 1, Math.floor(progress));
    return pathPosition(o.path, span % 2 ? 1 - (progress - span) : progress - span);
  }
  if (o.kind === 'spinner') {
    const theta = (time - o.time) / 1000 * Math.PI * 8;
    return {x: 256 + Math.cos(theta) * 66, y: 192 + Math.sin(theta) * 66};
  }
  return o;
}
export function displayPoint(p: Point, o: HitObject, map: Beatmap, mods: VisualMods): Point {
  const offset = o.stack * 6.4 * difficulty(map, mods).radius / 32;
  const x = p.x - offset, y = p.y - offset;
  const mirror=modOn(mods,'MR'),axis=mods.mirror??'horizontal';
  return {x:mirror&&axis!=='vertical'?512-x:x,y:mods.hr||(mirror&&axis!=='horizontal')?384-y:y};
}
export function autoPosition(map: Beatmap, time: number, mods: VisualMods): Point {
  const i = upperBound(map.objects, time), previous = map.objects[i - 1], next = map.objects[i];
  if (!previous) {
    const target = next ? motionPoint(displayPoint(next, next, map, mods),next,map,time,mods) : {x:256,y:192};
    return lerp({x:256,y:192}, target, clamp((time - (next?.time ?? 0) + 500) / 500, 0, 1));
  }
  if (time <= previous.end) return motionPoint(displayPoint(objectPosition(previous, time), previous, map, mods),previous,map,time,mods);
  const from = motionPoint(displayPoint(objectPosition(previous, previous.end), previous, map, mods),previous,map,time,mods);
  if (!next) return from;
  const gap = next.time - previous.end;
  const start = Math.max(previous.end, next.time - Math.min(400, Math.max(80, gap)));
  const t = clamp((time - start) / Math.max(1, next.time - start), 0, 1);
  // Smooth but deterministic; seeking backwards produces the exact same cursor position.
  return lerp(from, motionPoint(displayPoint(next, next, map, mods),next,map,time,mods), t * t * (3 - 2 * t));
}
export function density(map: Beatmap, bins = 160): number[] {
  const out = Array<number>(bins).fill(0);
  for (const o of map.objects) out[Math.min(bins - 1, Math.max(0, Math.floor(o.time / map.duration * bins)))]++;
  return out;
}
const comboEvents=new WeakMap<Beatmap,number[]>();
/** Perfect-play preview combo, including slider ticks/repeats/tails; not a score simulator. */
export function autoCombo(map:Beatmap,time:number){
  let events=comboEvents.get(map);
  if(!events){events=[];for(const o of map.objects){events.push(o.kind==='spinner'?o.end:o.time);if(o.kind==='slider'){events.push(...o.tickTimes);for(let i=1;i<=o.spans;i++)events.push(o.time+i*o.spanDuration);}}events.sort((a,b)=>a-b);comboEvents.set(map,events);}
  let lo=0,hi=events.length;while(lo<hi){const mid=(lo+hi)>>1;if(events[mid]<=time)lo=mid+1;else hi=mid;}return lo;
}
