import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { parseBeatmap } from '../src/engine/parser.ts';

// Optional integration check against downloaded resources; not part of fixture tests.
const root=path.resolve('.cache/beatmaps');let checked=0;
for(const name of (await readdir(root)).filter(n=>n.endsWith('.osz'))){
  const files=unzipSync(await readFile(path.join(root,name)),{filter:f=>/\.osu$/i.test(f.name)});
  for(const [entry,bytes] of Object.entries(files)){
    const source=strFromU8(bytes);if(/^Mode\s*:\s*[1-3]/m.test(source))continue;
    const map=parseBeatmap(source);
    for(const o of map.objects){
      if(!Number.isFinite(o.end)||o.end<o.time)throw new Error(`Invalid timing: ${entry}`);
      if(o.path?.points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))throw new Error(`Invalid geometry: ${entry}`);
    }
    console.log(JSON.stringify({archive:name,id:map.id,difficulty:map.version,objects:map.objects.length,duration:Math.round(map.duration)}));checked++;
  }
}
if(!checked)throw new Error('No cached standard maps found');
console.log(`Validated ${checked} real difficulties; geometry/timing checks only, not visual parity.`);
