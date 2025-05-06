import { auth, db, storage } from "./firebase.js";
import {
  onAuthStateChanged,
  getIdTokenResult
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import {
  ref,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js";
import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-functions.js";

const ticketId = new URLSearchParams(window.location.search).get("id");
const functions = getFunctions();
const saveTicketFix = httpsCallable(functions, 'saveTicketFix');
const rejectTicket = httpsCallable(functions, 'rejectTicket');

const form = document.getElementById("fixForm");
const loading = document.getElementById("loading");
const errorBox = document.getElementById("error");
const successBox = document.getElementById("success");
const discardBtn = document.getElementById("discardBtn");
const ticketNumberElem = document.getElementById("ticketNumber");
const weightInput = document.getElementById("weightTons");
const truckInput = document.getElementById("truckNumber");
const driverInput = document.getElementById("driverActual");
const imageWrapper = document.getElementById("imageWrapper");
const ticketImg = document.getElementById("ticketImage");

if (!ticketId) location.href = "/manager_dashboard.html";

onAuthStateChanged(auth, async (user) => {
  if (!user) return location.href = "/login.html";
  const { claims } = await getIdTokenResult(user, true);
  if (!["manager","admin"].includes(claims.role)) {
    errorBox.textContent = "Access Denied.";
    errorBox.classList.remove("hidden");
    return;
  }
  loadTicketData();
});

async function loadTicketData() {
  loading.classList.remove("hidden");
  form.classList.add("hidden");
  try {
    const snap = await getDoc(doc(db,"tickets",ticketId));
    if (!snap.exists()) throw new Error("Not found");
    const data = snap.data();
    ticketNumberElem.value = data.ticketNumber||ticketId;
    weightInput.value = data.weightTons||"";
    truckInput.value = data.truckNumber||"";
    driverInput.value = data.driverActual||"";
    if (data.storagePath){
      const url = await getDownloadURL(ref(storage,data.storagePath));
      ticketImg.src = url;
      imageWrapper.classList.remove("hidden");
    }
    loading.classList.add("hidden");
    form.classList.remove("hidden");
  } catch(e){
    loading.classList.add("hidden");
    errorBox.textContent = e.message;
    errorBox.classList.remove("hidden");
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  successBox.classList.add("hidden");
  errorBox.classList.add("hidden");
  try {
    const payload = {
      ticketId,
      updates: {
        weightTons: parseFloat(weightInput.value)||null,
        truckNumber: truckInput.value.trim()||null,
        driverActual: driverInput.value.trim()||null
      }
    };
    const res = await saveTicketFix(payload);
    successBox.textContent = res.data.message||"Ticket updated.";
    successBox.classList.remove("hidden");
    setTimeout(()=>window.location.href="manager_dashboard.html",1500);
  } catch(err){
    errorBox.textContent = err.message;
    errorBox.classList.remove("hidden");
  }
});

discardBtn.addEventListener("click", async () => {
  if (!confirm("Reject this ticket?")) return;
  try {
    await rejectTicket({ ticketId });
    window.location.href = "manager_dashboard.html";
  } catch(err){
    alert("Reject failed: "+err.message);
  }
});
