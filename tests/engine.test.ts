import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPath, pathPosition } from '../src/engine/geometry.ts';
import { parseBeatmap, timingAt, applyStacking, csv } from '../src/engine/parser.ts';
import { autoPosition, density, objectPosition } from '../src/engine/playback.ts';
import { beatmapId } from '../src/input.ts';
import { difficulty } from '../src/engine/types.ts';

const fixture=(objects:string,extra='')=>`osu file format v14
[General]
AudioFilename: song.mp3
Mode: 0
StackLeniency: 0.7
[Metadata]
Title: Test
Artist: Artist
Version: Hard
BeatmapID: 123
BeatmapSetID: 42
[Difficulty]
CircleSize: 4
OverallDifficulty: 7
ApproachRate: 9
SliderMultiplier: 1.4
SliderTickRate: 1
[Events]
0,0,"bg, test.jpg",0,0
[TimingPoints]
0,500,4,1,0,100,1,0
1000,-50,4,2,0,80,0,0
3000,400,4,1,0,100,1,0
${extra}
[HitObjects]
${objects}`;
const mods={hr:false,ez:false,hd:false};
test('event CSV retains empty fields and quoted commas',()=>{
  assert.deepEqual(csv('0,0,"bg, test.jpg",,0'),['0','0','bg, test.jpg','','0']);
});
test('C path uses uniform Catmull-Rom rather than centripetal timing',()=>{
  const curve=buildPath('C',[{x:0,y:0},{x:100,y:100},{x:300,y:0}],1000);
  assert.equal(curve.points[25].x,37.5);assert.equal(curve.points[25].y,56.25);
});
test('ID accepts raw IDs, new/old URLs and rejects set IDs / arbitrary hosts',()=>{
  assert.equal(beatmapId(' 738063 '),738063);
  assert.equal(beatmapId('https://osu.ppy.sh/beatmapsets/320118#osu/738063'),738063);
  assert.equal(beatmapId('https://osu.ppy.sh/b/738063'),738063);
  assert.throws(()=>beatmapId('https://osu.ppy.sh/beatmapsets/320118'));
  assert.throws(()=>beatmapId('https://evil.test/beatmaps/738063'));
  assert.throws(()=>beatmapId('0')); assert.throws(()=>beatmapId('123456789'));
});
test('linear path is trimmed and extended to declared pixel length',()=>{
  const p=buildPath('L',[{x:0,y:0},{x:100,y:0}],50);
  assert.equal(p.length,50);assert.deepEqual(pathPosition(p,1),{x:50,y:0});
  assert.deepEqual(pathPosition(buildPath('L',[{x:0,y:0},{x:100,y:0}],200),1),{x:200,y:0});
});
test('perfect-circle arc passes through middle and ends on expected circle',()=>{
  const p=buildPath('P',[{x:100,y:0},{x:0,y:100},{x:-100,y:0}],Math.PI*100);
  const middle=pathPosition(p,.5);assert.ok(Math.abs(middle.x)<.1);assert.ok(Math.abs(middle.y-100)<.1);assert.ok(Math.abs(pathPosition(p,1).x+100)<.1);
});
test('collinear P falls back; repeated B anchors form connected segments',()=>{
  assert.deepEqual(pathPosition(buildPath('P',[{x:0,y:0},{x:50,y:0},{x:100,y:0}],100),1),{x:100,y:0});
  const p=buildPath('B',[{x:0,y:0},{x:50,y:0},{x:50,y:0},{x:50,y:50}],100);
  assert.deepEqual(pathPosition(p,.5),{x:50,y:0});assert.deepEqual(pathPosition(p,1),{x:50,y:50});
});
test('uniform C, one-point and zero-length paths stay finite',()=>{
  for(const type of ['B','P','C','L']){
    for(const points of [[{x:10,y:10}],[{x:0,y:0},{x:30,y:100},{x:100,y:100}]]){
      const p=buildPath(type,points,100);const end=pathPosition(p,.8);assert.ok(Number.isFinite(end.x)&&Number.isFinite(end.y));
    }
  }
  assert.equal(buildPath('L',[{x:0,y:0},{x:10,y:0}],0).length,0);
});
test('timing points reset SV on red lines and derive slider span duration',()=>{
  const m=parseBeatmap(fixture('100,100,1000,2,0,L|380:100,2,280\n100,100,3000,2,0,L|380:100,1,280'));
  assert.equal(timingAt(m.timing,1100).sv,2);assert.equal(timingAt(m.timing,3000).sv,1);
  assert.equal(m.objects[0].spanDuration,500);assert.equal(m.objects[0].end,2000);
  assert.equal(m.objects[1].spanDuration,800);assert.equal(m.background,'bg, test.jpg');
});
test('slider reverses at repeat and ends at head after even spans',()=>{
  const m=parseBeatmap(fixture('100,100,1000,2,0,L|380:100,2,280'));const o=m.objects[0];
  assert.deepEqual(objectPosition(o,1500),{x:380,y:100});assert.deepEqual(objectPosition(o,2000),{x:100,y:100});
  assert.equal(o.tickTimes.length,0); // one beat spans, no internal ticks at an endpoint
});
test('ticks are inside each span, sorted across repeats',()=>{
  const m=parseBeatmap(fixture('0,0,1000,2,0,L|560:0,2,560'));const o=m.objects[0];
  assert.deepEqual(o.tickTimes,[1500,2500]);
});
test('combo colours, skip bits and numbering survive parsing',()=>{
  const m=parseBeatmap(fixture('100,100,1000,5,0\n200,100,1200,1,0\n300,100,1400,21,0'));
  assert.deepEqual(m.objects.map(o=>o.combo),[1,2,1]);assert.equal(m.objects[2].color,2);
});

test('absolute combo ordinal supports skins with a different colour count',()=>{
  const m=parseBeatmap(fixture(Array.from({length:7},(_,i)=>`100,100,${1000+i*300},5,0`).join('\n')));
  assert.deepEqual(m.objects.map(o=>o.colorIndex),[0,1,2,3,4,5,6]);
  assert.deepEqual(m.objects.map(o=>o.colorIndex!%3),[0,1,2,0,1,2,0]);
});
test('stacking and HR transform remain deterministic across mod changes',()=>{
  const m=parseBeatmap(fixture('100,100,1000,1,0\n100,100,1100,1,0'));
  assert.ok(m.objects[0].stack>m.objects[1].stack);
  const normal=autoPosition(m,1100,mods);const hr=autoPosition(m,1100,{...mods,hr:true});assert.equal(normal.y+hr.y,384);
  applyStacking(m,9,4);const first=autoPosition(m,1050,mods);autoPosition(m,2000,mods);assert.deepEqual(autoPosition(m,1050,mods),first);
});
test('density counts every object once and difficulty caps HR',()=>{
  const m=parseBeatmap(fixture('100,100,1000,1,0\n100,100,1100,1,0'));
  assert.equal(density(m).reduce((a,b)=>a+b,0),2);assert.equal(difficulty(m,{...mods,hr:true}).ar,10);
});
test('non-standard, malformed and empty maps fail clearly',()=>{
  assert.throws(()=>parseBeatmap('not a map'));
  assert.throws(()=>parseBeatmap(fixture('100,100,1000,1,0').replace('Mode: 0','Mode: 3')),/standard/);
  assert.throws(()=>parseBeatmap(fixture('')),/物件/);
});
