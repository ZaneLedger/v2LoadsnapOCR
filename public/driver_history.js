// driver_history.js - Logic for the LoadSnap OCR Driver History Page (v9 Modular)

// Import v9 modular functions and initialized services
import { auth, firestore, storage } from './firebase.js'; 
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js";

// --- DOM Elements ---
const ticketListContainer = document.getElementById('driverTicketList');
const loadingMessage = document.getElementById('loadingMessage');
const logoutButton = document.getElementById('logoutButton');

// --- Utility Functions ---

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

function createDriverTicketCard(ticketData) {
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

    let statusText = ticketData.status || 'Unknown';
    let statusColor = 'text-gray-500'; 
    switch (statusText.toLowerCase()) {
        case 'pending': statusColor = 'text-yellow-600'; break;
        case 'approved': statusColor = 'text-green-600'; break;
        case 'rejected': statusColor = 'text-red-600'; break;
        // Add more statuses if needed (e.g., 'processing', 'fixed')
    }

    card.innerHTML = `
        <h2 class="text-lg font-semibold mb-2 truncate">Ticket #${ticketData.id}</h2>
        <p class="text-gray-600 mb-1 text-sm">Submitted: ${displayDate}</p>
        <p class="text-sm font-medium mb-3 ${statusColor}">Status: ${statusText.charAt(0).toUpperCase() + statusText.slice(1)}</p> 
        ${ticketData.storagePath ? // Check if storagePath exists
            `<a href="#" data-image-path="${ticketData.storagePath}" class="view-image-link block mt-3 text-blue-600 hover:underline text-sm">View Ticket Image</a>` 
            : '<p class="text-sm text-gray-400 mt-3">No image associated</p>'
        }
    `;
    return card;
}

/**
 * Fetches tickets submitted by the currently logged-in driver using v9 modular syntax.
 * @param {string} driverUid - The Firebase Authentication UID of the driver.
 */
async function loadDriverTickets(driverUid) {
    if (!firestore) {
        console.error("Firestore is not initialized!");
        if(loadingMessage) loadingMessage.innerText = 'Error: Firestore connection failed.';
        showBanner("Error connecting to the database.", "red");
        return;
    }
    if (!driverUid) {
        console.error("Driver UID is missing!");
        if(loadingMessage) loadingMessage.innerText = 'Error: Could not identify driver.';
         showBanner("Authentication error.", "red");
        return;
    }

    if(loadingMessage) loadingMessage.innerText = 'Loading your tickets...';
    if(ticketListContainer) ticketListContainer.innerHTML = ''; // Clear previous tickets
    if(ticketListContainer && loadingMessage) ticketListContainer.appendChild(loadingMessage); 

    try {
        // Define collection reference using v9 modular collection()
        const ticketsCollectionRef = collection(firestore, 'tickets'); // Adjust if needed

        // Create query using v9 modular query(), where(), orderBy(), limit()
        // IMPORTANT: Adjust 'uploaderUid' to match the actual field name storing the driver's UID
        const q = query(
            ticketsCollectionRef, 
            where('uploaderUid', '==', driverUid), // Filter by driver UID
            orderBy('timestamp', 'desc'),        // Order by submission time
            limit(50)                            // Limit results
        );

        // Execute query using v9 modular getDocs()
        const querySnapshot = await getDocs(q);

        if(loadingMessage) loadingMessage.remove(); 

        if (querySnapshot.empty) {
            if(ticketListContainer) ticketListContainer.innerHTML = '<p class="text-gray-600 text-center md:col-span-2 lg:col-span-3">You have not submitted any tickets yet.</p>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const ticketData = { id: docSnap.id, ...docSnap.data() }; 
            const card = createDriverTicketCard(ticketData);
            if(ticketListContainer) ticketListContainer.appendChild(card);
        });

    } catch (error) {
        console.error("Error loading driver tickets (v9):", error);
        if(loadingMessage) loadingMessage.innerText = 'Error loading your tickets.';
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
 * Handles clicks on the "View Ticket Image" links using v9 modular syntax.
 * Fetches a temporary download URL from Firebase Storage.
 * @param {Event} event - The click event object.
 */
async function handleViewImageClick(event) {
    const link = event.target.closest('a.view-image-link');
    if (!link) return; 

    event.preventDefault(); 
    const imagePath = link.getAttribute('data-image-path');
    if (!imagePath) {
        showBanner("Image path not found.", "red");
        return;
    }

    if (!storage) {
         showBanner("Storage service not available.", "red");
         return;
    }

    link.innerText = 'Loading image...';
    link.style.pointerEvents = 'none'; 

    try {
        // Get reference using v9 modular ref()
        const imageRef = ref(storage, imagePath);
        // Get download URL using v9 modular getDownloadURL()
        const downloadURL = await getDownloadURL(imageRef); 

        // Open the image URL in a new tab
        window.open(downloadURL, '_blank');

        link.innerText = 'View Ticket Image'; // Reset link text

    } catch (error) {
        console.error("Error getting download URL (v9):", error);
         let message = "Could not load image.";
         if (error.code === 'storage/object-not-found') {
             message = "Image file not found in storage.";
         } else if (error.code === 'storage/unauthorized') {
             message = "Permission denied to view image.";
         }
        showBanner(message, "red");
        link.innerText = 'Error loading image'; 
    } finally {
         link.style.pointerEvents = 'auto'; // Re-enable link
    }
}

/**
 * Handles user logout using v9 modular syntax.
 */
async function handleLogout() {
    if (!auth) {
        console.error("Auth service not initialized.");
        return;
    }
    try {
        // Use v9 modular signOut()
        await signOut(auth);
        showBanner("Logged out successfully.", "green");
        // Redirect handled by onAuthStateChanged listener
    } catch (error) {
        console.error("Logout failed (v9):", error);
        showBanner("Logout failed. Please try again.", "red");
    }
}


// --- Initialization and Auth Handling (v9 Modular) ---

if (auth) {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // User is signed in.
            if(loadingMessage) loadingMessage.innerText = `Welcome! Loading tickets...`;
            if(logoutButton) logoutButton.classList.remove('hidden'); // Show logout button
            loadDriverTickets(user.uid); // Load tickets for the logged-in user
        } else {
            // User is signed out.
            if(loadingMessage) loadingMessage.innerText = 'You are not logged in. Redirecting...';
            if(ticketListContainer) ticketListContainer.innerHTML = ''; // Clear content
            if(logoutButton) logoutButton.classList.add('hidden'); // Hide logout button
            showBanner("Please log in to view your history.", "red");
            // Redirect to login page 
            setTimeout(() => { window.location.href = 'index.html'; }, 2000); 
        }
    });
} else {
     if(loadingMessage) loadingMessage.innerText = 'Authentication service unavailable.';
     console.error("Auth service not initialized for page load check.");
}

// --- Event Listeners ---

if (ticketListContainer) {
    ticketListContainer.addEventListener('click', handleViewImageClick);
}

if (logoutButton) {
    logoutButton.addEventListener('click', handleLogout);
}
