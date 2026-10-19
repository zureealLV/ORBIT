import test from 'node:test';
import assert from 'node:assert/strict';
import {parseStoryboard,spriteState,framePath,easing,storyboardAssets,safeAsset} from '../src/engine/storyboard';
import {videoTarget,safeImageHeader} from '../src/engine/scene';
const scene=(body:string)=>parseStoryboard(['[Events]\n'+body]);
test('storyboard interpolates all properties, holds endpoints and is random-access seekable',()=>{
  const s=scene('Sprite,Background,Centre,"bg.png",320,240\n F,0,0,4000,1\n M,0,1000,2000,0,50,100,150\n MX,0,2500,3000,100,200\n V,0,0,1000,1,2,3,4\n C,0,0,1000,0,0,0,255,128,64\n R,0,0,1000,0,3.14').sprites[0];
  assert.equal(spriteState(s,-1),null);assert.equal(spriteState(s,4001),null);
  assert.equal(spriteState(s,1500)!.x,50);assert.equal(spriteState(s,1500)!.y,100);assert.equal(spriteState(s,2750)!.x,150);
  const state=spriteState(s,500)!;assert.equal(state.sx,2);assert.equal(state.sy,3);assert.equal(state.rotation,1.57);assert.deepEqual(state.color,[127.5,64,32]);
  assert.deepEqual(spriteState(s,500),state);
});
test('loops remain compact at 100,000 repeats and evaluate later iterations and final values',()=>{
  const s=scene('Sprite,Foreground,Centre,"particle.png",320,240\n L,1000,100000\n  F,0,0,500,0,1\n  F,0,500,1000,1,0\n S,0,0,200000000,1').sprites[0];
  assert.equal(s.tracks.flatMap(t=>t.commands).length,3);
  assert.equal(spriteState(s,2250)!.alpha,.5);assert.equal(spriteState(s,100001250)!.alpha,0);
  assert.deepEqual(spriteState(s,2250),spriteState(s,1250));
});
test('shorthand, variables, animation paths including single-frame animations',()=>{
  const sb=parseStoryboard(['[Variables]\n$img=SB\\frame.png\n[Events]\nAnimation,Overlay,TopLeft,"$img",10,20,3,100,LoopOnce\n F,0,0,100,0,1,0,1\nAnimation,0,0,"a.png",0,0,1,50\n F,0,0,1000,1']);
  const s=sb.sprites[0];assert.equal(s.end,300);assert.equal(spriteState(s,150)!.alpha,.5);assert.equal(framePath(s,100),'sb/frame1.png');assert.equal(framePath(s,300),'sb/frame2.png');
  assert.ok(storyboardAssets(sb).includes('a0.png'));assert.equal(framePath(sb.sprites[1],50),'a0.png');
});
test('loop period excludes the leading empty child-command interval',()=>{
  const s=scene('Sprite,0,0,"x.png",0,0\n L,1000,3\n  F,0,500,1000,0,1').sprites[0];
  assert.equal(s.start,1500);assert.equal(s.end,3000);assert.equal(spriteState(s,2250)!.alpha,.5);
});
test('parameter endpoints reset, zero-duration flags persist and Fail layer is not drawn in Auto',()=>{
  const s=scene('Sprite,Pass,Centre,"a.png",0,0\n F,0,0,3000,1\n P,0,0,,A\n P,0,500,1000,H\n P,0,1500,2000,A').sprites[0];
  assert.equal(spriteState(s,750)!.flipH,true);assert.equal(spriteState(s,1200)!.flipH,false);assert.equal(spriteState(s,250)!.additive,true);assert.equal(spriteState(s,2500)!.additive,false);
  s.layer=1;assert.equal(spriteState(s,750),null);
});
test('inline then shared ordering; unsupported triggers are skipped rather than made unconditional',()=>{
  const sb=parseStoryboard(['[Events]\nSprite,Background,Centre,"a.png",0,0\n T,HitSound,0,1000\n  F,0,0,1000,1\n S,0,2000,3000,1','[Events]\nSprite,Foreground,Centre,"b.png",0,0\n F,0,0,1000,1']);
  assert.equal(sb.sprites[0].start,2000);assert.equal(sb.sprites[1].order,1);assert.ok(sb.warnings.some(w=>w.includes('触发器')));
});
test('all 35 easing functions have finite output and exact endpoints',()=>{for(let id=0;id<35;id++){assert.equal(easing(id,0),0);assert.equal(easing(id,1),1);for(let i=0;i<=100;i++)assert.ok(Number.isFinite(easing(id,i/100)));}});
test('storyboard paths cannot reference external URLs or traverse directories',()=>{for(const path of ['../a.png','C:\\a.png','https://x/a.png','/a.png'])assert.equal(safeAsset(path),false);assert.equal(scene('Sprite,0,0,"../a.png",0,0').sprites.length,0);});
test('video offsets, ends and seeks use map milliseconds rather than practice-rate-scaled time',()=>{const event={path:'v.mp4',start:2000,x:0,y:0};assert.equal(videoTarget(event,1000,10),null);assert.equal(videoTarget(event,2000,10),0);assert.equal(videoTarget(event,5000,10),3);assert.equal(videoTarget(event,12000,10),null);});
test('oversized PNG textures are rejected before browser decompression',()=>{const bytes=new Uint8Array(24),view=new DataView(bytes.buffer);bytes.set([137,80,78,71]);view.setUint32(16,100);view.setUint32(20,200);assert.ok(safeImageHeader(bytes));view.setUint32(16,60000);assert.equal(safeImageHeader(bytes),false);});
