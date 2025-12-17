// global-bonus.js
// NEW SALES ভিত্তিক Global Sales Bonus + Gift Voucher
// কোনও পুরোনো sales এর উপর বারবার কমিশন যাবে না।

console.log("BUILD:", "20251217_1");
import { db } from "./firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  updateDoc,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const cfgRef = doc(db, "config", "global");

// ছোট হেল্পার
function $(id){ return document.getElementById(id); }
function fmt(v){ return "$" + Number(v || 0).toFixed(2); }

/* ---------------- COMMON INLINE CREDIT ----------------
   type:
    - "global" → globalIncome + earningBalance + totalEarning
    - "gift"   → giftVoucherIncome/giftVoucher + earningBalance + totalEarning
------------------------------------------------------- */
async function creditIncomeInline(username, amount, type){
  const uRef = doc(db, "users", username.toLowerCase());
  const snap = await getDoc(uRef);
  if(!snap.exists()) throw new Error("User not found: " + username);

  const u = snap.data();
  const inc = Number(amount || 0);
  if(!inc || inc <= 0) return;

  const updates = {};

  // সব ইনকাম আগে earning + totalEarning এ যোগ হবে
  const earning = Number(u.earningBalance || 0) + inc;
  const total   = Number(u.totalEarning    || 0) + inc;
  updates.earningBalance = earning;
  updates.totalEarning   = total;

  if(type === "global"){
    const g = Number(u.globalIncome || 0) + inc;
    updates.globalIncome = g;
  }else if(type === "gift"){
    const g = Number(u.giftVoucherIncome || u.giftVoucher || 0) + inc;
    updates.giftVoucherIncome = g;
    updates.giftVoucher       = g;
  }

  await updateDoc(uRef, updates);
}

/* ---------------- INCOME HISTORY LOG ----------------- */
async function logIncomeHistory(username, amount, type, remark){
  try{
    await addDoc(collection(db,"income_history"),{
      username: username.toLowerCase(),
      amount : Number(amount || 0),
      type   : type || "global",
      remark : remark || "",
      createdAt: serverTimestamp()
    });
  }catch(err){
    console.error("logIncomeHistory error:", err);
  }
}

/* ------------- CONFIG LOAD (UI label update) ---------- */
async function loadGlobalBox(){
  try{
    const snap = await getDoc(cfgRef);
    if(!snap.exists()) return;
    const cfg = snap.data();

    if($("lblAutoSales"))
      $("lblAutoSales").textContent = fmt(cfg.autoGlobalSales || 0);
    if($("lblManualExtra"))
      $("lblManualExtra").textContent = fmt(cfg.manualGlobalExtra || 0);
    if($("lblEffectiveSales"))
      $("lblEffectiveSales").textContent = fmt(cfg.effectiveGlobalSales || 0);
    if($("lblLastInfo"))
      $("lblLastInfo").textContent = cfg.lastGlobalRefreshInfo || "No run yet.";

    if($("poolPercentA") && cfg.globalPoolPercentA != null)
      $("poolPercentA").value = cfg.globalPoolPercentA;
    if($("poolPercentB") && cfg.globalPoolPercentB != null)
      $("poolPercentB").value = cfg.globalPoolPercentB;

    if($("globalStatus") && cfg.lastGlobalBonusInfo)
      $("globalStatus").textContent = cfg.lastGlobalBonusInfo;

  }catch(err){
    console.error("loadGlobalBox error:",err);
  }
}

/* ------------- REFRESH GLOBAL SUMMARY -----------------
   এখানে আমরা শুধুই NEW SALES বের করব:
   - currentTotalSales = সব Premium user-এর depositTotal এর যোগফল
   - lastSales = cfg.globalLastSales (আগের রাউন্ড পর্যন্ত মোট sales)
   - newSales = currentTotalSales - lastSales (কম হলে 0)
   - effectiveSales = newSales + manualGlobalExtra
-------------------------------------------------------- */
async function refreshGlobalSummary(){
  const statusEl = $("globalStatus");
  if(statusEl) statusEl.textContent = "Refreshing NEW global sales…";

  try{
    // সব premium user (ফ্রি ID বাদ)
    const qUsers = query(
      collection(db,"users"),
      where("membershipType","==","premium")
    );
    const snap = await getDocs(qUsers);

    let currentTotalSales = 0;
    snap.forEach(ds=>{
      const u = ds.data();
      currentTotalSales += Number(u.depositTotal || 0);
    });

    const cfgSnap = await getDoc(cfgRef);
    const cfg = cfgSnap.exists() ? cfgSnap.data() : {};

    const lastSales  = Number(cfg.globalLastSales || 0);     // আগের পর্যন্ত
    let   manualExtra= Number(cfg.manualGlobalExtra || 0);   // admin add করা extra
    let   newSales   = currentTotalSales - lastSales;        // এই রাউন্ডের নতুন সেলস

    if(newSales < 0) newSales = 0;                           // safety

    const effectiveTotal = newSales + manualExtra;

    const infoText =
      "Last refresh " + new Date().toLocaleString() +
      " – NEW sales: " + fmt(newSales) +
      ", Effective: " + fmt(effectiveTotal);

    await setDoc(
      cfgRef,
      {
        autoGlobalSales      : newSales,       // এই রাউন্ডের new sales
        manualGlobalExtra    : manualExtra,
        effectiveGlobalSales : effectiveTotal,
        lastGlobalRefreshInfo: infoText,
        lastGlobalRefreshAt  : serverTimestamp()
      },
      {merge:true}
    );

    if($("lblAutoSales"))      $("lblAutoSales").textContent      = fmt(newSales);
    if($("lblManualExtra"))    $("lblManualExtra").textContent    = fmt(manualExtra);
    if($("lblEffectiveSales")) $("lblEffectiveSales").textContent = fmt(effectiveTotal);
    if($("lblLastInfo"))       $("lblLastInfo").textContent       = infoText;

    if(statusEl) statusEl.textContent = "Global sales (NEW) refreshed.";
  }catch(err){
    console.error("refreshGlobalSummary error:",err);
    if(statusEl) statusEl.textContent = "Error: " + (err.message || err);
  }
}

/* ------------- DISTRIBUTE GLOBAL BONUS ----------------
   - effectiveSales = cfg.effectiveGlobalSales
   - override > 0 হলে override amount ব্যবহার হবে
   - শুধু premium + depositTotal>0 ইউজারদের উপর proportionally ভাগ
   - শেষে:
      globalLastSales += autoGlobalSales (এই রাউন্ডের new sales consume)
      autoGlobalSales, manualGlobalExtra, effectiveGlobalSales = 0
-------------------------------------------------------- */
async function distributeGlobalBonus(){
  const statusEl = $("globalStatus");
  if(statusEl) statusEl.textContent = "Distributing global bonus from NEW sales…";

  try{
    const cfgSnap = await getDoc(cfgRef);
    if(!cfgSnap.exists()){
      if(statusEl) statusEl.textContent = "No global config found.";
      return;
    }
    const cfg = cfgSnap.data();

    const newSales       = Number(cfg.autoGlobalSales      || 0);
    const manualExtra    = Number(cfg.manualGlobalExtra    || 0);
    let   effectiveSales = Number(cfg.effectiveGlobalSales || 0);

    // Optional override
    const overrideBox = $("totalOverride");
    const overrideVal = overrideBox ? Number(overrideBox.value || 0) : 0;
    if(overrideVal > 0) effectiveSales = overrideVal;

    if(effectiveSales <= 0){
      if(statusEl) statusEl.textContent = "No NEW effective sales to distribute.";
      return;
    }

    // pool %
    const poolInput = $("poolPercentA");
    const poolPercent = poolInput ? Number(poolInput.value || 3) : 3;
    if(poolPercent <= 0){
      if(statusEl) statusEl.textContent = "Please set pool % first.";
      return;
    }

    // সব premium user
    const qUsers = query(
      collection(db,"users"),
      where("membershipType","==","premium")
    );
    const snap = await getDocs(qUsers);
    if(snap.empty){
      if(statusEl) statusEl.textContent = "No premium users.";
      return;
    }

    let totalDeposit = 0;
    const users = [];
    snap.forEach(ds=>{
      const u   = ds.data();
      const dep = Number(u.depositTotal || 0);
      if(dep > 0){
        users.push({username: ds.id, dep});
        totalDeposit += dep;
      }
    });

    if(totalDeposit <= 0){
      if(statusEl) statusEl.textContent = "Total deposit is 0.";
      return;
    }

    const poolAmount = (effectiveSales * poolPercent) / 100;

    for(const u of users){
      const share = (poolAmount * u.dep) / totalDeposit;
      if(share <= 0) continue;

      await creditIncomeInline(u.username, share, "global");
      await logIncomeHistory(u.username, share, "global", "Global sales bonus");
    }

    // এই রাউন্ডের new sales এখন consumed
    const prevLastSales = Number(cfg.globalLastSales || 0);
    const updatedLast   = prevLastSales + Number(newSales || 0);

    const infoText =
      "Last global bonus: " +
      poolPercent + "% of " +
      fmt(effectiveSales) + " = " +
      fmt(poolAmount) + " distributed to " +
      users.length + " premium users.";

    await setDoc(
      cfgRef,
      {
        globalLastSales      : updatedLast,
        autoGlobalSales      : 0,
        manualGlobalExtra    : 0,
        effectiveGlobalSales : 0,
        lastGlobalBonusInfo  : infoText,
        lastGlobalBonusAt    : serverTimestamp(),
        globalPoolPercentA   : poolPercent
      },
      {merge:true}
    );

    if(statusEl) statusEl.textContent = infoText;

  }catch(err){
    console.error("distributeGlobalBonus error:",err);
    if(statusEl) statusEl.textContent = "Error: " + (err.message || err);
  }
}

/* ------------- SEND GIFT VOUCHER (MANUAL) --------------
   - শুধু Premium user পাবে
   - giftVoucherIncome/giftVoucher + earningBalance + totalEarning
-------------------------------------------------------- */
async function sendGiftVoucher(){
  const statusEl = $("giftStatus");
  const userEl   = $("giftUser");
  const amtEl    = $("giftAmount");
  const noteEl   = $("giftNote");

  const username = userEl ? userEl.value.trim().toLowerCase() : "";
  const amount   = amtEl ? Number(amtEl.value || 0) : 0;
  const remark   = noteEl ? noteEl.value.trim() : "";

  if(!username){
    alert("Please enter username.");
    return;
  }
  if(!amount || amount <= 0){
    alert("Please enter valid gift amount.");
    return;
  }

  if(statusEl) statusEl.textContent = "Sending gift voucher…";

  try{
    const uRef  = doc(db,"users", username);
    const uSnap = await getDoc(uRef);
    if(!uSnap.exists()){
      if(statusEl) statusEl.textContent = "User not found.";
      alert("User not found: " + username);
      return;
    }
    const u = uSnap.data();
    if((u.membershipType || "free") !== "premium"){
      const msg = "Only premium members can receive gift voucher.";
      if(statusEl) statusEl.textContent = msg;
      alert(msg);
      return;
    }

    await creditIncomeInline(username, amount, "gift");
    await logIncomeHistory(
      username,
      amount,
      "gift",
      remark || "Gift voucher (admin)"
    );

    if(statusEl)
      statusEl.textContent =
        "Gift sent: " + username + " received " + fmt(amount) + ".";

    alert("✅ Gift voucher sent successfully.");

    if(amtEl)  amtEl.value  = "";
    if(noteEl) noteEl.value = "";

  }catch(err){
    console.error("sendGiftVoucher error:",err);
    if(statusEl) statusEl.textContent = "Error: " + (err.message || err);
    alert("Error sending gift: " + (err.message || err));
  }
}

/* ------------- INIT (optional – label load) ----------- */
async function initGlobalBonus(){
  await loadGlobalBox();
}
initGlobalBonus().catch(console.error);

/* ------------- WINDOW EXPOSE (HTML onclick এর জন্য) --- */
window.refreshGlobalSummary = refreshGlobalSummary;
window.distributeGlobalBonus = distributeGlobalBonus;
window.sendGiftVoucher       = sendGiftVoucher;