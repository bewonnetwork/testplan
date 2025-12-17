// Firebase CDN Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA2568fhHJZoxWY4_JP-OWpXc6BLUAHsGs",
  authDomain: "btxone-8e7a6.firebaseapp.com",
  projectId: "btxone-8e7a6",
  storageBucket: "btxone-8e7a6.firebasestorage.app",
  messagingSenderId: "1055706248606",
  appId: "1:1055706248606:web:0d2ec98fb43236ad09528f",
  measurementId: "G-X1RJF3F471"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);