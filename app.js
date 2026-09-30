const KEY='rg2_transactions', GOALS_KEY='rg2_goals';
const categories={
 expense:['Bývanie','Potraviny','Reštaurácie','Auto a doprava','Palivo','Poistenie','Zdravie','Telekom','Predplatné','Zábava','Oblečenie','Cestovanie','Nákupy','Vzdelanie','Splátky dlhu','Investície','Iné'],
 income:['Mzda','Bonus','Vedľajší príjem','Refundácia','Iné príjmy'],
 transfer:['Vlastný prevod']
};
const demo=[
 {id:1,n:'Mzda',a:1850,t:'income',c:'Mzda',d:'2026-09-15',note:''},
 {id:2,n:'Nájom a energie',a:620,t:'expense',c:'Bývanie',d:'2026-09-02',note:''},
 {id:3,n:'Potraviny',a:184,t:'expense',c:'Potraviny',d:'2026-09-08',note:''},
 {id:4,n:'Čerpacia stanica',a:78,t:'expense',c:'Palivo',d:'2026-09-12',note:''},
 {id:5,n:'Poistenie auta',a:50,t:'expense',c:'Poistenie',d:'2026-09-18',note:''},
 {id:6,n:'Reštaurácia',a:42,t:'expense',c:'Reštaurácie',d:'2026-09-22',note:''},
 {id:7,n:'Telefón',a:24,t:'expense',c:'Telekom',d:'2026-09-25',note:''},
 {id:8,n:'Presun na sporenie',a:300,t:'transfer',c:'Vlastný prevod',d:'2026-09-26',note:''}
];
const accounts=[{name:'Bežný účet',bank:'Hlavný účet',balance:2840,icon:'€'},{name:'Sporenie',bank:'Rezerva',balance:4350,icon:'↗'}];
const budgets=[{c:'Potraviny',limit:300},{c:'Palivo',limit:160},{c:'Reštaurácie',limit:120},{c:'Telekom',limit:60}];
const goals=[{name:'Finančná rezerva',current:2400,target:6000},{name:'Vlastné bývanie',current:5500,target:20000}];
let tx=load(KEY,demo), editingId=null;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const eur=n=>new Intl.NumberFormat('sk-SK',{style:'currency',currency:'EUR'}).format(n);
function load(k,f){try{return JSON.parse(localStorage.getItem(k))||structuredClone(f)}catch{return structuredClone(f)}}
function save(){localStorage.setItem(KEY,JSON.stringify(tx))}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function monthTx(){return tx}
function totals(){const m=monthTx();return {i:m.filter(x=>x.t==='income').reduce((s,x)=>s+x.a,0),e:m.filter(x=>x.t==='expense').reduce((s,x)=>s+x.a,0)}}
function iconFor(c){const m={'Bývanie':'⌂','Potraviny':'◒','Reštaurácie':'♨','Palivo':'⛽','Poistenie':'◇','Telekom':'◉','Mzda':'€','Vlastný prevod':'↔'};return m[c]||'•'}
function txRow(x,actions=true){const sign=x.t==='income'?'+':x.t==='expense'?'−':'↔ '; const cls=x.t==='income'?'positive':x.t==='expense'?'negative':'muted';
 return `<div class="tx"><div class="tx-icon">${iconFor(x.c)}</div><div class="tx-main"><div class="tx-name">${esc(x.n)}</div><div class="tx-meta">${x.d} · ${esc(x.c)}</div></div><div class="tx-amt ${cls}">${sign}${eur(x.a)}${actions?`<div class="tx-actions"><button class="mini-btn" onclick="editTx(${x.id})">Upraviť</button><button class="mini-btn" onclick="removeTx(${x.id})">Zmazať</button></div>`:''}</div></div>`}
function render(){
 const {i,e}=totals(), flow=i-e, rate=i?Math.round(flow/i*100):0;
 $('#income').textContent=eur(i); $('#expenses').textContent=eur(e); $('#cashflow').textContent=eur(flow); $('#savingRate').textContent=`${rate} %`;
 $('#cashStatus').textContent=flow>=0?'Kladný':'Záporný'; $('#cashStatus').style.background=flow>=0?'#143425':'#3a1922'; $('#cashStatus').style.color=flow>=0?'#79e8b8':'#ff9eaa';
 $('#accounts').innerHTML=accounts.map(a=>`<div class="account"><div class="icon">${a.icon}</div><span class="muted small">${a.bank}</span><strong>${eur(a.balance)}</strong><span>${a.name}</span></div>`).join('');
 const sorted=[...tx].sort((a,b)=>b.d.localeCompare(a.d)||b.id-a.id);
 $('#recent').innerHTML=sorted.slice(0,4).map(x=>txRow(x,false)).join('')||'<div class="muted">Žiadne transakcie.</div>';
 renderTransactions(sorted); renderBudgets(); renderGoals(); renderInsight(i,e,rate); renderGuru(i,e,rate); drawChart();
}
function renderTransactions(sorted){
 const q=($('#search')?.value||'').toLowerCase(), tf=$('#typeFilter')?.value||'all';
 const rows=sorted.filter(x=>(tf==='all'||x.t===tf)&&(`${x.n} ${x.c} ${x.note||''}`).toLowerCase().includes(q));
 $('#allTransactions').innerHTML=rows.map(x=>txRow(x,true)).join('')||'<div class="muted">Nič som nenašiel.</div>';
}
function catSpent(c){return tx.filter(x=>x.t==='expense'&&x.c===c).reduce((s,x)=>s+x.a,0)}
function budgetHTML(b){const spent=catSpent(b.c), pct=Math.min(100,Math.round(spent/b.limit*100)), cls=pct>=100?'over':pct>=80?'warn':'';return `<div class="card budget-card"><div class="budget-row"><strong>${b.c}</strong><span>${eur(spent)} / ${eur(b.limit)}</span></div><div class="bar"><div class="fill ${cls}" style="width:${pct}%"></div></div><div class="small muted" style="margin-top:7px">${Math.max(0,b.limit-spent).toFixed(0)} € zostáva</div></div>`}
function renderBudgets(){ $('#budgetPreview').innerHTML=budgets.slice(0,2).map(budgetHTML).join(''); $('#budgetsList').innerHTML=budgets.map(budgetHTML).join('') }
function renderGoals(){ $('#goalsList').innerHTML=goals.map(g=>{const p=Math.min(100,Math.round(g.current/g.target*100));return `<div class="card budget-card"><div class="budget-row"><strong>${g.name}</strong><span>${p} %</span></div><p class="muted">${eur(g.current)} z ${eur(g.target)}</p><div class="bar"><div class="fill" style="width:${p}%"></div></div></div>`}).join('') }
function topCategory(){const m={};tx.filter(x=>x.t==='expense').forEach(x=>m[x.c]=(m[x.c]||0)+x.a);return Object.entries(m).sort((a,b)=>b[1]-a[1])[0]||['—',0]}
function renderInsight(i,e,rate){const [c,v]=topCategory(); $('#homeInsight').innerHTML=`<div class="eyebrow" style="color:#74e2b1">✦ POSTREH</div><strong>${i>=e?'Cash-flow je kladný.':'Výdavky sú vyššie než príjem.'}</strong><div class="muted">Miera úspory je ${rate} %. Najväčšia kategória výdavkov: ${esc(c)} (${eur(v)}).</div>`}
function renderGuru(i,e,rate){const [c,v]=topCategory(); $('#guruInsights').innerHTML=`<div class="insight"><span class="muted small">Miera úspory</span><strong>${rate} %</strong></div><div class="insight"><span class="muted small">Najväčší výdavok</span><strong>${esc(c)}</strong></div><div class="insight"><span class="muted small">Cash-flow</span><strong class="${i-e>=0?'positive':'negative'}">${eur(i-e)}</strong></div><div class="insight"><span class="muted small">Výdavky spolu</span><strong>${eur(e)}</strong></div>`}
function drawChart(){
 const days=Number($('#periodSelect').value||30), sorted=[...tx].filter(x=>x.t!=='transfer').sort((a,b)=>a.d.localeCompare(b.d)).slice(-days);
 const points=sorted.map((x,idx)=>({x:idx,y:x.t==='income'?x.a:-x.a,t:x.t,d:x.d}));
 if(!points.length){$('#chart').innerHTML='<div class="muted">Pridaj transakciu.</div>';return}
 const W=560,H=190,P=22,max=Math.max(1,...points.map(p=>Math.abs(p.y))), zero=H/2;
 const sx=i=>points.length===1?W/2:P+i*(W-2*P)/(points.length-1), sy=v=>zero-(v/max)*(zero-25);
 let grid=`<line x1="${P}" y1="${zero}" x2="${W-P}" y2="${zero}" stroke="#2b3b53" stroke-width="1"/>`;
 let circles=points.map((p,i)=>`<circle cx="${sx(i)}" cy="${sy(p.y)}" r="5" fill="${p.t==='income'?'#70e3b0':'#ff7e8e'}"><title>${p.d}: ${eur(p.y)}</title></circle>`).join('');
 let stems=points.map((p,i)=>`<line x1="${sx(i)}" y1="${zero}" x2="${sx(i)}" y2="${sy(p.y)}" stroke="${p.t==='income'?'#70e3b0':'#ff7e8e'}" stroke-width="5" stroke-linecap="round" opacity=".8"/>`).join('');
 $('#chart').innerHTML=`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${grid}${stems}${circles}</svg>`;
}
function nav(page){$$('.page').forEach(p=>p.classList.remove('active')); $('#'+page).classList.add('active'); $$('.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===page)); scrollTo(0,0)}
function fillCategories(type,selected=''){const sel=$('#txCategory');sel.innerHTML=categories[type].map(c=>`<option ${c===selected?'selected':''}>${c}</option>`).join('')}
function openModal(id=null){editingId=id; const x=id?tx.find(t=>t.id===id):null; $('#modalTitle').textContent=x?'Upraviť transakciu':'Nová transakcia'; $('#txName').value=x?.n||''; $('#txAmount').value=x?.a||''; $('#txDate').value=x?.d||new Date().toISOString().slice(0,10); $('#txType').value=x?.t||'expense'; fillCategories($('#txType').value,x?.c||''); $('#txNote').value=x?.note||''; $('#txModal').classList.add('open')}
function closeModal(){editingId=null;$('#txModal').classList.remove('open')}
function saveTx(){const n=$('#txName').value.trim(),a=Math.abs(Number($('#txAmount').value)),d=$('#txDate').value,t=$('#txType').value,c=$('#txCategory').value,note=$('#txNote').value.trim();if(!n||!a||!d)return alert('Vyplň názov, sumu a dátum.'); if(editingId){const x=tx.find(x=>x.id===editingId);Object.assign(x,{n,a,d,t,c,note})}else tx.push({id:Date.now(),n,a,d,t,c,note}); save();closeModal();render()}
window.editTx=id=>openModal(id); window.removeTx=id=>{if(confirm('Vymazať túto transakciu?')){tx=tx.filter(x=>x.id!==id);save();render()}};
function guruReply(q){const {i,e}=totals(),[c,v]=topCategory(),rate=i?Math.round((i-e)/i*100):0,s=q.toLowerCase();if(/najviac|kateg/.test(s))return `Najviac ide do kategórie ${c}: ${eur(v)}.`;if(/ušet|uspor|úspor/.test(s))return `Aktuálna miera úspory je ${rate} %. Z príjmu po evidovaných výdavkoch zostáva ${eur(i-e)}.`;if(/minul|výdav/.test(s))return `Evidované výdavky sú ${eur(e)}. Vlastné prevody do nich nerátam.`;if(/príjem|zarob/.test(s))return `Evidovaný príjem je ${eur(i)}.`;return `Z tvojich lokálnych dát vidím príjem ${eur(i)}, výdavky ${eur(e)} a cash-flow ${eur(i-e)}. Skús sa opýtať na najväčšiu kategóriu alebo mieru úspory.`}
function sendGuru(){const inp=$('#guruInput'),q=inp.value.trim();if(!q)return; $('#chat').innerHTML+=`<div class="bubble me">${esc(q)}</div><div class="bubble">${esc(guruReply(q))}</div>`;inp.value=''}
function exportData(){const blob=new Blob([JSON.stringify({version:'2.0',transactions:tx,goals},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='rozpocetguru-backup.json';a.click();URL.revokeObjectURL(a.href)}
function importData(file){const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);if(!Array.isArray(d.transactions))throw 0;tx=d.transactions;save();render();alert('Dáta boli importované.')}catch{alert('Neplatný záložný súbor.')}};r.readAsText(file)}
$$('[data-page]').forEach(b=>b.addEventListener('click',()=>nav(b.dataset.page)));
$('#addTxTop').onclick=$('#addTxPage').onclick=()=>openModal(); $('#closeModal').onclick=$('#cancelModal').onclick=closeModal; $('#saveTx').onclick=saveTx;
$('#txType').onchange=()=>fillCategories($('#txType').value); $('#search').oninput=render; $('#typeFilter').onchange=render; $('#periodSelect').onchange=drawChart;
$('#sendGuru').onclick=sendGuru; $('#guruInput').addEventListener('keydown',e=>{if(e.key==='Enter')sendGuru()});
$('#exportBtn').onclick=exportData; $('#importInput').onchange=e=>e.target.files[0]&&importData(e.target.files[0]); $('#resetBtn').onclick=()=>{if(confirm('Obnoviť demo dáta?')){tx=structuredClone(demo);save();render()}};
fillCategories('expense'); render();
