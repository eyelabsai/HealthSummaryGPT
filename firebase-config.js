// Firebase configuration for OpenCare
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import admin from 'firebase-admin';

const firebaseConfig = {
  apiKey: "AIzaSyCS1uCc61ocGY4PwDqK1Ky0FPIWnTBcAAs",
  authDomain: "opencare-f76c3.firebaseapp.com",
  projectId: "opencare-f76c3",
  storageBucket: "opencare-f76c3.appspot.com",
  messagingSenderId: "558558826935",
  appId: "1:558558826935:web:d3373c94fb2c20e81f5832",
  measurementId: "G-SQW3Q4L3HK"
};

// Initialize Firebase Client SDK
const app = initializeApp(firebaseConfig);

// Initialize Firestore Database
export const db = getFirestore(app);

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Initialize Firebase Admin SDK for server-side operations
if (!admin.apps.length) {
  let adminConfig = {
    projectId: "opencare-f76c3",
    storageBucket: "opencare-f76c3.appspot.com"
  };

  // Try to load service account from environment or file
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    adminConfig.credential = admin.credential.cert(JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON));
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Uses the file path automatically
    adminConfig.credential = admin.credential.applicationDefault();
  }

  admin.initializeApp(adminConfig);
}

// Use Admin SDK for Storage
export const storage = admin.storage();

export default app;
