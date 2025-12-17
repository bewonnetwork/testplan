// income-history.js – load income_history collection for current user (FINAL)


console.log("BUILD:", "20251217_1");
import { db } from "./firebase-config.js";
import {
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const STORAGE_CURRENT = "btx_current_user_v1";

function getCurrentUser(){
  const raw = localStorage.getItem(STORAGE_CURRENT);
  if(!raw) return null;
  try{ return JSON.parse(raw); }catch(e){ return null; }
}

function fmtAmount(v){
  const n = Number(v || 0);
  const s = n.toFixed(2);
  return (n >= 0 ? "+$" + s : "-$" + Math.abs(n).toFixed(2));
}
function fmtMoneyOnly(v){
  return "$" + Number(v||0).toFixed(2);
}

function logout(){
  localStorage.removeItem(STORAGE_CURRENT);
  alert("Logged out.");
  window.location.href = "login.html";
}
function goDashboard(){
  window.location.href = "dashboard.html";
}

window.logout = logout;
window.goDashboard = goDashboard;

function typeTag(type){
  type = String(type || "").toLowerCase();
  let cls = "tag-other";

  if(type === "roi") cls = "tag-roi";
  else if(type === "direct" || type === "sponsor") cls = "tag-sponsor";
  else if(type === "gen" || type === "generation") cls = "tag-gen";
  else if(type === "rank") cls = "tag-rank";
  else if(type === "global") cls = "tag-global";
  else if(type === "gift" || type === "topup") cls = "tag-gift";

  const label = type ? type.toUpperCase() : "OTHER";
  return `<span class="tag ${cls}">${label}</span>`;
}

function toMillis(createdAt){
  // Firestore Timestamp বা string/date—সব handle
  if(createdAt && typeof createdAt.toDate === "function"){
    return createdAt.toDate().getTime();
  }
  if(createdAt){
    const t = new Date(createdAt).getTime();
    return isNaN(t) ? 0 : t;
  }
  return 0;
}

function toDateStr(createdAt){
  if(createdAt && typeof createdAt.toDate === "function"){
    return createdAt.toDate().toLocaleString();
  }
  if(createdAt){
    const d = new Date(createdAt);
    if(!isNaN(d.getTime())) return d.toLocaleString();
  }
  return "-";
}

async function loadHistory(){
  const me = getCurrentUser();
  const infoLine = document.getElementById("infoLine");
  const tbody = document.getElementById("incomeTbody");

  if(!me){
    if(infoLine) infoLine.textContent = "No session. Please login again.";
    window.location.href = "login.html";
    return;
  }

  const username = (me.username || "").toLowerCase().trim();
  if(!username){
    if(infoLine) infoLine.textContent = "Username missing. Please login again.";
    window.location.href = "login.html";
    return;
  }

  if(infoLine){
    infoLine.textContent = `Member: @${username} – Income statement`;
  }
  if(!tbody) return;

  // UI defaults
  document.getElementById("sumCount").textContent  = "0";
  document.getElementById("sumCredit").textContent = "$0.00";
  document.getElementById("sumDebit").textContent  = "$0.00";

  try{
    // ✅ orderBy বাদ—JS sort
    const q = query(
      collection(db,"income_history"),
      where("username","==", username)
    );

    const snap = await getDocs(q);

    if(snap.empty){
      tbody.innerHTML = `<tr><td colspan="5">No income history found yet.</td></tr>`;
      return;
    }

    const list = [];
    snap.forEach(docSnap =>{
      list.push({ id: docSnap.id, ...docSnap.data() });
    });

    // latest first
    list.sort((a,b)=> toMillis(b.createdAt) - toMillis(a.createdAt));

    let rows = "";
    let i = 1;
    let totalCredit = 0;
    let totalDebit  = 0;

    for(const d of list){
      const type = d.type || "";
      const amt  = Number(d.amount || 0);

      if(amt >= 0) totalCredit += amt;
      else totalDebit += amt;

      const dateStr = toDateStr(d.createdAt);
      const remark  = d.remark || d.note || "-";

      rows += `
        <tr>
          <td>${i}</td>
          <td>${dateStr}</td>
          <td>${typeTag(type)}</td>
          <td>${remark}</td>
          <td class="${amt>=0?'amt-plus':'amt-minus'}">${fmtAmount(amt)}</td>
        </tr>
      `;
      i++;
    }

    tbody.innerHTML = rows;
    document.getElementById("sumCount").textContent  = String(i-1);
    document.getElementById("sumCredit").textContent = fmtMoneyOnly(totalCredit);
    document.getElementById("sumDebit").textContent  = fmtMoneyOnly(Math.abs(totalDebit));

  }catch(err){
    console.error("Income history load error:",err);
    tbody.innerHTML = `<tr><td colspan="5">Error loading history: ${err.message}</td></tr>`;
  }
}

document.addEventListener("DOMContentLoaded", loadHistory);
function typeTag(type){
  type = (type || "").toLowerCase();
  let cls = "tag-other";

  if(type==="roi") cls="tag-roi";
  else if(type==="sponsor") cls="tag-sponsor";
  else if(type==="generation") cls="tag-gen";
  else if(type==="rank") cls="tag-rank";
  else if(type==="global") cls="tag-global";

  return `<span class="tag ${cls}">${type.toUpperCase()}</span>`;
}
