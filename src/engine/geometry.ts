import { clamp, distance, lerp, type Point, type SliderPath } from './types';

// Independently implemented bounded adaptive subdivision. No external osu! engine.
function bezier(control: Point[], out: Point[], depth = 0) {
  if (control.length < 2) return;
  let polygon = 0;
  for (let i = 1; i < control.length; i++) polygon += distance(control[i - 1], control[i]);
  if (depth >= 12 || polygon - distance(control[0], control.at(-1)!) < 0.15 || out.length > 32000) {
    out.push(control.at(-1)!); return;
  }
  const left = [control[0]], right = [control.at(-1)!];
  let row = control;
  while (row.length > 1) {
    row = row.slice(1).map((p, i) => lerp(row[i], p, 0.5));
    left.push(row[0]); right.push(row.at(-1)!);
  }
  bezier(left, out, depth + 1); bezier(right.reverse(), out, depth + 1);
}
function bezierSegments(points: Point[]) {
  const out = [points[0]];
  let start = 0;
  for (let i = 1; i < points.length; i++) {
    if (i === points.length - 1 || distance(points[i], points[i + 1]) < 0.00001) {
      bezier(points.slice(start, i + 1), out); start = i + 1;
    }
  }
  return out;
}
function circular(points: Point[]): Point[] | undefined {
  if (points.length !== 3) return;
  const [a, b, c] = points;
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 0.001) return;
  const aa = a.x ** 2 + a.y ** 2, bb = b.x ** 2 + b.y ** 2, cc = c.x ** 2 + c.y ** 2;
  const center = { x: (aa * (b.y - c.y) + bb * (c.y - a.y) + cc * (a.y - b.y)) / d, y: (aa * (c.x - b.x) + bb * (a.x - c.x) + cc * (b.x - a.x)) / d };
  const radius = distance(a, center), start = Math.atan2(a.y - center.y, a.x - center.x);
  let sweep = Math.atan2(c.y - center.y, c.x - center.x) - start;
  const direction = Math.sign((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x));
  if (direction > 0) { while (sweep < 0) sweep += Math.PI * 2; }
  else { while (sweep > 0) sweep -= Math.PI * 2; }
  const count = clamp(Math.ceil(Math.abs(sweep) * radius / 2), 2, 16000);
  return Array.from({length: count + 1}, (_, i) => ({x: center.x + Math.cos(start + sweep * i / count) * radius, y: center.y + Math.sin(start + sweep * i / count) * radius}));
}
function catmull(points: Point[]) {
  const out: Point[] = [points[0]];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i], p2 = points[i + 1];
    // osu!'s C paths use uniform (not centripetal) Catmull-Rom.
    const p0 = points[i - 1] ?? p1, p3 = points[i + 2] ?? lerp(p1, p2, 2);
    const steps = 50;
    for (let n = 1; n <= steps; n++) {
      const t=n/steps,t2=t*t,t3=t2*t;
      const coordinate=(a:number,b:number,c:number,d:number)=>.5*(2*b+(c-a)*t+(2*a-5*b+4*c-d)*t2+(3*b-a-3*c+d)*t3);
      out.push({x:coordinate(p0.x,p1.x,p2.x,p3.x),y:coordinate(p0.y,p1.y,p2.y,p3.y)});
    }
  }
  return out;
}
export function buildPath(type: string, control: Point[], expectedLength: number): SliderPath {
  if (!control.length) control = [{x: 256, y: 192}];
  const sampled = type === 'L' ? control : type === 'P' ? (circular(control) ?? bezierSegments(control)) : type === 'C' ? catmull(control) : bezierSegments(control);
  const points = [sampled[0]], distances = [0];
  const target = clamp(expectedLength, 0, 100000);
  for (let i = 1; i < sampled.length; i++) {
    const prev = points.at(-1)!, step = distance(prev, sampled[i]);
    if (step < 0.00001) continue;
    const previous = distances.at(-1)!;
    if (previous + step >= target) { points.push(lerp(prev, sampled[i], (target - previous) / step)); distances.push(target); break; }
    points.push(sampled[i]); distances.push(previous + step);
  }
  if (points.length > 1 && distances.at(-1)! < target) {
    const a = points.at(-2)!, b = points.at(-1)!;
    points.push(lerp(b, {x: b.x + b.x - a.x, y: b.y + b.y - a.y}, (target - distances.at(-1)!) / distance(a, b)));
    distances.push(target);
  }
  return { points, distances, length: distances.at(-1)! };
}
export function pathPosition(path: SliderPath, progress: number): Point {
  const target = path.length * clamp(progress, 0, 1);
  let lo = 0, hi = path.distances.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (path.distances[mid] < target) lo = mid + 1; else hi = mid; }
  if (!lo) return path.points[0];
  const length = path.distances[lo] - path.distances[lo - 1];
  return lerp(path.points[lo - 1], path.points[lo], length ? (target - path.distances[lo - 1]) / length : 0);
}
