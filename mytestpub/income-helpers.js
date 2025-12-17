// income-helpers.js (FINAL v2)
// ✅ Free ID => NO income
// ✅ ROI cap (default 1x of self deposit)
// ✅ All income cap (ROI বাদে) default 3x (dynamic from config/plan)
// ✅ One place credit + income_history log

console.log("BUILD:", "20251217_2");

import { db } from "./firebase-config.js";
import {
  doc,
  getDoc,
  runTransaction,
  addDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

function n(v){ return Number(v || 0); }
function lower(x){ return String(x || "").toLowerCase().trim(); }

export function isPremium(userDoc){
  return lower(userDoc?.membershipType) === "premium";
}

// income buckets
function getBucketField(type){
  const t = lower(type);
  const fieldMap = {
    roi: "roiIncome",
    sponsor: "directIncome",
    direct: "directIncome",
    generation: "teamIncome",
    gen: "teamIncome",
    rank: "rankIncome",
    global: "globalIncome"
  };
  return fieldMap[t] || "otherIncome";
}

// Calculate non-ROI income total from existing fields
function calcNonRoiTotal(u){
  return (
    n(u.directIncome) +
    n(u.teamIncome) +
    n(u.rankIncome) +
    n(u.globalIncome) +
    n(u.giftVoucherIncome) +
    n(u.otherIncome)
  );
}

async function loadPlanCaps(){
  // config/plan থেকে dynamic নিতে পারো
  // incomeCapMultiple = 3 (ROI বাদে সব income cap)
  // roiCapMultiple    = 1 (ROI cap)
  try{
    const ref = doc(db,"config","plan");
    const snap = await getDoc(ref);
    const d = snap.exists() ? snap.data() : {};
    return {
      incomeCapMultiple: n(d.incomeCapMultiple || 3),
      roiCapMultiple: n(d.roiCapMultiple || 1),
    };
  }catch(e){
    return { incomeCapMultiple: 3, roiCapMultiple: 1 };
  }
}

/**
 * creditIncome(username, amount, type, remark, meta)
 * type: "roi" | "sponsor" | "gen" | "rank" | "global" | etc
 */
export async function creditIncome(username, amount, type, remark = "", meta = {}){
  const uName = lower(username);
  const inc = n(amount);
  const t = lower(type);

  if(!uName) throw new Error("Username missing");
  if(!inc || inc <= 0) return { ok:false, reason:"amount<=0" };

  const caps = await loadPlanCaps();
  const uRef = doc(db,"users",uName);

  // Transaction => race condition safe
  const result = await runTransaction(db, async (tx)=>{
    const snap = await tx.get(uRef);
    if(!snap.exists()) throw new Error("User not found: " + uName);
    const u = snap.data();

    // ✅ Free ID protection: NO income at all
    if(!isPremium(u)){
      return { ok:false, reason:"FREE_ID_NO_INCOME" };
    }

    const dep = n(u.depositTotal);
    if(dep <= 0){
      return { ok:false, reason:"NO_DEPOSIT" };
    }

    // ----- CAP LOGIC -----
    if(t === "roi"){
      // ROI cap = depositTotal * roiCapMultiple (default 1x)
      const roiMax = dep * n(caps.roiCapMultiple || 1);
      const roiBefore = n(u.roiEarned);
      const room = roiMax - roiBefore;
      if(room <= 0){
        return { ok:false, reason:"ROI_CAP_REACHED", room:0 };
      }
      const credit = Math.min(room, inc);

      const bucketField = getBucketField(t);
      const updates = {};
      updates[bucketField] = n(u[bucketField]) + credit;
      updates.earningBalance = n(u.earningBalance) + credit;
      updates.totalEarning = n(u.totalEarning) + credit;

      // ✅ important: ROI cap tracker
      updates.roiEarned = roiBefore + credit;

      updates.updatedAt = serverTimestamp();
      tx.update(uRef, updates);

      return { ok:true, credited:credit, bucketField, cap:"ROI" };
    }

    // Non-ROI income cap = depositTotal * incomeCapMultiple (default 3x)
    const max = dep * n(caps.incomeCapMultiple || 3);
    const used = calcNonRoiTotal(u);
    const room = max - used;
    if(room <= 0){
      return { ok:false, reason:"INCOME_3X_CAP_REACHED", room:0 };
    }

    const credit = Math.min(room, inc);
    const bucketField = getBucketField(t);

    const updates = {};
    updates[bucketField] = n(u[bucketField]) + credit;
    updates.earningBalance = n(u.earningBalance) + credit;
    updates.totalEarning = n(u.totalEarning) + credit;
    updates.updatedAt = serverTimestamp();

    tx.update(uRef, updates);

    return { ok:true, credited:credit, bucketField, cap:"NON_ROI_3X" };
  });

  // ✅ history log (transaction এর বাইরে লিখলাম)
  if(result?.ok && result?.credited > 0){
    await addDoc(collection(db,"income_history"),{
      username: uName,
      amount: result.credited,
      type: t || "other",
      remark: remark || "",
      createdAt: serverTimestamp(),
      meta: meta || {}
    });
  }

  return result;
}