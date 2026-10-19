import test from 'node:test';
import assert from 'node:assert/strict';
import {Hitsounds,type PlaybackClock} from '../src/engine/audio.ts';
import {parseBeatmap} from '../src/engine/parser.ts';

class FakeAudioContext {
  static played:{tag:number;length:number}[]=[];
  sampleRate=48000;currentTime=0;destination={};
  createGain(){return {gain:{value:1},connect(){},disconnect(){}};}
  createBuffer(_channels:number,length:number){return {tag:0,length,getChannelData:()=>new Float32Array(length)};}
  async decodeAudioData(bytes:ArrayBuffer){return {tag:new Uint8Array(bytes)[0],length:1000};}
  createBufferSource(){return {buffer:undefined as any,connect(){},stop(){},onended:null,start(){FakeAudioContext.played.push(this.buffer);}};}
}
const sample=(name:string,tag:number,length=256)=>({name,bytes:new Uint8Array(length).fill(tag)});
const map=(object='100,100,1000,1,0,0:0:0:100:custom.wav')=>parseBeatmap(`osu file format v14\n[General]\nMode:0\n[Difficulty]\nSliderMultiplier:1\nSliderTickRate:1\n[TimingPoints]\n0,500,4,1,1,100,1,0\n[HitObjects]\n${object}`);
const clock={playing:true,rate:1,time:()=>1000} as PlaybackClock;

test('skin preference overrides map sound and survives map reload; toggle restores custom sample',async()=>{
  Object.assign(globalThis,{AudioContext:FakeAudioContext});FakeAudioContext.played=[];
  const sounds=new Hitsounds();
  await sounds.setSkin([sample('normal-hitnormal.wav',11)]);
  await sounds.load(map(),[sample('custom.wav',22)]);sounds.tick(clock);
  assert.equal(FakeAudioContext.played.at(-1)?.tag,11);
  sounds.preferSkin=false;sounds.reset(1000);sounds.tick(clock);
  assert.equal(FakeAudioContext.played.at(-1)?.tag,22);
  sounds.preferSkin=true;await sounds.load(map(),[]);sounds.tick(clock);
  assert.equal(FakeAudioContext.played.at(-1)?.tag,11);
});

test('header-only skin sample remains silent instead of falling back to a click',async()=>{
  Object.assign(globalThis,{AudioContext:FakeAudioContext});FakeAudioContext.played=[];
  const sounds=new Hitsounds();await sounds.setSkin([sample('normal-hitnormal.wav',99,44)]);
  await sounds.load(map('100,100,1000,1,0'),[]);sounds.tick(clock);
  assert.equal(sounds.skinLoaded,1);assert.equal(FakeAudioContext.played.at(-1)?.length,1);
});
test('Nightcore schedules original synthesized drums independently, without duplicate beats after reset',async()=>{
  Object.assign(globalThis,{AudioContext:FakeAudioContext});FakeAudioContext.played=[];
  const sounds=new Hitsounds(),m=map();await sounds.load(m,[]);sounds.configureNightcore(m);sounds.enabled=false;sounds.nightcore=true;
  const at=(time:number)=>({...clock,time:()=>time}) as PlaybackClock;
  sounds.tick(at(0));assert.equal(FakeAudioContext.played.length,2); // kick + crash approximation
  sounds.tick(at(0));assert.equal(FakeAudioContext.played.length,2);
  sounds.tick(at(500));assert.equal(FakeAudioContext.played.length,3);
  sounds.reset(500);sounds.tick(at(500));assert.equal(FakeAudioContext.played.length,4);
});
test('Nightcore handles a first red timing point after zero rather than generating NaN timestamps',async()=>{
  Object.assign(globalThis,{AudioContext:FakeAudioContext});FakeAudioContext.played=[];
  const sounds=new Hitsounds(),m=map();m.timing=m.timing.map(t=>Number.isFinite(t.time)?{...t,time:500,baseTime:500}:t);
  await sounds.load(m,[]);sounds.configureNightcore(m);sounds.enabled=false;sounds.nightcore=true;
  sounds.tick({...clock,time:()=>0} as PlaybackClock);assert.equal(FakeAudioContext.played.length,0);
  sounds.tick({...clock,time:()=>500} as PlaybackClock);assert.equal(FakeAudioContext.played.length,2);
});
