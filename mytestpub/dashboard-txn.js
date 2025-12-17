[19:07, 17/12/2025] RSA: // dashboard.js – BTX.ONE member dashboard logic (no module)

console.log("BUILD:", "20251217_2");
const STORAGE_CURRENT = "btx_current_user_v1";

// -------------------- helpers --------------------
function getCurrentUser(){
  const raw = localStorage.getItem(STORAGE_CURRENT);
  if(!raw) return null;
  try{ return JSON.parse(raw); }catch(e){ return null; }
}

function logout(){
  localStorage.removeItem(STORAGE_CURRENT);
  alert("Logged out.");
  window.location.href = "login.html";
}

function goHome(){ window.location.href = "index.html"; }
function goAdmin(){ window.location.href = "admin.html"; }
function goProfile(){ window.location.href = "profile.html"; }
function goIncomeHistory(){ window.location.href = "income-history.html"; }
function goGenealog…
[19:09, 17/12/2025] RSA: Bnj
[19:09, 17/12/2025] RSA: <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script src="income-engine.js"></script>
<script src="dashboard.js"></script>
[19:13, 17/12/2025] RSA: কতততত
[19:13, 17/12/2025] RSA: // dashboard-txn.js – load income / transaction history inside dashboard

console.log("BUILD:", "20251217_TXN_1");

import { db } from "./firebase-config.js";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
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
  return (n >= 0 ? "+$" : "-$") + Math.abs(n).toFixed(2);
}

function typeLabel(t){
  const type = String(t || "").toLowerCase();
  return type.toUpperCase();
}

async function loadDashboardTxn(){
  const user = getCurrentUser();
  const tbody = document.getElementById("dashTxnBody");

  if(!user || !tbody){
    console.warn("Txn: user or table missing");
    return;
  }

  const username = String(user.username || "").toLowerCase();
  if(!username){
    tbody.innerHTML = <tr><td colspan="5">Invalid user</td></tr>;
    return;
  }

  try{
    const q = query(
      collection(db, "income_history"),
      where("username", "==", username),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const snap = await getDocs(q);

    if(snap.empty){
      tbody.innerHTML =
        <tr><td colspan="5">No income / transaction history yet.</td></tr>;
      return;
    }

    let rows = "";
    let i = 1;

    snap.forEach(docSnap => {
      const d = docSnap.data();
      const amt = Number(d.amount || 0);

      let dateStr = "-";
      if(d.createdAt && d.createdAt.toDate){
        dateStr = d.createdAt.toDate().toLocaleString();
      }

      rows += `
        <tr>
          <td>${i}</td>
          <td>${dateStr}</td>
          <td>
            <span class="txn-tag">${typeLabel(d.type)}</span>
          </td>
          <td>${d.remark || "-"}</td>
          <td class="${amt>=0?'txn-plus':'txn-minus'}">
            ${fmtAmount(amt)}
          </td>
        </tr>
      `;
      i++;
    });

    tbody.innerHTML = rows;

  }catch(err){
    console.error("Dashboard txn load error:", err);
    tbody.innerHTML =
      <tr><td colspan="5">Error loading history</td></tr>;
  }
}

document.addEventListener("DOMContentLoaded", loadDashboardTxn);