import test from 'node:test';
import assert from 'node:assert/strict';
import { PlaybackClock } from '../src/engine/audio.ts';

class FakeAudio extends EventTarget {
  currentTime=0;duration=1;playbackRate=1;preservesPitch=false;preload='';paused=true;
  removeAttribute(){} load(){} pause(){this.paused=true;}
  async play(){this.paused=false;}
}
// The clock is tested without a browser codec, network or wall-clock sleeps.
Object.defineProperty(globalThis,'Audio',{value:FakeAudio,configurable:true});

test('music currentTime is authoritative; pause and seek remain stable',async()=>{
  const clock=new PlaybackClock();clock.hasAudio=true;clock.duration=5000;
  await clock.play();clock.audio.currentTime=.7;
  assert.equal(clock.time(),700);clock.pause();clock.audio.currentTime=.8;
  assert.equal(clock.time(),700);clock.seek(1200);assert.equal(clock.time(),1200);
  clock.setRate(9);assert.equal(clock.rate,4);assert.equal(clock.audio.playbackRate,4);clock.setRate(.01);assert.equal(clock.rate,.25);
  clock.seek(-50);assert.equal(clock.time(),0);
});

test('short music does not truncate later hit objects; seeking back resumes music',async()=>{
  const clock=new PlaybackClock();clock.hasAudio=true;clock.duration=5000;
  await clock.play();clock.audio.currentTime=1;clock.audio.dispatchEvent(new Event('ended'));
  assert.equal(clock.playing,true);assert.ok(clock.time()>=1000&&clock.time()<1100);
  clock.seek(3000);assert.ok(clock.time()>=3000);assert.equal(clock.audio.paused,true);
  clock.seek(500);assert.equal(clock.audio.currentTime,.5);assert.equal(clock.audio.paused,false);
  clock.dispose();
});

test('a silent map can seek and restart from its end',async()=>{
  const clock=new PlaybackClock();await clock.load(undefined,5000);
  clock.seek(5000);await clock.play();assert.ok(clock.time()<100);clock.pause();
  const paused=clock.time();assert.equal(clock.time(),paused);clock.dispose();
});
