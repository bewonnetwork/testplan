// /public/income-engine.js
// BTX.ONE — FINAL INCOME ENGINE (FIRESTORE ONLY)
// ✅ Single source of truth for ALL incomes
// ✅ Premium only income
// ✅ 3X cap applies to ALL income types
// ✅ income_history logging
// ✅ Admin runnable: ROI + Binary
// ✅ Upgrade hook: sponsor + generation + binary volume build

import { db } from "./firebase-config.js";
import {
  doc, getDoc, setDoc, updateDoc, getDocs,
  collection, addDoc,
  serverTimestamp, increment
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

/* ==============================
   CONFIG / PLAN
================================ */

const PLAN_REF = doc(db, "config", "plan");

const DEFAULT_PLAN = {
  earningMultiplier: 3,          // 3X
  capExcludeTypes: [],           // [] => সব টাইপ cap এ গণনা হবে
  roiEnabled: true,
  roiPercentPerDay: 10,
  sponsorEnabled: true,
  sponsorPercent: 5,
  generationEnabled: true,
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
  rankEnabled: true,
  globalEnabled: true,
  binaryEnabled: true,
  binaryPercent: 10
};

function n(v){ return Number(v || 0); }
function normType(t){ return (t || "").toLowerCase().trim(); }

export async function getPlan(){
  const s = await getDoc(PLAN_REF);
  const p = s.exists() ? s.data() : {};
  const plan = { ...DEFAULT_PLAN, ...p };

  plan.earningMultiplier = n(plan.earningMultiplier || 3);
  plan.capExcludeTypes = Array.isArray(plan.capExcludeTypes) ? plan.capExcludeTypes : [];
  plan.roiPercentPerDay = n(plan.roiPercentPerDay || 10);
  plan.sponsorPercent = n(plan.sponsorPercent || 5);
  plan.binaryPercent = n(plan.binaryPercent || 10);
  plan.genLevels = Array.isArray(plan.genLevels) && plan.genLevels.length
    ? plan.genLevels
    : DEFAULT_PLAN.genLevels;

  return plan;
}

/* ==============================
   CAP HELPERS
================================ */

export async function ensureEarningCap(username){
  username = (username || "").toLowerCase().trim();
  if(!username) return;

  const uRef = doc(db, "users", username);
  const uSnap = await getDoc(uRef);
  if(!uSnap.exists()) return;

  const plan = await getPlan();
  const u = uSnap.data();

  const deposit = n(u.depositTotal);
  const cap = deposit * plan.earningMultiplier;

  await setDoc(uRef, { earningCap: cap }, { merge: true });
}

function isPremium(u){
  return String(u?.membershipType || "free").toLowerCase() === "premium";
}

function capInfo(u, plan){
  const deposit = n(u.depositTotal);
  const cap = n(u.earningCap ?? (deposit * plan.earningMultiplier));
  const used = n(u.earningUsed);
  const left = cap > 0 ? Math.max(0, cap - used) : 0;
  return { deposit, cap, used, left };
}

/* ==============================
   HISTORY LOGGER
================================ */

async function logHistory({ username, type, amount, remark = "", day = "" }){
  await addDoc(collection(db, "income_history"), {
    username: (username || "").toLowerCase(),
    type: normType(type),
    amount: n(amount),
    remark: remark || "",
    day: day || "",
    createdAt: serverTimestamp()
  });
}

/* ==============================
   CREDIT INCOME (FINAL)
================================ */

export async function creditIncome(username, amount, type, remark = ""){
  username = (username || "").toLowerCase().trim();
  type = normType(type);

  const inc = n(amount);
  if(!username) return { ok:false, reason:"missing_username" };
  if(inc <= 0) return { ok:false, reason:"invalid_amount" };

  const plan = await getPlan();

  if(type === "roi" && !plan.roiEnabled) return { ok:false, reason:"roi_disabled" };
  if((type === "sponsor" || type === "direct") && !plan.sponsorEnabled) return { ok:false, reason:"sponsor_disabled" };
  if((type === "generation" || type === "gen") && !plan.generationEnabled) return { ok:false, reason:"gen_disabled" };
  if(type === "rank" && !plan.rankEnabled) return { ok:false, reason:"rank_disabled" };
  if(type === "global" && !plan.globalEnabled) return { ok:false, reason:"global_disabled" };
  if(type === "binary" && !plan.binaryEnabled) return { ok:false, reason:"binary_disabled" };

  const uRef = doc(db, "users", username);
  const uSnap = await getDoc(uRef);
  if(!uSnap.exists()) return { ok:false, reason:"user_not_found" };

  const u = uSnap.data();

  // 🔒 FINAL RULE: Free ID = NO income (NO EXCEPTION)
  if(!isPremium(u)){
    return { ok:false, reason:"free_id_blocked" };
  }

  // cap applies to all income types
  const exclude = (plan.capExcludeTypes || []).map(normType);
  const useCap = !exclude.includes(type);

  const { cap, used, left } = capInfo(u, plan);

  let credit = inc;
  if(useCap){
    if(cap > 0 && used >= cap) return { ok:false, reason:"cap_reached" };
    if(cap > 0) credit = Math.min(inc, left);
  }
  if(credit <= 0) return { ok:false, reason:"no_room" };

  const upd = {
    earningBalance: increment(credit),
    totalEarning: increment(credit)
  };
  if(useCap) upd.earningUsed = increment(credit);

  if(type === "sponsor" || type === "direct") upd.directIncome = increment(credit);
  else if(type === "generation" || type === "gen") upd.teamIncome = increment(credit);
  else if(type === "rank") upd.rankIncome = increment(credit);
  else if(type === "global") upd.globalIncome = increment(credit);
  else if(type === "roi") upd.roiEarned = increment(credit);
  else if(type === "binary") upd.matchingIncome = increment(credit);

  await updateDoc(uRef, upd);

  await logHistory({
    username,
    type,
    amount: credit,
    remark: remark || ""
  });

  return { ok:true, credit };
}

/* ==============================
   ROI DISTRIBUTION (ADMIN RUN)
================================ */

export async function runDailyRoiForAllUsers(){
  const plan = await getPlan();
  if(!plan.roiEnabled) return { ok:false, reason:"roi_disabled" };

  const qs = await getDocs(collection(db, "users"));
  const todayTag = new Date().toISOString().slice(0,10);

  let done = 0, skipped = 0;

  for(const snap of qs.docs){
    const u = snap.data();
    const username = snap.id;

    if(!isPremium(u)){ skipped++; continue; }
    const dep = n(u.depositTotal);
    if(dep <= 0){ skipped++; continue; }

    const roi = dep * (n(plan.roiPercentPerDay) / 100);
    if(roi <= 0){ skipped++; continue; }

    const remark = Daily ROI ${plan.roiPercentPerDay}% | Deposit ${dep} | ${todayTag};

    const res = await creditIncome(username, roi, "roi", remark);
    if(res.ok) done++; else skipped++;
  }

  return { ok:true, done, skipped, day: todayTag };
}

/* ==============================
   BINARY VOLUME BUILDER
================================ */

export async function distributeBinaryVolume(fromUsername, amount){
  fromUsername = (fromUsername || "").toLowerCase().trim();
  const vol = n(amount);
  if(!fromUsername || vol <= 0) return { ok:false, reason:"invalid_input" };

  let current = fromUsername;

  for(let hop = 0; hop < 200; hop++){
    const cRef = doc(db, "users", current);
    const cSnap = await getDoc(cRef);
    if(!cSnap.exists()) break;

    const c = cSnap.data();
    const parent = String(c.placement_parent || "").toLowerCase().trim();
    const side   = String(c.placement_side || "").toUpperCase().trim(); // L/R

    if(!parent || (side !== "L" && side !== "R")) break;

    const pRef = doc(db, "users", parent);
    const pSnap = await getDoc(pRef);
    if(!pSnap.exists()) break;

    await updateDoc(pRef, side === "L"
      ? { leftVolume: increment(vol) }
      : { rightVolume: increment(vol) }
    );

    current = parent;
  }

  return { ok:true };
}

/* ==============================
   BINARY MATCHING (ADMIN RUN)
================================ */

export async function runBinaryMatching(userSnap, todayTag, matchingPercent = 10){
  const u = userSnap.data();
  const username = userSnap.id;

  if(!isPremium(u)) return { ok:false, reason:"free_id_blocked" };

  const dep = n(u.depositTotal);
  if(dep <= 0) return { ok:false, reason:"no_investment" };

  const left  = n(u.leftVolume)  + n(u.carryLeft);
  const right = n(u.rightVolume) + n(u.carryRight);

  if(left <= 0 || right <= 0) return { ok:false, reason:"no_pair" };

  const matchVolume = Math.min(left, right);
  const pct = n(matchingPercent || 10);
  const gross = matchVolume * (pct / 100);
  if(gross <= 0) return { ok:false, reason:"gross_zero" };

  const remark = Binary ${pct}% | MatchVol ${matchVolume} | ${todayTag};

  const res = await creditIncome(username, gross, "binary", remark);

  if(!res.ok){
    return res;
  }

  const newCarryLeft  = left  - matchVolume;
  const newCarryRight = right - matchVolume;

  await updateDoc(userSnap.ref, {
    carryLeft: newCarryLeft,
    carryRight: newCarryRight,
    lastBinaryRun: todayTag,
    lastBinaryPercent: pct
  });

  return { ok:true, credit: res.credit, matchVolume, pct };
}

export async function runBinaryForAllUsers(percent = null){
  const plan = await getPlan();
  if(!plan.binaryEnabled) return { ok:false, reason:"binary_disabled" };

  const pct = (percent === null) ? n(plan.binaryPercent) : n(percent);
  const todayTag = new Date().toISOString().slice(0,10);

  const qs = await getDocs(collection(db, "users"));
  let done = 0, skipped = 0;

  for(const snap of qs.docs){
    const r = await runBinaryMatching(snap, todayTag, pct);
    if(r.ok) done++; else skipped++;
  }

  return { ok:true, done, skipped, day: todayTag, percent: pct };
}

/* ==============================
   UPGRADE / DEPOSIT HOOK (CALL FROM upgrade.js)
================================ */

export async function onUserDepositActivate(username, amount, opts = {}){
  username = (username || "").toLowerCase().trim();
  const dep = n(amount);
  const { skipDepositIncrement = false } = opts;

  if(!username || dep <= 0) return { ok:false, reason:"invalid_input" };

  const plan = await getPlan();

  const uRef = doc(db, "users", username);
  const uSnap = await getDoc(uRef);
  if(!uSnap.exists()) return { ok:false, reason:"user_not_found" };

  const u = uSnap.data();

  // depositTotal increase ONLY if not already increased by upgrade.js
  if(!skipDepositIncrement){
    await updateDoc(uRef, { depositTotal: increment(dep) });
  }

  await ensureEarningCap(username);

  // build binary volume uplines (even if uplines are free, volume can build)
  await distributeBinaryVolume(username, dep);

  // sponsor income (only sponsor if premium — creditIncome will block free sponsor)
  if(plan.sponsorEnabled && u.sponsor_username){
    const sp = String(u.sponsor_username).toLowerCase();
    const spAmt = dep * (n(plan.sponsorPercent)/100);

    const remark = Sponsor ${plan.sponsorPercent}% from ${username} upgrade ${dep};
    await creditIncome(sp, spAmt, "sponsor", remark);
  }

  // generation income (creditIncome blocks free uplines)
  if(plan.generationEnabled){
    let upline = String(u.sponsor_username || "").toLowerCase();

    for(const lvl of plan.genLevels){
      if(!upline) break;

      const upRef = doc(db, "users", upline);
      const upSnap = await getDoc(upRef);
      if(!upSnap.exists()) break;

      const up = upSnap.data();
      const directCount = n(up.directCount || up.teamCount || 0);

      if(directCount >= n(lvl.reqDirect)){
        const gAmt = dep * (n(lvl.percent)/100);
        const remark = Gen L${lvl.level} ${lvl.percent}% from ${username} upgrade ${dep};
        await creditIncome(upline, gAmt, "generation", remark);
      }

      upline = String(up.sponsor_username || "").toLowerCase();
    }
  }

  return { ok:true };
}