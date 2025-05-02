const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

async function checkStoragePaths() {
  const snapshot = await db.collection('tickets').get();
  let missingCount = 0;

  snapshot.forEach(doc => {
    const data = doc.data();
    if (!data.storagePath) {
      missingCount++;
      console.log(\`Missing storagePath: \${doc.id}\`);
    }
  });

  if (missingCount === 0) {
    console.log('✅ All tickets have storagePath!');
  } else {
    console.log(\`❌ \${missingCount} tickets missing storagePath.\`);
  }
}

checkStoragePaths().catch(console.error);
