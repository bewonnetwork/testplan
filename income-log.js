import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

export async function logIncome(username, amount, type, remark){
  try{
    await addDoc(collection(db,"income_history"),{
      username: username.toLowerCase(),
      amount: Number(amount || 0),
      type: type || "other",
      remark: remark || "",
      createdAt: serverTimestamp()
    });
  }catch(err){
    console.error("Income log error:", err);
  }
}
