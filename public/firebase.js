import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { getStorage }     from "https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js";
import { getFunctions }   from "https://www.gstatic.com/firebasejs/9.22.1/firebase-functions.js";

const firebaseConfig = {
  apiKey: "AIzaSyAsZ_aJEBoa_J4fH9AGKwyedEzVqRD5kj0",
  authDomain: "loadsnap-prod.firebaseapp.com",
  projectId: "loadsnap-prod",
  storageBucket: "loadsnap-prod.appspot.com", // ✅ CORRECT FORMAT
  messagingSenderId: "266229951076",
  appId: "1:266229951076:web:685a2bdbd338c5c2da8d71",
  measurementId: "G-GYLL7PQ590"
};

// 🔌 Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth      = getAuth(app);
export const db        = getFirestore(app);
export const storage   = getStorage(app);
export const functions = getFunctions(app);
