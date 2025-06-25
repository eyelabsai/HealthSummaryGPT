// Firebase configuration for OpenCare
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCS1uCc61ocGY4PwDqK1Ky0FPIWnTBcAAs",
  authDomain: "opencare-f76c3.firebaseapp.com",
  projectId: "opencare-f76c3",
  storageBucket: "opencare-f76c3.appspot.com",
  messagingSenderId: "558558826935",
  appId: "1:558558826935:web:d3373c94fb2c20e81f5832",
  measurementId: "G-SQW3Q4L3HK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore Database
export const db = getFirestore(app);

// Initialize Firebase Authentication
export const auth = getAuth(app);

export default app;
