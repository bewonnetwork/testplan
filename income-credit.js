import { db } from "./firebase-config.js";
import {
  doc, getDoc, updateDoc,
  collection, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

export async function creditIncome(username, amount, type, remark){
  username = (username || "").toLowerCase();
  const inc = Number(amount || 0);
  if(!username || inc <= 0) return;

  const uRef = doc(db,"users",username);
  const snap = await getDoc(uRef);
  if(!snap.exists()) throw new Error("User not found: " + username);

  const u = snap.data();

  // ✅ Free user income block (তুমি যেটা চাও)
  if((u.membershipType || "free") !== "premium"){
    console.log("Blocked income for FREE user:", username, type);
    return;
  }

  // ✅ 3× cup (ROI বাদে)
  const capMax = Number(u.depositTotal || 0) * 3;
  const capUsed = Number(u.capUsedAll || 0);

  // ROI টাইপ cup-এ যাবে না
  const isCapType = (String(type||"").toLowerCase() !== "roi");
  let payable = inc;

  if(isCapType){
    const remain = Math.max(0, capMax - capUsed);
    if(remain <= 0){
      console.log("Cap finished. No more income for:", username);
      return;
    }
    if(payable > remain) payable = remain; // cap এর বেশি যাবে না
  }

  // totals
  const earning = Number(u.earningBalance || 0) + payable;
  const total   = Number(u.totalEarning || 0) + payable;

  const updates = {
    earningBalance: earning,
    totalEarning: total
  };

  // type-wise add
  const t = String(type||"other").toLowerCase();
  if(t === "sponsor" || t === "direct"){
    updates.directIncome = Number(u.directIncome || 0) + payable;
  }else if(t === "generation" || t === "gen"){
    updates.teamIncome = Number(u.teamIncome || 0) + payable;
  }else if(t === "rank"){
    updates.rankIncome = Number(u.rankIncome || 0) + payable;
  }else if(t === "global"){
    updates.globalIncome = Number(u.globalIncome || 0) + payable;
  }else if(t === "roi"){
    updates.roiEarned = Number(u.roiEarned || 0) + payable;
  }

  // ✅ cup used update (ROI বাদে)
  if(isCapType){
    updates.capUsedAll = capUsed + payable;
  }

  await updateDoc(uRef, updates);

  // ✅ history log
  await addDoc(collection(db,"income_history"),{
    username,
    amount: payable,
    type: t,
    remark: remark || "",
    createdAt: serverTimestamp()
  });

  return payable;
}
