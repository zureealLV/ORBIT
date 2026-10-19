export interface Point { x: number; y: number }
export interface SliderPath { points: Point[]; distances: number[]; length: number }
export interface Timing { time: number; beat: number; sv: number; sampleSet: number; sampleIndex: number; volume: number; kiai: boolean; baseTime?:number;meter?:number }
export interface Sample { normal: number; addition: number; index: number; volume: number; filename: string }
export interface HitObject extends Point {
  id: number; kind: 'circle' | 'slider' | 'spinner'; time: number; end: number;
  sound: number; sample: Sample; combo: number; color: number; colorIndex?:number; stack: number;
  path?: SliderPath; spans: number; spanDuration: number; length: number;
  edgeSounds: number[]; edgeSets: string[]; tickTimes: number[];
}
export interface Beatmap {
  id: number; setId: number; format: number; mode: number;
  title: string; artist: string; creator: string; version: string;
  audio: string; background: string; preview: number; leadIn: number; sampleSet: number;
  ar: number; cs: number; od: number; hp: number; sliderMultiplier: number; tickRate: number;
  stackLeniency: number; colors: string[]; objects: HitObject[]; timing: Timing[];
  breaks: {start: number; end: number}[]; bookmarks: number[];
  duration: number; bpm: number; warnings: string[];
}
export interface VisualMods {
  hr:boolean;ez:boolean;hd:boolean;active?:string[];
  mirror?:'horizontal'|'vertical'|'both';ar?:number;cs?:number;od?:number;hp?:number;
  speed?:number;strength?:number;seed?:number;
}
export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const preempt = (ar: number) => ar < 5 ? 1800 - 120 * ar : 1200 - 150 * (ar - 5);
export function difficulty(map: Beatmap, mods: VisualMods) {
  const multiplier = mods.hr ? 1.4 : mods.ez ? 0.5 : 1;
  const da=mods.active?.includes('DA');
  const ar = clamp(da?mods.ar??map.ar:map.ar * multiplier, 0, da?11:10);
  const cs = clamp(da?mods.cs??map.cs:map.cs * (mods.hr ? 1.3 : mods.ez ? 0.5 : 1), 0, 10);
  const od=clamp(da?mods.od??map.od:map.od*multiplier,0,da?11:10),hp=clamp(da?mods.hp??map.hp:map.hp*multiplier,0,10);
  return { ar, cs, od,hp, radius: 54.4 - 4.48 * cs, preempt: Math.max(150,preempt(ar)) };
}
