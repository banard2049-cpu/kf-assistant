(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.KF_CHARACTER_RUNTIME=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const SCHEMA_VERSION=4;
  const ZONES=["ready","cooldown","delay","discard"];
  const TIER_ORDER={starter:0,mob:1,vassal:2,king:3,devil:4,dragon:5};
  const clone=value=>JSON.parse(JSON.stringify(value));
  const bounded=(value,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(value))?Number(value):min));
  const boundedInteger=(value,min,max)=>Math.trunc(bounded(value,min,max));
  const clean=(value,max=160)=>String(value??"").trim().slice(0,max);
  const identity=value=>value===null||value===undefined||value===""?"":String(value);
  const same=(left,right)=>identity(left)===identity(right);
  const normalizedName=value=>clean(value).toLowerCase();
  const shuffle=(values,random=Math.random)=>{
    const result=[...values];
    for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]]}
    return result;
  };
  const resource=(current=0,max=0)=>({current:bounded(current,0,Math.max(0,Number(max)||0)),max:Math.max(0,Number(max)||0)});

  function catalogEntry(card,prefix,index){
    if(!card||typeof card!=="object")return null;
    const catalogId=identity(card.catalogId||card.id||(card.cardId!==null&&card.cardId!==undefined?`${prefix}:${card.cardId}`:`${prefix}:${index+1}`));
    return catalogId?{...card,catalogId}:null;
  }
  function uniqueCatalog(entries){
    const seen=new Set();
    return entries.filter(entry=>{if(!entry||seen.has(entry.catalogId))return false;seen.add(entry.catalogId);return true});
  }
  function gearCatalog(data){
    const entries=Array.isArray(data?.gearCards)
      ?data.gearCards
      :Object.entries(data?.gear||{}).map(([key,card])=>({...card,name:card?.name||key}));
    return uniqueCatalog(entries.map((card,index)=>catalogEntry(card,"gear",index)));
  }
  function mercenaryCatalog(data){return uniqueCatalog((Array.isArray(data?.mercenaries)?data.mercenaries:[]).map((card,index)=>catalogEntry(card,"mercenary",index)))}
  function upgradeCatalog(data){return uniqueCatalog((Array.isArray(data?.gearUpgrades)?data.gearUpgrades:[]).map((card,index)=>catalogEntry(card,"upgrade",index)))}
  function techniqueCatalog(member,data){
    const cards=data?.knights?.[member?.sourceId]?.techniques||[];
    return uniqueCatalog(cards.map((card,index)=>catalogEntry(card,`technique:${member?.sourceId||"unknown"}`,index)));
  }
  function findCatalog(entries,reference){
    if(reference===null||reference===undefined)return null;
    if(typeof reference==="string"||typeof reference==="number"){
      const token=identity(reference);
      return entries.find(entry=>entry.catalogId===token||same(entry.cardId,token))||null;
    }
    const catalogId=identity(reference.catalogId);
    if(catalogId){const byCatalog=entries.find(entry=>entry.catalogId===catalogId);if(byCatalog)return byCatalog}
    if(reference.cardId!==null&&reference.cardId!==undefined){const byCardId=entries.find(entry=>same(entry.cardId,reference.cardId));if(byCardId)return byCardId}
    const name=normalizedName(reference.name||reference.front);
    return name?entries.find(entry=>normalizedName(entry.name||entry.front)===name)||null:null;
  }
  function nextInstanceId(member,prefix){
    const used=new Set([
      ...(member?.equipment||[]).map(item=>identity(item.id)),
      ...ZONES.flatMap(zone=>(member?.hand?.[zone]||[]).map(item=>identity(item.id))),
    ]);
    let index=1;
    while(used.has(`${prefix}-${index}`))index++;
    return `${prefix}-${index}`;
  }
  function allocateInstanceId(used,prefix,preferred){
    const candidate=clean(preferred,120);
    if(candidate&&!used.has(candidate)){used.add(candidate);return candidate}
    let index=1;
    while(used.has(`${prefix}-${index}`))index++;
    const id=`${prefix}-${index}`;used.add(id);return id;
  }
  function equipmentSnapshot(source,id,card=null,ready=true,upgrade=null,runtimeState=source){
    const resolved=card||null;
    const discarded=runtimeState?.discarded===true;
    const snapshot={
      id,
      catalogId:resolved?.catalogId||null,
      cardId:resolved?.cardId??source?.cardId??null,
      name:clean(resolved?.name||source?.name||source,120),
      ready:!discarded&&ready!==false,
      discarded,
      charges:boundedInteger(runtimeState?.charges??runtimeState?.chargeTokens??0,0,99),
      upgrade:upgrade?clone(upgrade):null,
    };
    const outpost=runtimeState?.outpostAssignment;
    if(outpost&&identity(outpost.catalogId))snapshot.outpostAssignment={
      catalogId:identity(outpost.catalogId),
      ownerMemberKey:identity(outpost.ownerMemberKey),
      assignedMemberKey:identity(outpost.assignedMemberKey),
      squireEligibilityConfirmed:outpost.squireEligibilityConfirmed===true,
    };
    return snapshot;
  }
  function techniqueName(card){return clean(card?.name||[card?.front,card?.back].filter(Boolean).join(" / ")||"未命名招数",160)}
  function techniqueSnapshot(source,id,card=null){
    const resolved=card||null;
    const state={
      id,
      catalogId:resolved?.catalogId||identity(source?.catalogId)||null,
      cardId:resolved?.cardId??source?.cardId??null,
      front:clean(resolved?.front??source?.front??source?.name,160),
      back:clean(resolved?.back??source?.back,160),
      name:techniqueName(resolved||source),
    };
    if(!state.catalogId||source?.custom)state.custom=true;
    return state;
  }
  function upgradeSnapshot(source,card=null){
    const resolved=card||null;
    const catalogId=resolved?.catalogId||identity(source?.catalogId||source)||null;
    if(!catalogId)return null;
    return {catalogId,cardId:resolved?.cardId??source?.cardId??null,name:clean(resolved?.name||source?.name,120)};
  }
  function gearRules(item,data){
    return findCatalog(gearCatalog(data),item)||{
      catalogId:identity(item?.catalogId)||null,
      gearType:"unknown",
      isMerchant:false,
      upgradeable:true,
    };
  }
  function canAttachUpgrade(gear,upgrade){
    if(!gear||!upgrade||gear.isMerchant||gear.upgradeable===false)return false;
    const gearType=["weapon","armor"].includes(gear.gearType)?gear.gearType:"unknown";
    return gearType==="unknown"||upgrade.targetType===gearType;
  }

  function initialMettle(data,random=Math.random){
    const cardIds=(data?.mettle?.startingCardIds||[]).filter(id=>data.mettle.cards[id]);
    return {drawPile:shuffle(cardIds,random),discardPile:[],current:null,unlocked:[...cardIds],shuffleCount:1};
  }

  function initialEquipment(descriptor,source,data){
    const catalog=gearCatalog(data),fixed=source.startingGear?.fixed||[],inventory=Array.isArray(descriptor.inventory)?descriptor.inventory:[];
    const seenCatalog=new Set(),seenCustom=new Set(),items=[];
    for(const value of [...fixed,...inventory]){
      const reference=typeof value==="string"?{name:value}:value||{};
      const card=findCatalog(catalog,reference),catalogId=card?.catalogId||"",name=normalizedName(card?.name||reference.name);
      if(catalogId&&seenCatalog.has(catalogId)||!catalogId&&(!name||seenCustom.has(name)))continue;
      if(catalogId)seenCatalog.add(catalogId);else seenCustom.add(name);
      items.push(equipmentSnapshot(reference,`gear-${items.length+1}`,card,true,null));
    }
    return items;
  }
  function initialTechniques(source,member,data){
    const catalog=techniqueCatalog(member,data),startingIds=Array.isArray(source.startingTechniqueIds)&&source.startingTechniqueIds.length?source.startingTechniqueIds:null;
    const selected=startingIds
      ?startingIds.map(id=>findCatalog(catalog,id)).filter(Boolean)
      :catalog;
    return selected.map((card,index)=>techniqueSnapshot(card,`technique-${index+1}`,card));
  }
  function knightState(descriptor,data){
    const source=data.knights[descriptor.sourceId]||{techniques:[],startingGear:{fixed:[],choices:[]}};
    const member={
      key:descriptor.key,kind:"knight",sourceId:descriptor.sourceId,name:descriptor.name||source.name||descriptor.sourceId,
      portraitId:identity(defaultPortrait(source)?.id),
      professionId:source.profession?.id||"",
      attributes:{vigor:resource(),passion:resource(0,6),heat:resource(),movement:0,heatRefresh:0,bane:resource()},
      curves:{
        heroic:{optionId:source.heroicArc?.id||"",cardId:source.heroicArc?.cardId||null,name:source.heroicArc?.name||"",notes:""},
        peril:{optionId:source.perilArc?.id||"",cardId:source.perilArc?.cardId||null,name:source.perilArc?.name||"",danger:"unharmed",notes:""},
      },
      equipment:[],hand:{ready:[],cooldown:[],delay:[],discard:[]},
    };
    member.equipment=initialEquipment(descriptor,source,data);
    member.hand.ready=initialTechniques(source,member,data);
    return member;
  }

  function applySquireTier(member,tier){
    const stats=tier?.statistics||{};
    const passionMax=Math.max(0,...(tier?.heroicArc||[]).map(step=>Number(step.passion)||0));
    member.tierId=tier?.id||"";
    member.attributes={
      vigor:resource(stats.vitality||0,stats.vitality||0),
      passion:resource(0,passionMax),
      heat:resource(0,stats.heatLimit||0),
      movement:Number(stats.speed)||0,
      heatRefresh:Number(stats.heatRefresh)||0,
      bane:resource(0,stats.baneLimit||0),
    };
    member.curves={heroic:{cardId:tier?.cardId||null,name:`${tier?.tier||""} 侍从英勇曲线`,notes:""}};
    return member;
  }

  function squireState(descriptor,data){
    const source=data.squires[descriptor.sourceId]||{tiers:[]};
    const member={
      key:descriptor.key,kind:"squire",sourceId:descriptor.sourceId,name:descriptor.name||source.name||descriptor.sourceId,
      tierId:"",attributes:{},curves:{},equipment:[],hand:{ready:[],cooldown:[],delay:[],discard:[]},
    };
    return applySquireTier(member,source.tiers[0]);
  }

  function createMember(descriptor,data){
    if(!descriptor?.key||!data)throw new Error("Member data is incomplete");
    return descriptor.kind==="squire"?squireState(descriptor,data):knightState(descriptor,data);
  }

  function normalizeEquipment(member,data){
    const catalog=gearCatalog(data),upgrades=upgradeCatalog(data),usedIds=new Set(),usedCatalog=new Set(),usedUpgrades=new Set();
    member.equipment=(Array.isArray(member.equipment)?member.equipment:[]).map((source,index)=>{
      let card=findCatalog(catalog,source),catalogId=card?.catalogId||identity(source?.catalogId)||null;
      if(catalogId&&usedCatalog.has(catalogId)){card=null;catalogId=null}
      if(catalogId)usedCatalog.add(catalogId);
      const id=allocateInstanceId(usedIds,"gear",source?.id||`gear-${index+1}`);
      const base=equipmentSnapshot(source,id,card,source?.ready, null);
      if(!card)base.catalogId=catalogId;
      const upgradeCard=findCatalog(upgrades,source?.upgrade),upgradeId=upgradeCard?.catalogId||identity(source?.upgrade?.catalogId||source?.upgrade)||null;
      if(upgradeId&&!usedUpgrades.has(upgradeId)){
        const rules=card||gearRules(base,data);
        if(upgradeCard?canAttachUpgrade(rules,upgradeCard):!rules.isMerchant&&rules.upgradeable!==false){
          base.upgrade=upgradeSnapshot(source.upgrade,upgradeCard);
          usedUpgrades.add(upgradeId);
        }
      }
      return base;
    });
  }
  function normalizeHand(member,data){
    const catalog=techniqueCatalog(member,data),usedIds=new Set(),usedCatalog=new Set(),hand={};
    for(const zone of ZONES){
      hand[zone]=(Array.isArray(member.hand?.[zone])?member.hand[zone]:[]).map((source,index)=>{
        let card=findCatalog(catalog,source),catalogId=card?.catalogId||identity(source?.catalogId)||null;
        if(catalogId&&usedCatalog.has(catalogId)){card=null;catalogId=null}
        if(catalogId)usedCatalog.add(catalogId);
        const id=allocateInstanceId(usedIds,"technique",source?.id||`technique-${zone}-${index+1}`),state=techniqueSnapshot(source,id,card);
        if(!card)state.catalogId=catalogId;
        if(!state.catalogId)state.custom=true;else delete state.custom;
        return state;
      });
    }
    member.hand=hand;
  }
  function normalizeMemberLoadout(member,data){normalizeEquipment(member,data);normalizeHand(member,data)}

  function normalizeKnightPool(source){
    const pool={};
    if(!source||typeof source!=="object"||Array.isArray(source))return pool;
    for(const [rawTokenId,value] of Object.entries(source)){
      const tokenId=clean(rawTokenId,80);
      if(tokenId)pool[tokenId]=boundedInteger(value,0,99);
    }
    return pool;
  }

  function normalizeOutpost(source,members,data){
    const value=source&&typeof source==="object"&&!Array.isArray(source)?source:{},memberKeys=new Set(Object.keys(members||{}));
    const mercenaries=mercenaryCatalog(data),merchantGear=gearCatalog(data).filter(card=>card.isMerchant),seenMercenaryNames=new Set(),seenGear=new Set();
    const result={mercenaries:[],merchantGear:[]};
    for(const item of Array.isArray(value.mercenaries)?value.mercenaries:[]){
      const card=findCatalog(mercenaries,item),assignedMemberKey=identity(item?.assignedMemberKey||item?.memberKey);
      if(!card||!memberKeys.has(assignedMemberKey))continue;
      const role=normalizedName(card.name||card.nameZhCn||card.catalogId);
      if(!role||seenMercenaryNames.has(role)||result.mercenaries.length>=4)continue;
      seenMercenaryNames.add(role);result.mercenaries.push({catalogId:card.catalogId,assignedMemberKey});
    }
    for(const item of Array.isArray(value.merchantGear)?value.merchantGear:[]){
      const card=findCatalog(merchantGear,item),assignedMemberKey=identity(item?.assignedMemberKey||item?.memberKey);
      if(!card||!memberKeys.has(assignedMemberKey)||seenGear.has(card.catalogId))continue;
      const member=members[assignedMemberKey];let ownerMemberKey=identity(item?.ownerMemberKey||assignedMemberKey),squireEligibilityConfirmed=false;
      if(member?.kind==="squire"){
        const owner=members[ownerMemberKey];squireEligibilityConfirmed=item?.squireEligibilityConfirmed===true;
        if(card.gearType!=="weapon"||owner?.kind!=="knight"||!squireEligibilityConfirmed)continue;
      }else ownerMemberKey=assignedMemberKey;
      seenGear.add(card.catalogId);result.merchantGear.push({catalogId:card.catalogId,ownerMemberKey,assignedMemberKey,squireEligibilityConfirmed});
    }
    return result;
  }

  function outpostEquipmentCatalog(item){return identity(item?.outpostAssignment?.catalogId)}
  function removeOutpostEquipment(next,catalogId){
    for(const member of Object.values(next.members||{}))member.equipment=(member.equipment||[]).filter(item=>outpostEquipmentCatalog(item)!==catalogId);
  }
  function reconcileOutpostEquipment(manager,data){
    const catalog=gearCatalog(data),assignments=new Map((manager.outpost?.merchantGear||[]).map(item=>[item.catalogId,item])),snapshots=new Map();
    for(const member of Object.values(manager.members||{}))member.equipment=(member.equipment||[]).filter(item=>{
      const catalogId=outpostEquipmentCatalog(item);if(!catalogId)return true;
      if(assignments.has(catalogId)&&!snapshots.has(catalogId))snapshots.set(catalogId,item);
      return false;
    });
    for(const assignment of manager.outpost?.merchantGear||[]){
      const card=findCatalog(catalog,assignment.catalogId),target=manager.members?.[assignment.assignedMemberKey];
      if(!card||!target)continue;
      const snapshot=snapshots.get(card.catalogId),preferredId=identity(snapshot?.id),used=new Set((target.equipment||[]).map(item=>identity(item.id))),id=preferredId&&!used.has(preferredId)?preferredId:nextInstanceId(target,"gear");
      const runtimeState={...(snapshot||card),outpostAssignment:assignment};
      target.equipment.push(equipmentSnapshot(snapshot||card,id,card,snapshot?.ready??true,null,runtimeState));
    }
  }

  function defaultPortrait(source){
    const portraits=Array.isArray(source?.portraits)?source.portraits:[];
    return portraits.find(card=>same(card.id,source?.portrait?.id))||source?.portrait||portraits[0]||null;
  }

  function validPortraitId(source,portraitId){
    const portraits=Array.isArray(source?.portraits)?source.portraits:[];
    return portraits.some(card=>same(card.id,portraitId))?identity(portraitId):identity(defaultPortrait(source)?.id);
  }

  function ensureManager(input,descriptors,data,random=Math.random){
    const inputVersion=Number(input?.schemaVersion||0);
    if(inputVersion>SCHEMA_VERSION)throw new Error(`Unsupported character manager schema version: ${input.schemaVersion}`);
    const manager=input&&inputVersion>=1&&inputVersion<=SCHEMA_VERSION
      ?clone(input)
      :{schemaVersion:SCHEMA_VERSION,activeMemberKey:"",members:{},squireLeads:0,mettle:initialMettle(data,random),knightPool:{},outpost:{mercenaries:[],merchantGear:[]}};
    manager.schemaVersion=SCHEMA_VERSION;
    if(!manager.members||typeof manager.members!=="object"||Array.isArray(manager.members))manager.members={};
    manager.squireLeads=bounded(manager.squireLeads,0,99999);
    manager.knightPool=normalizeKnightPool(manager.knightPool);
    if(!manager.mettle||!Array.isArray(manager.mettle.drawPile)||!Array.isArray(manager.mettle.discardPile))manager.mettle=initialMettle(data,random);
    for(const descriptor of descriptors||[]){
      if(!manager.members[descriptor.key]||manager.members[descriptor.key].kind!==descriptor.kind)manager.members[descriptor.key]=createMember(descriptor,data);
      else{
        const member=manager.members[descriptor.key];member.name=descriptor.name||member.name;member.sourceId=descriptor.sourceId;
        if(member.kind==="knight"){
          const source=data.knights[descriptor.sourceId]||{};
          member.portraitId=validPortraitId(source,member.portraitId);
          if(!member.professionId)member.professionId=source.profession?.id||"";
          if(member.curves?.heroic&&!member.curves.heroic.optionId)member.curves.heroic.optionId=source.heroicArc?.id||"";
          if(member.curves?.peril&&!member.curves.peril.optionId)member.curves.peril.optionId=source.perilArc?.id||"";
        }
      }
    }
    const activeKeys=(descriptors||[]).map(item=>item.key);
    for(const member of Object.values(manager.members))normalizeMemberLoadout(member,data);
    const activeMembers=Object.fromEntries(activeKeys.map(key=>[key,manager.members[key]]).filter(([,member])=>member));
    manager.outpost=normalizeOutpost(manager.outpost,activeMembers,data);
    reconcileOutpostEquipment(manager,data);
    if(!activeKeys.includes(manager.activeMemberKey))manager.activeMemberKey=activeKeys[0]||"";
    return manager;
  }

  function updateMember(manager,key,change){
    const next=clone(manager),member=next.members[key];
    if(!member)return next;
    change(member);
    return next;
  }

  function setResource(manager,key,field,part,value){
    return updateMember(manager,key,member=>{
      const current=member.attributes[field];
      if(field==="movement"||field==="heatRefresh"){member.attributes[field]=bounded(value,0,99);return}
      if(!current||typeof current!=="object")return;
      if(part==="max"){current.max=bounded(value,0,99);current.current=Math.min(current.current,current.max)}
      else current.current=bounded(value,0,current.max);
    });
  }
  function setSquireLeads(manager,value){const next=clone(manager);next.squireLeads=bounded(value,0,99999);return next}

  function setCurveField(manager,key,curve,field,value){
    return updateMember(manager,key,member=>{if(member.curves?.[curve])member.curves[curve][field]=String(value).slice(0,2000)});
  }

  function setSquireTier(manager,key,tierId,data){
    return updateMember(manager,key,member=>{
      if(member.kind!=="squire")return;
      const tier=data.squires[member.sourceId]?.tiers.find(item=>item.id===tierId);
      if(tier)applySquireTier(member,tier);
    });
  }

  function setKnightCard(manager,key,kind,optionId,data){
    return updateMember(manager,key,member=>{
      if(member.kind!=="knight")return;
      const source=data.knights[member.sourceId]||{};
      if(kind==="portrait"){
        const option=(source.portraits||[]).find(item=>item.id===optionId);if(option)member.portraitId=option.id;return;
      }
      if(kind==="profession"){
        const option=(source.professions||[]).find(item=>item.id===optionId);if(option)member.professionId=option.id;return;
      }
      const curve=kind==="heroic"?"heroic":kind==="peril"?"peril":"";if(!curve)return;
      const option=((curve==="heroic"?source.heroicArcs:source.perilArcs)||[]).find(item=>item.id===optionId);if(!option)return;
      member.curves[curve]={...member.curves[curve],optionId:option.id,cardId:option.cardId,name:option.name};
    });
  }

  function allTechniques(member){return ZONES.flatMap(zone=>(member.hand?.[zone]||[]).map((card,index)=>({zone,index,card})))}
  function option(card,selected,disabled,reason=""){
    return {catalogId:card.catalogId,label:card.name||techniqueName(card),card,selected:Boolean(selected),disabled:Boolean(disabled),reason:disabled?reason:""};
  }
  function customCurrentOption(item){
    return {catalogId:"",label:`自定义：${clean(item?.name||item?.front||"未命名",160)}`,card:null,selected:true,disabled:false,reason:""};
  }

  function outpostTier(value){
    const token=identity(value).toLowerCase();
    if(Object.prototype.hasOwnProperty.call(TIER_ORDER,token))return TIER_ORDER[token];
    return boundedInteger(value,1,5);
  }
  function outpostContextMembers(manager,context){
    const activeKeys=Array.isArray(context?.memberKeys)?new Set(context.memberKeys.map(identity)):null;
    return Object.values(manager?.members||{}).filter(member=>!activeKeys||activeKeys.has(member.key)).map(member=>({
      key:member.key,name:member.name,kind:member.kind,tier:outpostTier(context?.memberTiers?.[member.key]||1),
    }));
  }
  function unlockedMercenary(card,context){
    const values=Array.isArray(context?.unlockedMercenaryIds)?context.unlockedMercenaryIds:[];
    const tokens=new Set(values.map(value=>normalizedName(value)));
    return tokens.has(normalizedName(card.catalogId))||tokens.has(normalizedName(card.cardId))||tokens.has(normalizedName(card.name))||tokens.has(normalizedName(card.nameZhCn))||tokens.has(normalizedName(`${card.name} ${card.level||""}`));
  }
  function getOutpostView(manager,context={},data={}){
    const members=outpostContextMembers(manager,context),memberByKey=Object.fromEntries(members.map(member=>[member.key,member])),activeMembers=Object.fromEntries(members.map(member=>[member.key,manager?.members?.[member.key]]).filter(([,member])=>member)),kingdom=context.kingdom==="stone"?"stone":"sunken",leaderTier=outpostTier(context.leaderTier||1),outpost=normalizeOutpost(manager?.outpost,activeMembers,data);
    const selectedMercenaries=new Map(outpost.mercenaries.map(item=>[item.catalogId,item])),selectedRoles=new Map();
    for(const item of outpost.mercenaries){const card=findCatalog(mercenaryCatalog(data),item.catalogId);if(card)selectedRoles.set(normalizedName(card.name||card.nameZhCn),item)}
    const mercenaries=mercenaryCatalog(data).map(card=>{
      const assignment=selectedMercenaries.get(card.catalogId)||null,roleAssignment=selectedRoles.get(normalizedName(card.name||card.nameZhCn))||null;
      const rightKingdom=!card.kingdom||card.kingdom==="both"||card.kingdom===kingdom;
      const defaultUnlocked=Number(card.level)===1||Boolean(card.kingdom&&card.kingdom!=="both"&&card.kingdom===kingdom),isUnlocked=defaultUnlocked||unlockedMercenary(card,context)||Boolean(assignment),tierAllowed=!card.level||Number(card.level)<=leaderTier;
      let reason="";
      if(!rightKingdom)reason="wrong-kingdom";else if(!isUnlocked)reason="not-unlocked";else if(!tierAllowed)reason="tier-too-high";else if(!assignment&&!roleAssignment&&outpost.mercenaries.length>=4)reason="mercenary-limit";
      return {card,assignment,roleAssignment,disabled:Boolean(reason),reason};
    });
    const merchantGear=gearCatalog(data).filter(card=>card.isMerchant).map(card=>{
      const assignment=outpost.merchantGear.find(item=>item.catalogId===card.catalogId)||null;
      const existingOwnerState=Object.values(manager?.members||{}).find(member=>(member.equipment||[]).some(item=>item.catalogId===card.catalogId&&!outpostEquipmentCatalog(item)))||null;
      const existingOwner=existingOwnerState?{key:existingOwnerState.key,name:existingOwnerState.name,kind:existingOwnerState.kind}:null;
      const knights=members.filter(member=>member.kind==="knight"),squires=members.filter(member=>member.kind==="squire");
      const memberOptions=knights.map(member=>{
        const tierAllowed=outpostTier(card.tier)<=member.tier,ownedElsewhere=Boolean(existingOwner&&!assignment);
        return {...member,disabled:!tierAllowed||ownedElsewhere,reason:ownedElsewhere?"already-owned":!tierAllowed?"tier-too-high":""};
      });
      const loanOptions=squires.flatMap(squire=>knights.map(owner=>{
        const tierAllowed=outpostTier(card.tier)<=owner.tier,weapon=card.gearType==="weapon",ownedElsewhere=Boolean(existingOwner&&!assignment);
        return {key:`loan|${owner.key}|${squire.key}`,ownerMemberKey:owner.key,assignedMemberKey:squire.key,name:squire.name,ownerName:owner.name,kind:"squire",disabled:!weapon||!tierAllowed||ownedElsewhere,reason:ownedElsewhere?"already-owned":!weapon?"squire-weapon-only":!tierAllowed?"tier-too-high":""};
      }));
      return {card,assignment,existingOwner,memberOptions,loanOptions};
    });
    return {kingdom,leaderTier,members,memberByKey,mercenaries,merchantGear,outpost};
  }

  function applyOutpostAction(manager,action,context={},data={}){
    if(!manager||typeof manager!=="object"||!action||typeof action!=="object")return manager;
    const type=clean(action.type||action.kind,80),catalogId=identity(action.catalogId||action.cardId),memberKey=identity(action.memberKey||action.assignedMemberKey),ownerMemberKey=identity(action.ownerMemberKey||memberKey),view=getOutpostView(manager,context,data);
    if(type==="assign-mercenary"){
      const candidate=view.mercenaries.find(item=>item.card.catalogId===catalogId);if(!candidate)return manager;
      if(!memberKey){
        if(!candidate.assignment)return manager;
        const next=clone(manager);next.outpost=clone(view.outpost);next.outpost.mercenaries=next.outpost.mercenaries.filter(item=>item.catalogId!==catalogId);return next;
      }
      if(!view.memberByKey[memberKey]||candidate.disabled)return manager;
      const role=normalizedName(candidate.card.name||candidate.card.nameZhCn),next=clone(manager);next.outpost=clone(view.outpost);
      next.outpost.mercenaries=next.outpost.mercenaries.filter(item=>{
        const card=findCatalog(mercenaryCatalog(data),item.catalogId);return normalizedName(card?.name||card?.nameZhCn)!==role;
      });
      next.outpost.mercenaries.push({catalogId,assignedMemberKey:memberKey});return next;
    }
    if(type==="assign-merchant-gear"){
      const candidate=view.merchantGear.find(item=>item.card.catalogId===catalogId);if(!candidate)return manager;
      if(!memberKey){
        if(!candidate.assignment)return manager;
        const next=clone(manager);next.outpost=clone(view.outpost);next.outpost.merchantGear=next.outpost.merchantGear.filter(item=>item.catalogId!==catalogId);removeOutpostEquipment(next,catalogId);return next;
      }
      const targetMember=view.memberByKey[memberKey];if(!targetMember||candidate.existingOwner&&!candidate.assignment)return manager;
      let assignment;
      if(targetMember.kind==="squire"){
        const loanOption=candidate.loanOptions.find(item=>item.ownerMemberKey===ownerMemberKey&&item.assignedMemberKey===memberKey);
        if(!loanOption||loanOption.disabled||action.squireEligibilityConfirmed!==true)return manager;
        assignment={catalogId,ownerMemberKey,assignedMemberKey:memberKey,squireEligibilityConfirmed:true};
      }else{
        const memberOption=candidate.memberOptions.find(item=>item.key===memberKey);if(!memberOption||memberOption.disabled)return manager;
        assignment={catalogId,ownerMemberKey:memberKey,assignedMemberKey:memberKey,squireEligibilityConfirmed:false};
      }
      const next=clone(manager);next.outpost=clone(view.outpost);
      if(next.members[memberKey]?.kind==="squire"){
        const otherIds=next.outpost.merchantGear.filter(item=>item.assignedMemberKey===memberKey&&item.catalogId!==catalogId).map(item=>item.catalogId);
        next.outpost.merchantGear=next.outpost.merchantGear.filter(item=>item.assignedMemberKey!==memberKey||item.catalogId===catalogId);
        for(const otherId of otherIds)removeOutpostEquipment(next,otherId);
      }
      next.outpost.merchantGear=next.outpost.merchantGear.filter(item=>item.catalogId!==catalogId);
      next.outpost.merchantGear.push(assignment);removeOutpostEquipment(next,catalogId);
      const target=next.members[memberKey],card=candidate.card,runtimeState={...card,outpostAssignment:assignment};target.equipment.push(equipmentSnapshot(card,nextInstanceId(target,"gear"),card,true,null,runtimeState));return next;
    }
    if(type==="clear-outpost"){
      if(!view.outpost.mercenaries.length&&!view.outpost.merchantGear.length)return manager;
      const next=clone(manager);for(const item of next.outpost?.merchantGear||[])removeOutpostEquipment(next,item.catalogId);next.outpost={mercenaries:[],merchantGear:[]};return next;
    }
    return manager;
  }
  function getLoadoutOptions(manager,key,request,data){
    const member=manager?.members?.[key],kind=request?.kind,targetId=request?.targetId;
    if(!member||!["equipment","technique","upgrade"].includes(kind))return [];
    if(kind==="equipment"){
      const target=targetId===null||targetId===undefined?null:(member.equipment||[]).find(item=>same(item.id,targetId));
      if(targetId!==null&&targetId!==undefined&&!target)return [];
      const used=new Set((member.equipment||[]).filter(item=>item!==target).map(item=>identity(item.catalogId)).filter(Boolean));
      const currentUpgrade=target?.upgrade?findCatalog(upgradeCatalog(data),target.upgrade):null;
      const catalog=gearCatalog(data),items=catalog.map(card=>{
        const selected=target?.catalogId===card.catalogId,duplicate=used.has(card.catalogId);
        const incompatible=Boolean(target?.upgrade&&!selected&&(!currentUpgrade||!canAttachUpgrade(card,currentUpgrade)));
        return option(card,selected,duplicate||incompatible,duplicate?"already-used":"incompatible-upgrade");
      });
      const currentIsCatalog=Boolean(target?.catalogId&&catalog.some(card=>card.catalogId===target.catalogId));
      return target&&!currentIsCatalog?[customCurrentOption(target),...items]:items;
    }
    if(kind==="technique"){
      if(member.kind!=="knight")return [];
      const located=targetId===null||targetId===undefined?null:allTechniques(member).find(item=>same(item.card.id,targetId));
      if(targetId!==null&&targetId!==undefined&&!located)return [];
      const used=new Set(allTechniques(member).filter(item=>item.card!==located?.card).map(item=>identity(item.card.catalogId)).filter(Boolean));
      const catalog=techniqueCatalog(member,data),items=catalog.map(card=>option(card,located?.card.catalogId===card.catalogId,used.has(card.catalogId),"already-used"));
      const currentIsCatalog=Boolean(located?.card.catalogId&&catalog.some(card=>card.catalogId===located.card.catalogId));
      return located&&!currentIsCatalog?[customCurrentOption(located.card),...items]:items;
    }
    const target=(member.equipment||[]).find(item=>same(item.id,targetId));
    if(!target)return [];
    const gear=gearRules(target,data),used=new Set((member.equipment||[]).filter(item=>item!==target).map(item=>identity(item.upgrade?.catalogId)).filter(Boolean));
    return [
      {catalogId:"",label:"无升级",card:null,selected:!target.upgrade,disabled:false,reason:""},
      ...upgradeCatalog(data).map(card=>{
        const selected=target.upgrade?.catalogId===card.catalogId,duplicate=used.has(card.catalogId),compatible=canAttachUpgrade(gear,card);
        const reason=duplicate?"already-used":gear.isMerchant?"merchant-gear":gear.upgradeable===false?"not-upgradeable":"incompatible";
        return option(card,selected,duplicate||!compatible,reason);
      }),
    ];
  }

  function setLoadoutSelection(manager,key,request,data){
    const member=manager?.members?.[key],kind=request?.kind,targetId=request?.targetId,rawCatalogId=request?.catalogId;
    if(!member||!["equipment","technique","upgrade"].includes(kind))return manager;
    if(kind==="equipment"){
      const card=findCatalog(gearCatalog(data),rawCatalogId);if(!card)return manager;
      const targetIndex=targetId===null||targetId===undefined?-1:(member.equipment||[]).findIndex(item=>same(item.id,targetId));
      if(targetId!==null&&targetId!==undefined&&targetIndex<0)return manager;
      const target=targetIndex>=0?member.equipment[targetIndex]:null;
      if(target?.catalogId===card.catalogId||(member.equipment||[]).some((item,index)=>index!==targetIndex&&item.catalogId===card.catalogId))return manager;
      if(target?.upgrade){const attached=findCatalog(upgradeCatalog(data),target.upgrade);if(!attached||!canAttachUpgrade(card,attached))return manager}
      const next=clone(manager),nextMember=next.members[key];
      if(target){nextMember.equipment[targetIndex]=equipmentSnapshot(card,target.id,card,target.ready,target.upgrade,target)}
      else nextMember.equipment.push(equipmentSnapshot(card,nextInstanceId(member,"gear"),card,true,null));
      return next;
    }
    if(kind==="technique"){
      if(member.kind!=="knight")return manager;
      const card=findCatalog(techniqueCatalog(member,data),rawCatalogId);if(!card)return manager;
      const located=targetId===null||targetId===undefined?null:allTechniques(member).find(item=>same(item.card.id,targetId));
      if(targetId!==null&&targetId!==undefined&&!located)return manager;
      if(located?.card.catalogId===card.catalogId||allTechniques(member).some(item=>item.card!==located?.card&&item.card.catalogId===card.catalogId))return manager;
      const next=clone(manager),nextMember=next.members[key];
      if(located)nextMember.hand[located.zone][located.index]=techniqueSnapshot(card,located.card.id,card);
      else nextMember.hand.ready.push(techniqueSnapshot(card,nextInstanceId(member,"technique"),card));
      return next;
    }
    const targetIndex=(member.equipment||[]).findIndex(item=>same(item.id,targetId));if(targetIndex<0)return manager;
    const current=member.equipment[targetIndex].upgrade,catalogId=identity(rawCatalogId);
    if(!catalogId){
      if(!current)return manager;
      const next=clone(manager);next.members[key].equipment[targetIndex].upgrade=null;return next;
    }
    const card=findCatalog(upgradeCatalog(data),catalogId);if(!card||current?.catalogId===card.catalogId)return manager;
    if(!canAttachUpgrade(gearRules(member.equipment[targetIndex],data),card))return manager;
    if((member.equipment||[]).some((item,index)=>index!==targetIndex&&item.upgrade?.catalogId===card.catalogId))return manager;
    const next=clone(manager);next.members[key].equipment[targetIndex].upgrade=upgradeSnapshot(card,card);return next;
  }

  function addEquipment(manager,key,name){
    const cleanName=clean(name,120),member=manager?.members?.[key];if(!cleanName||!member)return clone(manager);
    if((member.equipment||[]).some(item=>normalizedName(item.name)===normalizedName(cleanName)))return clone(manager);
    const next=clone(manager);next.members[key].equipment.push(equipmentSnapshot({name:cleanName},nextInstanceId(member,"gear"),null,true,null));return next;
  }
  function removeEquipment(manager,key,id){
    const member=manager?.members?.[key],item=(member?.equipment||[]).find(card=>same(card.id,id)),next=updateMember(manager,key,current=>{current.equipment=(current.equipment||[]).filter(card=>!same(card.id,id))});
    const outpostCatalogId=outpostEquipmentCatalog(item);
    if(outpostCatalogId&&Array.isArray(next.outpost?.merchantGear))next.outpost.merchantGear=next.outpost.merchantGear.filter(assignment=>assignment.catalogId!==outpostCatalogId||assignment.assignedMemberKey!==key);
    return next;
  }

  function addTechnique(manager,key,name){
    const cleanName=clean(name,160),member=manager?.members?.[key];if(!cleanName||member?.kind!=="knight")return clone(manager);
    const next=clone(manager);next.members[key].hand.ready.push(techniqueSnapshot({name:cleanName,front:cleanName,back:"",custom:true},nextInstanceId(member,"technique")));return next;
  }
  function moveTechnique(manager,key,cardId,toZone){
    if(!ZONES.includes(toZone))return clone(manager);
    return updateMember(manager,key,member=>{
      const found=allTechniques(member).find(item=>same(item.card.id,cardId));if(!found)return;
      member.hand[found.zone].splice(found.index,1);member.hand[toZone].push(found.card);
    });
  }
  function removeTechnique(manager,key,cardId){return updateMember(manager,key,member=>{for(const zone of ZONES)member.hand[zone]=(member.hand[zone]||[]).filter(card=>!same(card.id,cardId))})}

  function currentPortrait(member,data){
    const source=data?.knights?.[member?.sourceId]||{};
    const portraits=Array.isArray(source.portraits)?source.portraits:[];
    return portraits.find(card=>same(card.id,member?.portraitId))||defaultPortrait(source);
  }

  function techniqueRefreshCount(member,action,data){
    const requested=action?.cardRefresh??action?.refreshCount;
    if(requested!==null&&requested!==undefined&&requested!==""&&Number.isFinite(Number(requested)))return boundedInteger(requested,0,99);
    const portrait=currentPortrait(member,data),catalogValue=portrait?.cardRefresh??member?.cardRefresh;
    return boundedInteger(catalogValue,0,99);
  }

  function isKnightPoolResource(tokenId,data){
    const token=clean(tokenId,80).toLowerCase();
    const configured=(Array.isArray(data?.knightPoolTokens)?data.knightPoolTokens:[]).find(item=>same(item?.id??item?.tokenId,tokenId));
    if(configured)return configured.kind==="resource";
    return ["magic","fleisch","zeal"].some(id=>token===id||token.endsWith(`:${id}`)||token.endsWith(`.${id}`)||token.endsWith(`-${id}`));
  }

  function applyRuntimeAction(manager,key,action,data={}){
    if(!manager||typeof manager!=="object"||!action||typeof action!=="object")return manager;
    const kind=clean(action.kind||action.type,80);

    if(kind==="adjust-knight-pool"){
      const tokenId=clean(action.tokenId??action.cardId??action.id,80),delta=Math.trunc(Number(action.delta));
      if(!tokenId||!Number.isFinite(delta)||delta===0)return manager;
      const current=boundedInteger(manager.knightPool?.[tokenId],0,99),value=boundedInteger(current+delta,0,99);
      if(value===current)return manager;
      const next=clone(manager);next.knightPool=normalizeKnightPool(next.knightPool);next.knightPool[tokenId]=value;return next;
    }
    if(kind==="clear-knight-pool"){
      const pool=normalizeKnightPool(manager.knightPool),ordinaryIds=Object.keys(pool).filter(tokenId=>!isKnightPoolResource(tokenId,data));
      if(!ordinaryIds.length)return manager;
      const next=clone(manager);next.knightPool=Object.fromEntries(Object.entries(pool).filter(([tokenId])=>isKnightPoolResource(tokenId,data)));return next;
    }

    const member=manager.members?.[key];
    if(!member)return manager;

    if(kind==="advance-technique-zone"||kind==="advance-techniques"){
      const refreshCount=techniqueRefreshCount(member,action,data),cooldown=member.hand?.cooldown||[],delay=member.hand?.delay||[];
      const returning=Math.min(refreshCount,cooldown.length);
      if(returning===0&&delay.length===0)return manager;
      const next=clone(manager),hand=next.members[key].hand;
      const refreshed=hand.cooldown.splice(0,returning);
      hand.ready.push(...refreshed);
      hand.cooldown.push(...hand.delay);
      hand.delay=[];
      return next;
    }
    if(kind==="return-all-techniques"||kind==="reset-techniques"){
      const hand=member.hand||{},hasDepleted=ZONES.slice(1).some(zone=>(hand[zone]||[]).length>0);
      if(!hasDepleted)return manager;
      const next=clone(manager),nextHand=next.members[key].hand;
      nextHand.ready=[...nextHand.ready,...nextHand.cooldown,...nextHand.delay,...nextHand.discard];
      nextHand.cooldown=[];nextHand.delay=[];nextHand.discard=[];
      return next;
    }

    const equipmentId=action.equipmentId??action.cardId??action.id;
    const equipmentIndex=(member.equipment||[]).findIndex(item=>same(item.id,equipmentId));
    const isEquipmentAction=[
      "toggle-equipment-ready","toggle-equipment-exhausted","toggle-equipment-discarded","change-equipment-charges",
      "discard-equipment","restore-equipment","spend-equipment-charge","add-equipment-charge",
    ].includes(kind);
    if(isEquipmentAction&&equipmentIndex<0)return manager;

    if(kind==="toggle-equipment-ready"||kind==="toggle-equipment-exhausted"){
      const item=member.equipment[equipmentIndex];if(item.discarded)return manager;
      const next=clone(manager);next.members[key].equipment[equipmentIndex].ready=!item.ready;return next;
    }
    if(kind==="toggle-equipment-discarded"){
      const item=member.equipment[equipmentIndex],next=clone(manager),nextItem=next.members[key].equipment[equipmentIndex];
      nextItem.discarded=!item.discarded;nextItem.ready=true;
      if(nextItem.discarded)nextItem.ready=false;
      return next;
    }
    if(kind==="discard-equipment"||kind==="restore-equipment"){
      const item=member.equipment[equipmentIndex],discarded=kind==="discard-equipment";
      if(item.discarded===discarded&&item.ready===!discarded)return manager;
      const next=clone(manager),nextItem=next.members[key].equipment[equipmentIndex];
      nextItem.discarded=discarded;nextItem.ready=!discarded;return next;
    }
    if(kind==="change-equipment-charges"||kind==="spend-equipment-charge"||kind==="add-equipment-charge"){
      const delta=kind==="spend-equipment-charge"?-1:kind==="add-equipment-charge"?1:Math.trunc(Number(action.delta));
      if(!Number.isFinite(delta)||delta===0)return manager;
      const item=member.equipment[equipmentIndex],current=boundedInteger(item.charges??item.chargeTokens,0,99),charges=boundedInteger(current+delta,0,99);
      if(charges===current)return manager;
      const next=clone(manager);next.members[key].equipment[equipmentIndex].charges=charges;return next;
    }
    if(kind==="reset-equipment"){
      const targetId=action.equipmentId??action.cardId??action.id,targetIndexes=targetId===null||targetId===undefined
        ?(member.equipment||[]).map((_,index)=>index)
        :[equipmentIndex].filter(index=>index>=0);
      if(!targetIndexes.length)return manager;
      const resetCharges=boundedInteger(action.charges,0,99);
      const changed=targetIndexes.some(index=>{
        const item=member.equipment[index];return item.ready!==true||item.discarded===true||boundedInteger(item.charges??item.chargeTokens,0,99)!==resetCharges;
      });
      if(!changed)return manager;
      const next=clone(manager);
      for(const index of targetIndexes){const item=next.members[key].equipment[index];item.ready=true;item.discarded=false;item.charges=resetCharges}
      return next;
    }
    return manager;
  }

  function toggleEquipment(manager,key,id){return applyRuntimeAction(manager,key,{kind:"toggle-equipment-ready",equipmentId:id})}

  function drawMettle(manager,data,random=Math.random){
    const next=clone(manager),mettle=next.mettle;if(mettle.current)return next;
    if(!mettle.drawPile.length&&mettle.discardPile.length){mettle.drawPile=shuffle(mettle.discardPile,random);mettle.discardPile=[];mettle.shuffleCount=(mettle.shuffleCount||0)+1}
    const cardId=mettle.drawPile.shift();if(cardId&&data.mettle.cards[cardId])mettle.current={cardId};return next;
  }
  function finishMettle(manager,data,random=Math.random){
    const next=clone(manager),mettle=next.mettle;if(!mettle.current)return next;
    mettle.discardPile.push(mettle.current.cardId);mettle.current=null;
    if(mettle.discardPile.some(id=>data.mettle.cards[id]?.reshuffleAtActionEnd)){
      mettle.drawPile=shuffle([...mettle.drawPile,...mettle.discardPile],random);mettle.discardPile=[];mettle.shuffleCount=(mettle.shuffleCount||0)+1;
    }
    return next;
  }
  function shuffleMettle(manager,random=Math.random){
    const next=clone(manager),mettle=next.mettle;mettle.drawPile=shuffle([...mettle.drawPile,...mettle.discardPile],random);mettle.discardPile=[];mettle.shuffleCount=(mettle.shuffleCount||0)+1;return next;
  }
  function resetMettle(manager,data,random=Math.random){const next=clone(manager);next.mettle=initialMettle(data,random);return next}
  function upgradeMettle(manager,cardId,data,random=Math.random){
    const card=data.mettle.cards[cardId];if(!card)return clone(manager);
    const next=clone(manager),mettle=next.mettle;if(mettle.unlocked.includes(cardId)||next.squireLeads<5)return next;
    const active=[...mettle.drawPile,...mettle.discardPile,...(mettle.current?[mettle.current.cardId]:[])];
    const replacement=active.map(id=>data.mettle.cards[id]).filter(item=>item&&item.clue===card.clue&&(TIER_ORDER[item.tier]??99)<(TIER_ORDER[card.tier]??99)).sort((a,b)=>(TIER_ORDER[a.tier]??99)-(TIER_ORDER[b.tier]??99))[0];
    if(replacement){mettle.drawPile=mettle.drawPile.filter(id=>id!==replacement.id);mettle.discardPile=mettle.discardPile.filter(id=>id!==replacement.id);if(mettle.current?.cardId===replacement.id)mettle.current=null}
    next.squireLeads-=5;mettle.unlocked.push(cardId);mettle.drawPile.push(cardId);mettle.drawPile=shuffle(mettle.drawPile,random);mettle.shuffleCount=(mettle.shuffleCount||0)+1;return next;
  }

  function resetMember(manager,key,descriptor,data){return updateMember(manager,key,member=>Object.assign(member,createMember(descriptor,data)))}

  return {
    ZONES,createMember,ensureManager,setResource,setSquireLeads,setCurveField,setSquireTier,setKnightCard,
    getLoadoutOptions,setLoadoutSelection,getOutpostView,applyOutpostAction,addEquipment,removeEquipment,toggleEquipment,addTechnique,moveTechnique,removeTechnique,
    applyRuntimeAction,drawMettle,finishMettle,shuffleMettle,resetMettle,upgradeMettle,resetMember,
  };
});
