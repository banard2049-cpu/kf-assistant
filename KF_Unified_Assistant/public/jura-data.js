// TTS CustomDeck 329 (facilities), 330 (chants).
// Atlas cell 32912 repeats Devotion Altar; it is one facility, not a second build.
(() => {
const facilityImage=index=>({src:"/assets/jura/facilities.jpg",columns:4,rows:4,index,width:1488,height:980});
const chantImage=index=>({src:"/assets/jura/chants.jpg",columns:3,rows:3,index,width:1501,height:2113});
const facility=(id,name,en,level,index,rules,extra={})=>({id,kind:"facility",name,en,level,rules,image:facilityImage(index),...extra});
const chant=(id,name,en,level,index,charges,rules,extra={})=>({id,kind:"chant",name,en,level,charges,rules,turns:["knight"],image:chantImage(index),...extra});
window.KF_JURA_DATA = {
  startingQuest: "fragments-of-the-past",
  startingFacility: "saints-sanctuary",
  startingFacilityUsesSlot: false,
  unlockRequirements: {1:["citadel-in-the-mists"],2:["going-deeper"],3:["kings-seal"],4:["heart-of-jura"]},
  quests: [
    {id:"fragments-of-the-past",name:"往昔碎片",en:"Fragments of the Past",rules:"在一次远征中获得至少 1 枚化圣碎片；远征结束时阅读万千恐惧扩展书王国秘闻 2954。探索带化圣碎片图标的子王国板块时获得 1 枚化圣碎片。",entry:"2954"},
    {id:"citadel-in-the-mists",name:"雾中神堡",en:"The Citadel in the Mists",rules:"在一次远征中经过至少 5 块子王国板块（包括通道板块）；远征结束时阅读王国秘闻 8354，继续按条目指示结算。7279 确认解锁尤拉后，可在此确认开放低层。",entry:"8354",requires:["fragments-of-the-past"]},
    {id:"history-lesson",name:"历史课",en:"History Lesson",rules:"在一次远征中探索至少 4 块大型或特大型王国板块；远征结束时阅读王国秘闻 3344。",entry:"3344",requires:["citadel-in-the-mists"]},
    {id:"going-deeper",name:"继续深入",en:"Going Deeper",rules:"探索一块带有隧道入口图标的子王国板块；远征结束时阅读王国秘闻 1067。结算后可确认解锁中层；获得 5 化圣碎片，全队分配 5 金钱，其余奖励按条目记录。",entry:"1067",requires:["history-lesson"]},
    {id:"kings-seal",name:"国王封印",en:"King’s Seal",rules:"在完整冲突中击败一名国王；远征结束时阅读王国秘闻 5796。结算后可确认解锁高层；碎片与金钱奖励依国王等级而定，按条目记账。",entry:"5796",requires:["going-deeper"]},
    {id:"heart-of-jura",name:"尤拉之心",en:"Heart of Jura",rules:"全体骑士与侍从均存活，且远征未失败；远征结束时阅读王国秘闻 0471。结算后可确认解锁顶层；获得 10 化圣碎片，全队分配 15 金钱，其余奖励按条目记录。",entry:"0471",requires:["kings-seal"]}
  ],
  cards: [
    facility("saints-sanctuary","圣徒圣所","Sanctuary of Saints",1,1,"前哨站阶段，每位没有任何虔信指示物的骑士，可虔信于一位已解锁的圣徒。解锁尤拉时自带，使用底图上的起始位置。"),
    facility("ancient-workshop","古代工坊","Ancient Workshop",1,0,"忽略远征中第一次将要放置在王国板块上的 1 或更多挡阻指示物。"),
    facility("circle-of-purification","净化魔法圈","Circle of Purification",1,13,"所有骑士可 Fortify（强化）1。恶魔+：改为强化 3。"),
    facility("study-room","研习室","Study Room",1,4,"将本次远征设置的一张遭遇战怪物卡，替换为你选择的另一张遭遇战怪物卡。不能替换由任务或委托添加的卡。"),
    facility("oracle-shrine","神谕圣地","Oracle Shrine",1,3,"查看探索卡组顶端的 X 张卡牌，并以任意顺序放回。X 为所有骑士中最高的顽强、睿智或洞察。"),
    facility("all-seeing-tower","全视之塔","All-seeing Tower",1,2,"揭示至多 X 块相连的王国板块。X 为所有骑士中最高的顽强、睿智或洞察。这些板块仍视为未探索，放置通用指示物提醒。"),
    facility("chapel-of-refuge","庇佑礼拜堂","Chapel of Refuge",1,7,"远征中第一次将要获得灾祸时，这次获得数减少 1。"),
    facility("anti-curse-room","解咒间","Anti-curse Room",2,5,"远征中第一次将要获得诅咒时，这次获得数减少 1。"),
    facility("everflowing-spring","长春泉","The Everflowing Spring",2,6,"远征中所有骑士的烈度上限增加 1。"),
    facility("devotion-altar","虔诚祭坛","Devotion Altar",2,9,"远征中所有骑士的化身投掷结果 +1。"),
    facility("hallway-of-heroes","英雄回廊","Hallway of Heroes",3,10,"所有骑士获得 +1 战意；远征中战意不能低于 1。"),
    facility("conduit-of-invocation","传祷厅","Conduit of Invocation",3,8,"远征中携带的所有圣言获得额外 1 充能。",{chargeBonus:1}),
    facility("great-reliquary","大圣物匣","The Great Reliquary",4,11,"远征中所有骑士的化身投掷结果 +1。如果仅剩下一名骑士，立即结束当前怪物轮并化身。"),
    chant("uplifting-prayer","振奋祷言","Uplifting Prayer",1,6,3,"一名被击倒的骑士立即站起。"),
    chant("psalm-of-calling","召令圣咏","Psalm of Calling",1,7,2,"只能在一名骑士的回合中使用。该骑士获得首要目标指示物，直到下一个怪物轮结束，所有怪物都选择该骑士为目标。",{turns:["knight"]}),
    chant("hasty-prayer","迅疾祷言","Hasty Prayer",1,8,2,"一名骑士移动 1 格。"),
    chant("psalm-of-confusion","惑敌圣咏","Psalm of Confusion",2,3,2,"在你抽取一张 AI 之后、结算它之前，弃置它并再抽取一张 AI。",{turns:["knight","monster"]}),
    chant("psalm-of-transmission","传导圣咏","Psalm of Transmission",2,4,2,"作为免费行动，或当你即将执行一次额外攻击时使用。立即装备武库中的一件武器；可与当前装备交换，被交换的武器返回武库。",{turns:["knight","monster"]}),
    chant("saving-prayer","救赎祷言","Saving Prayer",2,5,2,"当一名骑士即将获得灾祸或状态指示物时，将这次获得数变为 1。",{turns:["knight","monster"]}),
    chant("psalm-of-light","光辉圣咏","Psalm of Light",3,1,1,"选择一项：冲突版图任意 3×3 范围内的每名骑士获得 +4 活力；或任意 5×5 范围内的每名骑士获得 +2 活力。所选范围内每有一格被怪物占据，将 1 枚火焰指示物加入骑士池（至多 3）。"),
    chant("split-second-prayer","瞬时祷言","Split Second Prayer",3,0,2,"一名骑士移动至多 3 格。"),
    chant("psalm-of-reclamation","复苏圣咏","Psalm of Reclamation",4,2,1,"复生一名死去的骑士，将其卡面所示伤害数值设为 0，以站立状态放在与你相邻的格子。该骑士立即移动至多 3 格、执行一次额外攻击，然后死亡；这次死亡不能被忽略。")
  ]
};
})();
