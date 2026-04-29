import { auth, db } from "./firebase.js";
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

const container = document.getElementById("cart-container");
const summaryContainer = document.getElementById("order-summary");
const cartCount = document.getElementById("cart-count");
const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toast-message");

// Toast
function showToast(message) {
  if (!toast || !toastMessage) return;
  toastMessage.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}

// Skeleton
function showSkeleton() {
  if (!container || !summaryContainer) return;
  container.innerHTML = `
    <div class="skeleton-item">
      <div class="skeleton skeleton-img"></div>
      <div class="skeleton-lines">
        <div class="skeleton skeleton-line" style="width: 60%;"></div>
        <div class="skeleton skeleton-line short"></div>
        <div class="skeleton skeleton-line" style="width: 40%;"></div>
      </div>
    </div>
    <div class="skeleton-item">
      <div class="skeleton skeleton-img"></div>
      <div class="skeleton-lines">
        <div class="skeleton skeleton-line" style="width: 60%;"></div>
        <div class="skeleton skeleton-line short"></div>
        <div class="skeleton skeleton-line" style="width: 40%;"></div>
      </div>
    </div>
  `;
  summaryContainer.innerHTML = `
    <div class="skeleton-summary">
      <div class="skeleton skeleton-line" style="width: 50%;"></div>
      <div class="skeleton skeleton-line" style="width: 100%;"></div>
      <div class="skeleton skeleton-line" style="width: 100%;"></div>
      <div class="skeleton skeleton-line" style="width: 100%;"></div>
      <div class="skeleton skeleton-line" style="width: 60%; margin-top: auto;"></div>
    </div>
  `;
}

auth.onAuthStateChanged(async (user) => {
  showSkeleton();
  if (user) {
    await loadCart(user.uid);
  } else {
    await loadGuestCart();
  }
});

async function loadCart(uid) {
  const cartRef = collection(db, "users", uid, "cart");
  const snapshot = await getDocs(cartRef);

  container.innerHTML = "";

  let totalPrice = 0;
  let totalItems = 0;
  const items = [];

  snapshot.forEach((docSnap) => {
    const item = docSnap.data();
    const id = docSnap.id;
    totalPrice += item.price * item.quantity;
    totalItems += item.quantity;
    items.push({ id, ...item });
  });

  if (cartCount) {
    cartCount.textContent = totalItems > 0 ? `${totalItems} article${totalItems !== 1 ? 's' : ''}` : '';
  }

  if (items.length === 0) {
    renderEmptyCart();
    summaryContainer.innerHTML = "";
    return;
  }

  items.forEach((item) => {
    const div = document.createElement("div");
    div.classList.add("cart-item");

    let variantHtml = '';
    if (item.selectedModel) variantHtml += `<span>Model: ${item.selectedModel}</span>`;
    if (item.selectedColor) variantHtml += `<span>Color: ${item.selectedColor}</span>`;

    const itemTotal = item.price * item.quantity;

    div.innerHTML = `
      <div class="cart-item-image">
        <img src="${item.imageUrl}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/100x100/e2e8f0/94a3b8?text=No+Image'">
      </div>
      <div class="cart-item-info">
        <a href="product.html?id=${item.id}" class="cart-item-name">${item.name}</a>
        ${variantHtml ? `<div class="cart-item-variant">${variantHtml}</div>` : ''}
        <div class="cart-item-price">
          ${itemTotal.toLocaleString('en-IN')}F
          <span>${Number(item.price).toLocaleString('en-IN')}F chacun</span>
        </div>
        <div class="qty-stepper">
          <button class="qty-btn" onclick="updateQty('${item.id}', -1)"><i class="fas fa-minus"></i></button>
          <div class="qty-value" id="qty-${item.id}">${item.quantity}</div>
          <button class="qty-btn" onclick="updateQty('${item.id}', 1)"><i class="fas fa-plus"></i></button>
        </div>
      </div>
      <button class="remove-btn" onclick="removeItem('${item.id}')" title="Remove item">
        <i class="fas fa-trash-alt"></i>
      </button>
    `;

    container.appendChild(div);
  });

  renderSummary(totalPrice, totalItems, false);
}

async function loadGuestCart() {
  const guestCart = JSON.parse(localStorage.getItem("guestCart") || "[]");

  container.innerHTML = "";

  let totalPrice = 0;
  let totalItems = 0;

  guestCart.forEach((item) => {
    totalPrice += item.price * item.quantity;
    totalItems += item.quantity;
  });

  if (cartCount) {
    cartCount.textContent = totalItems > 0 ? `${totalItems} article${totalItems !== 1 ? 's' : ''}` : '';
  }

  if (guestCart.length === 0) {
    renderEmptyCart();
    summaryContainer.innerHTML = "";
    return;
  }

  guestCart.forEach((item, index) => {
    const div = document.createElement("div");
    div.classList.add("cart-item");

    let variantHtml = '';
    if (item.selectedModel) variantHtml += `<span>Model: ${item.selectedModel}</span>`;
    if (item.selectedColor) variantHtml += `<span>Color: ${item.selectedColor}</span>`;

    const itemTotal = item.price * item.quantity;

    div.innerHTML = `
      <div class="cart-item-image">
        <img src="${item.imageUrl}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/100x100/e2e8f0/94a3b8?text=No+Image'">
      </div>
      <div class="cart-item-info">
        <a href="product.html?id=${item.id}" class="cart-item-name">${item.name}</a>
        ${variantHtml ? `<div class="cart-item-variant">${variantHtml}</div>` : ''}
        <div class="cart-item-price">
          ${itemTotal.toLocaleString('en-IN')}F
          <span>${Number(item.price).toLocaleString('en-IN')}F chacun</span>
        </div>
        <div class="qty-stepper">
          <button class="qty-btn" onclick="updateGuestQty(${index}, -1)"><i class="fas fa-minus"></i></button>
          <div class="qty-value">${item.quantity}</div>
          <button class="qty-btn" onclick="updateGuestQty(${index}, 1)"><i class="fas fa-plus"></i></button>
        </div>
      </div>
      <button class="remove-btn" onclick="removeGuestItem(${index})" title="Remove item">
        <i class="fas fa-trash-alt"></i>
      </button>
    `;

    container.appendChild(div);
  });

  renderSummary(totalPrice, totalItems, true);
}

function renderSummary(totalPrice, totalItems, isGuest) {
  if (!summaryContainer) return;

  const loginPrompt = isGuest ? `
    <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; font-size: 0.85rem; color: #92400e;">
      <i class="fas fa-info-circle"></i> Vous n'êtes pas connecté. <a href="login.html" style="color: #92400e; font-weight: 600; text-decoration: underline;">Se connecter</a> pour sauvegarder votre panier.
    </div>
  ` : '';

  summaryContainer.innerHTML = `
    <div class="order-summary">
      <h2>Votre commande</h2>
      ${loginPrompt}
      <div class="summary-row">
        <span>Subtotal (${totalItems} article${totalItems !== 1 ? 's' : ''})</span>
        <span>${totalPrice.toLocaleString('en-IN')}F</span>
      </div>
      <div class="summary-row">
        <span>Expédition</span>
        <span style="color: #10b981; font-weight: 600;">Gratuit</span>
      </div>
      <div class="summary-row total">
        <span>Total</span>
        <span>${totalPrice.toLocaleString('en-IN')}F</span>
      </div>
      <button class="checkout-btn" onclick="checkout()">
        <i class="fas fa-lock"></i> Lancer la commande
      </button>
      <a href="index.html" class="continue-shopping">
        <i class="fas fa-arrow-left"></i> Continuer vos achats
      </a>
    </div>
  `;
}

function renderEmptyCart() {
  if (!container) return;
  container.innerHTML = `
    <div class="empty-cart">
      <i class="fas fa-shopping-cart"></i>
      <h2>Votre panier est vide.</h2>
      <p>On dirait que vous n'avez encore rien ajouté.</p>
      <a href="index.html" class="btn">
        <i class="fas fa-store"></i> Commencer vos achats
      </a>
    </div>
  `;
}

// Update quantity (authenticated user)
window.updateQty = async function(id, change) {
  const user = auth.currentUser;
  if (!user) return;

  const cartRef = doc(db, "users", user.uid, "cart", id);
  const cartSnap = await getDocs(collection(db, "users", user.uid, "cart"));

  let currentQty = 1;
  cartSnap.forEach((docSnap) => {
    if (docSnap.id === id) currentQty = docSnap.data().quantity || 1;
  });

  const newQty = Math.max(0, currentQty + change);

  if (newQty === 0) {
    await deleteDoc(cartRef);
    showToast("Article retiré du panier");
  } else {
    await updateDoc(cartRef, { quantity: newQty });
    showToast("Quantité mise à jour");
  }

  await loadCart(user.uid);
};

// Remove item (authenticated user)
window.removeItem = async function(id) {
  const user = auth.currentUser;
  if (!user) return;

  await deleteDoc(doc(db, "users", user.uid, "cart", id));
  showToast("Article retiré du panier");
  await loadCart(user.uid);
};

// Update quantity (guest)
window.updateGuestQty = function(index, change) {
  let guestCart = JSON.parse(localStorage.getItem("guestCart") || "[]");
  if (!guestCart[index]) return;

  const newQty = Math.max(0, guestCart[index].quantity + change);

  if (newQty === 0) {
    guestCart.splice(index, 1);
    showToast("Article retiré du panier");
  } else {
    guestCart[index].quantity = newQty;
    showToast("Quantité mise à jour");
  }

  localStorage.setItem("guestCart", JSON.stringify(guestCart));
  loadGuestCart();
};

// Remove item (guest)
window.removeGuestItem = function(index) {
  let guestCart = JSON.parse(localStorage.getItem("guestCart") || "[]");
  guestCart.splice(index, 1);
  localStorage.setItem("guestCart", JSON.stringify(guestCart));
  showToast("Article retiré du panier");
  loadGuestCart();
};

// Checkout
window.checkout = function() {
  window.location.href = "checkout.html";
};

