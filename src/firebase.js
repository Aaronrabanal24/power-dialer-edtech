// src/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// import { getAnalytics } from "firebase/analytics"; // optional if you want analytics

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyC7j8NDqql1k88x3YSIm4X-L74CsNAU16c",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "power-dialer-ece33.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "power-dialer-ece33",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:328642191235:web:d6b558e16630b5924060b6",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "power-dialer-ece33.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "328642191235",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-V1P1DCEPKP",
};

(function verifyFirebaseEnv(cfg) {
  // Only enforce the essentials for Auth + Firestore:
  const required = ["apiKey", "authDomain", "projectId", "appId"];
  const missing = required.filter(k => !cfg[k]);
  if (missing.length) {
    throw new Error("Missing Firebase ENV(s): " + missing.join(", "));
  }
}) (firebaseConfig);

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
// export const analytics = getAnalytics(app); // only if you really want this