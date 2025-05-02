// public/manager.js

import { app, auth, db } from "./firebase.js";
import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// DOM refs
const loadingIndicator = document.getElementById("loadingIndicator");
const deniedMessage    = document.getElementById("roleDeniedMessage");
const dashboardSection = document.getElementById("dashboardSection");
const logoutButton     = document.getElementById("logoutButton");

// Handle auth state
onAuthStateChanged(auth, async user => {
  loadingIndicator.classList.add("hidden");

  if (!user) {
    // Kick off login
    await signInWithPopup(auth, new GoogleAuthProvider()).catch(console.error);
    return;
  }

  // Check manager role
  const snap = await getDoc(doc(db, "config", "managers"));
  const managers = snap.exists() ? snap.data().uids : [];
  const isManager = managers.includes(user.uid);

  if (!isManager) {
    deniedMessage.classList.remove("hidden");
    return;
  }

  // Show dashboard, load tickets
  dashboardSection.classList.remove("hidden");
  loadDashboardTickets();
});

// Logout handler
logoutButton.addEventListener("click", () => signOut(auth));

// Load tickets into grid
async function loadDashboardTickets() {
  dashboardSection.innerHTML = ""; // clear any placeholders

  try {
    const snapshot = await getDocs(collection(db, "tickets"));
    if (snapshot.empty) {
      dashboardSection.innerHTML = `<p class="col-span-full text-center text-gray-500">
        No tickets available.
      </p>`;
      return;
    }

    snapshot.forEach(docSnap => {
      const t = docSnap.data();
      const id = docSnap.id;
      const card = `
        <div class="bg-white shadow rounded p-4 flex flex-col justify-between">
          <div>
            <h2 class="text-lg font-bold text-[#482366]">
              Ticket #${t.ticketNumber || id}
            </h2>
            <p class="mt-2"><span class="font-semibold">Weight:</span>
               ${t.weightTons ?? "—"} tons</p>
            <p><span class="font-semibold">Truck:</span>
               ${t.truckNumber ?? "—"}</p>
            <p><span class="font-semibold">Driver:</span>
               ${t.driverActual ?? t.driverBadge ?? "—"}</p>
            <p><span class="font-semibold">Status:</span>
               ${t.status ?? "pending"}</p>
          </div>
          <div class="mt-4">
            <a href="./fix.html?id=${id}"
               class="block text-center bg-[#FFC629] hover:bg-yellow-400
                      text-[#482366] py-2 rounded font-semibold">
              Review
            </a>
          </div>
        </div>`;
      dashboardSection.insertAdjacentHTML("beforeend", card);
    });
  } catch (err) {
    console.error("Error loading tickets:", err);
    dashboardSection.innerHTML = `<p class="col-span-full text-center text-red-600">
      Failed to load tickets.
    </p>`;
  }
}
