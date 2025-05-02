// public/fix.js
import { auth, db, storage } from "./firebase.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { ref, getDownloadURL }     from "https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js";

// Parse ticket ID from URL
const params   = new URLSearchParams(window.location.search);
const ticketId = params.get("id");
if (!ticketId) {
  alert("No ticket ID provided");
  throw new Error("Missing ticket ID");
}

// DOM elements
document.getElementById("ticketId").textContent = ticketId;
const ocrTextElem = document.getElementById("ocrText");
const notesElem   = document.getElementById("notes");
const approveBtn  = document.getElementById("approveBtn");
const rejectBtn   = document.getElementById("rejectBtn");
const ticketImg   = document.getElementById("ticketImage");

// Load ticket data and image
(async () => {
  try {
    const ticketRef  = doc(db, "tickets", ticketId);
    const ticketSnap = await getDoc(ticketRef);
    if (!ticketSnap.exists()) {
      alert("Ticket not found");
      return;
    }
    const data = ticketSnap.data();

    // Fill form fields
    ocrTextElem.value = data.ocrText || "";
    notesElem.value   = data.manager_review?.notes || data.notes || "";

    // Load image using storagePath
    const storagePath = data.storagePath; 
    if (storagePath) {
      const imgRef = ref(storage, storagePath);
      ticketImg.src = await getDownloadURL(imgRef);
    }
  } catch (err) {
    console.error("Error loading ticket:", err);
    alert("Failed to load ticket data");
  }
})();

// Approve handler
approveBtn.addEventListener("click", async () => {
  try {
    await updateDoc(doc(db, "tickets", ticketId), {
      "manager_review.status": "approved",
      "manager_review.reviewed_at": new Date(),
      "manager_review.reviewed_by": auth.currentUser.uid,
      "ocrText": ocrTextElem.value,
      "manager_review.notes": notesElem.value
    });
    alert("Ticket approved!");
    location.href = "fix.html";
  } catch (err) {
    console.error("Approve failed:", err);
    alert("Failed to approve ticket");
  }
});

// Discard handler
rejectBtn.addEventListener("click", async () => {
  if (!confirm("Permanently discard this ticket?")) return;
  try {
    await updateDoc(doc(db, "tickets", ticketId), {
      "manager_review.status": "discarded",
      "manager_review.reviewed_at": new Date(),
      "manager_review.reviewed_by": auth.currentUser.uid,
      "manager_review.notes": notesElem.value
    });
    alert("Ticket discarded");
    location.href = "fix.html";
  } catch (err) {
    console.error("Discard failed:", err);
    alert("Failed to discard ticket");
  }
});
