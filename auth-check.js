// Firebase Configuration
// Using firebase.js for config
import { auth } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// Get popup elements (may not exist on all pages)
const signupPopup = document.getElementById('signupPopup');
const goToSignupBtn = document.getElementById('goToSignupBtn');
const goToLoginBtn = document.getElementById('goToLoginBtn');
const closePopupBtn = document.getElementById('closePopupBtn');

// Get Order Now buttons
const orderNowButtons = document.querySelectorAll('.order-now-btn, .hero-order-btn');

// Get Add to Cart buttons (for menu page)
const addToCartButtons = document.querySelectorAll('.add-to-cart-btn');

// Function to show popup
function showSignupPopup() {
    if (signupPopup) {
        signupPopup.style.display = 'flex';
    } else {
        // If popup doesn't exist, redirect directly to signup
        window.location.href = 'signup.html';
    }
}

// Function to hide popup
function hideSignupPopup() {
    if (signupPopup) {
        signupPopup.style.display = 'none';
    }
}

// Function to check if user is authenticated
function checkAuthAndRedirect() {
    return new Promise((resolve) => {
        // Wait for auth state to be ready
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe(); // Unsubscribe after first check
            resolve(!!user); // Return true if user exists, false otherwise
        });
    });
}

// Handle Order Now button clicks
orderNowButtons.forEach(button => {
    button.addEventListener('click', async (e) => {
        e.preventDefault();
        
        // Check if user is authenticated
        const isAuthenticated = await checkAuthAndRedirect();
        
        if (!isAuthenticated) {
            // Show popup if not authenticated
            showSignupPopup();
        } else {
            // User is authenticated, redirect to menu or orders page
            window.location.href = 'menu.html';
        }
    });
});

// Handle Add to Cart button clicks
addToCartButtons.forEach(button => {
    button.addEventListener('click', async (e) => {
        e.preventDefault();
        
        // Check if user is authenticated
        const isAuthenticated = await checkAuthAndRedirect();
        
        if (!isAuthenticated) {
            // Show popup if not authenticated
            showSignupPopup();
        } else {
            // User is authenticated, allow Add to Cart functionality
            // TODO: Add your cart functionality here
            console.log('Add to cart - user is authenticated');
        }
    });
});

// Handle popup buttons (only if popup exists)
if (goToSignupBtn) {
    goToSignupBtn.addEventListener('click', () => {
        hideSignupPopup();
        window.location.href = 'signup.html';
    });
}

if (goToLoginBtn) {
    goToLoginBtn.addEventListener('click', () => {
        hideSignupPopup();
        window.location.href = 'login.html';
    });
}

if (closePopupBtn) {
    closePopupBtn.addEventListener('click', () => {
        hideSignupPopup();
    });
}

// Close popup when clicking outside (only if popup exists)
if (signupPopup) {
    signupPopup.addEventListener('click', (e) => {
        if (e.target === signupPopup) {
            hideSignupPopup();
        }
    });
}

// Close popup with Escape key (only if popup exists)
if (signupPopup) {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && signupPopup.style.display === 'flex') {
            hideSignupPopup();
        }
    });
}

