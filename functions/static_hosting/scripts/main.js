// scripts/main.js

// 3Check Discipline: Stackzilla v2

document.addEventListener('DOMContentLoaded', () => {
  const assignBtn = document.getElementById('assignBtn');
  const uidInput = document.getElementById('uid');
  const statusMessage = document.getElementById('statusMessage');

  assignBtn.addEventListener('click', () => {
    const uid = uidInput.value.trim();

    if (!uid) {
      showStatus('Please enter a Firebase UID.', 'error');
      return;
    }

    assignBtn.disabled = true;
    showStatus('Processing...', 'info');

    // =========================
    // TODO: Inject real fetch logic here (Flux Task)
    // =========================

    console.log(`Attempting to assign manager role for UID: ${uid}`);
    setTimeout(() => {
      // Simulated dummy success
      showStatus('Manager role assigned successfully.', 'success');
      assignBtn.disabled = false;
    }, 1000);
  });

  function showStatus(message, type) {
    statusMessage.classList.remove('hidden', 'text-green-600', 'text-red-600', 'text-blue-600', 'bg-green-100', 'bg-red-100', 'bg-blue-100');

    switch (type) {
      case 'success':
        statusMessage.classList.add('text-green-600', 'bg-green-100', 'p-2', 'rounded');
        break;
      case 'error':
        statusMessage.classList.add('text-red-600', 'bg-red-100', 'p-2', 'rounded');
        break;
      case 'info':
      default:
        statusMessage.classList.add('text-blue-600', 'bg-blue-100', 'p-2', 'rounded');
        break;
    }

    statusMessage.textContent = message;
  }
});
