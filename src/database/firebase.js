import { initializeApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
};

// Check if credentials are placeholders or empty
export const isFirebaseConfigured = 
  firebaseConfig.apiKey && 
  firebaseConfig.projectId && 
  !firebaseConfig.apiKey.includes('your-') &&
  firebaseConfig.apiKey !== "";

export const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;
export const db = isFirebaseConfigured 
  ? initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true
    }) 
  : null;
