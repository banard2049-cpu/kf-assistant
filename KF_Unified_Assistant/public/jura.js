// Jura is a compact campaign ledger. It tracks the current tier, slot counts,
// build prices, shards, commission completion and the knight sheets that paid
// for each construction. Card effects stay on the physical cards.
export const JURA_LEVELS = [
  {level:1,name:"低层",facilities:3,chants:1,shards:3,gold:5},
  {level:2,name:"中层",facilities:2,chants:1,shards:5,gold:10},
  {level:3,name:"高层",facilities:1,chants:1,shards:7,gold:15},
  {level:4,name:"顶层",facilities:1,chants:1,shards:10,gold:20}
];
const integer=(value,max=99999)=>Math.min(max,Math.max(0,Math.floor(Number(value)||0)));
const unique=value=>[...new Set(Array.isArray(value)?value.filter(id=>typeof id==="string"):[])];
const object=value=>value&&typeof value==="object"&&!Array.isArray(value)?value:{};
const copy=value=>JSON.parse(JSON.stringify(value));
const requireRule=(condition,message)=>{if(!condition)throw new Error(message)};
const cardsOf=catalog=>catalog?.cards||[];
const firstFacility=catalog=>catalog?.startingFacility||"saints-sanctuary";

export function juraCatalog(input,catalog={}) {
  const raw=object(input);
  const cards=Array.isArray(raw.customCards)?raw.customCards.filter(card=>card&&typeof card.id==="string"&&["facility","chant"].includes(card.kind)&&card.level>=1&&card.level<=4):[];
  const quests=Array.isArray(raw.customQuests)?raw.customQuests.filter(quest=>quest&&typeof quest.id==="string"&&typeof quest.name==="string"):[];
  return {...catalog,cards:[...cardsOf(catalog),...cards.filter(card=>!cardsOf(catalog).some(base=>base.id===card.id))],quests:[...(catalog.quests||[]),...quests.filter(quest=>!catalog.quests?.some(base=>base.id===quest.id))]};
}

const normalizeLoadouts=value=>(Array.isArray(value)?value:[]).flatMap(item=>{
  if(!item||typeof item!=="object")return [];
  const name=String(item.name||"").trim().slice(0,60);
  if(!name)return [];
  return [{name,level:integer(item.level,4),facilities:unique(item.facilities),chants:unique(item.chants)}];
}).slice(-30);

export function normalizeJura(input,catalog={}) {
  const raw=object(input),level=integer(raw.level,4);
  const built=unique(raw.built);
  if(level>0&&!built.includes(firstFacility(catalog)))built.unshift(firstFacility(catalog));
  const draftFacilities=unique(raw.loadoutFacilities).filter(id=>built.includes(id));
  const draftChants=unique(raw.loadoutChants).filter(id=>built.includes(id));
  return {
    enabled:raw.enabled===true,level,shards:integer(raw.shards),built,
    quests:Object.fromEntries(Object.entries(object(raw.quests)).filter(([,status])=>status==="completed")),
    loadoutFacilities:trimJuraLoadout(draftFacilities,level,catalog,"facility"),
    loadoutChants:trimJuraLoadout(draftChants,level,catalog,"chant"),
    loadouts:normalizeLoadouts(raw.loadouts),
    customCards:copy(Array.isArray(raw.customCards)?raw.customCards:[]),
    customQuests:copy(Array.isArray(raw.customQuests)?raw.customQuests:[])
  };
}

export function juraSlots(level,kind) {
  const key=kind==="facility"?"facilities":"chants";
  return JURA_LEVELS.filter(tier=>tier.level<=level).flatMap(tier=>Array(tier[key]).fill(tier.level));
}

export function fitsJuraSlots(ids,level,catalog,kind) {
  const cards=unique(ids).filter(id=>!(catalog?.startingFacilityUsesSlot===false&&id===firstFacility(catalog))).map(id=>cardsOf(catalog).find(card=>card.id===id));
  if(cards.some(card=>!card||(kind&&card.kind!==kind)))return false;
  if(new Set(cards.map(card=>card.kind)).size>1)return false;
  const slots=juraSlots(level,kind||cards[0]?.kind||"chant");
  for(const card of cards.sort((a,b)=>b.level-a.level)){
    const slot=slots.findIndex(tier=>tier>=card.level);
    if(slot<0)return false;
    slots.splice(slot,1);
  }
  return true;
}

function trimJuraLoadout(ids,level,catalog,kind) {
  const chosen=unique(ids).filter(id=>{
    const card=cardsOf(catalog).find(item=>item.id===id);
    if(!card||card.kind!==kind||card.level>level)return false;
    return !(catalog?.startingFacilityUsesSlot===false&&id===firstFacility(catalog));
  });
  while(chosen.length&&!fitsJuraSlots(chosen,level,catalog,kind))chosen.pop();
  return chosen;
}

export function applyJuraAction(input,action,catalog={}) {
  catalog=juraCatalog(input,catalog);
  const next=normalizeJura(input,catalog),type=action.type;
  if(type==="enable"){next.enabled=Boolean(action.value);return next}
  requireRule(next.enabled,"请先启用万千恐惧扩展。");
  if(type==="set-level") {
    const level=Number(action.level);
    requireRule(Number.isInteger(level)&&level>=0&&level<=4,"当前层数须为 0–4。");
    next.level=level;
    if(level>0&&!next.built.includes(firstFacility(catalog)))next.built.unshift(firstFacility(catalog));
    next.loadoutFacilities=trimJuraLoadout(next.loadoutFacilities,level,catalog,"facility");
    next.loadoutChants=trimJuraLoadout(next.loadoutChants,level,catalog,"chant");
    return next;
  }
  if(type==="resources") {
    requireRule(Number.isInteger(Number(action.shards))&&Number(action.shards)>=0&&Number(action.shards)<=99999,"化圣碎片须为 0–99999 的整数。");
    next.shards=Number(action.shards);return next;
  }
  if(type==="quest") {
    const quest=catalog.quests?.find(item=>item.id===action.id);
    requireRule(quest,"未找到这项尤拉委托。");
    if(action.completed===false)delete next.quests[action.id];
    else next.quests[action.id]="completed";
    return next;
  }
  if(type==="build") {
    const card=cardsOf(catalog).find(item=>item.id===action.id);
    requireRule(card,"未找到这张设施或圣言。");
    requireRule(next.level>0,"请先记录尤拉已解锁的当前层数。");
    requireRule(card.level<=next.level,"请先解锁对应层级。");
    requireRule(!next.built.includes(card.id),"该设施或圣言已经建造。");
    const cost=JURA_LEVELS[card.level-1];
    requireRule(cost&&next.shards>=cost.shards,"化圣碎片不足。");
    if(action.payerGold!==undefined&&action.payerGold!==null){
      requireRule(Number.isInteger(Number(action.payerGold))&&Number(action.payerGold)>=cost.gold,"所选记录表合计金钱不足。");
    }
    next.shards-=cost.shards;next.built.push(card.id);return next;
  }
  if(type==="loadout-toggle") {
    const kind=action.kind==="chant"?"chant":"facility",key=kind==="facility"?"loadoutFacilities":"loadoutChants";
    const card=cardsOf(catalog).find(item=>item.id===action.id),current=next[key];
    requireRule(next.built.includes(action.id),"请先建造这张卡牌。");
    requireRule(card&&card.kind===kind,"卡牌类型不符。");
    if(action.selected===false)next[key]=current.filter(id=>id!==action.id);
    else {
      requireRule(!current.includes(card.id),"这项已经在配装中。");
      requireRule(card.level<=next.level,"当前层数无法放入这张卡牌。");
      requireRule(fitsJuraSlots([...current,card.id],next.level,catalog,kind),"设施或圣言槽位不足。");
      next[key]=[...current,card.id];
    }
    return next;
  }
  if(type==="loadout-save") {
    const name=String(action.name||"").trim().slice(0,60);
    requireRule(name,"请填写配装名称。");
    requireRule(fitsJuraSlots(next.loadoutFacilities,next.level,catalog,"facility")&&fitsJuraSlots(next.loadoutChants,next.level,catalog,"chant"),"当前配装与层数槽位不符。");
    const entry={name,level:next.level,facilities:[...next.loadoutFacilities],chants:[...next.loadoutChants]};
    const index=next.loadouts.findIndex(item=>item.name===name);
    if(index>=0)next.loadouts[index]=entry;
    else {requireRule(next.loadouts.length<30,"最多保存 30 套配装。");next.loadouts.push(entry)}
    return next;
  }
  if(type==="loadout-load") {
    const entry=next.loadouts.find(item=>item.name===action.name);
    requireRule(entry,"未找到这套配装。");
    const available=(ids,kind)=>ids.every(id=>{
      const card=cardsOf(catalog).find(item=>item.id===id);
      return card&&card.kind===kind&&next.built.includes(id)&&card.level<=next.level;
    });
    requireRule(available(entry.facilities,"facility")&&available(entry.chants,"chant"),"这套配装包含尚未建造或当前层数无法使用的卡牌。");
    requireRule(fitsJuraSlots(entry.facilities,next.level,catalog,"facility")&&fitsJuraSlots(entry.chants,next.level,catalog,"chant"),"这套配装与当前层数槽位不符。");
    next.loadoutFacilities=[...entry.facilities];next.loadoutChants=[...entry.chants];return next;
  }
  if(type==="loadout-delete") {
    requireRule(next.loadouts.some(item=>item.name===action.name),"未找到这套配装。");
    next.loadouts=next.loadouts.filter(item=>item.name!==action.name);return next;
  }
  throw new Error("未知尤拉操作。");
}

const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const disabled=value=>value?" disabled":"";
const levelName=level=>JURA_LEVELS[level-1]?.name||"尚未解锁";
const hasCardImage=card=>typeof card?.image==="string"?Boolean(card.image):Boolean(card?.image?.src);
// Traced from the supplied sanctified-shard icon; filled subpaths with evenodd holes.
const SHARD_PATH="M93.00,50.88 102.00,50.57 103.57,49.00 104.03,38.00 98.00,37.78 97.64,37.00 84.00,37.36 83.89,7.00 59.00,7.43 59.43,7.00 60.00,9.22 61.43,10.00 61.00,10.57 62.43,11.00 63.00,12.88 65.13,14.00 66.00,16.19 67.81,17.00 68.00,18.54 69.46,19.00 69.00,19.54 70.98,21.00 71.00,22.19 71.81,22.00 74.79,28.00 73.43,31.00 64.79,41.00 43.00,61.97 41.22,59.00 38.00,56.78 37.56,55.00 37.00,55.44 36.57,54.00 36.00,54.43 34.58,52.00 34.00,52.42 33.88,51.00 32.00,50.12 29.88,46.00 34.00,40.57 44.54,30.00 45.86,27.00 45.00,27.15 43.54,24.00 43.00,24.46 41.86,22.00 40.00,20.79 40.22,20.00 39.00,19.78 38.57,18.00 38.00,18.43 35.57,15.00 35.00,15.43 34.57,14.00 33.00,13.43 32.88,12.00 30.00,10.12 28.07,7.00 10.00,7.36 9.81,35.00 9.00,36.41 9.00,82.07 20.00,82.86 82.00,82.21 83.03,81.00 84.00,51.03ZM17.88,72.00 17.00,71.93 16.57,67.00 17.00,42.66 19.00,26.54 21.00,23.88 22.81,25.00 23.00,31.57 23.81,32.00 24.00,63.64 24.78,64.00 25.00,68.03 53.36,69.00 53.00,69.57 63.36,70.00 63.00,70.57 67.46,71.00 67.00,71.57 67.96,72.00 63.00,73.81 30.00,75.43 21.00,74.97 20.57,74.00 18.00,73.43ZM64.00,88.43 89.00,87.93 89.78,87.00 90.00,57.43 106.00,56.80 108.56,55.00 108.07,31.00 91.00,30.57 91.43,2.00 68.36,1.00 51.64,1.00 46.56,2.00 48.00,4.78 49.03,5.00 49.00,6.12 49.88,6.00 50.00,7.43 50.57,7.00 51.00,8.43 52.57,9.00 53.00,10.78 54.22,11.00 55.00,13.12 55.88,13.00 56.00,14.43 56.57,14.00 57.00,15.43 58.57,16.00 59.00,17.80 60.19,18.00 60.00,18.96 61.86,20.00 63.00,22.46 63.54,22.00 64.00,23.96 65.86,25.00 66.00,26.45 66.55,26.00 67.21,27.00 67.00,28.38 67.56,28.00 64.57,32.00 43.00,52.88 39.00,49.57 38.00,46.12 53.98,29.00 54.48,27.00 52.00,24.54 51.81,23.00 51.00,23.04 51.14,22.00 50.00,21.86 49.46,20.00 47.00,18.57 46.78,17.00 46.00,17.22 45.78,16.00 44.00,15.22 43.12,13.00 40.00,10.88 39.43,9.00 38.00,8.57 38.43,8.00 37.00,7.57 37.43,7.00 36.00,6.57 36.43,6.00 35.00,5.57 35.43,5.00 34.00,4.57 33.43,3.00 32.00,2.57 32.43,2.00 26.00,1.57 26.36,1.00 3.64,1.00 2.00,1.88 1.00,87.73 2.00,88.98Z";
const shardIcon=()=>`<svg class="jura-shard-icon" viewBox="0 0 109.56 89.98" aria-hidden="true" focusable="false"><path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="${SHARD_PATH}"></path></svg>`;
const atlasMarkup=(image,name)=>{
  if(typeof image==="string")return `<img src="${escapeHtml(image)}" alt="${escapeHtml(name)}" loading="lazy">`;
  if(!image?.src)return "";
  const column=image.index%image.columns,row=Math.floor(image.index/image.columns);
  return `<span class="jura-atlas-frame" style="aspect-ratio:${Number(image.width)||1}/${Number(image.height)||1}"><img src="${escapeHtml(image.src)}" alt="${escapeHtml(name)}" loading="lazy" style="width:${image.columns*100}%;height:${image.rows*100}%;left:${-column*100}%;top:${-row*100}%"></span>`;
};
const cardImageMarkup=card=>card.image?atlasMarkup(card.image,card.name):`<span class="jura-loadout-no-image">${escapeHtml(card.name)}</span>`;

export function createJuraPanel({root,getState,getCampaignId=()=>"",save,notify,catalog:baseCatalog,getSheets=()=>[],adjustGold=null}) {
  let undo=null,undoSaved=null,catalog=baseCatalog,lastCampaign=null,payerIds=[],payerInitialized=false,payerMenuOpen=false,loadoutName="";
  const get=()=>{catalog=juraCatalog(getState(),baseCatalog);return normalizeJura(getState(),catalog)};
  const sheets=()=>{
    const list=typeof getSheets==="function"?getSheets():[];
    return (Array.isArray(list)?list:[]).filter(sheet=>sheet&&typeof sheet.id==="string"&&sheet.state&&typeof sheet.state==="object");
  };
  const money=sheet=>Math.max(0,Math.floor(Number(sheet?.state?.gold)||0));
  const sheetName=sheet=>String(sheet?.title||sheet?.state?.knight||"未命名骑士");
  function selectedPayers(list=sheets()){
    if(!payerInitialized&&list.length){payerIds=[list[0].id];payerInitialized=true}
    const selected=new Set(payerIds);
    const chosen=list.filter(sheet=>selected.has(sheet.id));
    payerIds=chosen.map(sheet=>sheet.id);
    return chosen;
  }
  function payerTotal(payers){return payers.reduce((total,sheet)=>total+money(sheet),0)}
  function paymentPlan(payers,amount){
    let left=amount;const plan=[];
    for(const sheet of payers){
      if(left<=0)break;
      const paid=Math.min(money(sheet),left);
      if(paid>0){plan.push({sheetId:sheet.id,gold:paid});left-=paid}
    }
    return left===0?plan:null;
  }
  function act(action,label) {
    try {
      const before=copy(get());
      let next,refund=null;
      if(action.type==="build") {
        const card=cardsOf(catalog).find(item=>item.id===action.id),cost=JURA_LEVELS[(card?.level||0)-1];
        requireRule(card&&cost,"未找到这张设施或圣言。");
        const payers=selectedPayers();
        requireRule(payers.length>0,"请先在骑士团总览建立并选择金币支付记录表。");
        requireRule(typeof adjustGold==="function","当前页面无法从记录表扣除金钱，请刷新后重试。");
        const total=payerTotal(payers);
        requireRule(total>=cost.gold,`所选记录表合计金钱不足（需要 ${cost.gold}，现有 ${total}）。`);
        const plan=paymentPlan(payers,cost.gold);
        requireRule(plan,"所选记录表合计金钱不足。");
        next=applyJuraAction(before,{...action,payerGold:total},catalog);
        const paid=[];
        try{for(const payment of plan){adjustGold(payment.sheetId,-payment.gold);paid.push(payment)}}
        catch(error){for(const payment of paid)try{adjustGold(payment.sheetId,payment.gold)}catch{}throw error}
        refund=paid;
      } else {
        next=applyJuraAction(before,action,catalog);
      }
      undo={state:before,refund};
      undoSaved=JSON.stringify(next);
      try{save(next)}
      catch(error){for(const payment of refund||[])try{adjustGold(payment.sheetId,payment.gold)}catch{}throw error}
      render(true);
      if(label)notify(label);
    } catch(error){render(true);notify(error.message)}
  }
  function setShards(value,syncField=false) {
    try {
      const before=copy(get()),next=applyJuraAction(before,{type:"resources",shards:value},catalog);
      undo={state:before,refund:null};undoSaved=JSON.stringify(next);save(next);
      const undoButton=root.querySelector?.("[data-jura-undo]");if(undoButton)undoButton.disabled=false;
      if(syncField){const input=root.querySelector?.("[data-jura-shards]");if(input)input.value=String(next.shards)}
      const minus=root.querySelector?.('[data-jura-shard-step="-1"]'),plus=root.querySelector?.('[data-jura-shard-step="1"]');
      if(minus)minus.disabled=next.shards<=0;if(plus)plus.disabled=next.shards>=99999;
    } catch(error){notify(error.message);render(true)}
  }
  function costOf(card){return JURA_LEVELS[card.level-1]}
  function buildReason(card,s,payers,built) {
    if(!s.enabled)return "请先启用万千恐惧扩展。";
    if(s.level===0)return "请先记录当前层数。";
    if(card.level>s.level)return "尚未解锁该层级。";
    if(built)return "已经建造。";
    if(!payers.length)return "请先选择金币支付记录表。";
    if(typeof adjustGold!=="function")return "当前页面无法扣除金钱。";
    if(s.shards<costOf(card).shards)return "化圣碎片不足。";
    if(payerTotal(payers)<costOf(card).gold)return `所选记录表合计金钱不足（需要 ${costOf(card).gold}，现有 ${payerTotal(payers)}）。`;
    return "";
  }
  function cardRow(card,s,payers) {
    const built=s.built.includes(card.id),cost=costOf(card),reason=buildReason(card,s,payers,built),self=card.id===firstFacility(catalog);
    const title=hasCardImage(card)?`<button type="button" class="jura-build-link" data-jura-preview="${escapeHtml(card.id)}" title="查看「${escapeHtml(card.name)}」卡面" aria-label="查看「${escapeHtml(card.name)}」卡面">${escapeHtml(card.name)}</button>`:`<strong>${escapeHtml(card.name)}</strong>`;
    return `<div class="jura-build-item${built?" is-built":""}">
      <div class="jura-build-name"><div class="jura-build-title">${title}<small class="jura-build-meta">${levelName(card.level)}${card.en?` · ${escapeHtml(card.en)}`:""}${self?" · 自带":""}</small></div><p class="jura-build-rules"><span>效果</span>${escapeHtml(card.rules||"请按卡面结算。")}</p></div>
      <span class="jura-build-cost">${cost.shards} 碎片 + ${cost.gold} 金钱</span>
      ${built?`<span class="jura-built-mark">已建造</span>`:`<button type="button" class="button" data-jura-action="build" data-id="${escapeHtml(card.id)}"${disabled(Boolean(reason))} title="${escapeHtml(reason)}">建造</button>`}
    </div>`;
  }
  function showCard(id) {
    const card=cardsOf(catalog).find(item=>item.id===id);if(!hasCardImage(card))return;
    let dialog=document.querySelector("#juraCardDialog");
    if(!dialog){
      dialog=document.createElement("dialog");dialog.id="juraCardDialog";dialog.className="jura-card-dialog";document.body.append(dialog);
      dialog.addEventListener("click",event=>{if(event.target===dialog||event.target.closest("[data-jura-close-preview]"))dialog.close()});
    }
    dialog.innerHTML=`<header><h3>${escapeHtml(card.name)}</h3><button type="button" class="button" data-jura-close-preview>关闭</button></header><div class="jura-preview-content"></div><p class="jura-card-legend">卡面上的红色标志表示「危险」。</p>`;
    dialog.querySelector(".jura-preview-content").innerHTML=atlasMarkup(card.image,card.name);
    if(!dialog.open)dialog.showModal();
  }
  function showLoadoutPicker(kind) {
    const s=get(),selected=kind==="facility"?s.loadoutFacilities:s.loadoutChants,label=kind==="facility"?"设施":"圣言";
    const cards=cardsOf(catalog).filter(card=>card.kind===kind&&s.built.includes(card.id)&&card.level<=s.level&&!(catalog.startingFacilityUsesSlot===false&&card.id===firstFacility(catalog))&&!selected.includes(card.id)&&fitsJuraSlots([...selected,card.id],s.level,catalog,kind)).sort((a,b)=>a.level-b.level);
    if(!cards.length)return notify(`没有可加入的${label}；请先建造或检查槽位。`);
    let dialog=document.querySelector("#juraLoadoutDialog");
    if(!dialog){dialog=document.createElement("dialog");dialog.id="juraLoadoutDialog";dialog.className="jura-card-dialog jura-loadout-dialog";document.body.append(dialog)}
    dialog.innerHTML=`<header><h3>选择加入配装的${label}</h3><button type="button" class="button" data-jura-close-loadout>关闭</button></header><div class="jura-loadout-picker-grid">${cards.map(card=>`<button type="button" class="jura-loadout-choice" data-jura-loadout-choose="${escapeHtml(card.id)}" aria-label="加入${escapeHtml(card.name)}"><span class="jura-loadout-choice-image">${cardImageMarkup(card)}</span><span class="jura-loadout-choice-name">${escapeHtml(card.name)}</span><small>${levelName(card.level)}</small></button>`).join("")}</div><p class="jura-loadout-picker-hint">只显示已建造且符合当前槽位的${label}。</p>`;
    dialog.onclick=event=>{
      if(event.target===dialog||event.target.closest("[data-jura-close-loadout]")){dialog.close();return}
      const button=event.target.closest("[data-jura-loadout-choose]");if(!button)return;
      const card=cards.find(item=>item.id===button.dataset.juraLoadoutChoose);dialog.close();
      if(card)act({type:"loadout-toggle",kind,id:card.id,selected:true},`已将「${card.name}」加入配装`);
    };
    if(!dialog.open)dialog.showModal();
  }
  function render(force=false) {
    if(!root)return;
    const campaign=getCampaignId();
    if(campaign!==lastCampaign){undo=null;undoSaved=null;lastCampaign=campaign;payerIds=[];payerInitialized=false;payerMenuOpen=false;loadoutName=""}
    else if(!force&&root.contains(document.activeElement)&&document.activeElement.matches("input,textarea,select"))return;
    if(undoSaved&&JSON.stringify(get())!==undoSaved){undo=null;undoSaved=null}
    const s=get(),quests=catalog.quests||[],cardList=cardsOf(catalog),sheetList=sheets(),payers=selectedPayers(sheetList);
    const facilitySlots=juraSlots(s.level,"facility").length,chantSlots=juraSlots(s.level,"chant").length;
    const completed=Object.values(s.quests).filter(status=>status==="completed").length;
    const payerSum=payerTotal(payers),payerNames=payers.map(sheetName);
    const freeSanctuary=catalog.startingFacilityUsesSlot===false;
    const buildGroup=kind=>{
      const cards=cardList.filter(card=>card.kind===kind&&card.level<=s.level).sort((a,b)=>a.level-b.level);
      return cards.map(card=>cardRow(card,s,payers)).join("")||'<p class="jura-muted">当前层数没有可建造的卡牌。</p>';
    };
    const cardById=id=>cardList.find(card=>card.id===id);
    const assignLoadout=(ids,kind)=>{
      const tiers=juraSlots(s.level,kind),assigned=Array(tiers.length).fill(null);
      for(const card of ids.map(cardById).filter(Boolean).sort((a,b)=>b.level-a.level)){
        const index=tiers.findIndex((tier,slot)=>!assigned[slot]&&tier>=card.level);
        if(index>=0)assigned[index]=card;
      }
      return {tiers,assigned};
    };
    const loadoutSlot=(card,kind)=>{
      const label=kind==="facility"?"设施":"圣言";
      if(card)return `<button type="button" class="jura-loadout-slot is-${kind} is-filled" data-jura-loadout-remove data-jura-loadout-kind="${kind}" data-jura-loadout-id="${escapeHtml(card.id)}" title="移出配装：${escapeHtml(card.name)}" aria-label="移出配装：${escapeHtml(card.name)}"><span class="jura-loadout-slot-image">${cardImageMarkup(card)}</span></button>`;
      return `<button type="button" class="jura-loadout-slot is-${kind} is-empty" data-jura-loadout-open data-jura-loadout-kind="${kind}" title="空${label}槽，点击选择" aria-label="空${label}槽，点击选择"><span class="jura-loadout-empty" aria-hidden="true">+</span></button>`;
    };
    const assignedFacilities=assignLoadout(s.loadoutFacilities,"facility").assigned,assignedChants=assignLoadout(s.loadoutChants,"chant").assigned;
    const sanctuary=cardById(firstFacility(catalog));
    const facilityCell=cell=>{
      if(!cell)return loadoutSlot(null,"facility");
      if(cell.fixed)return `<div class="jura-loadout-slot is-facility is-fixed" title="圣徒圣所 · 自带，不占槽" aria-label="圣徒圣所，自带设施"><span class="jura-loadout-slot-image">${cardImageMarkup(cell.card)}</span></div>`;
      return loadoutSlot(cell.card,"facility");
    };
    const facilityCells=[...(sanctuary?[{card:sanctuary,fixed:true}]:[]),...assignedFacilities.map(card=>({card}))];
    const facilityStacks=[];
    for(let index=0;index<facilityCells.length;index+=2)facilityStacks.push(`<div class="jura-loadout-stack">${facilityCell(facilityCells[index])}${facilityCells[index+1]?facilityCell(facilityCells[index+1]):'<span class="jura-loadout-slot is-facility is-ghost" aria-hidden="true"></span>'}</div>`);
    const loadoutBody=`${assignedChants.map(card=>loadoutSlot(card,"chant")).join("")}${facilityStacks.join("")}`;
    const savedLoadouts=s.loadouts.length?`<div class="jura-saved-loadouts">${s.loadouts.map(item=>`<article><div><strong>${escapeHtml(item.name)}</strong><small>${levelName(item.level)} · 设施 ${item.facilities.length} · 圣言 ${item.chants.length}</small></div><button type="button" class="button" data-jura-action="loadout-load" data-name="${escapeHtml(item.name)}">读取</button><button type="button" class="button" data-jura-action="loadout-delete" data-name="${escapeHtml(item.name)}">删除</button></article>`).join("")}</div>`:'<p class="jura-muted">尚未保存配装。</p>';
    const loadoutSection=`<section class="jura-section jura-loadout-section"><div class="jura-section-heading"><h3>配装区</h3><span>设施 ${s.loadoutFacilities.length} / ${facilitySlots} · 圣言 ${s.loadoutChants.length} / ${chantSlots}</span></div><div class="jura-loadout-row">${loadoutBody}</div><form class="jura-loadout-save" data-jura-loadout-save><label>配装名称<input name="name" maxlength="60" value="${escapeHtml(loadoutName)}" data-jura-loadout-name placeholder="例如：本次远征"></label><button type="submit" class="button">保存配装</button></form>${savedLoadouts}</section>`;
    root.innerHTML=`<div class="jura-heading"><div><p class="eyebrow">JURA · THE CITADEL OF THE SAINTS</p><h2>圣徒神堡 · 尤拉</h2></div><label class="jura-enable"><input type="checkbox" data-jura-enabled${s.enabled?" checked":""}>启用万千恐惧扩展</label></div>
      ${!s.enabled?'<p class="jura-muted">拥有万千恐惧扩展后，可在这里记录尤拉的层数、委托与建造。</p>':`
      <div class="jura-toolbar"><label class="jura-level-picker"><span>当前层数</span><select class="jura-level-select" data-jura-level-select aria-label="切换当前层数"><option value="0"${s.level===0?" selected":""}>未解锁</option>${JURA_LEVELS.map(tier=>`<option value="${tier.level}"${tier.level===s.level?" selected":""}>${tier.name} · 设施 ${juraSlots(tier.level,"facility").length} 槽 · 圣言 ${juraSlots(tier.level,"chant").length} 槽</option>`).join("")}</select></label><span class="jura-resource-chip jura-shard-chip" title="当前化圣碎片，输入后实时保存">${shardIcon()}<input class="jura-shard-input" data-jura-shards type="number" min="0" max="99999" step="1" value="${s.shards}" aria-label="当前化圣碎片"><span class="jura-shard-stepper"><button type="button" class="jura-shard-step" data-jura-shard-step="-1" aria-label="减少化圣碎片"${disabled(s.shards<=0)}>−</button><button type="button" class="jura-shard-step" data-jura-shard-step="1" aria-label="增加化圣碎片"${disabled(s.shards>=99999)}>＋</button></span></span><details class="jura-payer-menu" data-jura-payer-menu${payerMenuOpen?" open":""}><summary title="${escapeHtml(payerNames.length?`${payerNames.join(" + ")}；按列表顺序扣款`:"选择金币支付记录表")}"><img class="jura-gold-icon" src="/assets/sheet-icons/gold.png" alt=""><b>${payers.length?payerSum:"—"}</b><span class="jura-payer-names">${escapeHtml(payerNames.length?payerNames.join(" + "):"选择记录表")}</span></summary><div class="jura-payer-options"><p>按从上到下的顺序扣款</p>${sheetList.map(sheet=>`<label><input type="checkbox" data-jura-payer-id="${escapeHtml(sheet.id)}"${payers.some(item=>item.id===sheet.id)?" checked":""}><span>${escapeHtml(sheetName(sheet))}</span><b>${money(sheet)} 金钱</b></label>`).join("")||'<p class="jura-muted">暂无骑士记录表。</p>'}</div></details><button type="button" class="button" data-jura-undo${disabled(!undo)}>撤销上一步</button></div>
      ${s.level?`${loadoutSection}<section class="jura-section"><div class="jura-section-heading"><h3>建设区</h3><span>设施 ${facilitySlots} 槽 · 圣言 ${chantSlots} 槽</span></div><div class="jura-build-columns"><div class="jura-build-group"><h4>设施</h4><div class="jura-build-list">${buildGroup("facility")}</div></div><div class="jura-build-group"><h4>圣言</h4><div class="jura-build-list">${buildGroup("chant")}</div></div></div></section>`:'<p class="jura-muted">记录当前层数后，可在这里登记设施与圣言的建造。</p>'}
      <section class="jura-section"><div class="jura-section-heading"><h3>尤拉委托</h3><span>${completed} / ${quests.length} 已完成</span></div><div class="jura-quests">${quests.map(quest=>{const done=s.quests[quest.id]==="completed";return `<label class="jura-quest${done?" is-done":""}"><input type="checkbox" data-jura-quest="${escapeHtml(quest.id)}"${done?" checked":""}><span>${escapeHtml(quest.name)}</span></label>`}).join("")||'<p class="jura-muted">尚未登记委托。</p>'}</div><p class="jura-muted">只记录每个委托的名称与完成情况；目标与奖励按委托卡结算。</p></section>`}`;
  }
  root.addEventListener("click",event=>{
    const summary=event.target.closest("summary");
    if(summary?.parentElement?.hasAttribute("data-jura-payer-menu"))payerMenuOpen=!summary.parentElement.open;
    const button=event.target.closest("button");if(!button||button.disabled)return;
    if(button.hasAttribute("data-jura-undo")){
      if(!undo||JSON.stringify(get())!==undoSaved)return notify("战役已更新，请刷新后继续。");
      const refunded=[];
      try{
        for(const payment of undo.refund||[]){adjustGold(payment.sheetId,payment.gold);refunded.push(payment)}
        save(undo.state);
        undo=null;undoSaved=null;render(true);notify("已撤销上一步尤拉操作");
      }catch(error){for(const payment of refunded)try{adjustGold(payment.sheetId,-payment.gold)}catch{};render(true);notify(error.message)}
      return;
    }
    if(button.dataset.juraShardStep!==undefined){
      const delta=Number(button.dataset.juraShardStep);
      return setShards(Math.max(0,Math.min(99999,get().shards+delta)),true);
    }
    if(button.hasAttribute("data-jura-loadout-open"))return showLoadoutPicker(button.dataset.juraLoadoutKind);
    if(button.hasAttribute("data-jura-loadout-remove")){
      const kind=button.dataset.juraLoadoutKind,id=button.dataset.juraLoadoutId,card=cardsOf(catalog).find(item=>item.id===id);
      return act({type:"loadout-toggle",kind,id,selected:false},`已将「${card?.name||""}」移出配装`);
    }
    if(button.dataset.juraAction==="loadout-load"){
      loadoutName=button.dataset.name||"";
      return act({type:"loadout-load",name:button.dataset.name},`已读取配装「${button.dataset.name||""}」`);
    }
    if(button.dataset.juraAction==="loadout-delete"){
      return act({type:"loadout-delete",name:button.dataset.name},`已删除配装「${button.dataset.name||""}」`);
    }
    if(button.dataset.juraPreview){showCard(button.dataset.juraPreview);return}
    if(button.dataset.juraAction==="build"){
      const card=cardsOf(catalog).find(item=>item.id===button.dataset.id);
      return act({type:"build",id:button.dataset.id},`建造「${card?.name||""}」`);
    }
  });
  root.addEventListener("toggle",event=>{
    if(event.target?.matches?.("[data-jura-payer-menu]"))payerMenuOpen=event.target.open;
  },true);
  root.addEventListener("mousedown",event=>{
    if(event.target.closest("[data-jura-shard-step]"))event.preventDefault();
  });
  root.addEventListener("input",event=>{
    const el=event.target;
    if(el.hasAttribute("data-jura-loadout-name")){loadoutName=el.value;return}
    if(el.hasAttribute("data-jura-shards")){
      const value=Number(el.value);
      if(el.value!==""&&Number.isInteger(value)&&value>=0&&value<=99999)setShards(value);
    }
  });
  root.addEventListener("change",event=>{
    const el=event.target;
    if(el.hasAttribute("data-jura-enabled"))return act({type:"enable",value:el.checked});
    if(el.hasAttribute("data-jura-level-select")){
      const level=Number(el.value);
      return act({type:"set-level",level},level?`当前层数已切换为${levelName(level)}`:"已切换为未解锁");
    }
    if(el.hasAttribute("data-jura-shards")){
      if(el.value==="")setShards(0,true);
      else {const value=Number(el.value);if(!Number.isInteger(value)||value<0||value>99999)el.value=String(get().shards)}
      return;
    }
    if(el.hasAttribute("data-jura-payer-id")){
      const id=el.dataset.juraPayerId;
      payerIds=el.checked?[...new Set([...payerIds,id])]:payerIds.filter(item=>item!==id);
      payerMenuOpen=true;render(true);return;
    }
    if(el.hasAttribute("data-jura-quest"))return act({type:"quest",id:el.dataset.juraQuest,completed:el.checked},el.checked?"已记录委托完成":"已取消委托完成");
  });
  root.addEventListener("submit",event=>{
    if(!event.target.hasAttribute("data-jura-loadout-save"))return;
    event.preventDefault();
    const name=String(new FormData(event.target).get("name")||"").trim().slice(0,60);
    if(!name)return notify("请填写配装名称。");
    loadoutName=name;
    return act({type:"loadout-save",name},`已保存配装「${name}」`);
  });
  return {render};
}
