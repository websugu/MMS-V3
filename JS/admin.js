import { db, auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  orderBy,
  limit,
  query,
  getDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";


const form = document.getElementById("product-form");
const modelsContainer = document.getElementById("models-container");
const colorsContainer = document.getElementById("colors-container");
const addModelBtn = document.getElementById("add-model");
const addColorBtn = document.getElementById("add-color");
const colorLimit = document.getElementById("color-limit");

const message = document.getElementById("message");
const productsContainer = document.getElementById("admin-products");
const ordersContainer = document.getElementById("admin-orders");
const productSearch = document.getElementById("product-search");
const orderSearch = document.getElementById("order-search");
const customerSearch = document.getElementById("customer-search");

let editId = null;
let allProducts = [];
let allOrders = [];
let allCustomers = [];

let currentTab = 'dashboard';
let modelCount = 0;
let colorCount = 0;
let currentOrderFilter = 'all';
let lastModelValue = '';
let lastColorValue = '';

// Dynamic Variants Setup
addModelBtn.addEventListener('click', () => addModelField(lastModelValue));
addColorBtn.addEventListener('click', () => addColorField(lastColorValue));

function addModelField(prefillValue) {
  modelCount++;
  const div = document.createElement('div');
  div.className = 'model-row';
  div.style.cssText = 'display: flex; gap: 12px; align-items: center; margin-bottom: 12px; padding: 12px; background: #f8fafc; border-radius: 12px; border: 1px solid #e5e7eb;';
  div.innerHTML = `
    <input type="text" placeholder="Model name (e.g. iPhone 11 Pro)" class="form-input model-input" style="flex: 1; padding: 12px 16px;" value="${prefillValue || ''}">
    <button type="button" onclick="removeField(this)" class="btn btn-danger" style="padding: 12px 16px; font-size: 14px; min-width: 44px;">
      <i class="fas fa-trash"></i>
    </button>
  `;
  modelsContainer.appendChild(div);
  // Track last entered model value
  const input = div.querySelector('.model-input');
  input.addEventListener('blur', () => { if (input.value.trim()) lastModelValue = input.value.trim(); });
  if (prefillValue) input.focus();
}

function addColorField(prefillValue) {
  if (colorCount >= 4) {
    colorLimit.textContent = 'MAX 4 REACHED';
    colorLimit.style.color = '#ef4444';
    setTimeout(() => {
      colorLimit.textContent = `${colorCount}/4`;
      colorLimit.style.color = '#94a3b8';
    }, 2000);
    return;
  }
  
  colorCount++;
  updateColorLimit();
  
  const div = document.createElement('div');
  div.className = 'color-row';
  div.style.cssText = 'display: flex; gap: 12px; align-items: center; margin-bottom: 12px; padding: 12px; background: #f8fafc; border-radius: 12px; border: 1px solid #e5e7eb;';
  div.innerHTML = `
    <input type="text" placeholder="Color (e.g. Black)" class="form-input color-input" style="flex: 1; padding: 12px 16px;" value="${prefillValue || ''}">
    <button type="button" onclick="removeField(this)" class="btn btn-danger" style="padding: 12px 16px; font-size: 14px; min-width: 44px;">
      <i class="fas fa-trash"></i>
    </button>
  `;
  colorsContainer.appendChild(div);
  // Track last entered color value
  const input = div.querySelector('.color-input');
  input.addEventListener('blur', () => { if (input.value.trim()) lastColorValue = input.value.trim(); });
  if (prefillValue) input.focus();
}

function removeField(btn) {
  btn.parentElement.remove();
  if (btn.closest('.model-row')) modelCount--;
  if (btn.closest('.color-row')) {
    colorCount--;
    updateColorLimit();
  }
}


function updateColorLimit() {
  colorLimit.textContent = `${colorCount}/4`;
}

window.resetProductForm = function() {
  document.getElementById('product-form').reset();
  editId = null;
  modelsContainer.innerHTML = '';
  colorsContainer.innerHTML = '';
  modelCount = 0;
  colorCount = 0;
  updateColorLimit();
};

// Get variants from form
function getModels() {
  const models = Array.from(modelsContainer.querySelectorAll('.model-input')).map(input => input.value.trim()).filter(Boolean);
  return models.length ? models : null;
}

function getColors() {
  const colors = Array.from(colorsContainer.querySelectorAll('.color-input')).map(input => input.value.trim()).filter(Boolean);
  return colors.length ? colors : null;
}

// Load variants for edit
function loadVariants(product) {
  // Clear existing
  modelsContainer.innerHTML = '';
  colorsContainer.innerHTML = '';
  modelCount = 0;
  colorCount = 0;
  
  // Load models
  if (product.models && product.models.length) {
    product.models.forEach(model => addModelField(model));
  }
  
  // Load colors
  if (product.colors && product.colors.length) {
    product.colors.forEach(color => addColorField(color));
  }
}

// EDIT PRODUCT - Load variants
window.editProduct = async function(id) {
  try {
    editId = id;
    const snap = await getDoc(doc(db, "products", id));
    const data = snap.data();
    
    document.getElementById("name").value = data.name || '';
    document.getElementById("price").value = data.price || '';
    document.getElementById("imageUrl").value = data.imageUrl || '';
    document.getElementById("description").value = data.description || '';
    document.getElementById("category").value = data.category || '';
    
    loadVariants(data);
    
    showMessage("Product loaded for editing (variants included)", "success");
  } catch (error) {
    showMessage("Edit failed", "error");
  }
};

// SAVE - Include variants
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const price = parseFloat(document.getElementById("price").value);
  const imageUrl = document.getElementById("imageUrl").value.trim();
  const description = document.getElementById("description").value.trim();

  if (!name || !price || !imageUrl) {
    showMessage("Please fill all fields", "error");
    return;
  }

  const category = document.getElementById("category").value;

  const productData = {
    name, price, imageUrl, description: description || "",
    category,
    models: getModels(),
    colors: getColors()
  };

  try {
    if (editId) {
      await updateDoc(doc(db, "products", editId), productData);
      showMessage("✅ Product + variants updated!", "success");
      editId = null;
    } else {
      await addDoc(collection(db, "products"), productData);
      showMessage("✅ Product + variants added!", "success");
    }

    form.reset();
    modelsContainer.innerHTML = '';
    colorsContainer.innerHTML = '';
    modelCount = 0;
    colorCount = 0;
    updateColorLimit();
    loadProducts();
  } catch (error) {
    console.error(error);
    showMessage("Error: " + error.message, "error");
  }
});





// Show message helper
function showMessage(text, type) {
  message.textContent = text;
  message.className = `message message-${type}`;
  message.style.display = 'block';
  message.style.padding = '16px';
  message.style.border = type === 'error' ? '1px solid #fca5a5' : '1px solid #bbf7d0';
  setTimeout(() => {
    message.textContent = "";
    message.style.display = 'none';
    message.style.padding = '0';
    message.style.border = 'none';
  }, 5000);
}

// Helper to safely extract timestamp milliseconds from Firestore Timestamp or any date value
function getTimestampMs(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  const d = new Date(value);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

// Render products to table
function renderProductsAdmin(products) {
  const tbody = document.getElementById("products-tbody");
  if (!tbody) return;
  
  tbody.innerHTML = "";
  document.getElementById("products-count").textContent = `(${products.length})`;

    if (products.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 60px; color: #94a3b8;">
          <i class="fas fa-search" style="font-size: 48px; margin-bottom: 16px;"></i>
          <h3>No products found</h3>
          <p>Try a different search term</p>
        </td>
      </tr>
    `;
    return;
  }

  products.forEach(({ id, product }) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td style="width: 100px;">
        <img src="${product.imageUrl || 'https://via.placeholder.com/80x80/6b7280/f9fafb?text=No+Img'}" 
             alt="${product.name}" 
             style="width: 64px; height: 64px; object-fit: cover; border-radius: 10px;"
             onerror="this.src='https://via.placeholder.com/80x80/6b7280/f9fafb?text=No+Img'">
      </td>
      <td>
        <div style="font-size: 16px; font-weight: 600; color: #1e293b;">${product.name}</div>
        ${editId === id ? `<span style="background: #3b82f6; color: white; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 700; margin-top: 4px; display: inline-block;"><i class="fas fa-edit"></i> EDIT MODE</span>` : ''}
      </td>
      <td>
        <span style="background: #e0e7ff; color: #3b82f6; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;">${product.category || '—'}</span>
      </td>
      <td>
        <span style="font-size: 18px; font-weight: 700; color: #059669;">${product.price?.toLocaleString()}F</span>
      </td>
      <td class="action-buttons">
        <button onclick="editProduct('${id}')" class="btn btn-secondary" style="padding: 8px 14px; font-size: 13px;">
          <i class="fas fa-edit"></i> Edit
        </button>
        <button onclick="deleteProduct('${id}')" class="btn btn-danger" style="padding: 8px 14px; font-size: 13px;">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// LOAD PRODUCTS
async function loadProducts() {
  try {
    const tbody = document.getElementById("products-tbody");
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 60px;"><div class="loading"><div class="spinner"></div>Loading...</div></td></tr>';
    
    const snapshot = await getDocs(collection(db, "products"));
    
    allProducts = [];
    snapshot.forEach(docSnap => {
      allProducts.push({ id: docSnap.id, product: docSnap.data() });
    });
    
    if (snapshot.empty) {
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 60px; color: #94a3b8;"><i class="fas fa-box-open" style="font-size: 64px;"></i><h3>No Products</h3><p>Add your first product above</p></td></tr>';
      }
      document.getElementById("products-count").textContent = "(0)";
      return;
    }

    renderProductsAdmin(allProducts);
  } catch (error) {
    console.error("Products error:", error);
    const tbody = document.getElementById("products-tbody");
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px; color: #ef4444;">Products failed to load</td></tr>';
  }
}

// 🔎 Product Search
if (productSearch) {
  productSearch.addEventListener("input", (e) => {
    const term = e.target.value.trim().toLowerCase();
    if (!term) {
      renderProductsAdmin(allProducts);
      return;
    }
    const filtered = allProducts.filter(({ product }) =>
      product.name.toLowerCase().includes(term)
    );
    renderProductsAdmin(filtered);
  });
}

// LOAD ORDERS - ALL USERS ORDERS
async function loadOrders() {
  try {
    ordersContainer.innerHTML = '<div class="loading"><div class="spinner"></div>Loading Orders...</div>';
    
    allOrders = [];
    
    // Read global orders collection
    const snapshot = await getDocs(collection(db, "orders"));
    snapshot.forEach(docSnap => {
      allOrders.push({
        id: docSnap.id,
        ref: docSnap.ref,
        ...docSnap.data()
      });
    });
    
    // Sort by timestamp descending (newest first) — use getTimestampMs for Firestore Timestamp compatibility
    allOrders.sort((a, b) => getTimestampMs(b.timestamp) - getTimestampMs(a.timestamp));
    
    if (allOrders.length === 0) {
      ordersContainer.innerHTML = `
        <div style="text-align: center; padding: 80px; color: #94a3b8;">
          <i class="fas fa-inbox" style="font-size: 64px; margin-bottom: 20px;"></i>
          <h3>No Orders Found</h3>
          <p>Customer orders will appear here.</p>
          <button onclick="loadOrders()" style="margin-top: 16px; padding: 12px 24px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer;">
            Retry
          </button>
        </div>
      `;
      const countBadge = document.getElementById("orders-count");
      if (countBadge) countBadge.textContent = "";
      return;
    }
    
    displayOrders(allOrders);
  } catch (error) {
    console.error("Orders error:", error);
    let msg = error.message || "Unknown error";
    if (msg.toLowerCase().includes("permission")) {
      msg += " — Please ensure the admin user has 'role: admin' in Firestore and the security rules allow admin reads.";
    }
    ordersContainer.innerHTML = `<div style="text-align: center; padding: 40px; color: #ef4444;">
      <i class="fas fa-exclamation-circle" style="font-size: 32px; margin-bottom: 12px;"></i>
      <div>Orders failed: ${msg}</div>
      <button onclick="loadOrders()" style="margin-top: 16px; padding: 12px 24px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer;">
        Retry
      </button>
    </div>`;
  }
}

// Expose loadOrders globally for inline onclick handlers
window.loadOrders = loadOrders;

// Format order timestamp to readable date/time
function formatOrderDate(timestamp) {
  if (!timestamp) return 'N/A';
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return 'N/A';
  }
}

// Display orders helper - Table rows (fallback to cards if table not ready)
function displayOrders(orders) {
  // Update sidebar NEW badge count (pending orders)
  const pendingCount = allOrders.filter(o => (o.status || 'pending') === 'pending').length;
  const ordersCountBadge = document.getElementById('orders-count');
  if (ordersCountBadge) {
    ordersCountBadge.textContent = pendingCount > 0 ? `${pendingCount} NEW` : '';
    ordersCountBadge.style.background = pendingCount > 0 ? '#ef4444' : '#3b82f6';
  }

  const tbody = document.getElementById('orders-tbody');
  if (tbody) {
    tbody.innerHTML = '';
    
    if (orders.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 60px; color: #94a3b8;">
            <i class="fas fa-search" style="font-size: 48px; margin-bottom: 16px;"></i>
            <h3>No orders found</h3>
            <p>Try a different search term</p>
          </td>
        </tr>
      `;
      return;
    }
    
    orders.forEach(order => {
      const status = order.status || 'pending';
      const statusClass = `status-${status}`;
      const statusText = status.toUpperCase();
      const orderId = order.id;
      const shortId = order.id.slice(-6);
      const isNew = order.isNew !== false && status !== 'shipped' && status !== 'delivered';
      const orderDate = formatOrderDate(order.timestamp);

      let itemsSummary = '';
      if (order.items && order.items.length) {
        itemsSummary = order.items.map(item => {
          let variants = [];
          if (item.selectedModel) variants.push(`Model: ${item.selectedModel}`);
          if (item.selectedColor) variants.push(`Color: ${item.selectedColor}`);
          const variantStr = variants.length ? ` (${variants.join(', ')})` : '';
          return `<div style="font-size: 12px; color: #64748b; margin-bottom: 2px;"><strong style="color: #374151;">${item.name}</strong>${variantStr} × ${item.quantity}</div>`;
        }).join('');
      }

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>
          <strong>#${shortId}</strong>
          ${isNew ? `<span style="background: #ef4444; color: white; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 700; margin-left: 6px; text-transform: uppercase;">NEW</span>` : ''}
        </td>
        <td>
          <div><strong>${order.name || 'Customer'}</strong></div>
          <small>${order.phone || 'N/A'}</small>
          <div style="margin-top: 8px; max-width: 200px;">${itemsSummary}</div>
        </td>
        <td>
          <div style="font-size: 13px; color: #374151; font-weight: 500;">${orderDate}</div>
        </td>
        <td><span class="total-amount">${(order.total || 0).toLocaleString()}F</span></td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        <td><span style="text-transform: uppercase; font-weight: 500;">${order.payment || 'Cash'}</span></td>
        <td class="action-buttons">
          <button onclick="updateOrderStatus('${orderId}', 'processed')" class="btn btn-secondary" style="padding: 8px 12px; font-size: 12px; background: #f59e0b;" title="Process">
            <i class="fas fa-cogs"></i>
          </button>
          <button onclick="updateOrderStatus('${orderId}', 'shipped')" class="btn btn-secondary" style="padding: 8px 12px; font-size: 12px;" title="Ship">
            <i class="fas fa-truck"></i>
          </button>
          <button onclick="updateOrderStatus('${orderId}', 'delivered')" class="btn btn-primary" style="padding: 8px 12px; font-size: 12px;" title="Deliver">
            <i class="fas fa-check"></i>
          </button>
          <button onclick="deleteOrder('${orderId}')" class="btn btn-danger" style="padding: 8px 12px; font-size: 12px;" title="Delete">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });
  } else {
    // Fallback - old card style if table not loaded
    ordersContainer.innerHTML = '';
    orders.forEach(order => {
      const status = order.status || 'pending';
      const statusBg = {
        pending: '#fed7aa', shipped: '#dbeafe', delivered: '#dcfce7', cancelled: '#fee2e2'
      }[status] || '#f3f4f6';
      const isNew = order.isNew !== false && status !== 'shipped' && status !== 'delivered';
      const orderDate = formatOrderDate(order.timestamp);

      let itemsSummaryFallback = '';
      if (order.items && order.items.length) {
        itemsSummaryFallback = order.items.map(item => {
          let variants = [];
          if (item.selectedModel) variants.push(`Model: ${item.selectedModel}`);
          if (item.selectedColor) variants.push(`Color: ${item.selectedColor}`);
          const variantStr = variants.length ? ` (${variants.join(', ')})` : '';
          return `<div style="font-size: 13px; color: #64748b; margin-bottom: 4px;">• <strong style="color: #374151;">${item.name}</strong>${variantStr} × ${item.quantity}</div>`;
        }).join('');
      }

      const div = document.createElement("div");
      div.className = "product-card";
      div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 16px;">
          <h3 style="font-size: 20px; font-weight: 600;">#${order.id.slice(-6)}</h3>
          <div style="display: flex; gap: 6px; align-items: center;">
            ${isNew ? `<span style="background: #ef4444; color: white; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700;">NEW</span>` : ''}
            <span style="background: ${statusBg}; color: #64748b; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 600;">
              ${status.toUpperCase()}
            </span>
          </div>
        </div>
        <div style="margin-bottom: 16px;">
          <div style="font-size: 24px; font-weight: 700; color: #059669;">${(order.total || 0).toLocaleString()}F</div>
          <div style="color: #64748b; font-size: 14px; text-transform: uppercase;">${order.payment || 'Cash'}</div>
        </div>
        <div style="background: #f8fafc; padding: 16px; border-radius: 12px; margin-bottom: 16px; font-size: 14px;">
          <strong>${order.name || 'Customer'}</strong><br>
          ${order.phone || ''}<br>
          ${order.address || 'Address'} - ${order.city || ''}<br>
          <small style="color: #94a3b8;"><i class="far fa-clock"></i> ${orderDate}</small>
        </div>
        ${itemsSummaryFallback ? `<div style="margin-bottom: 16px;"><strong style="font-size: 14px; color: #374151;">Items:</strong>${itemsSummaryFallback}</div>` : ''}
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button onclick="updateOrderStatus('${order.id}', 'processed')" class="btn btn-secondary" style="padding: 10px 16px; font-size: 13px; background: #f59e0b;">
            Process
          </button>
          <button onclick="updateOrderStatus('${order.id}', 'shipped')" class="btn btn-secondary" style="padding: 10px 16px; font-size: 13px;">
            Shipped
          </button>
          <button onclick="updateOrderStatus('${order.id}', 'delivered')" class="btn btn-primary" style="padding: 10px 16px; font-size: 13px;">
            Delivered
          </button>
          <button onclick="deleteOrder('${order.id}')" class="btn btn-danger" style="padding: 10px 16px; font-size: 13px;">
            Delete
          </button>
        </div>
      `;
      ordersContainer.appendChild(div);
    });
  }
}

// 🔎 Order Search
if (orderSearch) {
  orderSearch.addEventListener("input", (e) => {
    const term = e.target.value.trim().toLowerCase();
    if (!term) {
      displayOrders(allOrders);
      return;
    }
    const filtered = allOrders.filter(order => {
      const name = (order.name || '').toLowerCase();
      const phone = (order.phone || '').toLowerCase();
      const idShort = order.id.slice(-6).toLowerCase();
      return name.includes(term) || phone.includes(term) || idShort.includes(term);
    });
    displayOrders(filtered);
  });
}

// ─── CUSTOMERS ────────────────────────────────────────────
async function loadCustomers() {
  try {
    const tbody = document.getElementById("customers-tbody");
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 60px;"><div class="loading"><div class="spinner"></div>Loading Customers...</div></td></tr>';

    allCustomers = [];

    // Fetch all users
    const usersSnap = await getDocs(collection(db, "users"));

    for (const userDoc of usersSnap.docs) {
      const userData = userDoc.data();
      const uid = userDoc.id;

      // Fetch user's orders subcollection
      let orders = [];
      let totalSpent = 0;
      try {
        const userOrdersSnap = await getDocs(collection(db, "users", uid, "orders"));
        userOrdersSnap.forEach(doc => {
          const orderData = doc.data();
          orders.push(orderData);
          totalSpent += orderData.total || 0;
        });
      } catch (e) { /* skip if no orders subcollection */ }

      // Also check global orders for this user's uid
      try {
        const globalOrdersSnap = await getDocs(collection(db, "orders"));
        globalOrdersSnap.forEach(doc => {
          const orderData = doc.data();
          if (orderData.uid === uid) {
            // avoid duplicates
            if (!orders.find(o => o.id === doc.id)) {
              orders.push({ id: doc.id, ...orderData });
              totalSpent += orderData.total || 0;
            }
          }
        });
      } catch (e) { /* skip */ }

      allCustomers.push({
        id: uid,
        name: userData.name || userData.displayName || '—',
        email: userData.email || '—',
        phone: userData.phone || '—',
        city: userData.city || userData.address || '—',
        country: userData.country || '—',
        loginCount: userData.loginCount || 0,
        orderCount: orders.length,
        totalSpent: totalSpent
      });
    }

    // Update badge
    const countBadge = document.getElementById("customers-count");
    if (countBadge) countBadge.textContent = `(${allCustomers.length})`;

    renderCustomers(allCustomers);
  } catch (error) {
    console.error("Customers error:", error);
    const tbody = document.getElementById("customers-tbody");
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #ef4444;">Failed to load customers</td></tr>';
  }
}

function renderCustomers(customers) {
  const tbody = document.getElementById("customers-tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (customers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 60px; color: #94a3b8;">
          <i class="fas fa-users" style="font-size: 48px; margin-bottom: 16px;"></i>
          <h3>No customers found</h3>
          <p>Users will appear here once they sign up</p>
        </td>
      </tr>
    `;
    return;
  }

  customers.forEach(customer => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px;">
            ${(customer.name || '?').charAt(0).toUpperCase()}
          </div>
          <div>
            <div style="font-weight: 600; color: #1e293b;">${customer.name}</div>
            <div style="font-size: 12px; color: #64748b;">UID: ${customer.id.slice(-6)}</div>
          </div>
        </div>
      </td>
      <td>
        <div style="font-size: 14px; color: #374151;">${customer.email}</div>
        <div style="font-size: 12px; color: #64748b;">${customer.phone}</div>
      </td>
      <td>
        <div style="font-size: 14px; color: #374151;">${customer.city}</div>
        <div style="font-size: 12px; color: #64748b;">${customer.country}</div>
      </td>
      <td>
        <span style="background: #e0e7ff; color: #3b82f6; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 600;">${customer.orderCount}</span>
      </td>
      <td>
        <span style="font-size: 16px; font-weight: 700; color: #059669;">${customer.totalSpent.toLocaleString()}F</span>
      </td>
      <td>
        <span style="font-size: 14px; color: #64748b;">${customer.loginCount}</span>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// 🔎 Customer Search
if (customerSearch) {
  customerSearch.addEventListener("input", (e) => {
    const term = e.target.value.trim().toLowerCase();
    if (!term) {
      renderCustomers(allCustomers);
      return;
    }
    const filtered = allCustomers.filter(customer =>
      (customer.name || '').toLowerCase().includes(term) ||
      (customer.email || '').toLowerCase().includes(term) ||
      (customer.phone || '').toLowerCase().includes(term)
    );
    renderCustomers(filtered);
  });
}

// Expose loadCustomers globally for inline onclick handlers
window.loadCustomers = loadCustomers;

// Tab switching
window.showTab = function(tabName) {
  currentTab = tabName;
  document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));
  document.querySelectorAll('.sidebar-item').forEach(item => item.classList.remove('active'));

  document.getElementById(tabName + '-section').classList.add('active');
  event.target.classList.add('active');

  if (tabName === 'dashboard') loadDashboard();
  if (tabName === 'products') loadProducts();
  if (tabName === 'orders') loadOrders();
  if (tabName === 'customers') loadCustomers();
};

// ─── DASHBOARD ─────────────────────────────────────────────
async function loadDashboard() {
  try {
    // Fetch products count
    const productsSnap = await getDocs(collection(db, "products"));
    const productCount = productsSnap.size;
    document.getElementById('dash-products').textContent = productCount;

    // Fetch orders
    let orders = [];
    try {
      const ordersSnap = await getDocs(collection(db, "orders"));
      ordersSnap.forEach(doc => orders.push({ id: doc.id, ...doc.data() }));
    } catch (e) { /* no global orders */ }

    if (orders.length === 0) {
      const usersSnap = await getDocs(collection(db, "users"));
      for (const userDoc of usersSnap.docs) {
        try {
          const userOrdersSnap = await getDocs(collection(db, "users", userDoc.id, "orders"));
          userOrdersSnap.forEach(doc => orders.push({ id: doc.id, ...doc.data() }));
        } catch (e) { /* skip */ }
      }
    }

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    const pendingCount = orders.filter(o => (o.status || 'pending') === 'pending').length;

    document.getElementById('dash-orders').textContent = totalOrders;
    document.getElementById('dash-revenue').textContent =totalRevenue.toLocaleString('en-IN') + 'F';
    document.getElementById('dash-pending').textContent = pendingCount;

    // Recent orders (last 5) — sorted newest first using getTimestampMs
    const recentContainer = document.getElementById('dash-recent-orders');
    const sorted = orders.sort((a, b) => getTimestampMs(b.timestamp) - getTimestampMs(a.timestamp)).slice(0, 5);
    if (sorted.length === 0) {
      recentContainer.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8;">No orders yet</div>';
    } else {
      recentContainer.innerHTML = sorted.map(order => {
        const status = order.status || 'pending';
        const statusColors = {
          pending: { bg: '#fed7aa', color: '#92400e' },
          shipped: { bg: '#dbeafe', color: '#1e40af' },
          delivered: { bg: '#dcfce7', color: '#166534' },
          cancelled: { bg: '#fee2e2', color: '#b91c1c' }
        };
        const sc = statusColors[status] || statusColors.pending;
        return `
          <div class="recent-item" style="cursor:pointer;" onclick="showOrderModal('${order.id}')">
            <div class="recent-icon" style="background:${sc.bg};color:${sc.color};">
              <i class="fas fa-shopping-bag"></i>
            </div>
            <div style="flex:1;">
              <div style="font-weight:600;color:#1e293b;">${order.name || 'Customer'}</div>
              <div style="font-size:12px;color:#64748b;">${formatOrderDate(order.timestamp)}</div>
            </div>
            <div style="font-weight:700;color:#059669;">${(order.total || 0).toLocaleString()}F</div>
          </div>
        `;
      }).join('');
    }

    // Status breakdown
    const breakdownContainer = document.getElementById('dash-status-breakdown');
    const counts = { pending: 0, processed: 0, shipped: 0, delivered: 0, cancelled: 0 };
    orders.forEach(o => { counts[o.status || 'pending'] = (counts[o.status || 'pending'] || 0) + 1; });
    const breakdownItems = [
      { key: 'pending', label: 'Pending', icon: 'fa-clock', color: '#92400e', bg: '#fed7aa' },
      { key: 'processed', label: 'Processed', icon: 'fa-cogs', color: '#1e40af', bg: '#dbeafe' },
      { key: 'shipped', label: 'Shipped', icon: 'fa-truck', color: '#166534', bg: '#dcfce7' },
      { key: 'delivered', label: 'Delivered', icon: 'fa-check', color: '#166534', bg: '#dcfce7' },
      { key: 'cancelled', label: 'Cancelled', icon: 'fa-times', color: '#b91c1c', bg: '#fee2e2' }
    ];
    breakdownContainer.innerHTML = breakdownItems.map(item => `
      <div class="recent-item">
        <div class="recent-icon" style="background:${item.bg};color:${item.color};">
          <i class="fas ${item.icon}"></i>
        </div>
        <div style="flex:1;">
          <div style="font-weight:600;color:#1e293b;">${item.label}</div>
        </div>
        <div style="font-weight:700;font-size:18px;color:#1e293b;">${counts[item.key] || 0}</div>
      </div>
    `).join('');

  } catch (error) {
    console.error("Dashboard error:", error);
  }
}

// ─── ORDER FILTERS ─────────────────────────────────────────
window.filterOrders = function(status, btn) {
  currentOrderFilter = status;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  if (status === 'all') {
    displayOrders(allOrders);
  } else {
    const filtered = allOrders.filter(o => (o.status || 'pending') === status);
    displayOrders(filtered);
  }
};

// ─── ORDER DETAIL MODAL ────────────────────────────────────
window.showOrderModal = function(orderId) {
  const order = allOrders.find(o => o.id === orderId);
  if (!order) return;

  const modal = document.getElementById('order-modal');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');

  title.innerHTML = `Order #${order.id.slice(-6)} <span style="font-size:14px;font-weight:500;color:#64748b;margin-left:8px;">${formatOrderDate(order.timestamp)}</span>`;

  let itemsHtml = '';
  if (order.items && order.items.length) {
    itemsHtml = `<div style="margin-bottom:20px;"><div style="font-weight:600;color:#374151;margin-bottom:8px;">Items</div>` +
      order.items.map(item => {
        let v = [];
        if (item.selectedModel) v.push(`Model: ${item.selectedModel}`);
        if (item.selectedColor) v.push(`Color: ${item.selectedColor}`);
        const vs = v.length ? ` <span style="color:#64748b;font-size:12px;">(${v.join(', ')})</span>` : '';
        return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;">
          <div><strong>${item.name}</strong>${vs} × ${item.quantity}</div>
          <div>${((item.price || 0) * item.quantity).toLocaleString()}F</div>
        </div>`;
      }).join('') + `</div>`;
  }

  const statusColors = {
    pending: '#92400e', processed: '#1e40af', shipped: '#1e40af', delivered: '#166534', cancelled: '#b91c1c'
  };
  const statusBg = {
    pending: '#fed7aa', processed: '#dbeafe', shipped: '#dbeafe', delivered: '#dcfce7', cancelled: '#fee2e2'
  };
  const st = order.status || 'pending';

  body.innerHTML = `
    <div class="detail-row">
      <span class="detail-label">Customer</span>
      <span class="detail-value">${order.name || 'N/A'}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Phone</span>
      <span class="detail-value">${order.phone || 'N/A'}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Address</span>
      <span class="detail-value">${order.address || ''} ${order.city || ''} ${order.pincode || ''}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Payment</span>
      <span class="detail-value" style="text-transform:uppercase;">${order.payment || 'Cash'}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Status</span>
      <span style="background:${statusBg[st]};color:${statusColors[st]};padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;text-transform:uppercase;">${st}</span>
    </div>
    ${itemsHtml}
    <div class="detail-row" style="border-top:2px solid #e2e8f0;margin-top:8px;padding-top:16px;">
      <span class="detail-label" style="font-size:16px;">Total Amount</span>
      <span class="detail-value" style="font-size:20px;color:#059669;">${(order.total || 0).toLocaleString()}F</span>
    </div>
  `;

  modal.classList.add('active');
};

window.closeOrderModal = function() {
  document.getElementById('order-modal').classList.remove('active');
};

// DELETE PRODUCT
window.deleteProduct = async function(id) {
  if (confirm("Delete product?")) {
    try {
      await deleteDoc(doc(db, "products", id));
      loadProducts();
      showMessage("Product deleted!", "success");
    } catch (error) {
      showMessage("Delete failed", "error");
    }
  }
};

// Order actions
window.updateOrderStatus = async function(id, status) {
  try {
    // Handle both global and subcollection paths
    const parts = id.split('/');
    if (parts.length >= 4) {
      // subcollection path like users/UID/orders/ORDERID
      await updateDoc(doc(db, ...parts), { status });
    } else {
      // simple id in global orders collection
      await updateDoc(doc(db, "orders", id), { status });
    }
    loadOrders();
  } catch (e) {
    console.error("Update failed:", e);
    alert("Update failed: " + e.message);
  }
};

window.deleteOrder = async function(id) {
  if (confirm("Delete order?")) {
    try {
      const parts = id.split('/');
      if (parts.length >= 4) {
        await deleteDoc(doc(db, ...parts));
      } else {
        await deleteDoc(doc(db, "orders", id));
      }
      loadOrders();
    } catch (e) {
      console.error("Delete failed:", e);
      alert("Delete failed: " + e.message);
    }
  }
};

// INIT - wait for auth before loading any data
onAuthStateChanged(auth, (user) => {
  if (user) {
    loadDashboard();
  }
});

// Add all iPhone models
window.addAlliPhoneModels = function() {
  modelsContainer.innerHTML = '';
  modelCount = 0;
  
  const iphoneModels = [
    'iPhone 17 Pro Max', 'iPhone 17 Pro', 'iPhone 17 Air', 'iPhone 17', 'iPhone 17e', 'iPhone 16e',
    'iPhone 16 Pro Max', 'iPhone 16 Pro', 'iPhone 16 Plus', 'iPhone 16',
    'iPhone 15 Pro Max', 'iPhone 15 Pro', 'iPhone 15 Plus', 'iPhone 15',
    'iPhone 14 Pro Max', 'iPhone 14 Pro', 'iPhone 14 Plus', 'iPhone 14', 'iPhone SE (3ème gén.)',
    'iPhone 13 Pro Max', 'iPhone 13 Pro', 'iPhone 13', 'iPhone 13 mini',
    'iPhone 12 Pro Max', 'iPhone 12 Pro', 'iPhone 12', 'iPhone 12 mini', 'iPhone SE (2ème gén.)',
    'iPhone 11 Pro Max', 'iPhone 11 Pro', 'iPhone 11',
    'iPhone XS Max', 'iPhone XS', 'iPhone XR', 'iPhone X'
  ];
  
  iphoneModels.forEach(model => addModelField(model));
};

// Clear all model fields
window.clearModelFields = function() {
  modelsContainer.innerHTML = '';
  modelCount = 0;
};

