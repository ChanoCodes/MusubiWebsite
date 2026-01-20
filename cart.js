// Cart Management System
import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { collection, addDoc, doc, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Product data
const PRODUCTS = {
    'special-musubi': { name: 'Special Musubi', price: 45, id: 'special-musubi' },
    'spicy-musubi': { name: 'Spicy Musubi', price: 50, id: 'spicy-musubi' },
    'buldak-musubi': { name: 'Buldak Musubi', price: 55, id: 'buldak-musubi' }
};

// Cart state
let cart = [];
let currentUser = null;
let selectedOrderType = 'pickup'; // 'pickup' or 'delivery'
let deliveryLocation = 'centro'; // 'centro' or 'outside'
let deliveryAddress = '';

// Initialize cart
function initCart() {
    // Load cart from localStorage
    const savedCart = localStorage.getItem('musubiCart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
    }
    
    // Check if user is logged in
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        if (user) {
            updateCartUI();
        } else {
            // Clear cart if user logs out
            cart = [];
            updateCartUI();
        }
    });
    
    updateCartUI();
    setupAddToCartButtons();
}

// Setup Add to Cart buttons
function setupAddToCartButtons() {
    const addToCartButtons = document.querySelectorAll('.add-to-cart-btn');
    
    addToCartButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Check if user is logged in
            if (!currentUser) {
                // Show popup if exists, otherwise redirect
                const popup = document.getElementById('signupPopup');
                if (popup) {
                    popup.style.display = 'flex';
                } else {
                    window.location.href = 'signup.html';
                }
                return;
            }
            
            // Get product ID from data attribute
            const productId = button.getAttribute('data-product');
            
            if (productId && PRODUCTS[productId]) {
                // Use product data from PRODUCTS object
                const product = PRODUCTS[productId];
                addToCart(product.id, product.name, product.price);
            } else {
                // Fallback: get from DOM
                const card = button.closest('.menu-item-card, .variety-card');
                const titleElement = card?.querySelector('.menu-item-title, .variety-title');
                const priceElement = card?.querySelector('.menu-item-price, .variety-price');
                
                if (titleElement && priceElement) {
                    const productName = titleElement.textContent.trim();
                    const priceText = priceElement.textContent.trim().replace('₱', '').replace('P', '').trim();
                    const price = parseFloat(priceText);
                    
                    // Find product ID
                    let pid = Object.keys(PRODUCTS).find(id => PRODUCTS[id].name === productName);
                    if (!pid) {
                        // Create ID from name
                        pid = productName.toLowerCase().replace(/\s+/g, '-');
                    }
                    
                    addToCart(pid, productName, price);
                }
            }
        });
    });
    
    // Make cart icon clickable
    const cartIcon = document.getElementById('cartIcon');
    if (cartIcon) {
        cartIcon.addEventListener('click', () => {
            if (cart.length > 0) {
                showCartPanel();
            }
        });
    }
}

// Add item to cart
function addToCart(productId, productName, price) {
    const existingItem = cart.find(item => item.id === productId);
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: productId,
            name: productName,
            price: price,
            quantity: 1
        });
    }
    
    saveCart();
    updateCartUI();
    showCartPanel();
}

// Remove item from cart
function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    updateCartUI();
}

// Update item quantity
function updateQuantity(productId, newQuantity) {
    if (newQuantity <= 0) {
        removeFromCart(productId);
        return;
    }
    
    const item = cart.find(item => item.id === productId);
    if (item) {
        item.quantity = newQuantity;
        saveCart();
        updateCartUI();
    }
}

// Save cart to localStorage
function saveCart() {
    localStorage.setItem('musubiCart', JSON.stringify(cart));
}

// Calculate delivery fee based on location
function calculateDeliveryFee(orderType, location) {
    if (orderType === 'pickup') {
        return 0;
    }
    // Delivery fee rules: Centro Libon = 20, Outside Libon = 50
    return location === 'centro' ? 20 : 50;
}

// Calculate totals
function calculateTotals() {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const deliveryFee = calculateDeliveryFee(selectedOrderType, deliveryLocation);
    return {
        subtotal: subtotal,
        deliveryFee: deliveryFee,
        total: subtotal + deliveryFee
    };
}

// Show cart panel
function showCartPanel() {
    const cartPanel = document.getElementById('cartPanel');
    const overlay = document.querySelector('.cart-panel-overlay');
    
    if (cartPanel) {
        if (overlay) overlay.style.display = 'block';
        cartPanel.style.display = 'flex';
        setTimeout(() => {
            cartPanel.classList.add('show');
        }, 10);
    }
}

// Hide cart panel
function hideCartPanel() {
    const cartPanel = document.getElementById('cartPanel');
    const overlay = document.querySelector('.cart-panel-overlay');
    
    if (cartPanel) {
        if (overlay) overlay.style.display = 'none';
        cartPanel.classList.remove('show');
        setTimeout(() => {
            cartPanel.style.display = 'none';
        }, 300);
    }
}

// Update cart UI
function updateCartUI() {
    updateCartIcon();
    updateCartPanel();
}

// Update cart icon visibility
function updateCartIcon() {
    const cartIcon = document.getElementById('cartIcon');
    const cartBadge = document.getElementById('cartBadge');
    
    if (cartIcon) {
        if (cart.length > 0 && currentUser) {
            cartIcon.style.display = 'flex';
            if (cartBadge) {
                const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
                cartBadge.textContent = totalItems;
                cartBadge.style.display = totalItems > 0 ? 'flex' : 'none';
            }
        } else {
            cartIcon.style.display = 'none';
            if (cartBadge) {
                cartBadge.style.display = 'none';
            }
        }
    }
}

// Add delivery/pickup selection UI to cart panel footer
function addDeliveryPickupSelection() {
    const cartPanelFooter = document.querySelector('.cart-panel-footer');
    if (!cartPanelFooter) return;
    
    // Check if selection UI already exists
    let selectionSection = document.getElementById('cartDeliveryPickupSelection');
    if (!selectionSection) {
        // Create selection section
        selectionSection = document.createElement('div');
        selectionSection.id = 'cartDeliveryPickupSelection';
        selectionSection.className = 'cart-delivery-pickup-selection';
        
        // Insert before cart summary
        const cartSummary = cartPanelFooter.querySelector('.cart-summary');
        if (cartSummary) {
            cartPanelFooter.insertBefore(selectionSection, cartSummary);
        } else {
            cartPanelFooter.insertBefore(selectionSection, cartPanelFooter.firstChild);
        }
    }
    
    // Update selection UI
    const totals = calculateTotals();
    selectionSection.innerHTML = `
        <div class="cart-order-type-section">
            <label class="cart-order-type-label">Order Type</label>
            <div class="cart-order-type-options">
                <label class="cart-order-type-option">
                    <input type="radio" name="orderType" value="pickup" ${selectedOrderType === 'pickup' ? 'checked' : ''}>
                    <span>Pickup</span>
                </label>
                <label class="cart-order-type-option">
                    <input type="radio" name="orderType" value="delivery" ${selectedOrderType === 'delivery' ? 'checked' : ''}>
                    <span>Delivery</span>
                </label>
            </div>
        </div>
        <div class="cart-delivery-section" id="cartDeliverySection" style="display: ${selectedOrderType === 'delivery' ? 'block' : 'none'};">
            <label class="cart-delivery-location-label">Location</label>
            <select class="cart-delivery-location-select" id="cartDeliveryLocation">
                <option value="centro" ${deliveryLocation === 'centro' ? 'selected' : ''}>Around Centro Libon (+₱20)</option>
                <option value="outside" ${deliveryLocation === 'outside' ? 'selected' : ''}>Outside Libon (+₱50)</option>
            </select>
            <label class="cart-delivery-address-label">Delivery Address</label>
            <input type="text" class="cart-delivery-address-input" id="cartDeliveryAddress" placeholder="Enter your delivery address" value="${deliveryAddress}">
        </div>
    `;
    
    // Add event listeners
    const orderTypeInputs = selectionSection.querySelectorAll('input[name="orderType"]');
    orderTypeInputs.forEach(input => {
        input.addEventListener('change', (e) => {
            selectedOrderType = e.target.value;
            const deliverySection = document.getElementById('cartDeliverySection');
            if (deliverySection) {
                deliverySection.style.display = selectedOrderType === 'delivery' ? 'block' : 'none';
            }
            updateCartPanel(); // Recalculate totals
        });
    });
    
    const locationSelect = document.getElementById('cartDeliveryLocation');
    if (locationSelect) {
        locationSelect.addEventListener('change', (e) => {
            deliveryLocation = e.target.value;
            updateCartPanel(); // Recalculate totals
        });
    }
    
    const addressInput = document.getElementById('cartDeliveryAddress');
    if (addressInput) {
        addressInput.addEventListener('input', (e) => {
            deliveryAddress = e.target.value;
        });
    }
}

// Update cart panel content
function updateCartPanel() {
    const cartItemsContainer = document.getElementById('cartItems');
    const cartSubtotal = document.getElementById('cartSubtotal');
    const cartTotal = document.getElementById('cartTotal');
    const emptyCartMessage = document.getElementById('emptyCartMessage');
    
    if (!cartItemsContainer) return;
    
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '';
        if (emptyCartMessage) {
            emptyCartMessage.style.display = 'block';
        }
        if (cartSubtotal) cartSubtotal.textContent = '₱0';
        if (cartTotal) cartTotal.textContent = '₱0';
        // Hide delivery/pickup selection when cart is empty
        const selectionSection = document.getElementById('cartDeliveryPickupSelection');
        if (selectionSection) selectionSection.style.display = 'none';
        return;
    }
    
    if (emptyCartMessage) {
        emptyCartMessage.style.display = 'none';
    }
    
    const totals = calculateTotals();
    cartItemsContainer.innerHTML = '';
    
    cart.forEach(item => {
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';
        cartItem.innerHTML = `
            <div class="cart-item-image">
                <div class="cart-image-placeholder ${item.id}"></div>
            </div>
            <div class="cart-item-details">
                <h3 class="cart-item-name">${item.name}</h3>
                <p class="cart-item-price">₱${item.price}</p>
            </div>
            <div class="cart-item-controls">
                <button class="cart-qty-btn" onclick="window.cartManager.updateQuantity('${item.id}', ${item.quantity - 1})">-</button>
                <span class="cart-qty-value">${item.quantity}</span>
                <button class="cart-qty-btn cart-qty-btn-plus" onclick="window.cartManager.updateQuantity('${item.id}', ${item.quantity + 1})">+</button>
            </div>
        `;
        cartItemsContainer.appendChild(cartItem);
    });
    
    // Add/update delivery/pickup selection section
    addDeliveryPickupSelection();
    const selectionSection = document.getElementById('cartDeliveryPickupSelection');
    if (selectionSection) selectionSection.style.display = 'block';
    
    if (cartSubtotal) cartSubtotal.textContent = `₱${totals.subtotal.toFixed(0)}`;
    
    // Update delivery fee display in summary
    let deliveryFeeRow = document.getElementById('cartDeliveryFee');
    if (!deliveryFeeRow && totals.deliveryFee > 0) {
        const cartSummary = document.querySelector('.cart-summary');
        if (cartSummary) {
            deliveryFeeRow = document.createElement('div');
            deliveryFeeRow.id = 'cartDeliveryFee';
            deliveryFeeRow.className = 'cart-summary-row';
            const cartTotalRow = cartSummary.querySelector('.cart-total-row');
            if (cartTotalRow) {
                cartSummary.insertBefore(deliveryFeeRow, cartTotalRow);
            } else {
                cartSummary.appendChild(deliveryFeeRow);
            }
        }
    }
    
    if (deliveryFeeRow) {
        if (selectedOrderType === 'delivery' && totals.deliveryFee > 0) {
            deliveryFeeRow.style.display = 'flex';
            deliveryFeeRow.innerHTML = `
                <span>Delivery Fee</span>
                <span>₱${totals.deliveryFee.toFixed(0)}</span>
            `;
        } else {
            deliveryFeeRow.style.display = 'none';
        }
    }
    
    if (cartTotal) cartTotal.textContent = `₱${totals.total.toFixed(0)}`;
}

// Pre-order functionality
async function preOrder() {
    if (!currentUser) {
        alert('Please log in to place an order.');
        return;
    }
    
    if (cart.length === 0) {
        alert('Your cart is empty.');
        return;
    }
    
    // Get user info from Firestore
    let userInfo = null;
    try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
            userInfo = userDoc.data();
        }
    } catch (error) {
        console.error('Error fetching user info:', error);
    }
    
    // Validate delivery address if delivery is selected
    if (selectedOrderType === 'delivery') {
        const addressInput = document.getElementById('cartDeliveryAddress');
        if (addressInput) {
            deliveryAddress = addressInput.value.trim();
        }
        if (!deliveryAddress) {
            alert('Please enter a delivery address.');
            return;
        }
    }
    
    // Calculate delivery fee based on location
    const deliveryFee = calculateDeliveryFee(selectedOrderType, deliveryLocation);
    const totals = calculateTotals();
    
    // Create order object with delivery/pickup information
    const order = {
        userId: currentUser.uid,
        userName: userInfo?.name || currentUser.email,
        userEmail: currentUser.email,
        items: cart.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity
        })),
        subtotal: totals.subtotal,
        total: totals.total,
        deliveryFee: deliveryFee,
        orderType: selectedOrderType, // 'pickup' or 'delivery'
        fulfillmentMethod: selectedOrderType === 'delivery' ? 'Delivery' : 'Pickup',
        address: selectedOrderType === 'delivery' ? deliveryAddress : null,
        status: 'Pending',
        createdAt: new Date(),
        updatedAt: new Date()
    };
    
    try {
        // Save order to Firestore
        const ordersRef = collection(db, 'orders');
        await addDoc(ordersRef, order);
        
        // Clear cart
        cart = [];
        saveCart();
        updateCartUI();
        hideCartPanel();
        
        // Show success message
        alert('Successfully pre-ordered!');
        
        // Redirect to orders page
        window.location.href = 'orders.html';
        
    } catch (error) {
        console.error('Error creating order:', error);
        alert('Error placing order. Please try again.');
    }
}

// Export cart manager functions
window.cartManager = {
    addToCart,
    removeFromCart,
    updateQuantity,
    showCartPanel,
    hideCartPanel,
    preOrder,
    updateCartUI,
    getCart: () => cart,
    setCart: (newCart) => {
        cart = newCart;
        saveCart();
        updateCartUI();
    }
};

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCart);
} else {
    initCart();
}

