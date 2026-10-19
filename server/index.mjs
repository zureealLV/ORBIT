import http from 'node:http';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createResources, validId } from './resources.mjs';
import {createSearch} from './search.mjs';
const search = createSearch();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid PORT');
const production = process.argv.includes('--production');
const resources = createResources(path.join(root, '.cache', 'beatmaps'));
const vite = production ? null : await (await import('vite')).createServer({root, server: {middlewareMode: true}, appType: 'spa'});
const json = (res, code, value) => {res.writeHead(code, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'}); res.end(JSON.stringify(value));};
const mime = {'.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.woff2':'font/woff2', '.wasm':'application/wasm'};
const server = http.createServer(async (req, res) => {
  try {
    const host = req.headers.host ?? '';
    if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(host)) return json(res, 403, {error:'仅允许本机访问'});
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    const url = new URL(req.url, `http://${host}`);
    if (!['GET', 'HEAD'].includes(req.method)) return json(res, 405, {error:'Method not allowed'});
    if (url.pathname === '/api/health') return json(res, 200, {name:'orbit-osu-reader', version:'0.1.0', engine:'independent-typescript-canvas2d'});
    if (url.pathname.startsWith('/api/')) {
      if (req.headers.origin && ![`http://127.0.0.1:${port}`, `http://localhost:${port}`].includes(req.headers.origin)) return json(res, 403, {error:'跨源请求已拒绝'});
      if(url.pathname==='/api/skins/default'){
        try{
          const bytes=await fs.readFile(path.join(root,'.cache','skins','default.osk'));
          res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':bytes.length,'Cache-Control':'no-store'});
          return res.end(req.method==='HEAD'?undefined:bytes);
        }catch(error){if(error.code==='ENOENT')return json(res,404,{error:'尚未安装本地默认皮肤'});throw error;}
      }
      if(url.pathname==='/api/search') return json(res,200,{results:await search(url.searchParams.get('q')??'')});
      const match = url.pathname.match(/^\/api\/beatmaps\/([^/]+)\/(archive|progress)$/);
      if (!match || !validId(match[1])) return json(res, 400, {error:'请输入单难度谱面 ID（1–8 位正整数）'});
      if (match[2] === 'progress') return json(res, 200, resources.progress(match[1]));
      const result = await resources.get(match[1]);
      res.writeHead(200, {'Content-Type':'application/x-osu-beatmap-archive', 'Content-Length':result.bytes.length, 'X-Resource-Source':result.source, 'X-Beatmap-Checksum':result.checksum, 'X-Beatmap-Set':String(result.setId), 'Cache-Control':'private, max-age=3600'});
      return res.end(req.method === 'HEAD' ? undefined : result.bytes);
    }
    if (vite) return vite.middlewares(req, res, () => json(res, 404, {error:'Not found'}));
    const base = path.join(root, 'dist'), pathname = decodeURIComponent(url.pathname);
    let file = path.resolve(base, `.${pathname}`);
    if (!file.startsWith(base + path.sep) && file !== base) return json(res, 403, {error:'Forbidden'});
    try { if (!(await fs.stat(file)).isFile()) file = path.join(base, 'index.html'); } catch { if (path.extname(pathname)) return json(res,404,{error:'Not found'}); file = path.join(base,'index.html'); }
    const bytes = await fs.readFile(file);
    res.writeHead(200, {'Content-Type':mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control':file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache'});
    res.end(req.method === 'HEAD' ? undefined : bytes);
  } catch (error) { console.error(error.message); if (!res.headersSent) json(res, error.status ?? 502, {error:error.message}); else res.end(); }
});
server.listen(port, '127.0.0.1', () => console.log(`\n  ORBIT · osu! Map Reader\n  http://127.0.0.1:${port}\n  ${production ? 'Production' : 'Development'} · local only\n`));
const shutdown = async () => { await vite?.close(); server.close(); };
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
