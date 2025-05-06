// public/driver_upload.js – FINAL CLEAN VERSION (No role logic)

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
  uploadBytes
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js";

// DOM Elements
const loginButton = document.getElementById("loginButton");
const fileInput = document.getElementById("fileInput");
const cameraInput = document.getElementById("cameraInput");
const uploadButton = document.getElementById("uploadButton");
const statusMessage = document.getElementById("statusMessage");

let selectedImageFile = null;

// ✅ Auth Check – no role claims needed for drivers
onAuthStateChanged(auth, user => {
  if (!user) {
    console.log("User not logged in.");
    // Optional: Trigger login or show login prompt
  } else {
    console.log("✅ Driver logged in:", user.email);
  }
});

// 🔘 Google Sign-In
loginButton?.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (err) {
    console.error("Login error:", err);
    statusMessage && (statusMessage.textContent = `Login failed: ${err.message}`);
  }
});

// 📷 File Selection
function handleFileSelection(event) {
  const file = event.target?.files?.[0];
  if (file) {
    selectedImageFile = file;
    statusMessage && (statusMessage.textContent = "");
    console.log("📸 File selected:", file.name);
  } else {
    selectedImageFile = null;
  }
}

fileInput?.addEventListener("change", handleFileSelection);
cameraInput?.addEventListener("change", handleFileSelection);

// 🚚 Upload Handler
uploadButton?.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) {
    statusMessage && (statusMessage.textContent = "Please sign in first.");
    return;
  }

  if (!selectedImageFile) {
    statusMessage && (statusMessage.textContent = "Please select a file.");
    return;
  }

  uploadButton.disabled = true;
  statusMessage && (statusMessage.textContent = "Uploading ticket...");

  try {
    const uid = user.uid;
    const email = user.email || "unknown";
    const timestamp = Date.now();
    const path = `uploads/${uid}/${timestamp}_${selectedImageFile.name}`;
    const storageRef = ref(storage, path);

    await uploadBytes(storageRef, selectedImageFile);
    console.log("✅ Upload complete.");

    await addDoc(collection(db, "tickets"), {
      storagePath: path,
      uploaderUid: uid,
      uploaderEmail: email,
      timestamp: serverTimestamp(),
      status: "pending",
      fixNeeded: false
    });

    statusMessage && (statusMessage.textContent = "✅ Ticket uploaded successfully!");
    selectedImageFile = null;
    fileInput && (fileInput.value = "");
    cameraInput && (cameraInput.value = "");
  } catch (err) {
    console.error("❌ Upload failed:", err);
    statusMessage && (statusMessage.textContent = `❌ ${err.message}`);
  } finally {
    uploadButton.disabled = false;
  }
});
