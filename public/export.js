import { auth, db, functions } from "./firebase.js";
import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-functions.js";

// DOM refs
const form = document.getElementById("searchForm");
const exportBtn = document.getElementById("exportBtn");
const resultsTableBody = document.getElementById("resultsTableBody");
const statusMsg = document.getElementById("statusMessage");

let currentUser = null;

// 🔐 Simplified Auth
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      console.error("Login error:", err);
      alert("Login required.");
      return;
    }
  }
  currentUser = user;
});

// 🔄 Timestamp conversion
function toStartOfDayTS(dateStr) {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
}
function toEndOfDayTS(dateStr) {
  const d = new Date(dateStr);
  d.setHours(23, 59, 59, 999);
  return Timestamp.fromDate(d);
}

// 🔍 Handle search
form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  statusMsg.textContent = "Searching...";
  resultsTableBody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-gray-500">Searching...</td></tr>`;

  const start = form.startDate.value;
  const end = form.endDate.value;
  const status = form.statusFilter.value;

  const conditions = [
    where("timestamp", ">=", toStartOfDayTS(start)),
    where("timestamp", "<=", toEndOfDayTS(end)),
  ];
  if (status) {
    if (status === "fixed") {
      conditions.push(where("manager_review.status", "==", "fixed"));
    } else {
      conditions.push(where("status", "==", status));
    }
  }

  try {
    const q = query(collection(db, "tickets"), ...conditions);
    const snapshot = await getDocs(q);

    statusMsg.textContent = `${snapshot.size} tickets found.`;

    if (snapshot.empty) {
      resultsTableBody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-gray-500">No results found.</td></tr>`;
      return;
    }

    resultsTableBody.innerHTML = "";
    snapshot.forEach(docSnap => {
      const t = docSnap.data();
      const row = document.createElement("tr");
      row.innerHTML = `
        <td class="px-4 py-2 border-b">${t.ticketNumber ?? docSnap.id}</td>
        <td class="px-4 py-2 border-b">${t.timestamp?.toDate()?.toLocaleDateString() ?? "—"}</td>
        <td class="px-4 py-2 border-b">${t.driverActual ?? "—"}</td>
        <td class="px-4 py-2 border-b">${t.weightTons ?? "—"}</td>
        <td class="px-4 py-2 border-b">${t.status ?? t.manager_review?.status ?? "—"}</td>
      `;
      resultsTableBody.appendChild(row);
    });

  } catch (err) {
    console.error("❌ Search failed:", err);
    statusMsg.textContent = "Error during search.";
    resultsTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-red-600 py-4">Error loading results.</td></tr>`;
  }
});

// 📥 Export XLSX
exportBtn?.addEventListener("click", async () => {
  const start = form.startDate.value;
  const end = form.endDate.value;

  if (!start || !end) {
    alert("Please select start and end dates first.");
    return;
  }

  exportBtn.disabled = true;
  exportBtn.textContent = "Exporting...";
  statusMsg.textContent = "Generating Excel file...";

  try {
    const callable = httpsCallable(functions, "exportTicketsToXLSX");
    const result = await callable({ startDate: start, endDate: end });

    const url = result.data.url;
    window.open(url, "_blank");
    statusMsg.textContent = "✅ Export ready.";

  } catch (err) {
    console.error("❌ Export failed:", err);
    alert("Export failed. Check console for details.");
    statusMsg.textContent = "❌ Export failed.";
  }

  exportBtn.disabled = false;
  exportBtn.textContent = "Export XLSX";
});
