import { auth, db } from "./firebase.js";
import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import {
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// DOM Elements
const loading     = document.getElementById("loading");
const ticketList  = document.getElementById("ticketList");
const logoutBtn   = document.getElementById("logoutBtn");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    await signInWithPopup(auth, new GoogleAuthProvider());
    return;
  }

  const q = query(
    collection(db, "tickets"),
    where("uploaderUid", "==", user.uid)
  );

  try {
    const snap = await getDocs(q);
    loading.classList.add("hidden");
    ticketList.classList.remove("hidden");

    if (snap.empty) {
      ticketList.innerHTML = `<p class="text-gray-500 col-span-full text-center">No tickets submitted yet.</p>`;
      return;
    }

    snap.forEach(doc => {
      const t = doc.data();
      const card = document.createElement("div");
      card.className = "bg-white rounded shadow p-4 space-y-1 border";

      card.innerHTML = `
        <h2 class="text-[#0069A7] font-bold text-lg">Ticket #${t.ticketNumber ?? doc.id}</h2>
        <p class="text-sm"><strong>Status:</strong> ${t.status ?? "pending"}</p>
        <p class="text-sm"><strong>Uploaded:</strong> ${t.timestamp?.toDate?.().toLocaleDateString() ?? "—"}</p>
        ${t.fixNeeded ? `<p class="text-sm text-red-600">⚠️ Needs Manager Fix</p>` : ""}
      `;

      ticketList.appendChild(card);
    });
  } catch (err) {
    console.error("❌ Failed to load tickets:", err);
    loading.textContent = "Failed to load your tickets.";
  }
});

// Logout handler
logoutBtn?.addEventListener("click", () => {
  signOut(auth).then(() => location.reload());
});
