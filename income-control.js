// income-control.js (MASTER CONTROLLER)
// One place to control: cap (3x/4x/5x), free/premium rules, history logging.

import { db } from "./firebase-config.js";
import {
  doc, getDoc, updateDoc, setDoc,
  collection, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const PLAN_REF = doc(db, "config", "plan");

function n(v){ return Number(v || 0); }

async function getPlan(){
  const snap = await getDoc(PLAN_REF);
  const p = snap.exists() ? snap.data() : {};
  return {
    incomeCapMultiplierAll: p.incomeCapMultiplierAll ?? 3,
    capExcludeTypes: Array.isArray(p.capExcludeTypes) ? p.capExcludeTypes : ["roi"],

    blockFreeIdIncome: p.blockFreeIdIncome ?? true,
    allowSponsorOnFreeId: p.allowSponsorOnFreeId ?? false
  };
}

// ✅ history log (সব ইনকাম এখান দিয়ে গেলে হিস্টোরি miss হবে না)
async function logIncome(username, amount, type, remark){
  try{
    await addDoc(collection(db,"income_history"),{
      username: (username||"").toLowerCase(),
      amount: n(amount),
      type: (type||"other"),
      remark: remark || "",
      createdAt: serverTimestamp()
    });
  }catch(e){
    console.error("income_history log error:", e);
  }
}

/**
 * ✅ MASTER CREDIT FUNCTION
 * - Free ID block
 * - Cap (3x/4x/5x) dynamic
 * - Partial pay if cap remaining is less
 * - Updates earningBalance + totalEarning + type-specific fields
 * - Logs income_history
 */
export async function creditIncome(username, amount, type, remark){
  username = (username || "").toLowerCase().trim();
  const inc = n(amount);
  type = (type || "other").toLowerCase();

  if(!username) throw new Error("username missing");
  if(!inc || inc <= 0) return { ok:false, paid:0, reason:"amount<=0" };

  const plan = await getPlan();
  const uRef = doc(db, "users", username);
  const uSnap = await getDoc(uRef);
  if(!uSnap.exists()) throw new Error("User not found: " + username);

  const u = uSnap.data();
  const membership = (u.membershipType || "free").toLowerCase();

  // ✅ Free ID block rule
  if(plan.blockFreeIdIncome && membership !== "premium"){
    // যদি ফ্রি আইডিতে sponsor allow করতে চাও, এখানে কন্ডিশন
    if(!(type === "sponsor" && plan.allowSponsorOnFreeId)){
      return { ok:false, paid:0, reason:"free_id_blocked" };
    }
  }

  // ✅ Cap exclude types (ROI বাইরে রাখবে)
  const excludeCap = plan.capExcludeTypes.includes(type);

  const deposit = n(u.depositTotal);
  const capMaxAll = deposit * n(plan.incomeCapMultiplierAll);   // 3x/4x/5x
  const capUsedAll = n(u.capUsedAll);                           // ROI বাদে used

  let payable = inc;

  // ✅ Apply cap only if NOT excluded (like ROI)
  if(!excludeCap){
    const remain = Math.max(0, capMaxAll - capUsedAll);
    if(remain <= 0){
      return { ok:false, paid:0, reason:"cap_full" };
    }
    payable = Math.min(payable, remain);
  }

  // ✅ update maps (type অনুযায়ী কোন ফিল্ড বাড়বে)
  const updates = {};

  // money buckets
  updates.earningBalance = n(u.earningBalance) + payable;
  updates.totalEarning   = n(u.totalEarning)   + payable;

  if(!excludeCap){
    updates.capUsedAll = capUsedAll + payable; // ROI বাদে only
  }

  // type-specific totals
  if(type === "sponsor" || type === "direct"){
    updates.directIncome = n(u.directIncome) + payable;
  }else if(type === "generation" || type === "gen" || type === "team"){
    updates.teamIncome = n(u.teamIncome) + payable;
  }else if(type === "rank"){
    updates.rankIncome = n(u.rankIncome) + payable;
  }else if(type === "global"){
    updates.globalIncome = n(u.globalIncome) + payable;
  }else if(type === "roi"){
    updates.roiEarned = n(u.roiEarned) + payable; // ROI আলাদা
  }else{
    updates.otherIncome = n(u.otherIncome) + payable;
  }

  await updateDoc(uRef, updates);
  await logIncome(username, payable, type, remark || "");

  return { ok:true, paid: payable, cut: inc - payable, reason: (payable<inc ? "partial_cap" : "paid") };
}
