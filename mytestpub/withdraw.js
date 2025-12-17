// withdraw.js – Firestore ভিত্তিক withdraw request

import { db } from "./firebase-config.js";
import {
  doc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const STORAGE_CURRENT = "btx_current_user_v1";

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
    window.location.href = "login.html";
    return;
  }
  const username = (me.username || "").toLowerCase();
  if(!username){
    alert("Username missing.");
    return;
  }

  const amount  = Number(document.getElementById("wdAmount").value || 0);
  const method  = document.getElementById("wdMethod").value || "";
  const address = document.getElementById("wdWallet").value.trim();

  if(!amount || amount < 10){
    alert("Minimum withdraw 10 USDT.");
    return;
  }
  if(!address){
    alert("Wallet address দিন।");
    return;
  }

  // 🔥 Firestore থেকে fresh user ডাটা
  const userRef  = doc(db,"users",username);
  const userSnap = await getDoc(userRef);
  if(!userSnap.exists()){
    alert("User profile পাওয়া যায়নি।");
    return;
  }
  const u = userSnap.data();
  const earning = Number(u.earningBalance || 0);

  if(earning < amount){
    alert("❌ আপনার balance এ পর্যাপ্ত টাকা নেই।");
    return;
  }

  // শুধু request তৈরি হবে, টাকা কাটবে admin approve-এর সময়
  await addDoc(collection(db,"withdraws"),{
    username,
    amount,
    method,
    wallet: address,
    status: "pending",
    createdAt: serverTimestamp()
  });

  alert("✅ Withdraw request submitted. Please wait for admin approval.");
  window.location.href = "dashboard.html";
}

// INIT
document.addEventListener("DOMContentLoaded", ()=>{
  const form = document.getElementById("wdForm");
  if(!form){
    console.error("wdForm not found");
    return;
  }
  form.addEventListener("submit", handleWithdrawSubmit);
});