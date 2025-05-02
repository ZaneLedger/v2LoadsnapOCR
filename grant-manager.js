const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json"); // Make sure this file is in the same folder

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// 🔁 Replace this with your real UID if different
const targetUid = "nVd3eJrI6KVrIVVciPxLs1vZxfj1";

admin.auth().setCustomUserClaims(targetUid, { manager: true })
  .then(() => {
    console.log(`✅ Manager role assigned to UID: ${targetUid}`);
  })
  .catch((error) => {
    console.error("❌ Error setting custom claim:", error);
  });
