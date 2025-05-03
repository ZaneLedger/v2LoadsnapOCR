import { auth } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-functions.js";

// DOM references
const logoutButton = document.getElementById("logoutButton");

// Firebase functions setup
const functions = getFunctions();
const verifyManagerRole = httpsCallable(functions, 'verifyManagerRole');

// Auth & Role Check
onAuthStateChanged(auth, async (user) => {
  console.log("Auth state changed, current user:", user);

  if (!user) {
    console.log("No user found, redirecting...");
    return redirectToLogin();
  }

  try {
    // 🔄 Force ID token refresh to avoid stale claims
    const idTokenResult = await user.getIdTokenResult(true);
    console.log("Current token claims:", idTokenResult.claims);

    // ✅ Debug: optionally show an alert with the current role
    if (!idTokenResult.claims.role || (idTokenResult.claims.role !== "manager" && idTokenResult.claims.role !== "admin")) {
      console.warn("Missing or invalid role claim. Redirecting.");
      return redirectToLogin();
    }

    // ✅ Proceed to verify via callable (defense-in-depth)
    const result = await verifyManagerRole();
    console.log("Role verification result:", result);

    if (result.data.message !== 'User is a manager') {
      console.warn("Cloud Function says user is not a manager. Redirecting.");
      return redirectToLogin();
    }

    console.log("✅ Access granted to Manager Dashboard");
    await loadCounts();
    await loadPendingTickets();

  } catch (err) {
    console.error("Auth/Role check error:", err);
    return redirectToLogin();
  }
});

// Logout button functionality
logoutButton?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login.html";
});

// Redirect handler
function redirectToLogin() {
  console.log("Redirecting to login...");
  window.location.href = "/login.html";
}

// Dashboard logic (placeholder for now)
async function loadCounts() {
  console.log("Loading ticket counts...");
}

async function loadPendingTickets() {
  console.log("Loading pending tickets...");
}
