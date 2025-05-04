// public/fix.js (Corrected with Auth Check & Callable Functions)

// Ensure firebase.js is correctly configured and working!
import { auth, db, storage } from "./firebase.js";
import {
  onAuthStateChanged,
  getIdTokenResult // Needed for role check
  // signOut // Not typically needed on a fix page
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import {
  doc,
  getDoc
  // updateDoc, deleteDoc, serverTimestamp are NO LONGER needed here
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import {
  ref,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js";
// Import Functions SDK
import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-functions.js";

// --- Initial Setup & URL Parsing ---
const ticketId = new URLSearchParams(window.location.search).get("id");
const functions = getFunctions(); // Initialize Cloud Functions

// --- DOM Element References ---
const ticketNumberElem = document.getElementById("ticketNumber");
const weightInput = document.getElementById("weightTons");
const truckInput = document.getElementById("truckNumber");
const driverInput = document.getElementById("driverActual");
// Add other form field references here if you add them to fix.html
// const disposalSiteInput = document.getElementById("disposalSiteFinal");
// ... etc ...
const form = document.getElementById("fixForm");
const loading = document.getElementById("loading");
const errorBox = document.getElementById("error");
const successBox = document.getElementById("success");
const discardBtn = document.getElementById("discardBtn");
const imageWrapper = document.getElementById("imageWrapper");
const ticketImg = document.getElementById("ticketImage");
const zoomModal = document.getElementById("zoomModal");
const zoomImage = document.getElementById("zoomImage");
const submitButton = form?.querySelector('button[type="submit"]');

// --- Check for Ticket ID ---
if (!ticketId) {
  handleFatalError("Missing ticket ID in URL. Cannot load ticket.");
}

// --- Firebase Callable Function References ---
// Ensure these function names match your deployed backend functions
const saveTicketFix = httpsCallable(functions, 'saveTicketFix'); // NEW function needed
const rejectTicket = httpsCallable(functions, 'rejectTicket'); // Existing function

// --- Authentication and Authorization Check ---
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // Not logged in, redirect to login
    console.log("User not logged in, redirecting.");
    return redirectToLogin();
  }

  console.log("User logged in, verifying manager/admin role...");
  try {
    const idTokenResult = await getIdTokenResult(user, true); // Force refresh for latest claims
    const claims = idTokenResult.claims;
    const isAuthorized = claims && (claims.role === 'manager' || claims.role === 'admin' || claims.admin === true);

    if (!isAuthorized) {
      console.warn("User is not authorized as manager/admin. Claims:", claims);
      handleFatalError("Access Denied: You do not have permission to view or fix tickets.");
      return; // Stop execution
    }

    // --- User is Authorized - Load Ticket Data ---
    console.log("User authorized. Loading ticket data for ID:", ticketId);
    await loadTicketData();

  } catch (err) {
    console.error("❌ Error during auth check or initial load:", err);
    handleFatalError(`Authentication error: ${err.message}`);
  }
});

// --- Load Ticket Data Function ---
async function loadTicketData() {
  // Ensure elements exist before proceeding
  if (!form || !loading || !errorBox || !ticketNumberElem || !weightInput || !truckInput || !driverInput || !imageWrapper || !ticketImg) {
      console.error("Required DOM elements not found for loading data.");
      handleFatalError("Page structure error. Cannot load ticket details.");
      return;
  }

  loading.classList.remove('hidden'); // Show loading
  form.classList.add('hidden'); // Hide form while loading
  errorBox.classList.add('hidden'); // Hide errors

  try {
    const ticketRef = doc(db, "tickets", ticketId);
    const snap = await getDoc(ticketRef);

    if (!snap.exists()) {
      throw new Error(`Ticket with ID ${ticketId} not found.`);
    }

    const data = snap.data();
    console.log("Ticket data loaded:", data);

    // Populate form fields (add more as needed from fix.html)
    ticketNumberElem.value = data.ticketNumber ?? ticketId; // Display ID if number missing
    weightInput.value = data.weightTons ?? "";
    truckInput.value = data.truckNumber ?? "";
    driverInput.value = data.driverActual ?? data.driverBadge ?? ""; // Use actual name, fallback to badge
    // Populate other fields:
    // disposalSiteInput.value = data.disposalSiteFinal ?? "";
    // ... etc ...

    // Load image if path exists
    if (data.storagePath) {
      try {
        console.log("Fetching image from path:", data.storagePath);
        const imgRef = ref(storage, data.storagePath);
        const url = await getDownloadURL(imgRef);
        ticketImg.src = url;
        imageWrapper.classList.remove("hidden");
        console.log("Image loaded successfully.");
      } catch (imgErr) {
        console.warn("Ticket image load failed:", imgErr.message);
        // Optionally display a placeholder or message in the image area
        if(imageWrapper) imageWrapper.innerHTML = '<p class="text-center text-xs text-red-500">Could not load ticket image.</p>';
        imageWrapper?.classList.remove("hidden");
      }
    } else {
        console.warn("No storagePath found for ticket image.");
        if(imageWrapper) imageWrapper.innerHTML = '<p class="text-center text-xs text-gray-500">No image associated with this ticket.</p>';
        imageWrapper?.classList.remove("hidden");
    }

    // Show form, hide loading
    loading.classList.add("hidden");
    form.classList.remove("hidden");

  } catch (err) {
    console.error("❌ Load ticket error:", err);
    handleFatalError(`Failed to load ticket data: ${err.message}`);
  }
}

// --- Form Submit Handler (Save Fix) ---
form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!auth.currentUser) return alert("Error: No authenticated user found. Please re-login."); // Should not happen if auth check passed

  // Disable buttons, clear status
  if(submitButton) submitButton.disabled = true;
  if(discardBtn) discardBtn.disabled = true;
  successBox?.classList.add("hidden");
  errorBox?.classList.add("hidden");
  if(statusBox) statusBox.textContent = "Saving changes..."; // Use statusBox if you add one
  if(statusBox) statusBox.classList.remove("hidden");

  try {
    // 1. Collect updated data from form fields
    const updatedData = {
      weightTons: parseFloat(weightInput.value) || null, // Ensure number or null
      truckNumber: truckInput.value.trim() || null,
      driverActual: driverInput.value.trim() || null
      // Add other fields from your form here:
      // disposalSiteFinal: disposalSiteInput.value.trim() || null,
      // ... etc ...
    };

    // Optional: Add client-side validation if needed

    // 2. Prepare data payload for the Cloud Function
    const payload = {
        ticketId: ticketId,
        updates: updatedData // Send only the fields that were editable
    };

    // 3. Call the 'saveTicketFix' Cloud Function
    // --- Direct updateDoc REMOVED ---
    console.log("Calling 'saveTicketFix' function with payload:", payload);
    const result = await saveTicketFix(payload);
    console.log("saveTicketFix function result:", result.data);

    // 4. Handle success
    if (successBox) {
        successBox.textContent = result.data?.message || "✅ Ticket fixed and approved successfully.";
        successBox.classList.remove("hidden");
    }
    // Optionally disable form or redirect after success
    // form.style.opacity = "0.5"; // Example: Dim form
    // setTimeout(() => { window.location.href = 'manager_dashboard.html'; }, 2000);


  } catch (err) {
    console.error("❌ Save Fix error:", err);
    if (errorBox) {
        errorBox.textContent = `Failed to save fix: ${err.message || "Unknown error"}`;
        errorBox.classList.remove("hidden");
    }
  } finally {
      // Re-enable buttons
      if(submitButton) submitButton.disabled = false;
      if(discardBtn) discardBtn.disabled = false;
      if(statusBox) statusBox.classList.add("hidden"); // Hide status message
  }
});

// --- Discard Button Handler ---
discardBtn?.addEventListener("click", async () => {
  if (!auth.currentUser) return alert("Error: No authenticated user found. Please re-login.");

  const confirmed = confirm("⚠️ Are you sure you want to REJECT this ticket? This action cannot be easily undone.");
  if (!confirmed) return;

  // Disable buttons, clear status
  if(submitButton) submitButton.disabled = true;
  if(discardBtn) discardBtn.disabled = true;
  successBox?.classList.add("hidden");
  errorBox?.classList.add("hidden");
  if(statusBox) statusBox.textContent = "Rejecting ticket...";
  if(statusBox) statusBox.classList.remove("hidden");


  try {
    // Call the existing 'rejectTicket' Cloud Function
    // --- Direct deleteDoc REMOVED ---
    console.log("Calling 'rejectTicket' function for ID:", ticketId);
    const result = await rejectTicket({ ticketId: ticketId }); // Pass data in expected format
    console.log("rejectTicket function result:", result.data);

    alert("🗑️ Ticket rejected successfully."); // Simple confirmation
    window.location.href = "manager_dashboard.html"; // Redirect back to dashboard

  } catch (err) {
    console.error("❌ Discard/Reject error:", err);
    if (errorBox) {
        errorBox.textContent = `Failed to reject ticket: ${err.message || "Unknown error"}`;
        errorBox.classList.remove("hidden");
    }
    // Re-enable buttons on failure
    if(submitButton) submitButton.disabled = false;
    if(discardBtn) discardBtn.disabled = false;
    if(statusBox) statusBox.classList.add("hidden");
  }
});

// --- Image Zoom Logic ---
ticketImg?.addEventListener("click", () => {
  if (ticketImg.src && zoomModal && zoomImage) {
    zoomImage.src = ticketImg.src;
    zoomModal.classList.remove("hidden");
  }
});

zoomModal?.addEventListener("click", () => {
  if (zoomModal && zoomImage) {
      zoomModal.classList.add("hidden");
      zoomImage.src = ""; // Clear src to free memory
  }
});

// --- Helper Functions ---
function redirectToLogin() {
  // Avoid redirect loops if already on login page
  if (!window.location.pathname.includes("login")) {
    window.location.href = "/login.html"; // Adjust if your login page is different
  }
}

function handleFatalError(message) {
    console.error("FATAL ERROR:", message);
    if(loading) loading.classList.add('hidden');
    if(form) form.classList.add('hidden'); // Hide form on fatal error
    if(errorBox) {
        errorBox.textContent = `Error: ${message}. Please go back or contact support.`;
        errorBox.classList.remove('hidden');
    }
    // Optionally disable buttons permanently
    if(submitButton) submitButton.disabled = true;
    if(discardBtn) discardBtn.disabled = true;
}
