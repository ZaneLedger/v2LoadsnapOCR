// public/manager_dashboard.js (CLEANED + FIXED)
import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut,
  getIdTokenResult
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import {
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-functions.js";

// --- DOM References ---
const logoutButton = document.getElementById("logoutButton");
const pendingContainer = document.getElementById("pendingContainer");
const fixContainer = document.getElementById("fixContainer");
const navPending = document.getElementById("navPending");
const navFixQueue = document.getElementById("navFixQueue");

// --- Firebase Functions ---
const functions = getFunctions();
const approveTicket = httpsCallable(functions, 'approveTicket');
const rejectTicket = httpsCallable(functions, 'rejectTicket');

// --- State Variable ---
let currentView = 'pending';

// --- Auth Check ---
onAuthStateChanged(auth, async (user) => {
  console.log(`[DEBUG] onAuthStateChanged triggered. User:`, user);
  if (!user) {
    return redirectToLogin();
  }

  try {
    const idTokenResult = await getIdTokenResult(user, true);
    const claims = idTokenResult.claims;
    const isAuthorized = claims?.role === 'manager' || claims?.role === 'admin' || claims?.admin === true;

    if (!isAuthorized) {
      return redirectToLogin();
    }

    console.log("[DEBUG] ✅ Authorized manager. Initializing dashboard...");
    setupEventListeners();
    await switchView('pending');
  } catch (error) {
    console.error("[DEBUG] Auth error:", error);
    redirectToLogin();
  }
});

function redirectToLogin() {
  if (!location.pathname.includes("login")) {
    window.location.href = "/login.html";
  }
}

function setupEventListeners() {
  logoutButton?.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  });

  navPending?.addEventListener("click", (e) => {
    e.preventDefault();
    switchView('pending');
  });

  navFixQueue?.addEventListener("click", (e) => {
    e.preventDefault();
    switchView('fix');
  });

  const mainContentArea = document.querySelector('main');
  if (mainContentArea) {
    mainContentArea.addEventListener('click', handleActionClick);
  }
}

// --- View Switching ---
async function switchView(viewType) {
  currentView = viewType;

  navPending?.classList.toggle('bg-blue-100', viewType === 'pending');
  navPending?.classList.toggle('font-semibold', viewType === 'pending');
  navFixQueue?.classList.toggle('bg-blue-100', viewType === 'fix');
  navFixQueue?.classList.toggle('font-semibold', viewType === 'fix');

  if (viewType === 'pending') {
    fixContainer.classList.add('hidden');
    pendingContainer.classList.remove('hidden');
    await loadTickets('pending');
  } else {
    pendingContainer.classList.add('hidden');
    fixContainer.classList.remove('hidden');
    await loadTickets('fix');
  }
}

// --- Load Tickets ---
async function loadTickets(viewType) {
  const targetContainer = viewType === 'pending' ? pendingContainer : fixContainer;
  if (!targetContainer) return;

  targetContainer.innerHTML = `<p class="text-gray-500 text-sm text-center p-4">Loading ${viewType} tickets...</p>`;

  try {
    const ticketsRef = collection(db, "tickets");
    const q = query(ticketsRef, where("status", "==", viewType === 'pending' ? "pending" : "rejected"));
    const snapshot = await getDocs(q);
    targetContainer.innerHTML = "";

    if (snapshot.empty) {
      targetContainer.innerHTML = `<p class="text-gray-500 text-sm text-center p-4">No tickets in ${viewType === 'pending' ? 'pending' : 'fix'} queue.</p>`;
      return;
    }

    const fragment = document.createDocumentFragment();
    snapshot.forEach((docSnap) => {
      const ticket = docSnap.data();
      const id = docSnap.id;
      if (!ticket) return;
      const card = createTicketCard(id, ticket);
      fragment.appendChild(card);
    });

    targetContainer.appendChild(fragment);
  } catch (err) {
    console.error(`[DEBUG] Load error:`, err);
    targetContainer.innerHTML = `<p class="text-red-600 text-sm text-center p-4">Error loading ${viewType} tickets.</p>`;
  }
}

// --- Create Card ---
function createTicketCard(id, ticket) {
  const card = document.createElement("div");
  card.dataset.ticketId = id;
  card.className = "bg-white border border-gray-200 rounded p-4 shadow space-y-2 ticket-card";

  const ticketNum = ticket.ticketNumber ?? "N/A";
  const uploader = ticket.uploaderEmail ?? "N/A";
  const status = ticket.status ?? "Unknown";

  card.innerHTML = `
    <p class="text-sm"><span class="font-semibold">Ticket #:</span> ${ticketNum}</p>
    <p class="text-sm"><span class="font-semibold">Uploader:</span> ${uploader}</p>
    <p class="text-sm"><span class="font-semibold">Status:</span> <span class="font-medium">${status}</span></p>
    <div class="flex gap-2 pt-2 button-container">
      <button class="approveBtn text-xs bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded" data-id="${id}">Approve</button>
      <button class="rejectBtn text-xs bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded" data-id="${id}">Reject</button>
      <a href="./fix.html?id=${id}" class="editLink text-xs bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded">Edit</a>
    </div>
  `;

  return card;
}

// --- Approve / Reject Handlers ---
async function handleActionClick(event) {
  const button = event.target.closest("button");
  if (!button) return;

  const card = button.closest(".ticket-card");
  const id = button.dataset.id;
  if (!id || !card) return;

  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "...";

  try {
    const action = button.classList.contains("approveBtn") ? approveTicket : rejectTicket;
    await action({ ticketId: id });
    card.remove();
  } catch (err) {
    console.error(`[DEBUG] ${originalText} failed:`, err);
    alert(`Error: ${err.message || `Failed to ${originalText.toLowerCase()} ticket.`}`);
    button.disabled = false;
    button.textContent = originalText;
  }
}
