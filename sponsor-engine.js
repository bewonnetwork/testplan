// sponsor-engine.js
import { db } from "./firebase-config.js";
import {
  doc,
  getDoc,
  updateDoc,
  increment
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

export async function paySponsorCommission(childUsername, amount){
  const child = String(childUsername || "").toLowerCase().trim();
  const invest = Number(amount || 0);

  if(!child || invest <= 0){
    return { ok:false, reason:"invalid_input" };
  }

  // 🔹 child user
  const childRef = doc(db, "users", child);
  const childSnap = await getDoc(childRef);
  if(!childSnap.exists()){
    return { ok:false, reason:"child_not_found" };
  }

  const childData = childSnap.data();

  // ⚠️ এখানে field নাম মিলাও (একটা রাখলেই হবে)
  const sponsorUsername =
    (childData.sponsor_username ||
     childData.sponsor ||
     childData.referral ||
     "").toString().toLowerCase().trim();

  if(!sponsorUsername){
    return { ok:false, reason:"no_sponsor" };
  }

  // 🔹 sponsor user
  const sponsorRef = doc(db, "users", sponsorUsername);
  const sponsorSnap = await getDoc(sponsorRef);
  if(!sponsorSnap.exists()){
    return { ok:false, reason:"sponsor_not_found" };
  }

  const sponsor = sponsorSnap.data();

  // 🔒 sponsor must be premium
  if(String(sponsor.membershipType || "free") !== "premium"){
    return { ok:false, reason:"sponsor_not_premium" };
  }

  const percent = 5;
  const commission = invest * percent / 100;

  await updateDoc(sponsorRef,{
    directIncome: increment(commission),
    earningBalance: increment(commission),
    totalEarning: increment(commission)
  });

  return {
    ok: true,
    sponsor: sponsorUsername,
    percent,
    commission
  };
}