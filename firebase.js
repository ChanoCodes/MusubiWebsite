import { initializeApp } from 
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from 
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from 
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD3lFUmT__UtzK8Bduou0tQ-qh58Gf4h-c",
  authDomain: "musubi-ordering-system.firebaseapp.com",
  projectId: "musubi-ordering-system",
  storageBucket: "musubi-ordering-system.firebasestorage.app",
  messagingSenderId: "1075484312630",
  appId: "1:1075484312630:web:2016fa060651eec245c497"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
