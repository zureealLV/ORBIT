/// <reference lib="webworker" />
import { unzipSync, strFromU8 } from 'fflate';
import { parseBeatmap } from './engine/parser';
import {parseStoryboard,storyboardAssets} from './engine/storyboard';
import {csv} from './engine/parser';
import {unpackSkinArchive} from './skin/archive';

let files: Record<string, Uint8Array> = {};
let normalized = new Map<string, string>();
const legacyIds = new Map<string,{id:number;setId:number}>();
export interface CatalogEntry {entry: string; id: number; version: string; ar: number; cs: number; od: number; mode: number}
const text = (data: Uint8Array) => strFromU8(data);
const normalize = (name: string) => name.replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase();
function resolveFile(entry: string, relative: string) {
  const parent = entry.includes('/') ? entry.slice(0, entry.lastIndexOf('/') + 1) : '';
  return normalized.get(normalize(parent + relative)) ?? normalized.get(normalize(relative));
}
self.onmessage = async ({data}) => {
  try {
    if(data.action==='skin'){
      const result=unpackSkinArchive(new Uint8Array(data.bytes));
      self.postMessage({request:data.request,result},{transfer:result.files.map(f=>f.bytes.buffer)});
    }else if (data.action === 'open') {
      files = {}; normalized.clear();legacyIds.clear(); let total = 0, count = 0;
      const archive = new Uint8Array(data.bytes);
      if (archive.length > 128 * 1048576) throw new Error('谱面包超过 128 MB 限制。');
      files = unzipSync(archive, {filter: file => {
        if (++count > 4096) throw new Error('压缩包文件数超过 4096。');
        const name = normalize(file.name);
        if (name.startsWith('/') || name.split('/').some(p => p === '..') || /^[a-z]:/i.test(name)) throw new Error('压缩包含不安全路径。');
        // Keep visual media, not arbitrary archive files.
        if (!/\.(osu|osb|mp3|ogg|wav|flac|m4a|jpeg|jpg|png|webp|mp4|m4v|webm|ogv|avi|mpeg|mpg)$/i.test(name)) return false;
        if (file.originalSize > 128 * 1048576 || (total += file.originalSize) > 384 * 1048576) throw new Error('解压资源超过安全大小限制。');
        return true;
      }});
      for (const name of Object.keys(files)) normalized.set(normalize(name), name);
      const catalog: CatalogEntry[] = [];
      for (const [entry, bytes] of Object.entries(files)) {
        if (!/\.osu$/i.test(entry)) continue;
        if (bytes.length > 8 * 1048576) throw new Error('单张谱面过大。');
        const source = text(bytes).split('[HitObjects]')[0];
        const value = (key: string) => source.match(new RegExp(`^${key}\\s*:\\s*(.*)$`, 'm'))?.[1]?.trim() ?? '';
        const mode = Number(value('Mode') || 0);
        if (mode !== 0) continue;
        let id=Number(value('BeatmapID'));
        if(!(id>0)&&data.id>0&&/^[a-f0-9]{64}$/.test(data.checksum??'')){
          const digest=await crypto.subtle.digest('SHA-256',bytes.slice().buffer as ArrayBuffer);
          const checksum=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
          if(checksum===data.checksum){id=data.id;legacyIds.set(entry,{id,setId:data.setId});}
        }
        catalog.push({entry, id, version:value('Version') || entry, ar:Number(value('ApproachRate') || value('OverallDifficulty') || 5), cs:Number(value('CircleSize') || 5), od:Number(value('OverallDifficulty') || 5), mode});
      }
      if (!catalog.length) throw new Error('谱面包中没有 osu!standard 难度。');
      catalog.sort((a,b) => a.od - b.od || a.ar - b.ar || a.version.localeCompare(b.version));
      self.postMessage({request:data.request, result:{catalog, size:total}});
    } else if (data.action === 'select') {
      const bytes = files[data.entry]; if (!bytes) throw new Error('难度文件不存在。');
      const map = parseBeatmap(text(bytes));
      const legacy=legacyIds.get(data.entry);if(legacy){map.id=legacy.id;map.setId=legacy.setId;}
      const audioKey = resolveFile(data.entry, map.audio), bgKey = resolveFile(data.entry, map.background);
      const audio = audioKey ? files[audioKey].slice() : null, background = bgKey ? files[bgKey].slice() : null;
      const samples = Object.entries(files).filter(([name]) => /\.(wav|ogg|mp3)$/i.test(name) && name !== audioKey && files[name].length < 4 * 1048576).slice(0, 160).map(([name, bytes]) => ({name, bytes:bytes.slice()}));
      const parent=data.entry.includes('/')?data.entry.slice(0,data.entry.lastIndexOf('/')+1):'';
      const osbs=Object.entries(files).filter(([name])=>/\.osb$/i.test(name)&&name.slice(0,name.lastIndexOf('/')+1)===parent);
      const expected=`${map.artist} - ${map.title} (${map.creator}).osb`.toLowerCase();
      const shared=osbs.length<=1?osbs:osbs.filter(([name])=>name.slice(parent.length).toLowerCase()===expected);
      const storyboard=parseStoryboard([text(bytes),...shared.map(([,b])=>text(b))]);
      if(osbs.length>1&&shared.length!==1)storyboard.warnings.push('多个共享故事板无法唯一匹配，未自动合并');
      const paths=storyboardAssets(storyboard);
      const images=paths.flatMap(name=>{const key=resolveFile(data.entry,name);return key?[{name,bytes:files[key].slice()}]:[];});
      const missing=paths.length-images.length;if(missing)storyboard.warnings.push(`${missing} 张故事板贴图缺失`);
      let eventSection=false,videoEvent:any;
      for(const line of text(bytes).split(/\r?\n/)){const clean=line.trim();if(clean.startsWith('['))eventSection=clean==='[Events]';if(!eventSection)continue;const p=csv(clean);if(p[0]==='Video'||p[0]==='1')videoEvent={path:p[2],start:Number(p[1])||0,x:Number(p[3])||0,y:Number(p[4])||0};}
      const videoKey=videoEvent?resolveFile(data.entry,videoEvent.path):undefined,video=videoKey?{event:videoEvent,bytes:files[videoKey].slice()}:null;
      map.duration=Math.max(map.duration,Math.min(storyboard.end,3600000));
      const scene={storyboard,images,video,videoMissing:!!videoEvent&&!video};
      self.postMessage({request:data.request, result:{map, audio, background, samples,scene}}, {transfer:[...images.map(i=>i.bytes.buffer),...(video?[video.bytes.buffer]:[]),...(audio ? [audio.buffer] : []), ...(background ? [background.buffer] : []), ...samples.map(s => s.bytes.buffer)]});
    }
  } catch (error) { self.postMessage({request:data.request, error: error instanceof Error ? error.message : String(error)}); }
};
