// Homepage Logout Functionality
import { auth } from './firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// Get DOM elements
const logoutBtn = document.getElementById('logoutBtn');
const logoutModal = document.getElementById('logoutModal');
const cancelLogoutBtn = document.getElementById('cancelLogoutBtn');
const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');

// Check if user is logged in and show/hide logout button
onAuthStateChanged(auth, (user) => {
    if (user) {
        if (logoutBtn) {
            logoutBtn.style.display = 'block';
        }
    } else {
        if (logoutBtn) {
            logoutBtn.style.display = 'none';
        }
    }
});

// Show logout confirmation modal
function showLogoutModal() {
    if (logoutModal) {
        logoutModal.style.display = 'flex';
    }
}

// Hide logout confirmation modal
function hideLogoutModal() {
    if (logoutModal) {
        logoutModal.style.display = 'none';
    }
}

// Handle logout button click
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        showLogoutModal();
    });
}

// Handle cancel logout
if (cancelLogoutBtn) {
    cancelLogoutBtn.addEventListener('click', () => {
        hideLogoutModal();
    });
}

// Handle confirm logout
if (confirmLogoutBtn) {
    confirmLogoutBtn.addEventListener('click', async () => {
        try {
            await signOut(auth);
            sessionStorage.clear();
            localStorage.removeItem('musubiCart');
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Error signing out:', error);
            alert('Error logging out. Please try again.');
        }
    });
}

// Close modal when clicking outside
if (logoutModal) {
    logoutModal.addEventListener('click', (e) => {
        if (e.target === logoutModal) {
            hideLogoutModal();
        }
    });
}

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && logoutModal && logoutModal.style.display === 'flex') {
        hideLogoutModal();
    }
});
