// fix.js - Logic for the LoadSnap OCR Fix Ticket Fields Page (v9 Modular)

// Import v9 modular Firestore functions and the initialized 'firestore' instance
import { firestore } from './firebase.js'; 
import { doc, getDoc, updateDoc, serverTimestamp, Timestamp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
// Import auth if manager login/permissions are needed
// import { auth } from './firebase.js'; 
// import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";

// --- DOM Elements ---
const fixForm = document.getElementById('fixForm');
const ticketIdInput = document.getElementById('ticketId');
const ticketIdDisplay = document.getElementById('ticketIdDisplay').querySelector('span'); 
const submitButton = document.getElementById('submitButton');
const loadingMessage = document.getElementById('loadingMessage');

// References to form fields (add all relevant fields from HTML)
const driverBadgeIdInput = document.getElementById('driverBadgeId');
const tonsHauledInput = document.getElementById('tonsHauled');
const disposalDateInput = document.getElementById('disposalDate');
const debrisTypeInput = document.getElementById('debrisType');
const ticketNumInput = document.getElementById('ticketNum'); 
const statusInput = document.getElementById('status'); 
// ... add other input elements here

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


/**
 * Fetches ticket data from Firestore using v9 modular syntax.
 * Populates the form fields with the fetched data.
 */
async function loadTicketData() {
    if(loadingMessage) loadingMessage.innerText = 'Loading ticket data...';
    if(fixForm) fixForm.style.opacity = 0; // Hide form while loading

    // 1. Get Ticket ID from URL query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const ticketId = urlParams.get('id');

    if (!ticketId) {
        if(loadingMessage) loadingMessage.innerText = 'Error: No Ticket ID specified in the URL.';
        showBanner("Cannot load ticket: Missing ID.", "red");
        return;
    }

    if (!firestore) {
        if(loadingMessage) loadingMessage.innerText = 'Error: Firestore connection failed.';
        showBanner("Error connecting to the database.", "red");
        return;
    }
     // Optional: Add auth check if only managers should access this
    // if (!auth?.currentUser) { ... } 

    if(ticketIdInput) ticketIdInput.value = ticketId; 
    if(ticketIdDisplay) ticketIdDisplay.innerText = ticketId; 

    try {
        // 2. Get document reference using v9 modular doc()
        const docRef = doc(firestore, 'tickets', ticketId); // Adjust collection name if needed
        
        // 3. Fetch the document using v9 modular getDoc()
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // 4. Populate form fields 
            if(driverBadgeIdInput) driverBadgeIdInput.value = data.driverBadgeId || ''; 
            if(tonsHauledInput) tonsHauledInput.value = data.tonsHauled || '';
            if(debrisTypeInput) debrisTypeInput.value = data.debrisType || '';
            if(ticketNumInput) ticketNumInput.value = data.ticketNum || ''; 
            if(statusInput) statusInput.value = data.status || 'pending'; // Default if status missing

            // Handle date field (Firestore timestamp vs. string)
            if (disposalDateInput) {
                if (data.disposalDate) {
                    let dateValue = '';
                    // Check if it's a Firestore Timestamp object
                    if (data.disposalDate instanceof Timestamp) { 
                        dateValue = data.disposalDate.toDate().toISOString().split('T')[0];
                    } else if (typeof data.disposalDate === 'string') {
                        // Attempt to parse if it's already a string date 
                        try { dateValue = new Date(data.disposalDate).toISOString().split('T')[0]; } catch(e){}
                    }
                    disposalDateInput.value = dateValue;
                } else {
                    disposalDateInput.value = '';
                }
            }

            // ... populate other fields ...

            if(loadingMessage) loadingMessage.innerText = ''; // Clear loading message
            if(fixForm) fixForm.style.opacity = 1; // Show form

        } else {
            // Document not found
            if(loadingMessage) loadingMessage.innerText = `Error: Ticket with ID ${ticketId} not found.`;
            showBanner("Ticket not found.", "red");
        }
    } catch (error) {
        console.error("Error loading ticket data (v9):", error);
        if(loadingMessage) loadingMessage.innerText = 'Error loading ticket data.';
        showBanner(`Error loading ticket: ${error.message}`, "red");
    }
}

/**
 * Handles the submission of the fix form using v9 modular syntax.
 * @param {Event} event - The form submission event.
 */
async function handleFormSubmit(event) {
    event.preventDefault(); 
    if (!submitButton || !ticketIdInput) return; 

    submitButton.disabled = true;
    submitButton.innerText = 'Saving...';
    // Optionally clear previous status message here

    const ticketId = ticketIdInput.value;
    if (!ticketId) {
        showBanner("Error: Ticket ID is missing.", "red");
        submitButton.disabled = false;
        submitButton.innerText = 'Save Changes';
        return;
    }

    // 1. Gather data from form fields
    const updatedData = {
        driverBadgeId: driverBadgeIdInput?.value.trim() || null,
        tonsHauled: parseFloat(tonsHauledInput?.value) || null, 
        disposalDate: disposalDateInput?.value || null, 
        debrisType: debrisTypeInput?.value.trim() || null,
        ticketNum: ticketNumInput?.value.trim() || null,
        status: statusInput?.value || 'pending_review', // Get selected status
        // ... gather other fields ...
        lastModifiedAt: serverTimestamp() // Use v9 modular serverTimestamp()
    };

    // 2. Basic Validation (optional, add more specific checks if needed)
    // Example: if (!updatedData.status) { ... error ... }

    // 3. Update Firestore document
    if (!firestore) {
        showBanner("Error: Firestore connection failed.", "red");
        submitButton.disabled = false;
        submitButton.innerText = 'Save Changes';
        return;
    }

    try {
        // Get document reference using v9 modular doc()
        const docRef = doc(firestore, 'tickets', ticketId); // Adjust collection name if needed
        
        // Update document using v9 modular updateDoc()
        await updateDoc(docRef, updatedData); 

        showBanner(`Ticket ${ticketId} updated successfully!`, "green");

        // Optional: Redirect back to dashboard after success
        setTimeout(() => { window.location.href = 'dashboard.html'; }, 1500);

    } catch (error) {
        console.error("Error updating ticket (v9):", error);
        showBanner(`Error updating ticket: ${error.message}`, "red");
    } finally {
        submitButton.disabled = false;
        submitButton.innerText = 'Save Changes';
    }
}


// --- Event Listeners ---

// Load data when the page is ready
document.addEventListener('DOMContentLoaded', loadTicketData);

// Handle form submission
if (fixForm) {
    fixForm.addEventListener('submit', handleFormSubmit);
} else {
    console.error("Fix form not found!");
}
