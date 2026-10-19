import { buildPath, pathPosition } from './geometry';
import { clamp, preempt, type Beatmap, type HitObject, type Timing, type Sample } from './types';

const num = (s: string | undefined, fallback = 0) => s !== undefined && s.trim() !== '' && Number.isFinite(Number(s)) ? Number(s) : fallback;
export function csv(line: string): string[] {
  const fields:string[]=[];let field='',quoted=false;
  for(const char of line){if(char==='"')quoted=!quoted;else if(char===','&&!quoted){fields.push(field);field='';}else field+=char;}
  fields.push(field);return fields;
}
export function sample(s = ''): Sample { const p = s.split(':'); return { normal: num(p[0]), addition: num(p[1]), index: num(p[2]), volume: num(p[3]), filename: p.slice(4).join(':') }; }
export function timingAt(points: Timing[], t: number): Timing {
  let lo = 0, hi = points.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (points[mid].time <= t) lo = mid + 1; else hi = mid; }
  return points[Math.max(0, lo - 1)];
}
export function parseBeatmap(text: string): Beatmap {
  if (!/^\uFEFF?osu file format v\d+/m.test(text)) throw new Error('文件不是有效的 .osu 谱面。');
  const sections: Record<string, string[]> = {}; let section = '';
  for (const raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.trim(); if (!line || line.startsWith('//')) continue;
    if (/^\[.+\]$/.test(line)) { section = line.slice(1, -1); sections[section] ??= []; }
    else if (section) sections[section].push(line);
  }
  const keys = (name: string) => Object.fromEntries((sections[name] ?? []).map(l => { const i = l.indexOf(':'); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
  const g = keys('General'), m = keys('Metadata'), d = keys('Difficulty'), e = keys('Editor');
  const colors = Object.entries(keys('Colours')).filter(([k]) => /^Combo\d+$/.test(k)).map(([, v]) => { const rgb = v.split(',').map(n => clamp(num(n), 0, 255)); return `rgb(${rgb.join(',')})`; });
  const mode = num(g.Mode); if (mode !== 0) throw new Error('第一版仅支持 osu!standard；不支持 Taiko / Catch / Mania，也不会假装转谱。');
  const map: Beatmap = {
    format: Number(text.match(/format v(\d+)/)?.[1] ?? 14), id: num(m.BeatmapID), setId: num(m.BeatmapSetID), mode,
    title: m.TitleUnicode || m.Title || 'Untitled', artist: m.ArtistUnicode || m.Artist || 'Unknown artist', creator: m.Creator || 'Unknown', version: m.Version || 'Unnamed',
    audio: g.AudioFilename ?? '', background: '', preview: num(g.PreviewTime, -1), leadIn: clamp(num(g.AudioLeadIn), 0, 60000), sampleSet: g.SampleSet === 'Soft' ? 2 : g.SampleSet === 'Drum' ? 3 : 1,
    ar: clamp(num(d.ApproachRate, num(d.OverallDifficulty, 5)), 0, 10), cs: clamp(num(d.CircleSize, 5), 0, 10), od: clamp(num(d.OverallDifficulty, 5), 0, 10), hp: clamp(num(d.HPDrainRate, 5), 0, 10),
    sliderMultiplier: clamp(num(d.SliderMultiplier, 1.4), 0.1, 20), tickRate: clamp(num(d.SliderTickRate, 1), 0.1, 16), stackLeniency: clamp(num(g.StackLeniency, 0.7), 0, 1),
    colors: colors.length ? colors : ['#b5bdfa', '#e8add2', '#9ddacc', '#e8c491'], objects: [], timing: [], breaks: [], bookmarks: (e.Bookmarks ?? '').split(',').filter(Boolean).map(n => num(n)), duration: 0, bpm: 0, warnings: [],
  };
  for (const line of sections.Events ?? []) {
    const p = csv(line);
    if ((p[0] === '0' || p[0] === 'Background') && p[1] === '0') map.background = p[2] ?? '';
    if (p[0] === '2' || p[0] === 'Break') map.breaks.push({start: num(p[1]), end: num(p[2])});
  }
  let current: Timing = {time: -Infinity, beat: 500, sv: 1, sampleSet: map.sampleSet, sampleIndex: 0, volume: 100, kiai: false};
  map.timing.push({...current});
  const timingLines = (sections.TimingPoints ?? []).map(l => l.split(',')).sort((a, b) => num(a[0]) - num(b[0]));
  for (const p of timingLines) {
    const beat = num(p[1], 500), red = p[6] === undefined ? beat > 0 : p[6] === '1';
    current = {time: num(p[0]), beat: red && beat > 0 ? beat : current.beat, sv: red ? 1 : beat < 0 ? clamp(-100 / beat, 0.1, 10) : current.sv, sampleSet: num(p[3]) || map.sampleSet, sampleIndex: num(p[4]), volume: clamp(num(p[5], 100), 0, 100), kiai: Boolean(num(p[7]) & 1),baseTime:red?num(p[0]):current.baseTime,meter:red?Math.max(1,num(p[2],4)):current.meter};
    map.timing.push(current);
  }
  const objectLines = sections.HitObjects ?? [];
  if (objectLines.length > 100000) throw new Error('谱面物件超过 100,000 个，已停止解析。');
  let combo = 0, color = 0,colorIndex=0;
  for (const line of objectLines) {
    const p = line.split(','); if (p.length < 5 || !Number.isFinite(Number(p[2]))) continue;
    const flag = num(p[3]), kind = flag & 1 ? 'circle' : flag & 2 ? 'slider' : flag & 8 ? 'spinner' : null;
    if (!kind) continue;
    if (flag & 4 || !map.objects.length) { combo = 1; if (map.objects.length){colorIndex+=1+((flag>>4)&7);color=colorIndex%map.colors.length;} } else combo++;
    const o: HitObject = {id: map.objects.length, x: clamp(num(p[0]), -4096, 4096), y: clamp(num(p[1]), -4096, 4096), time: num(p[2]), end: num(p[2]), kind, sound: num(p[4]), sample: sample(p[kind === 'slider' ? 10 : kind === 'spinner' ? 6 : 5]), combo, color, stack: 0, spans: 1, spanDuration: 0, length: 0, edgeSounds: [], edgeSets: [], tickTimes: []};
    o.colorIndex=colorIndex;
    if (kind === 'spinner') { o.x = 256; o.y = 192; o.end = Math.max(o.time, num(p[5], o.time)); }
    if (kind === 'slider') {
      const curve = (p[5] ?? '').split('|');
      const anchors = [{x: o.x, y: o.y}, ...curve.slice(1).slice(0, 256).map(s => { const [x, y] = s.split(':'); return {x: clamp(num(x), -4096, 4096), y: clamp(num(y), -4096, 4096)}; })];
      o.length = clamp(num(p[7]), 0, 100000); o.path = buildPath(curve[0], anchors, o.length);
      o.spans = clamp(Math.floor(num(p[6], 1)), 1, 1000);
      const timing = timingAt(map.timing, o.time);
      o.spanDuration = o.length / (map.sliderMultiplier * 100 * timing.sv) * timing.beat;
      o.end = o.time + o.spanDuration * o.spans;
      o.edgeSounds = (p[8] ?? '').split('|').map(n => num(n)); o.edgeSets = (p[9] ?? '').split('|');
      const tickDistance = map.sliderMultiplier * 100 * (map.format < 8 ? 1 : timing.sv) / map.tickRate;
      if (tickDistance > 0 && o.length / tickDistance * o.spans < 20000) {
        for (let span = 0; span < o.spans; span++) for (let pos = tickDistance; pos < o.length - 0.1; pos += tickDistance) {
          const progress = span % 2 ? 1 - pos / o.length : pos / o.length;
          o.tickTimes.push(o.time + (span + progress) * o.spanDuration);
        }
        o.tickTimes.sort((a, b) => a - b);
      }
    }
    map.objects.push(o);
  }
  map.objects.sort((a, b) => a.time - b.time); map.objects.forEach((o, i) => o.id = i);
  if (!map.objects.length) throw new Error('谱面中没有可预览的 standard 物件。');
  map.duration = Math.max(...map.objects.map(o => o.end)) + 1500;
  const weighted = new Map<number, number>();
  map.timing.slice(1).forEach((t, i, all) => weighted.set(t.beat, (weighted.get(t.beat) ?? 0) + Math.max(0, (all[i + 1]?.time ?? map.duration) - Math.max(0, t.time))));
  const beat = [...weighted.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 500; map.bpm = 60000 / beat;
  map.warnings = [...new Set(map.warnings)];
  if (map.format < 6) map.warnings.push('早期 v3–v5 堆叠仅近似还原');
  applyStacking(map, map.ar, map.cs);
  return map;
}
export function applyStacking(map: Beatmap, ar: number, cs: number) {
  const objects = map.objects, threshold = preempt(ar) * map.stackLeniency;
  for (const o of objects) o.stack = 0;
  const near = (a: {x: number; y: number}, b: {x: number; y: number}) => Math.hypot(a.x - b.x, a.y - b.y) < 3;
  for (let i = objects.length - 1; i >= 0; i--) {
    let current = objects[i]; if (current.stack || current.kind === 'spinner') continue;
    for (let n = i - 1; n >= 0; n--) {
      const prev = objects[n]; if (prev.kind === 'spinner') continue;
      if (current.time - (current.kind === 'circle' ? prev.end : prev.time) > threshold) break;
      const end = prev.path ? pathPosition(prev.path, prev.spans % 2 ? 1 : 0) : prev;
      if (current.kind === 'circle' && prev.kind === 'slider' && near(end, current)) {
        const offset = current.stack - prev.stack + 1;
        for (let j = n + 1; j <= i; j++) if (near(end, objects[j])) objects[j].stack -= offset;
        break;
      }
      if (near(current.kind === 'slider' ? end : prev, current)) { prev.stack = current.stack + 1; current = prev; }
    }
  }
  // Heights stay logical; renderer applies the current CS-scaled offset.
  void cs;
}
