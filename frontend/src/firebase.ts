import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile,
  type Auth,
  type User
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyB1Gx1Kz3wad6QF8oflT7rJkvj25QAFADI",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "naarishield.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "naarishield",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "naarishield.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "514862508534",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:514862508534:web:99295c355f7fc1b77bffd7",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-XM72CEE03F"
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && 
  firebaseConfig.projectId &&
  !firebaseConfig.apiKey.includes('DemoKeyMock')
);

let app: FirebaseApp;
let auth: Auth;

try {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  console.log(`[Firebase Client] Connected to project: ${firebaseConfig.projectId}`);
} catch (err) {
  console.warn('[Firebase Client] Init warning:', err);
}

export { 
  app, 
  auth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile,
  type User 
};
