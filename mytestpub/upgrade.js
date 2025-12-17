// upgrade.js – user invest / upgrade logic

import { db } from "./firebase-config.js";
import {
  doc,
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const STORAGE_CURRENT = "btx_current_user_v1";

function fmt(v){
  return "$" + Number(v || 0).toFixed(2);
}

function getCurrentUser(){
  try{
    const raw = localStorage.getItem(STORAGE_CURRENT);
    return raw ? JSON.parse(raw) : null;
  }catch(e){
    return null;
  }
}

function setCurrentUser(u){
  try{
    localStorage.setItem(STORAGE_CURRENT, JSON.stringify(u));
  }catch(e){}
}

// page load – snapshot দেখানো
async function loadUpgradePage(){
  const localUser = getCurrentUser();
  if(!localUser){
    window.location.href = "login.html";
    return;
  }

  const username = (localUser.username || "").toLowerCase();
  if(!username){
    window.location.href = "login.html";
    return;
  }

  // Firestore থেকে fresh data নিয়ে আসি
  const userRef  = doc(db,"users",username);
  const userSnap = await getDoc(userRef);
  const user     = userSnap.exists() ? userSnap.data() : localUser;

  document.getElementById("uUsername").textContent      = user.username || username;
  document.getElementById("uMembership").textContent    = user.membershipType || "free";
  document.getElementById("uBalance").textContent       = fmt(user.addBalance);
  document.getElementById("uDepositTotal").textContent  = fmt(user.depositTotal);

  // localStorage-ও fresh করে রাখি
  setCurrentUser({...localUser, ...user});
}

// main invest function
async function submitUpgrade(){
  const localUser = getCurrentUser();
  if(!localUser){
    alert("Please login again.");
    window.location.href = "login.html";
    return;
  }
  const username = (localUser.username || "").toLowerCase();
  if(!username){
    alert("Username missing.");
    return;
  }

  const amountInput = document.getElementById("invAmount");
  const rawAmount   = amountInput.value;
  const amount      = Number(rawAmount || 0);

  if(!rawAmount || isNaN(amount) || amount <= 0){
    alert("Please enter a valid invest amount.");
    return;
  }
  if(amount < 10){
    alert("Minimum investment example: 10 USDT (later you can change).");
    return;
  }

  // Firestore থেকে latest user
  const userRef  = doc(db,"users",username);
  const userSnap = await getDoc(userRef);
  if(!userSnap.exists()){
    alert("User profile not found in Firestore.");
    return;
  }
  const user = userSnap.data();

  const currentBalance = Number(user.addBalance || 0);
  if(currentBalance < amount){
    alert("Not enough Add Balance. Please deposit first.");
    return;
  }

  // Plan থেকে sponsor % এবং ROI %
  const planRef  = doc(db,"config","plan");
  const planSnap = await getDoc(planRef);
  const plan     = planSnap.exists() ? planSnap.data() : {};

  const sponsorPercent = plan.sponsorPercent ?? 5;       // default 5%
  const roiPercent     = plan.roiPercentPerDay ?? 1.2;   // default 1.2%

  const oldDeposit   = Number(user.depositTotal || 0);
  const newDeposit   = oldDeposit + amount;
  const newBalance   = currentBalance - amount;
  const newMember    = "premium";

  // daily ROI amount (optional – income-engine চাইলে use করবে)
  const newDailyROI  = newDeposit * (Number(roiPercent) / 100);

  // নিজের update
  await updateDoc(userRef,{
    addBalance:     newBalance,
    depositTotal:   newDeposit,
    membershipType: newMember,
    dailyROI:       newDailyROI
  });

  // Sponsor commission (only ১ জন sponsor, এখানে–ই যাবে)
  const sponsorUsername = (user.sponsor_username || "").toLowerCase();
  if(sponsorUsername && sponsorPercent > 0){
    try{
      const sRef  = doc(db,"users",sponsorUsername);
      const sSnap = await getDoc(sRef);
      if(sSnap.exists()){
        const s  = sSnap.data();
        const com = amount * (Number(sponsorPercent) / 100);

        const newDirect = Number(s.directIncome    || 0) + com;
        const newEarn   = Number(s.earningBalance || 0) + com;

        await updateDoc(sRef,{
          directIncome:   newDirect,
          earningBalance: newEarn
        });
      }
    }catch(err){
      console.error("Sponsor update error", err);
      // sponsor না পেলেও main invest সফল থাকবে
    }
  }

  // localStorage আপডেট করি
  const updatedUser = {
    ...localUser,
    addBalance:     newBalance,
    depositTotal:   newDeposit,
    membershipType: newMember,
    dailyROI:       newDailyROI
  };
  setCurrentUser(updatedUser);

  // UI refresh
  document.getElementById("uMembership").textContent   = updatedUser.membershipType;
  document.getElementById("uBalance").textContent      = fmt(updatedUser.addBalance);
  document.getElementById("uDepositTotal").textContent = fmt(updatedUser.depositTotal);
  amountInput.value = "";

  // ✅ এখানে আগের syntax error ঠিক করা হয়েছে (backtick সহ template string)
 alert(`✅ Investment Successful!
\nNew Sales Deposit: ${fmt(amount)}
\nYour Total Self Investment: ${fmt(newDeposit)}`);
}

// expose
window.submitUpgrade = submitUpgrade;

// initial load
loadUpgradePage().catch(err=>{
  console.error(err);
  alert("Upgrade page load error: " + (err.message || err));
});