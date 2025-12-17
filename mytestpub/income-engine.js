/********************
 * BTX.ONE – Income Engine (v2)
 * -----------------------------------------
 * - সব কম্পেনসেশন / ROI হিসাব এখানে হবে
 * - কাজ করবে pure localStorage এর উপর
 * - users key:  "btx_users_v1"
 *
 * এই ফাইলটা রাখো:  public/income-engine.js
 ********************/

// ---------- CONSTANTS ----------
const IE_STORAGE_USERS = "btx_users_v1";

// প্ল্যান কনফিগ – Admin panel থেকে future এ dynamic করা যাবে
const IE_PLAN = {
  // ROI
  roiPercentPerDay: 1.2,   // প্রতিদিন ROI %, উদাহরণ: 1–1.5%

  // Direct sponsor % (deposit এর উপর একবার)
  sponsorPercent: 5,

  // 20 level generation বোর্ড – তুমি আগেই যেটা ঠিক করেছো
  // percent গুলোর sum ~100 হলে ভালো হয়


  console.log("BUILD:", "20251217_1");
  genLevels: [
    { level: 1,  percent: 20, reqDirect: 1 },
    { level: 2,  percent: 10, reqDirect: 2 },
    { level: 3,  percent:  8, reqDirect: 3 },
    { level: 4,  percent:  5, reqDirect: 4 },
    { level: 5,  percent:  5, reqDirect: 5 },
    { level: 6,  percent:  4, reqDirect: 6 },
    { level: 7,  percent:  4, reqDirect: 7 },
    { level: 8,  percent:  4, reqDirect: 8 },
    { level: 9,  percent:  4, reqDirect: 9 },
    { level:10,  percent:  4, reqDirect:10 },
    { level:11,  percent:  3, reqDirect:11 },
    { level:12,  percent:  3, reqDirect:12 },
    { level:13,  percent:  3, reqDirect:13 },
    { level:14,  percent:  3, reqDirect:14 },
    { level:15,  percent:  3, reqDirect:15 },
    { level:16,  percent:  2, reqDirect:16 },
    { level:17,  percent:  2, reqDirect:17 },
    { level:18,  percent:  2, reqDirect:18 },
    { level:19,  percent:  1, reqDirect:19 },
    { level:20,  percent:  1, reqDirect:20 },
  ],

  // Gift voucher কমিশন (deposit এর উপর নিজের জন্য)
  giftVoucherPercent: 1,

  // 3X barometer – মোট earning (ROI + Affiliate) <= selfDeposit * 3
  maxMultiple: 3,

  // ROI এর উপর affiliate pool – 100% মানে
  // নিজে যত ROI পাবে, network মোটেও তত পাবে (20 level এ ভাগ হয়ে যাবে)
  roiAffiliateMultiplier: 1   // 1x = 100%
};

// ---------- Basic helpers ----------
function ieLoadUsers(){
  const raw = localStorage.getItem(IE_STORAGE_USERS);
  if (!raw) return [];
  try { return JSON.parse(raw); }
  catch(e){ return []; }
}

function ieSaveUsers(list){
  localStorage.setItem(IE_STORAGE_USERS, JSON.stringify(list || []));
}

function ieFindUser(username, users){
  const uName = (username || "").toLowerCase();
  return users.find(u => (u.username || "").toLowerCase() === uName) || null;
}

/**
 * সব income / wallet field safe করে সেট করে দেই
 */
function ieEnsureIncomeFields(u){
  if (!u) return;

  // Investment
  u.depositTotal     = Number(u.depositTotal     || 0); // self investment
  u.packageAmount    = Number(u.packageAmount    || 0); // active package
  u.totalInvestment  = Number(u.totalInvestment  || u.depositTotal || 0); // self-এর total
  u.teamInvestment   = Number(u.teamInvestment   || 0); // team-এর investment

  // Wallets
  u.addBalance       = Number(u.addBalance       || 0); // Add balance / current balance
  u.earningBalance   = Number(u.earningBalance   || 0); // ROI + সকল income (withdraw wallet)
  u.voucherBalance   = Number(u.voucherBalance   || 0); // Gift voucher wallet

  // Income breakdown
  u.directIncome     = Number(u.directIncome     || 0);
  u.teamIncome       = Number(u.teamIncome       || 0); // এখানে generation income রাখবো
  u.rankIncome       = Number(u.rankIncome       || 0);
  u.globalIncome     = Number(u.globalIncome     || 0);
  u.giftVoucherIncome= Number(u.giftVoucherIncome|| 0);

  // ROI
  u.dailyROI         = Number(u.dailyROI         || 0); // ১ দিনের ROI (today base)
  u.roiEarned        = Number(u.roiEarned        || 0); // এখন পর্যন্ত মোট ROI

  // Misc
  u.directCount      = Number(u.directCount      || u.teamCount || 0); // পুরনো teamCount holeo নেবে
}

/**
 * মোট income – 3X barometer হিসাবের জন্য
 * এখানে শুধু earning type গুলো count হবে, deposit / transfer না
 */
function ieTotalIncome(u){
  ieEnsureIncomeFields(u);
  return (
    (u.directIncome       || 0) +
    (u.teamIncome         || 0) +
    (u.rankIncome         || 0) +
    (u.globalIncome       || 0) +
    (u.giftVoucherIncome  || 0) +
    (u.roiEarned          || 0)
  );
}

/**
 * 3X barometer helper
 */
function ieBarometer(u){
  ieEnsureIncomeFields(u);
  const selfDep = u.depositTotal || 0;
  const max     = selfDep * IE_PLAN.maxMultiple;
  const used    = ieTotalIncome(u);
  const remain  = Math.max(0, max - used);
  const usedPct = max > 0 ? Math.min(100, (used / max) * 100) : 0;
  return {
    max, used, remain,
    usedPercent: Number(usedPct.toFixed(2))
  };
}

// ---------- Team Investment (self + team) ----------

/**
 * পুরো tree থেকে teamInvestment + totalInvestment refresh করবে
 * (admin পেজ থেকে manual একটা button দিয়ে call করতে পারো)
 */
function ieRecalcTeamAndTotals(){
  const users = ieLoadUsers();
  const byName = {};
  users.forEach(u => {
    ieEnsureIncomeFields(u);
    if (u.username){
      byName[String(u.username).toLowerCase()] = u;
    }
    // reset
    u.teamInvestment  = 0;
    u.totalInvestment = u.depositTotal || 0;
  });

  users.forEach(member => {
    const dep = member.depositTotal || 0;
    let sponsor = (member.sponsor_username || "").toLowerCase();
    while (sponsor){
      const up = byName[sponsor];
      if (!up) break;
      up.teamInvestment += dep;
      sponsor = (up.sponsor_username || "").toLowerCase();
    }
  });

  ieSaveUsers(users);
  return users;
}

// ---------- Package activation (deposit + affiliate on deposit) ----------

/**
 * কোন member যখন package নিবে (deposit সফল হবে),
 * তখন admin panel / script থেকে call করবে:
 *   ieActivatePackage("username", 200);
 *
 * এটা শুধু LOCAL data update করবে (btx_users_v1)
 */
function ieActivatePackage(username, amount){
  amount = Number(amount || 0);
  if (!username || amount <= 0){
    alert("Package activate করতে username এবং amount দরকার।");
    return;
  }

  const users  = ieLoadUsers();
  const member = ieFindUser(username, users);
  if (!member){
    alert("Member পাওয়া যায়নি: " + username);
    return;
  }

  ieEnsureIncomeFields(member);

  // --- self investment update ---
  member.depositTotal    += amount;
  member.packageAmount   += amount;
  member.totalInvestment = member.depositTotal;

  // ROI per day update – প্রতি দিন একই rate এ যাবে
  member.dailyROI = member.packageAmount * IE_PLAN.roiPercentPerDay / 100;

  // ---------- Direct sponsor (deposit এর উপর একবার) ----------
  if (member.sponsor_username){
    const sp = ieFindUser(member.sponsor_username, users);
    if (sp){
      ieEnsureIncomeFields(sp);
      const spIncRaw = amount * IE_PLAN.sponsorPercent / 100;

      // 3X cap respect (sponsor)
      const cap   = (sp.depositTotal || 0) * IE_PLAN.maxMultiple;
      const used  = ieTotalIncome(sp);
      const room  = Math.max(0, cap - used);
      const spInc = Math.min(room, spIncRaw);

      sp.directIncome   += spInc;
      sp.earningBalance += spInc;
    }
  }

  // ---------- Generation bonus (deposit এর উপর) ----------
  let uplineName = member.sponsor_username || "";
  for (let i = 0; i < IE_PLAN.genLevels.length; i++){
    if (!uplineName) break;
    const levelConf = IE_PLAN.genLevels[i];
    const up        = ieFindUser(uplineName, users);
    if (!up) break;

    ieEnsureIncomeFields(up);
    const directCount = up.directCount || 0;

    if (directCount >= levelConf.reqDirect){
      const genRaw = amount * levelConf.percent / 100;

      const cap   = (up.depositTotal || 0) * IE_PLAN.maxMultiple;
      const used  = ieTotalIncome(up);
      const room  = Math.max(0, cap - used);
      const genInc = Math.min(room, genRaw);

      up.teamIncome     += genInc;
      up.earningBalance += genInc;
    }

    uplineName = up.sponsor_username || "";
  }

  // ---------- Gift voucher (deposit এর উপর নিজের জন্য) ----------
  const giftRaw = amount * IE_PLAN.giftVoucherPercent / 100;
  const capSelf = (member.depositTotal || 0) * IE_PLAN.maxMultiple;
  const usedSelf= ieTotalIncome(member);
  const roomSelf= Math.max(0, capSelf - usedSelf);
  const giftInc = Math.min(roomSelf, giftRaw);

  member.giftVoucherIncome += giftInc;
  member.earningBalance    += giftInc;
  member.voucherBalance    += giftInc; // চাইলে শুধু gift wallet এ রাখবে

  ieSaveUsers(users);
  alert("✅ Package activation income হিসাব হয়ে গেল (local data)।");
}

// ---------- Daily ROI + ROI based affiliate ----------

/**
 * daily ROI + 100% affiliate:
 *
 * উদাহরণ:
 *   self deposit = 1000
 *   ROI% = 1% → আজকের self ROI = 10
 *   roiAffiliateMultiplier = 1 → affiliate pool = 10
 *   মোট payout আজকের জন্য = 20
 *
 * 3X barometer সব জায়গায় respect করা হয়েছে।
 */
function ieDistributeRoiAffiliate(users, member, roiAmount){
  if (!roiAmount || roiAmount <= 0) return;

  let uplineName = member.sponsor_username || "";
  const pool     = roiAmount * IE_PLAN.roiAffiliateMultiplier;

  for (let i = 0; i < IE_PLAN.genLevels.length; i++){
    if (!uplineName) break;
    const conf = IE_PLAN.genLevels[i];
    const up   = ieFindUser(uplineName, users);
    if (!up) break;

    ieEnsureIncomeFields(up);

    const directCount = up.directCount || 0;
    if (directCount >= conf.reqDirect){
      const genRaw  = pool * conf.percent / 100;
      const cap     = (up.depositTotal || 0) * IE_PLAN.maxMultiple;
      const used    = ieTotalIncome(up);
      const room    = Math.max(0, cap - used);
      const genInc  = Math.min(room, genRaw);

      up.teamIncome     += genInc;
      up.earningBalance += genInc;
    }

    uplineName = up.sponsor_username || "";
  }
}

/**
 * ১ দিনের ROI + affiliate run করবে সব active package এর জন্য
 * তুমি চাইলে admin panel থেকে "Run Today ROI" বাটনে এটা call করতে পারো।
 */
function runDailyRoi(){
  const users = ieLoadUsers();

  users.forEach(u => {
    ieEnsureIncomeFields(u);
    if (!u.dailyROI || u.dailyROI <= 0) return;

    const cap   = (u.depositTotal || 0) * IE_PLAN.maxMultiple;
    const used  = ieTotalIncome(u);
    const room  = Math.max(0, cap - used);
    if (room <= 0) return; // already 3x done

    // আজকের self ROI
    let roiToday = u.dailyROI;
    if (roiToday > room) roiToday = room;

    // self income
    u.roiEarned      += roiToday;
    u.earningBalance += roiToday;

    // affiliate part
    ieDistributeRoiAffiliate(users, u, roiToday);
  });

  ieSaveUsers(users);
  alert("📅 আজকের ROI + Affiliate হিসাব করা হয়েছে (localStorage)।");
}

// পুরনো নামের সাথে compat রাখার জন্য (যদি কোথাও ব্যবহার করে থাকো)
function runDailyRoiDemo(){
  return runDailyRoi();
}

// ---------- Wallet transfer helpers ----------

/**
 * Admin → gift voucher
 */
function ieAdminSendVoucher(username, amount){
  amount = Number(amount || 0);
  if (!username || amount <= 0){
    alert("Gift voucher পাঠাতে username এবং amount দরকার।");
    return;
  }
  const users  = ieLoadUsers();
  const member = ieFindUser(username, users);
  if (!member){
    alert("Member পাওয়া যায়নি: " + username);
    return;
  }
  ieEnsureIncomeFields(member);
  member.voucherBalance += amount;
  ieSaveUsers(users);
  alert("🎁 Gift voucher balance add হয়েছে।");
}

/**
 * Voucher → Add balance / Earning balance
 * type: "add" | "earning"
 */
function ieVoucherConvert(username, amount, type){
  amount = Number(amount || 0);
  const validType = type === "add" ? "add" : (type === "earning" ? "earning" : null);
  if (!username || amount <= 0 || !validType){
    alert("Voucher convert এর ইনপুট সঠিক না।");
    return;
  }

  const users  = ieLoadUsers();
  const member = ieFindUser(username, users);
  if (!member){
    alert("Member পাওয়া যায়নি: " + username);
    return;
  }
  ieEnsureIncomeFields(member);
  if (member.voucherBalance < amount){
    alert("Voucher balance কম।");
    return;
  }

  member.voucherBalance -= amount;
  if (validType === "add"){
    member.addBalance += amount;
  }else{
    member.earningBalance += amount;
  }
  ieSaveUsers(users);
  alert("✅ Voucher convert করা হয়েছে।");
}

/**
 * Earning → Current/Add balance (শুধু ID activation / package এর জন্য)
 */
function ieEarningToAddBalance(username, amount){
  amount = Number(amount || 0);
  if (!username || amount <= 0){
    alert("Transfer এর ইনপুট সঠিক না।");
    return;
  }
  const users  = ieLoadUsers();
  const member = ieFindUser(username, users);
  if (!member){
    alert("Member পাওয়া যায়নি: " + username);
    return;
  }
  ieEnsureIncomeFields(member);
  if (member.earningBalance < amount){
    alert("Earning balance কম।");
    return;
  }
  member.earningBalance -= amount;
  member.addBalance     += amount;
  ieSaveUsers(users);
  alert("🔁 Earning থেকে current balance এ নেয়া হয়েছে (activation এর জন্য)।");
}

// ---------- Dashboard summary helper ----------

/**
 * getIncomeSummary(username)
 * – চাইলে dashboard এ ব্যবহার করতে পারো
 */
function getIncomeSummary(username){
  const users  = ieLoadUsers();
  const member = ieFindUser(username, users);
  if (!member) return null;
  ieEnsureIncomeFields(member);

  const total     = ieTotalIncome(member);
  const bar       = ieBarometer(member);

  return {
    // investment
    selfInvestment:  member.depositTotal    || 0,
    teamInvestment:  member.teamInvestment  || 0,
    totalInvestment: (member.depositTotal   || 0) + (member.teamInvestment || 0),

    // ROI
    dailyROI:        member.dailyROI        || 0,
    roiEarned:       member.roiEarned       || 0,

    // income breakdown
    sponsorBonus:    member.directIncome        || 0,
    genBonus:        member.teamIncome          || 0,
    rankBonus:       member.rankIncome          || 0,
    globalBonus:     member.globalIncome        || 0,
    giftVoucher:     member.giftVoucherIncome   || 0,

    // wallet
    addBalance:      member.addBalance      || 0,
    earningBalance:  member.earningBalance  || 0,
    voucherBalance:  member.voucherBalance  || 0,
    currentBalance:  member.addBalance      || 0, // পুরনো নামের সাথে match করার জন্য
    totalEarning:    total,

    // barometer 3x
    barMax:          bar.max,
    barUsed:         bar.used,
    barRemain:       bar.remain,
    barUsedPercent:  bar.usedPercent
  };
}

// Export to global (যদি module system ছাড়া ব্যবহার করো)
window.ieActivatePackage      = ieActivatePackage;
window.runDailyRoi            = runDailyRoi;
window.runDailyRoiDemo        = runDailyRoiDemo;
window.ieRecalcTeamAndTotals  = ieRecalcTeamAndTotals;
window.ieAdminSendVoucher     = ieAdminSendVoucher;
window.ieVoucherConvert       = ieVoucherConvert;
window.ieEarningToAddBalance  = ieEarningToAddBalance;
window.getIncomeSummary       = getIncomeSummary;
window.ieBarometer            = ieBarometer;
// income-engine.js (FINAL) — single source of truth for all incomes

import { db } from "./firebase-config.js";
import {
  doc, getDoc, updateDoc, setDoc,
  collection, addDoc, serverTimestamp,
  increment
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const PLAN_REF = doc(db, "config", "plan");

async function getPlan(){
  const s = await getDoc(PLAN_REF);
  const p = s.exists() ? s.data() : {};
  return {
    earningMultiplier: Number(p.earningMultiplier ?? 3),
    capExcludeTypes: Array.isArray(p.capExcludeTypes) ? p.capExcludeTypes : ["roi"],
    roiEnabled: p.roiEnabled !== false,
    sponsorEnabled: p.sponsorEnabled !== false,
    generationEnabled: p.generationEnabled !== false,
    rankEnabled: p.rankEnabled !== false,
    globalEnabled: p.globalEnabled !== false
  };
}

function normType(t){ return (t || "").toLowerCase().trim(); }

// ✅ PUBLIC: recalculates earningCap from depositTotal * multiplier
export async function ensureEarningCap(username){
  const uRef = doc(db, "users", username.toLowerCase());
  const uSnap = await getDoc(uRef);
  if(!uSnap.exists()) return;

  const plan = await getPlan();
  const u = uSnap.data();

  const deposit = Number(u.depositTotal || 0);
  const cap = deposit * plan.earningMultiplier;

  // earningCap না থাকলে বা deposit বদলালে আপডেট
  await setDoc(uRef, { earningCap: cap }, { merge: true });
}

// ✅ FINAL: credit income with strict premium rule + cap + history
export async function creditIncome(username, amount, type, remark=""){
  username = (username || "").toLowerCase();
  type = normType(type);

  const plan = await getPlan();

  // feature toggles
  if(type === "roi" && !plan.roiEnabled) return { ok:false, reason:"ROI disabled" };
  if((type === "sponsor" || type === "direct") && !plan.sponsorEnabled) return { ok:false, reason:"Sponsor disabled" };
  if((type === "generation" || type === "gen") && !plan.generationEnabled) return { ok:false, reason:"Gen disabled" };
  if(type === "rank" && !plan.rankEnabled) return { ok:false, reason:"Rank disabled" };
  if(type === "global" && !plan.globalEnabled) return { ok:false, reason:"Global disabled" };

  const inc = Number(amount || 0);
  if(!inc || inc <= 0) return { ok:false, reason:"Invalid amount" };

  const uRef = doc(db, "users", username);
  const uSnap = await getDoc(uRef);
  if(!uSnap.exists()) return { ok:false, reason:"User not found" };

  const u = uSnap.data();

  // ✅ FINAL RULE: Free ID = 0 income (NO EXCEPTION)
  const membership = (u.membershipType || "free").toLowerCase();
  if(membership !== "premium"){
    return { ok:false, reason:"Free ID blocked" };
  }

  // cap (earningCap, earningUsed)
  const deposit = Number(u.depositTotal || 0);
  const cap = Number(u.earningCap ?? (deposit * plan.earningMultiplier));
  const used = Number(u.earningUsed || 0);

  // capExcludeTypes: e.g. ["roi"] → ROI cap-এ গণনা হবে না
  const exclude = plan.capExcludeTypes.map(normType);
  const useCap = cap > 0 && !exclude.includes(type);

  let credit = inc;
  if(useCap){
    if(used >= cap) return { ok:false, reason:"Cap reached" };
    credit = Math.min(inc, cap - used);
  }

  // update user balances + per-type fields
  const upd = {
    earningBalance: increment(credit),
    totalEarning: increment(credit)
  };

  if(useCap) upd.earningUsed = increment(credit);

  // per-type counters (optional but useful for dashboard)
  if(type === "sponsor" || type === "direct") upd.directIncome = increment(credit);
  else if(type === "generation" || type === "gen") upd.teamIncome = increment(credit);
  else if(type === "rank") upd.rankIncome = increment(credit);
  else if(type === "global") upd.globalIncome = increment(credit);
  else if(type === "roi") upd.roiEarned = increment(credit);

  await updateDoc(uRef, upd);

  // history log (always)
  await addDoc(collection(db,"income_history"),{
    username,
    amount: credit,
    type,
    remark: remark || "",
    createdAt: serverTimestamp()
  });

  return { ok:true, credit };
}
// income-engine.js — FINAL VERSION (DO NOT CHANGE LOGIC)

import { db } from "./firebase-config.js";
import {
  doc, getDoc, updateDoc,
  collection, addDoc,
  serverTimestamp, increment
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

/* ---------------- CONFIG ---------------- */

async function getPlan(){
  const snap = await getDoc(doc(db,"config","plan"));
  const p = snap.exists() ? snap.data() : {};
  return {
    earningMultiplier: Number(p.earningMultiplier ?? 3),
    capExcludeTypes: Array.isArray(p.capExcludeTypes) ? p.capExcludeTypes : ["roi"]
  };
}

/* ---------------- PUBLIC: ENSURE CAP ---------------- */

export async function ensureEarningCap(username){
  const ref = doc(db,"users",username);
  const s = await getDoc(ref);
  if(!s.exists()) return;

  const u = s.data();
  const plan = await getPlan();

  const deposit = Number(u.depositTotal || 0);
  const cap = deposit * plan.earningMultiplier;

  await updateDoc(ref,{
    earningCap: cap
  });
}

/* ---------------- FINAL CREDIT FUNCTION ---------------- */

export async function creditIncome(username, amount, type, remark=""){
  username = (username || "").toLowerCase();
  type = (type || "").toLowerCase();

  const inc = Number(amount || 0);
  if(inc <= 0) return { ok:false, reason:"invalid_amount" };

  const ref = doc(db,"users",username);
  const snap = await getDoc(ref);
  if(!snap.exists()) return { ok:false, reason:"user_not_found" };

  const u = snap.data();

  /* 🔒 FINAL RULE: FREE ID = NO INCOME */
  if((u.membershipType || "free") !== "premium"){
    return { ok:false, reason:"free_id_blocked" };
  }

  const plan = await getPlan();

  const cap = Number(u.earningCap || (u.depositTotal||0) * plan.earningMultiplier);
  const used = Number(u.earningUsed || 0);

  const exclude = plan.capExcludeTypes.map(x=>x.toLowerCase());
  const useCap = cap > 0 && !exclude.includes(type);

  let credit = inc;

  if(useCap){
    if(used >= cap) return { ok:false, reason:"cap_reached" };
    credit = Math.min(inc, cap - used);
  }

  /* ---- UPDATE USER ---- */
  const upd = {
    earningBalance: increment(credit),
    totalEarning: increment(credit)
  };

  if(useCap){
    upd.earningUsed = increment(credit);
  }

  if(type==="sponsor") upd.directIncome = increment(credit);
  if(type==="generation") upd.teamIncome = increment(credit);
  if(type==="rank") upd.rankIncome = increment(credit);
  if(type==="global") upd.globalIncome = increment(credit);
  if(type==="roi") upd.roiEarned = increment(credit);

  await updateDoc(ref, upd);

  /* ---- HISTORY (ALWAYS) ---- */
  await addDoc(collection(db,"income_history"),{
    username,
    amount: credit,
    type,
    remark,
    createdAt: serverTimestamp()
  });

  return { ok:true, credit };
}
