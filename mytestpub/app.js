// public/admin.js – LOCALSTORAGE based Admin + Firestore users + deposit/withdraw

import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const STORAGE_CURRENT = "btx_current_user_v1";
const STORAGE_IMP     = "btx_impersonate_user";

// ---------- DOM ----------
const userTbody   = document.getElementById("userTableBody");
const depAdminBody = document.getElementById("depAdminBody");
const wdAdminBody  = document.getElementById("wdAdminBody");

const editForm         = document.getElementById("editUserForm");
const editUserId       = document.getElementById("editUserId");
const editUsername     = document.getElementById("editUsername");
const editFullName     = document.getElementById("editFullName");
const editEmail        = document.getElementById("editEmail");
const editMobile       = document.getElementById("editMobile");
const editCountry      = document.getElementById("editCountry");
const editRole         = document.getElementById("editRole");
const editMembership   = document.getElementById("editMembership");
const editBalance      = document.getElementById("editBalance");
const editDepositTotal = document.getElementById("editDepositTotal");
const editDirectIncome = document.getElementById("editDirectIncome");
const editTeamIncome   = document.getElementById("editTeamIncome");
const editTeamCount    = document.getElementById("editTeamCount");
const editRefCode      = document.getElementById("editRefCode");
const editSponsor      = document.getElementById("editSponsor");
const editPassword     = document.getElementById("editPassword");

// ---------- STATE ----------
let currentAdmin = null;
let allUsers     = [];

// ---------- Helper: current admin from localStorage ----------
function loadCurrentAdmin() {
  const raw = localStorage.getItem(STORAGE_CURRENT);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ---------- Header Buttons (admin.html এ onclick আছে) ----------
window.goDashboard = function () {
  window.location.href = "dashboard.html";
};

window.adminLogout = function () {
  localStorage.removeItem(STORAGE_CURRENT);
  localStorage.removeItem(STORAGE_IMP);
  alert("Logged out.");
  window.location.href = "login.html";
};

// Tab switch
window.switchTab = function (name, btn) {
  document.querySelectorAll(".tab-section").forEach((s) => {
    s.classList.remove("active");
  });
  const section = document.getElementById("tab-" + name);
  if (section) section.classList.add("active");

  document.querySelectorAll(".tab-btn").forEach((b) =>
    b.classList.remove("active")
  );
  if (btn) btn.classList.add("active");
};

// Demo reset – শুধু সব user-এর income/balance reset করে
window.resetDemo = async function () {
  if (!confirm("Demo reset করবেন? সব user-এর balance/income 0 হবে.")) return;

  const snap = await getDocs(collection(db, "users"));
  const batch = [];
  for (const d of snap.docs) {
    batch.push(updateDoc(d.ref, {
      balance: 0,
      depositTotal: 0,
      withdrawTotal: 0,
      directIncome: 0,
      teamIncome: 0,
      teamCount: 0
    }));
  }
  await Promise.all(batch);
  alert("✅ Demo reset done.");
  await loadAndRenderUsers();
};

// ---------- Users Load & Render ----------
async function loadAndRenderUsers() {
  const snap = await getDocs(query(collection(db, "users")));
  allUsers = [];
  snap.forEach((d) => allUsers.push({ id: d.id, ...d.data() }));

  allUsers.sort((a, b) =>
    (a.createdAt || "").localeCompare(b.createdAt || "")
  );

  if (!userTbody) return;
  userTbody.innerHTML = "";

  allUsers.forEach((u) => {
    const tr = document.createElement("tr");
    const dt = u.createdAt ? new Date(u.createdAt).toLocaleString() : "-";

    tr.innerHTML = `
      <td>${u.username || ""}</td>
      <td>${u.fullName || ""}</td>
      <td>${u.email || ""}</td>
      <td>${u.mobile || ""}</td>
      <td>${u.country || ""}</td>
      <td>$${Number(u.balance || 0).toFixed(2)}</td>
      <td>$${Number(u.depositTotal || 0).toFixed(2)}</td>
      <td>$${Number(u.directIncome || 0).toFixed(2)}</td>
      <td>$${Number(u.teamIncome || 0).toFixed(2)}</td>
      <td>${u.teamCount || 0}</td>
      <td>${u.refCode || "-"}</td>
      <td>${dt}</td>
      <td>
        <button class="btn-table btn-edit" data-act="edit" data-id="${u.id}">Edit</button>
        <button class="btn-table btn-approve" data-act="imp" data-id="${u.id}">Login</button>
      </td>
    `;
    userTbody.appendChild(tr);
  });
}

// user table actions
userTbody?.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const act = btn.dataset.act;
  const id  = btn.dataset.id;
  if (!id) return;

  if (act === "edit") {
    openEditUser(id);
  } else if (act === "imp") {
    impersonateUser(id);
  }
});

// ---------- Edit User ----------
function openEditUser(userId) {
  const u = allUsers.find((x) => x.id === userId);
  if (!u) {
    alert("User not found.");
    return;
  }

  editUserId.value       = userId;
  editUsername.value     = u.username || "";
  editFullName.value     = u.fullName || "";
  editEmail.value        = u.email || "";
  editMobile.value       = u.mobile || "";
  editCountry.value      = u.country || "";
  editRole.value         = u.role || "member";
  editMembership.value   = u.membershipType || "free";
  editBalance.value      = Number(u.balance || 0).toString();
  editDepositTotal.value = Number(u.depositTotal || 0).toString();
  editDirectIncome.value = Number(u.directIncome || 0).toString();
  editTeamIncome.value   = Number(u.teamIncome || 0).toString();
  editTeamCount.value    = Number(u.teamCount || 0).toString();
  editRefCode.value      = u.refCode || "";
  editSponsor.value      = u.sponsor_username || "";
  editPassword.value     = u.password || "";
}

editForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = editUserId.value;
  if (!id) {
    alert("No user selected.");
    return;
  }

  try {
    const ref = doc(db, "users", id);
    await updateDoc(ref, {
      fullName:        editFullName.value.trim(),
      email:           editEmail.value.trim().toLowerCase(),
      mobile:          editMobile.value.trim(),
      country:         editCountry.value.trim(),
      role:            editRole.value,
      membershipType:  editMembership.value,
      balance:         Number(editBalance.value || "0"),
      depositTotal:    Number(editDepositTotal.value || "0"),
      directIncome:    Number(editDirectIncome.value || "0"),
      teamIncome:      Number(editTeamIncome.value || "0"),
      teamCount:       Number(editTeamCount.value || "0"),
      refCode:         editRefCode.value.trim(),
      sponsor_username:editSponsor.value.trim(),
      password:        editPassword.value, // demo only
    });

    alert("✅ Member updated.");
    await loadAndRenderUsers();
  } catch (err) {
    console.error(err);
    alert("Update error: " + err.message);
  }
});

// ---------- Impersonate ----------
async function impersonateUser(userId) {
  const ref  = doc(db, "users", userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    alert("User not found.");
    return;
  }
  const u = { id: snap.id, ...snap.data() };
  localStorage.setItem(STORAGE_IMP, JSON.stringify(u));
  alert("Now viewing as " + (u.username || ""));
  window.location.href = "dashboard.html";
}

// ---------- Deposit & Withdraw Admin Panel ----------
function renderStatusTag(status) {
  if (status === "approved") {
    return '<span class="status-approved">APPROVED</span>';
  }
  if (status === "rejected") {
    return '<span class="status-rejected">REJECTED</span>';
  }
  return '<span class="status-pending">PENDING</span>';
}

async function updateUserBalance(username, deltaDeposit, deltaWithdraw) {
  const uRef  = doc(db, "users", username);
  const uSnap = await getDoc(uRef);
  if (!uSnap.exists()) return;
  const u = uSnap.data();

  const oldBal   = Number(u.balance || 0);
  const oldDep   = Number(u.depositTotal || 0);
  const oldWithd = Number(u.withdrawTotal || 0);

  const newBal   = oldBal + (deltaDeposit || 0) - (deltaWithdraw || 0);
  const newDep   = oldDep + (deltaDeposit || 0);
  const newWithd = oldWithd + (deltaWithdraw || 0);

  if (newBal < 0) throw new Error("Balance negative হচ্ছে।");

  await updateDoc(uRef, {
    balance: newBal,
    depositTotal: newDep,
    withdrawTotal: newWithd
  });
}

// Deposit requests load
async function loadDepositRequests() {
  if (!depAdminBody) return;

  const qRef = query(
    collection(db, "deposit_requests"),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(qRef);

  depAdminBody.innerHTML = "";
  snap.forEach((d) => {
    const r = d.data();
    const amount = Number(r.amount || 0).toFixed(2);
    const method = r.method || "-";
    const wallet = r.wallet || "-";
    const status = r.status || "pending";
    const t      = r.createdAt?.toDate?.() || null;
    const time   = t ? t.toLocaleString() : "-";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${time}</td>
      <td>${r.username}</td>
      <td>${amount}</td>
      <td>${method}</td>
      <td>${wallet}</td>
      <td>${renderStatusTag(status)}</td>
      <td>
        <button class="btn-table btn-approve" data-act="dep-approve" data-id="${d.id}">Approve</button>
        <button class="btn-table btn-reject"  data-act="dep-reject"  data-id="${d.id}">Reject</button>
      </td>
    `;
    depAdminBody.appendChild(tr);
  });
}

// Withdraw requests load
async function loadWithdrawRequests() {
  if (!wdAdminBody) return;

  const qRef = query(
    collection(db, "withdraw_requests"),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(qRef);

  wdAdminBody.innerHTML = "";
  snap.forEach((d) => {
    const r = d.data();
    const amount = Number(r.amount || 0).toFixed(2);
    const method = r.method || "-";
    const wallet = r.wallet || "-";
    const status = r.status || "pending";
    const t      = r.createdAt?.toDate?.() || null;
    const time   = t ? t.toLocaleString() : "-";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${time}</td>
      <td>${r.username}</td>
      <td>${amount}</td>
      <td>${method}</td>
      <td>${wallet}</td>
      <td>${renderStatusTag(status)}</td>
      <td>
        <button class="btn-table btn-approve" data-act="wd-approve" data-id="${d.id}">Approve</button>
        <button class="btn-table btn-reject"  data-act="wd-reject"  data-id="${d.id}">Reject</button>
      </td>
    `;
    wdAdminBody.appendChild(tr);
  });
}

// Deposit actions
depAdminBody?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const act = btn.dataset.act;
  const id  = btn.dataset.id;
  if (!id) return;

  try {
    const ref  = doc(db, "deposit_requests", id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const r = snap.data();

    if (r.status !== "pending") {
      alert("এই request already " + r.status);
      return;
    }

    if (act === "dep-approve") {
      await updateDoc(ref, {
        status: "approved",
        updatedAt: serverTimestamp()
      });
      await updateUserBalance(r.username, Number(r.amount), 0);
      alert("✅ Deposit approved & balance updated.");
    } else if (act === "dep-reject") {
      await updateDoc(ref, {
        status: "rejected",
        updatedAt: serverTimestamp()
      });
      alert("❌ Deposit rejected.");
    }

    await loadDepositRequests();
  } catch (err) {
    console.error(err);
    alert("Error: " + err.message);
  }
});

// Withdraw actions
wdAdminBody?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const act = btn.dataset.act;
  const id  = btn.dataset.id;
  if (!id) return;

  try {
    const ref  = doc(db, "withdraw_requests", id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const r = snap.data();

    if (r.status !== "pending") {
      alert("এই request already " + r.status);
      return;
    }

    if (act === "wd-approve") {
      // balance check
      const uRef  = doc(db, "users", r.username);
      const uSnap = await getDoc(uRef);
      if (!uSnap.exists()) throw new Error("User not found");

      const u = uSnap.data();
      const bal = Number(u.balance || 0);
      if (Number(r.amount) > bal) {
        alert("❌ User balance কম। Approve করা যাবে না।");
        return;
      }

      await updateDoc(ref, {
        status: "approved",
        updatedAt: serverTimestamp()
      });
      await updateUserBalance(r.username, 0, Number(r.amount));
      alert("✅ Withdraw approved & balance updated.");
    } else if (act === "wd-reject") {
      await updateDoc(ref, {
        status: "rejected",
        updatedAt: serverTimestamp()
      });
      alert("❌ Withdraw rejected.");
    }

    await loadWithdrawRequests();
  } catch (err) {
    console.error(err);
    alert("Error: " + err.message);
  }
});

// ---------- INIT ----------
(async function initAdmin() {
  const me = loadCurrentAdmin();
  if (!me) {
    alert("Admin panel এ যাওয়ার আগে login করুন।");
    window.location.href = "login.html";
    return;
  }
  if (me.role !== "admin") {
    alert("শুধু admin role থাকলে admin panel এ ঢোকা যাবে।");
    window.location.href = "dashboard.html";
    return;
  }
  currentAdmin = me;
  await loadAndRenderUsers();
  await loadDepositRequests();
  await loadWithdrawRequests();
})();
