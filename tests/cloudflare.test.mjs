import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createOrbitHandler } from '../cloudflare/api.mjs';

const map = 'osu file format v14\n[Metadata]\nBeatmapID:738063\nBeatmapSetID:320118\n';
const archive = new Uint8Array([80,75,3,4,1,2,3,4]);
const metadata = {status:0,data:{sid:320118,title:'No title',artist:'Reol',bid_data:[{bid:738063,mode:0,version:'Hard',star:4}]}};
const request = (path, init) => new Request('https://zureeallv.com/api/orbit/' + path, init);
const fixtureFetch = async url => {
  if(url.startsWith('https://api.sayobot.cn/v2/beatmapinfo?')) return Response.json(metadata);
  if(url === 'https://osu.ppy.sh/osu/738063') return new Response(map);
  if(url === 'https://dl.sayobot.cn/beatmaps/download/320118') return new Response(archive);
  throw new Error('Unexpected upstream: ' + url);
};

test('cloud deployment provides health, numeric search and a checksum-bound streamed archive', async () => {
  const handle = createOrbitHandler({fetcher:fixtureFetch});
  assert.equal((await handle(request('health'))).status, 200);
  const search = await handle(request('search?q=738063'));
  assert.equal(search.status, 200);
  assert.equal((await search.json()).results[0].id, 738063);
  const result = await handle(request('beatmaps/738063/archive'));
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('X-Beatmap-Set'), '320118');
  assert.equal(result.headers.get('X-Beatmap-Checksum'), createHash('sha256').update(map).digest('hex'));
  assert.deepEqual(new Uint8Array(await result.arrayBuffer()), archive);
});

test('cloud API refuses cross-site requests, arbitrary IDs and non-read methods without contacting upstreams', async () => {
  let calls=0;const handle=createOrbitHandler({fetcher:async()=>{calls++;throw new Error('Must not fetch');}});
  assert.equal((await handle(request('search?q=https://evil.example'))).status,400);
  assert.equal((await handle(request('beatmaps/01/archive'))).status,400);
  assert.equal((await handle(request('beatmaps/1/archive',{headers:{Origin:'https://evil.example'}}))).status,403);
  assert.equal((await handle(request('search?q=1',{headers:{'Sec-Fetch-Site':'cross-site'}}))).status,403);
  assert.equal((await handle(request('search?q=1',{method:'POST'}))).status,405);
  assert.equal((await handle(request('skins/default'))).status,404);
  assert.equal(calls,0);
});

test('cloud archives reject HTML mirrors and fall back without proxying user-controlled URLs', async () => {
  const urls=[];
  const handle=createOrbitHandler({fetcher:async url=>{
    urls.push(url);
    if(url.startsWith('https://dl.sayobot.cn/'))return new Response('<html>blocked</html>');
    if(url==='https://api.nerinyan.moe/d/320118')return new Response(archive);
    return fixtureFetch(url);
  }});
  const result=await handle(request('beatmaps/738063/archive?url=https://evil.example'));
  assert.equal(result.status,200);assert.equal(result.headers.get('X-Resource-Source'),'Nerinyan-cloud');
  assert.deepEqual(new Uint8Array(await result.arrayBuffer()),archive);
  assert.ok(urls.every(url=>!url.includes('evil.example')));
});

test('cloud archives reject mismatched official IDs and oversized initial responses', async () => {
  const wrong=createOrbitHandler({fetcher:async url=>url.startsWith('https://osu.ppy.sh/')?new Response(map.replace('738063','999')):fixtureFetch(url)});
  assert.equal((await wrong(request('beatmaps/738063/archive'))).status,502);
  const large=createOrbitHandler({maxArchive:4,fetcher:fixtureFetch});
  assert.equal((await large(request('beatmaps/738063/archive'))).status,502);
});

test('stream size caps are enforced even without Content-Length and after headers were sent', async () => {
  const handle=createOrbitHandler({maxArchive:8,fetcher:async url=>{
    if(url.startsWith('https://dl.sayobot.cn/')){
      let i=0;
      return new Response(new ReadableStream({pull(controller){
        if(i++===0)controller.enqueue(archive);else controller.enqueue(new Uint8Array([1,2,3]));
      }}));
    }
    return fixtureFetch(url);
  }});
  const result=await handle(request('beatmaps/738063/archive'));
  assert.equal(result.status,200);
  await assert.rejects(result.arrayBuffer(),/128 MB/);
});

test('legacy maps retain exact official-byte checksum binding in the cloud',async()=>{
  const old=map.replace('BeatmapID:738063\n','');
  const handle=createOrbitHandler({fetcher:async url=>url==='https://osu.ppy.sh/osu/738063'?new Response(old):fixtureFetch(url)});
  const response=await handle(request('beatmaps/738063/archive'));
  assert.equal(response.status,200);
  assert.equal(response.headers.get('X-Beatmap-Checksum'),createHash('sha256').update(old).digest('hex'));
  await response.body.cancel();
});

test('cloud download rate guard is bounded and resets after its window',async()=>{
  let time=0;const handle=createOrbitHandler({fetcher:fixtureFetch,now:()=>time});
  for(let i=0;i<6;i++){const response=await handle(request('beatmaps/738063/archive'));assert.equal(response.status,200);await response.body.cancel();}
  const limited=await handle(request('beatmaps/738063/archive'));assert.equal(limited.status,429);assert.equal(limited.headers.get('Retry-After'),'60');
  time=60001;
  const restored=await handle(request('beatmaps/738063/archive'));assert.equal(restored.status,200);await restored.body.cancel();
});
