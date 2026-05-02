import { db, auth } from "./firebase.js";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

const container = document.getElementById("product-details");
const breadcrumbName = document.getElementById("breadcrumb-name");
const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toast-message");
const relatedSection = document.getElementById("related-section");
const relatedGrid = document.getElementById("related-grid");

let selectedModel = null;
let selectedColor = null;
let productData = null;
let hasModels = false;
let hasColors = false;

const params = new URLSearchParams(window.location.search);
const id = params.get("id");

// 🔧 CONFIG: Replace with your WhatsApp business number (with country code, no + or spaces)
// Example: "223XXXXXXXX" for Mali (+223)
const WHATSAPP_NUMBER = "918296497428"; // Your WhatsApp business number

// Toast notification
function showToast(message) {
  if (!toast || !toastMessage) return;
  toastMessage.textContent = message;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

// Show skeleton loading
function showSkeleton() {
  if (!container) return;
  container.innerHTML = `
    <div class="skeleton-detail">
      <div class="skeleton skeleton-image-box"></div>
      <div>
        <div class="skeleton skeleton-text-lg"></div>
        <div class="skeleton skeleton-text-md"></div>
        <div class="skeleton skeleton-text-sm"></div>
        <div class="skeleton skeleton-text-sm" style="width: 80%;"></div>
        <div class="skeleton skeleton-text-sm" style="width: 60%;"></div>
        <div class="skeleton-btn-row">
          <div class="skeleton skeleton-btn-lg"></div>
          <div class="skeleton skeleton-btn-lg"></div>
        </div>
      </div>
    </div>
  `;
}

async function loadProduct() {
  if (!id) {
    renderError("Produit introuvable", "L'identifiant du produit est manquant dans l'URL.");
    return;
  }

  try {
    showSkeleton();

    const docRef = doc(db, "products", id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      renderError("Produit introuvable", "Ce produit a peut-être été retiré ou supprimé.");
      return;
    }

    productData = docSnap.data();
    hasModels = !!(productData.models && productData.models.length > 0);
    hasColors = !!(productData.colors && productData.colors.length > 0);

    renderProduct();
    setupEventListeners();
    updateActionButtons();
    updateWhatsAppButton();
    loadRelatedProducts();

  } catch (error) {
    console.error(error);
    renderError("Failed to load", error.message);
  }
}

// 🎯 Load Related Products (same category, excluding current)
async function loadRelatedProducts() {
  if (!productData || !productData.category || !relatedGrid || !relatedSection) return;

  try {
    const snapshot = await getDocs(collection(db, "products"));
    const related = [];

    snapshot.forEach((docSnap) => {
      if (docSnap.id === id) return;
      const data = docSnap.data();
      if (data.category === productData.category) {
        related.push({ id: docSnap.id, ...data });
      }
    });

    if (related.length === 0) return;

    // Shuffle and take up to 4
    const shuffled = related.sort(() => 0.5 - Math.random()).slice(0, 4);

    relatedGrid.innerHTML = '';
    shuffled.forEach((product) => {
      const card = document.createElement('a');
      card.className = 'related-card';
      card.href = `product.html?id=${product.id}`;
      card.innerHTML = `
        <img src="${product.imageUrl}" alt="${product.name}" onerror="this.src='https://via.placeholder.com/300x300/e2e8f0/94a3b8?text=No+Image'">
        <div class="related-info">
          <h4>${product.name}</h4>
          <div class="related-price">${Number(product.price).toLocaleString('en-IN')}F</div>
        </div>
      `;
      relatedGrid.appendChild(card);
    });

    relatedSection.style.display = 'block';
  } catch (error) {
    console.error("Related products error:", error);
  }
}

function renderProduct() {
  const { name, price, imageUrl, description, models, colors } = productData;

  if (breadcrumbName) {
    breadcrumbName.textContent = name;
    document.title = `${name} — Boutique`;
  }

  // Debug log
  console.log('Rendering product:', name);
  console.log('hasColors:', hasColors, 'colors:', colors);

  container.innerHTML = `
    <div class="product-detail-grid">
      <div class="product-image-section">
        <div class="product-image-wrapper">
          <img src="${imageUrl}" alt="${name}" onerror="this.src='https://via.placeholder.com/600x600/e2e8f0/94a3b8?text=No+Image'">
        </div>
      </div>

      <div class="product-info-section">
        <h1 class="product-title">${name}</h1>
        <div class="product-price-large">${parseFloat(price).toLocaleString('en-IN')}F</div>
        ${description ? `<p class="product-description">${description}</p>` : ''}

${hasModels ? `
          <div class="variant-section active">
            <div class="variant-title">Choisissez un modèle <span>*</span></div>
            <button onclick="showModelSelectorModal()" id="model-open-modal-btn" class="btn btn-outline" style="width:100%; padding:16px 24px; font-size:1rem;">
              <i class="fas fa-th-large"></i> <span id="model-open-modal-text">Tous les modèles</span>
              <i class="fas fa-chevron-down" style="margin-left:auto;"></i>
            </button>
          </div>
        ` : ''}

${hasColors ? `
          <div class="variant-section active">
            <div class="variant-title">choisissez une couleur <span>*</span></div>
            <div class="colors-grid" id="colors-grid"></div>
          </div>
        ` : ''}

        <div class="selected-info-box" id="selected-info">
          <i class="fas fa-info-circle"></i>
          <div id="selected-details"></div>
        </div>

        <div class="action-buttons">
          <button id="add-to-cart-btn" class="btn btn-primary" ${hasModels || hasColors ? 'disabled' : ''}>
            <i class="fas fa-cart-plus"></i>
            <span>${hasModels ? 'Select a model' : hasColors ? 'Select a color' : 'Ajouter au panier'}</span>
          </button>
          <button id="buy-now-btn" class="btn btn-accent" ${hasModels || hasColors ? 'disabled' : ''}>
            <i class="fas fa-bolt"></i>
            <span>${hasModels ? 'Select a model' : hasColors ? 'Select a color' : 'Acheter maintenant'}</span>
          </button>
          <a href="index.html" style="flex:1;">
            <button class="btn btn-secondary" style="width:100%;">
              <i class="fas fa-arrow-left"></i> Boutique
            </button>
          </a>
        </div>
      </div>
    </div>
  `;

  // Render colors AFTER HTML is inserted
  if (hasColors && colors && colors.length > 0) {
    const colorsGrid = document.getElementById('colors-grid');
    console.log('colorsGrid element:', colorsGrid);
    
    if (colorsGrid) {
      // Clear any existing content
      colorsGrid.innerHTML = '';
      
      // Show all colors
      colors.forEach((color, index) => {
        console.log('Rendering color:', color, 'at index:', index);
        
        const button = document.createElement('button');
        button.className = 'color-option';
        button.style.backgroundColor = color.toLowerCase();
        button.dataset.color = color;
        button.dataset.index = index;
        button.title = color;
        button.setAttribute('aria-label', `Select ${color} color`);
        
        // Add color name label below the color circle
        const label = document.createElement('span');
        label.className = 'color-label';
        label.textContent = color;
        label.style.display = 'block';
        label.style.fontSize = '11px';
        label.style.marginTop = '4px';
        label.style.color = 'var(--text-secondary)';
        
        // Wrap in a container for better layout
        const wrapper = document.createElement('div');
        wrapper.className = 'color-option-wrapper';
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';
        wrapper.style.alignItems = 'center';
        wrapper.style.gap = '2px';
        wrapper.appendChild(button);
        wrapper.appendChild(label);
        
        colorsGrid.appendChild(wrapper);
      });
      
      console.log('Colors rendered:', colorsGrid.children.length);
    } else {
      console.error('colorsGrid not found in DOM');
    }
  }
}

function renderError(title, message) {
  if (!container) return;
  container.innerHTML = `
    <div class="error-state">
      <i class="fas fa-box-open"></i>
      <h2>${title}</h2>
      <p>${message}</p>
      <a href="index.html"><i class="fas fa-arrow-left"></i> Retour à la boutique</a>
    </div>
  `;
  if (breadcrumbName) breadcrumbName.textContent = "Introuvable";
}

function setupEventListeners() {
  // Model selection
  container.addEventListener('change', (e) => {
    if (e.target.name === 'model') {
      selectedModel = e.target.value;
      document.querySelectorAll('.model-option').forEach(el => {
        el.classList.toggle('selected', el.dataset.value === selectedModel);
      });
      updateSelectedInfo();
      updateActionButtons();
    }
  });

// Color selection
  container.addEventListener('click', (e) => {
    const colorOption = e.target.closest('.color-option');
    if (colorOption) {
      // Remove selected from all options
      document.querySelectorAll('.color-option').forEach(btn => btn.classList.remove('selected'));
      // Remove selected from all wrappers
      document.querySelectorAll('.color-option-wrapper').forEach(w => w.classList.remove('selected'));
      
      // Add selected to clicked option
      colorOption.classList.add('selected');
      
      // Add selected to wrapper if exists
      const wrapper = colorOption.closest('.color-option-wrapper');
      if (wrapper) wrapper.classList.add('selected');
      
      selectedColor = colorOption.dataset.color;
      updateSelectedInfo();
      updateActionButtons();
    }
  });

  // Add to cart
  const btn = document.getElementById('add-to-cart-btn');
  if (btn) btn.addEventListener('click', addToCart);

  // Buy now
  const buyBtn = document.getElementById('buy-now-btn');
  if (buyBtn) buyBtn.addEventListener('click', buyNow);
}

function updateSelectedInfo() {
  const info = document.getElementById('selected-info');
  const details = document.getElementById('selected-details');

  if (!info || !details) return;

  let text = [];
  if (selectedModel) text.push(`<strong>Model:</strong> ${selectedModel}`);
  if (selectedColor) text.push(`<strong>Color:</strong> ${selectedColor}`);

  if (text.length) {
    details.innerHTML = text.join('<br>');
    info.classList.add('active');
  } else {
    info.classList.remove('active');
  }
}

function updateActionButtons() {
  const addBtn = document.getElementById('add-to-cart-btn');
  const buyBtn = document.getElementById('buy-now-btn');

  const missingModel = hasModels && !selectedModel;
  const missingColor = hasColors && !selectedColor;

  let msg = '';
  if (missingModel && missingColor) msg = 'Sélectionnez le modèle et la couleur';
  else if (missingModel) msg = 'Sélectionnez un modèle';
  else if (missingColor) msg = 'Sélectionnez une couleur';

  if (addBtn) {
    if (missingModel || missingColor) {
      addBtn.disabled = true;
      addBtn.innerHTML = `<i class="fas fa-exclamation-circle"></i><span>${msg}</span>`;
    } else {
      addBtn.disabled = false;
      addBtn.innerHTML = `<i class="fas fa-cart-plus"></i><span>Ajouter au panier</span>`;
    }
  }

  if (buyBtn) {
    if (missingModel || missingColor) {
      buyBtn.disabled = true;
      buyBtn.innerHTML = `<i class="fas fa-exclamation-circle"></i><span>${msg}</span>`;
    } else {
      buyBtn.disabled = false;
      buyBtn.innerHTML = `<i class="fas fa-bolt"></i><span>Acheter maintenant</span>`;
    }
  }
}

// 💬 Update WhatsApp floating button with product info
function updateWhatsAppButton() {
  const waBtn = document.getElementById('whatsapp-btn');
  if (!waBtn || !productData) return;

  const { name, price, imageUrl } = productData;
  const productUrl = window.location.href;

  let message = `Bonjour, je suis intéressé par ce produit :\n\n`;
  message += `*Nom* : ${name}\n`;
  message += `*Prix* : ${parseFloat(price).toLocaleString('en-IN')}F\n`;
  if (selectedModel) message += `*Modèle* : ${selectedModel}\n`;
  if (selectedColor) message += `*Couleur* : ${selectedColor}\n`;
  message += `\n*Image* : ${imageUrl}\n`;
  message += `*Lien* : ${productUrl}`;

  const encodedMessage = encodeURIComponent(message);
  waBtn.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`;
}

// Also update WhatsApp message when model/color changes
const originalUpdateSelectedInfo = updateSelectedInfo;
updateSelectedInfo = function() {
  originalUpdateSelectedInfo();
  updateWhatsAppButton();
};

window.addToCart = async function () {
  try {
    const user = auth.currentUser;
    if (!user) {
      showToast("Please login first");
      setTimeout(() => window.location.href = "login.html", 1500);
      return;
    }

    const missingModel = hasModels && !selectedModel;
    const missingColor = hasColors && !selectedColor;
    if (missingModel || missingColor) {
      showToast(missingModel && missingColor ? "Sélectionnez le modèle et la couleur" :
        missingModel ? "Choisissez un modèle" : "Choisissez une couleur");
      return;
    }

    const cartRef = doc(db, "users", user.uid, "cart", id);
    const cartSnap = await getDoc(cartRef);

    const cartItem = {
      name: productData.name,
      price: productData.price,
      imageUrl: productData.imageUrl,
      quantity: 1,
      selectedModel,
      selectedColor
    };

    if (cartSnap.exists()) {
      const data = cartSnap.data();
      if (data.selectedModel === selectedModel && data.selectedColor === selectedColor) {
        cartItem.quantity = data.quantity + 1;
      }
      await setDoc(cartRef, cartItem);
    } else {
      await setDoc(cartRef, cartItem);
    }

    const selections = [];
    if (selectedModel) selections.push(`Model: ${selectedModel}`);
    if (selectedColor) selections.push(`Color: ${selectedColor}`);
    showToast(`${productData.name} Ajouté au panier!`);

  } catch (error) {
    console.error("Cart Error:", error);
    showToast("Error adding to cart");
  }
};

window.buyNow = async function () {
  try {
    const user = auth.currentUser;
    if (!user) {
      showToast("Please login first");
      setTimeout(() => window.location.href = "login.html", 1500);
      return;
    }

    const missingModel = hasModels && !selectedModel;
    const missingColor = hasColors && !selectedColor;
    if (missingModel || missingColor) {
      showToast(missingModel && missingColor ? "Sélectionnez le modèle et la couleur" :
        missingModel ? "Choisissez un modèle" : "Choisissez une couleur");
      return;
    }

    const cartRef = doc(db, "users", user.uid, "cart", id);
    const cartItem = {
      name: productData.name,
      price: productData.price,
      imageUrl: productData.imageUrl,
      quantity: 1,
      selectedModel,
      selectedColor
    };
    await setDoc(cartRef, cartItem);

    window.location.href = "checkout.html";

  } catch (error) {
    console.error("Buy Now Error:", error);
    showToast("Erreur lors du traitement de l'achat immédiat");
  }
};

// Show generic model selection modal (works for ALL models, not just iPhone)
window.showModelSelectorModal = function() {
  const modal = document.getElementById('model-elector-modal');
  if (modal) { modal.remove(); }
  if (!productData || !productData.models || !productData.models.length) return;

  // Inject modal styles once
  if (!document.getElementById('modal-styles')) {
    const style = document.createElement('style');
    style.id = 'modal-styles';
    style.textContent = `
      .modal-overlay {
        position:fixed;top:0;left:0;right:0;bottom:0;
        background:rgba(15,23,42,0.6);
        backdrop-filter:blur(8px);
        -webkit-backdrop-filter:blur(8px);
        display:flex;align-items:flex-end;justify-content:center;
        z-index:99999;padding:0;
        animation:modalFadeIn 0.3s cubic-bezier(0.4,0,0.2,1);
      }
      @keyframes modalFadeIn { from{opacity:0} to{opacity:1} }
      .modal-sheet {
        background:#fff;
        border-radius:24px 24px 0 0;
        max-width:560px;width:100%;
        max-height:85vh;
        display:flex;flex-direction:column;
        box-shadow:0 -10px 40px rgba(15,23,42,0.2);
        animation:modalSlideUp 0.4s cubic-bezier(0.4,0,0.2,1);
      }
      @keyframes modalSlideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
      .modal-handle {
        width:40px;height:4px;
        background:#e2e8f0;border-radius:2px;
        margin:12px auto 0;
        flex-shrink:0;
      }
      .modal-header {
        padding:20px 24px 16px;
        display:flex;justify-content:space-between;align-items:flex-start;
        flex-shrink:0;border-bottom:1px solid #f1f5f9;
      }
      .modal-header-title {
        font-size:1.1rem;font-weight:700;color:#0f172a;
        display:flex;align-items:center;gap:10px;
      }
      .modal-header-title i { color:var(--primary); font-size:1rem; }
      .modal-subtitle {
        font-size:0.8rem;color:#94a3b8;margin-top:2px;
        display:block;
      }
      .modal-close {
        width:36px;height:36px;border-radius:50%;border:none;
        background:#f1f5f9;cursor:pointer;
        display:flex;align-items:center;justify-content:center;
        color:#64748b;font-size:14px;
        transition:all 0.2s;flex-shrink:0;
      }
      .modal-close:hover { background:#fee2e2;color:#ef4444; }
      .modal-search {
        padding:12px 16px;flex-shrink:0;
      }
      .modal-search-input {
        width:100%;padding:12px 16px 12px 42px;
        border:2px solid #e2e8f0;border-radius:14px;
        font-size:0.95rem;font-family:inherit;
        background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%2394a3b8' viewBox='0 0 16 16'%3E%3Cpath d='M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z'/%3E%3C/svg%3E") no-repeat 14px center;
        outline:none;transition:border-color 0.2s;
      }
      .modal-search-input:focus { border-color:var(--primary); }
      .modal-list {
        padding:8px 16px 24px;
        display:flex;flex-direction:column;
        gap:6px;overflow-y:auto;flex:1;
      }
      .model-modal-item {
        display:flex;align-items:center;gap:12px;
        padding:14px 18px;
        background:#fff;
        border:2px solid #e2e8f0;
        border-radius:14px;cursor:pointer;
        font-size:0.95rem;font-weight:500;color:#0f172a;
        text-align:left;width:100%;
        transition:all 0.2s cubic-bezier(0.4,0,0.2,1);
      }
      .model-modal-item:hover {
        border-color:var(--primary);background:#e0e7ff;
        transform:translateX(4px);
      }
      .model-modal-item.selected {
        border-color:var(--primary);background:var(--primary);
        color:#fff;
      }
      .model-modal-item .check-icon {
        margin-left:auto;font-size:1rem;
        color:var(--primary);opacity:0;
        transition:opacity 0.2s;
      }
      .model-modal-item.selected .check-icon { opacity:1;color:#fff; }
      .model-modal-item .item-badge {
        font-size:0.7rem;padding:3px 8px;border-radius:20px;
        background:#f1f5f9;color:#64748b;font-weight:600;
      }
      .model-modal-item.selected .item-badge {
        background:rgba(255,255,255,0.25);color:#fff;
      }
      .modal-footer {
        padding:12px 24px 24px;
        flex-shrink:0;
      }
      .modal-apply-btn {
        width:100%;padding:16px;border-radius:14px;
        background:var(--primary);color:#fff;
        font-size:1rem;font-weight:600;font-family:inherit;
        border:none;cursor:pointer;
        transition:all 0.2s;display:flex;
        align-items:center;justify-content:center;gap:8px;
      }
      .modal-apply-btn:hover {
        background:var(--primary-dark);
        transform:translateY(-1px);
        box-shadow:0 4px 12px rgba(79,70,229,0.35);
      }
      @media(min-width:560px) {
        .modal-overlay { align-items:center;padding:20px; }
        .modal-sheet { border-radius:24px;max-height:75vh; }
        .modal-handle { display:none; }
      }
    `;
    document.head.appendChild(style);
  }

  const modalEl = document.createElement('div');
  modalEl.id = 'model-selector-modal';
  modalEl.className = 'modal-overlay';
  modalEl.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <div>
          <div class="modal-header-title">
            <i class="fas fa-th-large"></i> Choisir un modèle
          </div>
          <span class="modal-subtitle">${productData.name}</span>
        </div>
        <button class="modal-close" onclick="closeModelSelectorModal()">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="modal-search">
        <input type="text" id="model-search-input" class="modal-search-input"
          placeholder="Rechercher un modèle..." autocomplete="off">
      </div>
      <div id="model-selector-list" class="modal-list">
        ${productData.models.map(m => {
          const isSelected = selectedModel === m;
          return `<button onclick="selectModelFromModal('${m.replace(/'/g, "\\'")}')"
            class="model-modal-item ${isSelected ? 'selected' : ''}"
            data-model="${m.toLowerCase()}">
            ${isSelected ? '<i class="fas fa-check-circle check-icon"></i>' : ''}
            ${m}
          </button>`;
        }).join('')}
      </div>
      <div class="modal-footer">
        <button class="modal-apply-btn" onclick="closeModelSelectorModal()">
          <i class="fas fa-check"></i> Appliquer
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modalEl);

  // Close on overlay click
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) closeModelSelectorModal();
  });

  // Search/filter functionality
  const searchInput = document.getElementById('model-search-input');
  const list = document.getElementById('model-selector-list');
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    list.querySelectorAll('.model-modal-item').forEach(item => {
      const match = item.dataset.model.includes(query);
      item.style.display = match ? '' : 'none';
    });
  });
};

window.closeModelSelectorModal = function() {
  const m = document.getElementById('model-selector-modal');
  if (m) m.remove();
};

window.selectModelFromModal = function(model) {
  selectedModel = model;
  const btn = document.getElementById('model-open-modal-btn');
  const text = document.getElementById('model-open-modal-text');
  if (btn) { btn.classList.add('selected'); btn.style.borderColor = 'var(--primary)'; }
  if (text) { text.textContent = model; }
  closeModelSelectorModal();
  updateSelectedInfo();
  updateActionButtons();
};

loadProduct();

