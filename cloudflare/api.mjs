import { validId, metadata, isZip } from '../server/validation.mjs';
import { createSearch } from '../server/search.mjs';

const MAX_METADATA = 2 * 1024 * 1024;
const MAX_ARCHIVE = 128 * 1024 * 1024;
const failure = (message, status = 502) => Object.assign(new Error(message), {status});
const json = (value, status = 200) => Response.json(value, {status, headers:{
  'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff',
  ...(status === 429 ? {'Retry-After':'60'} : {}),
}});

async function boundedBytes(response, limit) {
  if (!response.ok) { await response.body?.cancel(); throw failure(`上游 HTTP ${response.status}`); }
  if (!response.body || Number(response.headers.get('Content-Length')) > limit) {
    await response.body?.cancel(); throw failure('上游响应超过安全大小限制');
  }
  const reader=response.body.getReader(), chunks=[];let size=0;
  try {
    while(true){const {done,value}=await reader.read();if(done)break;
      size+=value.length;if(size>limit)throw failure('上游响应超过安全大小限制');chunks.push(value);}
  } catch(error){await reader.cancel().catch(()=>{});throw error;}
  const bytes=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return bytes;
}

// Validate the prefix before returning headers, then stream with backpressure.
// Never buffer a whole 128 MB archive inside a 128 MB Worker isolate.
async function archiveStream(response, limit) {
  if(!response.ok){await response.body?.cancel();throw failure(`镜像 HTTP ${response.status}`);}
  if(!response.body || Number(response.headers.get('Content-Length'))>limit){
    await response.body?.cancel();throw failure('谱面包超过 128 MB 上限',413);
  }
  const reader=response.body.getReader(), initial=[], signature=new Uint8Array(4);
  let size=0, collected=0;
  try {
    while(collected<4){
      const {done,value}=await reader.read();if(done)throw failure('镜像没有返回完整谱面压缩包');
      size+=value.length;if(size>limit)throw failure('谱面包超过 128 MB 上限',413);
      const take=Math.min(4-collected,value.length);signature.set(value.subarray(0,take),collected);collected+=take;initial.push(value);
    }
    if(!isZip(signature))throw failure('镜像返回内容不是谱面压缩包');
  } catch(error){await reader.cancel().catch(()=>{});throw error;}
  return new ReadableStream({
    async pull(controller){
      try{
        if(initial.length){controller.enqueue(initial.shift());return;}
        const {done,value}=await reader.read();if(done){controller.close();return;}
        size+=value.length;if(size>limit)throw failure('谱面包超过 128 MB 上限',413);
        controller.enqueue(value);
      }catch(error){await reader.cancel().catch(()=>{});controller.error(error);}
    },
    cancel(reason){return reader.cancel(reason);},
  });
}

export function createOrbitHandler({fetcher=fetch, maxArchive=MAX_ARCHIVE, now=Date.now}={}) {
  const metaCache=new Map(), rate=new Map();
  const get = (url, timeout=15000) => fetcher(url, {signal:AbortSignal.timeout(timeout),headers:{'User-Agent':'OrbitOsuReader/0.1 (web beatmap preview)'}});
  async function locate(id) {
    const cached=metaCache.get(id);if(cached && cached.until>now())return cached;
    const bytes=await boundedBytes(await get(`https://osu.ppy.sh/osu/${id}`),MAX_METADATA);
    const text=new TextDecoder().decode(bytes);let setId;
    try {({setId}=metadata(text,id));}
    catch(error){
      // Preserve exact-byte binding for legacy maps; never guess their difficulty.
      if(!/^\uFEFF?osu file format v\d+/m.test(text) || Number(text.match(/^BeatmapID\s*:\s*(\d+)/m)?.[1])>0)throw error;
      const payload=JSON.parse(new TextDecoder().decode(await boundedBytes(await get(`https://api.sayobot.cn/v2/beatmapinfo?K=${id}&T=1`),MAX_METADATA)));
      if(payload.status!==0 || !validId(payload.data?.sid) || !payload.data?.bid_data?.some(row=>Number(row.bid)===Number(id)))throw failure('无法定位旧谱，请导入本地 .osz');
      setId=Number(payload.data.sid);
    }
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    const checksum=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
    const result={setId,checksum,until:now()+600000};metaCache.set(id,result);
    if(metaCache.size>128)metaCache.delete(metaCache.keys().next().value);
    return result;
  }
  function checkRate(request, archive) {
    // Best-effort per-isolate guard, not a distributed quota or authentication.
    const key=(request.headers.get('CF-Connecting-IP') ?? 'local')+(archive?':archive':':search');
    let entry=rate.get(key);if(!entry || entry.until<=now()){entry={count:0,until:now()+60000};rate.set(key,entry);}
    if(++entry.count>(archive?6:30))throw failure('请求过于频繁，请稍后重试',429);
    if(rate.size>512)rate.delete(rate.keys().next().value);
  }
  return async function handleRequest(request) {
    try {
      const url=new URL(request.url);
      if(!url.pathname.startsWith('/api/orbit/'))return json({error:'Not found'},404);
      if(!['GET','HEAD'].includes(request.method))return json({error:'Method not allowed'},405);
      if((request.headers.get('Origin') && request.headers.get('Origin')!==url.origin) || request.headers.get('Sec-Fetch-Site')==='cross-site')return json({error:'跨源请求已拒绝'},403);
      const path=url.pathname.slice('/api/orbit/'.length);
      let response;
      if(path==='health')response=json({name:'orbit-osu-reader',version:'0.1.0',accessMode:'cloud',engine:'independent-typescript-canvas2d'});
      else if(path==='skins/default')response=json({error:'云端使用内置皮肤；自定义 .osk 请在浏览器本地导入，不会上传。'},404);
      else if(path==='search'){
        const query=url.searchParams.get('q')??'';if(!validId(query))return json({error:'请输入 1–8 位谱面或谱面集 ID'},400);
        checkRate(request,false);
        response=json({results:await createSearch(fetcher)(query)});
      }else{
        const match=path.match(/^beatmaps\/([1-9]\d{0,7})\/(archive|progress)$/);
        if(!match)return json({error:'无效的谱面请求'},400);
        if(match[2]==='progress')response=json({phase:'loading',detail:'云端正在定位并流式传输谱面…'});
        else{
          checkRate(request,true);const {setId,checksum}=await locate(match[1]);let stream,source;const errors=[];
          for(const [name,address] of [['Sayobot',`https://dl.sayobot.cn/beatmaps/download/${setId}`],['Nerinyan',`https://api.nerinyan.moe/d/${setId}`]]){
            try{stream=await archiveStream(await get(address,120000),maxArchive);source=name;break;}
            catch(error){errors.push(error.message);}
          }
          if(!stream)throw failure('在线谱面暂不可用，请重试或导入本地 .osz。'+errors.join('；'));
          response=new Response(stream,{headers:{
            'Content-Type':'application/x-osu-beatmap-archive','Cache-Control':'private, no-store',
            'X-Content-Type-Options':'nosniff','X-Resource-Source':source+'-cloud',
            'X-Beatmap-Checksum':checksum,'X-Beatmap-Set':String(setId),
          }});
        }
      }
      if(request.method==='HEAD'){await response.body?.cancel();return new Response(null,{status:response.status,headers:response.headers});}
      return response;
    }catch(error){return json({error:error.message || '云端请求失败，请导入本地 .osz'},error.status ?? 502);}
  };
}

export const handleRequest = createOrbitHandler();
