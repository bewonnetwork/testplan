// deposit.js – FULL LIVE Firestore deposit (BTX.ONE)


console.log("BUILD:", "20251217_1");
import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const STORAGE_CURRENT = "btx_current_user_v1";

// ──────────────────────────
// Helper: current user
// ──────────────────────────
function getCurrentUser() {
  const raw = localStorage.getItem(STORAGE_CURRENT);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error("current user parse error", e);
    return null;
  }
}

// ──────────────────────────
// Copy wallet address button
// ──────────────────────────
function initCopyButton() {
  const copyBtn   = document.getElementById("copyAddrBtn");
  const addrInput = document.getElementById("depWalletAddr");
  if (!copyBtn || !addrInput) return;

  copyBtn.addEventListener("click", () => {
    addrInput.select();
    addrInput.setSelectionRange(0, 99999);
    try {
      document.execCommand("copy");
      alert("Wallet address copied.");
    } catch (e) {
      alert("Copy not supported. Please copy manually.");
    }
  });
}

// ──────────────────────────
// MAIN: form submit
// ──────────────────────────
async function handleDepositSubmit(e) {
  e.preventDefault();

  const user = getCurrentUser();
  if (!user) {
    alert("Please login again.");
    window.location.href = "login.html";
    return;
  }

  const uname  = (user.username || "").toLowerCase();
  const amount = parseFloat(
    document.getElementById("depAmount").value || "0"
  );
  const method = document.getElementById("depMethod").value || "";
  const txn    = document.getElementById("depTxn").value.trim();

  if (!amount || isNaN(amount) || amount <= 0) {
    alert("Enter valid amount (min 5 USDT).");
    return;
  }
  if (amount < 5) {
    alert("Minimum deposit is 5 USDT.");
    return;
  }
  if (!txn || txn.length < 5) {
    alert("Please enter transaction hash / Txn ID.");
    return;
  }

  try {
    // 🔥 শুধু deposit request – sponsor commission এখানে কিছুই নেই
    await addDoc(collection(db, "deposits"), {
      username:  uname,
      user:      uname,
      amount:    amount,
      method:    method,
      txn:       txn,
      status:    "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    alert("✅ Deposit request submitted. Please wait for admin approval.");
    window.location.href = "dashboard.html";
  } catch (err) {
    console.error(err);
    alert("Deposit request error: " + (err.message || err));
  }
}

// ──────────────────────────
// INIT
// ──────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("depForm");
  if (!form) {
    console.error("depForm not found");
    return;
  }

  const user = getCurrentUser();
  if (!user) {
    alert("Please login first.");
    window.location.href = "login.html";
    return;
  }

  initCopyButton();
  form.addEventListener("submit", handleDepositSubmit);
});