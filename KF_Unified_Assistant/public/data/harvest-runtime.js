(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.KF_HARVEST_RUNTIME=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const SCHEMA_VERSION=1;
  const STATUS=["collecting","drafting","allocating","complete"];
  const ACTIVITIES=["quest","investigation","free-roam-success","free-roam-failure"];
  const GENERIC_CATEGORIES=new Set(["kingdom-gear","consumable-gear","upgrade"]);
  const clone=value=>JSON.parse(JSON.stringify(value));
  const clean=(value,max=180)=>String(value??"").trim().slice(0,max);
  const integer=(value,min=0,max=99)=>Math.max(min,Math.min(max,Math.trunc(Number(value)||0)));
  const identity=value=>value===null||value===undefined?"":String(value);
  const cardsOf=data=>Array.isArray(data?.cards)?data.cards:[];
  const cardById=(data,id)=>cardsOf(data).find(card=>identity(card.catalogId||card.id)===identity(id))||null;
  const membersOf=context=>(Array.isArray(context?.members)?context.members:[]).filter(member=>member&&member.key);
  const knightsOf=context=>membersOf(context).filter(member=>member.kind==="knight");
  const squiresOf=context=>membersOf(context).filter(member=>member.kind==="squire");
  const memberByKey=(context,key)=>membersOf(context).find(member=>member.key===key)||null;
  const defaultState=()=>({schemaVersion:SCHEMA_VERSION,status:"collecting",receipts:[],loot:[],activities:{},history:[],completedAt:null});

  function normalizeRequest(request,index){
    const kind=["choice","clash","category"].includes(request?.kind)?request.kind:"choice";
    const result={id:clean(request?.id||`request-${index+1}`,80),kind,count:integer(request?.count,1,16)};
    if(kind==="clash")result.clashPhase=request?.clashPhase==="preliminary"?"preliminary":"full";
    if(kind==="category")result.category=clean(request?.category,60);
    return result;
  }
  function normalizeReceipt(receipt,index){
    const id=clean(receipt?.id||`receipt-${index+1}`,100);
    return {
      id,
      source:clean(receipt?.source||"manual",40),
      sourceRef:clean(receipt?.sourceRef,120),
      label:clean(receipt?.label||"搜刮收据"),
      outcome:clean(receipt?.outcome,30),
      clashPhase:receipt?.clashPhase==="preliminary"?"preliminary":receipt?.clashPhase==="full"?"full":"",
      createdAt:clean(receipt?.createdAt,60),
      requests:(Array.isArray(receipt?.requests)?receipt.requests:[]).slice(0,16).map(normalizeRequest),
    };
  }
  function normalizeResolution(value){
    if(!value||typeof value!=="object")return null;
    const kind=clean(value.kind,20);
    if(!["gear","gold","gamble","manual"].includes(kind))return null;
    return {kind,gold:integer(value.gold,0,99),catalogId:clean(value.catalogId,120),note:clean(value.note,300)};
  }
  function normalizeLoot(item,index,data){
    const card=cardById(data,item?.catalogId);
    if(!card)return null;
    const allocation=["unassigned","common","scrap","discarded"].includes(item?.allocation)?item.allocation:"unassigned";
    return {
      id:clean(item?.id||`loot-${index+1}`,100),
      catalogId:identity(card.catalogId||card.id),
      sourceReceiptId:clean(item?.sourceReceiptId,100),
      requestIndex:integer(item?.requestIndex,0,15),
      allocation,
      assignedMemberKey:clean(item?.assignedMemberKey,140),
      resolution:normalizeResolution(item?.resolution),
    };
  }
  function ensureHarvest(raw,context={},data={}){
    if(raw?.schemaVersion>SCHEMA_VERSION)throw new Error(`Unsupported harvest schema version ${raw.schemaVersion}`);
    const state=defaultState();
    if(raw&&typeof raw==="object")state.status=STATUS.includes(raw.status)?raw.status:"collecting";
    const receiptIds=new Set();
    for(const [index,value] of (Array.isArray(raw?.receipts)?raw.receipts:[]).entries()){
      const receipt=normalizeReceipt(value,index);if(!receipt.id||receiptIds.has(receipt.id))continue;receiptIds.add(receipt.id);state.receipts.push(receipt);
    }
    const lootIds=new Set(),catalogIds=new Set();
    for(const [index,value] of (Array.isArray(raw?.loot)?raw.loot:[]).entries()){
      const item=normalizeLoot(value,index,data);if(!item||lootIds.has(item.id)||catalogIds.has(item.catalogId))continue;
      if(!receiptIds.has(item.sourceReceiptId))continue;lootIds.add(item.id);catalogIds.add(item.catalogId);state.loot.push(item);
    }
    for(const knight of knightsOf(context)){
      const value=raw?.activities?.[knight.key];state.activities[knight.key]=ACTIVITIES.includes(value)&&!(value==="quest"&&context.leaderKey&&knight.key!==context.leaderKey)?value:"investigation";
    }
    state.history=(Array.isArray(raw?.history)?raw.history:[]).slice(-120).map(item=>({at:clean(item?.at,60),text:clean(item?.text,240)}));
    state.completedAt=state.status==="complete"?clean(raw?.completedAt,60)||null:null;
    const hasOpenReceipt=state.receipts.some(receipt=>receiptOpenSlots(state,receipt,data)>0),hasUnassigned=state.loot.some(item=>item.allocation==="unassigned"),hasUnresolved=state.loot.some(item=>item.allocation!=="discarded"&&!resolutionReady(item.resolution));
    if(state.status==="drafting"&&!hasUnassigned){state.status="allocating";state.completedAt=null;}
    else if((state.status==="allocating"&&hasUnassigned)||(state.status==="complete"&&(hasOpenReceipt||hasUnassigned))){
      state.status="collecting";state.completedAt=null;
      for(const item of state.loot)if(item.allocation!=="discarded"){item.allocation="unassigned";item.assignedMemberKey="";item.resolution=null;}
    }else if(state.status==="complete"&&hasUnresolved){state.status="allocating";state.completedAt=null;}
    return state;
  }
  function requestAllows(request,card){
    if(!request||!card)return false;
    if(request.kind==="choice")return GENERIC_CATEGORIES.has(card.category);
    if(request.kind==="category")return request.category===card.category;
    if(request.kind==="clash")return card.category===(request.clashPhase==="preliminary"?"exhibition-clash":"full-clash");
    return false;
  }
  function requestUsage(state,receiptId,requestIndex){
    return state.loot.filter(item=>item.sourceReceiptId===receiptId&&item.requestIndex===requestIndex).length;
  }
  function requestAvailability(state,request,data){
    return cardsOf(data).filter(card=>requestAllows(request,card)&&!state.loot.some(item=>item.catalogId===identity(card.catalogId||card.id)));
  }
  function requestOpenSlots(state,receipt,request,index,data){
    const remaining=Math.max(0,request.count-requestUsage(state,receipt.id,index));
    return Math.min(remaining,requestAvailability(state,request,data).length);
  }
  function receiptOpenSlots(state,receipt,data){
    return receipt.requests.reduce((sum,request,index)=>sum+requestOpenSlots(state,receipt,request,index,data),0);
  }
  function commonQuota(state,context){
    const knights=knightsOf(context),freeRoam=knights.filter(member=>state.activities[member.key]==="free-roam-success").length;
    return knights.length+freeRoam+squiresOf(context).length;
  }
  function commonSelectionStatus(state,context){
    const activeCount=state.loot.filter(item=>item.allocation!=="discarded").length,knights=knightsOf(context),requiredCommon=Math.min(commonQuota(state,context),activeCount),counts={};
    for(const item of state.loot)if(item.allocation==="common"&&item.assignedMemberKey)counts[item.assignedMemberKey]=(counts[item.assignedMemberKey]||0)+1;
    const baseTarget=Math.min(requiredCommon,knights.length),coveredKnights=knights.filter(member=>(counts[member.key]||0)>=1);
    const freeRoam=knights.filter(member=>state.activities[member.key]==="free-roam-success"),freeRoamTarget=Math.min(Math.max(0,requiredCommon-knights.length),freeRoam.length),coveredFreeRoam=freeRoam.filter(member=>(counts[member.key]||0)>=2);
    const requirements=requiredCommon>=knights.length?Object.fromEntries(knights.map(member=>[member.key,1+(freeRoamTarget===freeRoam.length&&freeRoam.some(entry=>entry.key===member.key)?1:0)])):{};
    const unmet=[];
    if(baseTarget===knights.length&&freeRoamTarget===freeRoam.length){
      for(const [memberKey,required] of Object.entries(requirements))if((counts[memberKey]||0)<required)unmet.push({memberKey,required,chosen:counts[memberKey]||0});
      return {requirements,counts,unmet};
    }
    if(baseTarget===knights.length){
      for(const member of knights)if((counts[member.key]||0)<1)unmet.push({memberKey:member.key,required:1,chosen:counts[member.key]||0});
    }else if(coveredKnights.length<baseTarget){
      unmet.push({memberKey:"",label:"不同骑士",required:baseTarget,chosen:coveredKnights.length});
    }
    if(coveredFreeRoam.length<freeRoamTarget)unmet.push({memberKey:"",label:"自由漫游成功骑士的第二张",required:freeRoamTarget,chosen:coveredFreeRoam.length});
    return {requirements,counts,unmet};
  }
  function tierFor(context,memberKey){
    const tier=memberByKey(context,memberKey)?.tier;
    return ["mob","vassal","king","devil","dragon"].includes(tier)?tier:"mob";
  }
  function goldFor(card,context,memberKey){return integer(card?.goldByTier?.[tierFor(context,memberKey)],0,99)}
  function pushHistory(state,text,at=""){
    state.history.push({at:clean(at||new Date().toISOString(),60),text:clean(text,240)});state.history=state.history.slice(-120);
  }
  function nextLootId(state){let index=1;const used=new Set(state.loot.map(item=>item.id));while(used.has(`loot-${index}`))index++;return `loot-${index}`}
  function same(left,right){return JSON.stringify(left)===JSON.stringify(right)}
  function resolutionReady(value){
    if(!value)return false;
    if(value.kind==="gold")return true;
    if(value.kind==="gear")return Boolean(value.catalogId||value.note);
    return Boolean(value.note);
  }
  function scrapDraftOrder(state,context){
    const knights=knightsOf(context),leaderIndex=Math.max(0,knights.findIndex(member=>member.key===context.leaderKey));
    return [...knights.slice(leaderIndex),...knights.slice(0,leaderIndex)];
  }
  function nextScrapMember(state,context){
    const order=scrapDraftOrder(state,context);if(!order.length)return null;
    const drafted=state.loot.filter(item=>item.allocation==="scrap").length;
    return order[drafted%order.length]||null;
  }

  function applyHarvestAction(raw,action,context={},data={}){
    const state=ensureHarvest(raw,context,data),type=action?.type;
    if(type==="record-receipt"){
      const receipt=normalizeReceipt(action.receipt||action,state.receipts.length);
      if(!receipt.id||!receipt.requests.length||state.receipts.some(item=>item.id===receipt.id))return raw;
      const next=state.status==="complete"?ensureHarvest(null,context,data):clone(state);
      if(next.status==="drafting"||next.status==="allocating"){
        next.status="collecting";
        for(const item of next.loot)if(item.allocation!=="discarded"){
          item.allocation="unassigned";item.assignedMemberKey="";item.resolution=null;
        }
      }
      next.completedAt=null;next.receipts.push(receipt);pushHistory(next,`记录 ${receipt.label}`,action.at);return next;
    }
    if(type==="reset")return ensureHarvest(null,context,data);
    if(type==="remove-receipt"){
      if(state.status!=="collecting"||state.loot.some(item=>item.sourceReceiptId===action.receiptId))return raw;
      const next=clone(state),before=next.receipts.length;next.receipts=next.receipts.filter(item=>item.id!==action.receiptId);return next.receipts.length===before?raw:next;
    }
    if(type==="add-loot-card"){
      if(state.status!=="collecting")return raw;
      const receipt=state.receipts.find(item=>item.id===action.receiptId),requestIndex=integer(action.requestIndex,0,15),request=receipt?.requests[requestIndex],card=cardById(data,action.catalogId);
      if(!receipt||!request||!card||!requestAllows(request,card)||requestUsage(state,receipt.id,requestIndex)>=request.count||state.loot.some(item=>item.catalogId===identity(card.catalogId||card.id)))return raw;
      const next=clone(state);next.loot.push({id:nextLootId(next),catalogId:identity(card.catalogId||card.id),sourceReceiptId:receipt.id,requestIndex,allocation:"unassigned",assignedMemberKey:"",resolution:null});pushHistory(next,`加入 ${card.nameZhCn||card.name}`,action.at);return next;
    }
    if(type==="remove-loot-card"){
      if(state.status!=="collecting")return raw;const next=clone(state),before=next.loot.length;next.loot=next.loot.filter(item=>item.id!==action.lootId);return next.loot.length===before?raw:next;
    }
    if(type==="discard-loot-card"){
      if(state.status!=="collecting")return raw;const target=state.loot.find(item=>item.id===action.lootId);if(!target)return raw;
      const next=clone(state),item=next.loot.find(entry=>entry.id===action.lootId),discard=action.discard!==false;item.allocation=discard?"discarded":"unassigned";item.assignedMemberKey="";item.resolution=null;return next;
    }
    if(type==="set-activity"){
      if(state.status!=="collecting"||!ACTIVITIES.includes(action.activity)||!knightsOf(context).some(member=>member.key===action.memberKey)||(action.activity==="quest"&&context.leaderKey&&action.memberKey!==context.leaderKey))return raw;
      if(state.activities[action.memberKey]===action.activity)return raw;const next=clone(state);next.activities[action.memberKey]=action.activity;return next;
    }
    if(type==="set-common-owner"){
      if(!action.memberKey)return applyHarvestAction(raw,{...action,type:"clear-common-owner"},context,data);
      if(state.status!=="collecting"||!knightsOf(context).some(member=>member.key===action.memberKey))return raw;
      const target=state.loot.find(item=>item.id===action.lootId&&item.allocation!=="discarded");if(!target)return raw;
      const next=clone(state),item=next.loot.find(entry=>entry.id===action.lootId);item.allocation="common";item.assignedMemberKey=action.memberKey;item.resolution=null;
      if(next.loot.filter(entry=>entry.allocation==="common").length>Math.min(commonQuota(next,context),next.loot.filter(entry=>entry.allocation!=="discarded").length))return raw;
      return next;
    }
    if(type==="clear-common-owner"){
      if(state.status!=="collecting")return raw;const target=state.loot.find(item=>item.id===action.lootId&&item.allocation==="common");if(!target)return raw;
      const next=clone(state),item=next.loot.find(entry=>entry.id===action.lootId);item.allocation="unassigned";item.assignedMemberKey="";item.resolution=null;return next;
    }
    if(type==="lock-common-goods"){
      if(state.status!=="collecting"||!state.receipts.length||state.receipts.some(receipt=>receiptOpenSlots(state,receipt,data)>0))return raw;
      const activeLoot=state.loot.filter(item=>item.allocation!=="discarded"),required=Math.min(commonQuota(state,context),activeLoot.length),chosen=activeLoot.filter(item=>item.allocation==="common");
      if(chosen.length!==required||commonSelectionStatus(state,context).unmet.length)return raw;
      const knights=knightsOf(context);if(activeLoot.length&&!knights.length)return raw;
      const next=clone(state);next.status=next.loot.some(item=>item.allocation==="unassigned")?"drafting":"allocating";pushHistory(next,"公共战果已确认；剩余战利品从队长开始轮流挑选为回收材料",action.at);return next;
    }
    if(type==="draft-scrap"){
      if(state.status!=="drafting")return raw;const target=state.loot.find(item=>item.id===action.lootId&&item.allocation==="unassigned"),member=nextScrapMember(state,context);if(!target||!member)return raw;
      const next=clone(state),item=next.loot.find(entry=>entry.id===target.id);item.allocation="scrap";item.assignedMemberKey=member.key;item.resolution=null;
      if(!next.loot.some(entry=>entry.allocation==="unassigned"))next.status="allocating";
      pushHistory(next,`${member.name||member.key} 选择回收材料`,action.at);return next;
    }
    if(type==="set-redemption"){
      if(state.status!=="allocating")return raw;const item=state.loot.find(entry=>entry.id===action.lootId&&["common","scrap"].includes(entry.allocation)),card=item&&cardById(data,item.catalogId);if(!item||!card)return raw;
      const kind=clean(action.kind,20),allowed=item.allocation==="common"?["gear","gold","manual"]:["gold","gamble","manual"];
      if(!allowed.includes(kind))return raw;
      const next=clone(state),target=next.loot.find(entry=>entry.id===item.id);target.resolution={kind,gold:kind==="gold"?goldFor(card,context,item.assignedMemberKey):0,catalogId:clean(action.catalogId,120),note:clean(action.note,300)};return next;
    }
    if(type==="complete"){
      if(state.status!=="allocating"||state.receipts.some(receipt=>receiptOpenSlots(state,receipt,data)>0)||state.loot.some(item=>item.allocation!=="discarded"&&!resolutionReady(item.resolution)))return raw;
      const next=clone(state);next.status="complete";next.completedAt=clean(action.at,60)||new Date().toISOString();pushHistory(next,"收获阶段结算完成",next.completedAt);return next;
    }
    if(type==="reopen"){
      if(state.status!=="complete")return raw;const next=clone(state);next.status="allocating";next.completedAt=null;return next;
    }
    return raw;
  }

  function getHarvestView(raw,context={},data={}){
    const state=ensureHarvest(raw,context,data),members=membersOf(context),memberMap=Object.fromEntries(members.map(member=>[member.key,member]));
    const receipts=state.receipts.map(receipt=>{
      const requests=receipt.requests.map((request,index)=>{
        const used=requestUsage(state,receipt.id,index),availableCards=requestAvailability(state,request,data),remaining=Math.max(0,request.count-used),openSlots=Math.min(remaining,availableCards.length);
        return {...request,used,openSlots,ignoredSlots:Math.max(0,remaining-openSlots),availableCards};
      });
      return {...receipt,openSlots:requests.reduce((sum,request)=>sum+request.openSlots,0),ignoredSlots:requests.reduce((sum,request)=>sum+request.ignoredSlots,0),requests};
    });
    const quota=commonQuota(state,context),activeLoot=state.loot.filter(item=>item.allocation!=="discarded"),chosen=state.loot.filter(item=>item.allocation==="common").length,selection=commonSelectionStatus(state,context);
    const loot=state.loot.map(item=>{const card=cardById(data,item.catalogId),member=memberMap[item.assignedMemberKey];return {...item,card,member,computedGold:card&&member?goldFor(card,context,item.assignedMemberKey):0}});
    const totals={};for(const item of loot)if(item.resolution?.kind==="gold"&&item.assignedMemberKey)totals[item.assignedMemberKey]=(totals[item.assignedMemberKey]||0)+item.resolution.gold;
    return {state,members,knights:knightsOf(context),squires:squiresOf(context),memberByKey:memberMap,receipts,loot,nextScrapMember:nextScrapMember(state,context),commonQuota:quota,commonChosen:chosen,commonRequired:Math.min(quota,activeLoot.length),personalRequirements:selection.requirements,unmetKnights:selection.unmet,outstanding:receipts.reduce((sum,item)=>sum+item.openSlots,0),ignoredSlots:receipts.reduce((sum,item)=>sum+item.ignoredSlots,0),canLock:state.status==="collecting"&&receipts.length>0&&receipts.every(item=>item.openSlots===0)&&chosen===Math.min(quota,activeLoot.length)&&selection.unmet.length===0,canComplete:state.status==="allocating"&&receipts.every(item=>item.openSlots===0)&&state.loot.every(item=>item.allocation==="discarded"||resolutionReady(item.resolution)),goldTotals:totals};
  }

  return {SCHEMA_VERSION,ACTIVITIES,ensureHarvest,applyHarvestAction,getHarvestView};
});
