import { auth, db } from "./firebase.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

// Render navbar with cart counter
export async function renderNavbar() {
  const navbar = document.getElementById("navbar");
  if (!navbar) return;

  const user = auth.currentUser;

  // Calculate guest cart count
  let guestCartCount = 0;
  if (!user) {
    try {
      const guestCart = JSON.parse(localStorage.getItem("guestCart") || "[]");
      guestCartCount = guestCart.reduce((sum, item) => sum + item.quantity, 0);
    } catch (e) { /* ignore */ }
  }

  if (!user) {
    navbar.innerHTML = `
      <nav class="main-nav">
        <div class="nav-container">
          <a href="index.html" class="nav-logo">
            <img src="IMG/store-logo-nav.png" width="150">
          </a>

          <button class="nav-mobile-toggle" onclick="toggleMobileNav()" aria-label="Menu">
            <i class="fas fa-bars"></i>
          </button>

          <div class="nav-links" id="nav-links">
            <a href="index.html" class="nav-link ${isActive('index.html')}">
              <i class="fas fa-home"></i> Boutique
            </a>
          </div>

          <div class="nav-profile">
            <button id="install-btn" class="nav-logout" onclick="installApp()" title="Installer l'app" style="display:none;">
              <i class="fas fa-download"></i>
            </button>
            <a href="cart.html" class="nav-link ${isActive('cart.html')}">
              <i class="fas fa-shopping-cart"></i>
              ${guestCartCount > 0 ? `<span class="nav-badge">${guestCartCount}</span>` : ''}
            </a>
            <a href="login.html" class="nav-link">
              <i class="fas fa-user-circle"></i>
            </a>
          </div>
        </div>
      </nav>
    `;
    return;
  }

  // Get cart item count (sum quantities)
  let totalItems = 0;
  try {
    const cartRef = collection(db, "users", user.uid, "cart");
    const snapshot = await getDocs(cartRef);
    snapshot.forEach(doc => {
      totalItems += doc.data().quantity || 1;
    });
  } catch (e) {
    console.error("Navbar cart count error:", e);
  }

  const initials = user.email ? user.email.substring(0, 2).toUpperCase() : "U";

  navbar.innerHTML = `
    <nav class="main-nav">
      <div class="nav-container">
        <a href="index.html" class="nav-logo">
          <img src="IMG/store-logo-nav.png" width="150">
        </a>

        

        <div class="nav-links" id="nav-links">
          <a href="index.html" class="nav-link ${isActive('index.html')}">
            <i class="fas fa-home"></i> Boutique
          </a>
        </div>

        <div class="nav-profile">
            <button id="install-btn" class="nav-logout" onclick="installApp()" title="Installer l'app" style="display:none;">
              <i class="fas fa-download"></i>
            </button>
        <div class="card-display">
            <a href="cart.html" class="nav-link ${isActive('cart.html')}">
              <i class="fas fa-shopping-cart"></i>
              ${totalItems > 0 ? `<span class="nav-badge">${totalItems}</span>` : ''}
            </a>
          </div>
          <div onclick="window.location.href='account.html'" class="nav-avatar ${isActive('account.html')}" title="${user.email}">
            ${initials}
          </div>
          <div>
          <button class="nav-logout" onclick="logout()" title="Se déconnecter">
            <i class="fas fa-sign-out-alt"></i>
          </button>
          </div>
          
          <div> 
            <button class="nav-mobile-toggle" onclick="toggleMobileNav()" aria-label="Menu">
              <i class="fas fa-bars"></i>
            </button>
        </div>
        </div>
      </div>
    </nav>
  `;
}

function isActive(page) {
  const current = window.location.pathname.split('/').pop() || 'index.html';
  return current === page ? 'active' : '';
}

window.toggleMobileNav = function() {
  const links = document.getElementById('nav-links');
  if (links) {
    links.classList.toggle('open');
  }
};

// Close mobile menu when clicking outside
document.addEventListener('click', (e) => {
  const links = document.getElementById('nav-links');
  const toggle = document.querySelector('.nav-mobile-toggle');
  if (links && toggle && !links.contains(e.target) && !toggle.contains(e.target)) {
    links.classList.remove('open');
  }
});

// PWA Install handling
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const installBtn = document.getElementById('install-btn');
  if (installBtn) installBtn.style.display = 'flex';
});

// Install app function
window.installApp = async function() {
  if (!deferredPrompt) return;
  
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') {
    deferredPrompt = null;
    const installBtn = document.getElementById('install-btn');
    if (installBtn) installBtn.style.display = 'none';
  }
};

// App installed
window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  const installBtn = document.getElementById('install-btn');
  if (installBtn) installBtn.style.display = 'none';
});

// Global logout
window.logout = function() {
  auth.signOut().then(() => {
    window.location.href = "login.html";
  });
};


