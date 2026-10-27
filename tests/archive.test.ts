import test from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';

let reply:any;
const endpoint={onmessage:null as any,postMessage:(data:any)=>{reply=data;}};
Object.defineProperty(globalThis,'self',{value:endpoint,configurable:true});
await import('../src/archive.worker.ts');
const invoke=async(action:string,data:Record<string,unknown>)=>{reply=undefined;await endpoint.onmessage({data:{request:1,action,...data}});return reply;};
const map=`osu file format v14
[General]
AudioFilename: Music.MP3
Mode: 0
[Metadata]
Title: Worker fixture
Version: Hard
BeatmapID: 123
[HitObjects]
256,192,1000,1,0,0:0:0:0:
`;

test('OSZ worker catalogs standard maps and resolves case-insensitive assets',async()=>{
  const bytes=zipSync({'folder/map.osu':strToU8(map),'folder/music.mp3':new Uint8Array([1,2,3])});
  const result=await invoke('open',{bytes:bytes.buffer});
  assert.equal(result.result.catalog.length,1);assert.equal(result.result.catalog[0].id,123);
  const selected=await invoke('select',{entry:'folder/map.osu'});
  assert.equal(selected.result.map.objects.length,1);assert.equal(selected.result.audio.length,3);
});
test('OSZ worker rejects path traversal, invalid zip and unsupported modes',async()=>{
  const unsafe=zipSync({'../map.osu':strToU8(map)});
  assert.match((await invoke('open',{bytes:unsafe.buffer})).error,/不安全路径/);
  assert.ok((await invoke('open',{bytes:new Uint8Array([1,2,3]).buffer})).error);
  const mania=zipSync({'map.osu':strToU8(map.replace('Mode: 0','Mode: 3'))});
  assert.match((await invoke('open',{bytes:mania.buffer})).error,/standard/);
});
test('legacy difficulty IDs are attached only to the exact official bytes',async()=>{
  const old=strToU8(map.replace('BeatmapID: 123\n',''));
  const digest=await crypto.subtle.digest('SHA-256',old.slice().buffer);
  const checksum=Buffer.from(digest).toString('hex');
  const bytes=zipSync({'map.osu':old});
  const match=await invoke('open',{bytes:bytes.buffer,id:131564,setId:41686,checksum});
  assert.equal(match.result.catalog[0].id,131564);
  assert.equal((await invoke('select',{entry:'map.osu'})).result.map.id,131564);
  const mismatch=await invoke('open',{bytes:bytes.buffer,id:131564,setId:41686,checksum:'0'.repeat(64)});
  assert.equal(mismatch.result.catalog[0].id,0);
});
test('worker includes shared/inline storyboard images, animation frames and video with relative case-insensitive lookup',async()=>{
  const source=map+'\n[Events]\nVideo,250,"clip.MP4"\nSprite,Background,Centre,"SB\\Still.PNG",320,240\n F,0,0,1000,1\n';
  const shared='[Events]\nAnimation,Foreground,Centre,"sb/frame.png",320,240,2,100\n F,0,500,4000,1';
  const bytes=zipSync({'folder/map.osu':strToU8(source),'folder/shared.osb':strToU8(shared),'folder/clip.mp4':new Uint8Array([1,2,3]),'folder/sb/still.png':new Uint8Array([1]),'folder/sb/frame0.png':new Uint8Array([2]),'folder/sb/frame1.png':new Uint8Array([3])});
  await invoke('open',{bytes:bytes.buffer});const result=(await invoke('select',{entry:'folder/map.osu'})).result;
  assert.equal(result.scene.storyboard.sprites.length,2);assert.equal(result.scene.images.length,3);assert.equal(result.scene.video.event.start,250);assert.equal(result.scene.video.bytes.length,3);assert.equal(result.map.duration,4000);
});

test('legacy map checksum matching works on an HTTP LAN without Web Crypto',async()=>{
  const old=strToU8(map.replace('BeatmapID: 123\n',''));
  const {createHash}=await import('node:crypto');
  const checksum=createHash('sha256').update(old).digest('hex');
  const bytes=zipSync({'map.osu':old});
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto');
  Object.defineProperty(globalThis,'crypto',{value:{},configurable:true});
  try{
    const result=await invoke('open',{bytes:bytes.buffer,id:131564,setId:41686,checksum});
    assert.equal(result.error,undefined);
    assert.equal(result.result.catalog[0].id,131564);
    const mismatch=await invoke('open',{bytes:bytes.buffer,id:131564,setId:41686,checksum:'0'.repeat(64)});
    assert.equal(mismatch.result.catalog[0].id,0);
  }finally{if(descriptor)Object.defineProperty(globalThis,'crypto',descriptor);else Reflect.deleteProperty(globalThis,'crypto');}
});
