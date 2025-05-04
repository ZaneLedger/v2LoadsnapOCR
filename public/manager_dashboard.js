// public/manager.js (Efficient Firestore Query)

// Ensure firebase.js is correctly configured and working!
import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut,
  getIdTokenResult
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import {
  collection,
  query,
  where, // Keep where
  getDocs
  // Removed unused Firestore imports: doc, updateDoc, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-functions.js";

// --- DOM References ---
const logoutButton = document.getElementById("logoutButton");
const pendingContainer = document.getElementById("pendingContainer");
const fixContainer = document.getElementById("fixContainer");
// Add references for metrics cards if needed
// const pendingCountEl = document.getElementById("pendingCount");
// ... etc ...

// --- Firebase Functions ---
const functions = getFunctions();
const approveTicket = httpsCallable(functions, 'approveTicket');
const rejectTicket = httpsCallable(functions, 'rejectTicket');

// --- Auth Check ---
onAuthStateChanged(auth, async (user) => {
  if (!user) return redirectToLogin();

  try {
    const { claims } = await getIdTokenResult(user, true); // Force refresh
    const isAuthorized = claims.role === "manager" || claims.role === "admin" || claims.admin === true;

    if (!isAuthorized) {
        console.warn(`Authorization failed. Claims:`, claims, `. Redirecting.`);
        return redirectToLogin();
    }

    console.log("✅ Auth confirmed. Loading tickets...");
    await loadTickets();

  } catch (error) {
    console.error("Auth error:", error);
    redirectToLogin();
  }
});

// --- Redirect Helper ---
function redirectToLogin() {
  if (!location.pathname.includes("login")) {
    console.log(`Redirecting to /login.html from ${location.pathname}`);
    window.location.href = "/login.html";
  }
}

// --- Logout ---
logoutButton?.addEventListener("click", async () => {
  try {
    await signOut(auth);
    // onAuthStateChanged will handle redirect
  } catch (err) {
    console.error("Logout failed:", err);
  }
});

// --- Load Ticket Cards (Using Efficient Query) ---
async function loadTickets() {
  if (!pendingContainer || !fixContainer) {
    console.error("Ticket container elements not found.");
    return;
  }

  pendingContainer.innerHTML = `<p class="text-gray-500 text-sm text-center p-4">Loading pending tickets...</p>`;
  fixContainer.innerHTML = `<p class="text-gray-500 text-sm text-center p-4">Loading fix queue...</p>`;

  try {
    const ticketsRef = collection(db, "tickets");
    // *** UPDATED: Query only for relevant statuses ***
    // Adjust statuses ('pending', 'draft') or use 'fixNeeded' based on your actual data model
    const q = query(ticketsRef, where("status", "in", ["pending", "draft"]));
    // Example if using fixNeeded flag instead of 'draft' status:
    // const q = query(ticketsRef, where("status", "==", "pending")); // Get pending
    // const qFix = query(ticketsRef, where("fixNeeded", "==", true)); // Get fix needed separately

    const snapshot = await getDocs(q); // Execute the efficient query

    // Clear loading messages
    pendingContainer.innerHTML = "";
    fixContainer.innerHTML = "";

    let pendingFound = false;
    let fixFound = false;

    snapshot.forEach((docSnap) => {
      const ticket = docSnap.data();
      const id = docSnap.id;
      if (!ticket) return;

      const card = createTicketCard(id, ticket); // Use helper function

      // Place card in the correct container
      if (ticket.status === "pending") {
        pendingContainer.appendChild(card);
        pendingFound = true;
      } else if (ticket.status === "draft" || ticket.fixNeeded === true) { // Adjust this condition as needed
        fixContainer.appendChild(card);
        fixFound = true;
      }
    });

    // Display messages if sections are empty
    if (!pendingFound) {
      pendingContainer.innerHTML = `<p class="text-gray-500 text-sm text-center p-4">No tickets pending review.</p>`;
    }
    if (!fixFound) {
      fixContainer.innerHTML = `<p class="text-gray-500 text-sm text-center p-4">No tickets in fix queue.</p>`;
    }

    // Attach event listeners AFTER cards are in the DOM
    attachActions();

  } catch (err) {
    console.error("❌ Firestore load failed:", err);
    // Check for Firestore index errors specifically
    if (err.code === 'failed-precondition') {
        console.error("Firestore query failed. It might require an index. Check the error message for a link to create one in the Firebase console.");
        pendingContainer.innerHTML = `<p class="text-red-600 text-sm text-center p-4">Error loading tickets (Index required? Check console).</p>`;
        fixContainer.innerHTML = `<p class="text-red-600 text-sm text-center p-4">Error loading tickets (Index required? Check console).</p>`;
    } else {
        pendingContainer.innerHTML = `<p class="text-red-600 text-sm text-center p-4">Error loading pending tickets.</p>`;
        fixContainer.innerHTML = `<p class="text-red-600 text-sm text-center p-4">Error loading fix queue.</p>`;
    }
  }
}

// --- Helper Function to Create Ticket Card ---
function createTicketCard(id, ticket) {
    const card = document.createElement("div");
    card.className = "bg-white border border-gray-200 rounded p-4 shadow space-y-2 ticket-card";

    const ticketNum = ticket.ticketNumber ?? "N/A";
    const uploader = ticket.uploaderEmail ?? "N/A";
    const status = ticket.status ?? "Unknown";

    // Base card content
    let cardHTML = `
      <p class="text-sm"><span class="font-semibold">Ticket #:</span> ${ticketNum}</p>
      <p class="text-sm"><span class="font-semibold">Uploader:</span> ${uploader}</p>
      <p class="text-sm"><span class="font-semibold">Status:</span> <span class="font-medium">${status}</span></p>
      <div class="flex gap-2 pt-2 button-container">
        <button class="approveBtn text-xs bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded transition duration-150 ease-in-out" data-id="${id}">Approve</button>
        <button class="rejectBtn text-xs bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded transition duration-150 ease-in-out" data-id="${id}">Reject</button>
        <a href="./manual_entry.html?ticketId=${id}" class="editLink text-xs bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded transition duration-150 ease-in-out">Edit</a>
      </div>
    `;

    // Conditionally add "Fix This Ticket" link if needed (example)
    if (ticket.status === "draft" || ticket.fixNeeded === true) {
        // Example: Add it next to other buttons
        // cardHTML = cardHTML.replace('</div>', `<a href="fix.html?id=${id}" class="fixLink text-xs text-blue-600 hover:underline ml-2">Fix Details</a></div>`);
        // Or add it below
        // cardHTML += `<div class="pt-1"><a href="fix.html?id=${id}" class="fixLink text-xs text-blue-600 hover:underline">Fix Details</a></div>`;
    }

    card.innerHTML = cardHTML;
    return card;
}


// --- Action Handlers (Using HTTPS Callable Functions) ---
function attachActions() {
  // Use event delegation on containers
  pendingContainer?.addEventListener("click", handleActionClick);
  fixContainer?.addEventListener("click", handleActionClick);
}

async function handleActionClick(event) {
    const button = event.target.closest("button"); // Find the clicked button
    if (!button) return; // Exit if click wasn't on a button

    const card = button.closest(".ticket-card"); // Find the parent card
    const id = button.dataset.id;
    if (!id || !card) return; // Exit if no ID or card found

    // Prevent multiple clicks
    button.disabled = true;
    const originalText = button.textContent; // Store original text
    button.textContent = "...";

    try {
        let actionPromise;
        if (button.classList.contains("approveBtn")) {
            console.log("Calling approveTicket function for:", id);
            actionPromise = approveTicket({ ticketId: id });
        } else if (button.classList.contains("rejectBtn")) {
            console.log("Calling rejectTicket function for:", id);
            actionPromise = rejectTicket({ ticketId: id });
        } else {
            // Handle other buttons if needed, or ignore
            button.disabled = false; // Re-enable if not approve/reject
            button.textContent = originalText;
            return;
        }

        await actionPromise; // Wait for the function call to complete
        console.log(`Action ${originalText} successful for: ${id}`);
        card.remove(); // Remove card from UI on success

    } catch (err) {
        console.error(`Action ${originalText} failed for ticket ${id}:`, err);
        // Use a less disruptive error notification if possible
        const errorMsg = err.message || `Failed to ${originalText.toLowerCase()} ticket.`;
        alert(`Error: ${errorMsg}`); // Replace alert later if desired
        button.disabled = false; // Re-enable button on error
        button.textContent = originalText; // Reset text
    }
}
