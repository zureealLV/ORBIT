import test from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { parseSkinIni,unpackSkinArchive,chooseSkinImage } from '../src/skin/archive.ts';

test('skin.ini handles CRCRLF, comments, repeated mania sections and legacy colours',()=>{
  const config=parseSkinIni('[General]\r\r\nName: Spoo\r\r\nCursorRotate: 0\n[Colours]\nCombo1:150,230,255\nCombo2:255,125,177\nCombo3:130,255,160 // green\nSliderBorder:150,150,150\nSliderTrackOverride:10,10,10\n[Fonts]\nHitCirclePrefix:Fonts/Numbers/default\nHitCircleOverlap:18\n[Mania]\nKeys:1\n[Mania]\nKeys:2');
  assert.equal(config.name,'Spoo');assert.equal(config.cursorRotate,false);assert.equal(config.fontOverlap,18);
  assert.deepEqual(config.combos,['rgb(255,125,177)','rgb(130,255,160)','rgb(150,230,255)']);
  assert.equal(config.sliderTrack,'rgb(10,10,10)');assert.equal(config.fontPrefix,'fonts/numbers/default');
});
test('@2x selection is case-insensitive and uses logical half dimensions',()=>{
  assert.deepEqual(chooseSkinImage(['hitcircle.png','HitCircle@2x.PNG'],'hitcircle'),{name:'HitCircle@2x.PNG',scale:2});
  assert.equal(chooseSkinImage([],'cursor'),undefined);
});
test('skin ZIP selects only gameplay assets under the config root',()=>{
  const bytes=zipSync({'Skin/skin.ini':strToU8('[Fonts]\nHitCirclePrefix:Fonts/num'),
    'Skin/hitcircle.png':new Uint8Array([1]),'Skin/Fonts/num-1@2x.png':new Uint8Array([2]),
    'Skin/normal-hitnormal.mp3':new Uint8Array([3]),'Skin/menu-background.jpg':new Uint8Array([4]),'Skin/evil.exe':new Uint8Array([5])});
  const result=unpackSkinArchive(bytes);assert.equal(result.files.length,3);
  assert.ok(result.files.some(f=>f.name==='fonts/num-1@2x.png'));
});
test('skin archive rejects traversal, missing config and missing hitcircle',()=>{
  assert.throws(()=>unpackSkinArchive(zipSync({'../skin.ini':strToU8('x')})),/不安全/);
  assert.throws(()=>unpackSkinArchive(zipSync({'hitcircle.png':new Uint8Array([0])})),/skin.ini/);
  assert.throws(()=>unpackSkinArchive(zipSync({'skin.ini':strToU8('[General]')})),/hitcircle/);
});

test('untrusted INI section names cannot modify object prototypes',()=>{
  parseSkinIni('[__proto__]\nORBIT_POLLUTED: yes\n[General]\nName: safe');
  assert.equal(({} as Record<string,string>).ORBIT_POLLUTED,undefined);
});
