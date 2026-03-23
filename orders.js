// Order History Management
import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { collection, query, where, getDocs, orderBy, addDoc, onSnapshot, doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Maximum total musubi per order (must match cart.js)
const MAX_ORDER_LIMIT = 30;

// Product data (same as cart.js)
const PRODUCTS = {
    'special-musubi': { name: 'Special Musubi', price: 45 },
    'spicy-musubi': { name: 'Spicy Musubi', price: 50 },
    'buldak-musubi': { name: 'Buldak Musubi', price: 55 }
};

// Get DOM elements
const loadingMessage = document.getElementById('loadingMessage');
const noOrdersMessage = document.getElementById('noOrdersMessage');
const ordersList = document.getElementById('ordersList');
const orderModal = document.getElementById('orderModal');
const orderModalTitle = document.getElementById('orderModalTitle');
const orderModalBody = document.getElementById('orderModalBody');

let currentUser = null;
let allOrders = [];
let ordersUnsubscribe = null;

// Make allOrders accessible globally for feedback icon
window.allOrders = allOrders;

// Initialize
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loadOrders();
    } else {
        // Redirect to login if not authenticated
        window.location.href = 'login.html';
    }
});

// Load user orders with real-time updates
function loadOrders() {
    try {
        loadingMessage.style.display = 'block';
        noOrdersMessage.style.display = 'none';
        ordersList.innerHTML = '';

        if (!currentUser) {
            loadingMessage.style.display = 'none';
            noOrdersMessage.style.display = 'block';
            return;
        }

        // Unsubscribe from previous listener if exists
        if (ordersUnsubscribe) {
            ordersUnsubscribe();
        }

        // Query orders for current user, ordered by date (newest first)
        // Use real-time listener for updates
        const ordersRef = collection(db, 'orders');
        const q = query(
            ordersRef,
            where('userId', '==', currentUser.uid),
            orderBy('createdAt', 'desc')
        );
        
        // Set up real-time listener for ALL orders (including Pending)
        ordersUnsubscribe = onSnapshot(q, (snapshot) => {
            loadingMessage.style.display = 'none';
            allOrders = [];
            
            snapshot.forEach((docSnapshot) => {
                const orderData = docSnapshot.data();
                orderData.id = docSnapshot.id;
                // Include ALL orders - no status filtering
                allOrders.push(orderData);
            });
            
            // Update global reference
            window.allOrders = allOrders;

            if (allOrders.length === 0) {
                noOrdersMessage.style.display = 'block';
                ordersList.innerHTML = '';
            } else {
                noOrdersMessage.style.display = 'none';
                displayOrders(allOrders);
            }
        }, (error) => {
            console.error('Error loading orders:', error);
            console.error('Error details:', error);
            loadingMessage.style.display = 'none';
            // Show error message to user
            if (error.code === 'failed-precondition') {
                // Firestore composite index error - user should create index
                alert('Please create a composite index in Firestore for orders (userId, createdAt). Check browser console for details.');
            }
            noOrdersMessage.style.display = 'block';
        });
        
    } catch (error) {
        console.error('Error loading orders:', error);
        loadingMessage.style.display = 'none';
        noOrdersMessage.style.display = 'block';
    }
}

// Display orders
function displayOrders(orders) {
    ordersList.innerHTML = '';
    
    orders.forEach(order => {
        const orderCard = createOrderCard(order);
        ordersList.appendChild(orderCard);
    });
}

// Create order card
function createOrderCard(order) {
    const card = document.createElement('div');
    card.className = 'order-card';
    
    // Format date
    const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt?.seconds * 1000 || Date.now());
    const formattedDate = formatDate(orderDate);
    
    // Get display status (convert "Ready" to "Ready for Pickup" for pickup orders)
    const displayStatus = getDisplayStatus(order);
    const statusBadge = getStatusBadge(displayStatus, order.status);
    
    // Format items list
    const itemsList = order.items.map(item => `${item.quantity}x ${item.name}`).join(', ');
    
    // Calculate delivery fee
    const deliveryFeeText = order.deliveryFee && order.deliveryFee > 0 ? `+ ₱${order.deliveryFee} delivery` : '';
    
    card.innerHTML = `
        <div class="order-card-header">
            <div class="order-id">Order #${order.id.substring(0, 12)}</div>
            ${statusBadge}
        </div>
        <div class="order-card-body">
            <div class="order-items">${itemsList}</div>
            <div class="order-details">
                <span class="order-detail-item">
                    ${order.fulfillmentMethod === 'Delivery' ? '🚚' : '🛍️'} 
                    ${order.fulfillmentMethod || 'Pickup'}
                </span>
                <span class="order-detail-item">
                    📅 ${formattedDate}
                </span>
            </div>
        </div>
        <div class="order-card-footer">
            <div class="order-total">
                ₱${order.total.toFixed(0)}
                ${deliveryFeeText ? `<small>${deliveryFeeText}</small>` : ''}
            </div>
            <div class="order-actions">
                <button class="order-details-btn" onclick="window.orderManager.viewOrderDetails('${order.id}')">View Details</button>
                ${order.status === 'Pending' ? `<button class="edit-order-btn" onclick="window.orderManager.editOrder('${order.id}')">Edit</button>` : ''}
                ${order.status === 'Pending' ? `<button class="cancel-order-btn" onclick="window.orderManager.cancelOrder('${order.id}')">Cancel</button>` : `<button class="cancel-order-btn" disabled style="opacity: 0.5; cursor: not-allowed;">Cancel</button>`}
                ${order.status === 'Completed' ? `<button class="feedback-btn" onclick="window.feedbackManager.openFeedbackModal('${order.id}')">Leave Feedback</button>` : ''}
                ${order.status === 'Completed' ? `<button class="reorder-btn" onclick="window.orderManager.reorder('${order.id}')">Reorder</button>` : ''}
            </div>
        </div>
    `;
    
    return card;
}

// Get display status based on order type and current status
// Map backend status → user display text
function getDisplayStatus(order) {
    const status = (order.status || 'Pending').toLowerCase(); // lowercase para consistent
    const orderType = (order.orderType || (order.fulfillmentMethod?.toLowerCase() === 'delivery' ? 'delivery' : 'pickup')).toLowerCase();

    // Status mapping
    switch (status) {
        case 'pending':
            return 'Pending approval';
        case 'preparing':
            return 'Preparing your order';
        case 'ready':
            if (orderType === 'pickup') return 'Ready for pickup';
            if (orderType === 'delivery') return 'Out for delivery';
            return 'Ready';
        case 'out for delivery':
            return 'Out for delivery';
        case 'completed':
            return 'Completed';
        case 'cancelled':
            return 'Cancelled';
        default:
            return order.status; // fallback
    }
}


// Get status badge HTML
function getStatusBadge(displayStatus, actualStatus) {
    // Use actualStatus for styling, displayStatus for text
    const statusConfig = {
        'Pending': { class: 'status-pending', icon: '⏳', color: '#FFA500' },
        'Preparing': { class: 'status-preparing', icon: '👨‍🍳', color: '#2196F3' },
        'Ready': { class: 'status-ready', icon: '✅', color: '#FFC107' },
        'Out for Delivery': { class: 'status-delivery', icon: '🚚', color: '#9C27B0' },
        'Completed': { class: 'status-completed', icon: '✓', color: '#4CAF50' },
        'Cancelled': { class: 'status-cancelled', icon: '✕', color: '#F44336' }
    };
    
    // Map display statuses back to actual status for styling
    let lookupStatus = actualStatus;
    if (displayStatus === 'Pending approval') lookupStatus = 'Pending';
    else if (displayStatus === 'Preparing your order') lookupStatus = 'Preparing';
    else if (displayStatus === 'Ready for pickup') lookupStatus = 'Ready';
    else if (displayStatus === 'Out for delivery') lookupStatus = 'Out for Delivery';
    else if (displayStatus === 'Completed') lookupStatus = 'Completed';
    
    const config = statusConfig[lookupStatus] || statusConfig[actualStatus] || statusConfig['Pending'];
    
    return `
        <span class="status-badge ${config.class}" style="background-color: ${config.color}20; color: ${config.color}; border: 1px solid ${config.color};">
            ${config.icon} ${displayStatus}
        </span>
    `;
}

// Format date
function formatDate(date) {
    const options = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    };
    return date.toLocaleDateString('en-US', options);
}

// View order details
function viewOrderDetails(orderId) {
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;
    
    const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt?.seconds * 1000 || Date.now());
    const formattedDate = formatDate(orderDate);
    
    const displayStatus = getDisplayStatus(order);
    const statusBadge = getStatusBadge(displayStatus, order.status);
    
    orderModalTitle.innerHTML = `Order #${order.id.substring(0, 12)} ${statusBadge}`;
    
    let itemsHtml = '';
    order.items.forEach(item => {
        itemsHtml += `
            <div class="order-detail-item-row">
                <span>${item.quantity}x ${item.name}</span>
                <span>₱${(item.price * item.quantity).toFixed(0)}</span>
            </div>
        `;
    });
    
    const deliveryFeeText = order.deliveryFee && order.deliveryFee > 0 ? `
        <div class="order-detail-row">
            <span>Delivery Fee</span>
            <span>₱${order.deliveryFee.toFixed(0)}</span>
        </div>
    ` : '';
    
    orderModalBody.innerHTML = `
        <div class="order-detail-section">
            <h3>Items</h3>
            ${itemsHtml}
        </div>
        <div class="order-detail-section">
            <h3>Order Information</h3>
            <div class="order-detail-row">
                <span>Fulfillment Method</span>
                <span>${order.fulfillmentMethod || 'Pickup'}</span>
            </div>
            <div class="order-detail-row">
                <span>Order Date</span>
                <span>${formattedDate}</span>
            </div>
            <div class="order-detail-row">
                <span>Status</span>
                <span>${getDisplayStatus(order) || 'Pending'}</span>
            </div>
        </div>
        <div class="order-detail-section">
            <h3>Summary</h3>
            <div class="order-detail-row">
                <span>Subtotal</span>
                <span>₱${order.subtotal.toFixed(0)}</span>
            </div>
            ${deliveryFeeText}
            <div class="order-detail-row order-detail-total">
                <span>Total</span>
                <span>₱${order.total.toFixed(0)}</span>
            </div>
        </div>
    `;
    
    orderModal.style.display = 'flex';
}

// Close order modal
function closeOrderModal() {
    orderModal.style.display = 'none';
}

// Reorder functionality
async function reorder(orderId) {
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;
    
    // Build cart from order items
    const reorderCart = [];
    
    order.items.forEach(item => {
        // Find product ID
        let productId = Object.keys(PRODUCTS).find(id => PRODUCTS[id].name === item.name);
        if (!productId) {
            productId = item.id || item.name.toLowerCase().replace(/\s+/g, '-');
        }
        
        // Check if product already in cart
        const existingItem = reorderCart.find(cartItem => cartItem.id === productId);
        
        if (existingItem) {
            existingItem.quantity += item.quantity;
        } else {
            reorderCart.push({
                id: productId,
                name: item.name,
                price: item.price,
                quantity: item.quantity
            });
        }
    });
    
    // Save to localStorage
    localStorage.setItem('musubiCart', JSON.stringify(reorderCart));
    
    // Redirect to menu page where cart will load
    window.location.href = 'menu.html';
}

// Close modal when clicking outside
orderModal.addEventListener('click', (e) => {
    if (e.target === orderModal) {
        closeOrderModal();
    }
});

// Edit order functionality
async function editOrder(orderId) {
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;
    
    if (order.status !== 'Pending') {
        showNotification('Only pending orders can be edited.', 'error');
        return;
    }
    
    // Create edit modal
    const editModal = document.createElement('div');
    editModal.className = 'popup-overlay';
    editModal.id = 'editOrderModal';
    editModal.style.display = 'flex';
    
    // Build items HTML for editing
    let itemsHtml = '';
    order.items.forEach((item, index) => {
        itemsHtml += `
            <div class="edit-order-item" data-item-index="${index}">
                <div class="edit-order-item-info">
                    <span class="edit-order-item-name">${item.name}</span>
                    <span class="edit-order-item-price">₱${item.price.toFixed(0)}</span>
                </div>
                <div class="edit-order-item-controls">
                    <button class="edit-qty-btn" onclick="window.orderManager.decreaseItemQty(${index})">-</button>
                    <span class="edit-qty-value">${item.quantity}</span>
                    <button class="edit-qty-btn" onclick="window.orderManager.increaseItemQty(${index})">+</button>
                    <button class="edit-remove-btn" onclick="window.orderManager.removeItemFromEdit(${index})">Remove</button>
                </div>
            </div>
        `;
    });
    
    // Add available products that can be added
    let addProductsHtml = '';
    Object.entries(PRODUCTS).forEach(([productId, product]) => {
        const existingItem = order.items.find(item => item.id === productId || item.name === product.name);
        if (!existingItem) {
            addProductsHtml += `
                <div class="edit-order-add-item" data-product-id="${productId}">
                    <span>${product.name} - ₱${product.price.toFixed(0)}</span>
                    <button class="edit-add-btn" onclick="window.orderManager.addItemToEdit('${productId}')">Add</button>
                </div>
            `;
        }
    });
    
    editModal.innerHTML = `
        <div class="popup-content" style="max-width: 600px;">
            <h2 class="popup-title" style="color: var(--color-dark-brown);">Edit Order</h2>
            <div class="edit-order-items">
                <h3 style="margin-bottom: 1rem; color: var(--color-dark-brown); font-weight: 600;">Current Items</h3>
                <div id="editOrderItemsList">${itemsHtml}</div>
                ${addProductsHtml ? `
                    <h3 style="margin-top: 2rem; margin-bottom: 1rem; color: var(--color-dark-brown); font-weight: 600;">Add Items</h3>
                    <div id="editOrderAddItems">${addProductsHtml}</div>
                ` : ''}
            </div>
            <div class="edit-order-summary" style="margin-top: 2rem; padding-top: 1rem; border-top: 2px solid var(--color-beige);">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; color: var(--color-dark-brown);">
                    <span>Subtotal:</span>
                    <span id="editOrderSubtotal" style="font-weight: 600;">₱${order.subtotal.toFixed(0)}</span>
                </div>
                ${order.deliveryFee > 0 ? `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; color: var(--color-dark-brown);">
                        <span>Delivery Fee:</span>
                        <span style="font-weight: 600;">₱${order.deliveryFee.toFixed(0)}</span>
                    </div>
                ` : ''}
                <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.2rem; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 2px solid var(--color-beige); color: var(--color-dark-brown);">
                    <span>Total:</span>
                    <span id="editOrderTotal" style="color: var(--color-orange);">₱${order.total.toFixed(0)}</span>
                </div>
            </div>
            <div style="display: flex; gap: 0.75rem; margin-top: 2rem;">
                <button class="popup-btn popup-btn-secondary" onclick="window.orderManager.closeEditOrderModal()" style="flex: 1;">Cancel</button>
                <button class="popup-btn" onclick="window.orderManager.saveEditedOrder('${order.id}')" style="flex: 1;">Save Changes</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(editModal);
    
    // Store edit state
    window.editOrderState = {
        orderId: orderId,
        items: JSON.parse(JSON.stringify(order.items)),
        deliveryFee: order.deliveryFee || 0
    };
}

// Edit order state management - use window object for global access
window.editOrderState = null;

// Increase item quantity in edit
function increaseItemQty(index) {
    if (!window.editOrderState) {
        console.error('Edit order state not found');
        return;
    }
    if (window.editOrderState.items[index]) {
        window.editOrderState.items[index].quantity += 1;
        updateEditOrderUI();
    }
}

// Decrease item quantity in edit
function decreaseItemQty(index) {
    if (!window.editOrderState) {
        console.error('Edit order state not found');
        return;
    }
    if (window.editOrderState.items[index]) {
        window.editOrderState.items[index].quantity -= 1;
        if (window.editOrderState.items[index].quantity <= 0) {
            window.editOrderState.items.splice(index, 1);
        }
        updateEditOrderUI();
    }
}

// Remove item from edit
function removeItemFromEdit(index) {
    if (!window.editOrderState) {
        console.error('Edit order state not found');
        return;
    }
    window.editOrderState.items.splice(index, 1);
    updateEditOrderUI();
}

// Add item to edit
function addItemToEdit(productId) {
    if (!window.editOrderState) {
        console.error('Edit order state not found');
        return;
    }
    const product = PRODUCTS[productId];
    if (!product) {
        console.error('Product not found:', productId);
        return;
    }
    
    const existingItem = window.editOrderState.items.find(item => item.id === productId || item.name === product.name);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        window.editOrderState.items.push({
            id: productId,
            name: product.name,
            price: product.price,
            quantity: 1
        });
    }
    updateEditOrderUI();
}

// Update edit order UI
function updateEditOrderUI() {
    if (!window.editOrderState) {
        console.error('Edit order state not found');
        return;
    }
    
    const itemsList = document.getElementById('editOrderItemsList');
    const subtotalEl = document.getElementById('editOrderSubtotal');
    const totalEl = document.getElementById('editOrderTotal');
    const addItemsContainer = document.getElementById('editOrderAddItems');
    
    if (!itemsList) {
        console.error('Items list element not found');
        return;
    }
    
    // Rebuild items list
    let itemsHtml = '';
    window.editOrderState.items.forEach((item, index) => {
        itemsHtml += `
            <div class="edit-order-item" data-item-index="${index}">
                <div class="edit-order-item-info">
                    <span class="edit-order-item-name">${item.name}</span>
                    <span class="edit-order-item-price">₱${item.price.toFixed(0)}</span>
                </div>
                <div class="edit-order-item-controls">
                    <button class="edit-qty-btn" onclick="window.orderManager.decreaseItemQty(${index})">-</button>
                    <span class="edit-qty-value">${item.quantity}</span>
                    <button class="edit-qty-btn" onclick="window.orderManager.increaseItemQty(${index})">+</button>
                    <button class="edit-remove-btn" onclick="window.orderManager.removeItemFromEdit(${index})">Remove</button>
                </div>
            </div>
        `;
    });
    itemsList.innerHTML = itemsHtml;
    
    // Update available products list (remove items that are now in the order)
    if (addItemsContainer) {
        let addProductsHtml = '';
        Object.entries(PRODUCTS).forEach(([productId, product]) => {
            const existingItem = window.editOrderState.items.find(item => item.id === productId || item.name === product.name);
            if (!existingItem) {
                addProductsHtml += `
                    <div class="edit-order-add-item" data-product-id="${productId}">
                        <span>${product.name} - ₱${product.price.toFixed(0)}</span>
                        <button class="edit-add-btn" onclick="window.orderManager.addItemToEdit('${productId}')">Add</button>
                    </div>
                `;
            }
        });
        addItemsContainer.innerHTML = addProductsHtml;
    }
    
    // Recalculate totals
    const subtotal = window.editOrderState.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const total = subtotal + (window.editOrderState.deliveryFee || 0);
    
    if (subtotalEl) subtotalEl.textContent = `₱${subtotal.toFixed(0)}`;
    if (totalEl) totalEl.textContent = `₱${total.toFixed(0)}`;
}

// Save edited order
async function saveEditedOrder(orderId) {
    if (!window.editOrderState || window.editOrderState.items.length === 0) {
        showNotification('Order must have at least one item.', 'error');
        return;
    }

    // Validate total quantity does not exceed limit
    const totalQty = window.editOrderState.items.reduce((sum, item) => sum + item.quantity, 0);
    if (totalQty > MAX_ORDER_LIMIT) {
        showNotification('Max order is 30 only.', 'error');
        return;
    }
    
    try {
        const orderRef = doc(db, 'orders', orderId);
        const subtotal = window.editOrderState.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const total = subtotal + (window.editOrderState.deliveryFee || 0);
        
        await updateDoc(orderRef, {
            items: window.editOrderState.items,
            subtotal: subtotal,
            total: total,
            updatedAt: new Date()
        });
        
        closeEditOrderModal();
        showNotification('Order successfully updated.', 'success');
        
        // Reload orders to reflect changes
        loadOrders();
    } catch (error) {
        console.error('Error updating order:', error);
        showNotification('Error updating order. Please try again.', 'error');
    }
}

// Close edit order modal
function closeEditOrderModal() {
    const modal = document.getElementById('editOrderModal');
    if (modal) {
        modal.remove();
    }
    window.editOrderState = null;
}

// Cancel order functionality
async function cancelOrder(orderId) {
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;
    
    if (order.status !== 'Pending') {
        showNotification('Only pending orders can be cancelled.', 'error');
        return;
    }
    
    // Confirm cancellation
    if (!confirm('Are you sure you want to cancel this order?')) {
        return;
    }
    
    try {
        const orderRef = doc(db, 'orders', orderId);
        await updateDoc(orderRef, {
            status: 'Cancelled',
            updatedAt: new Date()
        });
        
        showNotification('Order cancelled successfully.', 'success');
        
        // Reload orders to reflect changes
        loadOrders();
    } catch (error) {
        console.error('Error cancelling order:', error);
        showNotification('Error cancelling order. Please try again.', 'error');
    }
}

// Show notification popup
function showNotification(message, type = 'success') {
    // Remove existing notification if any
    const existingNotification = document.getElementById('orderNotification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.id = 'orderNotification';
    notification.className = `popup-overlay`;
    notification.style.display = 'flex';
    notification.style.zIndex = '3000';
    
    const bgColor = type === 'success' ? '#D4EDDA' : '#F8D7DA';
    const textColor = type === 'success' ? '#155724' : '#721C24';
    const borderColor = type === 'success' ? '#C3E6CB' : '#F5C6CB';
    
    notification.innerHTML = `
        <div class="popup-content" style="max-width: 400px; background-color: ${bgColor}; border: 1px solid ${borderColor};">
            <p style="color: ${textColor}; font-size: 1rem; margin: 0; text-align: center;">${message}</p>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto close after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 3000);
    
    // Close on click
    notification.addEventListener('click', () => {
        if (notification.parentNode) {
            notification.remove();
        }
    });
}

// ==================== FEEDBACK SYSTEM ====================
// Feedback Manager
const feedbackManager = {
    openFeedbackModal(orderId) {
        const modal = document.getElementById('feedbackModal');
        if (!modal) return;
        
        // Store order ID for feedback submission
        modal.dataset.orderId = orderId;
        
        // Reset form
        const form = document.getElementById('feedbackForm');
        if (form) {
            form.reset();
        }
        
        // Show modal
        modal.style.display = 'flex';
    },
    
    closeFeedbackModal() {
        const modal = document.getElementById('feedbackModal');
        if (modal) {
            modal.style.display = 'none';
        }
    },
    
    async submitFeedback(orderId, rating, feedbackText) {
        if (!currentUser) {
            showNotification('Please log in to submit feedback.', 'error');
            return;
        }
        
        if (!rating || !feedbackText.trim()) {
            showNotification('Please provide both a rating and feedback text.', 'error');
            return;
        }
        
        try {
            const feedbackData = {
                userId: currentUser.uid,
                userEmail: currentUser.email,
                orderId: orderId,
                rating: parseFloat(rating),
                feedback: feedbackText.trim(),
                createdAt: new Date()
            };
            
            const feedbackRef = collection(db, 'feedback');
            await addDoc(feedbackRef, feedbackData);
            
            this.closeFeedbackModal();
            showNotification('Thank you for your feedback!', 'success');
        } catch (error) {
            console.error('Error submitting feedback:', error);
            showNotification('Error submitting feedback. Please try again.', 'error');
        }
    }
};

// Setup feedback form submission
document.addEventListener('DOMContentLoaded', () => {
    const feedbackForm = document.getElementById('feedbackForm');
    if (feedbackForm) {
        feedbackForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const modal = document.getElementById('feedbackModal');
            const orderId = modal?.dataset.orderId;
            const rating = feedbackForm.querySelector('input[name="rating"]:checked')?.value;
            const feedbackText = document.getElementById('feedbackText')?.value;
            
            if (!orderId || !rating || !feedbackText) {
                showNotification('Please fill in all fields.', 'error');
                return;
            }
            
            await feedbackManager.submitFeedback(orderId, rating, feedbackText);
        });
        
        // Update rating display when rating changes
        const ratingInputs = feedbackForm.querySelectorAll('input[name="rating"]');
        const ratingDisplay = document.getElementById('ratingDisplay');
        ratingInputs.forEach(input => {
            input.addEventListener('change', () => {
                if (ratingDisplay) {
                    ratingDisplay.textContent = `Selected: ${input.value} stars`;
                }
            });
        });
    }
    
    // Close feedback modal when clicking outside
    const feedbackModal = document.getElementById('feedbackModal');
    if (feedbackModal) {
        feedbackModal.addEventListener('click', (e) => {
            if (e.target === feedbackModal) {
                feedbackManager.closeFeedbackModal();
            }
        });
    }
});

// Export feedback manager
window.feedbackManager = feedbackManager;

// Export order manager
window.orderManager = {
    viewOrderDetails,
    closeOrderModal,
    reorder,
    loadOrders,
    editOrder,
    cancelOrder,
    increaseItemQty,
    decreaseItemQty,
    removeItemFromEdit,
    addItemToEdit,
    saveEditedOrder,
    closeEditOrderModal
};