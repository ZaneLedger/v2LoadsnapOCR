// manager.js (Fixed: Simplified Auth + Role Check)

import { auth, db } from "./firebase.js";
import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  getIdTokenResult
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// DOM References
const logoutButton = document.getElementById("logoutButton");
const dashboardContent = document.getElementById("dashboardContent");
const fixQueueContainer = document.getElementById("fixQueueContainer");
const deniedMessage = document.getElementById("deniedMessage");
const loadingIndicator = document.getElementById("loadingIndicator");
const pendingTableBody = document.getElementById("pendingTicketsTableBody");

const pendingCount = document.getElementById("pendingCount");
const fixCount = document.getElementById("fixCount");
const approvedTodayCount = document.getElementById("approvedTodayCount");
const totalApprovedCount = document.getElementById("totalApprovedCount");

// 🔐 Auth Flow
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      console.error("❌ Login failed:", err);
      loadingIndicator.innerHTML = `<p class="text-red-500">Login failed. Enable popups and retry.</p>`;
    }
    return;
  }

  try {
    const { claims } = await getIdTokenResult(user);
    const role = claims?.role;

    loadingIndicator?.classList.add("hidden");

    if (role !== "manager" && role !== "admin") {
      deniedMessage?.classList.remove("hidden");
      dashboardContent?.classList.add("hidden");
      return;
    }

    deniedMessage?.classList.add("hidden");
    dashboardContent?.classList.remove("hidden");

    console.log("✅ Auth confirmed. Loading dashboard.");
    loadFixQueueTickets();
    loadTicketStats();
    loadPendingTickets();

  } catch (error) {
    console.error("❌ Auth or claim error:", error);
    loadingIndicator?.classList.add("hidden");
    deniedMessage.textContent = "Error verifying permissions. Please reload.";
    deniedMessage.classList.remove("hidden");
    dashboardContent?.classList.add("hidden");
  }
});

// 🔁 Logout
logoutButton?.addEventListener("click", () => {
  signOut(auth)
    .then(() => {
      dashboardContent?.classList.add("hidden");
      fixQueueContainer.innerHTML = "";
      deniedMessage?.classList.add("hidden");
    })
    .catch((err) => console.error("❌ Logout error:", err));
});

// 🧩 Fix Queue Renderer
async function loadFixQueueTickets() {
  if (!fixQueueContainer) return;
  fixQueueContainer.innerHTML = `<p class="col-span-full text-center text-gray-500 py-10">Loading tickets...</p>`;

  try {
    const q = query(collection(db, "tickets"), where("fixNeeded", "==", true));
    const snapshot = await getDocs(q);
    fixQueueContainer.innerHTML = "";

    if (snapshot.empty) {
      fixQueueContainer.innerHTML = `<p class="col-span-full text-center text-gray-500 py-10">No tickets need fixing right now. Great job!</p>`;
      return;
    }

    snapshot.forEach(docSnap => {
      const t = docSnap.data();
      const id = docSnap.id;

      const card = document.createElement("div");
      card.className = "bg-white shadow rounded p-4 flex flex-col justify-between";
      card.innerHTML = `
        <div>
          <h2 class="text-lg font-bold text-[#482366]">Ticket #${t.ticketNumber ?? id}</h2>
          <p class="mt-2 text-sm text-gray-700"><span class="font-semibold">Weight:</span> ${t.weightTons ?? "—"} tons</p>
          <p class="text-sm text-gray-700"><span class="font-semibold">Truck:</span> ${t.truckNumber ?? "—"}</p>
          <p class="text-sm text-gray-700"><span class="font-semibold">Driver:</span> ${t.driverActual ?? t.driverBadge ?? "—"}</p>
          <p class="mt-1"><span class="font-semibold text-red-600">Fix Needed</span></p>
        </div>
        <div class="mt-4">
          <a href="./fix.html?id=${id}" class="block text-center bg-[#FFC629] hover:bg-yellow-400 text-[#482366] py-2 rounded font-semibold transition duration-150 ease-in-out">
            Review & Fix
          </a>
        </div>`;
      fixQueueContainer.appendChild(card);
    });

  } catch (err) {
    console.error("❌ Error loading Fix Queue:", err);
    fixQueueContainer.innerHTML = `<div class="col-span-full text-center text-red-600 p-4 bg-red-100 rounded border border-red-400">
      <p><strong>Error:</strong> Failed to load tickets requiring fixes.</p>
      <p class="text-sm mt-1">Check the console for details.</p>
    </div>`;
  }
}

// 📊 Metrics
async function loadTicketStats() {
  try {
    const qPending = query(collection(db, "tickets"), where("status", "==", "pending"));
    const qFix = query(collection(db, "tickets"), where("fixNeeded", "==", true));
    const qApproved = query(collection(db, "tickets"), where("status", "==", "approved"));

    const [pendingSnap, fixSnap, approvedSnap] = await Promise.all([
      getDocs(qPending),
      getDocs(qFix),
      getDocs(qApproved)
    ]);

    pendingCount.textContent = pendingSnap.size;
    fixCount.textContent = fixSnap.size;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let approvedToday = 0;

    approvedSnap.forEach(doc => {
      const ts = doc.data().timestamp?.toDate?.();
      if (ts instanceof Date && ts >= today) approvedToday++;
    });

    approvedTodayCount.textContent = approvedToday;
    totalApprovedCount.textContent = approvedSnap.size;

  } catch (err) {
    console.error("❌ Error loading ticket stats:", err);
  }
}

// 📋 Pending Tickets Table
async function loadPendingTickets() {
  if (!pendingTableBody) {
    console.error("❌ #pendingTicketsTableBody not found.");
    return;
  }

  pendingTableBody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-gray-500">Loading pending tickets...</td></tr>`;

  try {
    const q = query(collection(db, "tickets"), where("status", "==", "pending"));
    const snapshot = await getDocs(q);

    pendingTableBody.innerHTML = "";

    if (snapshot.empty) {
      pendingTableBody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-gray-500">No pending tickets found.</td></tr>`;
      return;
    }

    snapshot.forEach(docSnap => {
      const t = docSnap.data();
      const id = docSnap.id;

      const submittedBy = t.uploaderEmail ?? "—";
      const date = t.timestamp?.toDate?.().toLocaleDateString() ?? "—";

      const row = document.createElement("tr");
      row.innerHTML = `
        <td class="px-6 py-4 whitespace-nowrap">${t.ticketNumber ?? id}</td>
        <td class="px-6 py-4 whitespace-nowrap">${submittedBy}</td>
        <td class="px-6 py-4 whitespace-nowrap">${date}</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <button data-approve-id="${id}" class="text-green-600 hover:text-green-800 mr-2">Approve</button>
          <button data-reject-id="${id}" class="text-red-600 hover:text-red-800">Reject</button>
        </td>
      `;
      pendingTableBody.appendChild(row);
    });

  } catch (err) {
    console.error("❌ Failed to load pending tickets:", err);
    pendingTableBody.innerHTML = `<tr><td colspan="4" class="text-center text-red-600 py-4">Error loading pending tickets.</td></tr>`;
  }
}

// ✅ Approve / Reject Handler
document.addEventListener("click", async (e) => {
  const approveBtn = e.target.closest("[data-approve-id]");
  const rejectBtn = e.target.closest("[data-reject-id]");

  if (approveBtn) {
    const docId = approveBtn.dataset.approveId;
    await updateTicketStatus(docId, "approved", approveBtn);
  }

  if (rejectBtn) {
    const docId = rejectBtn.dataset.rejectId;
    await updateTicketStatus(docId, "rejected", rejectBtn);
  }
});

// 🔧 Update Firestore with status + manager_review
async function updateTicketStatus(ticketId, newStatus, button) {
  if (!ticketId) return;

  try {
    button.disabled = true;
    button.textContent = "Saving...";
    const docRef = doc(db, "tickets", ticketId);

    const updatePayload = { status: newStatus };

    if (newStatus === "approved") {
      updatePayload.manager_review = {
        reviewed_by: auth.currentUser?.email || "unknown",
        reviewed_at: serverTimestamp()
      };
    }

    await updateDoc(docRef, updatePayload);

    const row = button.closest("tr");
    row?.remove();

    console.log(`✅ Ticket ${ticketId} updated to "${newStatus}"`);
    loadTicketStats();

  } catch (err) {
    console.error(`❌ Failed to update ticket ${ticketId}:", err);
    button.textContent = "Error";
    setTimeout(() => {
      button.textContent = newStatus === "approved" ? "Approve" : "Reject";
      button.disabled = false;
    }, 2000);
  }
}