// Firebase Configuration
// Using firebase.js for config
import { auth, db } from './firebase.js';
import { createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { collection, addDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Get form elements
const signupForm = document.getElementById('signupForm');
const messageDiv = document.getElementById('message');
const signupBtn = document.getElementById('signupBtn');

// Handle form submission
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get form values
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    
    // Validate inputs
    if (!name || !email || !username || !password) {
        showMessage('Please fill in all fields.', 'error');
        return;
    }
    
    if (password.length < 6) {
        showMessage('Password must be at least 6 characters.', 'error');
        return;
    }
    
    // Disable button and show loading state
    signupBtn.disabled = true;
    signupBtn.textContent = 'Signing up...';
    messageDiv.textContent = '';
    
    try {
        // Create user in Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Create user document in Firestore
        await addDoc(collection(db, 'users'), {
            name: name,
            email: email,
            username: username,
            role: 'user',
            approved: false,
            uid: user.uid,
            createdAt: new Date()
        });
        
        // Show success message
        showMessage('Signup successful! Wait for admin approval.', 'success');
        
        // Reset form
        signupForm.reset();
        
        // Redirect to login page after 3 seconds
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 3000);
        
    } catch (error) {
        console.error('Signup error:', error);
        
        // Handle specific error cases
        let errorMessage = 'An error occurred during signup. Please try again.';
        
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'This email is already registered. Please use a different email.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address. Please check your email.';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'Password is too weak. Please use a stronger password.';
        } else if (error.code === 'auth/network-request-failed') {
            errorMessage = 'Network error. Please check your internet connection.';
        }
        
        showMessage(errorMessage, 'error');
    } finally {
        // Re-enable button
        signupBtn.disabled = false;
        signupBtn.textContent = 'Sign Up';
    }
});

// Function to show messages
function showMessage(message, type) {
    messageDiv.textContent = message;
    messageDiv.className = `message message-${type}`;
    messageDiv.style.display = 'block';
    
    // Scroll to message
    messageDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

