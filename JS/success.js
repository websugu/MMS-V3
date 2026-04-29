import { auth, db } from "./firebase.js";
import {
  collection,
  getDocs,
  orderBy,
  limit,
  query,
  doc,
  getDoc,
  where
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

const urlParams = new URLSearchParams(window.location.search);
const orderId = urlParams.get('orderId');

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  if (orderId) {
    await loadOrderById(user.uid, orderId);
  } else {
    await loadLatestOrder(user.uid);
  }
});

async function loadOrderById(uid, id) {
  try {
    const orderRef = doc(db, "orders", id);
    const orderSnap = await getDoc(orderRef);

    if (orderSnap.exists() && orderSnap.data().uid === uid) {
      renderOrder(orderSnap.id, orderSnap.data());
    } else {
      renderError("Order not found");
    }
  } catch (error) {
    console.error("Order load error:", error);
    renderError("Error loading order");
  }
}

async function loadLatestOrder(uid) {
  try {
    const ordersRef = collection(db, "orders");
    const q = query(ordersRef, where("uid", "==", uid));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      orders.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      renderOrder(orders[0].id, orders[0]);
    } else {
      renderError("No orders found");
    }
  } catch (error) {
    console.error("Order load error:", error);
    renderError("Error loading order");
  }
}

const WHATSAPP_NUMBER = "918296497428";

function renderOrder(id, data) {
  const container = document.getElementById("order-info");
  if (!container) return;

  const total = typeof data.total === 'number' ? data.total : 0;
  const status = data.status || 'pending';
  const statusClass = status === 'pending' ? 'status-pending' : '';

  container.innerHTML = `
    <div class="order-info-row">
      <span class="label"><i class="fas fa-hashtag"></i> Order ID</span>
      <span class="value id">${id}</span>
    </div>
    <div class="order-info-row">
      <span class="label"><i class="fas fa-rupee-sign"></i> Montant total</span>
      <span class="value">${total.toLocaleString('en-IN')} FCFA</span>
    </div>
    <div class="order-info-row">
      <span class="label"><i class="fas fa-info-circle"></i> Statut</span>
      <span class="value ${statusClass}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
    </div>
    <div class="order-info-row">
      <span class="label"><i class="fas fa-calendar"></i> Date</span>
      <span class="value">${formatDate(data.timestamp)}</span>
    </div>
    <div class="order-info-row">
      <span class="label"><i class="fas fa-credit-card"></i>Mode de Payment</span>
      <span class="value">${(data.payment || 'N/A').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
    </div>
  `;

  // Setup WhatsApp confirmation button
  setupWhatsAppButton(id, data);
}

function setupWhatsAppButton(orderId, data) {
  const waBtn = document.getElementById("whatsapp-confirm-btn");
  if (!waBtn) return;

  const total = typeof data.total === 'number' ? data.total : 0;
  const paymentLabel = data.payment === "orange-money" ? "Orange Money" : data.payment === "wave" ? "Wave" : "Paiement à la livraison";
  const trackingUrl = `${window.location.origin}/success.html?orderId=${orderId}`;

  let message = `🛒 *CONFIRMATION DE COMMANDE*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
  message += `📋 *Commande N°:* ${orderId}\n`;
  message += `👤 *Client:* ${data.name || "N/A"}\n`;
  message += `📞 *Téléphone:* ${data.phone || "Non fourni"}\n\n`;
  message += `📍 *Adresse de livraison:*\n${data.address || "N/A"}\n${data.city || "N/A"}\n\n`;
  message += `🛍️ *Articles commandés:*\n`;

  if (data.items && data.items.length > 0) {
    data.items.forEach((item, index) => {
      message += `\n${index + 1}. *${item.name}*\n`;
      message += `   Quantité: ${item.quantity}\n`;
      message += `   Prix: ${item.price.toLocaleString("en-IN")}F\n`;
      if (item.selectedModel) message += `   Modèle: ${item.selectedModel}\n`;
      if (item.selectedColor) message += `   Couleur: ${item.selectedColor}\n`;
    });
  }

  message += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  message += `💰 *Total:* ${total.toLocaleString("en-IN")}F\n`;
  message += `💳 *Paiement:* ${paymentLabel}\n\n`;
  message += `🔗 *Suivi de commande:*\n${trackingUrl}\n\n`;
  message += `✅ Veuillez confirmer cette commande.`;

  const encodedMessage = encodeURIComponent(message);
  waBtn.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`;
  waBtn.style.display = "inline-flex";
}

function renderError(message) {
  const container = document.getElementById("order-info");
  if (!container) return;

  container.innerHTML = `
    <div class="order-info-row" style="justify-content: center; color: #ef4444;">
      <i class="fas fa-exclamation-circle"></i> ${message}
    </div>
  `;
}

function formatDate(timestamp) {
  if (!timestamp) return 'N/A';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

