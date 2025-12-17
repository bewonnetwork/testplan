// reset.js
import { app } from "./firebase-config.js";
import {
  getAuth,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

const auth = getAuth(app);

const form  = document.getElementById("resetForm");
const emailInput = document.getElementById("resetEmail");

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const email = emailInput.value.trim().toLowerCase();

  if(!email){
    alert("Please enter your email.");
    return;
  }

  sendPasswordResetEmail(auth, email)
    .then(() => {
      alert("✅ Reset link আপনার ইমেইলে পাঠানো হয়েছে। Inbox/Spam চেক করুন।");
    })
    .catch((err) => {
      console.error(err);
      alert("❌ Error: " + err.message);
    });
});
