// uploader.js - Logic for the LoadSnap OCR Ticket Upload Page (v9 Modular - CORRECTED)

// Import v9 modular functions and initialized services
// *** FIX: Import 'db' instead of 'firestore' ***
import { auth, db, storage } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

  // --- DOM Elements ---
  const uploadContainer = document.getElementById('uploadContainer');
  const authStatus = document.getElementById('authStatus');
  const fileInput = document.getElementById('fileInput');
  const dropZone = document.getElementById('dropZone');
  const dropZoneText = document.getElementById('dropZoneText');
  const selectFileButton = document.getElementById('selectFileButton');
  const fileError = document.getElementById('fileError');
  const fileInfo = document.getElementById('fileInfo');
  const fileName = document.getElementById('fileName');
  const fileSize = document.getElementById('fileSize');
  const imagePreview = document.getElementById('imagePreview');
  const removeFileButton = document.getElementById('removeFileButton');
  const uploadButton = document.getElementById('uploadButton');
  const progressBarContainer = document.getElementById('progressBarContainer');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  const manualEntryButton = document.getElementById('manualEntryButton');
  // Login/logout elements might be handled elsewhere
  // const loginSection = document.getElementById('loginSection');
  // const logoutButton = document.getElementById('logoutButton');

  let currentFile = null; // Variable to hold the selected file
  let currentUser = null; // Variable to hold the logged-in user info

  // --- Utility Functions ---

  function showBanner(message, color = 'blue') {
      document.querySelectorAll('.feedback-banner').forEach(b => b.remove());
      const banner = document.createElement('div');
      let colorClasses = '';
      switch (color) {
          case 'green': colorClasses = 'bg-green-100 border-green-400 text-green-700'; break;
          case 'red': colorClasses = 'bg-red-100 border-red-400 text-red-700'; break;
          default: colorClasses = 'bg-blue-100 border-blue-400 text-blue-700'; break;
      }
      banner.className = `border px-4 py-3 rounded relative mb-4 feedback-banner ${colorClasses}`; // Added class for removal
      banner.setAttribute('role', 'alert');
      banner.innerHTML = `<span class="block sm:inline">${message}</span>`;
      // Try to prepend within a main container, fallback to body
      const mainContainer = document.querySelector('main') || document.querySelector('.w-full.max-w-lg') || document.body;
      mainContainer.prepend(banner);
      setTimeout(() => banner.remove(), 5000);
  }

  function formatFileSize(bytes) {
     if (bytes === 0) return '0 Bytes';
     const k = 1024;
     const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
     const i = Math.floor(Math.log(bytes) / Math.log(k));
     return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function displayFileInfo(file) {
     if (!file || !fileName || !fileSize || !fileInfo || !uploadButton || !fileError || !imagePreview) return;
     fileName.textContent = file.name;
     fileSize.textContent = formatFileSize(file.size);
     fileInfo.classList.remove('hidden');
     uploadButton.disabled = !currentUser; // Enable upload only if logged in
     fileError.textContent = '';

     const reader = new FileReader();
     reader.onload = (e) => {
         imagePreview.src = e.target.result;
         imagePreview.classList.remove('hidden');
     }
     reader.readAsDataURL(file);
  }

  function resetFileInput() {
     if (fileInput) fileInput.value = '';
     currentFile = null;
     if (fileInfo) fileInfo.classList.add('hidden');
     if (imagePreview) {
         imagePreview.classList.add('hidden');
         imagePreview.src = '#';
     }
     if (uploadButton) uploadButton.disabled = true; // Disable upload button on reset
     if (progressBarContainer) progressBarContainer.classList.add('hidden');
     if (progressBar) progressBar.style.width = '0%';
     if (progressText) progressText.textContent = '';
     if (fileError) fileError.textContent = '';
     if (dropZone) {
         dropZone.classList.remove('border-green-500', 'bg-green-50', 'border-blue-500', 'bg-blue-50');
     }
     if (dropZoneText) dropZoneText.textContent = 'Drag & drop image file here';
  }

  function handleFileSelect(file) {
     const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']; // Added PDF
     const maxSize = 15 * 1024 * 1024; // Increased limit slightly to 15 MB

     // Basic check for file type (consider more robust checks if needed)
     if (!allowedTypes.some(type => file.type.startsWith(type))) {
         if(fileError) fileError.textContent = 'Invalid file type. Please select an image (JPG, PNG, GIF, WEBP) or PDF.';
         resetFileInput();
         return;
     }
     if (file.size > maxSize) {
         if(fileError) fileError.textContent = `File is too large (${formatFileSize(file.size)}). Maximum size is ${formatFileSize(maxSize)}.`;
         resetFileInput();
         return;
     }

     currentFile = file;
     displayFileInfo(currentFile);
  }


  // --- Event Handlers ---

  function onFileInputChange(event) {
     const file = event.target.files?.[0]; // Use optional chaining
     if (file) {
         handleFileSelect(file);
     }
  }

  function onDragOver(event) {
     event.preventDefault();
     if (dropZone) dropZone.classList.add('border-blue-500', 'bg-blue-50');
     if (dropZoneText) dropZoneText.textContent = 'Release to drop file';
  }

   function onDragLeave(event) {
     event.preventDefault();
     if (dropZone) dropZone.classList.remove('border-blue-500', 'bg-blue-50');
     if (dropZoneText) dropZoneText.textContent = 'Drag & drop image file here';
  }

  function onDrop(event) {
     event.preventDefault();
     if (dropZone) dropZone.classList.remove('border-blue-500', 'bg-blue-50');
     if (dropZoneText) dropZoneText.textContent = 'Drag & drop image file here';

     const file = event.dataTransfer?.files?.[0]; // Use optional chaining
     if (file) {
         handleFileSelect(file);
     } else {
         if(fileError) fileError.textContent = 'Could not process dropped file.';
     }
  }

  /**
   * Initiates the file upload process using v9 modular syntax.
   */
  function handleUpload() {
     if (!currentFile) {
         showBanner("No file selected to upload.", "red");
         return;
     }
     if (!currentUser) {
         showBanner("Please log in before uploading.", "red");
         return;
     }
     // *** FIX: Check for 'db' instead of 'firestore' ***
     if (!storage || !db) {
         showBanner("Connection error. Cannot upload.", "red");
         console.error("Firebase Storage or Firestore (db) not initialized.");
         return;
     }
      if (!uploadButton || !progressBarContainer || !progressText || !progressBar) {
           console.error("Required UI elements for upload are missing.");
           return;
     }

     uploadButton.disabled = true;
     uploadButton.innerText = 'Uploading...';
     progressBarContainer.classList.remove('hidden');
     progressText.textContent = 'Starting upload...';
     progressBar.style.width = '0%';

     // Construct storage path
     const timestamp = Date.now();
     // Use 'uploads' folder structure consistent with backend trigger if possible
     const storagePath = `uploads/${currentUser.uid}/${timestamp}_${currentFile.name}`;
     const storageRef = ref(storage, storagePath);

     const metadata = {
         contentType: currentFile.type,
         customMetadata: {
             'originalName': currentFile.name,
             'uploaderUid': currentUser.uid,
             'uploaderEmail': currentUser.email || 'N/A'
         }
     };

     // Use v9 modular uploadBytesResumable()
     const uploadTask = uploadBytesResumable(storageRef, currentFile, metadata);

     // Listen for state changes, errors, and completion of the upload.
     uploadTask.on('state_changed',
         (snapshot) => {
             // Progress handler
             const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
             progressBar.style.width = progress + '%';
             progressText.textContent = `Uploading: ${Math.round(progress)}%`;
         },
         (error) => {
             // Error handler
             console.error("Upload failed:", error);
             let message = `Upload failed: ${error.code || error.message}`;
             if (error.code === 'storage/unauthorized') {
                  message = "Upload failed: Permission denied. Check Storage Rules.";
             } else if (error.code === 'storage/canceled') {
                  message = "Upload canceled.";
             }
             showBanner(message, "red");
             progressText.textContent = 'Upload failed.';
             progressBar.style.width = '0%';
             progressBarContainer.classList.add('hidden');
             uploadButton.disabled = false;
             uploadButton.innerText = 'Upload Ticket';
         },
         async () => {
             // Completion handler
             progressText.textContent = 'Upload complete! Saving details...';
             console.log("File uploaded successfully to:", storagePath);

             try {
                 // --- Firestore Document Creation (v9 modular) ---
                 // *** FIX: Use 'db' instead of 'firestore' ***
                 const ticketsCollectionRef = collection(db, "tickets");
                 const docData = {
                     fileName: currentFile.name,
                     storagePath: storagePath, // Store the path
                     contentType: currentFile.type,
                     size: currentFile.size,
                     uploaderUid: currentUser.uid,
                     uploaderEmail: currentUser.email || 'N/A',
                     timestamp: serverTimestamp(), // Use v9 serverTimestamp()
                     status: 'pending', // Initial status
                     fixNeeded: false // Default
                 };

                 // --- Direct Firestore Write (TEMPORARY - RELIES ON RELAXED RULES) ---
                 // WARNING: This direct client-side write MUST be removed and handled
                 // by a backend function (like processTicketOCR) once security rules are reverted.
                 console.log("Attempting direct Firestore write (Temporary Rule Dependent)...");
                 const docRef = await addDoc(ticketsCollectionRef, docData);
                 console.log("Ticket metadata saved to Firestore with ID:", docRef.id);
                 // --- End Temporary Write Section ---

                 showBanner("Upload successful! Ticket submitted for processing.", "green");
                 progressText.textContent = 'Ticket submitted!';

                 // Reset the form after a short delay
                 setTimeout(resetFileInput, 2000);

             } catch (firestoreError) {
                 console.error("Error saving metadata to Firestore:", firestoreError);
                 showBanner(`Upload complete, but failed to save details: ${firestoreError.message}`, "red");
                 progressText.textContent = 'Upload complete, but save failed.';
                 // Re-enable button even if Firestore fails for now
                 uploadButton.disabled = false;
                 uploadButton.innerText = 'Upload Ticket';
             }
         }
     ); // End uploadTask.on
  }


  // --- Authentication Handling (v9 Modular) ---
  if (auth) {
      onAuthStateChanged(auth, (user) => {
          const isLoggedIn = !!user;

          if (isLoggedIn) {
              currentUser = {
                  uid: user.uid,
                  email: user.email,
                  displayName: user.displayName
              };
              if (authStatus) authStatus.textContent = `Logged in as: ${user.displayName || user.email}`;
              // if (logoutButton) logoutButton.classList.remove('hidden');
              // if (loginSection) loginSection.classList.add('hidden');
              if (uploadContainer) uploadContainer.classList.remove('hidden');
              // Only enable upload button if a file is ALSO selected
              if (uploadButton && currentFile) uploadButton.disabled = false;

          } else {
              currentUser = null;
              if (authStatus) authStatus.textContent = '';
              // if (logoutButton) logoutButton.classList.add('hidden');
              // if (loginSection) loginSection.classList.remove('hidden');
              if (uploadContainer) uploadContainer.classList.add('hidden'); // Hide upload if logged out
              resetFileInput(); // Reset file input state on logout
          }
      });
  } else {
      if (authStatus) authStatus.textContent = 'Authentication service unavailable.';
      console.warn("Firebase Auth service not initialized.");
      if (uploadContainer) uploadContainer.classList.add('opacity-50', 'pointer-events-none');
      // if (loginSection) loginSection.classList.add('hidden');
  }


  // --- Event Listeners Setup ---
  if (selectFileButton && fileInput) {
    selectFileButton.addEventListener('click', () => fileInput.click());
  }
  if (fileInput) {
    fileInput.addEventListener('change', onFileInputChange);
  }
  if (removeFileButton) {
    removeFileButton.addEventListener('click', resetFileInput);
  }
  if (uploadButton) {
    uploadButton.addEventListener('click', handleUpload);
  }
  if (manualEntryButton) {
    // Use relative path for navigation within the same origin
    manualEntryButton.addEventListener('click', () => {
      window.location.href = 'manual_entry.html';
    });
  }

  // Drag and Drop Listeners
  if (dropZone) {
    dropZone.addEventListener('dragover', onDragOver);
    dropZone.addEventListener('dragleave', onDragLeave);
    dropZone.addEventListener('drop', onDrop);
    // Make clicking the dropzone (outside the button) also trigger file input
    dropZone.addEventListener('click', (e) => {
        if (selectFileButton && !selectFileButton.contains(e.target)) {
             if(fileInput) fileInput.click();
        }
    });
  }

  // Login/Logout listeners might be handled by a separate script or main page logic

}); // End DOMContentLoaded
