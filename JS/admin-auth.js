import { auth } from "./firebase.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";

import { ADMIN_WHITELIST } from './admin-whitelist.js';

// Helper: verify admin status via UID whitelist only
function verifyAdmin(uid) {
  return ADMIN_WHITELIST.includes(uid);
}

// Listen for auth changes - protect admin pages
onAuthStateChanged(auth, async (user) => {
  const currentPage = window.location.pathname.split('/').pop();

  // Pages that require authentication
  const authRequiredPages = ['admin-dashboard.html', 'admin.html'];

  // Not logged in -> send to login
  if (authRequiredPages.includes(currentPage) && !user) {
    window.location.href = 'admin-login.html';
    return;
  }

  // Logged in on a protected admin page -> verify admin privileges
  if (authRequiredPages.includes(currentPage) && user) {
    const isAdmin = verifyAdmin(user.uid);
    if (!isAdmin) {
      await signOut(auth);
      window.location.href = 'admin-login.html';
    }
  }
});

// Admin login function - checks UID whitelist only
window.adminLogin = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    const isAdmin = verifyAdmin(uid);
    if (!isAdmin) {
      await auth.signOut();
      throw new Error('Admin access required');
    }

    return true;
  } catch (error) {
    throw error;
  }
};

// Admin logout
window.adminLogout = async () => {
  await signOut(auth);
  window.location.href = 'admin-login.html';
};

// Check if current user is admin (client-side whitelist only, for quick UI checks)
window.isAdmin = () => {
  const user = auth.currentUser;
  return user && ADMIN_WHITELIST.includes(user.uid);
};

