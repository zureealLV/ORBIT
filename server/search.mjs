import {validId} from './validation.mjs';

const clean = value => String(value ?? '').slice(0, 240);
const finite = value => Number.isFinite(Number(value)) ? Number(value) : 0;
export function searchRows(payload, query) {
  const d=payload?.data;
  if(payload?.status!==0 || !validId(d?.sid) || !Array.isArray(d.bid_data)) return [];
  return d.bid_data.filter(b=>Number(b.mode)===0 && validId(b.bid)).slice(0,100).map(b=>({
    id:Number(b.bid),setId:Number(d.sid),title:clean(d.titleU||d.title),artist:clean(d.artistU||d.artist),
    creator:clean(d.creator),version:clean(b.version),stars:finite(b.star),length:finite(b.length),
    bpm:finite(d.bpm),ar:finite(b.AR),cs:finite(b.CS),od:finite(b.OD),
    video:!!Number(d.video),storyboard:!!Number(d.storyboard),exact:Number(b.bid)===Number(query),
    cover:`https://assets.ppy.sh/beatmaps/${Number(d.sid)}/covers/cover.jpg`,
  }));
}

export function createSearch(fetcher=fetch) {
  const cache=new Map(),pending=new Map();
  return async function search(query) {
    if(!validId(query)) throw Object.assign(new Error('请输入 1–8 位谱面或谱面集 ID'),{status:400});
    const hit=cache.get(query);if(hit&&hit.until>Date.now())return hit.rows;
    if(pending.has(query))return pending.get(query);
    if(pending.size>=4)throw Object.assign(new Error('搜索繁忙，请稍后重试'),{status:429});
    const task=(async()=>{
      // Exact difficulty + exact set lookup. These are metadata requests, never archive downloads.
      const responses=await Promise.allSettled([1,2].map(async type=>{
        const res=await fetcher(`https://api.sayobot.cn/v2/beatmapinfo?K=${query}&T=${type}`,{signal:AbortSignal.timeout(10000)});
        if(!res.ok)throw new Error(`搜索服务 HTTP ${res.status}`);
        let size=0;const chunks=[];
        for await(const chunk of res.body){size+=chunk.length;if(size>2*1048576)throw new Error('搜索响应过大');chunks.push(chunk);}
        const bytes=new Uint8Array(size);let offset=0;
        for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
        const payload=JSON.parse(new TextDecoder().decode(bytes));
        if(![0,-1].includes(payload.status))throw new Error('搜索服务暂不可用');
        // Ignore unrelated upstream data instead of showing a misleading match.
        if(payload.status===0 && (type===2?Number(payload.data?.sid)!==Number(query):!payload.data?.bid_data?.some(b=>Number(b.bid)===Number(query))))return [];
        return searchRows(payload,query);
      }));
      if(responses.every(r=>r.status==='rejected'))throw new Error('无法连接谱面搜索，请重试');
      const rows=[...new Map(responses.flatMap(r=>r.status==='fulfilled'?r.value:[]).map(r=>[r.id,r])).values()].sort((a,b)=>Number(b.exact)-Number(a.exact)||b.stars-a.stars);
      // Do not cache a transient outage as an empty result.
      if(!rows.length && responses.some(r=>r.status==='rejected'))throw new Error('部分搜索请求失败，请重试');
      cache.set(query,{rows,until:Date.now()+60000});if(cache.size>128)cache.delete(cache.keys().next().value);
      return rows;
    })().finally(()=>pending.delete(query));
    pending.set(query,task);return task;
  };
}
