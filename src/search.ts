import {deployment} from './deployment';
export interface SearchRow {id:number;setId:number;title:string;artist:string;creator:string;version:string;stars:number;length:number;bpm:number;ar:number;cs:number;od:number;video:boolean;storyboard:boolean;exact:boolean;cover:string}
export interface SearchGroup extends SearchRow {difficultyCount:number;minStars:number;maxStars:number}
/** One card per beatmap set; an exact difficulty remains the click target. */
export function groupSearchRows(rows:SearchRow[]):SearchGroup[] {
  const sets=new Map<number,Map<number,SearchRow>>();
  for(const row of rows){let set=sets.get(row.setId);if(!set){set=new Map();sets.set(row.setId,set);}const old=set.get(row.id);if(!old||row.exact)set.set(row.id,row);}
  return [...sets.values()].map(set=>{
    const difficulties=[...set.values()].sort((a,b)=>Number(b.exact)-Number(a.exact)||b.stars-a.stars||a.id-b.id),row=difficulties[0];
    return {...row,difficultyCount:difficulties.length,minStars:Math.min(...difficulties.map(d=>d.stars)),maxStars:Math.max(...difficulties.map(d=>d.stars))};
  }).sort((a,b)=>Number(b.exact)-Number(a.exact)||a.setId-b.setId);
}
export function searchId(value:string):string|null {
  const q=value.trim();if(/^[1-9]\d{0,7}$/.test(q))return q;
  try {const u=new URL(q);if(!['osu.ppy.sh','www.osu.ppy.sh'].includes(u.hostname)||u.protocol!=='https:')return null;
    const id=u.hash.match(/^#(?:osu|taiko|fruits|mania)\/(\d+)$/)?.[1]??u.pathname.match(/^\/(?:b|s|beatmaps|beatmapsets)\/(\d+)\/?$/)?.[1];return id&&/^[1-9]\d{0,7}$/.test(id)?id:null;
  }catch{return null;}
}
export function mountSearch(input:HTMLInputElement,box:HTMLElement,onSelect:(id:string)=>void) {
  let timer:ReturnType<typeof setTimeout>,controller:AbortController|undefined,version=0,expansion:Animation|undefined;
  const heading=document.createElement('div'),list=document.createElement('div');heading.className='search-results-heading';heading.setAttribute('role','status');list.className='search-result-list';box.append(heading,list);
  input.setAttribute('aria-controls',box.id);input.setAttribute('aria-expanded','false');
  const resize=(update:()=>void)=>{expansion?.cancel();const from=box.hidden?0:box.getBoundingClientRect().height;update();const to=box.getBoundingClientRect().height;if(from!==to&&!matchMedia('(prefers-reduced-motion: reduce)').matches)expansion=box.animate([{height:`${from}px`,opacity:from?1:0},{height:`${to}px`,opacity:1}],{duration:220,easing:'cubic-bezier(.2,.8,.2,1)'});};
  const hide=()=>{expansion?.cancel();box.hidden=true;input.setAttribute('aria-expanded','false');};
  const show=()=>{box.hidden=false;input.setAttribute('aria-expanded','true');};
  function cancel(){clearTimeout(timer);controller?.abort();version++;}
  async function run(id:string,token:number) {
    controller=new AbortController();resize(()=>{show();heading.textContent='正在匹配谱面…';list.replaceChildren();});
    try {
      const response=await fetch(deployment.api(`search?q=${id}`),{signal:controller.signal});const data=await response.json();
      if(token!==version)return;if(!response.ok)throw new Error(data.error||'搜索失败');
      const rows=groupSearchRows(data.results);
      resize(()=>{
      heading.textContent=rows.length?`${rows.length} 个谱面集 · 选择后载入`:'没有匹配的 osu!standard 谱面';
      for(const [index,row] of rows.entries()){
        const button=document.createElement('button');button.type='button';button.className='search-result';button.dataset.beatmapId=String(row.id);button.dataset.setId=String(row.setId);button.style.setProperty('--result-delay',`${Math.min(index,5)*35}ms`);
        const image=new Image();image.src=row.cover;image.alt=`${row.title} 封面`;image.loading='lazy';image.referrerPolicy='no-referrer';image.addEventListener('error',()=>image.classList.add('cover-unavailable'));
        const content=document.createElement('div'),title=document.createElement('strong'),subtitle=document.createElement('span'),meta=document.createElement('small'),badge=document.createElement('b');
        title.textContent=row.title;subtitle.textContent=`${row.artist} · ${row.creator}`;
        meta.textContent=`谱面集 #${row.setId} · ${row.difficultyCount} 个难度 · ${Math.floor(row.length/60)}:${String(Math.floor(row.length%60)).padStart(2,'0')} · ${Math.round(row.bpm)} BPM${row.exact?` · 已匹配 ${row.version} #${row.id}`:''}${row.video?' · 视频':''}${row.storyboard?' · 故事板':''}`;
        badge.textContent=row.minStars===row.maxStars?`${row.stars.toFixed(2)} ★`:`${row.minStars.toFixed(2)}–${row.maxStars.toFixed(2)} ★`;badge.className='search-stars';if(row.exact)button.classList.add('exact');
        content.append(title,subtitle,meta);button.append(image,content,badge);button.addEventListener('click',()=>{cancel();input.value=String(row.id);hide();onSelect(String(row.id));});list.append(button);
      }
      });
    }catch(error){if(token===version&&(error as Error).name!=='AbortError')resize(()=>{heading.textContent=(error as Error).message;list.replaceChildren();});}
  }
  const onInput=()=>{cancel();const id=searchId(input.value);if(!id){hide();return;}const token=version;resize(()=>{show();heading.textContent='等待输入完成…';list.replaceChildren();});timer=setTimeout(()=>void run(id,token),350);};
  input.addEventListener('input',onInput);
  input.addEventListener('focus',()=>{if(list.childElementCount)show();});
  input.addEventListener('keydown',e=>{if(e.key==='ArrowDown'&&!box.hidden){e.preventDefault();list.querySelector<HTMLButtonElement>('button')?.focus();}if(e.key==='Escape'){cancel();hide();}});
  box.addEventListener('keydown',e=>{const buttons=[...list.querySelectorAll('button')],at=buttons.indexOf(document.activeElement as HTMLButtonElement);if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();buttons[(at+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}else if(e.key==='Escape'){hide();input.focus();hide();}});
  // Close after the target click, not pointerdown: collapsing an in-flow list early
  // moves the clicked control before pointerup and can swallow its click.
  const outside=(e:MouseEvent)=>{if(!box.contains(e.target as Node)&&e.target!==input)hide();};document.addEventListener('click',outside);
  return {hide:()=>{cancel();hide();},dispose:()=>{cancel();expansion?.cancel();document.removeEventListener('click',outside);}};
}
