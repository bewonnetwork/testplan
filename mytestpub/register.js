// public/register.js  – Neon UI + Firebase registration

import { db } from "./firebase-config.js";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const form        = document.getElementById("registerForm");
const countrySel  = document.getElementById("country");
const mobileInput = document.getElementById("mobile");
const p1          = document.getElementById("password");
const p2          = document.getElementById("password2");
const strengthEl  = document.getElementById("passStrength");
const matchEl     = document.getElementById("passMatch");

// ---------- UI HELPERS ----------

// Auto add dial code on country change
countrySel?.addEventListener("change", () => {
  const opt  = countrySel.options[countrySel.selectedIndex];
  const code = opt?.getAttribute("data-code") || "";
  if (code && (!mobileInput.value || !mobileInput.value.startsWith(code))) {
    mobileInput.value = code + " ";
  }
});

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
  if (!strengthEl) return;
  const val = p1.value;
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
  if (!matchEl) return;
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
p1?.addEventListener("input", () => { updateStrength(); updateMatch(); });
p2?.addEventListener("input", updateMatch);

// Read ?ref= from URL
(function presetRef() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref");
  if (!ref) return;
  const input = document.getElementById("refCode");
  if (input && !input.value) {
    input.value = ref;
  }
})();

// Success overlay
function showRegSuccess(username) {
  const overlay = document.getElementById("regSuccessOverlay");
  const textEl  = document.getElementById("regSuccessText");
  const subEl   = document.getElementById("regSuccessSub");

  if (textEl) textEl.textContent = "Welcome, " + username + "!";
  if (subEl)  subEl.textContent  = "Registration successful. Redirecting to login...";

  if (overlay) overlay.style.display = "flex";

  setTimeout(() => {
    window.location.href =
      "login.html?u=" + encodeURIComponent(username) + "&reg=1";
  }, 2000);
}

// ---------- MAIN SUBMIT (Firebase) ----------
form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const fullName = document.getElementById("fullName").value.trim();
  const username = document.getElementById("username").value.trim().toLowerCase();
  const email    = document.getElementById("email").value.trim().toLowerCase();
  const country  = countrySel.value;
  const mobile   = mobileInput.value.trim();
  const pass1    = p1.value;
  const pass2    = p2.value;
  const refRaw   = document.getElementById("refCode").value.trim();
  const refCode  = refRaw.toLowerCase();
  const terms    = document.getElementById("terms").checked;

  // Basic checks (English only)
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

    // OPTIONAL sponsor: if not found, we just ignore (no error)
    let sponsor_username = "";
    if (refCode) {
      const sponsorSnap = await getDocs(
        query(usersRef, where("username", "==", refCode))
      );
      if (!sponsorSnap.empty) {
        sponsor_username = refCode;
      }
    }

    const now = new Date().toISOString();
    const userDocRef = doc(db, "users", username);

    const profile = {
      username,
      fullName,
      email,
      country,
      mobile,
      refCode: refRaw,
      sponsor_username,
      password: pass1,          // demo only
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

    // ✅ One clean success flow
    showRegSuccess(username);

  } catch (err) {
    console.error(err);
    alert("Registration error: " + err.message);
  }
});