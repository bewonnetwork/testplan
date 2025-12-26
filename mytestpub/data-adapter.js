/ data-adapter.js
import { APP_MODE } from "./config.js";

// ✅ তোমার firebase-config.js থেকে db export থাকলে ভালো:
// export { db } from "./firebase-config.js";
import { db } from "./firebase-config.js";
import {
  doc, getDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

/* ---------------- LOCAL DEMO DATA ---------------- */
const LOCAL_USERS = {
  "@love":  {
    username:"@love", fullName:"Md Salim Biswas", sponsor:"master",
    leftUser:"@a1", rightUser:"@b1",
    leftVolume: 1200, rightVolume: 400, carryLeft:0, carryRight:0,
    cappingUsed:0, dailyCap:100
  },
  "@a1": { username:"@a1", fullName:"A One", leftUser:"@a2", rightUser:"@a3", leftVolume:300, rightVolume:150 },
  "@b1": { username:"@b1", fullName:"B One", leftUser:"@b2", rightUser:"@b3", leftVolume: 90, rightVolume:500 },
  "@a2": { username:"@a2", fullName:"A Two" },
  "@a3": { username:"@a3", fullName:"A Three" },
  "@b2": { username:"@b2", fullName:"B Two" },
  "@b3": { username:"@b3", fullName:"B Three" },
};

/** ✅ local: username দিয়ে user */
async function getLocalUser(username){
  return LOCAL_USERS[username] ? structuredClone(LOCAL_USERS[username]) : null;
}

/** ✅ live: Firestore থেকে */
async function getLiveUser(username){
  const ref = doc(db, "users", username);
  const snap = await getDoc(ref);
  if(!snap.exists()) return null;
  const data = snap.data();
  return { ...data, username };
}

/** ✅ public api */
export async function getUser(username){
  if(APP_MODE.USE_LOCAL) return getLocalUser(username);
  return getLiveUser(username);
}

/** ✅ children username */
export async function getChildren(username){
  const u = await getUser(username);
  if(!u) return { left:null, right:null };
  return { left: u.leftUser ?? null, right: u.rightUser ?? null };
}