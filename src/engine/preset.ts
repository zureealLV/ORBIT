import {defaultMods,toggleMod} from './mods';
import {clamp,type VisualMods} from './types';
const ranges={ar:[0,11],cs:[0,10],od:[0,11],hp:[0,10],speed:[.5,2],strength:[.1,3],seed:[1,99999]} as const;
export function restoreMods(params:URLSearchParams){
  let mods=defaultMods();
  for(const code of (params.get('m')??'').slice(0,300).split(','))mods=toggleMod(mods,code==='CM'?'CN':code);
  try{const config=JSON.parse((params.get('mc')??'{}').slice(0,600));
    for(const key of Object.keys(ranges) as (keyof typeof ranges)[]){const [min,max]=ranges[key];if(typeof config[key]==='number'&&Number.isFinite(config[key]))mods[key]=clamp(config[key],min,max);}
    if(['horizontal','vertical','both'].includes(config.mirror))mods.mirror=config.mirror;
  }catch{/* Invalid/untrusted query configuration falls back to safe defaults. */}
  return mods;
}
export function previewQuery(id:number,time:number,mods:VisualMods,rate:number){
  const config:Record<string,unknown>={mirror:mods.mirror};for(const key of Object.keys(ranges) as (keyof typeof ranges)[]){const value=mods[key];if(typeof value==='number'&&Number.isFinite(value))config[key]=value;}
  return new URLSearchParams({b:String(id),t:String(Math.floor(time)),m:(mods.active??[]).join(','),mc:JSON.stringify(config),r:String(rate)});
}
