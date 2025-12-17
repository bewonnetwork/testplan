// admin-global.js
import { db } from "./firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

import { creditIncome } from "./income-helpers.js";

const STORAGE_CURRENT = "btx_current_user_v1";

// ---------- helper ----------

function getCurrentUser(){
  const raw = localStorage.getItem(STORAGE_CURRENT);
  if(!raw) return null;
  try{ return JSON.parse(raw); }catch{ return null; }
}

function fmt(v){
  return "$" + Number(v || 0).toFixed(2);
}

function $(id){ return document.getElementById(id); }

// ---------- basic nav ----------

function goAdmin(){
  window.location.href = "admin.html";
}
window.goAdmin = goAdmin;

// ---------- load & show company stats ----------

const statsRef = doc(db,"config","company_stats");

async function loadStats(){
  let snap = await getDoc(statsRef);
  if(!snap.exists()){
    // প্রথমবার হলে doc তৈরি করে নেই
    await setDoc(statsRef,{
      autoTotalSales: 0,
      manualExtraSales: 0,
      lastTotalSalesUsed: 0,
      lastPoolA: 0,
      lastPoolB: 0,
      lastRunAt: null
    });
    snap = await getDoc(statsRef);
  }

  const d = snap.data();
  const auto   = Number(d.autoTotalSales   || 0);
  const manual = Number(d.manualExtraSales || 0);
  const eff    = auto + manual;

  if($("autoSales"))      $("autoSales").textContent      = fmt(auto);
  if($("manualSales"))    $("manualSales").textContent    = fmt(manual);
  if($("effectiveSales")) $("effectiveSales").textContent = fmt(eff);

  if($("inputTotalSales") && !$("inputTotalSales").value){
    // override ফাঁকা রাখি – চাইলে তুমি auto fill করতে পারো
    $("inputTotalSales").placeholder = eff > 0 ? eff.toFixed(2) : "leave blank = " + eff.toFixed(2);
  }

  let lastInfo = "No run yet.";
  if(d.lastRunAt){
    let ts = d.lastRunAt.toDate ? d.lastRunAt.toDate() : new Date(d.lastRunAt);
    lastInfo =
      `Last run at ${ts.toLocaleString()} – Total used: ${fmt(d.lastTotalSalesUsed || 0)}, ` +
      PoolA: ${fmt(d.lastPoolA || 0)}, PoolB: ${fmt(d.lastPoolB || 0)};
  }
  if($("lastGlobalInfo")) $("lastGlobalInfo").textContent = lastInfo;
}

// Admin panel থেকে auto sales রিফ্রেশ – আপাতত শুধু doc রিড করি
window.refreshCompanySales = async function(){
  try{
    await loadStats();
    alert("Auto total sales refreshed from company_stats.");
  }catch(err){
    console.error("refreshCompanySales error:",err);
    alert("Refresh error: " + (err.message || err));
  }
};

// ---------- main: distribute global bonus ----------

window.runGlobalBonus = async function(){
  const me = getCurrentUser();
  if(!me || me.role !== "admin"){
    alert("Only admin can use this page.");
    window.location.href = "login.html";
    return;
  }

  await loadStats();
  const snap = await getDoc(statsRef);
  const d = snap.data() || {};
  const auto   = Number(d.autoTotalSales   || 0);
  const manual = Number(d.manualExtraSales || 0);
  const eff    = auto + manual;

  const inpTotal = $("inputTotalSales");
  const inpA     = $("inputPoolA");
  const inpB     = $("inputPoolB");

  let totalSales = Number(inpTotal && inpTotal.value ? inpTotal.value : eff);
  if(!totalSales || totalSales <= 0){
    alert("Total Sales must be positive. Either override box বা auto+manual ঠিক করে নাও।");
    return;
  }

  const pctA = Number(inpA && inpA.value ? inpA.value : 3);
  const pctB = Number(inpB && inpB.value ? inpB.value : 2);

  if(pctA < 0 || pctB < 0){
    alert("Pool percentage must be >= 0.");
    return;
  }

  const poolA = totalSales * (pctA/100);
  const poolB = totalSales * (pctB/100);

  // eligible member query
  const usersCol = collection(db,"users");

  const qA = query(
    usersCol,
    where("membershipType","==","premium"),
    where("depositTotal",">=",500),
    where("depositTotal","<",1000)
  );

  const qB = query(
    usersCol,
    where("membershipType","==","premium"),
    where("depositTotal",">=",1000)
  );

  try{
    const [snapA, snapB] = await Promise.all([
      getDocs(qA),
      getDocs(qB)
    ]);

    const countA = snapA.size;
    const countB = snapB.size;

    if(countA === 0 && countB === 0){
      alert("কোনো qualified premium member পাওয়া যায়নি (depositTotal 500+).");
      return;
    }

    const shareA = countA ? (poolA / countA) : 0;
    const shareB = countB ? (poolB / countB) : 0;

    let tasks = [];

    if(shareA > 0){
      snapA.forEach(docSnap =>{
        const u = docSnap.data();
        const uname = (u.username || docSnap.id || "").toLowerCase();
        if(uname){
          tasks.push( creditIncome(uname, shareA, "global") );
        }
      });
    }

    if(shareB > 0){
      snapB.forEach(docSnap =>{
        const u = docSnap.data();
        const uname = (u.username || docSnap.id || "").toLowerCase();
        if(uname){
          tasks.push( creditIncome(uname, shareB, "global") );
        }
      });
    }

    await Promise.all(tasks);

    // stats আপডেট – যেন পরে দেখতে পারো
    await updateDoc(statsRef,{
      lastTotalSalesUsed: totalSales,
      lastPoolA: poolA,
      lastPoolB: poolB,
      lastRunAt: serverTimestamp()
    });

    await loadStats();

    alert(
      "✅ Global Sales Bonus distributed!\n\n" +
      "Total Sales used: " + totalSales.toFixed(2) + " USDT\n" +
      "Pool A ("+pctA+"% → 500–999): " + poolA.toFixed(2) + " USDT\n" +
      "Pool B ("+pctB+"% → 1000+): " + poolB.toFixed(2) + " USDT\n" +
      "Members A: " + countA + " • Members B: " + countB
    );

  }catch(err){
    console.error("runGlobalBonus error:",err);
    alert("Global bonus error: " + (err.message || err));
  }
};

// ---------- GIFT VOUCHER (manual) ----------

window.sendGiftVoucher = async function(){
  const me = getCurrentUser();
  if(!me || me.role !== "admin"){
    alert("Only admin can send gift voucher.");
    window.location.href = "login.html";
    return;
  }

  const uInput   = $("giftUser");
  const aInput   = $("giftAmount");
  const rInput   = $("giftRemark");

  const username = uInput.value.trim().toLowerCase();
  const amount   = Number(aInput.value || 0);
  const remark   = rInput.value.trim();

  if(!username){
    alert("Username লিখো.");
    return;
  }
  if(!amount || amount <= 0){
    alert("Gift amount positive হতে হবে.");
    return;
  }

  try{
    const uRef = doc(db,"users",username);
    const uSnap = await getDoc(uRef);
    if(!uSnap.exists()){
      alert("User পাওয়া যায়নি: " + username);
      return;
    }
    const u = uSnap.data();
    if((u.membershipType || "free") !== "premium"){
      alert("এই user premium না – gift voucher শুধু premium ID এর জন্য।");
      return;
    }

    // মূল ইনকাম – সব হিসাব income-helpers এ
    await creditIncome(username, amount, "gift");

    // চাইলে এখানে income_history তে একটি লাইন রাখতে পারো
    // (ইচ্ছে করলে পরে add করব)

    alert("✅ Gift voucher sent to @" + username + " Amount: " + amount.toFixed(2) + " USDT");

    uInput.value = "";
    aInput.value = "";
    rInput.value = "";

  }catch(err){
    console.error("sendGiftVoucher error:",err);
    alert("Gift voucher error: " + (err.message || err));
  }
};

// ---------- init ----------

(async function(){
  // admin check
  const me = getCurrentUser();
  if(!me || me.role !== "admin"){
    alert("Only admin can access Global & Gift Panel.");
    window.location.href = "login.html";
    return;
  }

  try{
    await loadStats();
  }catch(err){
    console.error("init admin-global error:",err);
  }
})();