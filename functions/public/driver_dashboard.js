import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import {
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    console.warn("Not signed in. Redirecting...");
    window.location.href = "/login.html";
    return;
  }

  const uid = user.uid;
  const ticketContainer = document.getElementById("ticketContainer");
  const emptyState = document.getElementById("emptyState");

  try {
    const ticketsRef = collection(db, "tickets");
    const q = query(
      ticketsRef,
      where("uploaderUid", "==", uid),
      where("status", "in", ["pending", "rejected", "draft"])
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      ticketContainer.style.display = "none";
      emptyState.classList.remove("hidden");
      return;
    }

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const ticketId = doc.id;
      const status = data.status;
      const disposalDate = data.disposalDate || "Unknown";

      let statusColor = "bg-gray-300 text-gray-800";
      let statusLabel = "Unknown";

      switch (status) {
        case "pending":
          statusColor = "bg-blue-200 text-blue-900";
          statusLabel = "Pending";
          break;
        case "rejected":
          statusColor = "bg-red-200 text-red-800";
          statusLabel = "Rejected";
          break;
        case "draft":
          statusColor = "bg-yellow-200 text-yellow-900";
          statusLabel = "Fix Needed";
          break;
      }

      const div = document.createElement("div");
      div.className = `border-l-4 pl-4 py-4 bg-white border-gray-300 rounded shadow mb-4`;

      div.innerHTML = `
        <p class="mb-1 text-base"><span class="font-semibold">Ticket #:</span> ${data.ticketNumber || "Unknown"}</p>
        <p class="mb-1 text-base">
          <span class="font-semibold">Status:</span>
          <span class="inline-block px-2 py-1 text-xs font-bold rounded-full ${statusColor} shadow-sm">
            ${statusLabel}
          </span>
        </p>
        <p class="mb-2 text-base"><span class="font-semibold">Disposal Date:</span> ${disposalDate}</p>
        <div class="flex flex-wrap space-x-4 text-sm font-medium">
          <a href="ticket.html?id=${ticketId}" class="text-blue-600 hover:underline">View Ticket</a>
          <a href="${data.storagePath || '#'}" target="_blank" class="text-blue-600 hover:underline">View Image</a>
          <a href="manual_entry.html?ticketId=${ticketId}" class="text-blue-600 hover:underline">Fix This Ticket</a>
        </div>
      `;

      ticketContainer.appendChild(div);
    });
  } catch (error) {
    console.error("Failed to load tickets:", error);
    emptyState.classList.remove("hidden");
  }
});

// 🔒 Logout
document.getElementById("logoutButton")?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login.html";
});
