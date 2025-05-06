// public/driver_upload.js
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

// DOM refs
const loginBox       = document.getElementById("loginBox");
const loginButton    = document.getElementById("loginButton");
const uploadBox      = document.getElementById("uploadBox");
const fileInput      = document.getElementById("fileInput");
const cameraInput    = document.getElementById("cameraInput"); // only if used
const uploadButton   = document.getElementById("uploadButton");
const selectedFile   = document.getElementById("selectedFile");
const statusMessage  = document.getElementById("statusMessage");

let selectedImageFile = null;

// --- AUTH HANDLER ---
onAuthStateChanged(auth, async user => {
  if (!user) {
    loginBox.classList.remove("hidden");
    uploadBox.classList.add("hidden");
    return;
  }

  loginBox.classList.add("hidden");
  uploadBox.classList.remove("hidden");
});

// --- LOGIN BUTTON ---
loginButton?.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (err) {
    console.error("Login failed:", err);
    statusMessage.textContent = "Login failed. Please try again.";
  }
});

// --- FILE/CAMERA HANDLERS ---
fileInput?.addEventListener("change", (e) => {
  selectedImageFile = e.target.files[0];
  selectedFile.textContent = selectedImageFile?.name || "";
});

cameraInput?.addEventListener("change", (e) => {
  selectedImageFile = e.target.files[0];
  selectedFile.textContent = selectedImageFile?.name || "";
});

// --- UPLOAD LOGIC ---
uploadButton?.addEventListener("click", async () => {
  if (!auth.currentUser) {
    statusMessage.textContent = "Please sign in to upload a ticket.";
    return;
  }

  if (!selectedImageFile) {
    statusMessage.textContent = "Please select an image first.";
    return;
  }

  uploadButton.disabled = true;
  statusMessage.textContent = "Uploading...";

  try {
    const uid = auth.currentUser.uid;
    const timestamp = Date.now();
    const path = `tickets/${uid}/${timestamp}_${selectedImageFile.name}`;
    const storageRef = ref(storage, path);

    await uploadBytes(storageRef, selectedImageFile);

    // Create Firestore doc
    await addDoc(collection(db, "tickets"), {
      storagePath: path,
      uploaderUid: uid,
      uploaderEmail: auth.currentUser.email || "unknown",
      timestamp: serverTimestamp(),
      status: "pending",
      fixNeeded: false
    });

    statusMessage.textContent = "✅ Ticket uploaded!";
    selectedImageFile = null;
    fileInput.value = "";
    if (cameraInput) cameraInput.value = "";
    selectedFile.textContent = "";

  } catch (err) {
    console.error("Upload failed:", err);
    statusMessage.textContent = "❌ Upload failed. Try again.";
  } finally {
    uploadButton.disabled = false;
  }
});
