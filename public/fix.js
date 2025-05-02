// public/fix.js
import { auth, db, storage } from "./firebase.js";
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js";

// Parse ticket ID from URL
const ticketId = new URLSearchParams(window.location.search).get("id");
if (!ticketId) {
  alert("Missing ticket ID in URL");
  throw new Error("No ticket ID provided");
}

// DOM Elements
const ticketNumberElem = document.getElementById("ticketNumber");
const weightInput      = document.getElementById("weightTons");
const truckInput       = document.getElementById("truckNumber");
const driverInput      = document.getElementById("driverActual");
const form             = document.getElementById("fixForm");
const loading          = document.getElementById("loading");
const errorBox         = document.getElementById("error");
const successBox       = document.getElementById("success");
const discardBtn       = document.getElementById("discardBtn");
const imageWrapper     = document.getElementById("imageWrapper");
const ticketImg        = document.getElementById("ticketImage");
const zoomModal        = document.getElementById("zoomModal");
const zoomImage        = document.getElementById("zoomImage");

// Load Ticket Info
(async () => {
  try {
    const ticketRef = doc(db, "tickets", ticketId);
    const snap = await getDoc(ticketRef);

    if (!snap.exists()) {
      throw new Error("Ticket not found");
    }

    const data = snap.data();
    ticketNumberElem.value = data.ticketNumber ?? ticketId;
    weightInput.value = data.weightTons ?? "";
    truckInput.value = data.truckNumber ?? "";
    driverInput.value = data.driverActual ?? "";

    if (data.storagePath) {
      try {
        const imgRef = ref(storage, data.storagePath);
        const url = await getDownloadURL(imgRef);
        ticketImg.src = url;
        imageWrapper.classList.remove("hidden");
      } catch (imgErr) {
        console.warn("Image load failed:", imgErr.message);
      }
    }

    loading.classList.add("hidden");
    form.classList.remove("hidden");

  } catch (err) {
    console.error("❌ Load error:", err.message);
    loading.classList.add("hidden");
    errorBox.textContent = err.message || "Failed to load ticket data.";
    errorBox.classList.remove("hidden");
  }
})();

// Save Fix
form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  successBox.classList.add("hidden");
  errorBox.classList.add("hidden");

  try {
    const ticketRef = doc(db, "tickets", ticketId);
    await updateDoc(ticketRef, {
      weightTons: parseFloat(weightInput.value),
      truckNumber: truckInput.value,
      driverActual: driverInput.value,
      fixNeeded: false,
      manager_review: {
        reviewed_by: auth.currentUser?.email ?? "unknown",
        reviewed_at: serverTimestamp(),
        status: "fixed"
      }
    });

    successBox.textContent = "✅ Ticket fixed successfully.";
    successBox.classList.remove("hidden");

  } catch (err) {
    console.error("❌ Update error:", err);
    errorBox.textContent = "Failed to save ticket.";
    errorBox.classList.remove("hidden");
  }
});

// Delete Ticket
discardBtn?.addEventListener("click", async () => {
  const confirmed = confirm("⚠️ This will permanently delete the ticket. Proceed?");
  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, "tickets", ticketId));
    alert("🗑️ Ticket deleted.");
    window.location.href = "manager_dashboard.html";
  } catch (err) {
    console.error("❌ Discard error:", err);
    alert("Failed to delete ticket.");
  }
});

// Zoom Image Logic
ticketImg?.addEventListener("click", () => {
  if (ticketImg.src) {
    zoomImage.src = ticketImg.src;
    zoomModal.classList.remove("hidden");
  }
});

zoomModal?.addEventListener("click", () => {
  zoomModal.classList.add("hidden");
  zoomImage.src = "";
});
