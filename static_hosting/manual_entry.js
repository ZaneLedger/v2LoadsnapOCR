// manual_entry.js - Logic for the Manual Ticket Entry form (v9 Modular)

// Import v9 modular Firestore functions and the initialized 'firestore' instance
import { firestore } from './firebase.js'; 
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
// Import auth if needed to associate entry with logged-in user
// import { auth } from './firebase.js'; 

document.addEventListener('DOMContentLoaded', function() {
  
  // --- DOM Elements ---
  const form = document.getElementById('manualEntryForm');
  const submitButton = document.getElementById('submitButton');
  const statusMessage = document.getElementById('statusMessage'); 

  // Input fields 
  const ticketNumInput = document.getElementById('ticketNum');
  const driverNameInput = document.getElementById('driverName');
  const disposalDateInput = document.getElementById('disposalDate');
  const debrisTypeInput = document.getElementById('debrisType');
  // const tonsHauledInput = document.getElementById('tonsHauled'); // Example

  // --- Functions ---

  function showStatusMessage(message, type = 'info') {
    if (!statusMessage) return; 

    statusMessage.textContent = message;
    statusMessage.className = 'text-sm text-center h-5 mt-4 font-medium'; // Reset base classes
    
    switch (type) {
      case 'success':
        statusMessage.classList.add('text-green-600');
        break;
      case 'error':
        statusMessage.classList.add('text-red-600');
        break;
      case 'info':
      default:
         statusMessage.classList.add('text-gray-600');
         break;
    }
    // Clear message after a delay
    setTimeout(() => {
       if (statusMessage.textContent === message) { 
           statusMessage.textContent = '';
           statusMessage.className = 'text-sm text-center h-5 mt-4 font-medium'; 
       }
    }, 5000); // Clear after 5 seconds
  }

  /**
   * Handles the form submission event using v9 modular syntax.
   * @param {Event} event - The submit event object.
   */
  async function handleFormSubmit(event) {
    event.preventDefault(); 
    
    if (!submitButton) return; 

    // Disable button and show processing state
    submitButton.disabled = true;
    submitButton.innerText = 'Submitting...';
    showStatusMessage('Processing your submission...', 'info');

    // Get trimmed values from inputs
    const ticketNum = ticketNumInput.value.trim();
    const driverName = driverNameInput.value.trim();
    const disposalDate = disposalDateInput.value.trim();
    const debrisType = debrisTypeInput.value.trim();
    // const tonsHauled = parseFloat(tonsHauledInput.value) || null; // Example

    // Basic Validation 
    if (!ticketNum || !driverName || !disposalDate || !debrisType) {
      showStatusMessage("Please fill out all required fields.", "error");
      submitButton.disabled = false; 
      submitButton.innerText = 'Submit Ticket';
      // Focus the first empty required field (optional enhancement)
      if (!ticketNum) ticketNumInput.focus();
      else if (!driverName) driverNameInput.focus();
      else if (!disposalDate) disposalDateInput.focus();
      else if (!debrisType) debrisTypeInput.focus();
      return;
    }

    // Prepare data for Firestore
    const ticketData = {
      ticketNum: ticketNum,
      driverName: driverName,
      disposalDate: disposalDate, // Saving as string from date input
      debrisType: debrisType,
      // tonsHauled: tonsHauled, // Example
      source: 'manual', // Indicate the source
      status: 'pending', // Set an initial status
      submittedAt: serverTimestamp() // Use v9 modular serverTimestamp()
      // Add submittedByUid: auth.currentUser.uid if auth is required and imported
    };

    // --- Firestore Interaction (v9 Modular) ---
    if (!firestore) {
        showStatusMessage("Database connection error.", "error");
        console.error("Firestore instance is not available.");
        submitButton.disabled = false;
        submitButton.innerText = 'Submit Ticket';
        return;
    }

    try {
      // Use v9 modular collection() and addDoc()
      const ticketsCollectionRef = collection(firestore, 'tickets'); // Adjust collection name if needed
      const docRef = await addDoc(ticketsCollectionRef, ticketData); 
      
      console.log("Document written with ID: ", docRef.id);
      showStatusMessage("Ticket submitted successfully!", "success");
      form.reset(); // Clear the form fields

    } catch (error) {
      console.error("Error adding document (v9): ", error);
      showStatusMessage(`Error submitting ticket: ${error.message}`, "error");
    
    } finally {
      // Always re-enable the button and reset text
      submitButton.disabled = false;
      submitButton.innerText = 'Submit Ticket';
    }
  }

  // --- Event Listeners ---
  if (form) {
    form.addEventListener('submit', handleFormSubmit);
  } else {
    console.error("Manual entry form not found!");
  }

}); // End DOMContentLoaded