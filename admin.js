// Admin Dashboard Management
import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { collection, query, where, getDocs, doc, updateDoc, orderBy, onSnapshot, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Admin email identifier
const ADMIN_EMAIL = 'admin@gmail.com';

// Get DOM elements
const tabs = document.querySelectorAll('.admin-tab');
const tabContents = document.querySelectorAll('.admin-tab-content');
const logoutBtn = document.getElementById('logoutBtn');
const messageDiv = document.getElementById('message');

// Tab switching
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const targetTab = tab.getAttribute('data-tab');
        
        // Update active tab
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Update active content
        tabContents.forEach(content => content.classList.remove('active'));
        document.getElementById(`${targetTab}Tab`).classList.add('active');
        
        // Load tab data
        loadTabData(targetTab);
    });
});

// Check if admin is logged in
function checkAdminAccess() {
    const isAdminSession = sessionStorage.getItem('isAdmin') === 'true';
    const adminEmailSession = sessionStorage.getItem('adminEmail');
    
    if (isAdminSession && adminEmailSession === ADMIN_EMAIL) {
        // Admin is logged in via session, load initial tab
        loadTabData('orders');
        return;
    }
    
    // No admin session found, check Firebase Auth state
    const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (sessionStorage.getItem('isAdmin') === 'true') {
            unsubscribe();
            return;
        }
        
        if (user) {
            unsubscribe();
            window.location.href = 'index.html';
        } else {
            unsubscribe();
            window.location.href = 'login.html';
        }
    });
}

// Load tab data based on active tab
function loadTabData(tabName) {
    switch(tabName) {
        case 'orders':
            loadOrders();
            break;
        case 'analytics':
            loadAnalytics();
            break;
        case 'users':
            loadUsers();
            break;
        case 'feedback':
            loadFeedback();
            break;
        case 'settings':
            loadSettings();
            break;
    }
}

// ==================== ORDERS TAB ====================
let ordersUnsubscribe = null;
let allOrdersData = [];
let currentFilter = 'all';

async function loadOrders() {
    try {
        document.getElementById('ordersLoading').style.display = 'block';
        document.getElementById('ordersEmpty').style.display = 'none';
        document.getElementById('ordersTable').style.display = 'none';
        
        // Set up real-time listener
        const ordersRef = collection(db, 'orders');
        const q = query(ordersRef, orderBy('createdAt', 'desc'));
        
        // Unsubscribe from previous listener
        if (ordersUnsubscribe) {
            ordersUnsubscribe();
        }
        
        ordersUnsubscribe = onSnapshot(q, (snapshot) => {
            allOrdersData = [];
            snapshot.forEach((doc) => {
                const orderData = doc.data();
                orderData.id = doc.id;
                allOrdersData.push(orderData);
            });
            
            displayOrders(allOrdersData);
        }, (error) => {
            console.error('Error loading orders:', error);
            document.getElementById('ordersLoading').style.display = 'none';
            showMessage('Error loading orders. Please refresh.', 'error', 'message');
        });
        
        // Setup filter buttons
        setupOrderFilters();
        
    } catch (error) {
        console.error('Error loading orders:', error);
        document.getElementById('ordersLoading').style.display = 'none';
        showMessage('Error loading orders. Please refresh.', 'error', 'message');
    }
}

function setupOrderFilters() {
    const filterBtns = document.querySelectorAll('[data-filter]');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.getAttribute('data-filter');
            displayOrders(allOrdersData);
        });
    });
}

function displayOrders(orders) {
    const loadingEl = document.getElementById('ordersLoading');
    const emptyEl = document.getElementById('ordersEmpty');
    const tableEl = document.getElementById('ordersTable');
    const tbody = document.getElementById('ordersTableBody');
    
    loadingEl.style.display = 'none';
    
    // Filter orders
    const filteredOrders = currentFilter === 'all' 
        ? orders 
        : orders.filter(order => order.status === currentFilter);
    
    if (filteredOrders.length === 0) {
        emptyEl.style.display = 'block';
        tableEl.style.display = 'none';
        return;
    }
    
    emptyEl.style.display = 'none';
    tableEl.style.display = 'table';
    tbody.innerHTML = '';
    
    filteredOrders.forEach(order => {
        const row = createOrderRow(order);
        tbody.appendChild(row);
    });
}

function createOrderRow(order) {
    const row = document.createElement('tr');
    
    const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt?.seconds * 1000 || Date.now());
    const formattedDate = formatDate(orderDate);
    
    const itemsList = order.items?.map(item => `${item.quantity}x ${item.name}`).join(', ') || 'N/A';
    const statusBadge = getOrderStatusBadge(order.status);
    
    // Get order type for display (use orderType field if available, otherwise use fulfillmentMethod)
    const orderType = order.orderType || (order.fulfillmentMethod?.toLowerCase() === 'delivery' ? 'delivery' : 'pickup');
    const fulfillmentMethodDisplay = orderType === 'delivery' ? 'Delivery' : 'Pickup';
    
    const actions = getOrderActions(order);
    
    row.innerHTML = `
        <td>#${order.id.substring(0, 12)}</td>
        <td>${order.userName || order.userEmail || 'N/A'}</td>
        <td>${itemsList}</td>
        <td>₱${order.total?.toFixed(0) || '0'}</td>
        <td>${fulfillmentMethodDisplay}</td>
        <td>${statusBadge}</td>
        <td>${formattedDate}</td>
        <td>${actions}</td>
    `;
    
    // Add event listeners to action buttons
    setTimeout(() => {
        setupOrderActionListeners(row, order);
    }, 100);
    
    return row;
}

function getOrderStatusBadge(status) {
    const configs = {
        'Pending': { icon: '⏳', color: '#FFA500', bg: '#FFF3CD' },
        'Preparing': { icon: '👨‍🍳', color: '#2196F3', bg: '#D1ECF1' },
        'Ready': { icon: '✅', color: '#FFC107', bg: '#FFF3CD' },
        'Out for Delivery': { icon: '🚚', color: '#9C27B0', bg: '#E7D4F8' },
        'Completed': { icon: '✓', color: '#4CAF50', bg: '#D4EDDA' },
        'Cancelled': { icon: '✕', color: '#F44336', bg: '#F8D7DA' }
    };
    
    const config = configs[status] || configs['Pending'];
    
    return `<span class="status-badge" style="background-color: ${config.bg}; color: ${config.color}; border: 1px solid ${config.color};">
        ${config.icon} ${status}
    </span>`;
}

function getOrderActions(order) {
    if (order.status === 'Pending') {
        return `
            <button class="btn btn-success btn-small" data-action="accept" data-order-id="${order.id}">Accept</button>
            <button class="btn btn-danger btn-small" data-action="reject" data-order-id="${order.id}">Reject</button>
        `;
    } else if (order.status === 'Preparing') {
        return `<button class="btn btn-primary btn-small" data-action="ready" data-order-id="${order.id}">Mark Ready</button>`;
    } else if (order.status === 'Ready') {
        // Ready status is only for pickup orders (delivery orders go directly to "Out for Delivery")
        // For pickup orders in Ready status, show Complete button
        const orderType = order.orderType || (order.fulfillmentMethod?.toLowerCase() === 'delivery' ? 'delivery' : 'pickup');
        if (orderType === 'pickup') {
            return `<button class="btn btn-success btn-small" data-action="complete" data-order-id="${order.id}">Complete</button>`;
        } else {
            // This shouldn't happen, but if it does, show complete button
            return `<button class="btn btn-success btn-small" data-action="complete" data-order-id="${order.id}">Complete</button>`;
        }
    } else if (order.status === 'Out for Delivery') {
        return `<button class="btn btn-success btn-small" data-action="complete" data-order-id="${order.id}">Complete</button>`;
    }
    return '-';
}

function setupOrderActionListeners(row, order) {
    const acceptBtn = row.querySelector('[data-action="accept"]');
    const rejectBtn = row.querySelector('[data-action="reject"]');
    const readyBtn = row.querySelector('[data-action="ready"]');
    const deliveryBtn = row.querySelector('[data-action="delivery"]');
    const completeBtn = row.querySelector('[data-action="complete"]');
    
    if (acceptBtn) {
        acceptBtn.addEventListener('click', () => updateOrderStatus(order.id, 'Preparing'));
    }
    if (rejectBtn) {
        rejectBtn.addEventListener('click', () => updateOrderStatus(order.id, 'Cancelled'));
    }
    if (readyBtn) {
        readyBtn.addEventListener('click', () => {
            // When admin clicks "Mark Ready", check orderType:
            // - If pickup: status = "Ready" (user sees "Ready for Pickup")
            // - If delivery: status = "Out for Delivery" (user sees "Out for Delivery")
            const orderType = order.orderType || (order.fulfillmentMethod?.toLowerCase() === 'delivery' ? 'delivery' : 'pickup');
            const newStatus = orderType === 'delivery' ? 'Out for Delivery' : 'Ready';
            updateOrderStatus(order.id, newStatus);
        });
    }
    if (deliveryBtn) {
        deliveryBtn.addEventListener('click', () => updateOrderStatus(order.id, 'Out for Delivery'));
    }
    if (completeBtn) {
        completeBtn.addEventListener('click', () => updateOrderStatus(order.id, 'Completed'));
    }
}

async function updateOrderStatus(orderId, newStatus) {
    try {
        const orderRef = doc(db, 'orders', orderId);
        await updateDoc(orderRef, {
            status: newStatus,
            updatedAt: new Date()
        });
        
        showMessage(`Order status updated to "${newStatus}"`, 'success', 'message');
    } catch (error) {
        console.error('Error updating order status:', error);
        showMessage('Error updating order status. Please try again.', 'error', 'message');
    }
}

// ==================== ANALYTICS TAB ====================
async function loadAnalytics() {
    try {
        document.getElementById('analyticsLoading').style.display = 'block';
        document.getElementById('analyticsContent').style.display = 'none';
        
        // Load all orders for analytics
        const ordersRef = collection(db, 'orders');
        const snapshot = await getDocs(ordersRef);
        
        const orders = [];
        snapshot.forEach(doc => {
            orders.push(doc.data());
        });
        
        calculateAnalytics(orders);
        
        document.getElementById('analyticsLoading').style.display = 'none';
        document.getElementById('analyticsContent').style.display = 'block';
        
    } catch (error) {
        console.error('Error loading analytics:', error);
        document.getElementById('analyticsLoading').style.display = 'none';
        showMessage('Error loading analytics. Please refresh.', 'error', 'settingsMessage');
    }
}

function calculateAnalytics(orders) {
    // Today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Today's orders and revenue
    const todayOrders = orders.filter(order => {
        const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt?.seconds * 1000 || 0);
        orderDate.setHours(0, 0, 0, 0);
        return orderDate.getTime() === today.getTime();
    });
    
    const todayRevenue = todayOrders.reduce((sum, order) => sum + (order.total || 0), 0);
    
    // Pending orders
    const pendingOrders = orders.filter(order => order.status === 'Pending').length;
    
    // Cancellation rate
    const totalOrders = orders.length;
    const cancelledOrders = orders.filter(order => order.status === 'Cancelled').length;
    const cancellationRate = totalOrders > 0 ? ((cancelledOrders / totalOrders) * 100).toFixed(1) : 0;
    
    // Best-selling items
    const itemCounts = {};
    orders.forEach(order => {
        if (order.items) {
            order.items.forEach(item => {
                const itemName = item.name;
                if (itemCounts[itemName]) {
                    itemCounts[itemName] += item.quantity;
                } else {
                    itemCounts[itemName] = item.quantity;
                }
            });
        }
    });
    
    const bestSellers = Object.entries(itemCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
    
    // Update UI
    document.getElementById('todayOrders').textContent = todayOrders.length;
    document.getElementById('todayRevenue').textContent = `₱${todayRevenue.toFixed(0)}`;
    document.getElementById('pendingOrders').textContent = pendingOrders;
    document.getElementById('cancellationRate').textContent = `${cancellationRate}%`;
    
    // Display best sellers
    const bestSellersList = document.getElementById('bestSellersList');
    if (bestSellers.length > 0) {
        bestSellersList.innerHTML = bestSellers.map(([name, count], index) => `
            <div style="padding: 1rem; background: #F9F9F9; border-radius: 8px; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
                <span><strong>#${index + 1}</strong> ${name}</span>
                <span style="color: #FF6B35; font-weight: bold;">${count} sold</span>
            </div>
        `).join('');
    } else {
        bestSellersList.innerHTML = '<p style="color: #666;">No sales data available yet.</p>';
    }
}

// ==================== USERS TAB ====================
let userFilter = 'pending';

async function loadUsers() {
    try {
        document.getElementById('usersLoading').style.display = 'block';
        document.getElementById('usersEmpty').style.display = 'none';
        document.getElementById('usersTable').style.display = 'none';
        
        // Setup user filter buttons
        setupUserFilters();
        
        // Load users
        const usersRef = collection(db, 'users');
        let q;
        
        if (userFilter === 'pending') {
            q = query(usersRef, where('approved', '==', false));
        } else {
            q = query(usersRef);
        }
        
        const snapshot = await getDocs(q);
        const users = [];
        
        snapshot.forEach(doc => {
            const userData = doc.data();
            userData.id = doc.id;
            users.push(userData);
        });
        
        // Load order counts for each user
        for (let user of users) {
            const ordersRef = collection(db, 'orders');
            const userOrdersQuery = query(ordersRef, where('userId', '==', user.uid || user.id));
            const userOrdersSnapshot = await getDocs(userOrdersQuery);
            
            user.totalOrders = userOrdersSnapshot.size;
            user.cancellations = userOrdersSnapshot.docs.filter(doc => doc.data().status === 'Cancelled').length;
        }
        
        displayUsers(users);
        
        document.getElementById('usersLoading').style.display = 'none';
        
    } catch (error) {
        console.error('Error loading users:', error);
        document.getElementById('usersLoading').style.display = 'none';
        showMessage('Error loading users. Please refresh.', 'error', 'usersMessage');
    }
}

function setupUserFilters() {
    const filterBtns = document.querySelectorAll('[data-user-filter]');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            userFilter = btn.getAttribute('data-user-filter');
            loadUsers();
        });
    });
}

function displayUsers(users) {
    const emptyEl = document.getElementById('usersEmpty');
    const tableEl = document.getElementById('usersTable');
    const tbody = document.getElementById('usersTableBody');
    
    if (users.length === 0) {
        emptyEl.style.display = 'block';
        tableEl.style.display = 'none';
        return;
    }
    
    emptyEl.style.display = 'none';
    tableEl.style.display = 'table';
    tbody.innerHTML = '';
    
    users.forEach(user => {
        const row = createUserRow(user);
        tbody.appendChild(row);
    });
}

function createUserRow(user) {
    const row = document.createElement('tr');
    
    const isBlocked = user.blocked || false;
    const warningText = user.cancellations >= 3 ? '⚠️ Warning (3+ cancellations)' : '';
    const statusBadge = user.approved 
        ? '<span class="status-badge status-completed">Approved</span>'
        : '<span class="status-badge status-pending">Pending</span>';
    
    const actions = user.approved
        ? `
            ${isBlocked 
                ? `<button class="btn btn-success btn-small" onclick="window.adminManager.unblockUser('${user.id}')">Unblock</button>`
                : `<button class="btn btn-danger btn-small" onclick="window.adminManager.blockUser('${user.id}')">Block</button>`
            }
        `
        : `<button class="btn btn-success btn-small" onclick="window.adminManager.approveUser('${user.id}', '${user.name || 'User'}')">Approve</button>`;
    
    row.innerHTML = `
        <td>${user.name || 'N/A'}</td>
        <td>${user.email || 'N/A'}</td>
        <td>${user.username || 'N/A'}</td>
        <td>${user.totalOrders || 0}</td>
        <td>${user.cancellations || 0} ${warningText}</td>
        <td>${statusBadge} ${isBlocked ? '<span style="color: red;">(Blocked)</span>' : ''}</td>
        <td>${actions}</td>
    `;
    
    return row;
}

async function approveUser(userId, userName) {
    try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            approved: true
        });
        
        showMessage(`User "${userName}" approved successfully!`, 'success', 'usersMessage');
        loadUsers(); // Reload users
    } catch (error) {
        console.error('Error approving user:', error);
        showMessage('Error approving user. Please try again.', 'error', 'usersMessage');
    }
}

async function blockUser(userId) {
    try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            blocked: true
        });
        
        showMessage('User blocked successfully!', 'success', 'usersMessage');
        loadUsers();
    } catch (error) {
        console.error('Error blocking user:', error);
        showMessage('Error blocking user. Please try again.', 'error', 'usersMessage');
    }
}

async function unblockUser(userId) {
    try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            blocked: false
        });
        
        showMessage('User unblocked successfully!', 'success', 'usersMessage');
        loadUsers();
    } catch (error) {
        console.error('Error unblocking user:', error);
        showMessage('Error unblocking user. Please try again.', 'error', 'usersMessage');
    }
}

// ==================== FEEDBACK TAB ====================
let feedbackFilter = 'all';
let allFeedbackData = [];

async function loadFeedback() {
    try {
        document.getElementById('feedbackLoading').style.display = 'block';
        document.getElementById('feedbackEmpty').style.display = 'none';
        document.getElementById('feedbackList').style.display = 'none';
        
        // Load feedback from Firestore
        const feedbackRef = collection(db, 'feedback');
        const q = query(feedbackRef, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        
        allFeedbackData = [];
        snapshot.forEach((doc) => {
            const feedbackData = doc.data();
            feedbackData.id = doc.id;
            allFeedbackData.push(feedbackData);
        });
        
        // Setup filter buttons
        setupFeedbackFilters();
        
        displayFeedback(allFeedbackData);
        
        document.getElementById('feedbackLoading').style.display = 'none';
        
    } catch (error) {
        console.error('Error loading feedback:', error);
        document.getElementById('feedbackLoading').style.display = 'none';
        showMessage('Error loading feedback. Please refresh.', 'error', 'feedbackMessage');
    }
}

function setupFeedbackFilters() {
    const filterBtns = document.querySelectorAll('[data-feedback-filter]');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            feedbackFilter = btn.getAttribute('data-feedback-filter');
            displayFeedback(allFeedbackData);
        });
    });
}

function displayFeedback(feedbackList) {
    const emptyEl = document.getElementById('feedbackEmpty');
    const listEl = document.getElementById('feedbackList');
    
    // Filter feedback
    let filteredFeedback = feedbackList;
    if (feedbackFilter === '5') {
        filteredFeedback = feedbackList.filter(f => f.rating === 5);
    } else if (feedbackFilter === '4') {
        filteredFeedback = feedbackList.filter(f => f.rating >= 4);
    } else if (feedbackFilter === '3') {
        filteredFeedback = feedbackList.filter(f => f.rating >= 3);
    } else if (feedbackFilter === 'low') {
        filteredFeedback = feedbackList.filter(f => f.rating < 3);
    }
    
    if (filteredFeedback.length === 0) {
        emptyEl.style.display = 'block';
        listEl.style.display = 'none';
        return;
    }
    
    emptyEl.style.display = 'none';
    listEl.style.display = 'block';
    
    // Display feedback
    listEl.innerHTML = '';
    filteredFeedback.forEach(feedback => {
        const feedbackCard = createFeedbackCard(feedback);
        listEl.appendChild(feedbackCard);
    });
}

function createFeedbackCard(feedback) {
    const card = document.createElement('div');
    card.className = 'feedback-card';
    card.style.cssText = 'background-color: #ffffff; border-radius: 12px; padding: 1.5rem; margin-bottom: 1rem; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);';
    
    const feedbackDate = feedback.createdAt?.toDate ? feedback.createdAt.toDate() : new Date(feedback.createdAt?.seconds * 1000 || Date.now());
    const formattedDate = formatDate(feedbackDate);
    
    // Create star display
    const stars = generateStars(feedback.rating);
    
    card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
            <div>
                <div style="font-weight: 600; color: #333; margin-bottom: 0.5rem;">${feedback.userEmail || 'Anonymous'}</div>
                <div style="font-size: 0.9rem; color: #666;">${formattedDate}</div>
            </div>
            <div style="font-size: 1.5rem; color: #FFC107;">${stars}</div>
        </div>
        <div style="color: #333; line-height: 1.6; margin-bottom: 0.5rem;">${feedback.feedback || 'No feedback text provided.'}</div>
        ${feedback.orderId ? `<div style="font-size: 0.85rem; color: #666;">Order ID: #${feedback.orderId.substring(0, 12)}</div>` : ''}
    `;
    
    return card;
}

function generateStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    let stars = '';
    
    for (let i = 0; i < fullStars; i++) {
        stars += '★';
    }
    
    if (hasHalfStar) {
        stars += '½';
    }
    
    const emptyStars = 5 - Math.ceil(rating);
    for (let i = 0; i < emptyStars; i++) {
        stars += '☆';
    }
    
    return stars;
}

// ==================== SETTINGS TAB ====================
async function loadSettings() {
    try {
        document.getElementById('settingsLoading').style.display = 'block';
        document.getElementById('settingsForm').style.display = 'none';
        
        // Load settings from Firestore
        const settingsRef = doc(db, 'settings', 'app');
        const settingsDoc = await getDoc(settingsRef);
        
        if (settingsDoc.exists()) {
            const settings = settingsDoc.data();
            document.getElementById('freeDeliveryToggle').checked = settings.freeDeliveryCentroLibon || false;
            document.getElementById('minOrderQuantity').value = settings.minOrderQuantity || 1;
            document.getElementById('deliveryFee').value = settings.deliveryFee || 50;
        } else {
            // Default settings
            document.getElementById('freeDeliveryToggle').checked = true;
            document.getElementById('minOrderQuantity').value = 1;
            document.getElementById('deliveryFee').value = 50;
        }
        
        document.getElementById('settingsLoading').style.display = 'none';
        document.getElementById('settingsForm').style.display = 'block';
        
    } catch (error) {
        console.error('Error loading settings:', error);
        document.getElementById('settingsLoading').style.display = 'none';
        showMessage('Error loading settings. Please refresh.', 'error', 'settingsMessage');
    }
}

// Save settings
document.getElementById('settingsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        const settings = {
            freeDeliveryCentroLibon: document.getElementById('freeDeliveryToggle').checked,
            minOrderQuantity: parseInt(document.getElementById('minOrderQuantity').value) || 1,
            deliveryFee: parseFloat(document.getElementById('deliveryFee').value) || 50,
            updatedAt: new Date()
        };
        
        const settingsRef = doc(db, 'settings', 'app');
        await setDoc(settingsRef, settings, { merge: true });
        
        showMessage('Settings saved successfully!', 'success', 'settingsMessage');
    } catch (error) {
        console.error('Error saving settings:', error);
        showMessage('Error saving settings. Please try again.', 'error', 'settingsMessage');
    }
});

// ==================== UTILITY FUNCTIONS ====================
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

function showMessage(message, type, elementId = 'message') {
    const msgEl = document.getElementById(elementId);
    if (msgEl) {
        msgEl.textContent = message;
        msgEl.className = `message message-${type}`;
        
        if (type === 'success') {
            setTimeout(() => {
                msgEl.className = 'message';
                msgEl.textContent = '';
            }, 3000);
        }
    }
}

// Handle logout
logoutBtn.addEventListener('click', async () => {
    try {
        sessionStorage.removeItem('isAdmin');
        sessionStorage.removeItem('adminEmail');
        
        try {
            await signOut(auth);
        } catch (authError) {
            // Ignore auth errors (admin doesn't use Firebase Auth)
        }
        
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Error signing out:', error);
        sessionStorage.removeItem('isAdmin');
        sessionStorage.removeItem('adminEmail');
        window.location.href = 'login.html';
    }
});

// Export admin manager functions
window.adminManager = {
    approveUser,
    blockUser,
    unblockUser,
    updateOrderStatus
};

// Initialize on page load
checkAdminAccess();
