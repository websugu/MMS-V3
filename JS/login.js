import { auth, db } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";

import {
  doc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";


// Country rules
const countryRules = {
  "+223": 8,
  "+225": 10,
  "+221": 9,
  "+226": 8,
  "+242": 9
};

function cleanPhone(phone) {
  return phone.replace(/\D/g, "");
}

function showStatus(msg, type = "error") {
  const statusEl = document.getElementById("status");
  if (!statusEl) return;
  statusEl.innerText = msg;
  statusEl.className = `status-message show ${type}`;
}

function hideStatus() {
  const statusEl = document.getElementById("status");
  if (!statusEl) return;
  statusEl.classList.remove("show", "error", "success");
}

function setLoading(isLoading, btnSelector, originalText) {
  const btn = document.querySelector(btnSelector);
  if (!btn) return;
  if (isLoading) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Please wait...`;
  } else {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}


// SIGN UP
window.signup = async function () {
  const email = document.getElementById("signup-email").value.trim().toLowerCase();
  const password = document.getElementById("signup-password").value;
  const country = document.getElementById("signup-country").value;
  let phone = cleanPhone(document.getElementById("signup-phone").value);

  const requiredLength = countryRules[country];

  if (!email || !password || !phone) {
    return showStatus("All fields are required");
  }

  if (password.length < 6) {
    return showStatus("Password must be at least 6 characters");
  }

  if (phone.length !== requiredLength) {
    return showStatus(`Phone must be ${requiredLength} digits for this country`);
  }

  const fullPhone = country + phone;
  const originalBtn = `<i class="fas fa-user-plus"></i> Create Account`;

  try {
    setLoading(true, "#signup-form .btn-submit", originalBtn);

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await setDoc(doc(db, "users", user.uid), {
      email: user.email,
      phone: fullPhone,
      createdAt: new Date()
    });

    // Create email-to-phone mapping
    await setDoc(doc(db, "phoneEmailsByEmail", user.email), {
      phone: fullPhone,
      uid: user.uid
    });

    // Create phone-to-email mapping
    await setDoc(doc(db, "phoneEmails", fullPhone), {
      email: user.email,
      uid: user.uid
    });

    showStatus("Account created! Redirecting...", "success");
    setTimeout(() => {
      window.location.href = "index.html";
    }, 800);

    setLoading(false, "#signup-form .btn-submit", originalBtn);

  } catch (error) {
    console.error("Signup Error:", error);
    showStatus(error.message);
    setLoading(false, "#signup-form .btn-submit", originalBtn);
  }
};


// LOGIN — Email + Password
window.login = async function () {
  const email = document.getElementById("login-email").value.trim().toLowerCase();
  const password = document.getElementById("login-password").value;

  const originalBtn = `<i class="fas fa-sign-in-alt"></i> Sign In`;

  if (!email || !password) {
    return showStatus("Please enter your email and password");
  }

  try {
    setLoading(true, "#login-form .btn-submit", originalBtn);

    await signInWithEmailAndPassword(auth, email, password);

    showStatus("Welcome back! Redirecting...", "success");
    setTimeout(() => {
      window.location.href = "index.html";
    }, 800);

  } catch (error) {
    console.error("Login Error:", error);
    showStatus(error.message || "Login failed. Please check your email and password.");
    setLoading(false, "#login-form .btn-submit", originalBtn);
  }
};

