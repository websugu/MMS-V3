import { auth, db } from "./firebase.js";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  query,
  doc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

const form = document.getElementById("checkout-form");
const summaryDiv = document.getElementById("order-summary");
const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toast-message");

let orderTotal = 0;
let isGuest = false;
let cartItems = [];

const WHATSAPP_NUMBER = "918296497428";

// 🌍 Detect current location and fill address fields
const detectLocationBtn = document.getElementById("detect-location-btn");
const locationStatus = document.getElementById("location-status");

if (detectLocationBtn) {
  detectLocationBtn.addEventListener("click", handleDetectLocation);
}

function setLocationStatus(message, type) {
  if (!locationStatus) return;
  locationStatus.style.display = "flex";
  locationStatus.className = `location-status ${type}`;
  locationStatus.innerHTML = `
    <i class="fas ${type === 'loading' ? 'fa-spinner fa-spin' : type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
    <span>${message}</span>
  `;
}

function clearLocationStatus() {
  if (!locationStatus) return;
  locationStatus.style.display = "none";
  locationStatus.innerHTML = "";
}

async function handleDetectLocation() {
  if (!navigator.geolocation) {
    setLocationStatus("La géolocalisation n'est pas supportée par votre navigateur.", "error");
    return;
  }

  detectLocationBtn.disabled = true;
  setLocationStatus("Obtention de votre position...", "loading");

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      try {
        setLocationStatus("Recherche de votre adresse...", "loading");
        const addressData = await reverseGeocode(latitude, longitude);
        fillAddressFields(addressData);
        setLocationStatus("Adresse détectée avec succès !", "success");
        setTimeout(clearLocationStatus, 4000);
      } catch (error) {
        console.error("Reverse geocoding error:", error);
        setLocationStatus("Impossible de récupérer l'adresse. Veuillez la saisir manuellement.", "error");
      } finally {
        detectLocationBtn.disabled = false;
      }
    },
    (error) => {
      detectLocationBtn.disabled = false;
      let msg = "Impossible d'obtenir votre position.";
      switch (error.code) {
        case error.PERMISSION_DENIED:
          msg = "Permission refusée. Veuillez autoriser l'accès à la localisation.";
          break;
        case error.POSITION_UNAVAILABLE:
          msg = "Position indisponible. Veuillez réessayer.";
          break;
        case error.TIMEOUT:
          msg = "Délai d'attente dépassé. Veuillez réessayer.";
          break;
      }
      setLocationStatus(msg, "error");
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

async function reverseGeocode(lat, lon) {
  // Using OpenStreetMap Nominatim (free, no API key required)
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;
  const response = await fetch(url, {
    headers: {
      "Accept-Language": "fr"
    }
  });
  if (!response.ok) throw new Error("Geocoding failed");
  const data = await response.json();
  return data.address || {};
}

function fillAddressFields(address) {
  const addressInput = document.getElementById("address");
  const cityInput = document.getElementById("city");

  // Build street address from components
  const parts = [];
  if (address.road) parts.push(address.road);
  if (address.house_number) parts.unshift(address.house_number);
  if (address.suburb || address.neighbourhood) parts.push(address.suburb || address.neighbourhood);
  if (address.village || address.town || address.city) {
    const cityName = address.village || address.town || address.city;
    if (!parts.includes(cityName)) parts.push(cityName);
  }

  const fullAddress = parts.join(", ");
  if (addressInput && fullAddress) {
    addressInput.value = fullAddress;
  }

  // Fill city/country field
  const cityOrCountry = address.city || address.town || address.village || address.county || address.state || address.country || "";
  if (cityInput && cityOrCountry) {
    cityInput.value = cityOrCountry;
  }
}

// 📲 WhatsApp Order Confirmation
function sendWhatsAppOrderConfirmation(orderId, items, total, shipping, payment) {
  const trackingUrl = `${window.location.origin}/success.html?orderId=${orderId}`;
  const paymentLabel = payment === "orange-money" ? "Orange Money" : payment === "wave" ? "Wave" : "Paiement à la livraison";

  let message = `🛒 *NOUVELLE COMMANDE*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
  message += `📋 *Commande N°:* ${orderId}\n`;
  message += `👤 *Client:* ${shipping.name}\n`;
  message += `📞 *Téléphone:* ${shipping.phone || "Non fourni"}\n`;
  message += `📧 *Email:* ${shipping.email || "Non fourni"}\n\n`;
  message += `📍 *Adresse de livraison:*\n${shipping.address}\n${shipping.city}\n\n`;
  message += `🛍️ *Articles commandés:*\n`;

  items.forEach((item, index) => {
    message += `\n${index + 1}. *${item.name}*\n`;
    message += `   Quantité: ${item.quantity}\n`;
    message += `   Prix: ${item.price.toLocaleString("en-IN")}F\n`;
    if (item.selectedModel) message += `   Modèle: ${item.selectedModel}\n`;
    if (item.selectedColor) message += `   Couleur: ${item.selectedColor}\n`;
  });

  message += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  message += `💰 *Total:* ${total.toLocaleString("en-IN")}F\n`;
  message += `💳 *Paiement:* ${paymentLabel}\n\n`;
  message += `🔗 *Suivi de commande:*\n${trackingUrl}\n\n`;
  message += `✅ Veuillez confirmer cette commande.`;

  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`;

  // Open WhatsApp in a new tab (customer sends to business)
  window.open(whatsappUrl, "_blank");
}

// Toast
function showToast(message, icon = "fa-check-circle") {
  if (!toast || !toastMessage) return;
  toastMessage.textContent = message;
  const iconEl = toast.querySelector("i");
  if (iconEl) {
    iconEl.className = `fas ${icon}`;
    iconEl.style.color = icon === "fa-exclamation-circle" ? "#ef4444" : "#4ade80";
  }
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2800);
}

// Skeleton loading
function showSkeleton() {
  if (!summaryDiv) return;
  summaryDiv.innerHTML = `
    <div class="order-summary-card">
      <div class="skeleton" style="height: 24px; width: 60%; border-radius: 8px; margin-bottom: 20px;"></div>
      <div style="display: flex; gap: 12px; margin-bottom: 14px;">
        <div class="skeleton" style="width: 56px; height: 56px; border-radius: 8px; flex-shrink: 0;"></div>
        <div style="flex: 1; display: flex; flex-direction: column; gap: 8px; justify-content: center;">
          <div class="skeleton" style="height: 14px; width: 70%; border-radius: 6px;"></div>
          <div class="skeleton" style="height: 14px; width: 40%; border-radius: 6px;"></div>
        </div>
      </div>
      <div style="display: flex; gap: 12px; margin-bottom: 14px;">
        <div class="skeleton" style="width: 56px; height: 56px; border-radius: 8px; flex-shrink: 0;"></div>
        <div style="flex: 1; display: flex; flex-direction: column; gap: 8px; justify-content: center;">
          <div class="skeleton" style="height: 14px; width: 60%; border-radius: 6px;"></div>
          <div class="skeleton" style="height: 14px; width: 35%; border-radius: 6px;"></div>
        </div>
      </div>
      <div class="skeleton" style="height: 14px; width: 100%; border-radius: 6px; margin-top: auto;"></div>
      <div class="skeleton" style="height: 48px; width: 100%; border-radius: 10px; margin-top: 10px;"></div>
    </div>
  `;
}

auth.onAuthStateChanged(async (user) => {
  showSkeleton();
  isGuest = !user;

  if (user) {
    await loadUserProfile(user.uid);
    await loadOrderSummary(user.uid);
  } else {
    await loadGuestOrderSummary();
  }
});

async function loadUserProfile(uid) {
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      const profile = userDoc.data();
      const phoneEl = document.getElementById("phone");
      const emailEl = document.getElementById("email");
      if (phoneEl) phoneEl.value = profile.phone || "";
      if (emailEl) emailEl.value = profile.email || "";
    }
  } catch (error) {
    console.error("Profile load error:", error);
  }
}

async function loadOrderSummary(uid) {
  const cartRef = collection(db, "users", uid, "cart");
  const snapshot = await getDocs(cartRef);

  orderTotal = 0;
  cartItems = [];

  snapshot.forEach((docSnap) => {
    const item = docSnap.data();
    const subtotal = item.price * item.quantity;
    orderTotal += subtotal;
    cartItems.push({ id: docSnap.id, ...item, subtotal });
  });

  if (cartItems.length === 0) {
    renderEmptyState();
    return;
  }

  renderSummary(cartItems, orderTotal);
}

async function loadGuestOrderSummary() {
  const guestCart = JSON.parse(localStorage.getItem("guestCart") || "[]");

  orderTotal = 0;
  cartItems = [];

  guestCart.forEach((item) => {
    const subtotal = item.price * item.quantity;
    orderTotal += subtotal;
    cartItems.push({ ...item, subtotal });
  });

  if (cartItems.length === 0) {
    renderEmptyState();
    return;
  }

  renderSummary(cartItems, orderTotal);
}

function renderSummary(items, total) {
  if (!summaryDiv) return;

  let itemsHtml = "";
  items.forEach((item) => {
    let variantHtml = "";
    if (item.selectedModel) variantHtml += `<div class="summary-item-variant">Model: ${item.selectedModel}</div>`;
    if (item.selectedColor) variantHtml += `<div class="summary-item-variant">Color: ${item.selectedColor}</div>`;

    itemsHtml += `
      <div class="summary-item">
        <img src="${item.imageUrl || "https://via.placeholder.com/56x56/e2e8f0/94a3b8?text=No+Img"}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/56x56/e2e8f0/94a3b8?text=No+Img'">
        <div class="summary-item-info">
          <div class="summary-item-name">${item.name} × ${item.quantity}</div>
          ${variantHtml}
          <div class="summary-item-price">${item.subtotal.toLocaleString("en-IN")}F</div>
        </div>
      </div>
    `;
  });

  const guestNotice = isGuest ? `
    <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; font-size: 0.85rem; color: #92400e;">
      <i class="fas fa-user-secret"></i> Commande invité — <a href="login.html" style="color: #92400e; font-weight: 600; text-decoration: underline;">Créer un compte</a> pour suivre vos commandes.
    </div>
  ` : '';

  summaryDiv.innerHTML = `
    <div class="order-summary-card">
      <h2>Votre commande</h2>
      ${guestNotice}
      ${itemsHtml}
      <div class="summary-row">
        <span>Subtotal</span>
        <span>${total.toLocaleString("en-IN")}F</span>
      </div>
      <div class="summary-row">
        <span>Expédition</span>
        <span style="color: #10b981; font-weight: 600;">Gratuit</span>
      </div>
      <div class="summary-row total">
        <span>Total</span>
        <span>${total.toLocaleString("en-IN")}F</span>
      </div>
      <button type="submit" form="checkout-form" class="place-order-btn">
        <i class="fas fa-lock"></i> Confirmer — ${total.toLocaleString("en-IN")}F
      </button>
    </div>
  `;
}

function renderEmptyState() {
  if (!summaryDiv) return;
  summaryDiv.innerHTML = `
    <div class="order-summary-card" style="text-align: center; padding: 40px 24px;">
      <i class="fas fa-shopping-basket" style="font-size: 48px; color: var(--border); margin-bottom: 16px;"></i>
      <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 6px;">Votre panier est vide.</h3>
      <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 20px;">Ajoutez des produits avant de passer à la caisse.</p>
      <a href="index.html" style="display: inline-flex; align-items: center; gap: 8px; padding: 12px 24px; background: var(--primary); color: #fff; border-radius: var(--radius-sm); text-decoration: none; font-weight: 600;">
        <i class="fas fa-store"></i> Parcourir la boutique
      </a>
    </div>
  `;
}

// Form submission
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  isGuest = !user;

  const shipping = {
    name: document.getElementById("name").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    email: document.getElementById("email").value.trim(),
    address: document.getElementById("address").value.trim(),
    city: document.getElementById("city").value.trim()
  };
  const payment = document.querySelector("input[name='payment']:checked")?.value;

  // Validate required fields
  if (!shipping.name) {
    showToast("Veuillez entrer votre nom et prénom.", "fa-exclamation-circle");
    return;
  }
  if (!shipping.address) {
    showToast("Veuillez entrer votre adresse.", "fa-exclamation-circle");
    return;
  }
  if (!shipping.city) {
    showToast("Veuillez entrer votre pays.", "fa-exclamation-circle");
    return;
  }
  if (!payment) {
    showToast("Veuillez sélectionner un mode de paiement.", "fa-exclamation-circle");
    return;
  }

  const btn = form.querySelector("button[type='submit']") || document.querySelector(".place-order-btn");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> En cours...`;
  }

  try {
    let items = [];
    let currentTotal = 0;

    if (isGuest) {
      // Guest checkout — load from localStorage
      const guestCart = JSON.parse(localStorage.getItem("guestCart") || "[]");
      guestCart.forEach((item) => {
        const sanitizedItem = {
          id: item.id,
          name: item.name || "Produit",
          price: typeof item.price === "number" ? item.price : 0,
          imageUrl: item.imageUrl || null,
          quantity: typeof item.quantity === "number" ? item.quantity : 1,
          selectedModel: item.selectedModel || null,
          selectedColor: item.selectedColor || null
        };
        items.push(sanitizedItem);
        currentTotal += sanitizedItem.price * sanitizedItem.quantity;
      });
    } else {
      // Authenticated user — load from Firestore
      const cartQuery = query(collection(db, "users", user.uid, "cart"));
      const cartSnap = await getDocs(cartQuery);
      cartSnap.forEach((docSnap) => {
        const item = docSnap.data();
        const sanitizedItem = {
          id: docSnap.id,
          name: item.name || "Produit",
          price: typeof item.price === "number" ? item.price : 0,
          imageUrl: item.imageUrl || null,
          quantity: typeof item.quantity === "number" ? item.quantity : 1,
          selectedModel: item.selectedModel || null,
          selectedColor: item.selectedColor || null
        };
        items.push(sanitizedItem);
        currentTotal += sanitizedItem.price * sanitizedItem.quantity;
      });
    }

    if (items.length === 0) {
      showToast("Votre panier est vide.", "fa-exclamation-circle");
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-lock"></i> Confirmer — ${currentTotal.toLocaleString("en-IN")}F`;
      }
      return;
    }

    const orderData = {
      ...shipping,
      payment,
      items,
      total: currentTotal,
      status: "pending",
      isNew: true,
      timestamp: serverTimestamp()
    };

    // Only add uid for authenticated users
    if (!isGuest && user) {
      orderData.uid = user.uid;
    }

    const ordersRef = collection(db, "orders");
    const orderRef = await addDoc(ordersRef, orderData);

    // Clear cart
    if (isGuest) {
      localStorage.removeItem("guestCart");
    } else {
      const cartQuery = query(collection(db, "users", user.uid, "cart"));
      const cartSnap = await getDocs(cartQuery);
      await Promise.all(cartSnap.docs.map((d) => deleteDoc(d.ref)));
    }

    showToast("Commande passée avec succès!");

    // 📲 Send WhatsApp order confirmation
    sendWhatsAppOrderConfirmation(orderRef.id, items, currentTotal, shipping, payment);

    setTimeout(() => {
      window.location.href = `success.html?orderId=${orderRef.id}`;
    }, 1500);

  } catch (error) {
    console.error("Checkout error:", error.message || error);
    let msg = error.message || "Erreur inconnue";
    if (msg.toLowerCase().includes("permission")) {
      msg = "Permissions Firebase manquantes. Veuillez mettre à jour les règles Firestore pour autoriser la création de commandes.";
    }
    showToast("La commande a échoué. Veuillez réessayer. (" + msg + ")", "fa-exclamation-circle");
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="fas fa-lock"></i> Confirmer — ${orderTotal.toLocaleString("en-IN")}F`;
    }
  }
});

