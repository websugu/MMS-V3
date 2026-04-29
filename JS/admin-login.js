import { auth } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { ADMIN_WHITELIST } from './admin-whitelist.js';

const form = document.getElementById('admin-login-form');
const btn = document.getElementById('login-btn');
const errorDiv = document.getElementById('error-message');

// Check if already logged in and is admin
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const isAdmin = checkAdmin(user.uid);
    if (isAdmin) {
      window.location.href = 'admin.html';
    } else {
      await auth.signOut();
    }
  }
});

function checkAdmin(uid) {
  return ADMIN_WHITELIST.includes(uid);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('admin-email').value.trim();
  const password = document.getElementById('admin-password').value.trim();

  btn.disabled = true;
  btn.textContent = 'Logging in...';
  errorDiv.style.display = 'none';

  try {
    // Step 1: Sign in with email/password
    const userCredential = await signInWithEmailAndPassword(auth, email, password);

    // Step 2: Verify admin privileges
    const user = userCredential.user;
    const isAdmin = checkAdmin(user.uid);
    if (!isAdmin) {
      await auth.signOut();
      throw new Error(
        'Admin access required. Your account is not authorized. ' +
        'Add your UID to JS/admin-whitelist.js to grant access.'
      );
    }

    // Access granted
    window.location.href = 'admin.html';
  } catch (error) {
    await auth.signOut();
    errorDiv.textContent = error.message;
    errorDiv.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Admin Login';
  }
});

