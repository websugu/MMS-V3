// js/firebase.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDuTtwVyvfidOwjzltlRUTOSYYaLtC_G1c",
  authDomain: "mmsp-b7835.firebaseapp.com",
  projectId: "mmsp-b7835",
  appId: "1:793727393765:web:8b9813288c6eaabb27590c"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);