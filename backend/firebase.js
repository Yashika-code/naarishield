import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
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
  const databaseURL = process.env.FIREBASE_DATABASE_URL;

  if (projectId && clientEmail && privateKey) {
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    const apps = getApps();
    let app;
    if (!apps.length) {
      app = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey
        }),
        ...(databaseURL ? { databaseURL } : {})
      });
    } else {
      app = apps[0];
    }

    firestoreDb = getFirestore(app);
    firebaseAuth = getAuth(app);
    firebaseInitialized = true;
    console.log(`[Firebase Admin] Successfully connected to Firebase project: ${projectId}`);
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const apps = getApps();
    let app;
    if (!apps.length) {
      app = initializeApp({
        credential: applicationDefault(),
        ...(databaseURL ? { databaseURL } : {})
      });
    } else {
      app = apps[0];
    }
    firestoreDb = getFirestore(app);
    firebaseAuth = getAuth(app);
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

export { firestoreDb, firebaseAuth, firebaseInitialized, initError };
