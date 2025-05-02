import { auth, db } from "./firebase.js";
import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// DOM Elements
const form = document.getElementById("manualForm");
const ticketNumber = document.getElementById("ticketNumber");
const truckNumber = document.getElementById("truckNumber");
const weightTons = document.getElementById("weightTons");
const driverActual = document.getElementById("driverActual");
const statusBox = document.getElementById("status");
const errorBox = document.getElementById("error");

let currentUser = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      console.error("Login error:", err);
    }
  } else {
    currentUser = user;
  }
});

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  statusBox.classList.add("hidden");
  errorBox.classList.add("hidden");

  try {
    await addDoc(collection(db, "tickets"), {
      ticketNumber: ticketNumber.value,
      truckNumber: truckNumber.value,
      weightTons: parseFloat(weightTons.value) || null,
      driverActual: driverActual.value,
      uploaderUid: auth.currentUser?.uid || null,
      uploaderEmail: auth.currentUser?.email || null,
      manual: true,
      status: "pending",
      fixNeeded: false,
      timestamp: serverTimestamp()
    });

    form.reset();
    statusBox.classList.remove("hidden");

  } catch (err) {
    console.error("Submit error:", err);
    errorBox.classList.remove("hidden");
  }
});
