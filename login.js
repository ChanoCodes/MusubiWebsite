import { auth, db } from './firebase.js';
import { signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const messageDiv = document.getElementById('message');

// Pre-configured admin
const ADMIN_EMAIL = 'admin@gmail.com';
const ADMIN_PASSWORD = 'musubi12345';

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
        showMessage('Please fill in all fields.', 'error');
        return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging in...';
    messageDiv.textContent = '';

    try {
        // 🔹 Admin login (pre-configured) - bypasses Firebase Auth
        if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
            // Set admin session flag
            sessionStorage.setItem('isAdmin', 'true');
            sessionStorage.setItem('adminEmail', ADMIN_EMAIL);
            
            // Show welcome message
            alert('Welcome Admin!');
            
            // Re-enable button before redirect
            loginBtn.disabled = false;
            loginBtn.textContent = 'Log In';
            
            // Redirect to admin dashboard
            window.location.href = 'admin.html';
            return; // Stop execution
        }

        // 🔹 Regular user login (Firebase Auth)
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 🔐 Check approval / blocked status in Firestore before allowing session use
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('uid', '==', user.uid));
        const snapshot = await getDocs(q);

        let userDoc = null;
        snapshot.forEach(doc => {
            // If multiple docs somehow exist, just take the first
            if (!userDoc) {
                userDoc = doc.data();
            }
        });

        const isApproved = userDoc?.approved === true;
        const isBlocked = userDoc?.blocked === true;

        // If not approved, or explicitly blocked, immediately sign out and prevent login
        if (!isApproved) {
            await auth.signOut?.();
            showLoginPopup('Account pending approval. Please wait for the admin to verify your account.', 'error');
            
            loginBtn.disabled = false;
            loginBtn.textContent = 'Log In';
            return;
        }

        if (isBlocked) {
            await auth.signOut?.();
            showLoginPopup('Your account has been blocked. Please contact support.', 'error');
            
            loginBtn.disabled = false;
            loginBtn.textContent = 'Log In';
            return;
        }

        // Clear any admin session (in case admin logged in previously)
        sessionStorage.removeItem('isAdmin');
        sessionStorage.removeItem('adminEmail');

        // Show success popup
        showLoginPopup('Login successful! Redirecting...', 'success');

        // Redirect to homepage after short delay
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);

    } catch (error) {
        console.error('Login error:', error);
        let errorMessage = 'An error occurred during login. Please try again.';

        if (error.code === 'auth/user-not-found') {
            errorMessage = 'No account found with this email. Please sign up first.';
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = 'Incorrect password. Please try again.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address. Please check your email.';
        } else if (error.code === 'auth/invalid-credential') {
            errorMessage = 'Invalid email or password. Please try again.';
        } else if (error.code === 'auth/network-request-failed') {
            errorMessage = 'Network error. Please check your internet connection.';
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = 'Too many failed attempts. Please try again later.';
        }

        showLoginPopup(errorMessage, 'error');
        
        // Re-enable button on error
        loginBtn.disabled = false;
        loginBtn.textContent = 'Log In';
    }
});

function showMessage(message, type) {
    messageDiv.textContent = message;
    messageDiv.className = `message message-${type}`;
    messageDiv.style.display = 'block';
}

function showLoginPopup(message, type = 'success') {
    // Remove existing popup if any
    const existingPopup = document.getElementById('loginNotificationPopup');
    if (existingPopup) {
        existingPopup.remove();
    }
    
    const popup = document.createElement('div');
    popup.id = 'loginNotificationPopup';
    popup.className = 'popup-overlay';
    popup.style.display = 'flex';
    popup.style.zIndex = '3000';
    
    const bgColor = type === 'success' ? '#D4EDDA' : '#F8D7DA';
    const textColor = type === 'success' ? '#155724' : '#721C24';
    const borderColor = type === 'success' ? '#C3E6CB' : '#F5C6CB';
    const icon = type === 'success' ? '✓' : '✕';
    
    popup.innerHTML = `
        <div class="popup-content" style="max-width: 400px; background-color: ${bgColor}; border: 1px solid ${borderColor};">
            <div style="font-size: 2rem; margin-bottom: 1rem;">${icon}</div>
            <p style="color: ${textColor}; font-size: 1rem; margin: 0; text-align: center;">${message}</p>
        </div>
    `;
    
    document.body.appendChild(popup);
    
    // Auto close after delay (only for success, errors stay until clicked)
    if (type === 'success') {
        setTimeout(() => {
            if (popup.parentNode) {
                popup.remove();
            }
        }, 2000);
    }
    
    // Close on click
    popup.addEventListener('click', () => {
        if (popup.parentNode) {
            popup.remove();
        }
    });
}
