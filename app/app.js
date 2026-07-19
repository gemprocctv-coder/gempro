const SUPABASE_URL = "https://menjgkzlseesslabhtli.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_fG2qEgVgAKiTLwaUaaNNKQ_fQ30HDeY";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const GOOGLE_REVIEW_URL = "https://g.page/r/CUlTODw6By7OEAE/review";

const S = { view:"home", items:[], jobs:[], customers:[], techs:[], issues:[], expenses:[], user:null,
  loaded:false, q:"", period:"week", job:null, busy:false, parts:[], photos:[],
  issueCart:[], receipt:"", bill:[], billCust:null, lastInvoice:null };
const $ = id => document.getElementById(id);
const money = n => "\u20B9" + Number(n||0).toLocaleString("en-IN",{maximumFractionDigits:2});
const esc = s => String(s==null?"":s).replace(/[<>&"]/g, c => ({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;"}[c]));
const isAdmin = () => S.user && S.user.role === "ADMIN";
const STATUSES = ["Pending","In Progress","Done"];
const EXP_CATS = ["Petrol / Fuel","Travel / Auto","Food","Tools Purchase","Mobile Recharge","Courier","Parking","Other"];
const PAY_MODES = ["Cash","GPay","PhonePe","Paytm","Card","Company Account"];

function saveUser(u){ try{ localStorage.setItem("gp_user", JSON.stringify(u)); }catch(e){} }
function loadUser(){ try{ return JSON.parse(localStorage.getItem("gp_user")||"null"); }catch(e){ return null; } }
function logout(){ try{ localStorage.removeItem("gp_user"); }catch(e){} S.user=null; S.view="home"; render(); }
function toast(m){ const t=document.createElement("div"); t.textContent=m;
  t.style.cssText="position:fixed;bottom:96px;left:50%;transform:translateX(-50%);background:#222;color:#fff;padding:11px 20px;border-radius:24px;font-size:14px;font-weight:600;z-index:999;border:1px solid #333;max-width:88%;text-align:center";
  document.body.appendChild(t); setTimeout(()=>t.remove(),2600); }

const ADMIN_TILES = [
  ["\uD83D\uDCDE","Service","#f59e0b","Jobs \u00B7 Calls","jobs"],
  ["\uD83E\uDDFE","Billing","#e11d2a","Create invoice","billing"],
  ["\uD83D\uDE9A","Issue Stock","#22c55e","To technician","issue"],
  ["\uD83D\uDCB8","Expenses","#f43f5e","All staff","expenses"],
  ["\uD83D\uDCCA","Reports","#ec4899","Service \u00B7 Expense","report"],
  ["\uD83D\uDCCB","Issue Log","#14b8a6","Delivery record","issuelog"]
];
const TECH_TILES = [
  ["\uD83D\uDCDE","My Jobs","#f59e0b","Service calls","jobs"],
  ["\u2795","New Call","#22c55e","Log complaint","newjob"],
  ["\uD83E\uDDFE","Billing","#e11d2a","Bill on site","billing"],
  ["\uD83D\uDCB8","My Expenses","#f43f5e","Add \u00B7 Report","expenses"],
  ["\uD83D\uDE9A","My Stock","#14b8a6","Items with me","mystock"],
  ["\uD83D\uDCCA","My Report","#ec4899","Work \u00B7 Expense","report"]
];

async function doLogin(){
  const mob = ($("lmob").value||"").trim(), pin = ($("lpin").value||"").trim(), msg = $("lmsg");
  if(!mob || !pin){ msg.textContent = "Enter mobile number and PIN"; return; }
  msg.textContent = "Checking\u2026";
  try{
    const { data, error } = await sb.from("employees").select("*").eq("mobile", mob).limit(1);
    if(error) throw error;
    if(!data || !data.length){ msg.textContent = "Mobile number not found"; return; }
    const emp = data[0];
    if(String(emp.pin||"1234") !== pin){ msg.textContent = "Wrong PIN"; return; }
    S.user = { id:emp.id, name:emp.full_name||"User", mobile:emp.mobile, role:(emp.role||"TECHNICIAN").toUpperCase() };
    saveUser(S.user); S.view="home"; loadAll();
  }catch(e){ console.error(e); msg.textContent = "Could not sign in. Try again."; }
}

function viewLogin(){
  return `<div style="padding:44px 24px 24px;text-align:center">
      <div style="width:72px;height:72px;background:#e11d2a;border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:36px;margin:0 auto 18px">\uD83D\uDCF7</div>
      <div style="color:#e11d2a;font-weight:900;font-size:21px">GEM PRO FIELD</div>
      <div style="color:#888;font-size:12px;font-weight:600;margin-top:3px">GEMPRO Technologies \u00B7 Salem</div></div>
    <div style="padding:0 24px">
      <div class="sec" style="margin-left:0">Sign in</div>
      <input class="inp" id="lmob" type="tel" inputmode="numeric" placeholder="Mobile number">
      <input class="inp" id="lpin" type="password" inputmode="numeric" maxlength="6" placeholder="PIN">
      <div id="lmsg" style="color:#f59e0b;font-size:13px;min-height:20px;margin-bottom:6px"></div>
      <button class="btn" onclick="doLogin()">Sign in</button>
      <div style="color:#555;font-size:12px;text-align:center;margin-top:22px">Ask the office if you don't know your PIN</div></div>`;
}

async function loadAll(){
  try{
    const [it, jb, cu, em, mi, ex] = await Promise.all([
      sb.from("items").select("*").order("name"),
      sb.from("service_calls").select("*").order("created_at",{ascending:false}).limit(300),
      sb.from("customers").select("*").order("name"),
      sb.from("employees").select("*").order("full_name"),
      sb.from("material_issues").select("*").order("created_at",{ascending:false}).limit(200),
      sb.from("tech_expenses").select("*").order("created_at",{ascending:false}).limit(300)
    ]);
    S.items = (it.data||[]).filter(x=>!x.archived);
    S.jobs = jb.data||[]; S.customers = cu.data||[];
    S.techs = em.data||[]; S.issues = mi.data||[]; S.expenses = ex.data||[];
  }catch(e){ console.error("load:",e); }
  S.loaded = true; render();
}

const isDone = j => ["done","completed","closed"].includes((j.status||"").toLowerCase());
const isOngoing = j => ["in progress","ongoing","started"].includes((j.status||"").toLowerCase());
const jobColor = j => isDone(j)?"#22c55e":isOngoing(j)?"#3b82f6":"#f59e0b";
function myJobs(){
  if(isAdmin()) return S.jobs;
  const n = (S.user&&S.user.name||"").toLowerCase();
  return S.jobs.filter(j => (j.technician_name||"").toLowerCase() === n);
}
function custOf(j){
  const n=(j.customer_name||"").toLowerCase();
  return S.customers.find(c=>(c.name||"").toLowerCase()===n);
}
function priceFor(item, cust){
  const cat = (cust && (cust.sales_category||cust.price_list) || "RETAIL").toUpperCase();
  if(cat==="DEALER") return Number(item.dealer_price||item.retail_price||0);
  if(cat==="WHOLESALE") return Number(item.wholesale_price||item.retail_price||0);
  return Number(item.retail_price||item.sale_price||0);
}
function myStock(){
  const n=(S.user&&S.user.name||"").toLowerCase();
  const held={};
  S.issues.filter(i=>(i.technician_name||"").toLowerCase()===n).forEach(iss=>{
    (iss.items||[]).forEach(it=>{ held[it.name]=(held[it.name]||0)+Number(it.qty||0); });
  });
  S.jobs.filter(j=>(j.technician_name||"").toLowerCase()===n).forEach(j=>{
    (j.parts_used||[]).forEach(p=>{ held[p.name]=(held[p.name]||0)-Number(p.qty||0); });
  });
  return Object.entries(held).filter(([,q])=>q>0).map(([name,qty])=>({name,qty}));
}

function myExpenses(){
  if(isAdmin()) return S.expenses;
  const n=(S.user&&S.user.name||"").toLowerCase();
  return S.expenses.filter(e=>(e.technician_name||"").toLowerCase()===n);
}

async function addReceipt(input){
  const f=(input.files||[])[0]; if(!f) return;
  toast("Uploading receipt\u2026");
  try{
    const path="rcpt_"+Date.now()+"_"+Math.random().toString(36).slice(2,7)+".jpg";
    const {error}=await sb.storage.from("jobphotos").upload(path,f,{upsert:true});
    if(error) throw error;
    const {data}=sb.storage.from("jobphotos").getPublicUrl(path);
    S.receipt=data.publicUrl; toast("Receipt attached"); render();
  }catch(e){ console.error(e); toast("Upload failed"); }
  input.value="";
}

async function saveExpense(){
  if(S.busy) return;
  const amt=parseFloat($("eamt").value||0);
  if(!amt||amt<=0){ toast("Enter amount"); return; }
  const jobSel=$("ejob").value;
  const j=jobSel?S.jobs.find(x=>String(x.id)===jobSel):null;
  S.busy=true;
  try{
    const now=new Date();
    const row={ id:crypto.randomUUID(), technician_name:S.user.name, technician_id:S.user.id,
      expense_date:now.toISOString().slice(0,10),
      expense_time:now.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}),
      category:$("ecat").value, amount:amt, payment_mode:$("emode").value,
      paid_to:($("epaid").value||"").trim(), comment:($("ecom").value||"").trim(),
      receipt_url:S.receipt||"",
      job_id:j?j.id:null, job_no:j?j.job_no:"", customer_name:j?j.customer_name:"",
      site_address:j?(j.address||""):"", status:"Pending", created_at:now.toISOString() };
    const {error}=await sb.from("tech_expenses").insert([row]);
    if(error) throw error;
    S.expenses.unshift(row); S.receipt="";
    toast("Expense recorded \u00B7 "+money(amt));
    go("expenses");
  }catch(e){ console.error(e); toast("Could not save expense"); }
  S.busy=false;
}

function viewAddExpense(){
  const jobOpts=myJobs().slice(0,60).map(j=>`<option value="${esc(j.id)}">${esc(j.job_no||"")} \u00B7 ${esc(j.customer_name||"")}</option>`).join("");
  return `<div class="hd"><span onclick="go('expenses')" style="color:#888;font-size:22px;padding-right:4px">\u2039</span>
      <span class="ic" style="background:#f59e0b22">\uD83D\uDCB8</span>
      <div style="font-weight:800;font-size:17px">Add Expense</div></div>
    <div style="padding:0 16px">
      <div class="lbl">Category</div>
      <select class="inp" id="ecat">${EXP_CATS.map(c=>`<option>${c}</option>`).join("")}</select>
      <div class="lbl">Amount (\u20B9) *</div>
      <input class="inp" id="eamt" type="number" inputmode="decimal" placeholder="0">
      <div class="lbl">Payment mode</div>
      <select class="inp" id="emode">${PAY_MODES.map(m=>`<option>${m}</option>`).join("")}</select>
      <div class="lbl">Paid to</div>
      <input class="inp" id="epaid" placeholder="Shop / person name">
      <div class="lbl">For which job / site</div>
      <select class="inp" id="ejob"><option value="">-- general, not job related --</option>${jobOpts}</select>
      <div class="lbl">Explanation *</div>
      <textarea class="inp" id="ecom" rows="2" placeholder="Why was this spent?"></textarea>
      <div class="lbl">Receipt photo</div>
      <label class="btn btn2" style="margin-bottom:10px">\uD83D\uDCF7 Attach receipt
        <input type="file" accept="image/*" capture="environment" style="display:none" onchange="addReceipt(this)"></label>
      ${S.receipt?`<img src="${esc(S.receipt)}" style="width:90px;height:90px;object-fit:cover;border-radius:9px;margin-bottom:12px;border:1px solid #2a2a2a">`:""}
      <button class="btn" onclick="saveExpense()">Save expense</button>
      <div style="height:24px"></div></div>`;
}

function expPeriod(){
  const now=new Date();
  return S.period==="today" ? new Date(now.getFullYear(),now.getMonth(),now.getDate())
    : S.period==="week" ? new Date(now.getTime()-7*864e5) : new Date(now.getFullYear(),now.getMonth(),1);
}
function expList(){ const c=expPeriod(); return myExpenses().filter(e=>new Date(e.created_at||e.expense_date||0)>=c); }
function expTotal(){ return expList().reduce((s,e)=>s+Number(e.amount||0),0); }

function viewExpenses(){
  const list=expList();
  const total=expTotal();
  const tab=(k,l)=>`<button onclick="S.period='${k}';render()" style="flex:1;background:${S.period===k?'#e11d2a':'#1a1a1a'};color:${S.period===k?'#fff':'#888'};border:none;border-radius:9px;padding:9px;font-size:13px;font-weight:700;cursor:pointer">${l}</button>`;
  const rows=list.length?list.map(e=>`<div class="card">
      <div style="display:flex;justify-content:space-between;gap:10px">
        <div style="min-width:0"><div style="font-size:14px;font-weight:700">${esc(e.category||"")}</div>
        <div style="color:#888;font-size:12px;margin-top:2px">${esc(e.expense_date||"")} ${esc(e.expense_time||"")} \u00B7 ${esc(e.payment_mode||"")}</div></div>
        <b style="color:#f59e0b;white-space:nowrap">${money(e.amount)}</b></div>
      ${e.job_no?`<div style="color:#3b82f6;font-size:12px;margin-top:6px">\uD83D\uDCCD ${esc(e.job_no)} \u00B7 ${esc(e.customer_name||"")}</div>`:""}
      ${e.comment?`<div style="color:#aaa;font-size:12px;margin-top:5px">${esc(e.comment)}</div>`:""}
      ${isAdmin()&&e.technician_name?`<div style="color:#777;font-size:12px;margin-top:5px">\uD83D\uDC77 ${esc(e.technician_name)}</div>`:""}
      ${e.receipt_url?`<a href="${esc(e.receipt_url)}" target="_blank" style="color:#22c55e;font-size:12px;text-decoration:none;display:inline-block;margin-top:6px">\uD83D\uDCC4 View receipt</a>`:""}
    </div>`).join("")
    :`<div class="empty"><div class="e">\uD83D\uDCB8</div><div style="margin-top:12px;font-size:14px">No expenses recorded</div></div>`;
  return `<div class="hd"><span class="ic" style="background:#f59e0b22">\uD83D\uDCB8</span>
      <div style="font-weight:800;font-size:17px">${isAdmin()?"All Expenses":"My Expenses"}</div>
      <span onclick="go('addexp')" style="margin-left:auto;background:#22c55e;color:#000;font-size:13px;font-weight:800;padding:8px 14px;border-radius:9px">\uFF0B Add</span></div>
    <div style="display:flex;gap:8px;padding:0 16px 14px">${tab("today","Today")}${tab("week","Week")}${tab("month","Month")}</div>
    <div style="padding:0 16px 14px"><div class="stat" style="text-align:center">
      <div class="l">Total ${S.period}</div><div class="v" style="color:#f59e0b">${money(total)}</div></div></div>
    ${list.length?`<div style="padding:0 16px 14px">
      <button class="btn" onclick="printExpenseReport()" style="margin-bottom:8px">\uD83D\uDDA8 Report PDF</button>
      <button class="btn btn2" onclick="sendExpenseReport()">\uD83D\uDCAC Send on WhatsApp</button></div>`:""}
    <div class="sec">${list.length} expense${list.length===1?"":"s"}</div>${rows}<div style="height:20px"></div>`;
}

function sendExpenseReport(){
  const list=expList();
  if(!list.length){ toast("No expenses to report"); return; }
  const total=expTotal();
  const label=S.period==="today"?"Today":S.period==="week"?"This Week":"This Month";
  let t="*EXPENSE REPORT*\n";
  t+="GEMPRO TECHNOLOGIES, Salem\n";
  t+="GSTIN: 33BQAPT7336P1Z9\n";
  t+="Technician: "+(S.user.name||"")+"\n";
  t+="Period: "+label+"\n";
  t+="Generated: "+new Date().toLocaleString("en-IN")+"\n";
  t+="--------------------------------\n";
  list.forEach((e,i)=>{
    t+=(i+1)+". "+(e.expense_date||"")+" "+(e.expense_time||"")+"\n";
    t+="   "+(e.category||"")+" \u2014 \u20B9"+Number(e.amount||0)+" ("+(e.payment_mode||"")+")\n";
    if(e.paid_to) t+="   Paid to: "+e.paid_to+"\n";
    if(e.job_no) t+="   Site: "+e.job_no+" - "+(e.customer_name||"")+"\n";
    if(e.comment) t+="   Reason: "+e.comment+"\n";
    if(e.receipt_url) t+="   Receipt: "+e.receipt_url+"\n";
    t+="\n";
  });
  t+="--------------------------------\n";
  t+="*TOTAL: \u20B9"+total.toLocaleString("en-IN")+"*\n";
  t+="Entries: "+list.length+"\n";
  window.open("https://wa.me/919894522502?text="+encodeURIComponent(t),"_blank");
}
function printExpenseReport(){
  const list=expList();
  if(!list.length){ toast("No expenses to report"); return; }
  const total=expTotal();
  const label=S.period==="today"?"Today":S.period==="week"?"This Week":"This Month";
  const rows=list.map((e,i)=>`<tr><td>${i+1}</td><td>${esc(e.expense_date||"")}<br><span style="color:#666">${esc(e.expense_time||"")}</span></td>
    <td>${esc(e.category||"")}</td><td>${esc(e.job_no||"-")}<br><span style="color:#666">${esc(e.customer_name||"")}</span></td>
    <td>${esc(e.comment||"")}</td><td>${esc(e.payment_mode||"")}</td>
    <td style="text-align:right">${Number(e.amount||0).toFixed(2)}</td></tr>`).join("");
  const w=window.open("","_blank");
  w.document.write(`<html><head><title>Expense Report</title><style>
    body{font-family:Arial,sans-serif;padding:20px;color:#000;font-size:12px}
    h2{color:#e11d2a;margin:0}table{width:100%;border-collapse:collapse;margin-top:14px}
    th,td{border:1px solid #ccc;padding:6px;font-size:11px;vertical-align:top}th{background:#f4f4f4;text-align:left}
    .tot{text-align:right;margin-top:12px;font-size:15px}
    </style></head><body>
    <h2>GEMPRO TECHNOLOGIES</h2>
    <div>Salem, Tamil Nadu &nbsp;|&nbsp; GSTIN: 33BQAPT7336P1Z9</div>
    <hr><h3 style="margin:8px 0">TECHNICIAN EXPENSE REPORT</h3>
    <div><b>Technician:</b> ${esc(isAdmin()?"All staff":S.user.name)} &nbsp;&nbsp;
    <b>Period:</b> ${label} &nbsp;&nbsp; <b>Generated:</b> ${new Date().toLocaleString("en-IN")}</div>
    <table><thead><tr><th>#</th><th>Date / Time</th><th>Category</th><th>Site / Job</th><th>Explanation</th><th>Mode</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="tot"><b>TOTAL: \u20B9${total.toFixed(2)}</b> &nbsp; (${list.length} entries)</div>
    <p style="margin-top:26px;font-size:11px">Submitted by: ${esc(S.user.name)} \u00B7 ${new Date().toLocaleString("en-IN")}</p>
    </body></html>`);
  w.document.close(); setTimeout(()=>w.print(),400);
}

function billCustSearch(q){
  const box=$("bcresults"); if(!box) return;
  q=(q||"").toLowerCase().trim();
  if(q.length<2){ box.innerHTML=""; return; }
  const hits=S.customers.filter(c=>(c.name||"").toLowerCase().includes(q)||(c.mobile||"").includes(q)).slice(0,8);
  box.innerHTML = hits.length ? hits.map(c=>`<div onclick="pickBillCust('${esc(c.id)}')" style="padding:11px 12px;border-bottom:1px solid #222;cursor:pointer">
      <div style="font-size:14px;font-weight:700">${esc(c.name)}</div>
      <div style="color:#888;font-size:12px">${esc(c.mobile||"")} \u00B7 ${esc(c.sales_category||"RETAIL")}</div></div>`).join("")
    : `<div style="padding:11px;color:#666;font-size:13px">No customer found</div>`;
}
function pickBillCust(id){
  S.billCust = S.customers.find(x=>String(x.id)===String(id)) || null;
  S.bill = S.bill.map(b=>{ const it=S.items.find(i=>String(i.id)===String(b.id));
    return it?{...b, rate:priceFor(it,S.billCust)}:b; });
  render();
}
function itemSearch(q){
  const box=$("iresults"); if(!box) return;
  q=(q||"").toLowerCase().trim();
  if(q.length<2){ box.innerHTML=""; return; }
  const hits=S.items.filter(i=>(i.name||"").toLowerCase().includes(q)||(i.model_no||"").toLowerCase().includes(q)||(i.code||"").toLowerCase().includes(q)).slice(0,10);
  box.innerHTML = hits.length ? hits.map(i=>{
    const r=priceFor(i,S.billCust);
    return `<div onclick="addBillItem('${esc(i.id)}')" style="padding:11px 12px;border-bottom:1px solid #222;cursor:pointer;display:flex;justify-content:space-between;gap:10px">
      <div style="min-width:0"><div style="font-size:14px;font-weight:700">${esc(i.name)}</div>
      <div style="color:#888;font-size:12px">${esc(i.model_no||i.code||"")} \u00B7 stock ${Number(i.stock_qty||0)}</div></div>
      <b style="color:#22c55e;white-space:nowrap">${money(r)}</b></div>`;}).join("")
    : `<div style="padding:11px;color:#666;font-size:13px">No item found</div>`;
}
function addBillItem(id){
  const it=S.items.find(x=>String(x.id)===String(id)); if(!it) return;
  const ex=S.bill.find(b=>String(b.id)===String(id));
  if(ex) ex.qty+=1;
  else S.bill.push({id:it.id,name:it.name,qty:1,rate:priceFor(it,S.billCust),gst:Number(it.gst_rate||18)});
  $("isearch").value=""; $("iresults").innerHTML="";
  render();
}
function billQty(i,d){ S.bill[i].qty=Math.max(1,S.bill[i].qty+d); render(); }
function delBillItem(i){ S.bill.splice(i,1); render(); }
const billSub = () => S.bill.reduce((s,b)=>s+b.qty*b.rate,0);
const billGst = () => S.bill.reduce((s,b)=>s+(b.qty*b.rate*(b.gst||18)/100),0);
const billTotal = () => billSub()+billGst();

async function saveInvoice(paid){
  if(S.busy) return;
  if(!S.billCust){ toast("Select a customer"); return; }
  if(!S.bill.length){ toast("Add at least one item"); return; }
  S.busy=true;
  try{
    const invNo="INV"+Date.now().toString().slice(-8);
    const row={ id:crypto.randomUUID(), invoice_no:invNo, invoice_date:new Date().toISOString().slice(0,10),
      customer_id:S.billCust.id, customer_name:S.billCust.name, customer_mobile:S.billCust.mobile||"",
      customer_gstin:S.billCust.gstin||"", price_list:(S.billCust.sales_category||"RETAIL"),
      items:S.bill, subtotal:billSub(), gst_amount:billGst(), total:billTotal(),
      payment_status:paid?"Paid":"Unpaid", payment_mode:paid?$("bmode").value:"",
      created_by:S.user.name, created_at:new Date().toISOString() };
    const {error}=await sb.from("invoices").insert([row]);
    if(error) throw error;
    S.lastInvoice=row; S.bill=[]; S.billCust=null;
    toast("Invoice "+invNo+" created");
    go("invdone");
  }catch(e){ console.error(e); toast("Could not save invoice"); }
  S.busy=false;
}

function viewBilling(){
  const rows=S.bill.map((b,i)=>`<div class="card" style="margin:0 0 8px">
      <div style="display:flex;justify-content:space-between;gap:10px">
        <div style="min-width:0"><div style="font-size:14px;font-weight:700">${esc(b.name)}</div>
        <div style="color:#888;font-size:12px">${money(b.rate)} \u00D7 ${b.qty} + ${b.gst||18}% GST</div></div>
        <b style="color:#22c55e;white-space:nowrap">${money(b.qty*b.rate)}</b></div>
      <div style="display:flex;gap:8px;align-items:center;margin-top:8px">
        <button onclick="billQty(${i},-1)" style="background:#222;color:#fff;border:none;width:34px;height:34px;border-radius:8px;font-size:18px">\u2212</button>
        <span style="min-width:30px;text-align:center;font-weight:700">${b.qty}</span>
        <button onclick="billQty(${i},1)" style="background:#222;color:#fff;border:none;width:34px;height:34px;border-radius:8px;font-size:18px">+</button>
        <span onclick="delBillItem(${i})" style="margin-left:auto;color:#e11d2a;font-size:13px;font-weight:700">Remove</span></div></div>`).join("");
  return `<div class="hd"><span class="ic" style="background:#e11d2a22">\uD83E\uDDFE</span>
      <div style="font-weight:800;font-size:17px">Create Invoice</div></div>
    <div style="padding:0 16px">
      <div class="lbl">Customer *</div>
      ${S.billCust?`<div class="card" style="margin:0 0 10px;display:flex;justify-content:space-between;align-items:center">
        <div><div style="font-size:14px;font-weight:700">${esc(S.billCust.name)}</div>
        <div style="color:#888;font-size:12px">${esc(S.billCust.mobile||"")} \u00B7 ${esc(S.billCust.sales_category||"RETAIL")} price</div></div>
        <span onclick="S.billCust=null;render()" style="color:#e11d2a;font-size:13px;font-weight:700">Change</span></div>`
        :`<input class="inp" id="bcsearch" placeholder="\uD83D\uDD0D Search customer name or mobile" oninput="billCustSearch(this.value)" style="margin-bottom:0">
          <div id="bcresults" style="background:#161616;border-radius:0 0 10px 10px;max-height:200px;overflow:auto;margin-bottom:10px"></div>`}

      <div class="lbl">Add items</div>
      <input class="inp" id="isearch" placeholder="\uD83D\uDD0D Type product name, model or code" oninput="itemSearch(this.value)" style="margin-bottom:0">
      <div id="iresults" style="background:#161616;border-radius:0 0 10px 10px;max-height:250px;overflow:auto;margin-bottom:12px"></div>

      ${rows||`<div style="color:#555;font-size:13px;margin-bottom:12px">No items added yet</div>`}

      ${S.bill.length?`<div class="card" style="margin:0 0 12px">
        <div class="kv"><span>Subtotal</span><b>${money(billSub())}</b></div>
        <div class="kv"><span>GST</span><b>${money(billGst())}</b></div>
        <div class="kv" style="border-top:1px solid #2a2a2a;margin-top:6px;padding-top:9px">
          <span style="font-weight:700;color:#eee">TOTAL</span><b style="color:#22c55e;font-size:18px">${money(billTotal())}</b></div></div>
        <div class="lbl">Payment mode</div>
        <select class="inp" id="bmode">${PAY_MODES.map(m=>`<option>${m}</option>`).join("")}</select>
        <button class="btn" onclick="saveInvoice(true)" style="margin-bottom:8px">\u2714 Save \u00B7 Paid</button>
        <button class="btn btn2" onclick="saveInvoice(false)">\u2714 Save \u00B7 Credit / Unpaid</button>`:""}
      <div style="height:24px"></div></div>`;
}

function waLink(mob, text){
  const n = String(mob||"").replace(/\D/g,"").slice(-10);
  return "https://wa.me/91" + n + "?text=" + encodeURIComponent(text);
}

function invoiceText(v){
  let t="*TAX INVOICE*\n";
  t+="GEMPRO TECHNOLOGIES, Salem\n";
  t+="GSTIN: 33BQAPT7336P1Z9\n";
  t+="Ph: 9894522502\n";
  t+="--------------------------------\n";
  t+="Invoice: "+v.invoice_no+"\n";
  t+="Date: "+new Date(v.created_at).toLocaleDateString("en-IN")+"\n";
  t+="Customer: "+v.customer_name+"\n";
  if(v.customer_gstin) t+="GSTIN: "+v.customer_gstin+"\n";
  t+="--------------------------------\n";
  (v.items||[]).forEach((b,i)=>{
    t+=(i+1)+". "+b.name+"\n";
    t+="   "+b.qty+" x \u20B9"+b.rate+" = \u20B9"+(b.qty*b.rate)+"\n";
  });
  t+="--------------------------------\n";
  t+="Subtotal: \u20B9"+v.subtotal.toFixed(2)+"\n";
  t+="GST: \u20B9"+v.gst_amount.toFixed(2)+"\n";
  t+="*TOTAL: \u20B9"+v.total.toFixed(2)+"*\n";
  t+="Status: "+v.payment_status+(v.payment_mode?" ("+v.payment_mode+")":"")+"\n";
  t+="\nThank you for your business!";
  return t;
}

function viewInvDone(){
  const v=S.lastInvoice; if(!v) return viewBilling();
  return `<div style="padding:40px 24px;text-align:center">
      <div style="font-size:56px">\u2705</div>
      <div style="font-size:20px;font-weight:800;margin-top:10px">Invoice Created</div>
      <div style="color:#888;font-size:13px;margin-top:4px">${esc(v.invoice_no)} \u00B7 ${esc(v.customer_name)}</div>
      <div style="color:#22c55e;font-size:26px;font-weight:800;margin-top:12px">${money(v.total)}</div>
      <div style="color:#888;font-size:12px">${esc(v.payment_status)}</div></div>
    <div style="padding:0 16px">
      ${v.customer_mobile?`<a class="btn" style="text-decoration:none;margin-bottom:10px;background:#22c55e" href="${esc(waLink(v.customer_mobile,invoiceText(v)))}" target="_blank">\uD83D\uDCAC Send invoice on WhatsApp</a>`:""}
      <button class="btn btn2" style="margin-bottom:10px" onclick="printInvoice()">\uD83D\uDDA8 Print / Save PDF</button>
      <button class="btn btn2" onclick="go('billing')">New invoice</button>
      <div style="height:24px"></div></div>`;
}

function printInvoice(){
  const v=S.lastInvoice; if(!v) return;
  const rows=(v.items||[]).map((b,i)=>`<tr><td>${i+1}</td><td>${esc(b.name)}</td><td style="text-align:center">${b.qty}</td>
    <td style="text-align:right">${Number(b.rate).toFixed(2)}</td><td style="text-align:right">${(b.qty*b.rate).toFixed(2)}</td></tr>`).join("");
  const w=window.open("","_blank");
  w.document.write(`<html><head><title>${v.invoice_no}</title><style>
    body{font-family:Arial,sans-serif;padding:20px;color:#000;font-size:13px}
    h2{color:#e11d2a;margin:0}table{width:100%;border-collapse:collapse;margin-top:14px}
    th,td{border:1px solid #ccc;padding:7px;font-size:12px}th{background:#f4f4f4;text-align:left}
    .tot{text-align:right;margin-top:12px;font-size:14px}.tot b{font-size:17px;color:#e11d2a}
    </style></head><body>
    <h2>GEMPRO TECHNOLOGIES</h2>
    <div>Salem, Tamil Nadu &nbsp;|&nbsp; GSTIN: 33BQAPT7336P1Z9 &nbsp;|&nbsp; Ph: 9894522502</div>
    <hr><h3 style="margin:8px 0">TAX INVOICE</h3>
    <div><b>Invoice:</b> ${esc(v.invoice_no)} &nbsp;&nbsp; <b>Date:</b> ${new Date(v.created_at).toLocaleDateString("en-IN")}</div>
    <div><b>Customer:</b> ${esc(v.customer_name)} ${v.customer_mobile?" \u00B7 "+esc(v.customer_mobile):""}</div>
    ${v.customer_gstin?`<div><b>Customer GSTIN:</b> ${esc(v.customer_gstin)}</div>`:""}
    <table><thead><tr><th>#</th><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="tot">Subtotal: \u20B9${Number(v.subtotal).toFixed(2)}<br>
    GST: \u20B9${Number(v.gst_amount).toFixed(2)}<br>
    <b>TOTAL: \u20B9${Number(v.total).toFixed(2)}</b><br>
    Status: ${esc(v.payment_status)} ${v.payment_mode?"("+esc(v.payment_mode)+")":""}</div>
    <p style="margin-top:26px;font-size:12px">Thank you for your business!<br>Prepared by: ${esc(v.created_by||"")}</p>
    </body></html>`);
  w.document.close(); setTimeout(()=>w.print(),400);
}
async function setStatus(id, status){
  if(status==="Done"){ S.job = S.jobs.find(x=>String(x.id)===String(id)); S.parts=[]; S.photos=[]; go("complete"); return; }
  if(S.busy) return; S.busy=true;
  try{
    const { error } = await sb.from("service_calls").update({status}).eq("id", id);
    if(error) throw error;
    const j = S.jobs.find(x=>String(x.id)===String(id));
    if(j) j.status = status;
    if(S.job && String(S.job.id)===String(id)) S.job.status = status;
    toast("Status: " + status); render();
  }catch(e){ console.error(e); toast("Could not update"); }
  S.busy=false;
}

function getLocation(){
  return new Promise(res=>{
    if(!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition(
      p=>res({lat:p.coords.latitude, lng:p.coords.longitude}),
      ()=>res(null), {timeout:8000, enableHighAccuracy:true});
  });
}

async function addPhotos(input){
  const files = Array.from(input.files||[]);
  if(!files.length) return;
  toast("Uploading " + files.length + " photo(s)\u2026");
  for(const f of files){
    try{
      const path = "job_" + (S.job&&S.job.id||"x") + "_" + Date.now() + "_" + Math.random().toString(36).slice(2,7) + ".jpg";
      const { error } = await sb.storage.from("jobphotos").upload(path, f, {upsert:true});
      if(error) throw error;
      const { data } = sb.storage.from("jobphotos").getPublicUrl(path);
      S.photos.push(data.publicUrl);
    }catch(e){ console.error("photo:",e); toast("Photo upload failed"); }
  }
  input.value=""; render();
}

function addPart(){
  const sel = $("psel"); const qty = Number(($("pqty").value||1));
  if(!sel || !sel.value) { toast("Choose an item"); return; }
  const item = S.items.find(i=>String(i.id)===sel.value);
  if(!item) return;
  const cust = S.job ? custOf(S.job) : null;
  const rate = priceFor(item, cust);
  const ex = S.parts.find(p=>p.id===item.id);
  if(ex) ex.qty += qty; else S.parts.push({id:item.id, name:item.name, qty, rate});
  $("pqty").value = 1; render();
}
function delPart(i){ S.parts.splice(i,1); render(); }
const partsTotal = () => S.parts.reduce((s,p)=>s+p.qty*p.rate,0);

async function finishJob(paid){
  if(S.busy) return; S.busy=true;
  toast("Saving\u2026");
  try{
    const loc = await getLocation();
    const note = ($("cnote")&&$("cnote").value||"").trim();
    const j = S.job;
    const prev = j.work_done ? j.work_done + "\n" : "";
    const patch = {
      status: "Done", completed_at: new Date().toISOString(),
      photos: S.photos, parts_used: S.parts, bill_total: partsTotal(),
      payment_status: paid ? "Paid" : "Unpaid",
      work_done: note ? prev + new Date().toLocaleDateString("en-IN") + " \u2014 " + note : j.work_done
    };
    if(loc){ patch.completed_lat = loc.lat; patch.completed_lng = loc.lng; }
    const { error } = await sb.from("service_calls").update(patch).eq("id", j.id);
    if(error) throw error;
    Object.assign(j, patch);
    toast("Job completed" + (loc?" \u00B7 location saved":""));
    go("jobdone");
  }catch(e){ console.error(e); toast("Could not save. Check connection."); }
  S.busy=false;
}

function billText(j){
  let t = "Dear " + (j.customer_name||"Customer") + ",\n\nService completed \u2014 " + (j.job_no||"") + "\n";
  if((j.parts_used||[]).length){
    t += "\nItems:\n";
    j.parts_used.forEach(p=>{ t += "\u2022 " + p.name + " x" + p.qty + " = \u20B9" + (p.qty*p.rate) + "\n"; });
    t += "\nTotal: \u20B9" + (j.bill_total||0) + "\n";
  }
  t += "\nThank you for choosing GEMPRO Technologies, Salem.\n9894522502";
  return t;
}
function reviewText(j){
  return "Dear " + (j.customer_name||"Customer") + ", thank you for choosing GEMPRO Technologies! "
    + "If you were happy with our service, please leave us a Google review:\n" + GOOGLE_REVIEW_URL;
}

function viewComplete(){
  const j = S.job; if(!j) return viewJobs();
  const cust = custOf(j);
  const cat = (cust && (cust.sales_category||"RETAIL")) || "RETAIL";
  const opts = S.items.map(i=>`<option value="${esc(i.id)}">${esc(i.name)}${i.model_no?" \u00B7 "+esc(i.model_no):""}</option>`).join("");
  const rows = S.parts.map((p,i)=>`<div class="kv"><span>${esc(p.name)} \u00D7${p.qty}</span>
      <b>${money(p.qty*p.rate)} <span onclick="delPart(${i})" style="color:#e11d2a;margin-left:8px">\u2715</span></b></div>`).join("");
  const pics = S.photos.map(u=>`<img src="${esc(u)}" style="width:72px;height:72px;object-fit:cover;border-radius:9px;border:1px solid #2a2a2a">`).join("");
  return `<div class="hd"><span onclick="go('jobdetail')" style="color:#888;font-size:22px;padding-right:4px">\u2039</span>
      <div style="min-width:0"><div style="font-weight:800;font-size:17px">Complete Job</div>
      <div style="color:#888;font-size:12px">${esc(j.customer_name||"")} \u00B7 ${esc(j.job_no||"")}</div></div></div>
    <div style="padding:0 16px">
      <div class="sec" style="margin-left:0">1. Photos of completed work</div>
      <label class="btn btn2" style="margin-bottom:10px">\uD83D\uDCF7 Take / choose photos
        <input type="file" accept="image/*" capture="environment" multiple style="display:none" onchange="addPhotos(this)"></label>
      ${pics?`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">${pics}</div>`:`<div style="color:#555;font-size:12px;margin-bottom:14px">No photos yet</div>`}
      <div class="sec" style="margin-left:0">2. Parts used <span style="color:#666;font-weight:600">(${esc(cat)} price)</span></div>
      <select class="inp" id="psel"><option value="">-- choose item --</option>${opts}</select>
      <div style="display:flex;gap:8px;margin-bottom:10px">
        <input class="inp" id="pqty" type="number" value="1" min="1" style="flex:1;margin:0">
        <button class="btn" style="flex:1" onclick="addPart()">Add item</button></div>
      ${rows?`<div class="card" style="margin:0 0 10px">${rows}
        <div class="kv" style="border-top:1px solid #2a2a2a;margin-top:6px;padding-top:9px">
        <span style="font-weight:700;color:#eee">TOTAL</span><b style="color:#22c55e;font-size:16px">${money(partsTotal())}</b></div></div>`
        :`<div style="color:#555;font-size:12px;margin-bottom:12px">No parts added</div>`}
      <div class="sec" style="margin-left:0">3. Work note</div>
      <textarea class="inp" id="cnote" rows="2" placeholder="What was done?"></textarea>
      <div class="sec" style="margin-left:0">4. Finish</div>
      <button class="btn" onclick="finishJob(true)" style="margin-bottom:8px">\u2714 Complete \u00B7 Paid on site</button>
      <button class="btn btn2" onclick="finishJob(false)">\u2714 Complete \u00B7 Bill to office</button>
      <div style="color:#555;font-size:11px;text-align:center;margin-top:10px">Your location is saved automatically as proof of visit</div>
      <div style="height:24px"></div></div>`;
}

function viewJobDone(){
  const j = S.job; if(!j) return viewJobs();
  return `<div style="padding:40px 24px;text-align:center">
      <div style="font-size:56px">\u2705</div>
      <div style="font-size:20px;font-weight:800;margin-top:10px">Job Completed</div>
      <div style="color:#888;font-size:13px;margin-top:4px">${esc(j.customer_name||"")} \u00B7 ${esc(j.job_no||"")}</div>
      ${j.bill_total?`<div style="color:#22c55e;font-size:22px;font-weight:800;margin-top:12px">${money(j.bill_total)}</div>
      <div style="color:#888;font-size:12px">${esc(j.payment_status||"")}</div>`:""}</div>
    <div style="padding:0 16px">
      ${j.customer_mobile?`
      <a class="btn" style="text-decoration:none;margin-bottom:10px;background:#22c55e" href="${esc(waLink(j.customer_mobile, billText(j)))}" target="_blank">\uD83D\uDCAC Send bill on WhatsApp</a>
      <a class="btn" style="text-decoration:none;margin-bottom:10px;background:#4285F4" href="${esc(waLink(j.customer_mobile, reviewText(j)))}" target="_blank">\u2B50 Ask for Google review</a>`
      :`<div style="color:#666;font-size:13px;text-align:center;margin-bottom:12px">No customer mobile on this job</div>`}
      <button class="btn btn2" onclick="go('jobs')">Back to jobs</button>
      <div style="height:24px"></div></div>`;
}

function viewIssue(){
  const opts = S.items.map(i=>`<option value="${esc(i.id)}">${esc(i.name)}${i.model_no?" \u00B7 "+esc(i.model_no):""}</option>`).join("");
  const techOpts = S.techs.map(t=>`<option value="${esc(t.full_name)}">${esc(t.full_name)}</option>`).join("");
  const rows = S.issueCart.map((p,i)=>`<div class="kv"><span>${esc(p.name)}</span>
      <b>\u00D7${p.qty} <span onclick="delIssueItem(${i})" style="color:#e11d2a;margin-left:8px">\u2715</span></b></div>`).join("");
  return `<div class="hd"><span class="ic" style="background:#22c55e22">\uD83D\uDE9A</span>
      <div style="font-weight:800;font-size:17px">Issue Stock</div></div>
    <div style="padding:0 16px">
      <div class="lbl">Technician</div>
      ${isAdmin()?`<select class="inp" id="itech"><option value="">-- choose --</option>${techOpts}</select>`
        :`<input class="inp" id="itech" value="${esc(S.user.name)}" readonly style="color:#888">`}
      <div class="lbl">Item</div>
      <select class="inp" id="isel"><option value="">-- choose item --</option>${opts}</select>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <input class="inp" id="iqty" type="number" value="1" min="1" style="flex:1;margin:0">
        <button class="btn" style="flex:1" onclick="addIssueItem()">Add</button></div>
      ${rows?`<div class="card" style="margin:0 0 12px">${rows}</div>`:`<div style="color:#555;font-size:12px;margin-bottom:12px">No items added</div>`}
      <div class="lbl">Note (job no. / purpose)</div>
      <input class="inp" id="inote" placeholder="e.g. SC12345678 or vehicle stock">
      <button class="btn" onclick="saveIssue()">Record issue</button>
      <div style="height:24px"></div></div>`;
}

function addIssueItem(){
  const sel=$("isel"), qty=Number(($("iqty").value||1));
  if(!sel||!sel.value){ toast("Choose an item"); return; }
  const item=S.items.find(i=>String(i.id)===sel.value); if(!item) return;
  const ex=S.issueCart.find(p=>p.id===item.id);
  if(ex) ex.qty+=qty; else S.issueCart.push({id:item.id,name:item.name,qty});
  $("iqty").value=1; render();
}
function delIssueItem(i){ S.issueCart.splice(i,1); render(); }

async function saveIssue(){
  if(S.busy) return;
  const tech = $("itech").value || "";
  const note = ($("inote").value||"").trim();
  if(!tech){ toast("Choose a technician"); return; }
  if(!S.issueCart.length){ toast("Add at least one item"); return; }
  S.busy=true;
  try{
    const row = { id: crypto.randomUUID(), issue_no: "MI"+Date.now().toString().slice(-8),
      technician_name: tech, items: S.issueCart, issued_by: S.user.name,
      status:"Issued", notes: note, created_at: new Date().toISOString() };
    const { error } = await sb.from("material_issues").insert([row]);
    if(error) throw error;
    S.issues.unshift(row); S.issueCart=[];
    toast("Issue " + row.issue_no + " recorded");
    go("issuelog");
  }catch(e){ console.error(e); toast("Could not save issue"); }
  S.busy=false;
}

function viewIssueLog(){
  const list = isAdmin() ? S.issues
    : S.issues.filter(i=>(i.technician_name||"").toLowerCase()===(S.user.name||"").toLowerCase());
  const rows = list.length ? list.map(i=>`<div class="card">
      <div style="display:flex;justify-content:space-between;gap:10px">
        <div style="min-width:0"><div style="font-size:14px;font-weight:700">${esc(i.technician_name||"\u2014")}</div>
        <div style="color:#888;font-size:12px;margin-top:2px">${esc(i.issue_no||"")} \u00B7 ${new Date(i.created_at).toLocaleDateString("en-IN")}</div></div>
        <span class="pill" style="background:#14b8a622;color:#14b8a6;align-self:flex-start">${(i.items||[]).length} item${(i.items||[]).length===1?"":"s"}</span></div>
      <div style="margin-top:8px">${(i.items||[]).map(x=>`<div style="color:#aaa;font-size:12px">\u2022 ${esc(x.name)} \u00D7${x.qty}</div>`).join("")}</div>
      ${i.notes?`<div style="color:#777;font-size:11px;margin-top:6px">${esc(i.notes)}</div>`:""}
      <div style="color:#666;font-size:11px;margin-top:6px">Issued by ${esc(i.issued_by||"\u2014")}</div></div>`).join("")
    : `<div class="empty"><div class="e">\uD83D\uDCCB</div><div style="margin-top:12px;font-size:14px">No issues recorded</div></div>`;
  return `<div class="hd"><span class="ic" style="background:#14b8a622">\uD83D\uDCCB</span>
      <div style="font-weight:800;font-size:17px">${isAdmin()?"Issue Log":"My Issues"}</div>
      <span onclick="go('issue')" style="margin-left:auto;background:#22c55e;color:#000;font-size:13px;font-weight:800;padding:8px 14px;border-radius:9px">\uFF0B New</span></div>
    <div class="sec">${list.length} record${list.length===1?"":"s"}</div>${rows}<div style="height:20px"></div>`;
}

function viewMyStock(){
  const stock = myStock();
  const rows = stock.length ? stock.map(s=>`<div class="card">
      <div style="display:flex;justify-content:space-between"><div style="font-size:14px;font-weight:700">${esc(s.name)}</div>
      <span class="pill" style="background:#14b8a622;color:#14b8a6">${s.qty}</span></div></div>`).join("")
    : `<div class="empty"><div class="e">\uD83D\uDE9A</div><div style="margin-top:12px;font-size:14px">No stock issued to you</div></div>`;
  return `<div class="hd"><span class="ic" style="background:#14b8a622">\uD83D\uDE9A</span>
      <div style="font-weight:800;font-size:17px">My Stock</div>
      <span onclick="go('issue')" style="margin-left:auto;background:#1f1f1f;color:#aaa;font-size:12px;font-weight:700;padding:8px 12px;border-radius:9px">Self-issue</span></div>
    <div class="sec">Items currently with you</div>${rows}<div style="height:20px"></div>`;
}

async function createJob(){
  if(S.busy) return;
  const f = { customer_name:($("fname").value||"").trim(), customer_mobile:($("fmob").value||"").trim(),
    address:($("faddr").value||"").trim(), job_type:$("ftype").value, priority:$("fprio").value,
    problem_description:($("fprob").value||"").trim(),
    technician_name: $("ftech") ? $("ftech").value : (S.user.name||"") };
  if(!f.customer_name){ toast("Customer name is required"); return; }
  S.busy=true;
  try{
    const jobNo = "SC" + Date.now().toString().slice(-8);
    const row = { id: crypto.randomUUID(), job_no: jobNo, ...f, status:"Pending",
      scheduled_date: new Date().toISOString().slice(0,10), created_at: new Date().toISOString() };
    const { error } = await sb.from("service_calls").insert([row]);
    if(error) throw error;
    S.jobs.unshift(row); toast("Service call " + jobNo + " created"); go("jobs");
  }catch(e){ console.error(e); toast("Could not create call"); }
  S.busy=false;
}

function custSearch(q){
  const box=$("cresults"); if(!box) return;
  q=(q||"").toLowerCase().trim();
  if(q.length<2){ box.innerHTML=""; return; }
  const hits=S.customers.filter(c=>(c.name||"").toLowerCase().includes(q)||(c.mobile||"").includes(q)).slice(0,8);
  box.innerHTML = hits.length ? hits.map(c=>`<div onclick="pickCust('${esc(c.id)}')" style="padding:11px 12px;border-bottom:1px solid #222;cursor:pointer">
      <div style="font-size:14px;font-weight:700">${esc(c.name)}</div>
      <div style="color:#888;font-size:12px">${esc(c.mobile||"")} \u00B7 ${esc(c.city||"")} \u00B7 ${esc(c.sales_category||"RETAIL")}</div></div>`).join("")
    : `<div style="padding:11px;color:#666;font-size:13px">No match \u2014 type full name to add new</div>`;
}
function pickCust(id){
  const c=S.customers.find(x=>String(x.id)===String(id)); if(!c) return;
  $("fname").value=c.name||"";
  $("fmob").value=c.mobile||"";
  $("faddr").value=[c.address,c.city].filter(Boolean).join(", ");
  $("csearch").value=c.name||"";
  $("cresults").innerHTML="";
  toast("Customer selected");
}

function viewNewJob(){
  const techOpts = S.techs.map(t=>`<option value="${esc(t.full_name)}"${(!isAdmin()&&t.full_name===S.user.name)?" selected":""}>${esc(t.full_name)}</option>`).join("");
  return `<div class="hd"><span onclick="go('jobs')" style="color:#888;font-size:22px;padding-right:4px">\u2039</span>
      <span class="ic" style="background:#22c55e22">\u2795</span>
      <div style="font-weight:800;font-size:17px">New Service Call</div></div>
    <div style="padding:0 16px">
      <div class="lbl">Search existing customer</div>
      <input class="inp" id="csearch" placeholder="\uD83D\uDD0D Type name or mobile" oninput="custSearch(this.value)" style="margin-bottom:0">
      <div id="cresults" style="background:#161616;border-radius:0 0 10px 10px;max-height:230px;overflow:auto;margin-bottom:10px"></div>
      <div class="lbl">Customer name *</div>
      <input class="inp" id="fname" placeholder="Customer name">
      <div class="lbl">Mobile number</div>
      <input class="inp" id="fmob" type="tel" inputmode="numeric" placeholder="Mobile number">
      <div class="lbl">Address</div>
      <input class="inp" id="faddr" placeholder="Address / location">
      <div class="lbl">Job type</div>
      <select class="inp" id="ftype"><option>Service</option><option>Installation</option>
        <option>Repair</option><option>AMC</option><option>Complaint</option></select>
      <div class="lbl">Priority</div>
      <select class="inp" id="fprio"><option>Normal</option><option>Urgent</option><option>Low</option></select>
      <div class="lbl">Technician</div>
      ${isAdmin()?`<select class="inp" id="ftech"><option value="">-- assign later --</option>${techOpts}</select>`
        :`<input class="inp" id="ftech" value="${esc(S.user.name)}" readonly style="color:#888">`}
      <div class="lbl">Problem / complaint</div>
      <textarea class="inp" id="fprob" rows="3" placeholder="Describe the problem"></textarea>
      <button class="btn" onclick="createJob()">Create service call</button>
      <div style="height:24px"></div></div>`;
}

function viewJobDetail(){
  const j = S.job; if(!j) return viewJobs();
  const btn = st => `<button onclick="setStatus('${esc(j.id)}','${st}')" style="flex:1;background:${(j.status===st)?jobColor({status:st}):'#1a1a1a'};color:${(j.status===st)?'#000':'#aaa'};border:none;border-radius:9px;padding:11px 6px;font-size:13px;font-weight:700;cursor:pointer">${st}</button>`;
  const pics = (j.photos||[]).map(u=>`<img src="${esc(u)}" style="width:72px;height:72px;object-fit:cover;border-radius:9px;border:1px solid #2a2a2a">`).join("");
  return `<div class="hd"><span onclick="go('jobs')" style="color:#888;font-size:22px;padding-right:4px">\u2039</span>
      <div style="min-width:0"><div style="font-weight:800;font-size:17px">${esc(j.customer_name||"\u2014")}</div>
      <div style="color:#888;font-size:12px">${esc(j.job_no||"")}</div></div>
      <span class="pill" style="background:${jobColor(j)}22;color:${jobColor(j)};margin-left:auto">${esc(j.status||"Pending")}</span></div>
    <div style="padding:0 16px">
      <div class="sec" style="margin-left:0">Update status</div>
      <div style="display:flex;gap:8px;margin-bottom:18px">${STATUSES.map(btn).join("")}</div>
      <div class="card" style="margin:0 0 12px">
        ${j.job_type?`<div class="kv"><span>Type</span><b>${esc(j.job_type)}</b></div>`:""}
        ${j.priority?`<div class="kv"><span>Priority</span><b>${esc(j.priority)}</b></div>`:""}
        ${j.technician_name?`<div class="kv"><span>Technician</span><b>${esc(j.technician_name)}</b></div>`:""}
        ${j.address?`<div class="kv"><span>Address</span><b>${esc(j.address)}</b></div>`:""}
        ${j.bill_total?`<div class="kv"><span>Bill</span><b style="color:#22c55e">${money(j.bill_total)} \u00B7 ${esc(j.payment_status||"")}</b></div>`:""}
      </div>
      ${j.customer_mobile?`<div style="display:flex;gap:10px;margin-bottom:14px">
        <a href="tel:${esc(j.customer_mobile)}" class="btn" style="text-decoration:none;background:#3b82f6">\uD83D\uDCDE Call</a>
        <a href="${esc(waLink(j.customer_mobile,"Hello "+(j.customer_name||"")+", regarding your service request "+(j.job_no||"")))}" target="_blank" class="btn" style="text-decoration:none;background:#22c55e">\uD83D\uDCAC WhatsApp</a></div>`:""}
      ${j.address?`<a class="btn btn2" style="text-decoration:none;margin-bottom:14px" target="_blank" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(j.address)}">\uD83D\uDDFA Directions</a>`:""}
      ${j.problem_description?`<div class="sec" style="margin-left:0">Problem</div>
        <div class="card" style="margin:0 0 14px;color:#ccc;font-size:13px">${esc(j.problem_description)}</div>`:""}
      ${(j.parts_used||[]).length?`<div class="sec" style="margin-left:0">Parts used</div>
        <div class="card" style="margin:0 0 14px">${j.parts_used.map(p=>`<div class="kv"><span>${esc(p.name)} \u00D7${p.qty}</span><b>${money(p.qty*p.rate)}</b></div>`).join("")}</div>`:""}
      ${pics?`<div class="sec" style="margin-left:0">Photos</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">${pics}</div>`:""}
      ${j.work_done?`<div class="sec" style="margin-left:0">Work notes</div>
        <div class="card" style="margin:0 0 14px;color:#ccc;font-size:13px;white-space:pre-wrap">${esc(j.work_done)}</div>`:""}
      ${j.completed_lat?`<a class="btn btn2" style="text-decoration:none;margin-bottom:14px" target="_blank" href="https://www.google.com/maps?q=${j.completed_lat},${j.completed_lng}">\uD83D\uDCCD Completion location</a>`:""}
      <div style="height:24px"></div></div>`;
}

function viewJobs(){
  const q=(S.q||"").toLowerCase();
  const jobs = myJobs().filter(j=>!q||(j.customer_name||"").toLowerCase().includes(q)||(j.job_no||"").toLowerCase().includes(q)||(j.customer_mobile||"").includes(q)||(j.status||"").toLowerCase().includes(q));
  const rows = jobs.length ? jobs.map(j=>`<div class="card" onclick="openJob('${esc(j.id)}')">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
        <div style="min-width:0"><div style="font-size:14px;font-weight:700">${esc(j.customer_name||"\u2014")}</div>
        <div style="color:#888;font-size:12px;margin-top:3px">${esc(j.job_no||"")}${j.job_type?" \u00B7 "+esc(j.job_type):""}</div></div>
        <span class="pill" style="background:${jobColor(j)}22;color:${jobColor(j)}">${esc(j.status||"Pending")}</span></div>
      ${j.problem_description?`<div style="color:#aaa;font-size:12px;margin-top:8px">${esc(j.problem_description)}</div>`:""}
      ${isAdmin()&&j.technician_name?`<div style="color:#777;font-size:12px;margin-top:7px">\uD83D\uDC77 ${esc(j.technician_name)}</div>`:""}
    </div>`).join("") : `<div class="empty"><div class="e">\uD83D\uDD27</div><div style="margin-top:12px;font-size:14px">No service calls yet</div></div>`;
  return `<div class="hd"><span class="ic" style="background:#f59e0b22">\uD83D\uDCDE</span>
      <div style="font-weight:800;font-size:17px">${isAdmin()?"Service Jobs":"My Jobs"}</div>
      <span onclick="go('newjob')" style="margin-left:auto;background:#22c55e;color:#000;font-size:13px;font-weight:800;padding:8px 14px;border-radius:9px">\uFF0B New</span></div>
    <div style="padding:0 16px 12px"><input class="inp" placeholder="\uD83D\uDD0D Search customer, job no, status" value="${esc(S.q||"")}" oninput="S.q=this.value;render();this.focus()"></div>
    <div class="sec">${jobs.length} job${jobs.length===1?"":"s"} \u00B7 tap to open</div>${rows}<div style="height:20px"></div>`;
}

function statBox(label,val,color){ return `<div class="stat"><div class="l">${label}</div><div class="v" style="color:${color}">${val}</div></div>`; }

function viewHome(){
  const jobs = myJobs();
  const pending = jobs.filter(j=>!isDone(j)&&!isOngoing(j)).length;
  const ongoing = jobs.filter(isOngoing).length;
  const tiles = (isAdmin()?ADMIN_TILES:TECH_TILES).map(t=>`<div class="tile" onclick="go('${t[4]}')">
      <span class="ti" style="background:${t[2]}22">${t[0]}</span>
      <div><div class="n">${t[1]}</div><div class="s">${t[3]}</div></div></div>`).join("");
  return `<div class="hd"><span class="ic" style="background:#e11d2a">\uD83D\uDCF7</span>
      <div style="min-width:0"><div style="color:#e11d2a;font-weight:900;font-size:15px">GEM PRO FIELD</div>
      <div style="color:#888;font-size:11px;font-weight:600">${esc(S.user.name)} \u00B7 ${isAdmin()?"Admin":"Technician"}</div></div>
      <span onclick="logout()" style="margin-left:auto;color:#666;font-size:12px;font-weight:700;padding:6px 10px;border:1px solid #2a2a2a;border-radius:8px">Exit</span></div>
    <div style="display:flex;gap:10px;padding:0 16px 10px">${statBox("Pending",pending,"#f59e0b")}${statBox("Ongoing",ongoing,"#3b82f6")}</div>
    <div style="display:flex;gap:10px;padding:0 16px 18px">${statBox("Done",jobs.filter(isDone).length,"#22c55e")}${statBox("Expenses",money(expTotal()),"#f43f5e")}</div>
    <div class="sec">Quick Access</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:0 16px">${tiles}</div>
    <div style="height:20px"></div>`;
}

function viewReport(){
  const jobs = myJobs(); const now = new Date();
  const cutoff = expPeriod();
  const per = jobs.filter(j=>new Date(j.created_at||j.scheduled_date||0) >= cutoff);
  const done = per.filter(isDone), ong = per.filter(isOngoing), pend = per.filter(j=>!isDone(j)&&!isOngoing(j));
  const billed = done.reduce((s,j)=>s+Number(j.bill_total||0),0);
  const tab = (k,l) => `<button onclick="S.period='${k}';render()" style="flex:1;background:${S.period===k?'#e11d2a':'#1a1a1a'};color:${S.period===k?'#fff':'#888'};border:none;border-radius:9px;padding:9px;font-size:13px;font-weight:700;cursor:pointer">${l}</button>`;
  const list = arr => arr.length ? arr.map(j=>`<div class="card" style="margin:0 16px 8px" onclick="openJob('${esc(j.id)}')">
      <div style="display:flex;justify-content:space-between;gap:8px">
        <div style="min-width:0"><div style="font-size:13px;font-weight:700">${esc(j.customer_name||"\u2014")}</div>
        <div style="color:#888;font-size:11px;margin-top:2px">${esc(j.job_no||"")}</div></div>
        <span style="color:${jobColor(j)};font-size:11px;font-weight:700">${esc(j.status||"")}</span></div></div>`).join("")
      : `<div style="color:#555;font-size:13px;padding:0 16px 12px">None</div>`;
  return `<div class="hd"><span class="ic" style="background:#ec489922">\uD83D\uDCCA</span>
      <div style="font-weight:800;font-size:17px">${isAdmin()?"Reports":"My Report"}</div></div>
    <div style="display:flex;gap:8px;padding:0 16px 16px">${tab("today","Today")}${tab("week","Week")}${tab("month","Month")}</div>
    <div style="display:flex;gap:10px;padding:0 16px 10px">${statBox("Completed",done.length,"#22c55e")}${statBox("Ongoing",ong.length,"#3b82f6")}</div>
    <div style="display:flex;gap:10px;padding:0 16px 18px">${statBox("Pending",pend.length,"#f59e0b")}${statBox("Billed",money(billed),"#8b5cf6")}</div>
    <div class="sec">Pending \u00B7 ${pend.length}</div>${list(pend)}
    <div class="sec">Ongoing \u00B7 ${ong.length}</div>${list(ong)}
    <div class="sec">Completed \u00B7 ${done.length}</div>${list(done)}
    <div class="sec" style="margin-top:22px">Expense Report</div>
    <div style="padding:0 16px">
      <div class="card" style="margin:0 0 10px">
        <div class="kv"><span>Entries</span><b>${expList().length}</b></div>
        <div class="kv"><span>Total spent</span><b style="color:#f59e0b">${money(expTotal())}</b></div></div>
      <button class="btn" onclick="printExpenseReport()" style="margin-bottom:8px">\uD83D\uDDA8 Expense report PDF</button>
      <button class="btn btn2" style="margin-bottom:8px" onclick="sendExpenseReport()">\uD83D\uDCAC Send on WhatsApp</button>
      <button class="btn btn2" onclick="go('expenses')">View all expenses</button></div>
    <div style="height:20px"></div>`;
}

function viewMore(){
  const items=[["\uD83E\uDDFE","Create Invoice","billing"],
    ["\uD83D\uDCB8",isAdmin()?"All Expenses":"My Expenses","expenses"],
    ["\uD83D\uDE9A",isAdmin()?"Issue Stock":"My Stock",isAdmin()?"issue":"mystock"],
    ["\uD83D\uDCCB","Issue Log","issuelog"],
    ["\uD83D\uDCCA",isAdmin()?"Reports":"My Report","report"],["\uD83D\uDD04","Refresh data","refresh"]];
  return `<div class="hd"><div style="font-weight:800;font-size:17px">More</div></div>
    ${items.map(i=>`<div class="row" onclick="go('${i[2]}')"><span style="font-size:20px;width:26px">${i[0]}</span>
      <span style="color:#eee;font-size:15px;font-weight:600">${i[1]}</span>
      <span style="color:#555;margin-left:auto">\u203A</span></div>`).join("")}
    <div class="row" onclick="logout()"><span style="font-size:20px;width:26px">\uD83D\uDEAA</span>
      <span style="color:#e11d2a;font-size:15px;font-weight:600">Sign out</span></div>
    <div style="padding:24px 16px;color:#555;font-size:12px;text-align:center">
      ${esc(S.user.name)} \u00B7 ${isAdmin()?"Admin":"Technician"}<br>GEMPRO Technologies \u00B7 Salem</div>`;
}

const VIEWS = { home:viewHome, jobs:viewJobs, more:viewMore, report:viewReport,
  newjob:viewNewJob, jobdetail:viewJobDetail, complete:viewComplete, jobdone:viewJobDone,
  issue:viewIssue, issuelog:viewIssueLog, mystock:viewMyStock,
  expenses:viewExpenses, addexp:viewAddExpense, billing:viewBilling, invdone:viewInvDone };

function openJob(id){ S.job = S.jobs.find(x=>String(x.id)===String(id)); S.view="jobdetail"; window.scrollTo(0,0); render(); }
function go(v){
  if(v==="refresh"){ S.loaded=false; render(); loadAll(); return; }
  S.view = v; S.q = ""; window.scrollTo(0,0); render();
}

function renderNav(){
  if(!S.user){ $("nav").style.display="none"; return; }
  $("nav").style.display="flex";
  const tabs=[["home","\uD83C\uDFE0","Home"],["jobs","\uD83D\uDD27","Jobs"],["add","",""],["billing","\uD83E\uDDFE","Bill"],["more","\u2630","More"]];
  $("nav").innerHTML = tabs.map(t=>{
    if(t[0]==="add") return `<button onclick="go('newjob')"><span class="fab">\uFF0B</span></button>`;
    return `<button class="${S.view===t[0]?"on":""}" onclick="go('${t[0]}')"><span style="font-size:21px">${t[1]}</span>${t[2]}</button>`;
  }).join("");
}

function render(){
  if(!S.user){ $("app").innerHTML = viewLogin(); renderNav(); return; }
  if(!S.loaded){ $("app").innerHTML = `<div class="tsp">Loading\u2026</div>`; renderNav(); return; }
  $("app").innerHTML = (VIEWS[S.view]||viewHome)();
  renderNav();
}

S.user = loadUser();
if(S.user){ loadAll(); } else { render(); }
if("serviceWorker" in navigator){ navigator.serviceWorker.register("sw.js").catch(()=>{}); }
