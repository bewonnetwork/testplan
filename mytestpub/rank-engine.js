// rank-engine.js
// DAILY RANK BONUS ENGINE + AUTO RANK DETECT

console.log("BUILD:", "20251217_1");
import { db } from "./firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  setDoc,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const RANK_CONFIG = [
  // star, targetSales (total), dailyBonus, totalDays
  { star: 1, targetSales: 2000,   daily: 4,   days: 50 },
  { star: 2, targetSales: 5000,   daily: 10,  days: 50 },
  { star: 3, targetSales: 10000,  daily: 20,  days: 50 },
  { star: 4, targetSales: 20000,  daily: 33,  days: 60 },
  { star: 5, targetSales: 50000,  daily: 66,  days: 75 },
  { star: 6, targetSales: 100000, daily: 100, days: 100 },
  { star: 7, targetSales: 200000, daily: 166, days: 120 },
  { star: 8, targetSales: 500000, daily: 333, days: 150 }
];

// Rank label
function rankLabel(star) {
  if (!star || star <= 0) return "No Rank";
  return `${star} Star`;
}

// এই user এখন কোন rank পাওয়ার যোগ্য?
function detectRank(user) {
  const selfInv  = Number(user.depositTotal   || 0);
  const teamInv  = Number(user.teamInvestment || 0);

  let best = null;

  for (const r of RANK_CONFIG) {
    const needSelf = r.targetSales / 2;   // 50% personal
    const needTeam = r.targetSales / 2;   // 50% team

    if (selfInv >= needSelf && teamInv >= needTeam) {
      best = r;   // highest rank যেটা ম্যাচ করে সেটাই best
    }
  }
  return best; // null হলে কোন rank না
}

// শুধুমাত্র rank income credit করব
async function creditRankIncome(username, amount) {
  const uRef = doc(db, "users", username.toLowerCase());
  const snap = await getDoc(uRef);
  if (!snap.exists()) return;

  const u   = snap.data();
  const inc = Number(amount || 0);
  if (!inc || inc <= 0) return;

  const updates = {};

  const currEarn  = Number(u.earningBalance || 0) + inc;
  const totalEarn = Number(u.totalEarning   || 0) + inc;
  const rankInc   = Number(u.rankIncome     || 0) + inc;

  updates.earningBalance = currEarn;
  updates.totalEarning   = totalEarn;
  updates.rankIncome     = rankInc;

  await updateDoc(uRef, updates);
}

// income_history log – type = "rank"
async function logRankHistory(username, amount, star) {
  try {
    await addDoc(collection(db, "income_history"), {
      username: username.toLowerCase(),
      amount: Number(amount || 0),
      type: "rank",
      remark: `Rank ${star} daily bonus`,
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.error("logRankHistory error:", err);
  }
}

/* -------------------------------------------------
   DAILY RANK ENGINE – RUN FOR ALL PREMIUM USERS
--------------------------------------------------*/
async function runRankEngineForAll() {
  const statusEl = document.getElementById("globalStatus"); // settings tab এর status reuse

  if (statusEl) {
    statusEl.textContent = "Running rank engine for all premium users…";
  }

  try {
    // শুধু premium users
    const qUsers = query(
      collection(db, "users"),
      where("membershipType", "==", "premium")
    );
    const snap = await getDocs(qUsers);
    if (snap.empty) {
      if (statusEl) statusEl.textContent = "No premium users found for rank bonus.";
      return;
    }

    let paidCount = 0;
    let upgradedCount = 0;

    for (const ds of snap.docs) {
      const username = ds.id;
      const u        = ds.data();
      const uRef     = doc(db, "users", username);

      // এই user কোন rank পাওয়ার যোগ্য?
      const wantRank = detectRank(u); // null হলে কোন rank না
      let currStar   = Number(u.rankStar || 0);
      let daysUsed   = Number(u.rankDaysUsed  || 0);
      let daysTotal  = Number(u.rankDaysTotal || 0);
      let dailyBonus = Number(u.rankDailyBonus || 0);
      let status     = u.rankStatus || "none";

      // ----- Rank upgrade logic -----
      // নতুন rank current-এর থেকে বড় হলে: পুরনো বন্ধ, নতুন শুরু
      if (wantRank && wantRank.star > currStar) {
        currStar   = wantRank.star;
        dailyBonus = wantRank.daily;
        daysTotal  = wantRank.days;
        daysUsed   = 0;
        status     = "active";

        await updateDoc(uRef, {
          rankStar: currStar,
          rankLabel: rankLabel(currStar),
          rankDailyBonus: dailyBonus,
          rankDaysTotal: daysTotal,
          rankDaysUsed: daysUsed,
          rankStatus: status,
          rankTargetSales: wantRank.targetSales,
          rankUpdatedAt: serverTimestamp()
        });
        upgradedCount++;
      }

      // যদি এখনো কোন rank নাই অথবা status "none"/"completed" → skip
      if (!currStar || currStar <= 0) continue;
      if (status !== "active") continue;

      // নিরাপত্তা – যদি config নাই কিন্তু পুরনো ডাটা থাকে
      if (!dailyBonus || !daysTotal) continue;

      if (daysUsed >= daysTotal) {
        // already finished
        if (status !== "completed") {
          await updateDoc(uRef, {
            rankStatus: "completed",
            rankDaysUsed: daysUsed
          });
        }
        continue;
      }

      // আজকের rank bonus credit
      await creditRankIncome(username, dailyBonus);
      await logRankHistory(username, dailyBonus, currStar);

      daysUsed += 1;

      const upd = {
        rankDaysUsed: daysUsed,
        rankLastPaidAt: serverTimestamp()
      };
      if (daysUsed >= daysTotal) {
        upd.rankStatus = "completed";
      }
      await updateDoc(uRef, upd);

      paidCount++;
    }

    if (statusEl) {
      statusEl.textContent =
        `Rank engine done. Upgraded ${upgradedCount} user(s), ` +
        `today paid rank bonus to ${paidCount} user(s).`;
    }

    alert("✅ Rank engine completed.");
  } catch (err) {
    console.error("runRankEngineForAll error:", err);
    if (statusEl) statusEl.textContent = "Rank error: " + (err.message || err);
    alert("Rank engine error: " + (err.message || err));
  }
}

// onclick এর জন্য
window.runRankEngineForAll = runRankEngineForAll;
import { db } from "./firebase-config.js";
import {
  collection, getDocs, query, where,
  doc, getDoc, updateDoc,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

import { creditIncome } from "./income-engine.js";

// তোমার rank table এখানে বসবে (placeholder)
const RANKS = [
  // rankStar, needPersonalSales, needTeamSales, dailyBonus, days
  { star:1, ps:100, ts:100, daily:5, days:50 },
  { star:2, ps:200, ts:200, daily:10, days:60 },
  // ...
];

function pickRank(personalSales, teamSales){
  let best = null;
  for(const r of RANKS){
    const ok = (personalSales>=r.ps && teamSales>=r.ts);
    if(ok) best = r;
  }
  return best;
}

export async function runRankEngineForAll(){
  const snap = await getDocs(query(
    collection(db,"users"),
    where("membershipType","==","premium")
  ));

  for(const ds of snap.docs){
    const username = ds.id;
    const u = ds.data();

    const personalSales = Number(u.depositTotal || 0);
    const teamSales = Number(u.teamInvestment || 0);

    const target = pickRank(personalSales, teamSales);
    if(!target) continue;

    const currentStar = Number(u.rankStar || 0);

    // ✅ Rank upgrade হলে: পুরোনো বন্ধ, নতুন শুরু
    if(target.star > currentStar){
      await updateDoc(doc(db,"users",username),{
        rankStar: target.star,
        rankDailyAmount: target.daily,
        rankDaysTotal: target.days,
        rankDaysUsed: 0
      });
    }

    // daily credit (যদি days বাকি থাকে)
    const fresh = await getDoc(doc(db,"users",username));
    const uu = fresh.exists()? fresh.data(): u;

    const daysTotal = Number(uu.rankDaysTotal || target.days);
    const daysUsed  = Number(uu.rankDaysUsed || 0);
    const dailyAmt  = Number(uu.rankDailyAmount || target.daily);

    if(daysUsed >= daysTotal) continue;

    // ✅ credit rank income (free auto blocked by income-engine)
    const res = await creditIncome(username, dailyAmt, "rank", "Rank daily bonus");
    if(res.ok){
      await updateDoc(doc(db,"users",username),{
        rankDaysUsed: daysUsed + 1
      });
    }
  }

  alert("✅ Rank Engine finished!");
}

window.runRankEngineForAll = runRankEngineForAll;
import { db } from "./firebase-config.js";
import {
  collection, getDocs, doc, getDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

import { creditIncome } from "./income-engine.js";

// 🔹 load rank config
async function loadRankConfig(){
  const ref = doc(db,"config","ranks");
  const snap = await getDoc(ref);
  if(!snap.exists()) return [];
  return snap.data().ranks || [];
}

// 🔹 find best rank
function findRank(ranks, ps, ts){
  let best = null;
  for(const r of ranks){
    if(ps >= r.personalSales && ts >= r.teamSales){
      best = r;
    }
  }
  return best;
}

export async function runRankEngineForAll(){
  const ranks = await loadRankConfig();
  if(!ranks.length){
    alert("❌ No rank config found");
    return;
  }

  const snap = await getDocs(collection(db,"users"));

  for(const ds of snap.docs){
    const username = ds.id;
    const u = ds.data();

    // ❌ free ID skip
    if((u.membershipType || "free") !== "premium") continue;

    const ps = Number(u.depositTotal || 0);
    const ts = Number(u.teamInvestment || 0);

    const target = findRank(ranks, ps, ts);
    if(!target) continue;

    const currentStar = Number(u.rankStar || 0);

    // 🔥 Rank upgrade
    if(target.star > currentStar){
      await updateDoc(doc(db,"users",username),{
        rankStar: target.star,
        rankLabel: target.label,
        rankDailyAmount: target.dailyBonus,
        rankDaysTotal: target.days,
        rankDaysUsed: 0
      });
    }

    // 🔹 reload fresh
    const fresh = await getDoc(doc(db,"users",username));
    const uu = fresh.data();

    const used = Number(uu.rankDaysUsed || 0);
    const total = Number(uu.rankDaysTotal || 0);
    const daily = Number(uu.rankDailyAmount || 0);

    if(used >= total) continue;

    const res = await creditIncome(
      username,
      daily,
      "rank",
      "Rank daily bonus"
    );

    if(res.ok){
      await updateDoc(doc(db,"users",username),{
        rankDaysUsed: used + 1
      });
    }
  }

  alert("✅ Rank bonus executed successfully");
}

window.runRankEngineForAll = runRankEngineForAll;
{
  "ranks": [
    {"star":1,"label":"One Star","personalSales":100,"teamSales":500,"dailyBonus":5,"days":50},
    {"star":2,"label":"Two Star","personalSales":300,"teamSales":1500,"dailyBonus":10,"days":60},
    {"star":3,"label":"Three Star","personalSales":600,"teamSales":5000,"dailyBonus":20,"days":70},
    {"star":4,"label":"Four Star","personalSales":1000,"teamSales":10000,"dailyBonus":30,"days":80},
    {"star":5,"label":"Five Star","personalSales":2000,"teamSales":20000,"dailyBonus":50,"days":90},
    {"star":6,"label":"Six Star","personalSales":3000,"teamSales":30000,"dailyBonus":70,"days":100},
    {"star":7,"label":"Seven Star","personalSales":5000,"teamSales":50000,"dailyBonus":100,"days":120},
    {"star":8,"label":"Eight Star","personalSales":8000,"teamSales":80000,"dailyBonus":150,"days":150},
    {"star":9,"label":"Nine Star","personalSales":12000,"teamSales":120000,"dailyBonus":200,"days":180},
    {"star":10,"label":"Ten Star","personalSales":20000,"teamSales":200000,"dailyBonus":300,"days":200}
  ]
}
{
  "ranks": [
    { "star": 1, "label": "1 Star", "totalSales": 2000,   "personalMin": 1000,   "teamMin": 1000,   "dailyBonus": 9,   "days": 50,  "gift": 200 },
    { "star": 2, "label": "2 Star", "totalSales": 5000,   "personalMin": 2500,   "teamMin": 2500,   "dailyBonus": 10,  "days": 50,  "gift": 500 },
    { "star": 3, "label": "3 Star", "totalSales": 10000,  "personalMin": 5000,   "teamMin": 5000,   "dailyBonus": 20,  "days": 50,  "gift": 1000 },
    { "star": 4, "label": "4 Star", "totalSales": 20000,  "personalMin": 10000,  "teamMin": 10000,  "dailyBonus": 33,  "days": 60,  "gift": 2000 },
    { "star": 5, "label": "5 Star", "totalSales": 50000,  "personalMin": 25000,  "teamMin": 25000,  "dailyBonus": 66,  "days": 75,  "gift": 5000 },
    { "star": 6, "label": "6 Star", "totalSales": 100000, "personalMin": 50000,  "teamMin": 50000,  "dailyBonus": 100, "days": 100, "gift": 10000 },
    { "star": 7, "label": "7 Star", "totalSales": 200000, "personalMin": 100000, "teamMin": 100000, "dailyBonus": 166, "days": 120, "gift": 20000 },
    { "star": 8, "label": "8 Star", "totalSales": 500000, "personalMin": 250000, "teamMin": 250000, "dailyBonus": 333, "days": 150, "gift": 50000 }
  ]
}
