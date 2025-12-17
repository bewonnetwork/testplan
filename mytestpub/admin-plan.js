// admin-plan.js
// Only PLAN + GLOBAL settings panel (Firestore based, no localStorage)

import { db } from "./firebase-config.js";
import {
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ===========================
// SIMPLE NAV / HEADER ACTIONS
// ===========================
window.goDashboard = function () {
  // member dashboard page
  window.location.href = "dashboard.html";
};

window.goAdminLive = function () {
  // live admin পেজ তুমি যেখানে রেখেছ – ধরে নিচ্ছি admin-live.html
  window.location.href = "admin-live.html";
};

window.adminLogout = function () {
  // এখানে শুধু login পেজে পাঠাচ্ছি।
  // তুমি চাইলে localStorage / cookie clear করে নিতে পারো।
  try {
    localStorage.removeItem("currentUser");
    localStorage.removeItem("currentAdmin");
  } catch (e) {
    console.warn("logout localStorage clear failed:", e);
  }
  window.location.href = "login.html";
};

// ===========================
// TAB SWITCH
// ===========================
window.switchTab = function (tabId, btn) {
  document.querySelectorAll(".tab-section").forEach(sec => {
    sec.classList.remove("active");
  });
  document.querySelectorAll(".tab-btn").forEach(b => {
    b.classList.remove("active");
  });

  const target = document.getElementById("tab-" + tabId);
  if (target) target.classList.add("active");
  if (btn) btn.classList.add("active");
};

// ===========================
// GLOBAL SETTINGS (config/global)
// ===========================

const globalRef = doc(db, "config", "global");

async function loadGlobalSettings() {
  try {
    const snap = await getDoc(globalRef);
    if (!snap.exists()) {
      console.log("No global config yet.");
      return;
    }
    const g = snap.data();

    setValue("setSiteTitle", g.siteTitle);
    setValue("setDashboardTitle", g.dashboardTitle);
    setValue("setScalpText", g.scalpText);
    setValue("setRoiNote", g.roiNote);
    setValue("setWithdrawNote", g.withdrawNote);
    setValue("setSupportEmail", g.supportEmail);
    setValue("setTelegramLink", g.telegramLink);

    setValue("setMarketingTitle", g.marketingTitle);
    setValue("setMarketingText", g.marketingText);
    setValue("setMarketingLink", g.marketingLink);

    setValue("setMenu1Label", g.menu1Label);
    setValue("setMenu1Url", g.menu1Url);
    setValue("setMenu2Label", g.menu2Label);
    setValue("setMenu2Url", g.menu2Url);
    setValue("setMenu3Label", g.menu3Label);
    setValue("setMenu3Url", g.menu3Url);

    // Title / header live update
    if (g.siteTitle) document.title = g.siteTitle + " – Admin PLAN";
  } catch (err) {
    console.error("loadGlobalSettings error:", err);
    alert("Global settings load করতে সমস্যা হয়েছে: " + (err.message || err));
  }
}

function setValue(id, v) {
  const el = document.getElementById(id);
  if (!el) return;
  if (v === undefined || v === null) return;
  el.value = v;
}

async function saveGlobalSettings(ev) {
  ev.preventDefault();

  const data = {
    siteTitle:        getInput("setSiteTitle"),
    dashboardTitle:   getInput("setDashboardTitle"),
    scalpText:        getInput("setScalpText"),
    roiNote:          getInput("setRoiNote"),
    withdrawNote:     getInput("setWithdrawNote"),
    supportEmail:     getInput("setSupportEmail"),
    telegramLink:     getInput("setTelegramLink"),

    marketingTitle:   getInput("setMarketingTitle"),
    marketingText:    getInput("setMarketingText"),
    marketingLink:    getInput("setMarketingLink"),

    menu1Label:       getInput("setMenu1Label"),
    menu1Url:         getInput("setMenu1Url"),
    menu2Label:       getInput("setMenu2Label"),
    menu2Url:         getInput("setMenu2Url"),
    menu3Label:       getInput("setMenu3Label"),
    menu3Url:         getInput("setMenu3Url")
  };

  try {
    await setDoc(globalRef, data, { merge: true });
    alert("✅ Global settings সফলভাবে সেভ হয়েছে।");
  } catch (err) {
    console.error("saveGlobalSettings error:", err);
    alert("❌ Global settings save error: " + (err.message || err));
  }
}

function getInput(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

// ===========================
// PLAN CONFIG (config/plan)
// ===========================

const planRef = doc(db, "config", "plan");

// এক জায়গায় সম্পূর্ণ PLAN – ROI + 3x cap + Generation
// প্রয়োজন হলে শুধু এখানে নাম্বার পরিবর্তন করলেই হবে।
const PLAN_CONFIG = {
  roiPercentPerDay: 1.2,     // দৈনিক ROI % (Self Investment এর উপর)
  maxMultiple:      3,       // 3× cap ( শুধু ROI এর জন্য )
  roiRankPercent:   20,      // ROI এর 20% Rank pool এ যাবে
  sponsorPercent:   5,       // Sponsor direct bonus %
  giftVoucherPercent: 1,     // Gift voucher pool %
  roiAffiliateMultiplier: 1, // future use / extra control

  /**
   * Generation plan – 20 Level
   * তোমার দেওয়া শর্ত অনুযায়ী সাজানো:
   * 1★20% - req 0 sponsor
   * 2★10% - req 3 sponsor
   * 3★5%  - req 2 sponsor
   * 4★4%  - req 1 sponsor
   * 5★3%  - req 1 sponsor
   * 6★2%  - req 1 sponsor
   * 7★5%  - req 1 sponsor
   * 8★4%  - req 1 sponsor
   * 9–11★ 3%,2%,1% - প্রতিটি 3 sponsor
   * 12–17★ 2% - প্রতিটি 3 sponsor
   * 18–20★ 3% - প্রতিটি 3 sponsor
   */
  genLevels: [
    { level: 1,  percent: 20, reqDirect: 0 },
    { level: 2,  percent: 10, reqDirect: 3 },
    { level: 3,  percent: 5,  reqDirect: 2 },
    { level: 4,  percent: 4,  reqDirect: 1 },
    { level: 5,  percent: 3,  reqDirect: 1 },
    { level: 6,  percent: 2,  reqDirect: 1 },
    { level: 7,  percent: 5,  reqDirect: 1 },
    { level: 8,  percent: 4,  reqDirect: 1 },
    { level: 9,  percent: 3,  reqDirect: 3 },
    { level: 10, percent: 2,  reqDirect: 3 },
    { level: 11, percent: 1,  reqDirect: 3 },
    { level: 12, percent: 2,  reqDirect: 3 },
    { level: 13, percent: 2,  reqDirect: 3 },
    { level: 14, percent: 2,  reqDirect: 3 },
    { level: 15, percent: 2,  reqDirect: 3 },
    { level: 16, percent: 2,  reqDirect: 3 },
    { level: 17, percent: 2,  reqDirect: 3 },
    { level: 18, percent: 3,  reqDirect: 3 },
    { level: 19, percent: 3,  reqDirect: 3 },
    { level: 20, percent: 3,  reqDirect: 3 }
  ]
};

// Firestore থেকে PLAN লোড করে summary দেখাবে
async function loadPlanSummary() {
  const box = document.getElementById("planSummary");
  if (!box) return;

  try {
    const snap = await getDoc(planRef);
    if (!snap.exists()) {
      box.textContent = "PLAN এখনো সেট করা হয়নি। 'Save / Update PLAN' বাটন চাপলে তৈরি হবে।";
      return;
    }
    const p = snap.data();

    const roi = p.roiPercentPerDay ?? PLAN_CONFIG.roiPercentPerDay;
    const maxM = p.maxMultiple ?? PLAN_CONFIG.maxMultiple;
    const sponsor = p.sponsorPercent ?? PLAN_CONFIG.sponsorPercent;
    const rankP = p.roiRankPercent ?? PLAN_CONFIG.roiRankPercent;

    const gens = Array.isArray(p.genLevels) ? p.genLevels : PLAN_CONFIG.genLevels;

    const totalGen = gens.reduce((s, g) => s + Number(g.percent || 0), 0);

    let lines = [];
    lines.push(Daily ROI: ${roi}% (Self Investment এর উপর));
    lines.push(3× ROI cap: Self Investment × ${maxM});
    lines.push(Sponsor bonus: ${sponsor}%);
    lines.push(ROI → Rank Pool: ${rankP}%);
    lines.push(Generation levels: ${gens.length} (total ${totalGen}% of Gen pool));

    box.innerHTML = lines.join("<br/>");
  } catch (err) {
    console.error("loadPlanSummary error:", err);
    box.textContent = "PLAN summary লোড করতে সমস্যা হয়েছে: " + (err.message || err);
  }
}

// PLAN_CONFIG → config/plan এ লিখে দেবে
async function seedPlan() {
  try {
    if (!confirm("PLAN (ROI + Generation) আপডেট করতে যাচ্ছেন। কনফার্ম?")) return;

    await setDoc(planRef, PLAN_CONFIG, { merge: true });

    alert("✅ PLAN (ROI + Generation) সফলভাবে আপডেট হয়েছে।");
    loadPlanSummary();
  } catch (err) {
    console.error("seedPlan error:", err);
    alert("❌ PLAN save error: " + (err.message || err));
  }
}
window.seedPlan = seedPlan;

// ===========================
// ROI ENGINE TRIGGER (Tools tab)
// ===========================
window.runROIForAll = function () {
  const statusBox = document.getElementById("roiStatus");
  if (statusBox) {
    statusBox.textContent = "ROI engine starting...";
  }

  // roi-engine.js এ window.runDailyRoi সেট করা আছে ধরে নিচ্ছি
  if (typeof window.runDailyRoi === "function") {
    try {
      window.runDailyRoi(); // runDailyRoi নিজেই alert/status দেখাবে
    } catch (err) {
      console.error("runROIForAll error:", err);
      if (statusBox) {
        statusBox.textContent = "ROI failed: " + (err.message || err);
      }
      alert("❌ ROI engine call failed: " + (err.message || err));
    }
  } else {
    const msg = "runDailyRoi পাওয়া যায়নি। নিশ্চিত হও admin-plan.html এ roi-engine.js script যোগ করা আছে।";
    console.error(msg);
    if (statusBox) statusBox.textContent = msg;
    alert(msg);
  }
};

// ===========================
// INIT
// ===========================
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("settingsForm");
  if (form) {
    form.addEventListener("submit", saveGlobalSettings);
  }

  loadGlobalSettings();
  loadPlanSummary();
});