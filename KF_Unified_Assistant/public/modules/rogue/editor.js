(() => {
  "use strict";
  const RULES=window.KF_ROGUE_RULES;
  const $=selector=>document.querySelector(selector);
  const clone=value=>JSON.parse(JSON.stringify(value));
  const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const STORAGE="kf-rogue-path-v2",LOCAL="kf-rogue-map-editor-local-v1";
  const standalone=window.KF_ROGUE_EDITOR_STANDALONE===true;
  const campaign=standalone?"":String(window.KF_MODULE_BOOTSTRAP?.campaignId||localStorage.getItem("kfActiveCampaign")||"");
  const source=new Map(RULES.ALL_NODES.map(node=>[node.id,node]));
  const labels={heroic:"H · Heroic Arc（英勇曲线）",class:"C · Class（职业）",peril:"P · Peril Arc（危险曲线）",technique:"T · Technique（招数）",virtue:"V · Virtue（美德）",gear:"G · Gear（装备）",wild:"W · Wild Card（万能）",sigh:"圣杯叹息",stat:"属性提升",mastery:"精通",princess:"公主",saint:"圣徒",legendary:"传奇装备",start:"起点"};
  const basicRewards=["heroic","class","peril","technique","virtue","gear","wild","sigh"];
  const advancedRewards=["stat","mastery","princess","saint","legendary","sigh"];
  const short=id=>id?.endsWith("S")?"起点 S":`${id?.includes("sunken")?"沉没":"巨石"} ${id?.split("-").at(-1)}`;
  const stageOf=id=>source.get(id)?.stage||"rosegraal";
  const edgeKey=(a,b)=>[a,b].sort().join("/");
  let slotId="",draft=null,baseline=null,selectedId=null,anchorId=null,mode="inspect",zoom=100;
  let undo=[],redo=[],busy=false;
  function readJson(key){try{return JSON.parse(localStorage.getItem(key)||"null");}catch{return null;}}
  function notify(text,error=false){$("#mapEditorStatus").textContent=text;$("#mapEditorStatus").className=error?"error":isDirty()?"unsaved":"";}
  function freshSlot(){return {id:"editor-local",title:standalone?"本机地图":"肉鸽战役",state:RULES.freshState()};}
  function readBundle(){
    if(standalone){
      let state=RULES.freshState();const saved=readJson(LOCAL);
      if(saved&&RULES.applyMapConfig(state,saved.mapConfig||saved))state=RULES.normalizeState({...state,basicLinksRevision:saved.basicLinksRevision??0,advancedMapRevision:saved.advancedMapRevision??0});
      return {schemaVersion:2,campaignId:"",activeSlotId:"editor-local",slots:[{...freshSlot(),state}]};
    }
    const raw=readJson(STORAGE);
    if(raw?.schemaVersion===2&&Array.isArray(raw.slots)){
      if(String(raw.campaignId||"")!==campaign)throw Error("当前战役已切换，请重新打开地图编辑页。");
      const seen=new Set(),slots=raw.slots.filter(slot=>slot&&typeof slot.id==="string"&&slot.state&&typeof slot.state==="object"&&!seen.has(slot.id)&&seen.add(slot.id));
      if(slots.length)return {...raw,slots,activeSlotId:slots.some(slot=>slot.id===raw.activeSlotId)?raw.activeSlotId:slots[0].id};
    }
    const slot=raw&&typeof raw==="object"&&!Array.isArray(raw)?{id:`rogue-editor-${Date.now()}`,title:raw.partyName||"肉鸽战役",state:raw}:freshSlot();
    return {schemaVersion:2,campaignId:campaign,activeSlotId:slot.id,slots:[slot]};
  }
  const draftKey=id=>`kf-rogue-map-editor-draft-v1:${campaign||"local"}:${id}`;
  const signature=config=>JSON.stringify(config,(key,value)=>key==="links"&&Array.isArray(value)?[...value].sort():value);
  const isDirty=()=>Boolean(draft&&baseline&&signature(draft)!==signature(baseline));
  const nodeById=id=>draft?.nodes.find(node=>node.id===id);
  const stage=()=>$("#editorStage").value;
  const stageNodes=()=>draft.nodes.filter(node=>stageOf(node.id)===stage());
  function cacheDraft(){
    try{if(isDirty())localStorage.setItem(draftKey(slotId),JSON.stringify({schemaVersion:1,basicLinksRevision:RULES.BASIC_LINKS_REVISION,advancedMapRevision:RULES.ADVANCED_MAP_REVISION,mapConfig:draft,base:signature(baseline)}));else localStorage.removeItem(draftKey(slotId));}catch{notify("草稿空间不足，请导出 JSON 备份。",true);}
  }
  function loadSlot(id,restore=true){
    const bundle=readBundle(),slot=bundle.slots.find(item=>item.id===id)||bundle.slots[0];
    slotId=slot.id;
    const run=RULES.normalizeState(slot.state);
    baseline=RULES.createMapConfig(run.nodes);draft=clone(baseline);
    undo=[];redo=[];selectedId=null;anchorId=null;
    let recovered=false;
    const cached=restore&&readJson(draftKey(slotId));
    if(cached?.mapConfig){const checked=RULES.validateMapConfig(cached.mapConfig);if(checked.ok){
      const restored=RULES.freshState();RULES.applyMapConfig(restored,checked.config);
      draft=RULES.normalizeState({...restored,basicLinksRevision:cached.basicLinksRevision??0,advancedMapRevision:cached.advancedMapRevision??0}).mapConfig;
      recovered=isDirty();
    }}
    $("#editorSlotSelect").innerHTML=bundle.slots.map(item=>`<option value="${esc(item.id)}">${esc(item.title||"肉鸽战役")}</option>`).join("");
    $("#editorSlotSelect").value=slotId;
    $("#draftNotice").hidden=!(standalone||recovered);
    $("#draftNotice").textContent=standalone?"当前为本机编辑。可保存到本机，或导出 JSON 后在战役的地图编辑页导入。":recovered?"已恢复未保存草稿。点击保存后才会应用到肉鸽存档。":"";
    $("#saveMap").textContent=standalone?"保存到本机":"保存地图";
    $("#applyScope").disabled=standalone;
    render();notify(recovered?"已恢复未保存草稿":standalone?"本机地图已载入":"地图已载入");
  }
  function change(mutator,message){
    const next=clone(draft);mutator(next);
    const checked=RULES.validateMapConfig(next);
    if(!checked.ok){notify(checked.errors[0],true);return false;}
    if(signature(checked.config)===signature(draft)){notify("地图没有变化。");return false;}
    undo.push(clone(draft));if(undo.length>80)undo.shift();redo=[];
    draft=checked.config;cacheDraft();render();notify(`${message} · 尚未保存`);return true;
  }
  function setLink(config,a,b,connected){
    const left=config.nodes.find(node=>node.id===a),right=config.nodes.find(node=>node.id===b);
    if(!left||!right||a===b||stageOf(a)!==stageOf(b))throw Error("请选择同一阶段的两个不同节点。");
    left.links=left.links.filter(id=>id!==b);right.links=right.links.filter(id=>id!==a);
    if(connected){left.links.push(b);right.links.push(a);}
  }
  function clickNode(id){
    if(mode==="inspect"){selectedId=id;anchorId=null;render();return;}
    if(!anchorId){anchorId=id;selectedId=id;render();return;}
    if(anchorId===id){anchorId=null;selectedId=id;render();return;}
    const a=anchorId,connected=mode==="add";
    if(nodeById(a).links.includes(id)===connected){notify(connected?"两节点已经相连。":"两节点当前没有连线。");return;}
    selectedId=a;
    change(next=>setLink(next,a,id,connected),`${connected?"已添加":"已删除"} ${short(a)} ↔ ${short(id)}`);
  }
  function modeHint(){
    $("#editorModeHint").textContent=mode==="inspect"?"点击节点修改等级、奖励和资源；相邻节点列表可逐条删除连线。":anchorId?`起点：${short(anchorId)}。再点其他节点${mode==="add"?"添加":"删除"}双向连线；重复点击起点可更换起点。`:`先点一个节点，再点另一个节点${mode==="add"?"添加":"删除"}双向连线。`;
    document.querySelectorAll("[data-mode]").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.mode===mode)));
  }
  function renderMap(){
    const nodes=stageNodes(),meta=RULES.stageMeta(stage()),selected=nodeById(selectedId);
    $("#editorMapTitle").textContent=stage()==="rosegraal"?"基础肉鸽 · 玫瑰圣杯":"进阶肉鸽 · 枯萎圣杯";
    const image=$("#editorMapImage");if(image.getAttribute("src")!==meta.image)image.src=meta.image;
    image.alt=`${meta.title}原图`;
    const canvas=$("#editorCanvas"),viewport=$("#editorViewport");
    canvas.style.width=`${Math.max(660,viewport.clientWidth-18)*zoom/100}px`;
    canvas.classList.toggle("hide-node-ids",!$("#showNodeIds").checked);
    $("#editorZoom").textContent=`${zoom}%`;
    const stageById=new Map(nodes.map(node=>[node.id,node])),baseById=new Map(baseline.nodes.map(node=>[node.id,node]));
    const edges=new Set(),lines=[];
    for(const node of nodes)for(const id of node.links){
      const key=edgeKey(node.id,id);if(edges.has(key))continue;edges.add(key);
      const a=source.get(node.id),b=source.get(id);if(!a||!b)continue;
      const isSelected=selected&&(node.id===selected.id||id===selected.id);
      lines.push(`<line class="editor-edge${selected?(isSelected?" selected":" dimmed"):""}${baseById.get(node.id)?.links.includes(id)?"":" new-edge"}" x1="${(a.page+a.x)*500}" y1="${a.y*1000}" x2="${(b.page+b.x)*500}" y2="${b.y*1000}"/>`);
    }
    $("#editorLinkLayer").innerHTML=lines.join("");$("#editorLinkLayer").style.display=$("#toggleConnections").checked?"":"none";
    $("#editorNodeLayer").innerHTML=nodes.map(node=>{
      const base=source.get(node.id),modified=signature(node)!==signature(baseById.get(node.id));
      const title=`${short(node.id)}，等级 ${node.level}，${labels[node.reward]}，复活 ${node.resurrection}，虔信 ${node.devotion}`;
      return `<button type="button" data-node="${esc(node.id)}" class="editor-node${base.reward==="start"?" is-start":""}${node.id===selectedId?" selected":""}${node.id===anchorId?" anchor":""}${modified?" modified":""}" style="left:${(base.page+base.x)*50}%;top:${base.y*100}%" aria-label="${esc(title)}" aria-pressed="${node.id===selectedId}" title="${esc(title)}"><span class="editor-node-code">${esc(short(node.id))}${modified?" *":""}</span></button>`;
    }).join("");
    const start=meta.startNodeId,seen=new Set([start]),queue=[start];
    for(let i=0;i<queue.length;i++)for(const id of stageById.get(queue[i])?.links||[])if(!seen.has(id)){seen.add(id);queue.push(id);}
    const missing=nodes.filter(node=>!seen.has(node.id));
    $("#editorCounts").textContent=`${nodes.length-1} 个战斗节点 · ${edges.size} 条连线`;
    $("#editorWarnings").textContent=missing.length?`当前有 ${missing.length} 个节点无法从 S 到达：${missing.slice(0,8).map(node=>short(node.id)).join("、")}${missing.length>8?"…":""}。仍可保存并继续修改。`:"全部节点均可从 S 到达。";
    $("#nodeFind").innerHTML='<option value="">选择节点</option>'+nodes.map(node=>`<option value="${esc(node.id)}">${esc(short(node.id))} · ${node.level||"S"} · ${esc(labels[node.reward])}</option>`).join("");
    $("#nodeFind").value=selectedId||"";
  }
  function renderInspector(){
    const node=nodeById(selectedId),start=!node||source.get(node.id)?.reward==="start",advanced=node&&stageOf(node.id)==="withergraal";
    $("#selectedNodeTitle").textContent=node?short(node.id):"选择一个节点";
    $("#selectedNodeCode").textContent=node?.id||"";
    $("#nodeLevel").min=advanced?6:1;$("#nodeLevel").max=advanced?12:5;
    $("#nodeLevel").value=node?.level||0;$("#nodeRevives").value=node?.resurrection||0;$("#nodeDevotion").value=node?.devotion||0;
    $("#nodeWithered").checked=Boolean(node?.withered);
    const rewards=start?["start"]:advanced?advancedRewards:basicRewards;
    $("#nodeReward").innerHTML=rewards.map(reward=>`<option value="${reward}">${esc(labels[reward])}</option>`).join("");
    $("#nodeReward").value=node?.reward||"start";
    for(const id of ["nodeLevel","nodeRevives","nodeDevotion","nodeWithered","nodeReward","applyNode"])$(`#${id}`).disabled=start;
    $("#nodeDevotionField").hidden=!advanced;$("#nodeWitheredField").hidden=!advanced;
    $("#neighborCount").textContent=node?.links.length||0;
    $("#neighborList").innerHTML=node?.links.length?node.links.map(id=>`<div class="editor-neighbor"><button type="button" data-focus-node="${esc(id)}">${esc(short(id))} · ${nodeById(id).level||"S"}</button><button type="button" data-remove-link="${esc(id)}" aria-label="删除 ${esc(short(node.id))} 与 ${esc(short(id))} 的连接">删除连线</button></div>`).join(""):`<p class="muted">${node?"当前没有连接。选择“添加连线”后点两个节点。":"选中节点后可逐条删除连接。"}</p>`;
  }
  function changes(){
    const byId=new Map(baseline.nodes.map(node=>[node.id,node])),items=[];
    for(const node of draft.nodes){
      const base=byId.get(node.id),fields=[];
      for(const key of ["level","reward","resurrection","devotion","withered"])if(base[key]!==node[key])fields.push(`${({level:"等级",reward:"奖励",resurrection:"复活",devotion:"虔信",withered:"枯萎"})[key]} ${key==="reward"?labels[base[key]]:base[key]} → ${key==="reward"?labels[node[key]]:node[key]}`);
      if(fields.length)items.push(`${short(node.id)}：${fields.join("；")}`);
      for(const id of node.links)if(node.id<id&&!base.links.includes(id))items.push(`＋ ${short(node.id)} ↔ ${short(id)}`);
      for(const id of base.links)if(node.id<id&&!node.links.includes(id))items.push(`− ${short(node.id)} ↔ ${short(id)}`);
    }
    return items;
  }
  function render(){
    if(!draft)return;
    renderMap();renderInspector();modeHint();
    $("#undoEdit").disabled=!undo.length;$("#redoEdit").disabled=!redo.length;$("#saveMap").disabled=busy;
    const items=changes();$("#editCount").textContent=items.length;
    $("#editList").innerHTML=items.length?items.map(text=>`<div class="editor-change-item">${esc(text)}</div>`).join(""):'<p class="muted">没有未保存的改动。</p>';
  }
  function centerNode(id){
    const base=source.get(id);if(!base)return;
    const viewport=$("#editorViewport"),canvas=$("#editorCanvas");
    viewport.scrollTo({left:canvas.clientWidth*(base.page+base.x)/2-viewport.clientWidth/2,top:canvas.clientHeight*base.y-viewport.clientHeight/2,behavior:"auto"});
  }
  function selectNode(id){if(!source.has(id)||stageOf(id)!==stage())return;selectedId=id;if(mode!=="inspect")anchorId=id;render();centerNode(id);}
  function applyNode(event){
    event.preventDefault();const node=nodeById(selectedId);if(!node||source.get(node.id).reward==="start")return;
    if(!$("#nodeForm").reportValidity())return;
    const advanced=stageOf(node.id)==="withergraal";
    const fields={level:Number($("#nodeLevel").value),reward:$("#nodeReward").value,resurrection:Number($("#nodeRevives").value),devotion:advanced?Number($("#nodeDevotion").value):0,withered:advanced&&$("#nodeWithered").checked};
    change(next=>Object.assign(next.nodes.find(item=>item.id===node.id),fields),`已修改 ${short(node.id)}`);
  }
  async function saveMap(){
    if(busy)return;const checked=RULES.validateMapConfig(draft);if(!checked.ok){notify(checked.errors[0],true);return;}
    busy=true;$("#saveMap").disabled=true;
    try{
      if(standalone)localStorage.setItem(LOCAL,JSON.stringify({schemaVersion:1,basicLinksRevision:RULES.BASIC_LINKS_REVISION,advancedMapRevision:RULES.ADVANCED_MAP_REVISION,mapConfig:checked.config}));
      else{
        const bundle=readBundle();if(!bundle.slots.some(slot=>slot.id===slotId))throw Error("该肉鸽存档已被删除，请重新选择存档。");
        const all=$("#applyScope").value==="all";
        const slots=bundle.slots.map(slot=>{
          if(!all&&slot.id!==slotId)return slot;
          const run=RULES.normalizeState(slot.state);
          if(!RULES.applyMapConfig(run,checked.config))throw Error("地图配置未能应用，原存档未修改。");
          run.updatedAt=Date.now();return {...slot,state:run};
        });
        const active=slots.find(slot=>slot.id===bundle.activeSlotId)||slots[0];
        const value={...active.state,schemaVersion:2,campaignId:campaign,activeSlotId:active.id,slots};
        localStorage.setItem(STORAGE,JSON.stringify(value));
        try{localStorage.setItem(`kf-rogue-path-slots-v1:${campaign}`,JSON.stringify(slots));localStorage.setItem(`kf-rogue-path-active-slot-v1:${campaign}`,active.id);}catch{ /* The authoritative bundle remains saved. */ }
        await window.KF_MODULE_BRIDGE?.flush();
      }
      baseline=clone(checked.config);draft=clone(checked.config);cacheDraft();
      $("#draftNotice").hidden=!standalone;
      notify(standalone?"已保存到本机":"地图已保存，战役进度保留");
    }catch(error){notify(error.message||"未能保存，请导出 JSON 备份。",true);}
    finally{busy=false;render();}
  }
  function importMap(event){
    const file=event.target.files?.[0];if(!file)return;
    if(file.size>2*1024*1024){notify("文件过大，请选择地图 JSON。",true);event.target.value="";return;}
    const reader=new FileReader();reader.onload=()=>{
      try{
        const raw=JSON.parse(reader.result),checked=RULES.validateMapConfig(raw.mapConfig||raw.config||raw);
        if(!checked.ok)throw Error(checked.errors.slice(0,2).join(" "));
        change(next=>{next.schemaVersion=checked.config.schemaVersion;next.nodes=checked.config.nodes;},"地图已导入");
      }catch(error){notify(`导入失败：${error.message||"JSON 格式无效"}`,true);}
      event.target.value="";
    };reader.onerror=()=>notify("无法读取文件，原地图未修改。",true);reader.readAsText(file);
  }
  function exportMap(){
    const checked=RULES.validateMapConfig(draft);if(!checked.ok){notify(checked.errors[0],true);return;}
    const url=URL.createObjectURL(new Blob([JSON.stringify(checked.config,null,2)],{type:"application/json"}));
    const a=document.createElement("a");a.href=url;a.download=`kf-rogue-map-${new Date().toISOString().slice(0,10)}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    notify("已导出地图 JSON（不含队伍和战役进度）");
  }
  $("#editorNodeLayer").addEventListener("click",event=>{const button=event.target.closest("[data-node]");if(button)clickNode(button.dataset.node);});
  $("#neighborList").addEventListener("click",event=>{
    const remove=event.target.closest("[data-remove-link]");if(remove&&selectedId){const a=selectedId,b=remove.dataset.removeLink;change(next=>setLink(next,a,b,false),`已删除 ${short(a)} ↔ ${short(b)}`);return;}
    const focus=event.target.closest("[data-focus-node]");if(focus)selectNode(focus.dataset.focusNode);
  });
  document.querySelectorAll("[data-mode]").forEach(button=>button.addEventListener("click",()=>{mode=button.dataset.mode;anchorId=null;modeHint();renderMap();}));
  $("#nodeFind").addEventListener("change",event=>selectNode(event.target.value));
  $("#editorStage").addEventListener("change",()=>{selectedId=null;anchorId=null;render();$("#editorViewport").scrollTo(0,0);});
  $("#editorSlotSelect").addEventListener("change",event=>{cacheDraft();loadSlot(event.target.value);});
  $("#nodeForm").addEventListener("submit",applyNode);
  $("#nodeLevel").addEventListener("change",()=>{const node=nodeById(selectedId);if(node&&stageOf(node.id)==="rosegraal"&&Number($("#nodeRevives").value)===node.level)$("#nodeRevives").value=$("#nodeLevel").value;});
  $("#nodeWithered").addEventListener("change",()=>{if($("#nodeWithered").checked)$("#nodeRevives").value=0;else $("#nodeDevotion").value=0;});
  $("#undoEdit").addEventListener("click",()=>{if(!undo.length)return;redo.push(clone(draft));draft=undo.pop();cacheDraft();render();notify("已撤销");});
  $("#redoEdit").addEventListener("click",()=>{if(!redo.length)return;undo.push(clone(draft));draft=redo.pop();cacheDraft();render();notify("已重做");});
  $("#saveMap").addEventListener("click",saveMap);$("#exportMap").addEventListener("click",exportMap);$("#importMap").addEventListener("change",importMap);
  $("#toggleConnections").addEventListener("change",renderMap);$("#showNodeIds").addEventListener("change",renderMap);
  for(const [id,delta] of [["zoomIn",25],["zoomOut",-25]])$(`#${id}`).addEventListener("click",()=>{zoom=Math.max(75,Math.min(300,zoom+delta));renderMap();if(selectedId)centerNode(selectedId);});
  $("#resetStage").addEventListener("click",()=>{
    if(!confirm(`恢复${stage()==="rosegraal"?"基础":"进阶"}阶段的默认等级、资源、奖励及连线？可撤销，保存后才会应用。`))return;
    const defaults=RULES.createMapConfig(RULES.ALL_NODES),currentStage=stage();
    change(next=>{next.nodes=next.nodes.map(node=>stageOf(node.id)===currentStage?clone(defaults.nodes.find(item=>item.id===node.id)):node);},"本阶段已恢复默认");
  });
  window.addEventListener("beforeunload",event=>{cacheDraft();if(isDirty()){event.preventDefault();event.returnValue="";}});
  window.addEventListener("kf:module-state",()=>{if(isDirty()){notify("战役状态已更新，草稿仍保留；保存时使用最新战役进度。",true);}else{try{loadSlot(slotId);}catch(error){notify(error.message,true);}}});
  window.addEventListener("storage",event=>{if(event.key===STORAGE&&!isDirty()){try{loadSlot(slotId);}catch(error){notify(error.message,true);}}});
  new ResizeObserver(()=>{if(draft)renderMap();}).observe($("#editorViewport"));
  try{const bundle=readBundle();loadSlot(bundle.activeSlotId);window.KF_ROGUE_EDITOR_READY=true;}catch(error){notify(error.message||"无法载入地图。",true);}
})();
