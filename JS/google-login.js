import { auth, db } from "./firebase.js";
import { GoogleAuthProvider, signInWithPopup, doc, setDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
// showStatus defined in login.js or inline

window.googleLogin = async function () {
  const originalBtn = `<i class="fab fa-google"></i> Continue with Google`;
  const googleBtn = document.querySelector('#google-login-btn');
  if (googleBtn) {
    googleBtn.disabled = true;
    googleBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Connecting...`;
  }

  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    await setDoc(doc(db, "users", user.uid), {
      email: user.email,
      createdAt: new Date(),
      provider: 'google'
    }, { merge: true });

    const statusEl = document.getElementById("status");
    if (statusEl) {
      statusEl.innerText = "Welcome! Redirecting...";
      statusEl.className = `status-message show success`;
    }
    setTimeout(() => {
      window.location.href = "index.html";
    }, 800);
  } catch (error) {
    console.error("Google Login Error:", error);
    const statusEl = document.getElementById("status");
    if (statusEl) {
      statusEl.innerText = error.message || "Google login failed. Please try again.";
      statusEl.className = `status-message show error`;
    }
  } finally {
    if (googleBtn) {
      googleBtn.disabled = false;
      googleBtn.innerHTML = originalBtn;
    }
  }
};

