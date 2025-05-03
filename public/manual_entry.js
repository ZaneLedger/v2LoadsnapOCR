import { auth, db, storage } from "./firebase.js";
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
import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js";

// DOM Elements
const form = document.getElementById("manualForm");
const statusBox = document.getElementById("status");
const errorBox = document.getElementById("error");
const newEntryBtn = document.getElementById("newEntryBtn");

// Form fields
const F = (id) => document.getElementById(id);
const fields = [
  "ticketNumber", "weightTons", "truckNumber", "capacity",
  "driverBadge", "driverActual", "debrisType", "loadCall",
  "programJob", "DisposalDateTime", "contractor",
  "disposalSiteFinal", "notes", "dms"
];
const imageInput = document.getElementById("imageInput");

let currentUser = null;

// 🔐 Auth
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

// 🧾 Submit Handler
form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  statusBox.classList.add("hidden");
  errorBox.classList.add("hidden");

  if (!imageInput?.files[0]) {
    errorBox.textContent = "Please attach a ticket image before submitting.";
    errorBox.classList.remove("hidden");
    return;
  }

  try {
    const uid = auth.currentUser?.uid || "anonymous";
    const timestamp = Date.now();
    const file = imageInput.files[0];
    const path = `manual_uploads/${uid}/${timestamp}_${file.name}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);

    // Build Firestore ticket object
    const ticketData = {
      uploaderUid: uid,
      uploaderEmail: auth.currentUser?.email || "unknown",
      manual: true,
      status: "pending",
      fixNeeded: false,
      timestamp: serverTimestamp(),
      storagePath: path,
      imageUrl: downloadURL
    };

    // Append form values
    fields.forEach((field) => {
      const input = F(field);
      ticketData[field] = input?.value || null;
    });

    if (!ticketData.ticketNumber || !ticketData.weightTons || !ticketData.truckNumber || !ticketData.disposalSiteFinal) {
      throw new Error("Missing required fields.");
    }

    await addDoc(collection(db, "tickets"), ticketData);
    statusBox.classList.remove("hidden");

  } catch (err) {
    console.error("❌ Submit error:", err);
    errorBox.textContent = err.message || "Failed to submit ticket.";
    errorBox.classList.remove("hidden");
  }
});

// 🔁 Reset Form
newEntryBtn?.addEventListener("click", () => {
  form.reset();
  statusBox.classList.add("hidden");
  errorBox.classList.add("hidden");
});
