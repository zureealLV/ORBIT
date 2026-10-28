import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { validId, metadata, isZip } from './validation.mjs';
export { validId, metadata, isZip } from './validation.mjs';

export const MAX_ARCHIVE = 128 * 1024 * 1024;
async function boundedFetch(url, max, timeout = 60000) {
  const res = await fetch(url, {signal: AbortSignal.timeout(timeout), headers: {'User-Agent': 'OrbitOsuReader/0.1 (local beatmap preview)'}});
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (Number(res.headers.get('content-length')) > max) { await res.body?.cancel(); throw new Error('文件超过安全大小限制'); }
  const chunks = []; let size = 0;
  for await (const chunk of res.body) { size += chunk.length; if (size > max) throw new Error('文件超过安全大小限制'); chunks.push(chunk); }
  return Buffer.concat(chunks);
}
export function createResources(cacheRoot) {
  const inflight = new Map(), progress = new Map();
  async function trimCache(keep) {
    const items = await Promise.all((await fs.readdir(cacheRoot)).filter(n => /^\d+(?:\.full)?\.osz$/.test(n)).map(async name => ({name, ...await fs.stat(path.join(cacheRoot, name))})));
    let total = items.reduce((n, x) => n + x.size, 0);
    for (const item of items.sort((a, b) => a.mtimeMs - b.mtimeMs)) {
      if (total <= 512 * 1024 * 1024) break;
      if (item.name === keep) continue;
      await fs.unlink(path.join(cacheRoot, item.name)); total -= item.size;
    }
  }
  async function download(id) {
    await fs.mkdir(cacheRoot, {recursive: true});
    const report = (phase, detail) => { progress.set(id, {phase, detail}); };
    report('locating', '获取谱面信息');
    const osu = await boundedFetch(`https://osu.ppy.sh/osu/${id}`, 2 * 1024 * 1024, 15000);
    const sourceText=osu.toString('utf8');let setId;
    try { ({setId}=metadata(sourceText,id)); }
    catch(error){
      // Old ranked files can omit IDs entirely. Resolve the set externally,
      // then bind the requested difficulty to official bytes with SHA-256.
      if(!/^\uFEFF?osu file format v\d+/m.test(sourceText)||Number(sourceText.match(/^BeatmapID\s*:\s*(\d+)/m)?.[1])>0)throw error;
      report('locating','旧谱缺少 ID，正在查询谱面集映射');
      const info=JSON.parse((await boundedFetch(`https://api.sayobot.cn/v2/beatmapinfo?K=${id}&T=1`,2*1024*1024,15000)).toString('utf8'));
      if(info.status!==0||!validId(info.data?.sid)||!info.data?.bid_data?.some(b=>Number(b.bid)===Number(id)))throw new Error('无法定位旧谱的谱面集，请导入本地 .osz。');
      setId=Number(info.data.sid);
    }
    const checksum=createHash('sha256').update(osu).digest('hex');
    const file = path.join(cacheRoot, `${setId}.full.osz`);
    try {
      const cached = await fs.readFile(file);
      if (isZip(cached)) { report('ready', '命中本地缓存'); await fs.utimes(file, new Date(), new Date()); return {bytes: cached, source: 'cache', setId, checksum}; }
    } catch (e) { if (e.code !== 'ENOENT') console.warn('Cache read:', e.message); }
    const sources = [
      ['Sayobot', `https://dl.sayobot.cn/beatmaps/download/${setId}`],
      ['Nerinyan', `https://api.nerinyan.moe/d/${setId}`],
    ];
    const errors = [];
    for (const [source, url] of sources) {
      report('downloading', `正在从 ${source} 获取谱面包`);
      try {
        const bytes = await boundedFetch(url, MAX_ARCHIVE);
        if (!isZip(bytes)) throw new Error('返回内容不是谱面压缩包');
        const tmp = `${file}.${id}.partial`; await fs.writeFile(tmp, bytes); await fs.rename(tmp, file).catch(async error => { await fs.unlink(tmp).catch(() => {}); if (error.code !== 'EEXIST' && error.code !== 'EPERM') throw error; });
        await trimCache(`${setId}.full.osz`); report('ready', `${source} · ${(bytes.length / 1048576).toFixed(1)} MB`);
        return {bytes, source, setId, checksum};
      } catch (error) { errors.push(`${source}: ${error.message}`); }
    }
    throw new Error(`在线资源暂不可用，请重试或导入本地 .osz。${errors.join('；')}`);
  }
  return {
    progress(id) { return progress.get(id) ?? {phase: 'idle', detail: '等待加载'}; },
    get(id) {
      if (!validId(id)) return Promise.reject(new Error('谱面 ID 必须是 1–8 位正整数'));
      if (inflight.has(id)) return inflight.get(id);
      if (inflight.size >= 2) return Promise.reject(Object.assign(new Error('同时加载过多，请稍后重试'), {status: 429}));
      const promise = download(id).catch(error => { progress.set(id, {phase: 'error', detail: error.message}); throw error; }).finally(() => { inflight.delete(id); if (progress.size > 100) progress.delete(progress.keys().next().value); });
      inflight.set(id, promise); return promise;
    },
  };
}
