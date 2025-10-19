// This is public/js/auth.js - AUTHENTICATION MANAGEMENT
class AuthManager {
    constructor() {
      // NOTE: Using sessionStorage instead of localStorage for security in development
      // For production, implement secure HTTP-only cookies
        this.token = sessionStorage.getItem('authToken') || null;
        this.user = JSON.parse(sessionStorage.getItem('user')) || null;
    }
    
    setToken(token) {
        this.token = token;
        sessionStorage.setItem('authToken', token);
    }
    
    setUser(user) {
        this.user = user;
        sessionStorage.setItem('user', JSON.stringify(user));
    }
    
    getAuthHeader() {
        return {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
        };
    }
    
    logout() {
        this.token = null;
        this.user = null;
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('user');
    }
    
    isAuthenticated() {
        return !!this.token && !!this.user;
    }
    
    getUser() {
        return this.user;
    }
    
    getToken() {
        return this.token;
    }
}

const authManager = new AuthManager();
// Check if authenticated on page load
document.addEventListener('DOMContentLoaded', () => {
    if (!authManager.isAuthenticated()) {
      // Redirect to login if on protected page
        if (document.body.classList.contains('protected')) {
            window.location.href = '/login';
        }
    }
});