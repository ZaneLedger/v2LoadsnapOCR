// public/driver_upload.js (More Robust for Temporary Rules)

// Ensure firebase.js is correctly configured and working!
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
  // getDownloadURL // Only needed if you use the URL client-side
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js";

// --- DOM References ---
const loginBox = document.getElementById("loginBox");
const loginButton = document.getElementById("loginButton");
const uploadBox = document.getElementById("uploadBox");
const fileInput = document.getElementById("fileInput");
const cameraInput = document.getElementById("cameraInput"); // only if used
const uploadButton = document.getElementById("uploadButton");
const selectedFileDisplay = document.getElementById("selectedFile"); // Renamed for clarity
const statusMessage = document.getElementById("statusMessage");

let selectedImageFile = null; // Store the selected File object

// --- Auth Handler ---
onAuthStateChanged(auth, async user => {
  // Use optional chaining for safety in case elements aren't found immediately
  if (!user) {
    loginBox?.classList.remove("hidden");
    uploadBox?.classList.add("hidden");
  } else {
    loginBox?.classList.add("hidden");
    uploadBox?.classList.remove("hidden");
  }
});

// --- Login Button ---
if (loginButton) {
  loginButton.addEventListener("click", async () => {
    if (statusMessage) statusMessage.textContent = ""; // Clear status
    try {
      console.log("Attempting Google Sign-In...");
      await signInWithPopup(auth, new GoogleAuthProvider());
      // onAuthStateChanged will handle UI changes
      console.log("Sign-In successful (or popup closed).");
    } catch (err) {
      console.error("Login failed:", err);
      if (statusMessage) statusMessage.textContent = `Login failed: ${err.code || err.message}`;
    }
  });
} else {
    console.warn("Login button not found.");
}

// --- File/Camera Handlers ---
function handleFileSelection(event) {
    // Check if files exist and have length
    const file = event.target?.files?.[0]; // Use optional chaining
    if (file) {
        selectedImageFile = file;
        if (selectedFileDisplay) selectedFileDisplay.textContent = selectedImageFile.name;
        if (statusMessage) statusMessage.textContent = ""; // Clear status on new selection
        console.log("File selected:", selectedImageFile.name);
    } else {
        selectedImageFile = null;
        if (selectedFileDisplay) selectedFileDisplay.textContent = "";
        console.log("File selection cleared or no file chosen.");
    }
}

if (fileInput) {
  fileInput.addEventListener("change", handleFileSelection);
} else {
    console.warn("File input element not found.");
}
if (cameraInput) {
  cameraInput.addEventListener("change", handleFileSelection);
} // No warning if camera input is optional

// --- Upload Logic ---
if (uploadButton) {
  uploadButton.addEventListener("click", async () => {
    // --- Explicitly check currentUser before accessing properties ---
    const currentUser = auth.currentUser;
    if (!currentUser) {
      if (statusMessage) statusMessage.textContent = "Please sign in to upload a ticket.";
      console.warn("Upload attempt failed: User not signed in.");
      // Optionally trigger login again here if desired
      return;
    }

    if (!selectedImageFile) {
      if (statusMessage) statusMessage.textContent = "Please select an image file first.";
      console.warn("Upload attempt failed: No file selected.");
      return;
    }

    // Disable button, show status
    uploadButton.disabled = true;
    if (statusMessage) statusMessage.textContent = "Uploading file...";
    console.log("Upload started...");

    try {
      // --- Safe access to currentUser properties ---
      const uid = currentUser.uid;
      const email = currentUser.email || "unknown"; // Provide default if email missing
      const timestamp = Date.now();
      // Use a structured path, e.g., uploads/userId/timestamp_filename
      // Ensure this path aligns with any backend function triggers if needed later
      const path = `uploads/${uid}/${timestamp}_${selectedImageFile.name}`;
      const storageRef = ref(storage, path);

      console.log(`Uploading to Storage path: ${path}`);
      await uploadBytes(storageRef, selectedImageFile);
      console.log("File uploaded to Storage successfully.");

      // --- Direct Firestore Write (TEMPORARY - RELIES ON RELAXED RULES) ---
      // WARNING: This direct client-side write MUST be removed and handled
      // by a backend function (like processTicketOCR) once security rules are reverted.
      console.log("Attempting direct Firestore write (Temporary Rule Dependent)...");
      const docRef = await addDoc(collection(db, "tickets"), {
        storagePath: path,
        uploaderUid: uid,
        uploaderEmail: email,
        timestamp: serverTimestamp(), // Use server timestamp
        status: "pending", // Initial status for backend processing
        fixNeeded: false // Default value
        // Add any other initial fields the backend might need
      });
      console.log("Firestore document created successfully with ID:", docRef.id);
      // --- End Temporary Write Section ---

      if (statusMessage) statusMessage.textContent = "✅ Ticket uploaded successfully! Processing...";

      // Reset form state
      selectedImageFile = null;
      if (fileInput) fileInput.value = ""; // Clear file input
      if (cameraInput) cameraInput.value = "";
      if (selectedFileDisplay) selectedFileDisplay.textContent = "";

    } catch (err) {
      console.error("❌ Upload failed:", err);
      // Provide more specific error feedback if possible
      let errorMsg = "❌ Upload failed. Please try again.";
      if (err.code && err.code.startsWith('storage/')) {
          errorMsg = `❌ Storage Error: ${err.message}`;
      } else if (err.code && err.code.startsWith('permission-denied')) {
          // This shouldn't happen with relaxed rules, but good to check
          errorMsg = "❌ Permission Error: Check Firestore rules.";
      } else if (err.message) {
          errorMsg = `❌ Error: ${err.message}`;
      }
      if (statusMessage) statusMessage.textContent = errorMsg;
    } finally {
      // Re-enable button
      uploadButton.disabled = false;
      console.log("Upload process finished.");
    }
  });
} else {
    console.warn("Upload button not found.");
}

