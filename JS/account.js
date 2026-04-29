import { auth, db } from "./firebase.js";
import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
  collection,
  getDocs,
  query,
  orderBy,
  where
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

let currentUser = null;
let userData = null;
let ordersData = [];

// Load everything on auth state
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  currentUser = user;
  await loadProfile();
  await loadOrders();
});

async function loadProfile() {
  try {
    const userDoc = await getDoc(doc(db, "users", currentUser.uid));
    userData = userDoc.data() || {};

    const name = userData.name || currentUser.email.split('@')[0] || "User";
    const email = currentUser.email || "—";
    const phone = userData.phone || "—";
    const joined = userData.createdAt
      ? new Date(userData.createdAt.toDate()).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
      : "—";

    document.getElementById("profile-avatar").textContent = name.charAt(0).toUpperCase();
    document.getElementById("profile-name").textContent = name;
    document.getElementById("profile-email").textContent = email;
    document.getElementById("profile-phone").textContent = phone;
    document.getElementById("profile-joined").textContent = joined;

    // Pre-fill edit form
    document.getElementById("edit-name").value = userData.name || "";
    document.getElementById("edit-phone").value = userData.phone || "";
  } catch (error) {
    console.error("Profile load error:", error);
    showToast("Failed to load profile", "error");
  }
}

async function loadOrders() {
  try {
    const ordersQuery = query(
      collection(db, "orders"),
      where("uid", "==", currentUser.uid)
    );
    const snapshot = await getDocs(ordersQuery);

    ordersData = [];
    snapshot.forEach((docSnap) => {
      ordersData.push({ id: docSnap.id, ...docSnap.data() });
    });

    // Sort client-side to avoid requiring a Firestore composite index
    ordersData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    document.getElementById("order-count").textContent =
      ordersData.length + " order" + (ordersData.length !== 1 ? "s" : "");

    renderOrders();
  } catch (error) {
    console.error("Orders load error:", error);
    document.getElementById("orders-container").innerHTML = `
      <div class="empty-state">
        <i class="fas fa-exclamation-circle"></i>
        <h3>Failed to load orders</h3>
        <p>Please try again later</p>
      </div>
    `;
  }
}

function renderOrders() {
  const container = document.getElementById("orders-container");

  if (ordersData.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-shopping-bag"></i>
        <h3>Aucune commande</h3>
        <p>Vos commandes apparaîtront ici. <a href="index.html">Commencer vos achats</a></p>
      </div>
    `;
    return;
  }

  let html = `<div class="orders-table-wrap"><table class="orders-table">
    <thead>
      <tr>
        <th>Product</th>
        <th>Status</th>
        <th>Date</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>`;

  ordersData.forEach((order) => {
    const date = order.timestamp
      ? new Date(order.timestamp.toDate()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'N/A';
    const status = order.status || 'pending';
    const statusClass = `status-${status}`;

    // Get first item for product display
    const firstItem = order.items && order.items.length > 0 ? order.items[0] : null;
    const productImage = firstItem?.imageUrl || 'https://via.placeholder.com/52';
    const productName = firstItem?.name || 'Unknown Product';
    const itemCount = order.items ? order.items.length : 0;
    const itemCountText = itemCount > 1 ? `+${itemCount - 1} more` : '';

    html += `
      <tr>
        <td>
          <div class="product-cell">
            <img src="${productImage}" alt="${productName}">
            <div class="product-cell-info">
              <div class="product-cell-name">${productName}</div>
              ${itemCountText ? `<div class="product-cell-meta">${itemCountText}</div>` : ''}
            </div>
          </div>
        </td>
        <td><span class="status-badge ${statusClass}">${status}</span></td>
        <td class="order-date">${date}</td>
        <td>
          <div class="action-cell">
            <button class="btn-action btn-view" onclick="viewOrderDetails('${order.id}')">
              <i class="fas fa-eye"></i> Details
            </button>
            <button class="btn-action btn-reorder" onclick="reorder('${order.id}')">
              <i class="fas fa-redo"></i> Encore
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

// Toggle edit mode
window.toggleEdit = function () {
  const viewEl = document.getElementById("profile-view");
  const editEl = document.getElementById("profile-edit");

  if (editEl.classList.contains("active")) {
    editEl.classList.remove("active");
    viewEl.style.display = "block";
  } else {
    editEl.classList.add("active");
    viewEl.style.display = "none";
  }
};

// Save profile
window.saveProfile = async function () {
  const name = document.getElementById("edit-name").value.trim();
  const phone = document.getElementById("edit-phone").value.trim();

  if (!name && !phone) {
    showToast("Please enter at least one field", "error");
    return;
  }

  try {
    const updates = {};
    if (name) updates.name = name;
    if (phone) updates.phone = phone;

    await updateDoc(doc(db, "users", currentUser.uid), updates);

    showToast("Profil mis à jour avec succès!", "success");
    toggleEdit();
    await loadProfile();
  } catch (error) {
    console.error("Profile update error:", error);
    showToast("Échec de la mise à jour du profil", "error");
  }
};

// Reorder — add items back to cart
window.reorder = async function (orderId) {
  try {
    const order = ordersData.find((o) => o.id === orderId);
    if (!order || !order.items || order.items.length === 0) {
      showToast("Aucun article à commander.", "error");
      return;
    }

    for (const item of order.items) {
      const cartRef = doc(db, "users", currentUser.uid, "cart", item.id || doc(collection(db, "temp")).id);
      await setDoc(cartRef, {
        name: item.name,
        price: item.price,
        imageUrl: item.imageUrl || "",
        quantity: item.quantity || 1,
        selectedModel: item.selectedModel || null,
        selectedColor: item.selectedColor || null
      });
    }

    showToast(`${order.items.length} item(s) Ajouté au panier!`, "succès");
  } catch (error) {
    console.error("Reorder error:", error);
    showToast("Failed to reorder", "error");
  }
};

// View order details modal
window.viewOrderDetails = async function (orderId) {
  try {
    const order = ordersData.find((o) => o.id === orderId);
    if (!order) {
      showToast("Order not found", "error");
      return;
    }

    document.getElementById("modal-order-id").textContent = orderId.slice(-6);

    const trackingNumber = order.trackingNumber || "TRK-" + Math.random().toString(36).substr(2, 9).toUpperCase();

    // Items
    let itemsHtml = "";
    if (order.items && order.items.length) {
      order.items.forEach((item) => {
        const variantParts = [];
        if (item.selectedModel) variantParts.push(`Model: ${item.selectedModel}`);
        if (item.selectedColor) variantParts.push(`Color: ${item.selectedColor}`);
        const variantText = variantParts.length ? variantParts.join(" · ") : "";

        itemsHtml += `
          <div class="order-item">
            <img src="${item.imageUrl || 'https://via.placeholder.com/64'}" alt="${item.name}">
            <div class="order-item-info">
              <div class="order-item-name">${item.name} × ${item.quantity || 1}</div>
              ${variantText ? `<div class="order-item-meta">${variantText}</div>` : ""}
              <div class="order-item-price">${((item.price || 0) * (item.quantity || 1)).toLocaleString('en-IN')}F</div>
            </div>
          </div>
        `;
      });
    }

    // Timeline
    const status = order.status || "pending";
    const isProcessed = status === "processed" || status === "shipped" || status === "delivered";
    const isShipped = status === "shipped" || status === "delivered";
    const isDelivered = status === "delivered";

    const dateStr = order.timestamp
      ? new Date(order.timestamp.toDate()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'Just now';

    const timelineSteps = [
      { title: "Order Placed", date: dateStr, completed: true },
      { title: "Processing", date: isProcessed ? "Completed" : "Pending", completed: isProcessed },
      { title: "Shipped", date: isShipped ? "On the way" : "Pending", completed: isShipped },
      { title: "Delivered", date: isDelivered ? "Completed" : "Pending", completed: isDelivered },
    ];

    let timelineHtml = '<div class="timeline">';
    timelineSteps.forEach((step) => {
      timelineHtml += `
        <div class="timeline-item ${step.completed ? "completed" : ""}">
          <div class="timeline-dot"></div>
          <div>
            <div class="timeline-title">${step.title}</div>
            <div class="timeline-date">${step.date}</div>
          </div>
        </div>
      `;
    });
    timelineHtml += "</div>";

    // Payment display
    const paymentDisplay = (order.payment || "cash")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());

    document.getElementById("modal-content").innerHTML = `
      <div class="tracking-box">
        <div class="label"><i class="fas fa-truck"></i> Tracking Number</div>
        <div class="number">${trackingNumber}</div>
      </div>

      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 14px; color: var(--text);">
          <i class="fas fa-box" style="color: var(--primary);"></i> Items
        </h3>
        ${itemsHtml || "<p style='color: var(--text-muted);'>No items found</p>"}
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
        <div style="background: var(--bg); padding: 16px; border-radius: var(--radius-sm);">
          <h4 style="font-weight: 600; margin-bottom: 10px; font-size: 0.9rem; color: var(--text);">
            <i class="fas fa-map-marker-alt" style="color: var(--primary);"></i> Shipping
          </h4>
          <p style="color: var(--text-secondary); font-size: 0.85rem; line-height: 1.6;">
            ${order.name || "N/A"}<br>
            ${order.address || "N/A"}<br>
            ${order.city || ""}<br>
            ${order.phone || ""}
          </p>
        </div>
        <div style="background: var(--bg); padding: 16px; border-radius: var(--radius-sm);">
          <h4 style="font-weight: 600; margin-bottom: 10px; font-size: 0.9rem; color: var(--text);">
            <i class="fas fa-receipt" style="color: var(--primary);"></i> Summary
          </h4>
          <p style="color: var(--text-secondary); font-size: 0.85rem; line-height: 1.8;">
            Payment: <strong>${paymentDisplay}</strong><br>
            Subtotal: ${(order.total || 0).toLocaleString('en-IN')}F<br>
            Total: <span style="color: var(--primary); font-weight: 700;">${(order.total || 0).toLocaleString('en-IN')}F</span>
          </p>
        </div>
      </div>

      <div>
        <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 14px; color: var(--text);">
          <i class="fas fa-route" style="color: var(--primary);"></i> Order Status
        </h3>
        ${timelineHtml}
      </div>
    `;

    document.getElementById("order-modal").classList.add("active");
  } catch (error) {
    console.error("Order details error:", error);
    showToast("Failed to load order details", "error");
  }
};

window.closeModal = function () {
  document.getElementById("order-modal").classList.remove("active");
};

// Close on overlay click
document.addEventListener("click", (e) => {
  if (e.target === document.getElementById("order-modal")) {
    closeModal();
  }
});

// Toast
function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  const toastMsg = document.getElementById("toast-message");

  toast.className = `toast ${type}`;
  toastMsg.textContent = message;

  // Update icon
  const icon = toast.querySelector("i");
  icon.className = type === "success" ? "fas fa-check-circle" : "fas fa-exclamation-circle";

  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

