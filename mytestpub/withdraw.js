// withdraw.js – Firestore ভিত্তিক withdraw request (record create)

import { db } from "./firebase-config.js";
import {
  doc, getDoc,
  addDoc, collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const STORAGE_CURRENT = "btx_current_user_v1";
const $ = (id) => document.getElementById(id);

function getCurrentUser(){
  try{
    const raw = localStorage.getItem(STORAGE_CURRENT);
    return raw ? JSON.parse(raw) : null;
  }catch(e){
    return null;
  }
}

async function handleWithdrawSubmit(e){
  e.preventDefault();

  const me = getCurrentUser();
  if(!me){
    alert("Please login again.");
    location.href = "login.html";
    return;
  }

  const username = String(me.username || "").toLowerCase().trim();
  if(!username){
    alert("Username missing.");
    return;
  }

  const amount  = Number(($("wdAmount").value || "").trim() || 0);
  const method  = String($("wdMethod").value || "").trim();
  const wallet  = String($("wdWallet").value || "").trim();

  if(!amount || isNaN(amount) || amount < 10){
    alert("Minimum withdraw 10 USDT.");
    return;
  }
  if(!wallet){
    alert("Wallet address দিন।");
    return;
  }

  // ✅ fresh user data
  const userRef = doc(db, "users", username);
  const userSnap = await getDoc(userRef);
  if(!userSnap.exists()){
    alert("User profile পাওয়া যায়নি।");
    return;
  }

  const u = userSnap.data();
  const earning = Number(u.earningBalance || 0);

  if(earning < amount){
    alert("❌ আপনার earning balance এ পর্যাপ্ত টাকা নেই।");
    return;
  }

  // ✅ Create withdraw record (pending)
  await addDoc(collection(db, "withdraws"),{
    username,
    amount,
    method,
    wallet,
    status: "pending",
    createdAt: serverTimestamp()
  });

  alert("✅ Withdraw request submitted (pending). Admin approve করলে paid হবে।");
  location.href = "dashboard.html";
}

document.addEventListener("DOMContentLoaded", ()=>{
  const form = $("wdForm");
  if(!form){
    console.error("wdForm not found");
    return;
  }
  form.addEventListener("submit", handleWithdrawSubmit);
});