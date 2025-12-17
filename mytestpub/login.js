// public/login.js – Firestore login (username or email)

import { db } from "./firebase-config.js";
import {
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const STORAGE_CURRENT = "btx_current_user_v1";
const STORAGE_IMP     = "btx_impersonate_user";

const form      = document.getElementById("loginForm");
const inputUser = document.getElementById("emailOrUser");
const inputPass = document.getElementById("password");
const banner    = document.getElementById("loginSuccess");

// SHOW / HIDE password
document.querySelectorAll(".lg-eye").forEach((btn)=>{
  btn.addEventListener("click", ()=>{
    const id = btn.dataset.target;
    const el = document.getElementById(id);
    if(!el) return;

    if(el.type === "password"){
      el.type = "text";
      btn.textContent = "HIDE";
    }else{
      el.type = "password";
      btn.textContent = "SHOW";
    }
  });
});

// URL params: ?u=USERNAME &reg=1  -> auto fill + success banner
(function fromURL(){
  const params = new URLSearchParams(window.location.search);
  const u   = params.get("u");
  const reg = params.get("reg");

  if(u && inputUser){
    inputUser.value = u;
  }
  if(reg === "1" && banner){
    banner.style.display = "block";
    setTimeout(()=>{ banner.style.display = "none"; }, 2500);
  }
})();

// MAIN SUBMIT
form?.addEventListener("submit", async (e)=>{
  e.preventDefault();

  const emailOrUser = (inputUser.value || "").trim().toLowerCase();
  const password    = (inputPass.value || "").trim();

  if(!emailOrUser || !password){
    alert("Please enter your username/email and password.");
    return;
  }

  try{
    const usersRef = collection(db, "users");
    let q;

    // if contains '@' -> email, otherwise username
    if(emailOrUser.includes("@")){
      q = query(
        usersRef,
        where("email","==", emailOrUser),
        where("password","==", password)
      );
    }else{
      q = query(
        usersRef,
        where("username","==", emailOrUser),
        where("password","==", password)
      );
    }

    const snap = await getDocs(q);

    if(snap.empty){
      alert("Invalid username/email or password.");
      return;
    }

    const docSnap = snap.docs[0];
    const data    = docSnap.data();

    const user = {
      id:       docSnap.id,
      username: data.username || docSnap.id,
      ...data
    };

    // clear impersonate, save current user
    localStorage.removeItem(STORAGE_IMP);
    localStorage.setItem(STORAGE_CURRENT, JSON.stringify(user));

    if(banner){
      banner.textContent = "Login successful! Redirecting…";
      banner.style.display = "block";
    }

    setTimeout(()=>{
      if(user.role === "admin"){
        window.location.href = "admin.html";
      }else{
        window.location.href = "dashboard.html";
      }
    }, 800);

  }catch(err){
    console.error(err);
    alert("Login error: " + err.message);
  }
});