import admin from "firebase-admin";
import config from "./config.js"; // Import from config.js
import fs from "fs";

// Load Firebase credentials from JSON
const serviceAccount = JSON.parse(fs.readFileSync(config.firebaseServiceAccount, "utf-8"));

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export const db = admin.firestore(); // Firestore instance
console.log("✅ Firebase connected successfully!");
