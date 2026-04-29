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

  container.innerHTML = `
    <div class="product-detail-grid">
      <div class="product-image-section">
        <div class="product-image-wrapper">
          <img src="${imageUrl}" alt="${name}" onerror="this.src='https://via.placeholder.com/600x600/e2e8f0/94a3b8?text=No+Image'">
        </div>
      </div>

      <div class="product-info-section">
        <h1 class="product-title">${name}</h1>
        ${productData.category ? `<div style="display:inline-block;background:var(--primary-light);color:var(--primary);padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;margin-bottom:10px;">${productData.category}</div>` : ''}
        <div class="product-price-large">${parseFloat(price).toLocaleString('en-IN')}F</div>
        ${description ? `<p class="product-description">${description}</p>` : ''}

        ${hasModels ? `
          <div class="variant-section active">
            <div class="variant-title">Sélectionner un modèle <span>*</span></div>
            <div class="models-grid" id="models-grid"></div>
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
          <button id="add-to-cart-btn" class="btn btn-primary" ${hasModels ? 'disabled' : ''}>
            <i class="fas fa-cart-plus"></i>
            <span>${hasModels ? 'Select a model' : 'Ajouter au panier'}</span>
          </button>
          <button id="buy-now-btn" class="btn btn-accent" ${hasModels ? 'disabled' : ''}>
            <i class="fas fa-bolt"></i>
            <span>${hasModels ? 'Select a model' : 'Acheter maintenant'}</span>
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

  // Render models
  if (hasModels && models) {
    const modelsGrid = document.getElementById('models-grid');
    models.forEach((model, index) => {
      const div = document.createElement('div');
      div.className = 'model-option';
      div.dataset.value = model;
      div.innerHTML = `
        <input type="radio" name="model" id="model-${index}" value="${model}" style="margin: 0;">
        <label for="model-${index}" style="cursor: pointer; margin: 0;">${model}</label>
      `;
      modelsGrid.appendChild(div);
    });
  }

  // Render colors
  if (hasColors && colors) {
    const colorsGrid = document.getElementById('colors-grid');
    colors.slice(0, 4).forEach((color, index) => {
      const button = document.createElement('button');
      button.className = 'color-option';
      button.style.backgroundColor = color.toLowerCase();
      button.dataset.color = color;
      button.dataset.index = index;
      button.title = color;
      colorsGrid.appendChild(button);
    });
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
    if (e.target.classList.contains('color-option')) {
      document.querySelectorAll('.color-option').forEach(btn => btn.classList.remove('selected'));
      e.target.classList.add('selected');
      selectedColor = e.target.dataset.color;
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

loadProduct();

