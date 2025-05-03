import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-functions.js";

// DOM references
const logoutButton = document.getElementById("logoutButton");
const pendingContainer = document.getElementById("pendingContainer");
const fixContainer = document.getElementById("fixContainer");

// Firebase functions setup
const functions = getFunctions();
const verifyManagerRole = httpsCallable(functions, 'verifyManagerRole');

// 🔐 Auth + Role Check
onAuthStateChanged(auth, async (user) => {
  if (!user) return redirectToLogin();

  try {
    const token = await user.getIdTokenResult(true);
    const role = token.claims.role;

    if (role !== "manager" && role !== "admin") return redirectToLogin();

    const result = await verifyManagerRole();
    if (result.data.message !== 'User is a manager') return redirectToLogin();

    console.log("✅ Access granted to Manager Dashboard");
    await loadTickets(user);

  } catch (err) {
    console.error("Auth/Role error:", err);
    return redirectToLogin();
  }
});

function redirectToLogin() {
  window.location.href = "/login.html";
}

// Logout
logoutButton?.addEventListener("click", async () => {
  await signOut(auth);
  redirectToLogin();
});

// 🔄 Load Pending & Fix Queue
async function loadTickets(user) {
  try {
    pendingContainer.innerHTML = "";
    fixContainer.innerHTML = "";

    const ticketsRef = collection(db, "tickets");
    const q = query(ticketsRef, where("status", "in", ["pending", "draft"]));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      pendingContainer.innerHTML = `<p class="text-gray-500 text-sm text-center">No tickets pending review.</p>`;
      fixContainer.innerHTML = `<p class="text-gray-500 text-sm text-center">No tickets in fix queue.</p>`;
      return;
    }

    snapshot.forEach((docSnap) => {
      const ticket = docSnap.data();
      const id = docSnap.id;

      const card = document.createElement("div");
      card.className = "bg-white border border-gray-200 rounded p-4 shadow space-y-2";

      card.innerHTML = `
        <p><strong>Ticket #:</strong> ${ticket.ticketNumber || "N/A"}</p>
        <p><strong>Uploader:</strong> ${ticket.uploaderEmail || "N/A"}</p>
        <p><strong>Status:</strong> ${ticket.status}</p>
        <div class="flex gap-4">
          <button class="approveBtn bg-green-500 text-white px-2 py-1 rounded" data-id="${id}">Approve</button>
          <button class="rejectBtn bg-red-500 text-white px-2 py-1 rounded" data-id="${id}">Reject</button>
        </div>
      `;

      if (ticket.status === "pending") {
        pendingContainer?.appendChild(card);
      } else {
        fixContainer?.appendChild(card);
      }
    });

    attachActions(user);

  } catch (err) {
    console.error("Failed to load manager tickets:", err);
  }
}

// ✅ Action Handlers
function attachActions(user) {
  document.querySelectorAll(".approveBtn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      await updateDoc(doc(db, "tickets", id), {
        status: "approved",
        managerEmail: user.email || "",
        reviewTimestamp: serverTimestamp()
      });
      btn.closest("div").remove();
    });
  });

  document.querySelectorAll(".rejectBtn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      await updateDoc(doc(db, "tickets", id), {
        status: "rejected",
        managerEmail: user.email || "",
        reviewTimestamp: serverTimestamp()
      });
      btn.closest("div").remove();
    });
  });
}
