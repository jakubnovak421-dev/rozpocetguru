const TX_KEY='rg2_transactions';
const ACC_KEY='rg21_accounts';
const FX_KEY='rg21_fx';
const INVEST_KEY='rg21_investments';

const accountsDefault=[
  {id:'rb_cz',name:'Raiffeisenbank',label:'CZ účet',currency:'CZK',balance:null,icon:'Kč'},
  {id:'slsp_sk',name:'Slovenská sporiteľňa',label:'SK účet',currency:'EUR',balance:null,icon:'€'}
];
const categories={
  expense:['Bývanie','Potraviny','Reštaurácie','Auto a doprava','Palivo','Poistenie','Zdravie','Telekom','Predplatné','Zábava','Oblečenie','Cestovanie','Nákupy','Vzdelanie','Splátky dlhu','Investície','Iné'],
  income:['Mzda','Bonus','Vedľajší príjem','Refundácia','Iné príjmy']
};
const goals=[{name:'Finančná rezerva',current:0,target:6000},{name:'Vlastné bývanie',current:0,target:20000}];

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const eur=n=>new Intl.NumberFormat('sk-SK',{style:'currency',currency:'EUR'}).format(n);
const money=(n,c)=>new Intl.NumberFormat(c==='CZK'?'cs-CZ':'sk-SK',{style:'currency',currency:c,maximumFractionDigits:c==='CZK'?0:2}).format(n||0);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=o=>JSON.parse(JSON.stringify(o));

function loadJSON(key,fallback){try{const v=JSON.parse(localStorage.getItem(key));return v??clone(fallback)}catch{return clone(fallback)}}
let accounts=loadJSON(ACC_KEY,accountsDefault);
let fx=Number(localStorage.getItem(FX_KEY))||null;
let tx=loadJSON(TX_KEY,[]);
let investments=loadJSON(INVEST_KEY,[]);
let editingId=null, txType='expense', editingAccountId=null;

function account(id){return accounts.find(a=>a.id===id)}
function migrate(){
  let changed=false;
  tx=tx.map(x=>{
    if(x.kind==='transfer' || x.t==='transfer'){
      if(!x.kind){changed=true;return {id:x.id||Date.now(),kind:'transfer',n:x.n||'Vlastný prevod',d:x.d||today(),fromAccount:'rb_cz',toAccount:'slsp_sk',fromAmount:Number(x.a||0),toAmount:0,fee:0,note:x.note||''}}
      return x;
    }
    if(!x.kind){
      changed=true;
      return {id:x.id||Date.now(),kind:x.t||'expense',n:x.n||'Transakcia',a:Number(x.a||0),d:x.d||today(),c:x.c||'Iné',accountId:'slsp_sk',currency:'EUR',note:x.note||''};
    }
    return x;
  });
  if(changed)saveTx();
}
function saveTx(){localStorage.setItem(TX_KEY,JSON.stringify(tx))}
function saveAccounts(){localStorage.setItem(ACC_KEY,JSON.stringify(accounts))}
function saveInvestments(){localStorage.setItem(INVEST_KEY,JSON.stringify(investments))}
function today(){return new Date().toISOString().slice(0,10)}
function thisMonth(x){return x.d?.slice(0,7)===today().slice(0,7)}

function toEur(amount,currency){
  if(currency==='EUR')return Number(amount)||0;
  if(currency==='CZK'&&fx)return (Number(amount)||0)/fx;
  return null;
}
function accountFlow(aid){
  let income=0, expense=0;
  tx.filter(thisMonth).forEach(x=>{
    if(x.kind==='income'&&x.accountId===aid)income+=x.a;
    if(x.kind==='expense'&&x.accountId===aid)expense+=x.a;
  });
  return {income,expense,flow:income-expense};
}
function totalsEur(){
  let i=0,e=0,valid=true;
  tx.filter(thisMonth).forEach(x=>{
    if(x.kind!=='income'&&x.kind!=='expense')return;
    const v=toEur(x.a,x.currency||account(x.accountId)?.currency);
    if(v===null){valid=false;return}
    if(x.kind==='income')i+=v; else e+=v;
  });
  return {i,e,flow:i-e,valid};
}
function netWorthEur(){
  let sum=0,valid=true,hasAny=false;
  accounts.forEach(a=>{
    if(a.balance===null||a.balance==='')return;
    hasAny=true;
    const v=toEur(a.balance,a.currency);
    if(v===null)valid=false; else sum+=v;
  });
  investments.forEach(inv=>{
    if(inv.currentValue==null)return;
    hasAny=true;
    const v=toEur(inv.currentValue,inv.currency||'EUR');
    if(v===null)valid=false; else sum+=v;
  });
  return {sum,valid,hasAny};
}
function effectiveRate(x){
  const from=account(x.fromAccount),to=account(x.toAccount);
  if(!from||!to||!x.fromAmount||!x.toAmount)return null;
  if(from.currency==='CZK'&&to.currency==='EUR')return x.fromAmount/x.toAmount;
  if(from.currency==='EUR'&&to.currency==='CZK')return x.toAmount/x.fromAmount;
  return null;
}
function txCurrency(x){
  if(x.kind==='transfer')return null;
  return x.currency||account(x.accountId)?.currency||'EUR';
}
function txRow(x,actions=true){
  if(x.kind==='transfer'){
    const fa=account(x.fromAccount),ta=account(x.toAccount),rate=effectiveRate(x);
    return `<div class="tx"><div class="tx-icon">↔</div><div class="tx-main"><div class="tx-name">${esc(x.n)}</div><div class="tx-meta">${x.d} · ${esc(fa?.name||'Účet')} → ${esc(ta?.name||'Účet')}${rate?` · ${rate.toFixed(3)} CZK/€`:''}</div></div><div class="tx-amt transfer-color">${money(x.fromAmount,fa?.currency||'EUR')} → ${money(x.toAmount,ta?.currency||'EUR')}${actions?actionsHtml(x.id):''}</div></div>`;
  }
  const a=account(x.accountId),currency=txCurrency(x),sign=x.kind==='income'?'+':'−',cls=x.kind==='income'?'positive':'negative';
  return `<div class="tx"><div class="tx-icon">${x.kind==='income'?'€':'•'}</div><div class="tx-main"><div class="tx-name">${esc(x.n)}</div><div class="tx-meta">${x.d} · ${esc(x.c)} · ${esc(a?.name||'Účet')}</div></div><div class="tx-amt ${cls}">${sign}${money(x.a,currency)}${actions?actionsHtml(x.id):''}</div></div>`;
}
function actionsHtml(id){return `<div class="tx-actions"><button class="mini-btn" onclick="editTx(${id})">Upraviť</button><button class="mini-btn" onclick="removeTx(${id})">Zmazať</button></div>`}

function render(){
  const n=netWorthEur(),t=totalsEur();
  $('#netWorth').textContent=n.hasAny&&n.valid?eur(n.sum):'—';
  $('#netWorthHint').textContent=!n.hasAny?'Zadaj aktuálne zostatky účtov.':(!n.valid?'Nastav referenčný kurz CZK / EUR.':'Bankové účty + neskôr investície.');
  $('#incomeEur').textContent=t.valid?eur(t.i):'—';
  $('#expenseEur').textContent=t.valid?eur(t.e):'—';
  $('#flowEur').textContent=t.valid?eur(t.flow):'—';
  $('#flowEur').className=t.valid?(t.flow>=0?'positive':'negative'):'';

  $('#accounts').innerHTML=accounts.map(a=>`<div class="account"><div class="icon">${a.icon}</div><span class="muted small">${esc(a.label)}</span><strong>${a.balance===null?'—':money(a.balance,a.currency)}</strong><span>${esc(a.name)}</span><span class="currency-badge">${a.currency}</span></div>`).join('');

  $('#accountMonth').innerHTML=accounts.map(a=>{const f=accountFlow(a.id);return `<div class="account-month-row"><div><strong>${esc(a.name)}</strong><div class="muted small">${a.currency}</div></div><div class="nums"><div class="positive">+${money(f.income,a.currency)}</div><div class="negative">−${money(f.expense,a.currency)}</div></div></div>`}).join('');

  const sorted=[...tx].sort((a,b)=>(b.d||'').localeCompare(a.d||'')||(b.id||0)-(a.id||0));
  $('#recent').innerHTML=sorted.slice(0,5).map(x=>txRow(x,false)).join('')||'<div class="muted">Zatiaľ žiadne transakcie.</div>';
  renderTransactions(sorted);
  renderProfile();
  renderGoals();
  renderGuru();
  drawChart();
}
function renderTransactions(sorted){
  const q=($('#search').value||'').toLowerCase(),tf=$('#typeFilter').value,af=$('#accountFilter').value;
  const rows=sorted.filter(x=>{
    const typeOk=tf==='all'||x.kind===tf;
    const accOk=af==='all'||(x.kind==='transfer'?(x.fromAccount===af||x.toAccount===af):x.accountId===af);
    const text=`${x.n||''} ${x.c||''} ${x.note||''}`.toLowerCase();
    return typeOk&&accOk&&text.includes(q);
  });
  $('#allTransactions').innerHTML=rows.map(x=>txRow(x,true)).join('')||'<div class="muted">Nič som nenašiel.</div>';
}
function renderProfile(){
  $('#accountSettings').innerHTML=accounts.map(a=>`<div class="account-setting"><div><strong>${esc(a.name)}</strong><div class="muted small">${esc(a.label)} · ${a.currency}</div></div><div style="text-align:right"><div class="balance">${a.balance===null?'Nezadané':money(a.balance,a.currency)}</div><button class="mini-btn" onclick="editAccount('${a.id}')">Upraviť</button></div></div>`).join('');
  $('#fxRate').value=fx||'';
  $('#accountFilter').innerHTML='<option value="all">Všetky účty</option>'+accounts.map(a=>`<option value="${a.id}">${esc(a.name)} (${a.currency})</option>`).join('');
}
function renderGoals(){
  $('#goalsList').innerHTML=goals.map(g=>`<div class="card settings-card"><strong>${esc(g.name)}</strong><p class="muted">Cieľ ${eur(g.target)} · priebeh zatiaľ nezadaný</p><div class="bar"><div class="fill" style="width:0%"></div></div></div>`).join('');
}
function topExpenseEur(){
  const m={}; let valid=true;
  tx.filter(x=>thisMonth(x)&&x.kind==='expense').forEach(x=>{const v=toEur(x.a,txCurrency(x));if(v===null){valid=false;return}m[x.c]=(m[x.c]||0)+v});
  const top=Object.entries(m).sort((a,b)=>b[1]-a[1])[0];
  return {top,valid};
}
function renderGuru(){
  const t=totalsEur(),top=topExpenseEur(),rb=accountFlow('rb_cz'),sk=accountFlow('slsp_sk');
  $('#guruInsights').innerHTML=`<div class="insight"><span class="muted small">Raiffeisenbank príjem</span><strong>${money(rb.income,'CZK')}</strong></div><div class="insight"><span class="muted small">SLSP výdavky</span><strong>${money(sk.expense,'EUR')}</strong></div><div class="insight"><span class="muted small">Vlastné prevody</span><strong>${tx.filter(x=>thisMonth(x)&&x.kind==='transfer').length}</strong></div><div class="insight"><span class="muted small">Súhrnný cash-flow</span><strong>${t.valid?eur(t.flow):'Nastav kurz'}</strong></div>`;
  let title='Dvojité započítanie prevodov sme odstránili.';
  let body='Presun CZK z Raiffeisenbank do SLSP sa eviduje ako vlastný prevod a neovplyvní príjem ani výdavky.';
  if(top.top&&top.valid)body+=` Najväčšia výdavková kategória je ${top.top[0]} (${eur(top.top[1])}).`;
  $('#homeInsight').innerHTML=`<div class="eyebrow" style="color:#74e2b1">✦ POSTREH</div><strong>${title}</strong><div class="muted">${body}</div>`;
}
function drawChart(){
  const limit=Number($('#periodSelect').value||30);
  const rows=[...tx].filter(x=>x.d).sort((a,b)=>a.d.localeCompare(b.d)).slice(-limit);
  if(!rows.length){$('#chart').innerHTML='<div class="muted">Pridaj prvú transakciu.</div>';return}
  const vals=rows.map(x=>{
    if(x.kind==='transfer')return {v:0,type:'transfer',label:'prevod'};
    const v=toEur(x.a,txCurrency(x));
    return {v:v===null?0:(x.kind==='income'?v:-v),type:x.kind,label:x.n};
  });
  const W=560,H=190,P=22,zero=H/2,max=Math.max(1,...vals.map(p=>Math.abs(p.v)));
  const sx=i=>rows.length===1?W/2:P+i*(W-2*P)/(rows.length-1),sy=v=>zero-(v/max)*(zero-25);
  const stems=vals.map((p,i)=>{const color=p.type==='income'?'#70e3b0':p.type==='expense'?'#ff7e8e':'#73b8ff';const y=p.type==='transfer'?zero-5:sy(p.v);return `<line x1="${sx(i)}" y1="${zero}" x2="${sx(i)}" y2="${y}" stroke="${color}" stroke-width="5" stroke-linecap="round" opacity=".85"/><circle cx="${sx(i)}" cy="${y}" r="5" fill="${color}"><title>${esc(rows[i].d)} · ${esc(p.label)}</title></circle>`}).join('');
  $('#chart').innerHTML=`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><line x1="${P}" y1="${zero}" x2="${W-P}" y2="${zero}" stroke="#2b3b53" stroke-width="1"/>${stems}</svg>`;
}
function nav(page){$$('.page').forEach(p=>p.classList.remove('active'));$('#'+page).classList.add('active');$$('.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===page));scrollTo(0,0)}
function setType(type){
  txType=type; $$('#typeSwitch button').forEach(b=>b.classList.toggle('active',b.dataset.type===type));
  $('#normalFields').classList.toggle('hidden',type==='transfer'); $('#transferFields').classList.toggle('hidden',type!=='transfer');
  if(type!=='transfer')fillNormalFields();
}
function fillNormalFields(selectedCat=''){
  $('#txAccount').innerHTML=accounts.map(a=>`<option value="${a.id}">${esc(a.name)} · ${a.currency}</option>`).join('');
  const list=categories[txType]||categories.expense;
  $('#txCategory').innerHTML=list.map(c=>`<option ${c===selectedCat?'selected':''}>${c}</option>`).join('');
}
function fillTransferAccounts(from='rb_cz',to='slsp_sk'){
  $('#trFrom').innerHTML=accounts.map(a=>`<option value="${a.id}" ${a.id===from?'selected':''}>Z: ${esc(a.name)} · ${a.currency}</option>`).join('');
  $('#trTo').innerHTML=accounts.map(a=>`<option value="${a.id}" ${a.id===to?'selected':''}>Na: ${esc(a.name)} · ${a.currency}</option>`).join('');
  updateTransferLabels();
}
function updateTransferLabels(){
  const f=account($('#trFrom').value),t=account($('#trTo').value);
  $('#fromLabel').textContent=`Odoslané (${f?.currency||''})`; $('#toLabel').textContent=`Prijaté (${t?.currency||''})`; updateRatePreview();
}
function updateRatePreview(){
  const f=account($('#trFrom').value),t=account($('#trTo').value),fa=Number($('#trFromAmount').value),ta=Number($('#trToAmount').value);
  let text='Efektívny kurz sa vypočíta po zadaní oboch súm.';
  if(f&&t&&fa>0&&ta>0){
    if(f.currency==='CZK'&&t.currency==='EUR')text=`Efektívny kurz: ${(fa/ta).toFixed(3)} CZK za 1 €`;
    else if(f.currency==='EUR'&&t.currency==='CZK')text=`Efektívny kurz: ${(ta/fa).toFixed(3)} CZK za 1 €`;
    else text='Prevod je v rovnakej mene.';
  }
  $('#ratePreview').textContent=text;
}
function openModal(id=null){
  editingId=id; const x=id?tx.find(t=>t.id===id):null; $('#modalTitle').textContent=x?'Upraviť transakciu':'Nová transakcia';
  const type=x?.kind||'expense'; setType(type);
  if(type==='transfer'){
    fillTransferAccounts(x?.fromAccount||'rb_cz',x?.toAccount||'slsp_sk');
    $('#trName').value=x?.n||'Prevod medzi vlastnými účtami'; $('#trFromAmount').value=x?.fromAmount||''; $('#trToAmount').value=x?.toAmount||''; $('#trFee').value=x?.fee||''; $('#trDate').value=x?.d||today(); updateRatePreview();
  }else{
    fillNormalFields(x?.c||'');
    $('#txName').value=x?.n||''; $('#txAmount').value=x?.a||''; $('#txDate').value=x?.d||today(); $('#txAccount').value=x?.accountId||accounts[0].id; $('#txNote').value=x?.note||'';
  }
  $('#txModal').classList.add('open');
}
function closeModal(){$('#txModal').classList.remove('open');editingId=null}
function saveCurrentTx(){
  if(txType==='transfer'){
    const fromAccount=$('#trFrom').value,toAccount=$('#trTo').value,fromAmount=Math.abs(Number($('#trFromAmount').value)),toAmount=Math.abs(Number($('#trToAmount').value)),fee=Math.abs(Number($('#trFee').value||0)),d=$('#trDate').value,n=$('#trName').value.trim()||'Vlastný prevod';
    if(fromAccount===toAccount)return alert('Vyber dva rozdielne účty.');
    if(!fromAmount||!toAmount||!d)return alert('Zadaj odoslanú sumu, prijatú sumu a dátum.');
    const obj={id:editingId||Date.now(),kind:'transfer',n,d,fromAccount,toAccount,fromAmount,toAmount,fee,note:''};
    if(editingId)tx[tx.findIndex(x=>x.id===editingId)]=obj; else tx.push(obj);
  }else{
    const n=$('#txName').value.trim(),a=Math.abs(Number($('#txAmount').value)),d=$('#txDate').value,accountId=$('#txAccount').value,c=$('#txCategory').value,note=$('#txNote').value.trim(),currency=account(accountId)?.currency||'EUR';
    if(!n||!a||!d)return alert('Vyplň názov, sumu a dátum.');
    const obj={id:editingId||Date.now(),kind:txType,n,a,d,c,accountId,currency,note};
    if(editingId)tx[tx.findIndex(x=>x.id===editingId)]=obj; else tx.push(obj);
  }
  saveTx();closeModal();render();
}
window.editTx=id=>openModal(id);
window.removeTx=id=>{if(confirm('Vymazať túto transakciu?')){tx=tx.filter(x=>x.id!==id);saveTx();render()}};

window.editAccount=id=>{
  editingAccountId=id; const a=account(id); $('#accountModalTitle').textContent=`${a.name} · ${a.currency}`; $('#accountBalance').value=a.balance??''; $('#accountModal').classList.add('open');
}
function closeAccountModal(){$('#accountModal').classList.remove('open');editingAccountId=null}
function saveAccountBalance(){
  const a=account(editingAccountId),v=$('#accountBalance').value;
  if(!a)return;
  a.balance=v===''?null:Number(v); saveAccounts(); closeAccountModal(); render();
}
function guruReply(q){
  const s=q.toLowerCase(),t=totalsEur(),rb=accountFlow('rb_cz'),sk=accountFlow('slsp_sk'),transfers=tx.filter(x=>thisMonth(x)&&x.kind==='transfer');
  if(/slsp|sporiteľ/.test(s))return `Na SLSP evidujem tento mesiac príjem ${money(sk.income,'EUR')} a výdavky ${money(sk.expense,'EUR')}. Vlastné prevody sa do príjmu nerátajú.`;
  if(/raiff|česk|czk|mzda/.test(s))return `Na Raiffeisenbank evidujem tento mesiac príjem ${money(rb.income,'CZK')} a výdavky ${money(rb.expense,'CZK')}. Očakávaná mzda je približne 45 000 Kč, ale ako transakciu počítam iba to, čo zadáš.`;
  if(/prevod|kurz/.test(s))return transfers.length?`Tento mesiac evidujem ${transfers.length} vlastný/é prevod/y. Pri prevode CZK → EUR používam skutočne odoslanú a prijatú sumu, takže vieme vypočítať efektívny kurz.`:'Tento mesiac zatiaľ nemáš uložený vlastný prevod.';
  if(/spolu|cash|výdav|príjem/.test(s))return t.valid?`Po prepočte referenčným kurzom: príjem ${eur(t.i)}, výdavky ${eur(t.e)}, cash-flow ${eur(t.flow)}.`:'Na spoločný prepočet EUR ešte nastav referenčný kurz CZK / EUR v Profile.';
  return 'Môžeš sa ma pýtať na Raiffeisenbank, SLSP, vlastné prevody, kurz alebo mesačný cash-flow.';
}
function sendGuru(){const inp=$('#guruInput'),q=inp.value.trim();if(!q)return;$('#chat').innerHTML+=`<div class="bubble me">${esc(q)}</div><div class="bubble">${esc(guruReply(q))}</div>`;inp.value=''}
function exportData(){
  const payload={version:'2.1',accounts,fxRateCZKPerEUR:fx,transactions:tx,investments,expectedSalaryCZK:45000};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='rozpocetguru-2.1-backup.json';a.click();URL.revokeObjectURL(a.href);
}
function importData(file){
  const r=new FileReader(); r.onload=()=>{try{const d=JSON.parse(r.result);if(!Array.isArray(d.transactions))throw new Error();tx=d.transactions;if(Array.isArray(d.accounts))accounts=d.accounts;if(d.fxRateCZKPerEUR)fx=Number(d.fxRateCZKPerEUR);if(Array.isArray(d.investments))investments=d.investments;saveTx();saveAccounts();saveInvestments();if(fx)localStorage.setItem(FX_KEY,String(fx));render();alert('Dáta boli importované.')}catch{alert('Neplatný záložný súbor.')}};r.readAsText(file)
}

$$('[data-page]').forEach(b=>b.addEventListener('click',()=>nav(b.dataset.page)));
$('#addTxTop').onclick=$('#addTxPage').onclick=()=>openModal();
$('#closeModal').onclick=$('#cancelModal').onclick=closeModal;
$('#saveTx').onclick=saveCurrentTx;
$$('#typeSwitch button').forEach(b=>b.onclick=()=>setType(b.dataset.type));
$('#trFrom').onchange=$('#trTo').onchange=updateTransferLabels;
$('#trFromAmount').oninput=$('#trToAmount').oninput=updateRatePreview;
$('#search').oninput=render; $('#typeFilter').onchange=render; $('#accountFilter').onchange=render; $('#periodSelect').onchange=drawChart;
$('#sendGuru').onclick=sendGuru; $('#guruInput').addEventListener('keydown',e=>{if(e.key==='Enter')sendGuru()});
$('#saveFx').onclick=()=>{const v=Number($('#fxRate').value);if(!v||v<=0)return alert('Zadaj platný kurz CZK / EUR.');fx=v;localStorage.setItem(FX_KEY,String(v));render()};
$('#closeAccountModal').onclick=$('#cancelAccount').onclick=closeAccountModal; $('#saveAccount').onclick=saveAccountBalance;
$('#exportBtn').onclick=exportData; $('#importInput').onchange=e=>e.target.files[0]&&importData(e.target.files[0]);
$('#resetBtn').onclick=()=>{if(confirm('Naozaj vymazať všetky lokálne transakcie? Zostatky účtov ostanú zachované.')){tx=[];saveTx();render()}};

migrate(); fillNormalFields(); fillTransferAccounts(); render();
