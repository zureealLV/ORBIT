import {MODS,modOn,defaultMods,toggleMod} from './engine/mods';
import type {VisualMods} from './engine/types';

const labels={preview:'预览已接入',approx:'近似预览',context:'仅规则说明',pending:'未实现'};
export function mountModPanel(get:()=>VisualMods,set:(mods:VisualMods)=>void){
  const dialog=document.createElement('dialog');dialog.id='mods-dialog';
  const count=(status:string)=>MODS.filter(m=>m.status===status).length;
  dialog.innerHTML=`<header><div><p class="eyebrow">STABLE + LAZER / OSU!STANDARD</p><h2>全部 MOD 目录 <small>${MODS.length}</small></h2></div><button id="mods-close" aria-label="关闭 MOD 面板">✕</button></header>
    <p class="mod-disclaimer">独立 Auto 读谱器，不是完整游戏客户端。${count('preview')} 项预览接入 · ${count('approx')} 项近似 · ${count('context')} 项仅说明 · ${count('pending')} 项未实现。<br/>“近似”不是逐帧一致；“仅规则说明”不会改变 Auto 画面。灰色项不可启用。</p>
    <div class="mod-legend">${Object.entries(labels).map(([s,l])=>`<span data-status="${s}">${l}</span>`).join('')}</div>
    ${[...new Set(MODS.map(m=>m.category))].map(category=>`<section class="mod-category"><h3>${category}</h3><div class="mod-catalog">${MODS.filter(m=>m.category===category).map(m=>`<button type="button" data-mod="${m.code}" data-status="${m.status}" aria-pressed="false" ${m.status==='pending'?'disabled':''}><span class="mod-code">${m.code==='CN'?'CN / CM':m.code}</span><strong>${m.name}</strong><em>${labels[m.status]}</em><small>${m.description}</small></button>`).join('')}</div></section>`).join('')}
    <section class="mod-settings"><h3>预览参数</h3><p>DA 留空使用谱面原值。速度为 MOD 自身倍率，和侧栏练习倍率相乘。</p><div class="mod-parameters">${['ar','cs','od','hp'].map(k=>`<label>DA ${k.toUpperCase()}<input data-setting="${k}" type="number" min="0" max="${k==='ar'||k==='od'?11:10}" step="0.1" placeholder="原谱"/></label>`).join('')}<label>DT / NC 速度<input data-setting="speed" type="number" min="0.5" max="2" step="0.05" value="1.5"/></label><label>抖动强度<input data-setting="strength" type="number" min="0.1" max="3" step="0.1" value="1"/></label><label>随机种子<input data-setting="seed" type="number" min="1" max="99999" step="1" value="1"/></label><label>镜像轴<select data-setting="mirror"><option value="horizontal">水平</option><option value="vertical">垂直</option><option value="both">双轴</option></select></label></div></section>
    <footer><button id="mods-reset">清除全部 MOD</button><span>未实现：RD · TP · MG · RP · AS</span><button id="mods-done" class="primary">回到预览 ↗</button></footer>`;
  document.body.append(dialog);
  const sync=()=>{
    const mods=get(),selected=MODS.filter(m=>modOn(mods,m.code));
    document.querySelectorAll<HTMLButtonElement>('[data-mod]').forEach(b=>{const on=modOn(mods,b.dataset.mod!);b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
    document.getElementById('mods-summary')!.textContent=selected.length?selected.map(m=>m.code).join(' + '):'NM · 无 MOD';
    document.getElementById('mods-selection-note')!.textContent=selected.length?selected.map(m=>`${m.code}：${labels[m.status]}`).join(' / '):'可打开完整目录。规则类不伪造判定，未实现项禁止启用。';
    dialog.querySelectorAll<HTMLInputElement|HTMLSelectElement>('[data-setting]').forEach(input=>{const key=input.dataset.setting as keyof VisualMods;input.value=String(mods[key]??'');});
  };
  document.querySelectorAll<HTMLButtonElement>('[data-mod]').forEach(b=>b.addEventListener('click',()=>{set(toggleMod(get(),b.dataset.mod!));sync();}));
  document.getElementById('mods-open')!.addEventListener('click',()=>{sync();dialog.showModal();});
  for(const id of ['mods-close','mods-done'])document.getElementById(id)!.addEventListener('click',()=>dialog.close());
  document.getElementById('mods-reset')!.addEventListener('click',()=>{set(defaultMods());sync();});
  dialog.querySelectorAll<HTMLInputElement|HTMLSelectElement>('[data-setting]').forEach(input=>input.addEventListener(input instanceof HTMLInputElement?'input':'change',()=>{
    const key=input.dataset.setting as keyof VisualMods;
    if(input instanceof HTMLInputElement&&!input.checkValidity())return;
    const value=key==='mirror'?input.value:input.value===''?undefined:Number(input.value);
    set({...get(),[key]:value});
  }));
  sync();return sync;
}
