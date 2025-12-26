import { db } from "./firebase-config.js";
import { doc, getDoc, updateDoc } 
from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const STORAGE_CURRENT = "btx_current_user_v1";
const $ = (id) => document.getElementById(id);

function getCurrentUser(){
  try{
    return JSON.parse(localStorage.getItem(STORAGE_CURRENT) || "");
  }catch{
    return null;
  }
}

function setCurrentUser(u){
  localStorage.setItem(STORAGE_CURRENT, JSON.stringify(u));
}

function fmt(v){
  return "$" + Number(v || 0).toFixed(2);
}

async function loadPage(){
  const me = getCurrentUser();
  if(!me) return location.href = "login.html";

  const username = (me.username || "").toLowerCase().trim();
  if(!username) return location.href = "login.html";

  const ref = doc(db,"users",username);
  const snap = await getDoc(ref);
  const u = snap.exists() ? snap.data() : me;

  $("uUsername").textContent = u.username || username;
  $("uMembership").textContent = u.membershipType || "free";
  $("uBalance").textContent = fmt(u.addBalance || 0);
  $("uDepositTotal").textContent = fmt(u.depositTotal || 0);

  setCurrentUser({ ...me, ...u });
}

async function submitUpgrade(){
  console.log("✅ upgrade clicked");

  const me = getCurrentUser();
  if(!me) return alert("Login again");

  const username = (me.username || "").toLowerCase().trim();
  const raw = ($("invAmount")?.value || "").trim();
  const amount = Number(raw || 0);

  console.log("DEBUG username:", username, "amount:", amount);

  if(!raw || isNaN(amount) || amount < 10){
    return alert("Minimum 10 USDT");
  }

  const ref = doc(db,"users",username);
  const snap = await getDoc(ref);
  if(!snap.exists()) return alert("User not found");

  const u = snap.data();
  console.log("DEBUG my user doc:", u);

  const bal = Number(u.addBalance || 0);
  if(bal < amount) return alert("Not enough Add Balance");

  const newBal = bal - amount;
  const newDep = Number(u.depositTotal || 0) + amount;

  // ✅ 1) upgrade
  await updateDoc(ref,{
    addBalance: newBal,
    depositTotal: newDep,
    membershipType: "premium"
  });

  // ✅ 2) sponsor commission (never blocks upgrade)
  try{
    const mod = await import("./sponsor-engine.js");
    const res = await mod.paySponsorCommission(username, amount);
    console.log("✅ sponsor result:", res);
    alert("Sponsor Result: " + JSON.stringify(res));
  }catch(err){
    console.warn("Sponsor engine error (upgrade ok):", err);
  }

  // ✅ 3) UI + local
  setCurrentUser({
    ...me,
    addBalance: newBal,
    depositTotal: newDep,
    membershipType: "premium"
  });

  $("uMembership").textContent = "premium";
  $("uBalance").textContent = fmt(newBal);
  $("uDepositTotal").textContent = fmt(newDep);
  $("invAmount").value = "";

  alert("✅ Upgrade Done");
}

document.addEventListener("DOMContentLoaded", async ()=>{
  $("btnUpgrade")?.addEventListener("click", submitUpgrade);
  $("btnBack")?.addEventListener("click", ()=>location.href="dashboard.html");
  await loadPage();
});

// optional manual test
window.submitUpgrade = submitUpgrade;