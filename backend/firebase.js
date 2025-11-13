const admin = require("firebase-admin");
require("dotenv").config();

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

const bucket = admin.storage().bucket();

async function uploadEncryptedRecord(recordId, encryptedData) {
  const file = bucket.file(`records/${recordId}.enc`);
  await file.save(encryptedData, {
    contentType: "text/plain",
  });
  // Signed URL (limited-time access if you want)
  const [url] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + 1000 * 60 * 60, // 1 hour
  });
  return url;
}

module.exports = { uploadEncryptedRecord };
