const AKEY="rg21_accounts",TKEY="rg2_transactions",IKEY="rg21_investments",FKEY="rg21_fx",BKEY="rg23_budgets",GKEY="rg23_goals";
const DEF_A=[
  {id:"rb",name:"Raiffeisenbank",label:"CZ účet",currency:"CZK",balance:null},
  {id:"slsp",name:"Slovenská sporiteľňa",label:"SK účet",currency:"EUR",balance:null}
];
const EXP_CATS=["Bývanie","Potraviny","Reštaurácie","Auto a doprava","Palivo","Poistenie","Zdravie","Telekom","Predplatné","Zábava","Oblečenie","Cestovanie","Nákupy","Vzdelanie","Splátky dlhu","Bankové poplatky","Iné"];
const INC_CATS=["Mzda","Bonus","Vedľajší príjem","Refundácia","Iné príjmy"];
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const clone=o=>JSON.parse(JSON.stringify(o));
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};
const eur=n=>new Intl.NumberFormat("sk-SK",{style:"currency",currency:"EUR"}).format(Number(n)||0);
const money=(n,c)=>new Intl.NumberFormat(c==="CZK"?"cs-CZ":"sk-SK",{style:"currency",currency:c,maximumFractionDigits:c==="CZK"?0:2}).format(Number(n)||0);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function load(k,d){try{return JSON.parse(localStorage.getItem(k))??clone(d)}catch{return clone(d)}}

let A=load(AKEY,DEF_A).map(a=>({...a,id:a.id==="rb_cz"?"rb":a.id==="slsp_sk"?"slsp":a.id}));
let T=load(TKEY,[]).map((x,i)=>{
  let kind=x.kind||x.t||"expense";
  return {...x,id:x.id||Date.now()+i,kind,
    accountId:x.accountId==="rb_cz"?"rb":x.accountId==="slsp_sk"?"slsp":x.accountId,
    fromAccount:x.fromAccount==="rb_cz"?"rb":x.fromAccount==="slsp_sk"?"slsp":x.fromAccount,
    toAccount:x.toAccount==="rb_cz"?"rb":x.toAccount==="slsp_sk"?"slsp":x.toAccount};
});
let I=load(IKEY,[]);
let B=load(BKEY,[]);
let G=load(GKEY,[
  {id:1,name:"Finančná rezerva",current:0,target:6000,deadline:""},
  {id:2,name:"Vlastné bývanie",current:0,target:20000,deadline:""}
]);
let FX=Number(localStorage.getItem(FKEY))||0;
let editTx=null, editInv=null, editGoal=null;

function save(){
  localStorage.setItem(AKEY,JSON.stringify(A));
  localStorage.setItem(TKEY,JSON.stringify(T));
  localStorage.setItem(IKEY,JSON.stringify(I));
  localStorage.setItem(BKEY,JSON.stringify(B));
  localStorage.setItem(GKEY,JSON.stringify(G));
  if(FX)localStorage.setItem(FKEY,String(FX));
}
function acc(id){return A.find(a=>a.id===id)}
function toE(v,c){if(c==="EUR")return Number(v)||0;if(c==="CZK"&&FX)return (Number(v)||0)/FX;return null}
function monthKey(d){return d?.slice(0,7)||""}
function currentMonthKey(){return $("#reportMonth")?.value||today().slice(0,7)}
function offsetMonthKey(offset){
  const d=new Date(currentMonthKey()+"-01T12:00:00"); d.setMonth(d.getMonth()+offset);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
function isMonth(d,key=currentMonthKey()){return monthKey(d)===key}

function monthTotals(key=currentMonthKey()){
  let inc=0,exp=0,valid=true,fees=0;
  T.filter(x=>isMonth(x.d,key)).forEach(x=>{
    if(x.kind==="income"||x.kind==="expense"){
      const v=toE(x.a,x.currency||acc(x.accountId)?.currency);
      if(v===null)valid=false;
      else x.kind==="income"?inc+=v:exp+=v;
    }
    if(x.kind==="transfer"&&Number(x.fee)>0){
      const c=acc(x.fromAccount)?.currency||"EUR";
      const v=toE(x.fee,c);
      if(v===null)valid=false;
      else {exp+=v;fees+=v}
    }
  });
  return {inc,exp,flow:inc-exp,valid,fees};
}
function spendingByCat(key=currentMonthKey()){
  const m={};
  T.filter(x=>isMonth(x.d,key)).forEach(x=>{
    if(x.kind==="expense"){
      const v=toE(x.a,x.currency||acc(x.accountId)?.currency);
      if(v!==null)m[x.c||"Iné"]=(m[x.c||"Iné"]||0)+v;
    }
    if(x.kind==="transfer"&&Number(x.fee)>0){
      const v=toE(x.fee,acc(x.fromAccount)?.currency||"EUR");
      if(v!==null)m["Bankové poplatky"]=(m["Bankové poplatky"]||0)+v;
    }
  });
  return m;
}
function invStats(){
  let cost=0,value=0,div=0,valid=true;
  I.forEach(i=>{
    const c=toE(i.cost,i.currency||"EUR"),v=toE(i.currentValue,i.currency||"EUR"),d=toE(i.dividends||0,i.currency||"EUR");
    if([c,v,d].includes(null))valid=false; else {cost+=c;value+=v;div+=d}
  });
  const gain=value+div-cost;
  return {cost,value,div,gain,pct:cost?gain/cost*100:0,valid};
}
function netWorth(){
  let cash=0,has=I.length>0,valid=true;
  A.forEach(a=>{
    if(a.balance===null||a.balance==="")return;
    has=true;
    const v=toE(a.balance,a.currency);
    if(v===null)valid=false; else cash+=v;
  });
  const s=invStats();
  return {value:cash+s.value,has,valid:valid&&s.valid};
}
function percentChange(curr,prev){
  if(!prev)return curr?null:0;
  return (curr-prev)/prev*100;
}
function normalizedMerchant(s){
  return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
}
function recurringPayments(){
  const groups=new Map();
  T.filter(x=>x.kind==="expense"&&x.d).forEach(x=>{
    const key=`${normalizedMerchant(x.n)}|${x.accountId||""}|${x.c||""}`;
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(x);
  });
  const out=[];
  groups.forEach(items=>{
    const months=new Set(items.map(x=>monthKey(x.d)));
    if(months.size<2)return;
    items.sort((a,b)=>a.d.localeCompare(b.d));
    const latest=items[items.length-1], vals=items.map(x=>toE(x.a,x.currency||acc(x.accountId)?.currency)).filter(v=>v!==null);
    if(!vals.length)return;
    const avg=vals.reduce((a,b)=>a+b,0)/vals.length;
    const nd=new Date(latest.d+"T12:00:00"); nd.setMonth(nd.getMonth()+1);
    out.push({name:latest.n,category:latest.c||"Iné",avg,next:nd.toISOString().slice(0,10),count:items.length});
  });
  return out.sort((a,b)=>a.next.localeCompare(b.next)).slice(0,5);
}
function categorySpikes(){
  const cur=spendingByCat(currentMonthKey()), p1=spendingByCat(offsetMonthKey(-1)), p2=spendingByCat(offsetMonthKey(-2));
  return Object.entries(cur).map(([cat,val])=>{
    const hist=[p1[cat]||0,p2[cat]||0].filter(v=>v>0);
    if(!hist.length)return null;
    const avg=hist.reduce((a,b)=>a+b,0)/hist.length;
    if(avg>=10&&val>=avg*1.3&&(val-avg)>=20)return {cat,val,avg,pct:(val-avg)/avg*100};
    return null;
  }).filter(Boolean).sort((a,b)=>b.pct-a.pct);
}
function budgetAlerts(){
  const sp=spendingByCat();
  return B.map(b=>({category:b.category,used:sp[b.category]||0,limit:Number(b.limit)||0}))
    .filter(x=>x.limit>0&&x.used/x.limit>=0.8)
    .sort((a,b)=>(b.used/b.limit)-(a.used/a.limit));
}
function investmentHtml(i){
  const c=toE(i.cost,i.currency),v=toE(i.currentValue,i.currency),d=toE(i.dividends||0,i.currency);
  const g=c===null||v===null||d===null?null:v+d-c,p=g!==null&&c?g/c*100:0;
  return `<div class="row"><div class="row-icon">${i.platform==="Trading 212"?"T":"S"}</div><div class="row-main"><div class="row-name">${esc(i.name)}</div><div class="row-meta">${esc(i.platform)} · ${esc(i.type)}${i.ticker?" · "+esc(i.ticker):""} · ${i.updated||"—"}</div><div class="mini-actions"><button class="mini" onclick="openInv(${i.id})">Upraviť</button><button class="mini" onclick="delInv(${i.id})">Zmazať</button></div></div><div class="row-value">${money(i.currentValue,i.currency)}<div class="row-meta ${g===null?"":g>=0?"positive":"negative"}">${g===null?"—":`${g>=0?"+":""}${eur(g)} · ${p.toFixed(2)} %`}</div></div></div>`;
}
function txHtml(x,actions=false){
  let cls=x.kind==="income"?"positive":x.kind==="expense"?"negative":x.kind==="transfer"?"transfer":"capital";
  let icon=x.kind==="income"?"＋":x.kind==="expense"?"−":x.kind==="transfer"?"↔":"↗",meta=x.d||"",val="";
  if(x.kind==="transfer"){
    const f=acc(x.fromAccount),t=acc(x.toAccount);
    meta+=` · ${f?.name||"Účet"} → ${t?.name||"Účet"}`;
    if(Number(x.fee)>0)meta+=` · poplatok ${money(x.fee,f?.currency||"EUR")}`;
    val=`${money(x.fromAmount,f?.currency||"EUR")} → ${money(x.toAmount,t?.currency||"EUR")}`;
  } else if(x.kind==="capital"){
    const a=acc(x.accountId); meta+=` · ${a?.name||"Účet"} → ${x.platform||"Investície"}`; val=money(x.a,x.currency||a?.currency||"EUR");
  } else {
    const a=acc(x.accountId); meta+=` · ${x.c||"Iné"} · ${a?.name||"Účet"}`; val=(x.kind==="income"?"+":"−")+money(x.a,x.currency||a?.currency||"EUR");
  }
  return `<div class="row"><div class="row-icon">${icon}</div><div class="row-main"><div class="row-name">${esc(x.n||"Transakcia")}</div><div class="row-meta">${esc(meta)}</div>${actions?`<div class="mini-actions"><button class="mini" onclick="openTx(${x.id})">Upraviť</button><button class="mini" onclick="delTx(${x.id})">Zmazať</button></div>`:""}</div><div class="row-value ${cls}">${val}</div></div>`;
}
function render(){
  renderImportCoverage();
  const mt=monthTotals(), prev=monthTotals(offsetMonthKey(-1)), nw=netWorth(), is=invStats(), spend=spendingByCat();
  $("#worth").textContent=nw.has&&nw.valid?eur(nw.value):"—";
  $("#worthNote").textContent=!nw.has?"Zadaj zostatky účtov.":!nw.valid?"Pre spoločný prepočet nastav CZK/EUR kurz.":"Bankové účty + investície.";
  $("#inc").textContent=mt.valid?eur(mt.inc):"—";
  $("#exp").textContent=mt.valid?eur(mt.exp):"—";
  $("#flow").textContent=mt.valid?eur(mt.flow):"—";
  $("#flow").className=mt.valid?(mt.flow>=0?"positive":"negative"):"";

  $("#accounts").innerHTML=A.map(a=>`<div class="tile"><span class="muted small">${esc(a.label||a.currency)}</span><b>${a.balance==null?"—":money(a.balance,a.currency)}</b><span>${esc(a.name)}</span></div>`).join("");

  $("#homeInv").innerHTML=`<div class="budget-top"><div><strong>Trading 212 + SLSP fondy</strong><div class="muted small">${I.length} položiek · manuálne</div></div><div class="row-value">${is.valid?eur(is.value):"—"}<div class="${is.gain>=0?"positive":"negative"} small">${is.valid?`${is.gain>=0?"+":""}${eur(is.gain)}`:""}</div></div></div>`;

  const used=B.reduce((s,b)=>s+(spend[b.category]||0),0),limits=B.reduce((s,b)=>s+Number(b.limit||0),0);
  $("#budgetHome").innerHTML=B.length?`<div class="budget-top"><div><strong>${eur(used)} z ${eur(limits)}</strong><div class="muted small">${B.length} nastavených kategórií</div></div><div class="${used<=limits?"positive":"negative"}">${limits?Math.round(used/limits*100):0} %</div></div><div class="progress"><span style="width:${limits?Math.min(100,used/limits*100):0}%"></span></div>`:`<span class="muted">Zatiaľ nemáš nastavené mesačné rozpočty.</span>`;

  const expCh=mt.valid&&prev.valid&&T.some(x=>isMonth(x.d,offsetMonthKey(-1)))?percentChange(mt.exp,prev.exp):null;
  const saveRate=mt.valid&&mt.inc>0?mt.flow/mt.inc*100:null;
  const rec=recurringPayments();
  $("#analyticsHome").innerHTML=`
    <div class="analytics-card"><span>Výdavky vs. minulý mesiac</span><strong class="${expCh===null?"trend-neutral":expCh>0?"trend-up":"trend-down"}">${expCh===null?"—":`${expCh>0?"+":""}${expCh.toFixed(0)} %`}</strong></div>
    <div class="analytics-card"><span>Podiel po spotrebe</span><strong class="${saveRate===null?"trend-neutral":saveRate>=0?"positive":"negative"}">${saveRate===null?"—":saveRate.toFixed(1)+" %"}</strong></div>
    <div class="analytics-card"><span>Opakované platby</span><strong>${rec.length}</strong></div>`;

  const alerts=[...budgetAlerts().map(x=>({type:x.used>x.limit?"over":"near",text:`${x.category}: ${eur(x.used)} z ${eur(x.limit)}`})),...categorySpikes().map(x=>({type:"spike",text:`${x.cat} je o ${x.pct.toFixed(0)} % vyššie než priemer posledných mesiacov.`}))];
  $("#alertsHome").innerHTML=alerts.length?`<div class="alert-card"><strong>⚠ ${alerts[0].type==="over"?"Rozpočet prekročený":"Finančné upozornenie"}</strong><div class="small">${esc(alerts[0].text)}</div></div>`:`<div class="alert-card good"><strong>Prehľad je predbežný</strong><div class="small">Hodnotenie závisí od úplnosti histórie a zaradenia platieb.</div></div>`;

  $("#recurringHome").innerHTML=rec.length?rec.slice(0,3).map(r=>`<div class="recurring-row"><div><strong>${esc(r.name)}</strong><span class="small muted">${esc(r.category)} · priemer ${eur(r.avg)}</span></div><div class="due">odhad ďalšej<br><strong>${r.next}</strong></div></div>`).join(""):'<span class="muted">Zatiaľ nemám dosť histórie na rozpoznanie opakovaných platieb.</span>';

  const rows=T.filter(x=>isMonth(x.d)).sort((a,b)=>(b.d||"").localeCompare(a.d||"")||(b.id||0)-(a.id||0));
  $("#recent").innerHTML=rows.slice(0,5).map(x=>txHtml(x)).join("")||'<span class="muted">Žiadne transakcie.</span>';
  const q=($("#search")?.value||"").toLowerCase(),tf=$("#typeFilter")?.value||"all";
  const filtered=rows.filter(x=>(tf==="all"||(tf==="review"&&x.needsReview)||(tf==="investments"&&["capital","investment_outflow","investment_inflow","probable_investment_outflow"].includes(x.kind))||(tf==="transfer"&&["transfer","own_transfer","own_fx_transfer","probable_own_transfer"].includes(x.kind))||(tf==="other"&&!["expense","income","capital","transfer"].includes(x.kind))||x.kind===tf)&&(`${x.n||""} ${x.c||""} ${x.platform||""} ${x.note||""}`.toLowerCase().includes(q)));
  $("#txPeriod").textContent=`Obdobie ${currentMonthKey()} · ${filtered.length} pohybov. Mesiac zmeníš v Domov.`;
  $("#txlist").innerHTML=filtered.map(x=>txHtml(x,true)).join("")||'<span class="muted">Nič som nenašiel.</span>';

  $("#pv").textContent=is.valid?eur(is.value):"—";
  $("#pc").textContent=is.valid?eur(is.cost):"—";
  $("#pg").textContent=is.valid?`${is.gain>=0?"+":""}${eur(is.gain)}`:"—";
  $("#pg").className=is.valid?(is.gain>=0?"positive":"negative"):"";
  $("#pr").textContent=is.valid?`${is.pct>=0?"+":""}${is.pct.toFixed(2)} %`:"—";
  $("#pr").className=is.valid?(is.pct>=0?"positive":"negative"):"";

  $("#platforms").innerHTML=["Trading 212","SLSP fondy"].map(p=>{
    const items=I.filter(i=>i.platform===p);let v=0,ok=true;
    items.forEach(i=>{const x=toE(i.currentValue,i.currency);if(x===null)ok=false;else v+=x});
    return `<div class="tile"><span class="muted small">${p}</span><b>${ok?eur(v):"—"}</b><span class="small muted">${items.length} položiek</span></div>`;
  }).join("");
  $("#invlist").innerHTML=I.length?I.map(investmentHtml).join(""):'<span class="muted">Pridaj prvú investíciu.</span>';

  renderBudgets(spend);renderGoals();renderProfile();renderGuru(mt,is,spend,prev,rec,alerts);
}
function renderBudgets(spend){
  $("#budgetList").innerHTML=B.length?B.map(b=>{
    const used=spend[b.category]||0,p=b.limit?used/b.limit*100:0;
    return `<div class="card budget-card"><div class="budget-top"><div><strong>${esc(b.category)}</strong><div class="muted small">${eur(used)} z ${eur(b.limit)}</div></div><div class="${p<=100?"positive":"negative"}">${p.toFixed(0)} %</div></div><div class="progress"><span style="width:${Math.min(100,p)}%"></span></div><div class="mini-actions"><button class="mini" onclick="editBudget('${encodeURIComponent(b.category)}')">Upraviť</button><button class="mini" onclick="delBudget('${encodeURIComponent(b.category)}')">Odstrániť</button></div></div>`;
  }).join(""):'<div class="card muted">Nastav prvý mesačný limit.</div>';
}
function monthsUntil(date){if(!date)return null;const d=new Date(date+"T12:00:00"),n=new Date();let m=(d.getFullYear()-n.getFullYear())*12+d.getMonth()-n.getMonth();return Math.max(1,m)}
function renderGoals(){
  $("#goalList").innerHTML=G.length?G.map(g=>{
    const p=g.target?Math.min(100,g.current/g.target*100):0,months=monthsUntil(g.deadline),need=months?Math.max(0,(g.target-g.current)/months):null;
    return `<div class="card goal-card"><div class="goal-top"><div><strong>${esc(g.name)}</strong><div class="muted small">${eur(g.current)} z ${eur(g.target)}${g.deadline?` · do ${g.deadline}`:""}</div></div><div>${p.toFixed(0)} %</div></div><div class="progress"><span style="width:${p}%"></span></div>${need!==null?`<div class="small muted">Potrebné približne ${eur(need)} / mesiac</div>`:""}<div class="mini-actions"><button class="mini" onclick="openGoal(${g.id})">Upraviť</button><button class="mini" onclick="delGoal(${g.id})">Zmazať</button></div></div>`;
  }).join(""):'<div class="card muted">Pridaj svoj prvý finančný cieľ.</div>';
}
function renderProfile(){
  $("#aset").innerHTML=A.map(a=>`<div class="row"><div class="row-main"><div class="row-name">${esc(a.name)}</div><div class="row-meta">${esc(a.label||"")} · ${a.currency}</div></div><input class="input" style="width:145px" type="number" step=".01" value="${a.balance??""}" placeholder="Zostatok" onchange="setBal('${a.id}',this.value)"></div>`).join("");
  $("#fx").value=FX||"";
}
function renderGuru(mt,is,spend,prev,rec,alerts){
  const over=B.filter(b=>(spend[b.category]||0)>b.limit),saveRate=mt.inc>0?mt.flow/mt.inc*100:null,expCh=mt.valid&&prev.valid&&T.some(x=>isMonth(x.d,offsetMonthKey(-1)))?percentChange(mt.exp,prev.exp):null;
  $("#guruCards").innerHTML=`<div class="tile"><span class="muted small">Príjem − spotreba</span><b class="${mt.flow>=0?"positive":"negative"}">${mt.valid?eur(mt.flow):"—"}</b></div><div class="tile"><span class="muted small">Podiel po spotrebe</span><b>${mt.valid&&saveRate!==null?saveRate.toFixed(1)+" %":"—"}</b></div><div class="tile"><span class="muted small">Výdavky vs min. mesiac</span><b>${expCh===null?"—":`${expCh>0?"+":""}${expCh.toFixed(0)} %`}</b></div><div class="tile"><span class="muted small">Opakované platby</span><b>${rec.length}</b></div>`;
  let title="Rozpočet je pripravený na reálne sledovanie.",body="Sledujem rozpočty, kategórie, opakované platby a investície oddelene.";
  if(alerts.length){title="Našiel som finančné upozornenie.";body=alerts[0].text}
  else if(rec.length){title=`Rozpoznal som ${rec.length} opakovanú/é platbu/y.`;body=`Najbližšie môže prísť ${rec[0].name}, odhadom ${rec[0].next}.`}
  $("#homeInsightTitle").textContent=title;$("#homeInsightBody").textContent=body;
}
function nav(id){$$(".page").forEach(p=>p.classList.remove("active"));$("#"+id).classList.add("active");$$(".bottom-nav button").forEach(b=>b.classList.toggle("active",b.dataset.page===id));scrollTo(0,0);render()}
function showPane(id,btn){$$(".pane").forEach(x=>x.classList.remove("active"));$("#"+id).classList.add("active");$$(".segmented button").forEach(x=>x.classList.remove("active"));btn.classList.add("active")}
function setBal(id,v){acc(id).balance=v===""?null:Number(v);save();render()}
function saveFx(){const v=Number($("#fx").value);if(!v||v<=0)return alert("Zadaj platný kurz.");FX=v;save();render()}

function fillAccounts(){
  const opts=A.map(a=>`<option value="${a.id}">${esc(a.name)} · ${a.currency}</option>`).join("");
  $("#tacc").innerHTML=opts;$("#trfrom").innerHTML=opts;$("#trto").innerHTML=opts;$("#capacc").innerHTML=opts;
}
function fillCats(selected=""){
  const kind=$("#tt").value,list=kind==="income"?INC_CATS:EXP_CATS;
  $("#tcat").innerHTML=list.map(x=>`<option ${x===selected?"selected":""}>${x}</option>`).join("");
}
function txTypeChanged(){
  const k=$("#tt").value;
  $("#normalTx").classList.toggle("hidden",["transfer","capital"].includes(k));
  $("#transferTx").classList.toggle("hidden",k!=="transfer");
  $("#capitalTx").classList.toggle("hidden",k!=="capital");
  fillCats();
}
function openTx(id=null){
  editTx=id;const x=id?T.find(t=>t.id===id):null;
  fillAccounts();
  $("#txTitle").textContent=x?"Upraviť transakciu":"Nová transakcia";
  $("#tt").value=x?.kind||"expense";
  txTypeChanged();
  if(x?.kind==="transfer"){
    $("#trn").value=x.n||"Prevod medzi vlastnými účtami";$("#trfrom").value=x.fromAccount||"rb";$("#trto").value=x.toAccount||"slsp";$("#trfa").value=x.fromAmount||"";$("#trta").value=x.toAmount||"";$("#trfee").value=x.fee||"";$("#trd").value=x.d||today();ratePreview();
  } else if(x?.kind==="capital"){
    $("#capn").value=x.n||"Vklad do investícií";$("#capacc").value=x.accountId||"slsp";$("#capplatform").value=x.platform||"Trading 212";$("#capa").value=x.a||"";$("#capd").value=x.d||today();
  } else {
    fillCats(x?.c||"");
    $("#tn").value=x?.n||"";$("#ta").value=x?.a||"";$("#td").value=x?.d||today();$("#tacc").value=x?.accountId||A[0].id;$("#tnote").value=x?.note||"";
  }
  if(!x){$("#trn").value="Prevod medzi vlastnými účtami";$("#trfrom").value="rb";$("#trto").value="slsp";$("#trfa").value="";$("#trta").value="";$("#trfee").value="";$("#trd").value=today();$("#capn").value="Vklad do investícií";$("#capacc").value="slsp";$("#capplatform").value="Trading 212";$("#capa").value="";$("#capd").value=today();}
  $("#txdlg").showModal();
}
function closeTx(){editTx=null;$("#txdlg").close()}
function ratePreview(){
  const f=acc($("#trfrom").value),t=acc($("#trto").value),fa=Number($("#trfa").value),ta=Number($("#trta").value);
  let text="Po zadaní oboch súm vypočítam efektívny kurz.";
  if(f&&t&&fa>0&&ta>0){
    if(f.currency==="CZK"&&t.currency==="EUR")text=`Efektívny kurz: ${(fa/ta).toFixed(3)} CZK za 1 €`;
    else if(f.currency==="EUR"&&t.currency==="CZK")text=`Efektívny kurz: ${(ta/fa).toFixed(3)} CZK za 1 €`;
    else text="Prevod je v rovnakej mene.";
  }
  $("#rateBox").textContent=text;
}
function saveTx(){
  const k=$("#tt").value;let obj;
  if(k==="transfer"){
    const f=$("#trfrom").value,t=$("#trto").value,fa=Math.abs(Number($("#trfa").value)),ta=Math.abs(Number($("#trta").value)),d=$("#trd").value;
    if(f===t)return alert("Vyber dva rozdielne účty.");if(!fa||!ta||!d)return alert("Zadaj odoslanú aj prijatú sumu.");
    obj={id:editTx||Date.now(),kind:"transfer",n:$("#trn").value||"Vlastný prevod",d,fromAccount:f,toAccount:t,fromAmount:fa,toAmount:ta,fee:Math.abs(Number($("#trfee").value)||0)};
  } else if(k==="capital"){
    const a=acc($("#capacc").value),amt=Math.abs(Number($("#capa").value)),d=$("#capd").value;
    if(!amt||!d)return alert("Zadaj sumu a dátum.");
    obj={id:editTx||Date.now(),kind:"capital",n:$("#capn").value||"Vklad do investícií",a:amt,d,accountId:a.id,currency:a.currency,platform:$("#capplatform").value};
  } else {
    const a=acc($("#tacc").value),amt=Math.abs(Number($("#ta").value)),d=$("#td").value,n=$("#tn").value.trim();
    if(!n||!amt||!d)return alert("Vyplň názov, sumu a dátum.");
    obj={id:editTx||Date.now(),kind:k,n,a:amt,d,accountId:a.id,currency:a.currency,c:$("#tcat").value,note:$("#tnote").value.trim()};
  }
  if(editTx)T[T.findIndex(x=>x.id===editTx)]=obj; else T.push(obj);
  save();closeTx();render();
}
function delTx(id){if(confirm("Vymazať transakciu?")){T=T.filter(x=>x.id!==id);save();render()}}

function openInv(id=null){
  editInv=id;const i=id?I.find(x=>x.id===id):null;$("#invTitle").textContent=i?"Upraviť investíciu":"Nová investícia";
  $("#ip").value=i?.platform||"Trading 212";$("#it").value=i?.type||"ETF";$("#in").value=i?.name||"";$("#ticker").value=i?.ticker||"";$("#ic").value=i?.currency||"EUR";$("#ico").value=i?.cost??"";$("#iv").value=i?.currentValue??"";$("#idiv").value=i?.dividends??"";$("#iu").value=i?.updated||today();$("#idlg").showModal();
}
function closeInv(){editInv=null;$("#idlg").close()}
function saveInv(){
  const name=$("#in").value.trim();if(!name)return alert("Zadaj názov investície.");
  const obj={id:editInv||Date.now(),platform:$("#ip").value,type:$("#it").value,name,ticker:$("#ticker").value.trim(),currency:$("#ic").value,cost:Math.abs(Number($("#ico").value)||0),currentValue:Math.abs(Number($("#iv").value)||0),dividends:Math.abs(Number($("#idiv").value)||0),updated:$("#iu").value||today()};
  if(editInv)I[I.findIndex(x=>x.id===editInv)]=obj;else I.push(obj);save();closeInv();render();
}
function delInv(id){if(confirm("Zmazať investíciu?")){I=I.filter(x=>x.id!==id);save();render()}}

let editBudgetCat=null;
function openBudget(){editBudgetCat=null;const used=new Set(B.map(x=>x.category)),cats=EXP_CATS.filter(x=>!used.has(x));if(!cats.length)return alert("Všetky kategórie už majú rozpočet.");$("#bcat").innerHTML=cats.map(x=>`<option>${x}</option>`).join("");$("#blimit").value="";$("#bdlg").showModal()}
function editBudget(cat){cat=decodeURIComponent(cat);editBudgetCat=cat;$("#bcat").innerHTML=`<option>${esc(cat)}</option>`;$("#blimit").value=B.find(x=>x.category===cat)?.limit||"";$("#bdlg").showModal()}
function closeBudget(){editBudgetCat=null;$("#bdlg").close()}
function saveBudget(){const limit=Number($("#blimit").value);if(!limit||limit<=0)return alert("Zadaj mesačný limit.");if(editBudgetCat)B.find(x=>x.category===editBudgetCat).limit=limit;else B.push({category:$("#bcat").value,limit});save();closeBudget();render()}
function delBudget(cat){cat=decodeURIComponent(cat);if(confirm(`Odstrániť rozpočet ${cat}?`)){B=B.filter(x=>x.category!==cat);save();render()}}

function openGoal(id=null){editGoal=id;const g=id?G.find(x=>x.id===id):null;$("#goalTitle").textContent=g?"Upraviť cieľ":"Nový cieľ";$("#gn").value=g?.name||"";$("#gc").value=g?.current??"";$("#gt").value=g?.target??"";$("#gd").value=g?.deadline||"";$("#gdlg").showModal()}
function closeGoal(){editGoal=null;$("#gdlg").close()}
function saveGoal(){const name=$("#gn").value.trim(),target=Math.abs(Number($("#gt").value));if(!name||!target)return alert("Zadaj názov a cieľovú sumu.");const obj={id:editGoal||Date.now(),name,current:Math.abs(Number($("#gc").value)||0),target,deadline:$("#gd").value};if(editGoal)G[G.findIndex(x=>x.id===editGoal)]=obj;else G.push(obj);save();closeGoal();render()}
function delGoal(id){if(confirm("Zmazať cieľ?")){G=G.filter(x=>x.id!==id);save();render()}}

function ask(){
  const q=$("#q").value.trim().toLowerCase(),mt=monthTotals(),prev=monthTotals(offsetMonthKey(-1)),is=invStats(),sp=spendingByCat(),rec=recurringPayments(),spikes=categorySpikes();if(!q)return;let r;
  if(/invest|trading|fond|portf/.test(q))r=is.valid?`Investície majú hodnotu ${eur(is.value)}. Vložené ${eur(is.cost)}, zisk/strata vrátane dividend ${is.gain>=0?"+":""}${eur(is.gain)} (${is.pct.toFixed(2)} %).`:"Pre spoločný prepočet investícií v CZK nastav referenčný kurz.";
  else if(/opak|predplat|pravidel/.test(q))r=rec.length?`Rozpoznal som: ${rec.map(x=>`${x.name} ~ ${eur(x.avg)}, ďalší odhad ${x.next}`).join(" · ")}`:"Zatiaľ nemám dosť histórie na spoľahlivé rozpoznanie opakovaných platieb.";
  else if(/minul|porovn|rast|kles/.test(q)){const c=percentChange(mt.exp,prev.exp);r=c===null?"Minulý mesiac nemám dosť porovnateľných dát.":`Výdavky sú oproti minulému mesiacu ${Math.abs(c).toFixed(1)} % ${c>0?"vyššie":"nižšie"}.`;}
  else if(/nezvy|odchyl|anom|nárast/.test(q))r=spikes.length?`Výraznejší nárast vidím v ${spikes.map(x=>`${x.cat} (+${x.pct.toFixed(0)} %)`).join(", ")}.`:"Momentálne nevidím výrazný nárast kategórie oproti posledným mesiacom.";
  else if(/rozpo|limit/.test(q)){const over=B.filter(b=>(sp[b.category]||0)>b.limit);r=over.length?`Nad limitom: ${over.map(x=>x.category).join(", ")}.`:"Momentálne nemáš žiadny nastavený rozpočet nad limitom.";}
  else if(/cieľ|rezerv|bývan/.test(q))r=G.length?G.map(g=>`${g.name}: ${eur(g.current)} z ${eur(g.target)}`).join(" · "):"Zatiaľ nemáš nastavené ciele.";
  else r=mt.valid?`Tento mesiac: príjem ${eur(mt.inc)}, výdavky ${eur(mt.exp)}, príjem − spotreba ${eur(mt.flow)}. Poplatky za vlastné prevody rátam ako skutočný náklad, samotný prevod nie.`:"Na spoločný EUR prepočet nastav kurz CZK/EUR.";
  $("#answer").textContent=r;
}
function backup(){
  const data={version:"2.5.1",accounts:A,transactions:T,investments:I,budgets:B,goals:G,fxRateCZKPerEUR:FX,expectedSalaryCZK:45000};
  const b=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="rozpocetguru-2.5.1-backup.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);
}
function readFileText(file){return typeof file.text==='function'?file.text():new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('Súbor sa nepodarilo prečítať. Skús ho uložiť do Stiahnutých súborov.'));reader.readAsText(file)});}
function previewStatementText(){const content=$('#statementText').value;return previewStatement({name:'vlozeny.json',size:new Blob([content]).size,text:async()=>content});}
async function restore(file){
 if(!file)return;
 try{
  if(file.size>10*1024*1024)throw Error('Záloha je príliš veľká.');
  const d=JSON.parse((await readFileText(file)).replace(/^\uFEFF/,''));
  if(d.schema)throw Error('Toto je výpis. Načítaj ho vyššie cez Bankové výpisy.');
  if(!d||!Array.isArray(d.accounts)||!Array.isArray(d.transactions)||!Array.isArray(d.investments)||!Array.isArray(d.budgets||[])||!Array.isArray(d.goals||[])||!d.accounts.length)throw Error('Neplatná záloha.');
  if(d.accounts.some(a=>!a||typeof a.id!=='string'||typeof a.name!=='string'||!['EUR','CZK'].includes(a.currency)||(a.balance!=null&&!Number.isFinite(a.balance))))throw Error('Neplatné účty v zálohe.');
  if(d.transactions.some(t=>!t||!Number.isFinite(t.id)||typeof t.kind!=='string'||typeof t.d!=='string'||(!Number.isFinite(t.a)&&t.kind!=='transfer')))throw Error('Neplatné transakcie v zálohe.');
  if(d.investments.some(i=>!i||!Number.isFinite(i.id)||typeof i.name!=='string'||!['EUR','CZK'].includes(i.currency)||!Number.isFinite(i.cost)||!Number.isFinite(i.currentValue)))throw Error('Neplatné investície v zálohe.');
  if((d.budgets||[]).some(b=>!b||typeof b.category!=='string'||!Number.isFinite(b.limit))||(d.goals||[]).some(g=>!g||typeof g.name!=='string'||!Number.isFinite(g.current)||!Number.isFinite(g.target)))throw Error('Neplatné rozpočty alebo ciele.');
  const fx=d.fxRateCZKPerEUR||0;if(!Number.isFinite(fx)||fx<0)throw Error('Neplatný kurz.');
  if(!confirm('Obnovenie zálohy nahradí súčasné údaje. Máš exportovanú aktuálnu zálohu a chceš pokračovať?'))return;
  const entries=[[AKEY,d.accounts],[TKEY,d.transactions],[IKEY,d.investments],[BKEY,d.budgets||[]],[GKEY,d.goals||[]],[FKEY,fx]],old=entries.map(([k])=>[k,localStorage.getItem(k)]);
  try{for(const [k,v]of entries)localStorage.setItem(k,JSON.stringify(v))}catch(e){for(const[k,v]of old){if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v)}throw e}
  A=d.accounts;T=d.transactions;I=d.investments;B=d.budgets||[];G=d.goals||[];FX=fx;render();alert('Záloha bola obnovená.');
 }catch(e){alert(e instanceof SyntaxError?'Súbor nie je platná JSON záloha.':e.message||'Zálohu sa nepodarilo obnoviť.')}
}

$("#search").addEventListener("input",render);
$("#trfa").addEventListener("input",ratePreview);
$("#trta").addEventListener("input",ratePreview);
$("#q").addEventListener("keydown",e=>{if(e.key==="Enter")ask()});
let statementDraft=null,reviewId=null;
const statementKinds=['expense','income','own_transfer','own_fx_transfer','probable_own_transfer','investment_inflow','investment_outflow','probable_investment_outflow','cash_deposit','cash_withdrawal','loan_principal','refund','unresolved'];
function validateStatement(data){
 if(!data||data.schema!=='rozpocetguru-statement-draft-v1'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(data.period)||!Array.isArray(data.transactions)||data.transactions.length>10000)throw Error('Vyber spracovaný výpis transakcie-2026-08.json. Zálohy patria do Obnoviť zálohu.');
 const keys=new Set();
 for(const r of data.transactions){
  if(!r||typeof r.id!=='string'||keys.has(r.id)||!A.some(a=>a.id===r.account&&a.currency===r.currency)||typeof r.amount!=='number'||!Number.isFinite(r.amount)||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||r.date.slice(0,7)!==data.period||!statementKinds.includes(r.kind)||typeof r.description!=='string'||typeof r.category!=='string'||typeof r.needs_review!=='boolean')throw Error('Neplatná alebo duplicitná transakcia.');
  const d=new Date(r.date+'T12:00:00Z');if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==r.date)throw Error('Neplatný dátum.');
  if((r.kind==='income'&&r.amount<0)||(r.kind==='expense'&&r.amount>0))throw Error('Typ pohybu nesedí so znamienkom sumy.');
  keys.add(r.id);
 }
 return data;
}
function importedAlready(r){return T.some(x=>x.importId===r.id||(r.bank_transaction_id&&x.accountId===r.account&&x.bankTransactionId===r.bank_transaction_id))}
async function previewStatement(file){
 statementDraft=null;$('#statementPreview').textContent='';if(!file)return;
 try{
  if(/\.pdf$/i.test(file.name||'')||file.type==='application/pdf')throw Error('Vybral si PDF. Použi spracovaný súbor transakcie-2026-08.json, ktorý si dostal samostatne.');
  if(/\.zip$/i.test(file.name||''))throw Error('Vybral si ZIP aplikácie. Pre import vyber samostatný transakcie-2026-08.json.');
  if(file.size>10*1024*1024)throw Error('Súbor je príliš veľký.');
  const data=validateStatement(JSON.parse((await readFileText(file)).replace(/^\uFEFF/,'')));statementDraft=data;
  const fresh=data.transactions.filter(r=>!importedAlready(r)),duplicate=data.transactions.length-fresh.length;
  $('#statementPreview').innerHTML=`<div class="notice neutral">Obdobie ${esc(data.period)} · ${fresh.length} nových · ${duplicate} už importovaných · ${fresh.filter(r=>r.needs_review).length} na kontrolu. Nejasné prevody a hotovosť sa nezapočítajú do spotreby ani zárobku. Ručne zadané duplicity treba skontrolovať.</div><button class="primary" onclick="commitStatement()" ${fresh.length?'':'disabled'}>Pridať transakcie</button>`;
 }catch(e){$('#statementPreview').textContent=e instanceof SyntaxError?'Súbor nemá platný obsah JSON. Vyber spracovaný výpis, nie PDF alebo ZIP.':e.message||'Výpis sa nepodarilo načítať.'}
}
function commitStatement(){
 if(!statementDraft)return;
 const fresh=statementDraft.transactions.filter(r=>!importedAlready(r));
 let nextId=Math.max(Date.now(),...T.map(x=>Number(x.id)||0))+1;
 const additions=fresh.map(r=>({id:nextId++,importId:r.id,bankTransactionId:r.bank_transaction_id||null,source:'statement',d:r.date,kind:r.kind,accountId:r.account,currency:r.currency,a:Math.abs(r.amount),signedAmount:r.amount,n:r.bank_type||r.category,c:r.category,note:r.description,needsReview:r.needs_review,reviewReason:r.review_reason||'',platform:r.platform||null,otherAccount:r.other_account||null,originalAmount:r.original_amount??null,originalCurrency:r.original_currency||null}));
 // Write first so storage errors cannot leave an unsaved in-memory import.
 const merged=T.concat(additions);
 try{localStorage.setItem(TKEY,JSON.stringify(merged))}catch{alert('Transakcie sa nepodarilo uložiť. Exportuj zálohu a skontroluj voľné miesto.');return}
 T=merged;$('#reportMonth').value=statementDraft.period;localStorage.setItem('rg25_month',statementDraft.period);statementDraft=null;$('#statementPreview').textContent=`Pridaných ${additions.length} transakcií.`;render();nav('txs');
}
function renderImportCoverage(){
 const el=$('#importCoverage');if(!el)return;
 const rows=T.filter(x=>isMonth(x.d)),imports=rows.filter(x=>x.source==='statement'),review=imports.filter(x=>x.needsReview);
 el.textContent=imports.length?`${imports.length} importovaných pohybov · ${review.length} na kontrolu. Prehľad zahŕňa označenú spotrebu a zárobok; prevody, investície, hotovosť a istina sú samostatné pohyby. Zostatky ostávajú manuálne. Časti histórie na ďalších účtoch môžu chýbať.`:'Zobrazuje sa vybrané obdobie. Import nájdeš v Profile.';
}
const originalTxHtml=txHtml;
txHtml=function(x,actions=false){
 if(x.source!=='statement')return originalTxHtml(x,actions);
 const account=acc(x.accountId),sign=x.signedAmount>=0?'+':'−';
 return `<div class="row"><div class="row-icon">${x.needsReview?'?':'↕'}</div><div class="row-main"><div class="row-name">${esc(x.n)}</div><div class="row-meta">${esc(x.d)} · ${esc(account?.name||x.accountId)} · ${esc(x.c)}${x.needsReview?' · Na kontrolu':''}</div><details><summary class="small muted">Popis z výpisu</summary><p class="small">${esc(x.note)}</p><p class="small muted">${esc(x.reviewReason)}</p></details>${actions?`<div class="mini-actions"><button class="mini" onclick="openReview(${x.id})">Zaradiť</button><button class="mini" onclick="delTx(${x.id})">Zmazať</button></div>`:''}</div><div class="row-value">${sign}${money(x.a,x.currency)}</div></div>`;
};
function openReview(id){
 const x=T.find(t=>t.id===id);if(!x||x.source!=='statement')return;reviewId=id;
 $('#reviewDescription').textContent=money(x.signedAmount,x.currency)+' · '+x.note;
 $('#reviewKind').value=statementKinds.includes(x.kind)&&![...$('#reviewKind').options].some(o=>o.value===x.kind)?'unresolved':x.kind;
 $('#reviewCategory').value=x.c;$('#reviewdlg').showModal();
}
function saveReview(){
 const x=T.find(t=>t.id===reviewId);if(!x)return;
 const kind=$('#reviewKind').value,category=$('#reviewCategory').value.trim();if(!category)return alert('Zadaj kategóriu.');
 if((kind==='income'&&x.signedAmount<0)||(kind==='expense'&&x.signedAmount>0))return alert('Typ pohybu nesedí so znamienkom sumy.');
 const updated=T.map(t=>t.id===x.id?{...t,kind,c:category,needsReview:kind==='unresolved'}:t);try{localStorage.setItem(TKEY,JSON.stringify(updated))}catch{return alert('Zaradenie sa nepodarilo uložiť. Exportuj zálohu.')}T=updated;$('#reviewdlg').close();render();
}

// Confirmed correction: these four imported Revolut payments are not own transfers.
const correctedRevolutIds=["slsp-202608-044", "slsp-202608-045", "slsp-202608-046", "slsp-202608-047"];
const correctedT=T.map(x=>correctedRevolutIds.includes(x.importId)&&x.kind==='probable_own_transfer'?{...x,kind:'unresolved',c:'Platba inej osobe',otherAccount:null,needsReview:true,reviewReason:'Používateľ potvrdil: Revolut nie je jeho. Účel platby zatiaľ neznámy.'}:x);
if(correctedT.some((x,i)=>x!==T[i])){try{localStorage.setItem(TKEY,JSON.stringify(correctedT));T=correctedT}catch{alert('Opravu zaradenia Revolut sa nepodarilo uložiť. Exportuj zálohu.')}}
$('#reportMonth').value=localStorage.getItem('rg25_month')||today().slice(0,7);
$('#reportMonth').addEventListener('change',()=>localStorage.setItem('rg25_month',$('#reportMonth').value));
render();
