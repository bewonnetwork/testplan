// admin.js – Firestore Admin Panel (Users + Deposits + Withdraws + Settings)

// ----------------- COMMON -----------------
const STORAGE_CURRENT = "btx_current_user_v1";

import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// current user from localStorage
function getCurrentUser() {
  try {
    const raw = localStorage.getItem(STORAGE_CURRENT);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error("Parse current user error", e);
    return null;
  }
}

// only admin allow
function requireAdmin() {
  const me = getCurrentUser();
  if (!me || me.role !== "admin") {
    alert("Admin access only. Please login as admin.");
    window.location.href = "login.html";
    return null;
  }
  return me;
}

// header buttons
function goDashboard() {
  window.location.href = "dashboard.html";
}

function resetDemo() {
  alert("ℹ এই ভার্সনে সব Deposits + Withdraws Firestore LIVE ডাটা থেকে চলছে। Local demo data নেই।");
}

function adminLogout() {
  localStorage.removeItem(STORAGE_CURRENT);
  localStorage.removeItem("btx_impersonate_user");
  window.location.href = "login.html";
}

window.goDashboard = goDashboard;
window.resetDemo   = resetDemo;
window.adminLogout = adminLogout;

// ----------------- TAB SWITCHING -----------------
function switchTab(tabName, btn) {
  document.querySelectorAll(".tab-btn").forEach((b) => {
    b.classList.toggle("active", b === btn);
  });

  document.querySelectorAll(".tab-section").forEach((sec) => {
    const id = sec.id || "";
    const show =
      (tabName === "users"    && id === "tab-users")    ||
      (tabName === "deposits" && id === "tab-deposits") ||
      (tabName === "withdraws"&& id === "tab-withdraws")||
      (tabName === "settings" && id === "tab-settings");
    sec.style.display = show ? "block" : "none";
    sec.classList.toggle("active", show);
  });
}

window.switchTab = switchTab;

// ----------------- USERS TAB -----------------
let allUsers = [];

async function loadUsers() {
  const snap = await getDocs(collection(db, "users"));
  const list = [];
  snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
  allUsers = list;
  return list;
}

// helper: get search text
function getUserSearchText() {
  const el = document.getElementById("userSearchInput");
  return el ? el.value.trim().toLowerCase() : "";
}

// Users search handler (HTML এ oninput="handleUserSearch()")
function handleUserSearch() {
  renderUsers();
}
window.handleUserSearch = handleUserSearch;

function renderUsers() {
  const tbody = document.getElementById("userTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const search = getUserSearchText();

  // filter by username / email / mobile
  let data = allUsers;
  if (search) {
    data = allUsers.filter((u) => {
      const username = (u.username || u.id || "").toLowerCase();
      const email    = (u.email || "").toLowerCase();
      const mobile   = (u.mobile || "").toLowerCase();
      return (
        username.includes(search) ||
        email.includes(search) ||
        mobile.includes(search)
      );
    });
  }

  // latest first
  const sorted = [...data].sort((a, b) => {
    const ta = a.createdAt || "";
    const tb = b.createdAt || "";
    return tb > ta ? 1 : tb < ta ? -1 : 0;
  });

  sorted.forEach((u, index) => {
    const tr = document.createElement("tr");

    // created date
    const createdValue = u.createdAt;
    let dt = "-";
    if (createdValue) {
      try {
        if (typeof createdValue === "string") {
          dt = new Date(createdValue).toLocaleString();
        } else if (createdValue.toDate) {
          dt = createdValue.toDate().toLocaleString();
        }
      } catch {
        dt = "-";
      }
    }

    const addBal = Number(u.addBalance || u.balance || 0);
    const earn   = Number(u.earningBalance || 0);

    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${dt}</td>
      <td>${u.username || u.id || ""}</td>
      <td>${u.fullName || ""}</td>
      <td>${u.email || ""}</td>
      <td>${u.mobile || ""}</td>
      <td>${u.country || ""}</td>
      <td>${u.role || "member"}</td>
      <td>${u.membershipType || "free"}</td>
      <td>
        Add: $${addBal.toFixed(2)}<br/>
        Earn: $${earn.toFixed(2)}
      </td>
      <td>${u.teamCount || 0}</td>
      <td>${u.refCode || ""}</td>
      <td>
        <button class="btn-table btn-edit" data-uid="${u.id}">Edit</button>
        <button class="btn-table btn-approve" data-imp="${u.id}">Login</button>
        <button class="btn-table btn-reject" data-del="${u.id}">Del</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function fillEditForm(user) {
  if (!user) return;
  document.getElementById("editUserId").value       = user.id || "";
  document.getElementById("editUsername").value     = user.username || user.id || "";
  document.getElementById("editFullName").value     = user.fullName || "";
  document.getElementById("editEmail").value        = user.email || "";
  document.getElementById("editMobile").value       = user.mobile || "";
  document.getElementById("editCountry").value      = user.country || "";
  document.getElementById("editRole").value         = user.role || "member";
  document.getElementById("editMembership").value   = user.membershipType || "free";
  document.getElementById("editBalance").value      = Number(user.earningBalance || 0);
  document.getElementById("editDepositTotal").value = Number(user.depositTotal || 0);
  document.getElementById("editDirectIncome").value = Number(user.directIncome || 0);
  document.getElementById("editTeamIncome").value   = Number(user.teamIncome || 0);
  document.getElementById("editTeamCount").value    = Number(user.teamCount || 0);
  document.getElementById("editRefCode").value      = user.refCode || "";
  document.getElementById("editSponsor").value      = user.sponsor_username || "";
  document.getElementById("editPassword").value     = user.password || ""; // demo only
}

function attachUserTableEvents() {
  const tbody = document.getElementById("userTableBody");
  if (!tbody) return;

  tbody.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;

    const uidEdit = t.getAttribute("data-uid");
    const uidImp  = t.getAttribute("data-imp");
    const uidDel  = t.getAttribute("data-del");

    // Edit
    if (uidEdit) {
      const u = allUsers.find((x) => x.id === uidEdit);
      if (!u) return;
      fillEditForm(u);
      return;
    }

    // Login as (impersonate)
    if (uidImp) {
      const u = allUsers.find((x) => x.id === uidImp);
      if (!u) return;
      localStorage.setItem("btx_impersonate_user", JSON.stringify(u));
      alert("Impersonating " + (u.username || u.id || ""));
      window.location.href = "dashboard.html";
      return;
    }

    // Delete
    if (uidDel) {
      const u = allUsers.find((x) => x.id === uidDel);
      if (!u) return;
      if (!confirm("Delete user " + (u.username || u.id || "") + " ?")) return;
      deleteUser(uidDel);
    }
  });
}

async function deleteUser(uid) {
  try {
    await deleteDoc(doc(db, "users", uid));
    allUsers = allUsers.filter((x) => x.id !== uid);
    renderUsers();
    alert("User deleted.");
  } catch (err) {
    console.error(err);
    alert("Delete error: " + err.message);
  }
}

function attachEditForm() {
  const form = document.getElementById("editUserForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("editUserId").value;
    if (!id) {
      alert("No user selected.");
      return;
    }

    const payload = {
      fullName:         document.getElementById("editFullName").value.trim(),
      email:            document.getElementById("editEmail").value.trim().toLowerCase(),
      mobile:           document.getElementById("editMobile").value.trim(),
      country:          document.getElementById("editCountry").value.trim(),
      role:             document.getElementById("editRole").value || "member",
      membershipType:   document.getElementById("editMembership").value || "free",
      earningBalance:   Number(document.getElementById("editBalance").value || 0),
      addBalance:       Number(document.getElementById("editAddBalance")?.value || 0),
      depositTotal:     Number(document.getElementById("editDepositTotal").value || 0),
      directIncome:     Number(document.getElementById("editDirectIncome").value || 0),
      teamIncome:       Number(document.getElementById("editTeamIncome").value || 0),
      teamCount:        Number(document.getElementById("editTeamCount").value || 0),
      refCode:          document.getElementById("editRefCode").value.trim(),
      sponsor_username: document.getElementById("editSponsor").value.trim().toLowerCase(),
    };

    try {
      const ref = doc(db, "users", id);
      await updateDoc(ref, payload);

      const idx = allUsers.findIndex((x) => x.id === id);
      if (idx !== -1) {
        allUsers[idx] = { ...allUsers[idx], ...payload };
      }
      renderUsers();
      alert("User updated.");
    } catch (err) {
      console.error(err);
      alert("Update error: " + err.message);
    }
  });
}

// ----------------- DEPOSITS TAB -----------------
let allDeposits = [];

async function loadDepositsLive() {
  const snap = await getDocs(collection(db, "deposits"));
  const list = [];
  snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
  allDeposits = list;
  renderDeposits();
}

function renderDeposits() {
  const tbody = document.getElementById("depAdminBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const sorted = [...allDeposits].sort((a, b) => {
    const ta = a.createdAt || "";
    const tb = b.createdAt || "";
    return tb > ta ? 1 : tb < ta ? -1 : 0;
  });

  sorted.forEach((d) => {
    const tr = document.createElement("tr");

    const createdValue = d.createdAt;
    let dt = "-";
    if (createdValue) {
      try {
        if (typeof createdValue === "string") {
          dt = new Date(createdValue).toLocaleString();
        } else if (createdValue.toDate) {
          dt = createdValue.toDate().toLocaleString();
        }
      } catch {
        dt = "-";
      }
    }

    tr.innerHTML = `
      <td>${dt}</td>
      <td>${d.username || d.user || ""}</td>
      <td>$${Number(d.amount || 0).toFixed(2)}</td>
      <td>${d.method || ""}</td>
      <td>${d.txn || ""}</td>
      <td class="${
        d.status === "approved"
          ? "status-approved"
          : d.status === "rejected"
          ? "status-rejected"
          : "status-pending"
      }">${d.status || "pending"}</td>
      <td>
        <button class="btn-table btn-approve" data-dep-ok="${d.id}">Approve</button>
        <button class="btn-table btn-reject" data-dep-no="${d.id}">Reject</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.onclick = onDepositAction;
}

async function onDepositAction(e) {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;

  const okId = t.getAttribute("data-dep-ok");
  const noId = t.getAttribute("data-dep-no");
  if (!okId && !noId) return;

  const id = okId || noId;
  const item = allDeposits.find((x) => x.id === id);
  if (!item) return;

  // APPROVE
  if (okId) {
    if (item.status === "approved") {
      alert("Already approved.");
      return;
    }

    try {
      const username = (item.username || item.user || "").toLowerCase();
      const amount   = Number(item.amount || 0);

      if (username && amount > 0) {
        const userRef  = doc(db, "users", username);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const u = userSnap.data();
          const newAddBalance = Number(u.addBalance || u.balance || 0) + amount;

          await updateDoc(userRef, {
            addBalance: newAddBalance
          });
        }
      }

      await updateDoc(doc(db, "deposits", id), {
        status: "approved"
      });

      item.status = "approved";
      renderDeposits();
      alert("Deposit approved + Add Balance updated.");
    } catch (err) {
      console.error(err);
      alert("Approve error: " + (err.message || err));
    }
  }
  // REJECT
  else if (noId) {
    if (item.status === "rejected") {
      alert("Already rejected.");
      return;
    }
    try {
      await updateDoc(doc(db, "deposits", id), {
        status: "rejected"
      });
      item.status = "rejected";
      renderDeposits();
      alert("Deposit rejected.");
    } catch (err) {
      console.error(err);
      alert("Reject error: " + (err.message || err));
    }
  }
}

// ----------------- WITHDRAWS TAB -----------------
let allWithdraws = [];

async function loadWithdrawsLive() {
  const snap = await getDocs(collection(db, "withdraws"));
  const list = [];
  snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
  allWithdraws = list;
  renderWithdraws();
}

function renderWithdraws() {
  const tbody = document.getElementById("wdAdminBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const sorted = [...allWithdraws].sort((a, b) => {
    const ta = a.createdAt || "";
    const tb = b.createdAt || "";
    return tb > ta ? 1 : tb < ta ? -1 : 0;
  });

  sorted.forEach((w) => {
    const tr = document.createElement("tr");

    const createdValue = w.createdAt;
    let dt = "-";
    if (createdValue) {
      try {
        if (typeof createdValue === "string") {
          dt = new Date(createdValue).toLocaleString();
        } else if (createdValue.toDate) {
          dt = createdValue.toDate().toLocaleString();
        }
      } catch {
        dt = "-";
      }
    }

    tr.innerHTML = `
      <td>${dt}</td>
      <td>${w.username || w.user || ""}</td>
      <td>$${Number(w.amount || 0).toFixed(2)}</td>
      <td>${w.method || ""}</td>
      <td>${w.wallet || ""}</td>
      <td class="${
        w.status === "approved"
          ? "status-approved"
          : w.status === "rejected"
          ? "status-rejected"
          : "status-pending"
      }">${w.status || "pending"}</td>
      <td>
        <button class="btn-table btn-approve" data-wd-ok="${w.id}">Approve</button>
        <button class="btn-table btn-reject" data-wd-no="${w.id}">Reject</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.onclick = onWithdrawAction;
}

async function onWithdrawAction(e) {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;

  const okId = t.getAttribute("data-wd-ok");
  const noId = t.getAttribute("data-wd-no");
  if (!okId && !noId) return;

  const id = okId || noId;
  const item = allWithdraws.find((x) => x.id === id);
  if (!item) return;

  // APPROVE
  if (okId) {
    if (item.status === "approved") {
      alert("Already approved.");
      return;
    }

    try {
      const username = (item.username || item.user || "").toLowerCase();
      const amount   = Number(item.amount || 0);

      if (username && amount > 0) {
        const ref  = doc(db, "users", username);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const u   = snap.data();
          const bal = Number(u.earningBalance || 0);

          if (bal < amount) {
            alert("User does not have enough earning balance.");
          } else {
            const newBal = bal - amount;
            const newWd  = Number(u.withdrawTotal || 0) + amount;

            await updateDoc(ref, {
              earningBalance: newBal,
              withdrawTotal:  newWd
            });
          }
        }
      }

      await updateDoc(doc(db, "withdraws", id), {
        status: "approved"
      });

      item.status = "approved";
      renderWithdraws();
      alert("Withdraw approved + earning balance updated.");
    } catch (err) {
      console.error(err);
      alert("Withdraw approve error: " + (err.message || err));
    }
  }
  // REJECT
  else if (noId) {
    if (item.status === "rejected") {
      alert("Already rejected.");
      return;
    }
    try {
      await updateDoc(doc(db, "withdraws", id), {
        status: "rejected"
      });
      item.status = "rejected";
      renderWithdraws();
      alert("Withdraw rejected.");
    } catch (err) {
      console.error(err);
      alert("Withdraw reject error: " + (err.message || err));
    }
  }
}

// ----------------- SETTINGS TAB -----------------
async function loadSettings() {
  try {
    const ref  = doc(db, "config", "global");
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    const s = snap.data();
    const g = (id) => document.getElementById(id);

    if (g("setSiteTitle"))      g("setSiteTitle").value      = s.siteTitle      || "";
    if (g("setDashTitle"))      g("setDashTitle").value      = s.dashboardTitle || "";
    if (g("setScalpText"))      g("setScalpText").value      = s.scalpText      || "";
    if (g("setRoiNote"))        g("setRoiNote").value        = s.roiNote        || "";
    if (g("setWithdrawNote"))   g("setWithdrawNote").value   = s.withdrawNote   || "";
    if (g("setSupportEmail"))   g("setSupportEmail").value   = s.supportEmail   || "";
    if (g("setTelegramLink"))   g("setTelegramLink").value   = s.telegramLink   || "";

    if (g("setMarketingTitle")) g("setMarketingTitle").value = s.marketingTitle || "";
    if (g("setMarketingText"))  g("setMarketingText").value  = s.marketingText  || "";
    if (g("setMarketingLink"))  g("setMarketingLink").value  = s.marketingLink  || "";

    if (g("setMenu1Label"))     g("setMenu1Label").value     = s.menu1Label     || "";
    if (g("setMenu1Url"))       g("setMenu1Url").value       = s.menu1Url       || "";
    if (g("setMenu2Label"))     g("setMenu2Label").value     = s.menu2Label     || "";
    if (g("setMenu2Url"))       g("setMenu2Url").value       = s.menu2Url       || "";
    if (g("setMenu3Label"))     g("setMenu3Label").value     = s.menu3Label     || "";
    if (g("setMenu3Url"))       g("setMenu3Url").value       = s.menu3Url       || "";
  } catch (err) {
    console.error("loadSettings error", err);
  }
}

function attachSettingsForm() {
  const form = document.getElementById("settingsForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = {
      siteTitle:      (document.getElementById("setSiteTitle").value || "").trim(),
      dashboardTitle: (document.getElementById("setDashTitle").value || "").trim(),
      scalpText:      (document.getElementById("setScalpText").value || "").trim(),
      roiNote:        (document.getElementById("setRoiNote").value || "").trim(),
      withdrawNote:   (document.getElementById("setWithdrawNote").value || "").trim(),
      supportEmail:   (document.getElementById("setSupportEmail").value || "").trim(),
      telegramLink:   (document.getElementById("setTelegramLink").value || "").trim(),

      marketingTitle: (document.getElementById("setMarketingTitle").value || "").trim(),
      marketingText:  (document.getElementById("setMarketingText").value  || "").trim(),
      marketingLink:  (document.getElementById("setMarketingLink").value  || "").trim(),

      menu1Label:     (document.getElementById("setMenu1Label").value || "").trim(),
      menu1Url:       (document.getElementById("setMenu1Url").value   || "").trim(),
      menu2Label:     (document.getElementById("setMenu2Label").value || "").trim(),
      menu2Url:       (document.getElementById("setMenu2Url").value   || "").trim(),
      menu3Label:     (document.getElementById("setMenu3Label").value || "").trim(),
      menu3Url:       (document.getElementById("setMenu3Url").value   || "").trim(),
    };

    try {
      await setDoc(doc(db, "config", "global"), data, { merge: true });
      alert("Settings updated.");
    } catch (err) {
      console.error(err);
      alert("Settings save error: " + err.message);
    }
  });
}

// ----------------- OPTIONAL ROI BUTTON -----------------
async function runROIForAll() {
  if (!confirm("Run Daily ROI engine (if loaded)?")) return;

  try {
    if (typeof window.runDailyRoi === "function") {
      await window.runDailyRoi();
      alert("✅ ROI engine finished.");
    } else {
      alert("ROI engine (runDailyRoi) পাওয়া যায়নি। roi-engine.js include আছে কিনা check করো।");
    }
  } catch (err) {
    console.error(err);
    alert("ROI run error: " + (err.message || err));
  }
}

window.runROIForAll = runROIForAll;

// ----------------- INIT ADMIN -----------------
(async function initAdmin() {
  const admin = requireAdmin();
  if (!admin) return;

  try {
    await loadUsers();
    renderUsers();
    attachUserTableEvents();
    attachEditForm();

    await loadDepositsLive();
    await loadWithdrawsLive();

    await loadSettings();
    attachSettingsForm();
  } catch (err) {
    console.error(err);
    alert("Admin load error: " + err.message);
  }
})();