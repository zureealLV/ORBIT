import test from 'node:test';
import assert from 'node:assert/strict';
import {MODS,defaultMods,toggleMod,modOn,modSpeed,effectiveStats,objectMotion} from '../src/engine/mods.ts';
import {parseBeatmap,timingAt} from '../src/engine/parser.ts';
import {displayPoint,autoPosition,autoCombo} from '../src/engine/playback.ts';
import {difficulty} from '../src/engine/types.ts';
import {restoreMods,previewQuery} from '../src/engine/preset.ts';
const map=()=>parseBeatmap(`osu file format v14
[Difficulty]
CircleSize:4
OverallDifficulty:7
ApproachRate:9
SliderMultiplier:1.4
[TimingPoints]
0,500,4,1,0,100,1,0
1000,-50,4,1,0,100,0,0
2000,500,3,1,0,100,1,0
[HitObjects]
100,80,1000,1,0
200,100,1500,2,0,L|480:100,2,280
256,192,4000,8,0,5000
`);
test('standard catalogue has unique 48 codes and five explicitly unavailable implementations',()=>{
  assert.equal(MODS.length,48);assert.equal(new Set(MODS.map(m=>m.code)).size,48);
  assert.deepEqual(MODS.filter(m=>m.status==='pending').map(m=>m.code),['RD','TP','MG','RP','AS']);
  for(const m of MODS.filter(m=>m.status==='pending'))assert.equal(modOn(toggleMod(defaultMods(),m.code),m.code),false);
});
test('mod conflicts and legacy flags stay synchronized; disabling restores NM',()=>{
  let mods=toggleMod(defaultMods(),'HR');assert.equal(mods.hr,true);
  mods=toggleMod(mods,'EZ');assert.equal(mods.hr,false);assert.equal(mods.ez,true);
  mods=toggleMod(mods,'DA');assert.equal(mods.ez,false);
  mods=toggleMod(mods,'DT');mods=toggleMod(mods,'NC');assert.equal(modOn(mods,'DT'),false);assert.equal(modSpeed(mods),1.5);
  mods=toggleMod(mods,'NC');assert.equal(modSpeed(mods),1);
  mods=toggleMod(toggleMod(mods,'HD'),'TC');assert.equal(mods.hd,false);
});
test('HR caps at 10; DA and real-time difficulty equivalents are independent',()=>{
  const m=map();assert.equal(difficulty(m,toggleMod(defaultMods(),'HR')).ar,10);
  const mods={...toggleMod(defaultMods(),'DA'),ar:11,cs:3,od:10.5,hp:2};
  assert.equal(difficulty(m,mods).preempt,300);assert.equal(difficulty(m,mods).od,10.5);
  const stats=effectiveStats(m,defaultMods(),1.5);assert.equal(stats.effectiveAR,10.333333333333332);assert.equal(stats.bpm,180);assert.equal(m.ar,9);
});
test('Mirror transforms geometry and Auto consistently without mutating the map',()=>{
  const m=map(),mods=toggleMod(defaultMods(),'MR'),o=m.objects[0];
  assert.deepEqual(displayPoint(o,o,m,mods),{x:412,y:80});assert.deepEqual(autoPosition(m,1000,mods),{x:412,y:80});
  assert.deepEqual(displayPoint(o,o,m,{...mods,mirror:'both'}),{x:412,y:304});assert.equal(o.x,100);
});
test('preview combo includes slider ticks/repeats/tails and spinner end',()=>{
  const m=map();assert.equal(autoCombo(m,999),0);assert.equal(autoCombo(m,1000),1);
  assert.equal(autoCombo(m,1500),2);assert.equal(autoCombo(m,4000),2+m.objects[1].tickTimes.length+2);assert.equal(autoCombo(m,5000),3+m.objects[1].tickTimes.length+2);
});
test('tempo beat origin survives inherited lines and resets on same-BPM red lines',()=>{
  const m=map();assert.equal(timingAt(m.timing,1500).baseTime,0);assert.equal(timingAt(m.timing,2500).baseTime,2000);assert.equal(timingAt(m.timing,2500).meter,3);
});
test('deterministic visual motion is seekable; grow and deflate converge at hit time',()=>{
  const o=map().objects[0],mods=toggleMod(defaultMods(),'WG');assert.deepEqual(objectMotion(o,700,600,mods),objectMotion(o,700,600,mods));
  const grow=toggleMod(defaultMods(),'GR'),deflate=toggleMod(defaultMods(),'DF');assert.equal(objectMotion(o,400,600,grow).scale,.5);assert.equal(objectMotion(o,400,600,deflate).scale,2);assert.equal(objectMotion(o,1000,600,grow).scale,1);
  assert.equal(modSpeed(toggleMod(defaultMods(),'WU'),500,1000),1.25);assert.equal(modSpeed(toggleMod(defaultMods(),'WD'),1000,1000),.75);
});
test('share presets preserve custom DA and mirror settings; reject unknown/pending mods and clamp input',()=>{
  const mods={...toggleMod(toggleMod(defaultMods(),'DA'),'MR'),ar:10.2,cs:3.5,od:8,hp:4,mirror:'both' as const};
  const params=previewQuery(123,10500.8,mods,1.25),restored=restoreMods(params);
  assert.deepEqual(restored,mods);assert.equal(params.get('t'),'10500');
  const unsafe=restoreMods(new URLSearchParams({m:'HR,MR,RD,TP,INVALID',mc:'{"ar":999,"seed":-9,"mirror":"invalid","__proto__":{"polluted":1}}'}));
  assert.equal(unsafe.hr,false);assert.equal(unsafe.ar,11);assert.equal(unsafe.seed,1);assert.equal(unsafe.mirror,'horizontal');assert.equal(modOn(unsafe,'RD'),false);assert.equal(({} as Record<string,unknown>).polluted,undefined);
  assert.deepEqual(restoreMods(new URLSearchParams({mc:'null'})),defaultMods());
});
