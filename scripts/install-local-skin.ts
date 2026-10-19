import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {zipSync} from 'fflate';
import {unpackSkinArchive} from '../src/skin/archive.ts';
const input=process.argv[2];if(!input)throw new Error('Pass the absolute path of an authorized local .osk file.');
const original=await readFile(input),skin=unpackSkinArchive(original);
// Preserve source ini verbatim in the trimmed archive, never overwrite the source OSK.
const {unzipSync}=await import('fflate');
const ini=Object.entries(unzipSync(original,{filter:f=>/(^|\/)skin\.ini$/i.test(f.name)})).sort((a,b)=>a[0].length-b[0].length)[0][1];
const assets=Object.fromEntries(skin.files.map(f=>[f.name,f.bytes]));assets['skin.ini']=ini;
const archive=zipSync(assets);await mkdir('.cache/skins',{recursive:true});
await writeFile('.cache/skins/default.osk',archive);
await writeFile('.cache/skins/source.json',JSON.stringify({name:skin.config.name,author:skin.config.author,sha256:createHash('sha256').update(original).digest('hex'),originalBytes:original.length,selectedBytes:archive.length,assets:skin.files.length},null,2));
console.log(JSON.stringify({name:skin.config.name,author:skin.config.author,originalBytes:original.length,selectedBytes:archive.length,assets:skin.files.length}));
