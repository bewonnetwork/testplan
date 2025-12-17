// income-guard.js (MASTER)
// Rules:
// 1) Free ID => no income (except if you later allow some type)
// 2) Premium only
// 3) ROI does NOT count in 3X cap
// 4) Sponsor/Global/Rank/Generation/Gift etc => counts in 3X cap
// 5) If cap exceeded => clamp to remaining, or stop

import { db } from "./firebase-config.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  increment,
  addDoc,
  collection
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const PLAN_REF = doc(db, "config", "plan");

// dynamic plan loader
export async function getPlanConfig(){
  const snap = await getDoc(PLAN_REF);
  const plan = snap.exists() ? snap.data() : {};

  // defaults
  return {
    earningMultiplier: Number(plan.earningMultiplier ?? 3), // 3x, 4x, 5x dynamic
    allowFreeIncomeTypes: Array.isArray(plan.allowFreeIncomeTypes) ? plan.allowFreeIncomeTypes : [], // default none
  };
}

// ROI বাদে — cap apply হবে যেগুলোতে
export function isCapType(type){
  type = (type || "").toLowerCase();
  if(type === "roi") return false;     // ROI not counted in cap
  return true;                         // sponsor/global/rank/gen/gift/topup etc => counted
}

// free user income allow list (default empty)
export function isAllowedForFree(type, allowList){
  type = (type || "").toLowerCase();
  return (allowList || []).map(x=>String(x).toLowerCase()).includes(type);
}

// log in income_history
async function logIncomeHistory(username, amount, type, remark){
  try{
    await addDoc(collection(db, "income_history"), {
      username: (username || "").toLowerCase(),
      amount: Number(amount || 0),
      type: (type || "other").toLowerCase(),
      remark: remark || "",
      createdAt: serverTimestamp()
    });
  }catch(e){
    console.error("income_history log fail:", e);
  }
}

/**
 * Guarded credit
 * - returns: { ok, credited, blockedReason, remainingCap, cap, used }
 */
export async function creditIncomeGuarded({
  username,
  amount,
  type,
  remark
}){
  const userId = (username || "").toLowerCase().trim();
  const inc    = Number(amount || 0);

  if(!userId) return { ok:false, credited:0, blockedReason:"NO_USERNAME" };
  if(!inc || inc <= 0) return { ok:false, credited:0, blockedReason:"INVALID_AMOUNT" };

  const plan = await getPlanConfig();

  const uRef  = doc(db, "users", userId);
  const uSnap = await getDoc(uRef);
  if(!uSnap.exists()) return { ok:false, credited:0, blockedReason:"USER_NOT_FOUND" };

  const u = uSnap.data();
  const membership = (u.membershipType || "free").toLowerCase();

  // FREE => block all income (default)
  if(membership !== "premium"){
    // allow only if you decide later
    if(!isAllowedForFree(type, plan.allowFreeIncomeTypes)){
      return { ok:false, credited:0, blockedReason:"FREE_ID_BLOCKED" };
    }
  }

  // Compute cap only for cap-types
  const capApplies = isCapType(type);
  const depositTotal = Number(u.depositTotal || 0);

  // if premium but no deposit, block income (safe)
  if(membership === "premium" && depositTotal <= 0){
    return { ok:false, credited:0, blockedReason:"NO_DEPOSIT" };
  }

  // cap fields
  const cap = depositTotal * Number(plan.earningMultiplier || 3);
  const used = Number(u.nonRoiEarned || 0); // ROI বাদে earned tracked here
  const remaining = Math.max(0, cap - used);

  let creditAmt = inc;

  if(capApplies){
    if(remaining <= 0){
      return { ok:false, credited:0, blockedReason:"CAP_REACHED", remainingCap:0, cap, used };
    }
    // clamp
    if(creditAmt > remaining) creditAmt = remaining;
  }

  // Prepare updates
  const updates = {
    earningBalance: increment(creditAmt),
    totalEarning:   increment(creditAmt)
  };

  // per-type summary fields (optional, but keep your old fields consistent)
  const t = (type || "").toLowerCase();
  if(t === "sponsor" || t === "direct"){
    updates.directIncome = increment(creditAmt);
  }else if(t === "global"){
    updates.globalIncome = increment(creditAmt);
  }else if(t === "rank"){
    updates.rankIncome = increment(creditAmt);
  }else if(t === "gen" || t === "generation"){
    updates.generationIncome = increment(creditAmt);
  }else if(t === "gift" || t === "topup"){
    updates.giftVoucherIncome = increment(creditAmt);
    updates.giftVoucher = increment(creditAmt);
  }

  // update cap-used if applies
  if(capApplies){
    updates.nonRoiEarned = increment(creditAmt);
  }

  await updateDoc(uRef, updates);
  await logIncomeHistory(userId, creditAmt, t || "other", remark || "");

  return {
    ok:true,
    credited: creditAmt,
    blockedReason: null,
    remainingCap: capApplies ? Math.max(0, remaining - creditAmt) : remaining,
    cap,
    used: capApplies ? (used + creditAmt) : used
  };
}

/**
 * Utility: ensure plan exists (run once if needed)
 */
export async function ensurePlanDefaults(){
  const plan = await getPlanConfig();
  await setDoc(PLAN_REF, {
    earningMultiplier: plan.earningMultiplier,
    allowFreeIncomeTypes: plan.allowFreeIncomeTypes
  }, { merge:true });
}
