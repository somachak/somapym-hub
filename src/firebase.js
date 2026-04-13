import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyD2ulVf4M8_u9xBksCyk45hKV-Kz6uyW5Y",
  authDomain: "cosmetic-ai-assistant.firebaseapp.com",
  projectId: "cosmetic-ai-assistant",
  storageBucket: "cosmetic-ai-assistant.firebasestorage.app",
  messagingSenderId: "265928858202",
  appId: "1:265928858202:web:c47bbf5c38b151007d9663",
  measurementId: "G-TBRR5JT93V"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

googleProvider.addScope('profile');
googleProvider.addScope('email');

export default app;
