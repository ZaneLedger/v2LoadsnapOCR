// dashboard.js - Logic for the LoadSnap OCR Dashboard (v9 Modular)

// Import v9 modular Firestore functions and the initialized 'firestore' instance
import { firestore } from './firebase.js'; 
import { collection, query, where, orderBy, limit, getDocs, doc, updateDoc, serverTimestamp, Timestamp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
// Import auth if manager role check is needed
// import { auth } from './firebase.js'; 
// import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";

// --- DOM Elements ---
const ticketListContainer = document.getElementById('ticketList');
const loadingMessage = document.getElementById('loadingMessage');

// --- Functions ---

function showBanner(message, color = 'blue') {
  document.querySelectorAll('.feedback-banner').forEach(b => b.remove());
  const banner = document.createElement('div');
  let colorClasses = '';
  switch (color) {
    case 'green': colorClasses = 'bg-green-600'; break;
    case 'red': colorClasses = 'bg-red-600'; break;
    default: colorClasses = 'bg-blue-600'; break; 
  }
  banner.className = `feedback-banner fixed top-4 left-1/2 transform -translate-x-1/2 ${colorClasses} text-white px-6 py-2 rounded shadow-md z-50 transition-opacity duration-300`;
  banner.innerText = message;
  banner.style.opacity = 0; 
  document.body.appendChild(banner);
  void banner.offsetWidth; 
  banner.style.opacity = 1;
  setTimeout(() => {
    banner.style.opacity = 0;
    setTimeout(() => banner.remove(), 350); 
  }, 3000); 
}

function createTicketCard(ticketData) {
    const card = document.createElement('div');
    card.className = 'bg-white p-4 rounded shadow animate-fade-in'; 
    card.setAttribute('data-ticket-id', ticketData.id);

    let displayDate = 'N/A'; 
    // Handle Firestore Timestamp object (v9)
    if (ticketData.timestamp instanceof Timestamp) {
        displayDate = ticketData.timestamp.toDate().toLocaleDateString();
    } else if (ticketData.submittedAt instanceof Timestamp) { // Fallback field name
         displayDate = ticketData.submittedAt.toDate().toLocaleDateString();
    } else if (typeof ticketData.timestamp === 'string' || typeof ticketData.submittedAt === 'string') { // Handle potential string dates
        try { displayDate = new Date(ticketData.timestamp || ticketData.submittedAt).toLocaleDateString(); } catch(e){}
    }

    // Determine status display
    let statusText = ticketData.status || 'Unknown';
    let statusColor = 'text-gray-500'; // Default
    switch (statusText.toLowerCase()) {
        case 'pending': statusColor = 'text-yellow-600'; break;
        case 'approved': statusColor = 'text-green-600'; break;
        case 'rejected': statusColor = 'text-red-600'; break;
    }

    card.innerHTML = `
        <h2 class="text-xl font-semibold mb-2 truncate">Ticket #${ticketData.id}</h2>
        <p class="text-gray-600 mb-1 text-sm">Driver: ${ticketData.driverName || ticketData.uploaderEmail || 'N/A'}</p>
        <p class="text-gray-600 mb-3 text-sm">Submitted: ${displayDate}</p>
        <p class="text-sm font-medium mb-3 ${statusColor}">Status: ${statusText.charAt(0).toUpperCase() + statusText.slice(1)}</p> 
        <div class="flex gap-2 mt-4">
            <button data-action="approve" class="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded w-full transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed">
                Approve
            </button>
            <button data-action="reject" class="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded w-full transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed">
                Reject
            </button>
            </div>
    `;
    return card;
}


/**
 * Fetches pending tickets from Firestore using v9 modular syntax.
 */
async function loadPendingTickets() {
    if (!firestore) {
        console.error("Firestore is not initialized!");
        if(loadingMessage) loadingMessage.innerText = 'Error: Firestore connection failed.';
        showBanner("Error connecting to the database.", "red");
        return;
    }
    // Optional: Add auth check if only managers should see this
    // if (!auth?.currentUser) { ... } 

    if(loadingMessage) loadingMessage.innerText = 'Loading tickets...';
    if(ticketListContainer) ticketListContainer.innerHTML = ''; // Clear previous tickets
    if(ticketListContainer && loadingMessage) ticketListContainer.appendChild(loadingMessage); 

    try {
        // Define the collection reference using v9 modular collection()
        const ticketsCollectionRef = collection(firestore, 'tickets'); // Adjust if needed

        // Create a query using v9 modular query(), where(), orderBy(), limit()
        const q = query(
            ticketsCollectionRef, 
            where('status', '==', 'pending'), // Example filter
            orderBy('timestamp', 'desc'),     // Example ordering
            limit(50)                         // Example limit
        );

        // Execute the query using v9 modular getDocs()
        const querySnapshot = await getDocs(q);

        if(loadingMessage) loadingMessage.remove(); 

        if (querySnapshot.empty) {
            if(ticketListContainer) ticketListContainer.innerHTML = '<p class="text-gray-600 text-center md:col-span-2 lg:col-span-3">No pending tickets found.</p>';
            return;
        }

        querySnapshot.forEach((docSnap) => { // docSnap is the DocumentSnapshot
            const ticketData = { id: docSnap.id, ...docSnap.data() };
            const card = createTicketCard(ticketData);
            if(ticketListContainer) ticketListContainer.appendChild(card);
        });

    } catch (error) {
        console.error("Error loading tickets (v9):", error);
        if(loadingMessage) loadingMessage.innerText = 'Error loading tickets.';
         if (error.code === 'permission-denied') {
             showBanner("Permission denied. Check Firestore rules.", "red");
        } else if (error.code === 'failed-precondition') {
             showBanner("Query requires an index. Check Firestore console.", "red");
        } else {
            showBanner("Failed to load tickets. Please try again.", "red");
        }
    }
}


/**
 * Handles clicks on the 'Approve' or 'Reject' buttons using v9 modular syntax.
 * @param {Event} event - The click event object.
 */
async function handleTicketAction(event) {
    const button = event.target.closest('button[data-action]'); 
    if (!button) return; 

    const action = button.getAttribute('data-action');
    const card = button.closest('[data-ticket-id]');
    if (!card || !action || (action !== 'approve' && action !== 'reject')) return; 

    const ticketId = card.getAttribute('data-ticket-id');
    const approveButton = card.querySelector('[data-action="approve"]');
    const rejectButton = card.querySelector('[data-action="reject"]');

    // Disable buttons immediately
    if(approveButton) approveButton.disabled = true;
    if(rejectButton) rejectButton.disabled = true;
    button.classList.add('opacity-75', 'cursor-wait'); 

    try {
        if (!firestore) {
            throw new Error("Firestore not initialized");
        }
        // Get a document reference using v9 modular doc()
        const ticketDocRef = doc(firestore, 'tickets', ticketId); // Adjust collection name if needed

        let newStatus = '';
        if (action === 'approve') {
            newStatus = 'approved';
            // Update document using v9 modular updateDoc() and serverTimestamp()
            await updateDoc(ticketDocRef, { 
                status: newStatus, 
                processedAt: serverTimestamp() // v9 syntax
            }); 
            
            // Update UI 
            if(approveButton) approveButton.innerText = "Approved";
            if(approveButton) approveButton.classList.remove('bg-green-600', 'hover:bg-green-700');
            if(approveButton) approveButton.classList.add('bg-gray-400'); 
            showBanner(`Ticket #${ticketId} approved successfully.`, "green");
            
        } else { // action === 'reject'
            newStatus = 'rejected';
             // Update document using v9 modular updateDoc() and serverTimestamp()
            await updateDoc(ticketDocRef, { 
                status: newStatus, 
                processedAt: serverTimestamp() // v9 syntax
            }); 
            
            // Update UI 
            if(rejectButton) rejectButton.innerText = "Rejected";
            if(rejectButton) rejectButton.classList.remove('bg-red-600', 'hover:bg-red-700');
            if(rejectButton) rejectButton.classList.add('bg-gray-400'); 
            showBanner(`Ticket #${ticketId} rejected.`, "red");
            // Consider adding navigation to fix.html?id=ticketId here
            // window.location.href = `fix.html?id=${ticketId}`; 
        }

    } catch (error) {
        console.error(`Error ${action}ing ticket ${ticketId} (v9):`, error);
        showBanner(`Error: Failed to ${action} ticket. ${error.message}`, "red");
        // Re-enable buttons ONLY if the Firestore call failed
        if(approveButton) approveButton.disabled = false;
        if(rejectButton) rejectButton.disabled = false;
    } finally {
         // Always remove busy indicator
         button.classList.remove('opacity-75', 'cursor-wait');
    }
}


// --- Event Listeners ---

if (ticketListContainer) {
    ticketListContainer.addEventListener('click', handleTicketAction);
}

// Load tickets when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', loadPendingTickets);
