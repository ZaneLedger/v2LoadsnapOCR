import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-functions.js";

// DOM Elements
const logoutButton = document.getElementById("logoutButton");
const pendingContainer = document.getElementById("pendingContainer");
const fixContainer = document.getElementById("fixContainer");
const functions = getFunctions();
const approveTicket = httpsCallable(functions, 'approveTicket');
const rejectTicket = httpsCallable(functions, 'rejectTicket');

// FIRESTORE-BASED ROLE CHECK
onAuthStateChanged(auth, async (user) => {
  if (!user) return location.href = "/login.html";

  try {
    const managerDoc = await getDoc(doc(db, "manager_emails", user.email));
    if (!managerDoc.exists()) return location.href = "/login.html";

    // ✅ User is authorized
    loadTickets();
  } catch (err) {
    console.error("Authorization check failed:", err);
    location.href = "/login.html";
  }
});

// Logout
logoutButton?.addEventListener("click", async () => {
  await signOut(auth);
  location.href = "/login.html";
});

// Load and Render Tickets
async function loadTickets() {
  pendingContainer.innerHTML = `<p class="text-center p-4 text-gray-500">Loading...</p>`;
  fixContainer.innerHTML = `<p class="text-center p-4 text-gray-500">Loading...</p>`;

  const snap = await getDocs(query(
    collection(db, "tickets"),
    where("status", "in", ["pending", "draft"])
  ));

  pendingContainer.innerHTML = "";
  fixContainer.innerHTML = "";

  let pCount = 0, fCount = 0;
  snap.forEach(docSnap => {
    const t = docSnap.data(), id = docSnap.id;
    const card = document.createElement("div");
    card.className = "bg-white border rounded p-4 shadow space-y-2 ticket-card";
    card.innerHTML = `
      <p><strong>#${t.ticketNumber || id}</strong></p>
      <p>Status: ${t.status}</p>
      <div class="flex gap-2">
        <button class="approveBtn px-2 py-1 bg-green-500 text-white rounded" data-id="${id}">Approve</button>
        <button class="rejectBtn px-2 py-1 bg-red-500 text-white rounded" data-id="${id}">Reject</button>
        <a href="fix.html?id=${id}" class="px-2 py-1 bg-blue-500 text-white rounded">Fix</a>
      </div>
    `;
    if (t.status === "pending") { pendingContainer.append(card); pCount++; }
    else { fixContainer.append(card); fCount++; }
  });

  document.getElementById("pendingCount").textContent = pCount;
  document.getElementById("fixCount").textContent = fCount;

  [pendingContainer, fixContainer].forEach(container =>
    container.addEventListener("click", async e => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const id = btn.dataset.id;
      btn.disabled = true;
      try {
        if (btn.classList.contains("approveBtn")) await approveTicket({ ticketId: id });
        else await rejectTicket({ ticketId: id });
        btn.closest(".ticket-card").remove();
      } catch (err) {
        alert("Action failed: " + err.message);
        btn.disabled = false;
      }
    })
  );
}
