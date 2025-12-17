// dashboard.js – BTX.ONE member dashboard logic (no module)

console.log("BUILD:", "20251217_2");
const STORAGE_CURRENT = "btx_current_user_v1";

// -------------------- helpers --------------------
function getCurrentUser(){
  const raw = localStorage.getItem(STORAGE_CURRENT);
  if(!raw) return null;
  try{ return JSON.parse(raw); }catch(e){ return null; }
}

function logout(){
  localStorage.removeItem(STORAGE_CURRENT);
  alert("Logged out.");
  window.location.href = "login.html";
}

function goHome(){ window.location.href = "index.html"; }
function goAdmin(){ window.location.href = "admin.html"; }
function goProfile(){ window.location.href = "profile.html"; }
function goIncomeHistory(){ window.location.href = "income-history.html"; }
function goGenealogy(){ window.location.href = "genealogy.html"; }

function fmt(v){ return "$" + (Number(v||0)).toFixed(2); }

function $(id){ return document.getElementById(id); }
function setText(id, text){
  const el = $(id);
  if(el) el.textContent = text;
}
function setValue(id, val){
  const el = $(id);
  if(el) el.value = val;
}
function setHtml(id, html){
  const el = $(id);
  if(el) el.innerHTML = html;
}

function copyRefLink(){
  const el = $("myRefLink");
  if(!el || !el.value){
    alert("Referral link is empty.");
    return;
  }
  el.select();
  try{
    document.execCommand("copy");
    alert("Referral link copied!");
  }catch(e){
    alert("Copy is not supported – please select and copy manually.");
  }
}

function fallbackCopy(text){
  const tmp = document.createElement("textarea");
  tmp.value = text;
  document.body.appendChild(tmp);
  tmp.select();
  try{ document.execCommand("copy"); }catch(e){}
  document.body.removeChild(tmp);
  alert("Sponsor ID copied: " + text);
}

function copySponsorId(){
  const el = $("accSponsor");
  if(!el || !el.textContent){
    alert("No sponsor ID to copy.");
    return;
  }
  const text = el.textContent.trim();
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(()=>{
      alert("Sponsor ID copied: " + text);
    }).catch(()=> fallbackCopy(text));
  }else{
    fallbackCopy(text);
  }
}

// -------------------- 3-dot menu attach --------------------
document.addEventListener("DOMContentLoaded", () => {
  const menuToggle   = $("menuToggle");
  const menuDropdown = $("menuDropdown");
  if(menuToggle && menuDropdown){
    menuToggle.addEventListener("click", function(e){
      e.stopPropagation();
      menuDropdown.style.display =
        (menuDropdown.style.display === "block" ? "none" : "block");
    });
    document.addEventListener("click", function(e){
      if(!menuDropdown.contains(e.target) && e.target !== menuToggle){
        menuDropdown.style.display = "none";
      }
    });
  }
});

// -------------------- global settings (localStorage) --------------------
async function applyGlobalSettings(){
  try{
    const raw = localStorage.getItem("btx_global_settings_v1");
    if(!raw) return;
    const s = JSON.parse(raw);

    if(s.siteTitle){
      document.title = s.siteTitle + " – Member Dashboard";
      setText("siteTitleHeading", s.siteTitle);
    }
    if(s.dashboardTitle) setText("dashTitleText", s.dashboardTitle);
    if(s.scalpText)      setText("noticeText", s.scalpText);
    if(s.roiNote)        setText("roiNoteText", s.roiNote);
    if(s.withdrawNote)   setText("withdrawNoteText", s.withdrawNote);
    if(s.supportEmail)   setText("supportEmailText", s.supportEmail);

    if(s.telegramLink){
      const tl = $("teleLink");
      if(tl) tl.href = s.telegramLink;
    }
  }catch(err){
    console.error("Global settings load error:", err);
  }
}

// -------------------- summary source --------------------
async function getSummarySmart(user){
  const uName = (user.username || "").toLowerCase();

  // 1) Prefer income-engine summary (single source)
  try{
    if(typeof window.getIncomeSummary === "function"){
      const s = await window.getIncomeSummary(uName);
      if(s && typeof s === "object") return normalizeSummary(s, user);
    }
  }catch(e){
    console.error("getIncomeSummary error:", e);
  }

  // 2) Fallback from user object (Firestore/local snapshot)
  const selfInv      = Number(user.depositTotal   || 0);
  const teamInv      = Number(user.teamInvestment || 0);
  const dailyROI     = Number(user.dailyROI       || 0);

  const sponsorBonus = Number(user.directIncome   || 0);
  const genBonus     = Number(user.teamIncome     || 0);
  const rankBonus    = Number(user.rankIncome     || 0);
  const globalBonus  = Number(user.globalIncome   || 0);

  const giftVoucher  = Number(
    user.giftVoucherIncome ?? user.giftVoucher ?? 0
  );

  const roiEarned    = Number(user.roiEarned || 0);

  const addBal       = Number(user.addBalance || user.balance || 0);
  const earningBal   = Number(user.earningBalance || 0);

  const totalEarn =
    sponsorBonus + genBonus + rankBonus + globalBonus + giftVoucher + roiEarned;

  // ROI 3x barometer (ROI only)
  const barMax     = selfInv * 3;
  const barUsed    = roiEarned;
  const barRemain  = Math.max(0, barMax - barUsed);
  const barPct     = barMax > 0 ? Math.min(100, (barUsed / barMax) * 100) : 0;

  const summary = {
    selfInvestment: selfInv,
    teamInvestment: teamInv,
    totalInvestment: selfInv + teamInv,

    dailyROI,
    roiEarned,

    sponsorBonus,
    genBonus,
    rankBonus,
    globalBonus,
    giftVoucher,

    addBalance: addBal,
    earningBalance: earningBal,

    totalEarning: totalEarn,

    barMax,
    barUsed,
    barRemain,
    barUsedPercent: barPct
  };

  return normalizeSummary(summary, user);
}

function normalizeSummary(summary, user){
  // defensive normalize
  const s = Object.assign({}, summary);

  s.selfInvestment   = Number(s.selfInvestment   ?? user.depositTotal ?? 0);
  s.teamInvestment   = Number(s.teamInvestment   ?? user.teamInvestment ?? 0);
  s.totalInvestment  = Number(s.totalInvestment  ?? (s.selfInvestment + s.teamInvestment));

  s.dailyROI         = Number(s.dailyROI         ?? user.dailyROI ?? 0);
  s.roiEarned        = Number(s.roiEarned        ?? user.roiEarned ?? 0);

  s.sponsorBonus     = Number(s.sponsorBonus     ?? user.directIncome ?? 0);
  s.genBonus         = Number(s.genBonus         ?? user.teamIncome ?? 0);
  s.rankBonus        = Number(s.rankBonus        ?? user.rankIncome ?? 0);
  s.globalBonus      = Number(s.globalBonus      ?? user.globalIncome ?? 0);

  s.giftVoucher      = Number(
    s.giftVoucher ?? user.giftVoucherIncome ?? user.giftVoucher ?? 0
  );

  s.addBalance       = Number(s.addBalance       ?? user.addBalance ?? user.balance ?? 0);
  s.earningBalance   = Number(s.earningBalance   ?? user.earningBalance ?? 0);

  // totalEarning fallback
  if(!Number.isFinite(Number(s.totalEarning))){
    s.totalEarning =
      s.sponsorBonus + s.genBonus + s.rankBonus + s.globalBonus + s.giftVoucher + s.roiEarned;
  }else{
    s.totalEarning = Number(s.totalEarning);
  }

  // ROI barometer normalize
  s.barMax = Number(s.barMax ?? (s.selfInvestment * 3));
  s.barUsed = Number(s.barUsed ?? s.roiEarned);
  s.barRemain = Number(s.barRemain ?? Math.max(0, s.barMax - s.barUsed));
  s.barUsedPercent = Number(
    s.barUsedPercent ??
    (s.barMax > 0 ? Math.min(100, (s.barUsed / s.barMax) * 100) : 0)
  );

  return s;
}

// -------------------- MAIN INIT --------------------
(async function initDashboard(){
  await applyGlobalSettings();

  const user = getCurrentUser();
  if(!user){
    window.location.href = "login.html";
    return;
  }

  // Admin button
  const adminBtn = $("adminBtn");
  if(user.role === "admin" && adminBtn){
    adminBtn.style.display = "inline-flex";
  }

  // Welcome
  const uName = user.username || "member";
  const loginKey = "btx_login_count_" + uName;
  const countRaw = localStorage.getItem(loginKey);
  const count = countRaw ? parseInt(countRaw,10) : 0;

  setText("welcomeName", (count > 0 ? "Welcome back, " : "Welcome, ") + (user.fullName || uName || "Member"));
  setText("welcomeUser", "@" + (uName || ""));
  localStorage.setItem(loginKey, (count + 1).toString());

  // Badge
  if(user.role === "admin"){
    setHtml("roleBadge", '<span class="badge-role">● ADMIN PANEL ACCESS</span>');
  }else{
    setHtml("roleBadge", '<span class="badge-role badge-member">● MEMBER ACCOUNT</span>');
  }

  // Membership text (handle duplicate id case safely)
  const membership = user.membershipType || "free";
  const msEls = document.querySelectorAll("#memberStatus");
  if(msEls && msEls.length){
    msEls[0].textContent = (membership === "premium" ? "Premium Member" : "Free Member");
    // যদি ডাবল থাকে, ২য়টা লুকিয়ে দেই (optional)
    for(let i=1;i<msEls.length;i++){
      msEls[i].style.display = "none";
    }
  }

  // Top right info
  setText("infoEmail",   "Email: "   + (user.email   || "-"));
  setText("infoCountry", "Country: " + (user.country || "-"));
  setText("infoMobile",  "Mobile: "  + (user.mobile  || "-"));
  setText("infoSponsor", "Sponsor: " + (user.sponsor_username || user.refCode || "N/A"));

  // Account details
  setText("accName",    user.fullName || "-");
  setText("accUser",    uName || "-");
  setText("accEmail",   user.email || "-");
  setText("accRole",    (user.role === "admin" ? "Admin" : "Member"));
  setText("accCountry", user.country || "-");
  setText("accMobile",  user.mobile || "-");
  setText("accSponsor", user.sponsor_username || user.refCode || "-");

  if(user.createdAt){
    try{
      const d = new Date(user.createdAt);
      setText("accJoined", d.toLocaleString());
    }catch(e){
      setText("accJoined", "-");
    }
  }

  // Referral link
  const refLink = window.location.origin + "/register-neon.html?ref=" + encodeURIComponent(uName || "");
  setValue("myRefLink", refLink);

  // -------- Summary (single source) --------
  const summary = await getSummarySmart(user);

  // -------- Barometer 1: ALL INCOME 3× (ROI excluded) --------
  // used = sponsor + gen + rank + global + gift (ROI বাদ)
  const capMax = summary.selfInvestment * 3;
  const capUsed = (
    Number(summary.sponsorBonus || 0) +
    Number(summary.genBonus || 0) +
    Number(summary.rankBonus || 0) +
    Number(summary.globalBonus || 0) +
    Number(summary.giftVoucher || 0)
  );
  const capRemain = Math.max(0, capMax - capUsed);
  const capPct = capMax > 0 ? Math.min(100, (capUsed/capMax)*100) : 0;

  setText("capMaxAll", fmt(capMax));
  setText("capUsedAll", fmt(capUsed));
  setText("capRemainAll", fmt(capRemain));

  const capInner = $("capAllInner");
  if(capInner){
    capInner.style.width = capPct + "%";
    capInner.textContent = capPct.toFixed(1) + "% used";
  }

  // -------- Barometer 2: Rank UI --------
  const star = Number(user.rankStar || 0);
  setText("rankLabelUI", (star>0 ? (star+" Star") : "No Rank"));

  const rbMax = Number(user.rankBarMax || 0);
  const rbUsed = Number(user.rankBarUsed || 0);
  const daysLeft = Number(user.rankDaysLeft || 0);

  setText("rankBarMax", fmt(rbMax));
  setText("rankBarUsed", fmt(rbUsed));
  setText("rankDaysLeft", String(daysLeft));

  const rbPct = rbMax > 0 ? Math.min(100,(rbUsed/rbMax)*100) : 0;
  const rbInner = $("rankBarInner");
  if(rbInner){
    rbInner.style.width = rbPct + "%";
    rbInner.textContent = rbPct.toFixed(1) + "% paid";
  }

  // -------- Summary cards --------
  setText("sumAddBalance",  fmt(summary.addBalance));
  setText("sumTeamInv",     fmt(summary.teamInvestment));
  setText("sumTotalInv",    fmt(summary.totalInvestment));
  setText("sumCurrentEarn", fmt(summary.earningBalance));

  setText("miniSelfInv",  fmt(summary.selfInvestment));
  setText("miniTeamInv",  fmt(summary.teamInvestment));
  setText("miniTotalInv", fmt(summary.totalInvestment));

  setText("sumSelf",   fmt(summary.selfInvestment));
  setText("sumROI",    fmt(summary.dailyROI));
  setText("sumDirect", fmt(summary.sponsorBonus));
  setText("sumGen",    fmt(summary.genBonus));
  setText("sumRank",   fmt(summary.rankBonus));
  setText("sumGlobal", fmt(summary.globalBonus));
  setText("sumGift",   fmt(summary.giftVoucher));
  setText("sumTotal",  fmt(summary.totalEarning));

  // -------- Live snapshot --------
  setText("liveCurrentBal",  fmt(summary.addBalance));
  setText("liveCurrentEarn", fmt(summary.earningBalance));
  setText("liveSelfInv",     fmt(summary.selfInvestment));

  const teamSize = Number(
    user.teamCount ||
    user.teamSize ||
    user.totalTeam ||
    user.totalTeamMembers ||
    0
  );
  setText("liveTeamSize", teamSize + " member" + (teamSize === 1 ? "" : "s"));
  setText("liveTotalEarn", fmt(summary.totalEarning));

  // -------- ROI 3× barometer (ROI ONLY) --------
  const uiBarMax    = (summary.selfInvestment || 0) * 3;
  const uiBarUsed   = Number(summary.roiEarned || 0);
  const uiBarRemain = Math.max(0, uiBarMax - uiBarUsed);
  const uiBarPct    = uiBarMax > 0 ? Math.min(100, (uiBarUsed / uiBarMax) * 100) : 0;

  setText("barMax", fmt(uiBarMax));
  setText("barUsed", fmt(uiBarUsed));
  setText("barRemain", fmt(uiBarRemain));

  const bp = $("barProgressInner");
  if(bp){
    bp.style.width  = uiBarPct + "%";
    bp.textContent  = uiBarPct.toFixed(1) + "% used";
  }

  const rv = $("roiVerticalInner");
  const rvLabel = $("roiVerticalLabel");

  const roiRemainPct = uiBarMax > 0 ? Math.max(0, Math.min(100, (uiBarRemain / uiBarMax) * 100)) : 0;
  if(rv){
    rv.style.height = roiRemainPct + "%";
    rv.textContent  = roiRemainPct.toFixed(1) + "%";
  }
  if(rvLabel){
    rvLabel.textContent = roiRemainPct.toFixed(1) + "% left";
  }

  // -------- ROI note --------
  const roiNoteEl = $("roiNoteText");
  const daily = Number(summary.dailyROI || 0);
  if(roiNoteEl){
    let extra = "";
    if(summary.selfInvestment > 0){
      extra += "Your self investment: " + fmt(summary.selfInvestment) +
               " → 3× max return: " + fmt(uiBarMax) + ". ";
    }
    if(daily > 0){
      const remain = uiBarRemain;
      const approxDays = remain>0 ? Math.ceil(remain/daily) : 0;
      extra += "Daily ROI now: " + fmt(daily) +
               " per day. At this rate you can finish the remaining " +
               fmt(remain) + " in about " + approxDays + " day(s), if only ROI is counted.";
    }else{
      extra += "Daily ROI is 0. When admin sets ROI% and you activate a package, daily ROI will start and reduce the 3× barometer every day.";
    }
    roiNoteEl.textContent = roiNoteEl.textContent
      ? roiNoteEl.textContent + " " + extra
      : extra;
  }

  // -------- Charts (safe) --------
  if(typeof window.Chart === "function"){
    const c1 = $("incomeChart");
    if(c1){
      const ctx1 = c1.getContext("2d");
      new Chart(ctx1,{
        type:"bar",
        data:{
          labels:["Self Inv","Daily ROI","Sponsor","Generation","Rank","Global","Gift"],
          datasets:[{
            label:"USDT",
            data:[
              summary.selfInvestment,
              summary.dailyROI,
              summary.sponsorBonus,
              summary.genBonus,
              summary.rankBonus,
              summary.globalBonus,
              summary.giftVoucher
            ]
          }]
        },
        options:{
          plugins:{legend:{display:false}},
          scales:{
            x:{ticks:{color:"#e5f0ff"}},
            y:{ticks:{color:"#e5f0ff"}}
          }
        }
      });
    }

    const c2 = $("roiChart");
    if(c2){
      const ctx2 = c2.getContext("2d");
      const days = [];
      const roiValues = [];
      let capRemain2 = uiBarRemain;
      let cumulative = Number(summary.roiEarned || 0);
      const dailyOnly = Number(summary.dailyROI || 0);

      for(let i=1;i<=30;i++){
        let todayRoi = dailyOnly;
        if(capRemain2<=0) todayRoi = 0;
        if(todayRoi > capRemain2) todayRoi = capRemain2;
        capRemain2 -= todayRoi;
        cumulative += todayRoi;
        days.push(String(i));
        roiValues.push(Number(cumulative.toFixed(2)));
      }

      new Chart(ctx2,{
        type:"line",
        data:{
          labels:days,
          datasets:[{
            label:"Cumulative ROI (only ROI)",
            data:roiValues,
            tension:0.3
          }]
        },
        options:{
          plugins:{legend:{display:false}},
          scales:{
            x:{ticks:{color:"#e5f0ff"}},
            y:{ticks:{color:"#e5f0ff"}}
          }
        }
      });
    }
  }else{
    console.warn("Chart.js not loaded. Charts skipped.");
  }

})();

// -------------------- expose for onclick --------------------
window.logout          = logout;
window.goHome          = goHome;
window.goAdmin         = goAdmin;
window.goProfile       = goProfile;
window.goGenealogy     = goGenealogy;
window.goIncomeHistory = goIncomeHistory;
window.copyRefLink     = copyRefLink;
window.copySponsorId   = copySponsorId;