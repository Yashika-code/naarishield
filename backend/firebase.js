import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

let firebaseInitialized = false;
let firestoreDb = null;
let firebaseAuth = null;
let initError = null;

try {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    // Unescape newlines if needed
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey
        })
      });
    }

    firestoreDb = admin.firestore();
    firebaseAuth = admin.auth();
    firebaseInitialized = true;
    console.log(`[Firebase Admin] Successfully connected to Firebase project: ${projectId}`);
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault()
      });
    }
    firestoreDb = admin.firestore();
    firebaseAuth = admin.auth();
    firebaseInitialized = true;
    console.log('[Firebase Admin] Connected using GOOGLE_APPLICATION_CREDENTIALS');
  } else {
    initError = 'Firebase credentials not supplied in environment. Running in Demo/Mock fallback mode.';
    console.log(`[Firebase Admin] Notice: ${initError}`);
  }
} catch (err) {
  initError = err.message;
  console.warn('[Firebase Admin] Initialization failed:', err.message);
}

export { admin, firestoreDb, firebaseAuth, firebaseInitialized, initError };
