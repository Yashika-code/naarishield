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
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDemoKeyMockForSafeFallback",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "narishield-safe.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "narishield-safe",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "narishield-safe.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1029384756",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1029384756:web:abcdef123456"
};

export const isFirebaseConfigured = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY && 
  import.meta.env.VITE_FIREBASE_PROJECT_ID &&
  !import.meta.env.VITE_FIREBASE_API_KEY.includes('DemoKeyMock')
);

let app: FirebaseApp;
let auth: Auth;

try {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
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
