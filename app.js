/* 影片拍攝成本試算表 — 應用邏輯
   https://github.com/MingDaJhong/film_budget_template

   ⚠️ 這個檔案要維持獨立的外部 script，不要 inline 回 index.html。
   Word 匯出那段字串裡有字面的 </body> 與 HTML 註解符號，而 Live Server
   這類開發伺服器會把熱重載用的 script 插在檔案「第一個 body 結束標籤」
   之前 —— 一旦 inline，注入碼自帶的 script 結束標籤就會把整段程式碼攔腰
   截斷，後半段全部變成畫面上的純文字，整頁失效。 */
(function(){
"use strict";

/* =========================================================
   常數
   ========================================================= */
const KEY = "film-budget-v1";

const UNITS = {
  day:    {label:"天",       dur:"天數",   needDur:true},
  half:   {label:"半日",     dur:"半日數", needDur:true},
  hour:   {label:"小時",     dur:"時數",   needDur:true},
  ot:     {label:"加班時",   dur:"時數",   needDur:true},
  min:    {label:"成品分鐘",  dur:"影片分鐘", needDur:"auto"},
  flat:   {label:"式（整案）", dur:"—",     needDur:false},
  each:   {label:"次",       dur:"—",      needDur:false},
  person: {label:"人",       dur:"—",      needDur:false},
  km:     {label:"公里",     dur:"—",      needDur:false}
};

/* 授權範圍加成：業界以「權利」計價，同一支片放官網與上電視價差可達數倍 */
const USAGE = {
  media: { web:{l:"自媒體／官網",p:0}, social:{l:"社群付費投放",p:20}, ooh:{l:"戶外／通路",p:40},
           tv:{l:"電視",p:50}, all:{l:"全媒體買斷",p:80} },
  region:{ tw:{l:"台灣",p:0}, cn:{l:"大中華",p:20}, asia:{l:"亞洲",p:35}, global:{l:"全球",p:60} },
  years: { y1:{l:"1 年",p:0}, y2:{l:"2 年",p:15}, y3:{l:"3 年",p:25}, perp:{l:"永久買斷",p:50} }
};

let uid = 0;
const nid = () => "i" + (Date.now().toString(36)) + (uid++).toString(36);

const item = (name, unit, price, qty, dur, on) => ({
  id: nid(), name, unit, price, qty: qty == null ? 1 : qty,
  dur: dur == null ? 1 : dur, on: on !== false, act: 0
});

/* =========================================================
   預設資料
   ========================================================= */
function defaults(){
  return {
    meta:{ project:"", client:"", date:new Date().toISOString().slice(0,10),
           cur:"NT$", days:1, hours:8, min:3, note:"",
           halfRate:60, otRate:1.5, showAct:false },
    adj:{ conOn:true, con:10, profOn:false, prof:15, taxOn:true, tax:5, disc:0,
          rushOn:false, rush:20, passFeeOn:true, passFee:12 },
    /* 台灣稅務：公司開發票要加營業稅；個人接案被扣執行業務所得與二代健保補充保費 */
    tw:{ on:true, mode:"company", wht:10, nhi:2.11, nhiFloor:20000 },
    ui:{ brk:true, kpi:false },         /* 側欄可收合區段：KPI 預設收起，讓側欄一屏看得完 */
    contract:{
      no:"", signDate:"",
      aName:"", aTax:"", aRep:"", aAddr:"", aContact:"", aPhone:"", aEmail:"",
      bName:"", bTax:"", bRep:"", bAddr:"", bContact:"", bPhone:"", bEmail:"",
      spec:"1920×1080 / MP4 (H.264) / 16:9 / 30fps",
      deliver:"完成影片母檔 1 支",
      shootDate:"", cutDate:"", finalDate:"", acceptDays:7, validDays:30,
      exclude:"演員肖像與聲音授權費\n音樂及圖庫素材授權費\n甲方要求之加班、加場費用",
      pay1:30, pay2:0, pay3:70, payDays:7,
      copyright:"a", showcase:true, confidential:true, showPrice:true,
      penalty:0.3, penaltyCap:20, court:"臺灣臺北地方法院", extra:""
    },
    secs:[
      {id:"equip", kind:"items", icon:"🎥", name:"器材成本", on:true, open:true, fixed:true, sync:true, items:[
        item("攝影機機身（A cam）","day",8000,1,1),
        item("鏡頭組","day",4000,1,1),
        item("燈光組（含燈架、柔光）","day",3500,1,1),
        item("收音設備（監聽、槍型麥、無線）","day",2000,1,1),
        item("腳架／穩定器／滑軌","day",1500,1,1),
        item("記憶卡／硬碟／備份","flat",2000,1,1,false)
      ]},
      {id:"post", kind:"items", icon:"✂️", name:"後期製作（依影片時長）", on:true, open:true, fixed:true, post:true, items:[
        item("剪輯","min",3000,1,1),
        item("調色","min",1500,1,1),
        item("字幕（上字＋校對）","min",300,1,1),
        item("音樂授權／混音","flat",3000,1,1,false),
        item("動態圖像 / 特效","hour",1200,1,4,false)
      ]},
      {id:"rev", kind:"revision", icon:"🔁", name:"修改／改版成本", on:true, open:true, fixed:true,
        rev:{ free:2, total:3, mode:"fixed", amount:3000, pct:8 }},
      {id:"usage", kind:"usage", icon:"📡", name:"授權範圍加成", on:false, open:true, fixed:true,
        usage:{ media:"web", region:"tw", years:"y1", pct:0 }},
      {id:"travel", kind:"items", icon:"🚚", name:"交通費", on:true, open:true, fixed:true, items:[
        item("器材車租借","day",2500,1,1),
        item("油資／過路費","flat",1200,1,1),
        item("停車費","day",300,1,1),
        item("里程補貼","km",12,0,1,false),
        item("外縣市住宿","person",1800,0,1,false)
      ]},
      {id:"misc", kind:"items", icon:"🧾", name:"雜費", on:true, open:true, fixed:true, items:[
        item("餐飲／便當（人次）","person",150,8,1),
        item("耗材（電池、膠帶、燈紙）","flat",1500,1,1),
        item("場地／勘景費","day",3000,1,1,false),
        item("保險／臨時支出","flat",2000,1,1,false)
      ]}
    ]
  };
}

/* 專案類型範本：套用後直接生出一整份合理預算，價格為台灣市場中間帶，可再自行調整
   格式：[名稱, 單位, 單價, 數量, 時長(可省略)] */
const PRESETS = [
  { id:"social", icon:"📱", name:"社群短片", desc:"直式 30–60 秒 · 1 天拍完 · 快速交件",
    meta:{days:1, hours:8, min:1},
    equip:[["攝影機＋鏡頭組","day",9000,1],["燈光組","day",2500,1],["收音設備","day",1500,1],["穩定器／腳架","day",1200,1]],
    post:[["剪輯","min",6000,1],["調色","min",2500,1],["字幕上字","min",800,1],["音樂授權","flat",2000,1]],
    rev:{free:2,total:3,amount:2000},
    travel:[["交通／油資","flat",1500,1]],
    misc:[["餐飲（人次）","person",150,4],["耗材","flat",800,1]],
    add:[{name:"人員", icon:"👥", items:[["導演／攝影","day",12000,1],["攝影助理","day",3500,1]]}] },

  { id:"corp", icon:"🏢", name:"企業形象片", desc:"3–5 分鐘 · 2 天拍攝 · 含腳本與訪談",
    meta:{days:2, hours:10, min:4},
    equip:[["攝影機機身（A cam）","day",8000,1],["B cam","day",5000,1],["鏡頭組","day",4000,1],["燈光組","day",4500,1],["收音設備","day",2500,1],["腳架／穩定器／滑軌","day",2500,1]],
    post:[["剪輯","min",4500,1],["調色","min",2000,1],["字幕（上字＋校對）","min",600,1],["動態圖像／字卡","hour",1500,1,6],["配樂授權／混音","flat",6000,1]],
    rev:{free:2,total:3,amount:4000},
    travel:[["器材車租借","day",2500,1],["油資／過路費","flat",2000,1],["停車費","day",300,1]],
    misc:[["餐飲（人次）","person",180,16],["耗材","flat",2000,1],["場地／勘景","day",3000,1]],
    add:[{name:"人員", icon:"👥", items:[["導演","day",15000,1],["攝影師","day",12000,1],["燈光師","day",7000,1],["收音師","day",6500,1],["製片／執行","day",6000,1]]},
         {name:"前期企劃", icon:"📝", items:[["腳本企劃","flat",25000,1],["分鏡","flat",8000,1]]}] },

  { id:"product", icon:"📦", name:"產品／電商影片", desc:"1–2 分鐘 · 棚拍 · 靜物或情境",
    meta:{days:1, hours:10, min:1.5},
    equip:[["攝影機＋微距鏡","day",9000,1],["棚燈組","day",5000,1],["電動滑軌／轉盤","day",3500,1],["背景／道具桌","day",1500,1]],
    post:[["剪輯","min",6000,1],["調色（產品精修）","min",4000,1],["去背／合成","hour",1800,1,6],["音樂授權","flat",2500,1]],
    rev:{free:2,total:3,amount:3000},
    travel:[["器材運送","flat",2000,1]],
    misc:[["耗材／背景紙","flat",2500,1],["餐飲（人次）","person",180,6]],
    add:[{name:"人員", icon:"👥", items:[["導演／攝影","day",13000,1],["燈光助理","day",4000,1],["美術陳設","day",6000,1]]},
         {name:"棚租", icon:"🏠", items:[["攝影棚","day",12000,1]]}] },

  { id:"event", icon:"🎤", name:"活動紀錄", desc:"論壇／發表會／尾牙 · 多機收音",
    meta:{days:1, hours:10, min:5},
    equip:[["攝影機 A／B／C 機","day",6000,3],["長焦鏡頭","day",2500,1],["收音（混音器＋線路）","day",3500,1],["腳架組","day",1500,3],["補光燈","day",2000,1]],
    post:[["活動精華剪輯","min",3500,1],["調色","min",1200,1],["字幕","min",500,1],["完整版剪輯（多機同步）","hour",1200,1,8]],
    rev:{free:1,total:2,amount:3000},
    travel:[["器材車","day",2500,1],["停車／過路","flat",1000,1]],
    misc:[["餐飲（人次）","person",180,5],["耗材／電池","flat",1500,1]],
    add:[{name:"人員", icon:"👥", items:[["導播／主機","day",12000,1],["攝影師","day",8000,2],["收音師","day",6500,1]]}] },

  { id:"mv", icon:"🎵", name:"音樂錄影帶 MV", desc:"3–5 分鐘 · 含美術造型與演員",
    meta:{days:2, hours:12, min:4},
    equip:[["電影機（含鏡頭）","day",18000,1],["燈光組（大型）","day",12000,1],["穩定器／搖臂","day",8000,1],["移動電源／發電機","day",4000,1]],
    post:[["剪輯","min",6000,1],["調色（電影感）","min",5000,1],["特效／合成","hour",2000,1,10]],
    rev:{free:2,total:3,amount:6000},
    travel:[["器材車＋司機","day",5000,1],["劇組交通","flat",6000,1]],
    misc:[["餐飲（人次）","person",200,30],["耗材","flat",4000,1],["保險","flat",3000,1]],
    add:[{name:"人員", icon:"👥", items:[["導演","day",25000,1],["攝影指導","day",18000,1],["燈光師","day",10000,1],["場務","day",4500,2],["製片","day",8000,1]]},
         {name:"演員／造型", icon:"🎭", items:[["主要演員","day",12000,1],["臨時演員","person",2500,4],["妝髮","day",6000,1],["服裝造型","day",6000,1]]},
         {name:"場地／美術", icon:"🎨", items:[["場地租借","day",15000,1],["美術陳設","flat",20000,1]]}] },

  { id:"interview", icon:"💬", name:"人物訪談／專訪", desc:"半天拍攝 · 雙機訪談 · 含 B-roll",
    meta:{days:0.5, hours:5, min:5},
    equip:[["攝影機（雙機）","day",6000,2],["訪談燈光組","day",3000,1],["領夾麥＋收音","day",2000,1],["腳架組","day",1200,2]],
    post:[["剪輯","min",3500,1],["調色","min",1200,1],["字幕（逐字稿＋上字）","min",1000,1],["配樂授權","flat",2000,1]],
    rev:{free:2,total:2,amount:2500},
    travel:[["交通／油資","flat",1500,1],["停車費","day",300,1]],
    misc:[["餐飲（人次）","person",150,3],["耗材","flat",800,1]],
    add:[{name:"人員", icon:"👥", items:[["導演／訪談","half",12000,1],["攝影師","half",9000,1],["收音／助理","half",5000,1]]}] },

  { id:"course", icon:"🎓", name:"課程／教學影片", desc:"多支成集 · 棚內固定機位 · 含字幕",
    meta:{days:2, hours:8, min:60},
    equip:[["攝影機（雙機）","day",6000,2],["棚燈組","day",4000,1],["提詞機","day",2500,1],["收音設備","day",2000,1]],
    post:[["剪輯","min",800,1],["調色","min",200,1],["字幕（上字＋校對）","min",250,1],["片頭片尾模板","flat",8000,1]],
    rev:{free:1,total:2,amount:2000},
    travel:[["器材運送","flat",2000,1]],
    misc:[["餐飲（人次）","person",180,8],["耗材","flat",1500,1]],
    add:[{name:"人員", icon:"👥", items:[["導演／攝影","day",12000,1],["助理","day",4000,1]]},
         {name:"棚租", icon:"🏠", items:[["攝影棚","day",10000,1]]}] },

  { id:"wedding", icon:"💒", name:"婚禮紀錄", desc:"迎娶＋宴客整日 · 快剪或精華",
    meta:{days:1, hours:12, min:8},
    equip:[["攝影機（雙機）","day",6000,2],["穩定器","day",2500,1],["補光燈","day",1500,1],["收音（誓詞／致詞）","day",2000,1]],
    post:[["精華剪輯","min",3000,1],["調色","min",1000,1],["音樂授權","flat",2500,1],["當日快剪","flat",12000,1]],
    rev:{free:1,total:2,amount:2500},
    travel:[["交通（跨場地）","flat",3000,1],["停車費","flat",600,1]],
    misc:[["餐飲","person",0,2],["耗材／電池","flat",1200,1]],
    add:[{name:"人員", icon:"👥", items:[["主攝影師","day",18000,1],["副攝影師","day",10000,1]]}] }
];

const TEMPLATES = [
  {name:"人員／團隊", icon:"👥", items:[["導演","day",12000],["攝影師","day",10000],["燈光師","day",6000],["收音師","day",6000],["攝影助理","day",3500],["製片／執行","day",5000]]},
  {name:"演員／模特兒", icon:"🎭", items:[["主要演員","day",8000],["臨時演員","person",2000],["肖像授權（一年）","flat",15000]]},
  {name:"場地租借", icon:"🏠", items:[["攝影棚","day",12000],["外景場地","day",6000],["場地保證金／清潔","flat",3000]]},
  {name:"美術／造型", icon:"🎨", items:[["美術設計","day",6000],["道具採購","flat",5000],["服裝造型","day",4500],["妝髮","day",4000]]},
  {name:"空拍／特殊器材", icon:"🚁", items:[["空拍機＋飛手","day",12000],["電影級穩定器","day",6000],["軌道／搖臂","day",8000]]},
  {name:"授權／發布", icon:"📤", items:[["音樂授權","flat",6000],["圖庫／素材","flat",3000],["多平台版本輸出","each",2000]]}
];

/* =========================================================
   狀態與多專案存檔
   ========================================================= */
const SKEY = KEY + ":store";
let S, STORE;

function loadStore(){
  try{
    const st = JSON.parse(localStorage.getItem(SKEY) || "null");
    if(st && Array.isArray(st.projects) && st.projects.length) return st;
  }catch(e){}
  return null;
}
function bootState(){
  STORE = loadStore();
  if(STORE){
    const p = STORE.projects.find(x => x.id === STORE.current) || STORE.projects[0];
    STORE.current = p.id;
    S = migrate(p.data);
    return;
  }
  /* 沒有專案庫：沿用舊版的單一存檔，或給一份預設 */
  S = load() || defaults();
  STORE = { current:"", projects:[] };
  addProject(S.meta.project || "未命名專案", S);
}
function addProject(name, data){
  const p = { id: nid(), name, updated: Date.now(), data };
  STORE.projects.push(p);
  STORE.current = p.id;
  return p;
}
function curProject(){ return STORE.projects.find(x => x.id === STORE.current); }
function saveStore(){
  try{ localStorage.setItem(SKEY, JSON.stringify(STORE)); }catch(e){}
}

/* 舊版存檔沒有新欄位時補齊，避免讀回後出錯 */
function migrate(d){
  const base = defaults();
  d.meta     = Object.assign(base.meta, d.meta || {});
  d.adj      = Object.assign(base.adj, d.adj || {});
  d.contract = Object.assign(base.contract, d.contract || {});
  d.tw       = Object.assign(base.tw, d.tw || {});
  d.ui       = Object.assign(base.ui, d.ui || {});
  (d.secs || []).forEach(s => {
    if(s.pass == null) s.pass = false;
    (s.items || []).forEach(i => { if(i.act == null) i.act = 0; });
  });
  /* 舊存檔沒有授權區塊，補進修改次數後面 */
  if(!d.secs.some(s => s.kind === "usage")){
    const u = base.secs.find(s => s.kind === "usage");
    const at = d.secs.findIndex(s => s.kind === "revision");
    d.secs.splice(at < 0 ? d.secs.length : at + 1, 0, u);
  }
  return d;
}

function load(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return null;
    const d = JSON.parse(raw);
    if(!d || !d.secs) return null;
    return migrate(d);
  }catch(e){ return null; }
}
let saveTimer = null;
function save(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(()=>{
    try{
      const p = curProject();
      if(p){
        p.data = S; p.updated = Date.now();
        if(String(S.meta.project||"").trim()) p.name = S.meta.project.trim();
      }
      saveStore();
      localStorage.setItem(KEY, JSON.stringify(S));   /* 保留舊鍵，匯出／相容用 */
      flashSaved();
    }catch(e){}
  },350);
}
function flashSaved(){
  const t = document.getElementById("savedTag");
  t.style.color = "var(--green)";
  setTimeout(()=>{ t.style.color = ""; }, 600);
}

/* =========================================================
   工具
   ========================================================= */
const $  = (s,r) => (r||document).querySelector(s);
const $$ = (s,r) => Array.from((r||document).querySelectorAll(s));
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const esc = s => String(s==null?"":s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const nf = new Intl.NumberFormat("zh-TW",{maximumFractionDigits:0});
const money = v => S.meta.cur + " " + nf.format(Math.round(v || 0));

function findSec(id){ return S.secs.find(s => s.id === id); }
function findItem(sec, id){ return (sec.items||[]).find(i => i.id === id); }

/* =========================================================
   計算
   ========================================================= */
function itemTotal(it){
  if(!it.on) return 0;
  const p = num(it.price), q = num(it.qty), d = num(it.dur);
  switch(it.unit){
    case "day":
    case "hour": return p * q * d;
    case "half": return p * q * d * num(S.meta.halfRate) / 100;
    case "ot":   return p * q * d * num(S.meta.otRate);
    case "min":  return p * q * num(S.meta.min);
    default:     return p * q;
  }
}
/* 授權加成的計價基數：拍攝＋後期（不含交通、雜費等代墊性支出） */
function usageBase(){
  return S.secs.reduce((a,s)=>{
    if(!s.on || s.kind === "usage" || s.kind === "revision" || s.pass) return a;
    if(s.id === "travel" || s.id === "misc") return a;
    return a + rawSecTotal(s);
  }, 0);
}
/* 三個下拉算出建議加成，實際採用的比例存在 u.pct，使用者可自行覆寫 */
function usageSuggest(u){
  return num((USAGE.media[u.media]||{}).p) + num((USAGE.region[u.region]||{}).p)
       + num((USAGE.years[u.years]||{}).p);
}
function usagePct(u){ return num(u.pct); }
/* 區塊本身的金額，不含代墊管理費 */
function rawSecTotal(sec, ctx){
  if(!sec.on) return 0;
  if(sec.kind === "revision"){
    const r = sec.rev, extra = Math.max(0, num(r.total) - num(r.free));
    const per = r.mode === "pct" ? (ctx && ctx.post ? ctx.post : 0) * num(r.pct) / 100 : num(r.amount);
    return extra * per;
  }
  if(sec.kind === "usage") return usageBase() * usagePct(sec.usage) / 100;
  return (sec.items||[]).reduce((a,i)=> a + itemTotal(i), 0);
}
function secTotal(sec, ctx){
  const raw = rawSecTotal(sec, ctx);
  /* 代墊區塊可加管理費（業界慣例 10–15%，代墊需附收據） */
  return (sec.pass && S.adj.passFeeOn) ? raw * (1 + num(S.adj.passFee) / 100) : raw;
}
function secActual(sec){
  if(sec.kind === "revision" || sec.kind === "usage") return 0;
  return (sec.items||[]).reduce((a,i)=> a + (i.on ? num(i.act) : 0), 0);
}
function compute(){
  const postSec = S.secs.find(s => s.post);
  const post = postSec ? secTotal(postSec) : 0;
  const ctx = { post };
  const per = {}; let direct = 0, passSum = 0, actual = 0;
  S.secs.forEach(s => {
    const v = secTotal(s, ctx);
    per[s.id] = v; direct += v;
    if(s.pass && s.on) passSum += v;
    actual += secActual(s);
  });

  const a = S.adj;
  const rush = a.rushOn ? direct * num(a.rush) / 100 : 0;
  const con  = a.conOn  ? direct * num(a.con)  / 100 : 0;
  const prof = a.profOn ? direct * num(a.prof) / 100 : 0;
  const disc = num(a.disc);
  const base = Math.max(0, direct + rush + con + prof - disc);
  const tax  = a.taxOn ? base * num(a.tax) / 100 : 0;
  const total = base + tax;

  // 拍攝期 = 直接成本 - 後期 - 修改 - 授權
  const revSec = S.secs.find(s => s.kind === "revision");
  const useSec = S.secs.find(s => s.kind === "usage");
  const rev = revSec ? per[revSec.id] : 0;
  const usage = useSec ? per[useSec.id] : 0;
  const shoot = direct - post - rev - usage;

  return Object.assign({ per, direct, rush, con, prof, disc, tax, total,
                         post, rev, usage, shoot, passSum, actual },
                       twCalc(base, tax, total));
}

/* 台灣稅務：算出「客戶付多少 → 你實拿多少」
   公司開發票：營業稅是代收代付，要繳給國稅局，不算收入
   個人接案：被扣 10% 執行業務所得，單筆達門檻再扣 2.11% 二代健保補充保費 */
function twCalc(base, tax, total){
  const t = S.tw;
  if(!t.on) return { twNet: total, twWht: 0, twNhi: 0, twVat: 0 };
  if(t.mode === "company"){
    return { twVat: tax, twWht: 0, twNhi: 0, twNet: total - tax };
  }
  /* 扣繳以「給付總額」計算，也就是客戶實際付出的金額 */
  const wht = total * num(t.wht) / 100;
  const nhi = total >= num(t.nhiFloor) ? total * num(t.nhi) / 100 : 0;
  return { twVat: 0, twWht: wht, twNhi: nhi, twNet: total - wht - nhi };
}

/* =========================================================
   繪製：區塊
   ========================================================= */
function unitOptions(sel){
  return Object.keys(UNITS).map(k =>
    `<option value="${k}"${k===sel?" selected":""}>${UNITS[k].label}</option>`).join("");
}

function rowHTML(sec, it){
  const u = UNITS[it.unit] || UNITS.flat;
  let durCell;
  if(u.needDur === "auto"){
    durCell = `<input type="number" class="auto" value="${num(S.meta.min)}" readonly title="自動帶入成品影片長度（分鐘）">`;
  }else if(u.needDur){
    durCell = `<input type="number" min="0" step="0.5" value="${it.dur}" data-f="dur">`;
  }else{
    durCell = `<span class="na">—</span>`;
  }
  const actCell = S.meta.showAct
    ? `<div class="cell act" data-l="實際"><input type="number" min="0" step="100" value="${num(it.act)}" data-f="act" placeholder="0"></div>`
    : "";
  return `<div class="row${it.on?"":" off"}${S.meta.showAct?" has-act":""}" data-item="${it.id}">
    <div><input type="checkbox" data-f="on"${it.on?" checked":""} title="計入／不計入"></div>
    <div class="cell" data-l="項目"><input type="text" value="${esc(it.name)}" data-f="name" placeholder="項目名稱"></div>
    <div class="cell" data-l="計價單位"><select data-f="unit">${unitOptions(it.unit)}</select></div>
    <div class="cell" data-l="單價"><input type="number" min="0" step="100" value="${it.price}" data-f="price"></div>
    <div class="cell" data-l="數量"><input type="number" min="0" step="1" value="${it.qty}" data-f="qty"></div>
    <div class="cell" data-l="${u.dur === "—" ? "時長" : u.dur}">${durCell}</div>
    <div class="sub" data-sub="${it.id}">${money(itemTotal(it))}</div>
    ${actCell}
    <div><button class="del" data-act="del-item" title="刪除">×</button></div>
  </div>`;
}

function itemsBody(sec){
  const rows = (sec.items||[]).map(i => rowHTML(sec,i)).join("");
  const A = S.meta.showAct;
  const syncBtn = sec.sync ? `<button class="btn sm" data-act="sync-days">⇄ 同步拍攝天數</button>` : "";
  const hint = sec.post
    ? `<p class="note">「成品分鐘」會自動乘上上方的<b>成品影片長度</b>；例如剪輯 ${money(3000)}／分鐘 × ${num(S.meta.min)} 分鐘。想改成整案固定價，把單位切成「式（整案）」即可。</p>`
    : "";
  const passBtn = `<button class="btn sm ghost${sec.pass?" on":""}" data-act="toggle-pass"
      title="代墊款會另加管理費，並在總覽中分開統計">${sec.pass?"✔ 代墊款":"標記為代墊款"}</button>`;
  return `<div class="tbl${S.meta.showAct?" with-act":""}">
      <div class="thead">
        <div></div><div>項目</div><div>計價單位</div><div class="r">單價</div>
        <div class="r">數量</div><div class="r">時長</div><div class="r">小計</div>${A?'<div class="r">實際</div>':""}<div></div>
      </div>
      ${rows || `<p class="note">目前沒有項目，點下方「＋ 新增項目」。</p>`}
    </div>
    <div class="sec-actions">
      <button class="btn sm" data-act="add-item">＋ 新增項目</button>
      ${syncBtn}${passBtn}
      <button class="btn sm ghost" data-act="dup-sec" title="複製整個區塊">⧉ 複製區塊</button>
    </div>${hint}`;
}

function revBody(sec){
  const r = sec.rev;
  const extra = Math.max(0, num(r.total) - num(r.free));
  const postSec = S.secs.find(s => s.post);
  const post = postSec ? secTotal(postSec) : 0;
  const per = r.mode === "pct" ? post * num(r.pct) / 100 : num(r.amount);
  return `<div class="rev-grid">
      <div class="field"><label>合約內免費修改次數</label>
        <input type="number" min="0" step="1" value="${r.free}" data-rf="free"></div>
      <div class="field"><label>預計總修改次數</label>
        <input type="number" min="0" step="1" value="${r.total}" data-rf="total"></div>
      <div class="field"><label>超出次數計價方式</label>
        <select data-rf="mode">
          <option value="fixed"${r.mode==="fixed"?" selected":""}>每次固定金額</option>
          <option value="pct"${r.mode==="pct"?" selected":""}>後期費用的百分比</option>
        </select></div>
      ${ r.mode === "pct"
        ? `<div class="field"><label>每次收取後期費用的</label>
             <input type="number" min="0" step="1" value="${r.pct}" data-rf="pct"><span class="hint">目前後期＝${money(post)}</span></div>`
        : `<div class="field"><label>每次修改費用</label>
             <input type="number" min="0" step="500" value="${r.amount}" data-rf="amount"></div>` }
    </div>
    <div class="formula">超出 <b>${extra}</b> 次 × 每次 <b>${money(per)}</b> ＝ <b>${money(extra*per)}</b></div>
    <p class="note">建議在報價單寫明免費修改次數，超出的部分才有依據收費。大改（重新結構、重拍）通常另計，可在自訂區塊另開一項。</p>`;
}

function usageBody(sec){
  const u = sec.usage, base = usageBase(), pct = usagePct(u), sug = usageSuggest(u);
  const opt = (g, sel) => Object.keys(USAGE[g]).map(k =>
    `<option value="${k}"${k===sel?" selected":""}>${USAGE[g][k].l}（+${USAGE[g][k].p}%）</option>`).join("");
  return `<div class="rev-grid">
      <div class="field"><label>播放媒體</label><select data-uf="media">${opt("media",u.media)}</select></div>
      <div class="field"><label>授權地域</label><select data-uf="region">${opt("region",u.region)}</select></div>
      <div class="field"><label>授權年限</label><select data-uf="years">${opt("years",u.years)}</select></div>
      <div class="field"><label>實際加成 %</label>
        <input type="number" min="0" step="5" value="${pct}" data-uf="pct">
        <span class="hint">建議 ${sug}%${pct!==sug?`（已自行調整）`:""}</span></div>
    </div>
    <div class="formula">製作費 <b>${money(base)}</b> × 加成 <b>${pct}%</b> ＝ <b>${money(base*pct/100)}</b></div>
    <p class="note">授權範圍是報價的獨立維度 —— 業界的說法是「以權利計價，不是以工時計價」。同一支片只放官網、投社群廣告、上電視或買斷全媒體，價格可以差好幾倍。基數為<b>拍攝與後期</b>費用（不含交通、雜費與代墊款）。改上面三個選項會帶入建議加成，你也可以直接改「實際加成」覆寫。</p>`;
}

function secHTML(sec){
  const t = secTotal(sec, { post: (()=>{ const p = S.secs.find(x=>x.post); return p ? secTotal(p) : 0; })() });
  const cls = "card sec" + (sec.on ? "" : " off") + (sec.open === false ? " collapsed" : "");
  const delBtn = sec.fixed ? "" : `<button class="iconbtn danger no-print" data-act="del-sec" title="刪除此區塊" aria-label="刪除此區塊">🗑</button>`;
  const tag = sec.pass ? `<span class="tag" title="代墊款：另加管理費，總覽中分開統計">代墊</span>` : "";
  const title = sec.fixed
    ? `<h2 style="flex:1"><span class="ico">${sec.icon}</span>${esc(sec.name)}${tag}</h2>`
    : `<span class="ico">${sec.icon}</span><input class="sec-title" value="${esc(sec.name)}" data-act="ren-sec">${tag}`;
  const body = sec.kind === "revision" ? revBody(sec)
             : sec.kind === "usage"    ? usageBody(sec)
             : itemsBody(sec);
  return `<section class="${cls}" data-sec="${sec.id}">
    <div class="card-head">
      <label class="sw no-print"><input type="checkbox" data-act="toggle-sec"${sec.on?" checked":""}><i></i></label>
      ${title}
      <span class="sec-sum" data-secsum="${sec.id}">${money(t)}</span>
      <button class="iconbtn no-print" data-act="fold" title="收合／展開" aria-label="收合或展開"><span class="chev"></span></button>
      ${delBtn}
    </div>
    <div class="card-body sec-body">${body}</div>
  </section>`;
}

function renderSections(){
  $("#sections").innerHTML = S.secs.map(secHTML).join("");
}

/* =========================================================
   繪製：總覽
   ========================================================= */
/* ---------- 成本分佈的動畫 ----------
   關鍵：只在區塊組成改變時重建 DOM，其餘時候更新既有節點。
   innerHTML 整段重畫會換掉節點，CSS transition 就沒有前後值可以過渡。 */
const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const CNT = new WeakMap();          /* 數字跑動的狀態：目前值與 rAF id */

function countTo(el, target, fmt){
  const st = CNT.get(el) || { cur: null, raf: 0 };
  if(st.raf) cancelAnimationFrame(st.raf);
  /* 第一次繪製、關閉動畫偏好、差距太小，或分頁在背景（rAF 會被凍結，
     數字會卡在舊值）都直接寫上去，不跑動畫 */
  if(st.cur === null || REDUCED || document.hidden || Math.abs(target - st.cur) < 1){
    st.cur = target; st.raf = 0; CNT.set(el, st);
    el.textContent = fmt(target); return;
  }
  const from = st.cur, t0 = performance.now(), dur = 420;
  const step = now => {
    const k = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);                 /* easeOutCubic */
    st.cur = from + (target - from) * e;
    el.textContent = fmt(k < 1 ? st.cur : target);
    st.raf = k < 1 ? requestAnimationFrame(step) : 0;
    if(k >= 1) st.cur = target;
    CNT.set(el, st);
  };
  st.raf = requestAnimationFrame(step);
  CNT.set(el, st);
}

/* 漸層以「佔總成本比例」縮放：比例越高，露出的漸層越靠右（黃 → 橘 → 紅）。
   到 EXTREME 這個門檻才會完整露出、尾端見紅。 */
const EXTREME = 0.6;
function gradientZoom(share){
  const k = Math.min(1, share / EXTREME);
  return k > 0.01 ? (100 / k).toFixed(1) + "%" : "10000%";
}

let brkSig = "";
function renderBrk(c){
  const host = $("#brk");
  const sig = S.secs.map(s => s.id).join("|");
  const built = sig !== brkSig;      /* 這次是重建：直接就位，不要有動畫 */
  if(built){
    brkSig = sig;
    host.innerHTML = S.secs.map(s =>
      `<div class="brk-item" data-brk="${s.id}">
         <div class="brk-top">
           <span class="bn"></span>
           <span class="bv"><b data-amt></b><em data-pct></em></span>
         </div>
         <div class="bar"><i></i></div>
       </div>`).join("");
  }
  const max = Math.max(1, ...S.secs.map(s => c.per[s.id] || 0));
  S.secs.forEach(s => {
    const el = host.querySelector(`[data-brk="${s.id}"]`); if(!el) return;
    const v = c.per[s.id] || 0;
    el.classList.toggle("off", !s.on);
    el.querySelector(".bn").textContent = `${s.icon} ${s.name}`;
    countTo(el.querySelector("[data-amt]"), v, money);
    countTo(el.querySelector("[data-pct]"), c.direct > 0 ? v / c.direct * 100 : 0,
            x => " " + Math.round(x) + "%");
    const fill = el.querySelector(".bar i");
    const w  = (v / max * 100).toFixed(1) + "%";
    const gz = gradientZoom(c.direct > 0 ? v / c.direct : 0);
    if(built){
      /* 首次繪製：關掉過渡直接定位，避免長條從 0 長出來變成進場動畫 */
      fill.style.transition = "none";
      fill.style.width = w;
      fill.style.setProperty("--gz", gz);
      void fill.offsetWidth;
      fill.style.transition = "";
    }else if(fill.style.width !== w){
      fill.style.width = w;
      fill.style.setProperty("--gz", gz);
      if(!REDUCED && !document.hidden){                /* 數值變動時掃一道光 */
        el.classList.remove("pulse"); void el.offsetWidth; el.classList.add("pulse");
      }
    }else if(fill.style.getPropertyValue("--gz") !== gz){
      fill.style.setProperty("--gz", gz);              /* 佔比變了但長度沒變 */
    }
  });
}

function renderSummary(){
  const c = compute();
  renderBrk(c);

  $("#t_direct").textContent = money(c.direct);
  const setLine = (id, label, val, show) => {
    const el = $("#"+id);
    el.style.display = show ? "" : "none";
    el.children[0].textContent = label;
    el.children[1].textContent = (val < 0 ? "-" : "") + money(Math.abs(val));
  };
  setLine("r_rush", `趕件加成 ${num(S.adj.rush)}%`,        c.rush, S.adj.rushOn && c.rush > 0);
  setLine("r_con",  `預備金／管理費 ${num(S.adj.con)}%`,  c.con,  S.adj.conOn && c.con > 0);
  setLine("r_prof", `利潤／服務費 ${num(S.adj.prof)}%`,   c.prof, S.adj.profOn && c.prof > 0);
  setLine("r_disc", "折扣",                                -c.disc, c.disc > 0);
  setLine("r_tax",  `稅金 ${num(S.adj.tax)}%`,             c.tax,  S.adj.taxOn && c.tax > 0);

  $("#t_total").textContent = money(c.total);
  $("#k_min").textContent   = num(S.meta.min)  > 0 ? money(c.total / num(S.meta.min))  : "—";
  $("#k_day").textContent   = num(S.meta.days) > 0 ? money(c.total / num(S.meta.days)) : "—";
  $("#k_shoot").textContent = money(c.shoot);
  $("#k_post").textContent  = money(c.post + c.rev);

  /* 代墊款：客戶付的錢裡有一部分是幫忙墊的，不是收入 */
  const passBox = $("#passBox");
  passBox.style.display = c.passSum > 0 ? "" : "none";
  if(c.passSum > 0){
    $("#t_pass").textContent = money(c.passSum);
    $("#t_own").textContent  = money(c.direct - c.passSum);
  }

  /* 預算 vs 實際 */
  const actBox = $("#actBox");
  actBox.style.display = S.meta.showAct ? "" : "none";
  if(S.meta.showAct){
    const diff = c.direct - c.actual;
    $("#t_actual").textContent = money(c.actual);
    const d = $("#t_diff");
    d.textContent = (diff < 0 ? "超支 " : "結餘 ") + money(Math.abs(diff));
    d.style.color = diff < 0 ? "var(--red)" : "var(--green)";
  }

  renderTwLines(c);
  updatePayHint();
}

/* 讓「客戶／單位 → 合約甲方」的關係在畫面上看得見：
   甲方留白時，用 placeholder 直接顯示實際會帶入的名稱 */
function syncClientHint(){
  const el = $("#c_aName"); if(!el) return;
  const c = String(S.meta.client || "").trim();
  el.placeholder = c ? `留白＝沿用「${c}」` : "留白則沿用上方的「客戶／單位」";
  const tip = $("#aNameHint");
  if(tip) tip.textContent = String(S.contract.aName || "").trim()
    ? "已另外填寫，文件會用這裡的名稱"
    : (c ? `目前會帶入：${c}` : "上方也還沒填，文件上會留空白讓你手寫");
}

/* 套用側欄區段的收合狀態（切換專案、匯入時要跟著還原） */
function renderFolds(){
  $$("[data-fold]").forEach(el => {
    el.classList.toggle("closed", !S.ui[el.dataset.fold]);
  });
}

/* 依接案身分切換欄位與說明 */
function renderTw(){
  const co = S.tw.mode === "company";
  $$(".tw-personal").forEach(el => { el.style.display = co ? "none" : ""; });
  $("#twNote").innerHTML = co
    ? `公司或工作室開立發票時，<b>營業稅是代收代付</b> —— 客戶付的那 ${num(S.adj.tax)}% 要繳給國稅局，不是你的收入。所以「實拿」會扣掉它。（要讓客戶看到含稅價，請保持右側「稅金」為開啟。）`
    : `個人以執行業務所得承接時，付款方通常會先<b>扣繳 ${num(S.tw.wht)}% 所得稅</b>；單筆給付達 ${money(num(S.tw.nhiFloor))} 以上，還要再扣<b>二代健保補充保費 ${num(S.tw.nhi)}%</b>。兩者都以給付總額計算。扣繳的稅次年報稅時可抵繳，不是真的損失，但會影響你當下的現金流。${S.adj.taxOn ? `<br><b style="color:var(--red)">目前右側「稅金」是開啟的</b> —— 個人接案通常不開立發票、不加營業稅，建議關掉再看實拿金額。` : ""}`;
}

/* 台灣稅務：客戶付 → 實拿 */
function renderTwLines(c){
  const box = $("#twBox");
  box.style.display = S.tw.on ? "" : "none";
  if(!S.tw.on) return;
  const co = S.tw.mode === "company";
  $("#w_pay").textContent = money(c.total);
  const set = (id, label, val, show) => {
    const el = $("#"+id);
    el.style.display = show ? "" : "none";
    el.children[0].textContent = label;
    el.children[1].textContent = "-" + money(val);
  };
  set("w_l1", `營業稅 ${num(S.adj.tax)}%（代收代付）`, c.twVat, co && c.twVat > 0);
  set("w_l2", `執行業務所得扣繳 ${num(S.tw.wht)}%`,     c.twWht, !co && c.twWht > 0);
  set("w_l3", `二代健保補充保費 ${num(S.tw.nhi)}%`,     c.twNhi, !co && c.twNhi > 0);
  $("#w_net").textContent = money(c.twNet);
}

/* 只更新數字，不重繪 DOM（避免輸入時失焦） */
function refresh(){
  const postSec = S.secs.find(s => s.post);
  const ctx = { post: postSec ? secTotal(postSec) : 0 };
  S.secs.forEach(sec => {
    (sec.items||[]).forEach(it => {
      const el = document.querySelector(`[data-sub="${it.id}"]`);
      if(el) el.textContent = money(itemTotal(it));
    });
    const ss = document.querySelector(`[data-secsum="${sec.id}"]`);
    if(ss) ss.textContent = money(secTotal(sec, ctx));
  });
  // 「成品分鐘」欄位連動
  $$(".row input.auto").forEach(el => { el.value = num(S.meta.min); });
  // 修改次數公式即時更新
  const revSec = S.secs.find(s => s.kind === "revision");
  if(revSec){
    const host = document.querySelector(`[data-sec="${revSec.id}"] .formula`);
    if(host){
      const r = revSec.rev, extra = Math.max(0, num(r.total) - num(r.free));
      const per = r.mode === "pct" ? ctx.post * num(r.pct) / 100 : num(r.amount);
      host.innerHTML = `超出 <b>${extra}</b> 次 × 每次 <b>${money(per)}</b> ＝ <b>${money(extra*per)}</b>`;
    }
  }
  const useSec = S.secs.find(s => s.kind === "usage");
  if(useSec){
    const host = document.querySelector(`[data-sec="${useSec.id}"] .formula`);
    if(host){
      const b = usageBase(), p = usagePct(useSec.usage);
      host.innerHTML = `製作費 <b>${money(b)}</b> × 加成 <b>${p}%</b> ＝ <b>${money(b*p/100)}</b>`;
    }
  }
  renderSummary();
  save();
}
function renderAll(){ renderSections(); renderSummary(); }

/* =========================================================
   表單（meta / adj）
   ========================================================= */
const METAF = {m_project:"project", m_client:"client", m_date:"date", m_cur:"cur",
               m_days:"days", m_hours:"hours", m_min:"min", m_note:"note",
               m_halfRate:"halfRate", m_otRate:"otRate"};
const ADJF  = {a_conOn:"conOn", a_con:"con", a_profOn:"profOn", a_prof:"prof",
               a_taxOn:"taxOn", a_tax:"tax", a_disc:"disc",
               a_rushOn:"rushOn", a_rush:"rush", a_passFeeOn:"passFeeOn", a_passFee:"passFee"};
const TWF   = {w_on:"on", w_mode:"mode", w_wht:"wht", w_nhi:"nhi", w_nhiFloor:"nhiFloor"};

function fillForm(){
  Object.keys(METAF).forEach(id => { $("#"+id).value = S.meta[METAF[id]]; });
  Object.keys(ADJF).forEach(id => {
    const el = $("#"+id), k = ADJF[id];
    if(el.type === "checkbox") el.checked = !!S.adj[k]; else el.value = S.adj[k];
  });
  Object.keys(S.contract).forEach(k => {
    const el = $("#c_"+k); if(!el) return;
    if(el.type === "checkbox") el.checked = !!S.contract[k]; else el.value = S.contract[k];
  });
  Object.keys(TWF).forEach(id => {
    const el = $("#"+id), k = TWF[id];
    if(el.type === "checkbox") el.checked = !!S.tw[k]; else el.value = S.tw[k];
  });
  $("#m_showAct").checked = !!S.meta.showAct;
  renderFolds();
  syncClientHint();
}

/* =========================================================
   事件
   ========================================================= */
function bindForms(){
  Object.keys(METAF).forEach(id => {
    $("#"+id).addEventListener("input", e => {
      const k = METAF[id];
      S.meta[k] = (e.target.type === "number") ? num(e.target.value) : e.target.value;
      if(k === "client") syncClientHint();
      if(k === "cur" || k === "min" || k === "days" || k === "hours") refresh();
      else save();
    });
  });
  Object.keys(ADJF).forEach(id => {
    const el = $("#"+id);
    el.addEventListener("input", e => {
      const k = ADJF[id];
      S.adj[k] = el.type === "checkbox" ? el.checked : num(el.value);
      if(k === "taxOn" || k === "tax") renderTw();          /* 說明文字要跟著改 */
      if(k === "passFeeOn" || k === "passFee") refresh();    /* 影響各區塊小計 */
      else renderSummary();
      save();
    });
  });
  Object.keys(S.contract).forEach(k => {
    const el = $("#c_"+k); if(!el) return;
    el.addEventListener("input", ()=>{
      S.contract[k] = el.type === "checkbox" ? el.checked
                    : el.type === "number"   ? num(el.value)
                    : el.value;
      if(k === "aName") syncClientHint();
      updatePayHint(); save();
    });
  });
  Object.keys(TWF).forEach(id => {
    const el = $("#"+id), k = TWF[id];
    el.addEventListener("input", ()=>{
      S.tw[k] = el.type === "checkbox" ? el.checked
              : el.type === "number"   ? num(el.value) : el.value;
      if(k === "mode") renderTw();
      renderSummary(); save();
    });
  });
  /* 顯示實際欄位會改變表格結構，需要整份重繪 */
  $("#m_showAct").addEventListener("input", e => {
    S.meta.showAct = e.target.checked;
    renderAll(); save();
  });
}

document.addEventListener("input", e => {
  const row = e.target.closest("[data-item]");
  if(row){
    const sec = findSec(row.closest("[data-sec]").dataset.sec);
    const it  = findItem(sec, row.dataset.item);
    const f   = e.target.dataset.f;
    if(!it || !f) return;
    if(f === "name") it.name = e.target.value;
    else if(f === "on"){ it.on = e.target.checked; row.classList.toggle("off", !it.on); }
    else it[f] = num(e.target.value);
    refresh();
    return;
  }
  const rf = e.target.dataset.rf;
  if(rf){
    const sec = findSec(e.target.closest("[data-sec]").dataset.sec);
    sec.rev[rf] = (rf === "mode") ? e.target.value : num(e.target.value);
    refresh();
    return;
  }
  if(e.target.dataset.uf === "pct"){
    findSec(e.target.closest("[data-sec]").dataset.sec).usage.pct = num(e.target.value);
    refresh();
    return;
  }
  if(e.target.dataset.act === "ren-sec"){
    findSec(e.target.closest("[data-sec]").dataset.sec).name = e.target.value;
    renderSummary(); save();
  }
});

document.addEventListener("change", e => {
  // 單位切換需要重繪該列（時長欄位型態不同）
  if(e.target.dataset.f === "unit"){
    const row = e.target.closest("[data-item]");
    const sec = findSec(row.closest("[data-sec]").dataset.sec);
    const it  = findItem(sec, row.dataset.item);
    it.unit = e.target.value;
    if(it.unit === "day")  it.dur = num(S.meta.days)  || 1;
    if(it.unit === "hour") it.dur = num(S.meta.hours) || 1;
    row.outerHTML = rowHTML(sec, it);
    refresh();
  }
  if(e.target.dataset.rf === "mode"){
    const sec = findSec(e.target.closest("[data-sec]").dataset.sec);
    sec.rev.mode = e.target.value;
    $(`[data-sec="${sec.id}"] .sec-body`).innerHTML = revBody(sec);
    refresh();
  }
  const uf = e.target.dataset.uf;
  if(uf && uf !== "pct"){
    const sec = findSec(e.target.closest("[data-sec]").dataset.sec);
    sec.usage[uf] = e.target.value;
    sec.usage.pct = usageSuggest(sec.usage);      /* 換選項就帶入建議加成 */
    $(`[data-sec="${sec.id}"] .sec-body`).innerHTML = usageBody(sec);
    refresh();
  }
});

document.addEventListener("click", e => {
  const btn = e.target.closest("[data-act]");
  if(!btn) return;
  const act = btn.dataset.act;
  const secEl = btn.closest("[data-sec]");
  const sec = secEl ? findSec(secEl.dataset.sec) : null;

  if(act === "toggle-sec"){
    sec.on = btn.checked; secEl.classList.toggle("off", !sec.on); refresh(); return;
  }
  if(act === "fold"){
    sec.open = sec.open === false;
    secEl.classList.toggle("collapsed", sec.open === false); /* 箭頭方向由 CSS 旋轉 */
    save(); return;
  }
  if(act === "del-sec"){
    if(!confirm(`確定刪除「${sec.name}」整個區塊？`)) return;
    S.secs = S.secs.filter(s => s !== sec); renderAll(); save(); return;
  }
  if(act === "dup-sec"){
    const copy = JSON.parse(JSON.stringify(sec));
    copy.id = nid(); copy.fixed = false; copy.post = false; copy.sync = false;
    copy.name = sec.name + "（複本）";
    (copy.items||[]).forEach(i => i.id = nid());
    S.secs.splice(S.secs.indexOf(sec) + 1, 0, copy); renderAll(); save(); return;
  }
  if(act === "add-item"){
    sec.items.push(item("", "day", 0, 1, num(S.meta.days) || 1));
    $(`[data-sec="${sec.id}"] .sec-body`).innerHTML = itemsBody(sec);
    const rows = $$(`[data-sec="${sec.id}"] .row`);
    const last = rows[rows.length-1];
    if(last) last.querySelector('input[type=text]').focus();
    refresh(); return;
  }
  if(act === "del-item"){
    const row = btn.closest("[data-item]");
    sec.items = sec.items.filter(i => i.id !== row.dataset.item);
    row.remove(); refresh(); return;
  }
  if(act === "toggle-pass"){
    sec.pass = !sec.pass;
    renderAll(); save(); return;
  }
  if(act === "sync-days"){
    sec.items.forEach(i => { if(i.unit === "day") i.dur = num(S.meta.days); });
    $(`[data-sec="${sec.id}"] .sec-body`).innerHTML = itemsBody(sec);
    refresh(); return;
  }
  if(act === "fold-side"){
    const k = btn.dataset.k;
    S.ui[k] = !S.ui[k];
    btn.closest(".foldsec").classList.toggle("closed", !S.ui[k]);
    save(); return;
  }

  /* --- 專案面板 --- */
  if(act === "use-preset"){
    const p = PRESETS[+btn.dataset.i];
    if(!confirm(`套用「${p.name}」範本？\n\n目前的預算項目會被取代（客戶資料、合約設定與各項加成會保留）。`)) return;
    applyPreset(p); closePanel(); return;
  }
  if(act === "new-proj"){
    const name = prompt("新專案名稱：", "未命名專案");
    if(name === null) return;
    addProject(name.trim() || "未命名專案", defaults());
    S = curProject().data;
    fillForm(); renderTw(); renderAll(); save();
    $("#panelBody").innerHTML = panelHTML(); return;
  }
  if(act === "open-proj"){
    switchTo(btn.closest("[data-pid]").dataset.pid);
    $("#panelBody").innerHTML = panelHTML(); return;
  }
  if(act === "dup-proj"){
    const src = STORE.projects.find(x => x.id === btn.closest("[data-pid]").dataset.pid);
    if(!src) return;
    const copy = JSON.parse(JSON.stringify(src.data));
    copy.meta.project = (src.name || "專案") + "（複本）";
    addProject(copy.meta.project, copy);
    S = copy; fillForm(); renderTw(); renderAll(); save();
    $("#panelBody").innerHTML = panelHTML(); return;
  }
  if(act === "del-proj"){
    const row = btn.closest("[data-pid]");
    const p = STORE.projects.find(x => x.id === row.dataset.pid);
    if(!p || !confirm(`刪除專案「${p.name}」？此動作無法復原。`)) return;
    STORE.projects = STORE.projects.filter(x => x.id !== p.id);
    if(STORE.current === p.id) switchTo(STORE.projects[0].id);
    else saveStore();
    $("#panelBody").innerHTML = panelHTML(); return;
  }

  if(act === "add-blank-sec"){ addSection("自訂區塊", "📦", []); return; }
  if(act === "add-tpl"){
    const t = TEMPLATES[+btn.dataset.i];
    addSection(t.name, t.icon, t.items.map(a => item(a[0], a[1], a[2], a[1]==="person"?1:1, a[1]==="day"?(num(S.meta.days)||1):1)));
    return;
  }
});

function addSection(name, icon, items){
  S.secs.push({ id:nid(), kind:"items", icon, name, on:true, open:true, fixed:false, items });
  renderAll(); save();
  const el = $("#sections").lastElementChild;
  if(el) el.scrollIntoView({behavior:"smooth", block:"center"});
}

/* =========================================================
   專案類型範本
   ========================================================= */
function applyPreset(p){
  const base = defaults();
  const mk = a => a.map(x => item(x[0], x[1], x[2], x[3], x[4] == null ? 1 : x[4]));
  const g  = id => base.secs.find(s => s.id === id);
  /* 客戶、合約、稅務與各項加成設定都保留，只換預算結構 */
  S.meta = Object.assign(base.meta, {
    project:S.meta.project, client:S.meta.client, date:S.meta.date, cur:S.meta.cur,
    note:S.meta.note, halfRate:S.meta.halfRate, otRate:S.meta.otRate, showAct:S.meta.showAct
  }, p.meta);

  const secs = [];
  (p.add||[]).forEach(a => secs.push({ id:nid(), kind:"items", icon:a.icon, name:a.name,
                                       on:true, open:true, fixed:false, pass:false, items:mk(a.items) }));
  const eq = g("equip");  eq.items = mk(p.equip);   secs.push(eq);
  const po = g("post");   po.items = mk(p.post);    secs.push(po);
  const rv = g("rev");    Object.assign(rv.rev, p.rev); secs.push(rv);
  secs.push(g("usage"));
  const tr = g("travel"); tr.items = mk(p.travel);  secs.push(tr);
  const ms = g("misc");   ms.items = mk(p.misc);    secs.push(ms);
  S.secs = secs;

  fillForm(); renderTw(); renderAll(); save();
}

/* =========================================================
   專案面板（存檔管理 ＋ 範本）
   ========================================================= */
function panelHTML(){
  const cards = PRESETS.map((p,i) =>
    `<button class="pcard" data-act="use-preset" data-i="${i}">
       <div class="pi">${p.icon}</div><h4>${esc(p.name)}</h4><p>${esc(p.desc)}</p>
     </button>`).join("");
  const rows = STORE.projects.map(p => {
    const cur = p.id === STORE.current;
    const d = new Date(p.updated);
    const when = `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
    return `<div class="prow${cur?" cur":""}" data-pid="${p.id}">
      <span class="pn">${esc(p.name)}${cur?' <span class="tag">使用中</span>':""}</span>
      <span class="pm">${when}</span>
      ${cur?"":`<button class="btn sm" data-act="open-proj">開啟</button>`}
      <button class="btn sm ghost" data-act="dup-proj">⧉ 複製</button>
      ${STORE.projects.length>1?`<button class="btn sm ghost danger" data-act="del-proj">🗑</button>`:""}
    </div>`;
  }).join("");
  return `<h3 class="grp" style="margin-top:0">我的專案（${STORE.projects.length}）</h3>
    <div class="plist">${rows}</div>
    <div class="sec-actions" style="border-top:none;padding-top:10px">
      <button class="btn" data-act="new-proj">＋ 開新的空白專案</button>
    </div>
    <h3 class="grp">套用專案類型範本</h3>
    <p class="note" style="margin-top:0">一鍵換掉整份預算結構與參考價格。<b>客戶資料、合約設定、稅務與各項加成都會保留</b>，只有預算項目會被取代。</p>
    <div class="pgrid">${cards}</div>`;
}
function openPanel(){
  $("#panelTitle").textContent = "📁 專案與範本";
  $("#panelBody").innerHTML = panelHTML();
  $("#panelModal").hidden = false;
  document.body.classList.add("modal-open");
}
function closePanel(){
  $("#panelModal").hidden = true;
  document.body.classList.remove("modal-open");
}
function switchTo(id){
  const p = STORE.projects.find(x => x.id === id); if(!p) return;
  STORE.current = id;
  S = migrate(p.data);
  fillForm(); renderTw(); renderAll(); save();
}

/* =========================================================
   合約書
   ========================================================= */
const CURNAME = {"NT$":"新臺幣","US$":"美元","¥":"日圓","€":"歐元","RMB¥":"人民幣","HK$":"港幣"};

/* 新臺幣 49,781 元整 */
function tw(n){
  return (CURNAME[S.meta.cur] || S.meta.cur) + " " + nf.format(Math.round(n||0)) + " 元整";
}
/* 中文大寫金額（僅台幣時附註） */
function cnAmount(n){
  n = Math.round(n || 0);
  if(n <= 0) return "零元整";
  const D = "零壹貳參肆伍陸柒捌玖".split(""), U = ["","拾","佰","仟"], G = ["","萬","億","兆"];
  const groups = []; let s = String(n);
  while(s.length){ groups.push(s.slice(-4)); s = s.slice(0,-4); }
  const parts = [];
  for(let i = groups.length - 1; i >= 0; i--){
    const grp = groups[i]; let t = "", zero = false;
    for(let j = 0; j < grp.length; j++){
      const d = +grp[j], pos = grp.length - 1 - j;
      if(d === 0){ zero = true; continue; }
      if(zero && t) t += "零";
      zero = false; t += D[d] + U[pos];
    }
    if(t){ if(parts.length && +grp < 1000) t = "零" + t; parts.push(t + G[i]); }
  }
  return parts.join("") + "元整";
}
function amtFull(n){
  return tw(n) + (S.meta.cur === "NT$" ? `（${cnAmount(n)}）` : "");
}
const BLANK = '<span class="fill">&nbsp;</span>';
function val(v, unit){ v = (v==null?"":String(v)).trim(); return v ? esc(v) + (unit||"") : BLANK; }
function dstr(iso){
  if(!iso) return BLANK;
  const p = String(iso).split("-"); if(p.length !== 3) return esc(iso);
  return `${p[0]} 年 ${+p[1]} 月 ${+p[2]} 日`;
}
function rocDate(iso){
  if(!iso) return `中華民國 <span class="fill">&nbsp;</span> 年 <span class="fill">&nbsp;</span> 月 <span class="fill">&nbsp;</span> 日`;
  const p = String(iso).split("-");
  return `中華民國 ${(+p[0]) - 1911} 年 ${+p[1]} 月 ${+p[2]} 日`;
}
/* 甲方名稱留白時沿用「專案基本資訊」的客戶／單位，與報價單同一套規則 */
function clientName(){ return String(S.contract.aName || S.meta.client || "").trim(); }

function partyCell(pre){
  const c = S.contract;
  const name = pre === "a" ? clientName() : c.bName;
  return `名稱：${val(name)}<br>
    統一編號：${val(c[pre+"Tax"])}　代表人：${val(c[pre+"Rep"])}<br>
    地址：${val(c[pre+"Addr"])}<br>
    聯絡人：${val(c[pre+"Contact"])}　電話：${val(c[pre+"Phone"])}<br>
    Email：${val(c[pre+"Email"])}`;
}

/* 付款分期：總和為 100% 時由尾款吸收四捨五入尾差 */
function payPlan(total){
  const c = S.contract, p = [num(c.pay1), num(c.pay2), num(c.pay3)];
  const sum = p[0] + p[1] + p[2];
  const a = [Math.round(total*p[0]/100), Math.round(total*p[1]/100), 0];
  a[2] = (Math.abs(sum - 100) < 0.001) ? total - a[0] - a[1] : Math.round(total*p[2]/100);
  return { pct:p, sum, amt:a };
}

function serviceTable(force){
  const c = compute(), show = force || S.contract.showPrice;
  let i = 0;
  const rows = S.secs.filter(s => s.on && (c.per[s.id] > 0 || s.kind === "revision")).map(s => {
    i++;
    let detail;
    if(s.kind === "revision"){
      detail = `含 ${num(s.rev.free)} 次修改，超出部分依第五條辦理`;
    }else{
      const names = (s.items||[]).filter(x => x.on && String(x.name).trim())
                                 .map(x => String(x.name).trim());
      detail = names.join("、") || "—";
    }
    return `<tr><td style="width:3.2em;text-align:center">${i}</td>
      <td style="width:9.5em">${esc(s.name)}</td>
      <td>${esc(detail)}</td>
      ${show ? `<td class="r">${money(c.per[s.id])}</td>` : ""}</tr>`;
  }).join("");
  const foot = show ? `<tr><th colspan="3" class="r">${force ? "小計" : "契約總價"}</th><th class="r">${money(force ? c.direct : c.total)}</th></tr>` : "";
  return `<table>
    <tr><th style="text-align:center">項次</th><th>服務項目</th><th>內容</th>${show?'<th class="r">金額</th>':""}</tr>
    ${rows || `<tr><td colspan="${show?4:3}">—</td></tr>`}
    ${foot}
  </table>`;
}

const COPYRIGHT_TEXT = {
  a: "本影片之著作財產權，於甲方付清契約總價後，由乙方全部讓與甲方；乙方保有著作人格權。讓與前，乙方仍為著作財產權人。",
  b: "本影片之著作財產權由乙方保有。甲方付清契約總價後，乙方授權甲方於全球範圍內、不限次數、永久且不可撤回地使用本影片於約定用途；該授權為非專屬授權。",
  c: "本影片之著作財產權由甲乙雙方共有，應有部分各二分之一。任一方對外授權、讓與或設質，應事先取得他方書面同意。"
};

function contractHTML(){
  const c = S.contract, m = S.meta, r = compute();
  const revSec = S.secs.find(s => s.kind === "revision");
  const revOn  = revSec && revSec.on;
  const free   = revOn ? num(revSec.rev.free) : 0;
  const perTxt = revOn
    ? (revSec.rev.mode === "pct"
        ? `後期製作費用之 ${num(revSec.rev.pct)}%`
        : amtFull(num(revSec.rev.amount)))
    : "雙方另行議定之金額";

  const plan = payPlan(r.total);
  const taxNote = S.adj.taxOn
    ? `（含營業稅 ${num(S.adj.tax)}%）`
    : "（未含營業稅；如需開立統一發票，應另加計營業稅）";

  const payItems = [];
  payItems.push(`<li><b>簽約訂金</b>：契約總價之 ${num(c.pay1)}%，計 ${amtFull(plan.amt[0])}，於本契約簽訂後 ${num(c.payDays)} 日內給付。</li>`);
  if(num(c.pay2) > 0)
    payItems.push(`<li><b>期中款</b>：契約總價之 ${num(c.pay2)}%，計 ${amtFull(plan.amt[1])}，於乙方交付初剪版本後 ${num(c.payDays)} 日內給付。</li>`);
  payItems.push(`<li><b>交付尾款</b>：契約總價之 ${num(c.pay3)}%，計 ${amtFull(plan.amt[2])}，於甲方完成驗收後 ${num(c.payDays)} 日內給付。</li>`);

  const extras = String(c.extra||"").split("\n").map(s=>s.trim()).filter(Boolean);
  const accept = num(c.acceptDays);

  let n = 0; const N = () => ["一","二","三","四","五","六","七","八","九","十","十一","十二","十三","十四","十五","十六"][n++];

  return `
  <h1>影片製作委製契約書</h1>
  <div class="sub">FILM PRODUCTION AGREEMENT${c.no ? "　・　合約編號：" + esc(c.no) : ""}</div>

  <p class="lead">立契約書人：</p>
  <table>
    <tr><th style="width:5.5em">甲方<br>（委製方）</th><td>${partyCell("a")}</td></tr>
    <tr><th>乙方<br>（承製方）</th><td>${partyCell("b")}</td></tr>
  </table>
  <p class="lead">茲就影片製作事宜，雙方本於平等互惠原則，同意訂立本契約，共同遵守下列各條款：</p>

  <h3>第${N()}條　契約標的</h3>
  <ol>
    <li>專案名稱：${val(m.project)}</li>
    <li>影片規格：${val(c.spec)}</li>
    <li>成品長度：約 ${num(m.min)} 分鐘</li>
    <li>預計拍攝天數：${num(m.days)} 天，實際日期依第三條期程辦理。</li>
  </ol>

  <h3>第${N()}條　服務範圍及交付項目</h3>
  <ol>
    <li>乙方應提供之服務內容如下表所列。表列以外之項目不屬本契約範圍，如有需要應經雙方書面同意後另行議價。
      ${serviceTable()}
    </li>
    <li>交付項目：${val(c.deliver)}。</li>
    <li>乙方應以雲端連結或實體儲存媒體交付成品數位檔案；除另有約定外，乙方無提供專案原始工程檔（如剪輯專案檔）之義務。</li>
  </ol>

  <h3>第${N()}條　製作期程</h3>
  <ol>
    <li>拍攝日：${dstr(c.shootDate)}</li>
    <li>初剪交付日：${dstr(c.cutDate)}</li>
    <li>完成交付日：${dstr(c.finalDate)}</li>
    <li>因甲方未依期限提供素材、資訊、審核意見、場地或人員，致製作進度延誤者，前述各期日應按延誤日數順延，乙方不負遲延責任。</li>
  </ol>

  <h3>第${N()}條　契約總價及付款方式</h3>
  <ol>
    <li>本契約總價為 ${amtFull(r.total)}${taxNote}。</li>
    <li>甲方應依下列期程給付價金：<ol style="list-style:decimal">${payItems.join("")}</ol></li>
    <li>各期款項由乙方開立統一發票或收據後請款，甲方應依前項期限匯付至乙方指定帳戶，匯款手續費由甲方負擔。</li>
    <li>下列費用未包含於契約總價，經雙方書面同意後由甲方另行負擔：演員肖像及聲音授權費、音樂及圖庫素材授權費、場地額外使用費、甲方要求之加班或加場費用，以及其他因甲方新增需求所生之費用。</li>
  </ol>

  <h3>第${N()}條　修改次數及費用</h3>
  <ol>
    <li>本契約總價已包含 ${free} 次修改。所稱一次修改，指甲方就同一版本彙整意見後一次性提出之修改需求。</li>
    <li>超出前項次數者，每次加收 ${perTxt}。</li>
    <li>下列情形不屬修改範圍，應另行報價：重新拍攝、變更影片結構或腳本方向、更換主要素材或主要演員、變更影片長度規格。</li>
    <li>影片經甲方確認完成或已對外公開發布後，如需再行調整，視為新增需求，應另行議價。</li>
  </ol>

  <h3>第${N()}條　甲方之協力義務</h3>
  <ol>
    <li>甲方應於乙方指定期限內提供製作所需之品牌識別、產品、文案、圖片、字型及其他素材，並擔保對前述素材擁有合法權利；因該等素材侵害第三人權利所生之損害及糾紛，由甲方負責處理並負擔全部責任。</li>
    <li>甲方應指定單一聯絡窗口，統一彙整並提出審核意見。</li>
    <li>甲方未於 ${accept} 日內回覆審核意見者，視為對該版本無意見。</li>
  </ol>

  <h3>第${N()}條　驗收</h3>
  <ol>
    <li>乙方交付成品後，甲方應於 ${accept} 日內完成驗收，並以書面或電子郵件、通訊軟體等可留存之方式通知驗收結果。</li>
    <li>甲方逾期未通知驗收結果，或已將成品對外公開使用者，視為驗收通過。</li>
  </ol>

  <h3>第${N()}條　著作權及使用授權</h3>
  <ol>
    <li>${COPYRIGHT_TEXT[c.copyright] || COPYRIGHT_TEXT.a}</li>
    ${c.showcase ? `<li>乙方得將本影片及其製作過程之影像、幕後花絮，用於作品集、官方網站、社群媒體、獎項報名及業務提案等自我宣傳用途，無須另行支付費用。甲方如有保密需求，應於本契約簽訂時以書面提出。</li>` : ""}
    <li>本影片使用之第三方素材（音樂、圖庫、字型、特效素材等），其使用範圍以乙方所取得之授權條款為限；甲方逾越授權範圍使用所生之責任，由甲方自負。</li>
  </ol>

  ${c.confidential ? `<h3>第${N()}條　保密義務</h3>
  <p>雙方對於因履行本契約所知悉他方之營業秘密、未公開資訊、客戶資料及本契約內容，非經他方書面同意，不得洩漏予第三人或作契約目的外之使用。本條義務於本契約終止或解除後仍繼續有效。</p>` : ""}

  <h3>第${N()}條　不可抗力</h3>
  <p>因天災、疫情、政府管制、戰亂、罷工或其他不可歸責於雙方之事由，致無法履行或無法如期履行本契約者，雙方得協議延期或終止本契約，互不負損害賠償責任；乙方已完成部分之工作及已支出之必要費用，由甲方按比例給付。</p>

  <h3>第${N()}條　契約變更及終止</h3>
  <ol>
    <li>本契約之變更、增補，應經雙方書面同意始生效力。</li>
    <li>甲方於拍攝日前終止本契約者，已支付之簽約訂金不予退還；乙方已代為支出之器材、場地、人員等費用及已產生之違約金，由甲方負擔。</li>
    <li>拍攝完成後甲方終止本契約者，甲方應給付乙方已完成部分之工作報酬及已支出之必要費用。</li>
  </ol>

  <h3>第${N()}條　違約責任</h3>
  <ol>
    <li>乙方逾期交付且不可歸責於甲方者，每逾一日應按契約總價 ${num(c.penalty)}% 計付違約金，累計以契約總價 ${num(c.penaltyCap)}% 為上限。</li>
    <li>甲方逾期給付價金者，準用前項規定計付違約金。乙方並得於價金付清前，暫停後續製作或暫緩交付成品。</li>
  </ol>

  <h3>第${N()}條　其他約定事項</h3>
  ${extras.length ? `<ol>${extras.map(x=>`<li>${esc(x)}</li>`).join("")}</ol>` : "<p>無。</p>"}

  <h3>第${N()}條　準據法及管轄法院</h3>
  <p>本契約以中華民國法律為準據法。因本契約所生之爭議，雙方應本誠信原則協商解決；協商不成時，雙方合意以${val(c.court)}為第一審管轄法院。</p>

  <h3>第${N()}條　契約份數</h3>
  <p>本契約一式二份，由甲乙雙方各執一份為憑。未盡事宜，依中華民國相關法令及一般商業慣例辦理。</p>

  <table class="signt"><tr>
    <td><h4>甲方（委製方）</h4>
      公司名稱：${val(c.aName)}<br>
      統一編號：${val(c.aTax)}<br>
      代表人：${val(c.aRep)}　（簽章）<br>
      地址：${val(c.aAddr)}</td>
    <td><h4>乙方（承製方）</h4>
      公司名稱：${val(c.bName)}<br>
      統一編號：${val(c.bTax)}<br>
      代表人：${val(c.bRep)}　（簽章）<br>
      地址：${val(c.bAddr)}</td>
  </tr></table>

  <p class="stamp">中華民國　${c.signDate ? rocDate(c.signDate).replace("中華民國 ","") : `<span class="fill">&nbsp;</span> 年 <span class="fill">&nbsp;</span> 月 <span class="fill">&nbsp;</span> 日`}</p>

  <div class="warn">⚠️ 本文件由「影片拍攝成本試算表」依你填寫的資料自動產生，屬<b>合約草稿範本</b>，不構成法律意見。請依實際專案狀況調整條款；重要或高金額案件，建議簽署前交由律師審閱。（此提示不會被列印或匯出）</div>`;
}

function quoteHTML(){
  const c = S.contract, m = S.meta, r = compute();
  const plan = payPlan(r.total);
  const revSec = S.secs.find(s => s.kind === "revision");
  const free = (revSec && revSec.on) ? num(revSec.rev.free) : 0;
  const excl = String(c.exclude||"").split("\n").map(s=>s.trim()).filter(Boolean);

  const line = (label, val, strong) => val
    ? `<tr><td colspan="3" class="r"${strong?' style="font-weight:700"':""}>${label}</td>
           <td class="r"${strong?' style="font-weight:700"':""}>${val < 0 ? "-" : ""}${money(Math.abs(val))}</td></tr>`
    : "";
  const valid = c.validDays ? `${num(c.validDays)} 天` : "—";

  return `
  <h1>報 價 單</h1>
  <div class="sub">QUOTATION${c.no ? "　・　編號：" + esc(c.no) : ""}</div>

  <table>
    <tr><th style="width:5.5em">承製方</th><td>${val(c.bName)}　${c.bTax?`統編：${esc(c.bTax)}`:""}<br>
        聯絡：${val(c.bContact)}　${val(c.bPhone)}　${val(c.bEmail)}</td></tr>
    <tr><th>客戶</th><td>${val(clientName())}　${c.aTax?`統編：${esc(c.aTax)}`:""}<br>
        聯絡：${val(c.aContact)}　${val(c.aPhone)}　${val(c.aEmail)}</td></tr>
    <tr><th>報價日期</th><td>${dstr(m.date)}　　有效期限：<b>${valid}</b>（逾期價格得重新評估）</td></tr>
  </table>

  <h3>一、專案內容</h3>
  <ol>
    <li>專案名稱：${val(m.project)}</li>
    <li>影片規格：${val(c.spec)}</li>
    <li>成品長度：約 ${num(m.min)} 分鐘　｜　預計拍攝：${num(m.days)} 天</li>
    <li>交付項目：${val(c.deliver)}</li>
  </ol>

  <h3>二、費用明細</h3>
  ${serviceTable(true)}
  <table>
    ${line(`趕件加成 ${num(S.adj.rush)}%`, S.adj.rushOn ? r.rush : 0)}
    ${line(`預備金／管理費 ${num(S.adj.con)}%`, S.adj.conOn ? r.con : 0)}
    ${line(`利潤／服務費 ${num(S.adj.prof)}%`, S.adj.profOn ? r.prof : 0)}
    ${line("折扣", -r.disc)}
    ${line(`營業稅 ${num(S.adj.tax)}%`, S.adj.taxOn ? r.tax : 0)}
    ${line("報價總額", r.total, true)}
  </table>
  <p><b>合計：${amtFull(r.total)}</b>${S.adj.taxOn ? "（含營業稅）" : "（未含營業稅）"}</p>

  <h3>三、付款方式</h3>
  <ol>
    <li>簽約訂金：${num(c.pay1)}%，計 ${money(plan.amt[0])}</li>
    ${num(c.pay2) > 0 ? `<li>期中款（初剪交付後）：${num(c.pay2)}%，計 ${money(plan.amt[1])}</li>` : ""}
    <li>交付尾款（驗收後）：${num(c.pay3)}%，計 ${money(plan.amt[2])}</li>
    <li>各期款項於請款後 ${num(c.payDays)} 日內支付。</li>
  </ol>

  <h3>四、期程與修改</h3>
  <ol>
    <li>拍攝日：${dstr(c.shootDate)}　｜　初剪交付：${dstr(c.cutDate)}　｜　完成交付：${dstr(c.finalDate)}</li>
    <li>本報價含 <b>${free}</b> 次修改，超出部分另行計費。</li>
    <li>甲方應於 ${num(c.acceptDays)} 日內回覆審核意見或完成驗收，逾期視為通過。</li>
  </ol>

  ${excl.length ? `<h3>五、本報價不含</h3><ol>${excl.map(x=>`<li>${esc(x)}</li>`).join("")}</ol>` : ""}

  ${m.note ? `<h3>${excl.length ? "六" : "五"}、備註</h3><p>${esc(m.note).replace(/\n/g,"<br>")}</p>` : ""}

  <table class="signt"><tr>
    <td><h4>客戶確認</h4>
      簽章：<br><br>
      日期：${BLANK}</td>
    <td><h4>承製方</h4>
      ${val(c.bName)}<br>
      簽章：<br>
      日期：${dstr(m.date)}</td>
  </tr></table>

  <div class="warn">⚠️ 這是由試算結果自動產生的報價單草稿。金額會隨你在試算表上的調整即時變動，送出前請再確認一次數字與交付範圍。（此提示不會被列印或匯出）</div>`;
}

let docType = "contract";
function openDoc(type){
  docType = type;
  $("#contractDoc").innerHTML = type === "quote" ? quoteHTML() : contractHTML();
  $("#docTitle").textContent  = type === "quote" ? "📋 報價單預覽" : "📄 合約書預覽";
  $("#docSwap").textContent   = type === "quote" ? "📄 改看合約書" : "📋 改看報價單";
  $("#contractModal").hidden = false;
  document.body.classList.add("modal-open");
  $("#contractModal").scrollTop = 0;
}
function openContract(){
  openDoc("contract");
}
function closeContract(){
  $("#contractModal").hidden = true;
  document.body.classList.remove("modal-open");
}
function docExportHTML(){
  const clone = $("#contractDoc").cloneNode(true);
  const w = clone.querySelector(".warn"); if(w) w.remove();
  return clone.innerHTML;
}
function contractFileName(ext){
  const p = (S.meta.project || "影片製作").replace(/[\\/:*?"<>|]/g,"_");
  return `${p}-${docType === "quote" ? "報價單" : "合約書"}-${S.meta.date}.${ext}`;
}

$("#btnPanel").addEventListener("click", openPanel);
$("#panelClose").addEventListener("click", closePanel);
$("#panelModal").addEventListener("click", e => { if(e.target.id === "panelModal") closePanel(); });
$("#btnContract").addEventListener("click", ()=> openDoc("contract"));
$("#btnGenContract").addEventListener("click", ()=> openDoc("contract"));
$("#btnQuote").addEventListener("click", ()=> openDoc("quote"));
$("#btnGenQuote").addEventListener("click", ()=> openDoc("quote"));
$("#docSwap").addEventListener("click", ()=> openDoc(docType === "quote" ? "contract" : "quote"));
$("#cClose").addEventListener("click", closeContract);
$("#cPrint").addEventListener("click", ()=> window.print());
$("#contractModal").addEventListener("click", e => { if(e.target.id === "contractModal") closeContract(); });
document.addEventListener("keydown", e => {
  if(e.key !== "Escape") return;
  if(!$("#contractModal").hidden) closeContract();
  else if(!$("#panelModal").hidden) closePanel();
});

$("#cWord").addEventListener("click", ()=>{
  /* 下面這段 Word 包裝含有字面的 </body> 與 HTML 註解 —— 正是本檔案必須維持
     外部 script 的原因（見檔案開頭說明），請勿把這個檔案 inline 回 index.html。 */
  const MSO = `<!--[if gte mso 9]><xml><w:WordDocument>`
            + `<w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->`;
  const css = `
@page{size:A4;margin:2.5cm}
body{font-family:"標楷體","Noto Serif TC",serif;font-size:12pt;line-height:1.9;color:#000}
h1{text-align:center;font-size:17pt;letter-spacing:.2em;margin:0}
.sub{text-align:center;font-size:9pt;color:#666;margin:4pt 0 18pt}
h3{font-size:12.5pt;margin:16pt 0 4pt}
h4{font-size:12pt;margin:0 0 6pt}
p{margin:0 0 5pt;text-align:justify}
ol{margin:0 0 5pt;padding-left:22pt}
li{margin-bottom:2pt}
table{border-collapse:collapse;width:100%;font-size:11pt;margin:8pt 0}
th,td{border:1px solid #888;padding:5pt 7pt;text-align:left;vertical-align:top}
th{background:#eeeeee}
.r{text-align:right}
.signt{margin-top:24pt}
.signt td{line-height:2.2}
.fill{border-bottom:1px solid #777;display:inline-block;min-width:80pt}
.stamp{margin-top:18pt}`;
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${esc(S.meta.project || "影片製作委製契約書")}</title>
${MSO}
<style>${css}</style></head>
<body>${docExportHTML()}</body></html>`;
  dl("﻿" + html, contractFileName("doc"), "application/msword");
});

$("#cCopy").addEventListener("click", async ()=>{
  const clone = $("#contractDoc").cloneNode(true);
  const w = clone.querySelector(".warn"); if(w) w.remove();
  const text = clone.innerText.replace(/\n{3,}/g,"\n\n").trim();
  const btn = $("#cCopy"), old = btn.textContent;
  try{
    await navigator.clipboard.writeText(text);
    btn.textContent = "✓ 已複製";
  }catch(err){
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    btn.textContent = document.execCommand("copy") ? "✓ 已複製" : "複製失敗";
    ta.remove();
  }
  setTimeout(()=>{ btn.textContent = old; }, 1600);
});

function updatePayHint(){
  const c = S.contract, sum = num(c.pay1) + num(c.pay2) + num(c.pay3);
  const r = compute(), plan = payPlan(r.total);
  const el = $("#payHint");
  const parts = [`訂金 ${money(plan.amt[0])}`];
  if(num(c.pay2) > 0) parts.push(`期中 ${money(plan.amt[1])}`);
  parts.push(`尾款 ${money(plan.amt[2])}`);
  if(Math.abs(sum - 100) < 0.001){
    el.innerHTML = `依目前總價 <b style="color:var(--accent)">${money(r.total)}</b>　→　${parts.join("　/　")}`;
  }else{
    el.innerHTML = `<span style="color:var(--red)">⚠ 三期比例合計為 ${sum}%，並非 100%。</span>　依目前設定：${parts.join("　/　")}`;
  }
}

/* =========================================================
   工具列
   ========================================================= */
$("#btnTheme").addEventListener("click", ()=>{
  const cur = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", cur);
  try{ localStorage.setItem(KEY + ":theme", cur); }catch(e){}
});
$("#btnPrint").addEventListener("click", ()=> window.print());

$("#btnReset").addEventListener("click", ()=>{
  if(!confirm("重設會清除「目前這個專案」的所有輸入，回到預設範本。\n其他專案不受影響。確定嗎？")) return;
  S = defaults(); fillForm(); renderTw(); renderAll(); save();
});

$("#btnExport").addEventListener("click", ()=>{
  const name = (S.meta.project || "film-budget").replace(/[\\/:*?"<>|]/g,"_");
  dl(JSON.stringify(S,null,2), `${name}-${S.meta.date}.json`, "application/json");
});

$("#btnCsv").addEventListener("click", ()=>{
  const c = compute(), q = v => `"${String(v==null?"":v).replace(/"/g,'""')}"`;
  const L = [];
  L.push(["專案",S.meta.project].map(q).join(","));
  L.push(["客戶",clientName()].map(q).join(","));
  L.push(["日期",S.meta.date].map(q).join(","));
  L.push(["拍攝天數",S.meta.days,"影片長度(分)",S.meta.min].map(q).join(","));
  L.push("");
  const A = S.meta.showAct;
  L.push(["區塊","項目","計價單位","單價","數量","時長","小計"].concat(A?["實際"]:[]).concat(["計入","代墊"]).map(q).join(","));
  S.secs.forEach(sec=>{
    const p = sec.pass ? "是" : "";
    if(sec.kind === "revision"){
      const r = sec.rev, extra = Math.max(0, num(r.total)-num(r.free));
      L.push([sec.name,`超出免費 ${r.free} 次`,"次",
              r.mode==="pct" ? `後期 ${r.pct}%` : r.amount, extra, "",
              Math.round(secTotal(sec,{post:c.post}))].concat(A?[""]:[])
              .concat([sec.on?"是":"否", p]).map(q).join(","));
      return;
    }
    if(sec.kind === "usage"){
      const u = sec.usage;
      L.push([sec.name,
              `${(USAGE.media[u.media]||{}).l} / ${(USAGE.region[u.region]||{}).l} / ${(USAGE.years[u.years]||{}).l}`,
              "加成", usagePct(u)+"%", 1, "", Math.round(secTotal(sec))].concat(A?[""]:[])
              .concat([sec.on?"是":"否", p]).map(q).join(","));
      return;
    }
    (sec.items||[]).forEach(i=>{
      const u = UNITS[i.unit] || UNITS.flat;
      const dur = u.needDur === "auto" ? S.meta.min : (u.needDur ? i.dur : "");
      L.push([sec.name, i.name, u.label, i.price, i.qty, dur, Math.round(itemTotal(i))]
              .concat(A?[Math.round(num(i.act))]:[])
              .concat([i.on?"是":"否", p]).map(q).join(","));
    });
  });
  L.push("");
  L.push(["","","","","","","直接成本合計", Math.round(c.direct)].map(q).join(","));
  if(c.passSum) L.push(["","","","","","","其中代墊款", Math.round(c.passSum)].map(q).join(","));
  if(A)      L.push(["","","","","","","實際支出合計", Math.round(c.actual)].map(q).join(","));
  if(c.rush) L.push(["","","","","","",`趕件加成 ${S.adj.rush}%`, Math.round(c.rush)].map(q).join(","));
  if(c.con)  L.push(["","","","","","",`預備金 ${S.adj.con}%`, Math.round(c.con)].map(q).join(","));
  if(c.prof) L.push(["","","","","","",`利潤 ${S.adj.prof}%`, Math.round(c.prof)].map(q).join(","));
  if(c.disc) L.push(["","","","","","","折扣", -Math.round(c.disc)].map(q).join(","));
  if(c.tax)  L.push(["","","","","","",`稅金 ${S.adj.tax}%`, Math.round(c.tax)].map(q).join(","));
  L.push(["","","","","","","總計", Math.round(c.total)].map(q).join(","));
  if(S.tw.on) L.push(["","","","","","",
    S.tw.mode === "company" ? "實收（扣除代收代付營業稅）" : "實拿（扣除扣繳與補充保費）",
    Math.round(c.twNet)].map(q).join(","));
  if(S.meta.note){ L.push(""); L.push(["備註",S.meta.note].map(q).join(",")); }
  const name = (S.meta.project || "film-budget").replace(/[\\/:*?"<>|]/g,"_");
  dl("﻿" + L.join("\r\n"), `${name}-${S.meta.date}.csv`, "text/csv;charset=utf-8");
});

function dl(text, filename, mime){
  const a = document.createElement("a");
  const url = URL.createObjectURL(new Blob([text], {type:mime}));
  a.href = url; a.download = filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

$("#btnImport").addEventListener("click", ()=> $("#fileIn").click());
$("#fileIn").addEventListener("change", e => {
  const f = e.target.files[0]; if(!f) return;
  const r = new FileReader();
  r.onload = () => {
    try{
      const d = JSON.parse(r.result);
      if(!d.secs || !d.meta) throw 0;
      /* 匯入建立成新專案，不覆蓋目前正在編輯的內容 */
      S = migrate(d);
      addProject((S.meta.project || "匯入的專案").trim(), S);
      fillForm(); renderTw(); renderAll(); save();
    }catch(err){ alert("讀取失敗：這不是本工具匯出的 JSON 檔。"); }
  };
  r.readAsText(f);
  e.target.value = "";
});

/* =========================================================
   啟動
   ========================================================= */
(function init(){
  bootState();
  try{
    const t = localStorage.getItem(KEY + ":theme");
    if(t) document.documentElement.setAttribute("data-theme", t);
  }catch(e){}

  $("#tplChips").innerHTML = TEMPLATES.map((t,i)=>
    `<button class="chip" data-act="add-tpl" data-i="${i}">${t.icon} ${t.name}</button>`).join("");

  fillForm();
  bindForms();
  renderTw();
  renderAll();
})();

})();
