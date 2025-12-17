// mytestpub/register.js — Full (NOT shortened)
// Sponsor + Binary placement (L/R) + optional placement username + auto placement preview

import { db } from "./firebase-config.js";

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ---------- ELEMENTS ----------
const form = document.getElementById("registerForm");

const countrySel = document.getElementById("country");
const mobileInput = document.getElementById("mobile");

const p1 = document.getElementById("password");
const p2 = document.getElementById("password2");

const strengthEl = document.getElementById("passStrength");
const matchEl = document.getElementById("passMatch");

const sponsorInput = document.getElementById("sponsor");
const sponsorHint = document.getElementById("sponsorHint");

const binSideSel = document.getElementById("binSide");     // L / R
const placementInput = document.getElementById("placement");
const placeHint = document.getElementById("placeHint");

// ---------- UI HELPERS ----------

// Auto add dial code on country change
if (countrySel && mobileInput) {
  countrySel.addEventListener("change", () => {
    const opt = countrySel.options[countrySel.selectedIndex];
    const code = opt ? opt.getAttribute("data-code") : "";
    if (code && (!mobileInput.value || !mobileInput.value.startsWith(code))) {
      mobileInput.value = code + " ";
    }
  });
}

// Show / hide password
document.querySelectorAll(".rn-eye").forEach((btn) => {
  btn.addEventListener("click", () => {
    const id = btn.dataset.target;
    const el = document.getElementById(id);
    if (!el) return;

    if (el.type === "password") {
      el.type = "text";
      btn.textContent = "HIDE";
    } else {
      el.type = "password";
      btn.textContent = "SHOW";
    }
  });
});

// Password strength + match
function updateStrength() {
  if (!strengthEl || !p1) return;

  const val = p1.value || "";
  if (!val) {
    strengthEl.textContent = "";
    strengthEl.className = "hint";
    return;
  }

  if (val.length >= 10) {
    strengthEl.textContent = "Password: Strong";
    strengthEl.className = "hint hint-ok";
  } else if (val.length >= 8) {
    strengthEl.textContent = "Password: Medium";
    strengthEl.className = "hint hint-mid";
  } else if (val.length >= 4) {
    strengthEl.textContent = "Password: Weak";
    strengthEl.className = "hint hint-bad";
  } else {
    strengthEl.textContent = "";
    strengthEl.className = "hint";
  }
}

function updateMatch() {
  if (!matchEl || !p1 || !p2) return;

  if (!p2.value) {
    matchEl.textContent = "";
    matchEl.className = "hint";
    return;
  }

  if (p1.value === p2.value) {
    matchEl.textContent = "Password matched";
    matchEl.className = "hint hint-ok";
  } else {
    matchEl.textContent = "Password does not match";
    matchEl.className = "hint hint-bad";
  }
}

if (p1) p1.addEventListener("input", () => { updateStrength(); updateMatch(); });
if (p2) p2.addEventListener("input", updateMatch);

// ---------- FIRESTORE HELPERS ----------

function normalizeUsername(x) {
  return String(x || "").trim().toLowerCase();
}

async function userExists(username) {
  const u = normalizeUsername(username);
  if (!u) return false;
  const snap = await getDoc(doc(db, "users", u));
  return snap.exists();
}

async function getUser(username) {
  const u = normalizeUsername(username);
  if (!u) return null;
  const snap = await getDoc(doc(db, "users", u));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Find next free placement node under sponsor for a side (L/R).
 * We assume each user doc can store:
 *  - leftChild: username or ""
 *  - rightChild: username or ""
 *
 * If sponsor has empty side => sponsor is placementParent.
 * Else BFS down that side until find a node whose that side is empty.
 */
async function findAutoPlacementParent(sponsorUsername, side) {
  const sponsor = await getUser(sponsorUsername);
  if (!sponsor) return null;

  const sideKey = (side === "R") ? "rightChild" : "leftChild";

  // direct empty under sponsor
  if (!sponsor[sideKey]) {
    return sponsor.username || sponsorUsername;
  }

  // BFS queue starting from sponsor's chosen side child
  const startChild = sponsor[sideKey];
  const queue = [normalizeUsername(startChild)];

  const visited = new Set();
  visited.add(normalizeUsername(sponsorUsername));

  while (queue.length > 0) {
    const cur = queue.shift();
    if (!cur || visited.has(cur)) continue;
    visited.add(cur);

    const curUser = await getUser(cur);
    if (!curUser) continue;

    if (!curUser[sideKey]) {
      return curUser.username || cur;
    }

    // continue going down same side first, but also traverse both to keep tree filling
    const l = normalizeUsername(curUser.leftChild);
    const r = normalizeUsername(curUser.rightChild);

    // order: same-side first then other-side
    if (side === "L") {
      if (l) queue.push(l);
      if (r) queue.push(r);
    } else {
      if (r) queue.push(r);
      if (l) queue.push(l);
    }
  }

  // If extremely full (unlikely), fallback sponsor
  return sponsor.username || sponsorUsername;
}

/**
 * Attach new user under placementParent on side if empty.
 */
async function attachChild(placementParentUsername, side, childUsername) {
  const parentU = normalizeUsername(placementParentUsername);
  const childU = normalizeUsername(childUsername);

  const parentRef = doc(db, "users", parentU);
  const parentSnap = await getDoc(parentRef);
  if (!parentSnap.exists()) throw new Error("Placement parent not found.");

  const parentData = parentSnap.data();
  const sideKey = (side === "R") ? "rightChild" : "leftChild";

  if (parentData[sideKey]) {
    throw new Error("Selected placement side is already occupied. Please retry.");
  }

  await updateDoc(parentRef, {
    [sideKey]: childU
  });
}

// ---------- LIVE PREVIEW (show suggested placement) ----------
async function refreshPlacementPreview() {
  if (!placeHint) return;

  const sponsor = normalizeUsername(sponsorInput ? sponsorInput.value : "");
  const side = binSideSel ? binSideSel.value : "L";
  const manualPlacement = normalizeUsername(placementInput ? placementInput.value : "");

  placeHint.className = "hint";
  placeHint.textContent = "";

  sponsorHint && (sponsorHint.textContent = "");

  if (!sponsor) return;

  // sponsor validation quick
  const sponsorOk = await userExists(sponsor);
  if (!sponsorOk) {
    if (sponsorHint) {
      sponsorHint.textContent = "Sponsor not found.";
      sponsorHint.className = "hint hint-bad";
    }
    if (placeHint) {
      placeHint.textContent = "Auto placement cannot work without a valid sponsor.";
      placeHint.className = "hint hint-bad";
    }
    return;
  } else {
    if (sponsorHint) {
      sponsorHint.textContent = "Sponsor OK";
      sponsorHint.className = "hint hint-ok";
    }
  }

  // if manual placement provided, validate exists
  if (manualPlacement) {
    const ok = await userExists(manualPlacement);
    if (!ok) {
      placeHint.textContent = "Placement user not found (will fail).";
      placeHint.className = "hint hint-bad";
      return;
    }
    placeHint.textContent = "Manual placement OK. Join side: " + side;
    placeHint.className = "hint hint-ok";
    return;
  }

  // auto placement
  const parent = await findAutoPlacementParent(sponsor, side);
  if (!parent) {
    placeHint.textContent = "Auto placement failed.";
    placeHint.className = "hint hint-bad";
    return;
  }

  placeHint.textContent = "Auto placement: under " + parent + " (" + (side === "L" ? "Left" : "Right") + ")";
  placeHint.className = "hint hint-mid";
}

if (sponsorInput) sponsorInput.addEventListener("input", () => { refreshPlacementPreview(); });
if (binSideSel) binSideSel.addEventListener("change", () => { refreshPlacementPreview(); });
if (placementInput) placementInput.addEventListener("input", () => { refreshPlacementPreview(); });

// ---------- SUCCESS OVERLAY ----------
function showRegSuccess(username) {
  const overlay = document.getElementById("regSuccessOverlay");
  const textEl = document.getElementById("regSuccessText");
  const subEl = document.getElementById("regSuccessSub");

  if (textEl) textEl.textContent = "Welcome, " + username + "!";
  if (subEl) subEl.textContent = "Registration successful. Redirecting to login...";

  if (overlay) overlay.style.display = "flex";

  setTimeout(() => {
    window.location.href = "login.html?u=" + encodeURIComponent(username) + "&reg=1";
  }, 2000);
}

// ---------- MAIN SUBMIT ----------
form && form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const fullName = document.getElementById("fullName").value.trim();
  const username = normalizeUsername(document.getElementById("username").value);
  const email = String(document.getElementById("email").value || "").trim().toLowerCase();

  const country = countrySel ? countrySel.value : "";
  const mobile = mobileInput ? mobileInput.value.trim() : "";

  const pass1 = p1 ? p1.value : "";
  const pass2 = p2 ? p2.value : "";

  const sponsor = normalizeUsername(sponsorInput ? sponsorInput.value : "");
  const side = binSideSel ? binSideSel.value : "L";

  const manualPlacement = normalizeUsername(placementInput ? placementInput.value : "");
  const terms = document.getElementById("terms").checked;

  // basic checks
  if (!fullName || !username || !email || !country || !mobile) {
    alert("Please fill in all required fields.");
    return;
  }
  if (!terms) {
    alert("Please accept the Terms & Conditions.");
    return;
  }
  if (pass1.length < 4) {
    alert("Password must be at least 4 characters (demo).");
    return;
  }
  if (pass1 !== pass2) {
    alert("Password does not match.");
    return;
  }
  if (!sponsor) {
    alert("Sponsor/Referral is required.");
    return;
  }
  if (side !== "L" && side !== "R") {
    alert("Invalid placement side.");
    return;
  }

  try {
    const usersRef = collection(db, "users");

    // username unique
    const q1 = query(usersRef, where("username", "==", username));
    const s1 = await getDocs(q1);
    if (!s1.empty) {
      alert("This username is already taken. Please choose another one.");
      return;
    }

    // email unique
    const q2 = query(usersRef, where("email", "==", email));
    const s2 = await getDocs(q2);
    if (!s2.empty) {
      alert("This email is already registered. Please use another one.");
      return;
    }

    // sponsor must exist
    const sponsorOk = await userExists(sponsor);
    if (!sponsorOk) {
      alert("Sponsor not found. Please check sponsor username.");
      return;
    }

    // placement parent resolution
    let placementParent = "";
    if (manualPlacement) {
      const ok = await userExists(manualPlacement);
      if (!ok) {
        alert("Placement user not found.");
        return;
      }
      placementParent = manualPlacement;
    } else {
      const autoParent = await findAutoPlacementParent(sponsor, side);
      if (!autoParent) {
        alert("Auto placement failed. Try again.");
        return;
      }
      placementParent = autoParent;
    }

    const now = new Date().toISOString();

    // Create user profile first
    const userDocRef = doc(db, "users", username);

    const profile = {
      username,
      fullName,
      email,
      country,
      mobile,

      // binary
      sponsor_username: sponsor,
      placement_parent: placementParent,
      placement_side: side, // L/R

      // children pointers (for tree)
      leftChild: "",
      rightChild: "",

      // demo auth
      password: pass1,

      role: "member",
      status: "active",
      membershipType: "free",

      balance: 0,
      depositTotal: 0,
      withdrawTotal: 0,

      directIncome: 0,
      teamIncome: 0,
      teamCount: 0,
      rankIncome: 0,
      globalIncome: 0,

      giftVoucher: 0,
      dailyROI: 0,

      createdAt: now
    };

    await setDoc(userDocRef, profile);

    // Attach under placement parent (L or R)
    await attachChild(placementParent, side, username);

    // success
    showRegSuccess(username);

  } catch (err) {
    console.error(err);
    alert("Registration error: " + (err && err.message ? err.message : err));
  }
});