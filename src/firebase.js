// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

// Replace with your config from Firebase console
const firebaseConfig = {
apiKey: "AIzaSyC7j8NDqql1k88x3YSIm4X-L74CsNAU16c",
authDomain: "power-dialer-ece33.firebaseapp.com",
projectId: "power-dialer-ece33",
appId: "1:328642191235:web:d6b558e16630b5924060b6",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Optional: offline cache for Firestore (works great for PWAs)
enableIndexedDbPersistence(db).catch(() => {
  // ignore if another tab already enabled persistence
});