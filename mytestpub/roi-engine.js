// roi-engine.js
// Daily ROI + 20 Level Generation (Firestore only, NO localStorage)


console.log("BUILD:", "20251217_1");
import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

import { creditIncome } from "./income-helpers.js";

// ---------- DEFAULT PLAN (fallback) ----------
const DEFAULT_PLAN = {
  roiPercentPerDay: 1.2, // Daily ROI %
  // maxMultiple আগের মতো ব্যবহার করছি না, cap = 1x fixed
};

// 20 level Generation percent (মোট = 80%)
const GEN_PERCENT = [
  20, // 1
  10, // 2
   5, // 3
   4, // 4
   3, // 5
   2, // 6
   5, // 7
   4, // 8
   3, // 9
   2, // 10
   1, // 11
   2, // 12
   2, // 13
   2, // 14
   2, // 15
   2, // 16
   2, // 17
   3, // 18
   3, // 19
   3, // 20
]; // Total = 80%

// ---------- Helpers ----------

// Firestore থেকে plan config লোড (roiPercentPerDay)
let PLAN_CACHE = null;

async function loadPlanConfig() {
  if (PLAN_CACHE) return PLAN_CACHE;

  try {
    const ref = doc(db, "config", "plan");
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const d = snap.data();
      const cfg = {
        roiPercentPerDay:
          Number(d.roiPercentPerDay) || DEFAULT_PLAN.roiPercentPerDay,
      };
      PLAN_CACHE = cfg;
      console.log("PLAN config loaded:", cfg);
      return cfg;
    }
  } catch (e) {
    console.error("PLAN config load error:", e);
  }

  PLAN_CACHE = DEFAULT_PLAN;
  console.log("PLAN config fallback:", DEFAULT_PLAN);
  return DEFAULT_PLAN;
}

// Direct sponsor সংখ্যা বের করা (just helper)
function getDirectCount(u) {
  return Number(
    u.directCount ??
      u.directSponsorCount ??
      u.teamCount ??
      0
  );
}

/**
 * কত sponsor থাকলে কত level পর্যন্ত Generation পাবে
 */
function getMaxGenLevel(directs) {
  if (directs >= 16) return 20; // 16 sponsor ⇒ 20 level
  if (directs >= 13) return 14; // 13–15 sponsor ⇒ 14 level
  if (directs >= 10) return 8;  // 10–12 sponsor ⇒ 8 level
  if (directs >= 5)  return 3;  // 5–9 sponsor  ⇒ 3 level
  if (directs >= 3)  return 2;  // 3–4 sponsor ⇒ 2 level
  return 1;                     // 0–2 sponsor ⇒ শুধু 1st level
}

// সব user একবারে লোড করে map বানানো
async function loadAllUsersMap() {
  const snap = await getDocs(collection(db, "users"));
  const map = {};
  snap.forEach((d) => {
    const id = d.id.toLowerCase();
    map[id] = {
      id,
      ref: d.ref,
      data: d.data(),
    };
  });
  return map;
}

// Upline chain (max 20 level)
function getUplineChain(userObj, usersMap, maxLevels) {
  const chain = [];
  let current = userObj;

  for (let i = 0; i < maxLevels; i++) {
    const sponsorUsername = (current.data.sponsor_username || "")
      .toString()
      .toLowerCase();

    if (!sponsorUsername) break;
    const spObj = usersMap[sponsorUsername];
    if (!spObj) break;

    chain.push(spObj);
    current = spObj;
  }
  return chain;
}

// ========== MAIN ENGINE ==========

async function runDailyRoi() {
  const statusBox = document.getElementById("roiStatus");
  if (statusBox) statusBox.textContent = "Running ROI engine...";

  try {
    // 1) PLAN config + all users লোড
    const PLAN = await loadPlanConfig();
    const usersMap = await loadAllUsersMap();
    const usernames = Object.keys(usersMap);

    for (const uname of usernames) {
      const uObj = usersMap[uname];
      const u = uObj.data;

      const username = (u.username || uname).toLowerCase();
      const membership = u.membershipType || "free";
      const depTotal = Number(u.depositTotal || 0);

      // Premium + self investment থাকতে হবে
      if (membership !== "premium" || depTotal <= 0) continue;

      // ROI %
      const roiPercent = Number(u.roiPercentPerDay || PLAN.roiPercentPerDay);
      if (!roiPercent || roiPercent <= 0) continue;

      // -------- 1x Barometer: ONLY ROI (100% cap) --------
      const barMax = depTotal * 1; // selfInv * 1x (100%)
      const roiBefore = Number(u.roiEarned || 0); // শুধু ROI
      let roomSelf = barMax - roiBefore;
      if (roomSelf <= 0) {
        console.log("ROI 100% finished for:", username);
        continue;
      }

      // আজকের base ROI
      let baseRoi = (depTotal * roiPercent) / 100;
      if (baseRoi > roomSelf) baseRoi = roomSelf;
      if (baseRoi <= 0) continue;

      // -------- Self ROI (type = "roi") --------
      await creditIncome(username, baseRoi, "roi");
      // local mirror update
      u.roiEarned = roiBefore + baseRoi;

      // -------- Generation pool (80% of self ROI) --------
      const genPool = baseRoi * 0.8; // 80%
      if (genPool <= 0) continue;

      const upline = getUplineChain(uObj, usersMap, 20);

      for (let i = 0; i < 20; i++) {
        const upObj = upline[i];
        if (!upObj) break;

        const levelNumber = i + 1;
        const upData = upObj.data;
        const upName = (upData.username || upObj.id).toLowerCase();

        // sponsor শর্ত
        const directs = getDirectCount(upData);
        const maxLvl = getMaxGenLevel(directs);
        if (levelNumber > maxLvl) continue;

        // upline-এরও investment + premium লাগবে
        const upDep = Number(upData.depositTotal || 0);
        const upMem = upData.membershipType || "free";
        if (upDep <= 0 || upMem !== "premium") continue;

        // এই level এর জন্য share
        const rawShare = genPool * (GEN_PERCENT[i] / 80); // মোট 80 ভাগ
        if (rawShare <= 0) continue;

        // Generation income-এর উপর *কোনো cap নেই*
        await creditIncome(upName, rawShare, "gen");

        // local mirror (optional)
        const oldTeam = Number(upData.teamIncome || upData.genIncome || 0);
        upData.teamIncome = oldTeam + rawShare;
      }
    }

    if (statusBox) statusBox.textContent = "ROI run completed.";
    alert("✅ Daily ROI + 20 Level Generation completed!");
  } catch (err) {
    console.error(err);
    if (statusBox) statusBox.textContent = "ROI failed: " + (err.message || err);
    alert("❌ ROI failed: " + (err.message || err));
  }
}

// global window-তে expose করা – admin.js / admin.html থেকে কল করার জন্য
window.runDailyRoi = runDailyRoi;