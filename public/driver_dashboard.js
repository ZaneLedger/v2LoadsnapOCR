import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import {
  collection,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const ticketContainer = document.getElementById("ticketContainer");
const emptyState = document.getElementById("emptyState");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const q = query(
    collection(db, "tickets"),
    where("uploaderUid", "==", user.uid),
    where("status", "in", ["pending", "rejected", "draft"])
  );

  try {
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      emptyState.classList.remove("hidden");
      return;
    }

    snapshot.forEach((doc) => {
      const ticket = doc.data();
      const div = document.createElement("div");

      let color, label;
      switch (ticket.status) {
        case "rejected":
          color = "red";
          label = "Rejected";
          break;
        case "draft":
          color = "gray";
          label = "Draft";
          break;
        case "pending":
        default:
          color = "yellow";
          label = "Fix Needed";
          break;
      }

      div.className = `border-l-4 pl-4 py-4 bg-${color}-50 border-${color}-500 rounded shadow`;
      div.innerHTML = `
        <p class="mb-1 text-base"><span class="font-semibold">Ticket #:</span> ${ticket.ticketNumber || "(missing)"}</p>
        <p class="mb-1 text-base">
          <span class="font-semibold">Status:</span>
          <span class="inline-block px-2 py-1 text-xs font-bold rounded-full bg-${color}-200 text-${color}-900 shadow-sm">
            ${label}
          </span>
        </p>
        <p class="mb-2 text-base"><span class="font-semibold">Disposal Date:</span> ${ticket.DisposalDateTime || "N/A"}</p>
        <div class="flex flex-wrap space-x-4 text-sm font-medium">
          <a href="ticket.html?id=${doc.id}" class="text-blue-600 hover:underline">View Ticket</a>
          <a href="${ticket.imageUrl || "#"}" target="_blank" class="text-blue-600 hover:underline">View Image</a>
          <a href="manual_entry.html?ticketId=${doc.id}" class="text-blue-600 hover:underline">Fix This Ticket</a>
        </div>
      `;
      ticketContainer.appendChild(div);
    });
  } catch (err) {
    console.error("Error loading tickets:", err);
    emptyState.classList.remove("hidden");
  }
});
