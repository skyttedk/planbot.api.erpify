/**
 * Login Dialog Component for ERP application
 * Handles user authentication before allowing access to the main application
 */
export class LoginDialog {
    constructor(options = {}) {
        this.onLoginSuccess = options.onLoginSuccess || (() => {});
        this.socketService = options.socketService;
        this.container = null;
        this.dialog = null;
        this.form = null;
        this.errorMessage = null;
        this.usernameInput = null;
        this.passwordInput = null;
        this.rememberMe = null;
        this.submitButton = null;
        this.registerLink = null;
        this.isLoading = false;
    }

    /**
     * Create and show the login dialog
     */
    show() {
        console.log('Showing login dialog...');
        
        // Create the dialog if it doesn't exist
        if (!this.dialog) {
            this._createDialog();
        }
        
        // Pre-fill the username if available from localStorage
        this._restoreSavedCredentials();

        // Show the dialog
        document.body.appendChild(this.container);
        
        // Add a small delay before adding the active class for animation
        setTimeout(() => {
            this.container.classList.add('active');
            if (this.usernameInput) {
                this.usernameInput.focus();
            }
        }, 10);
    }

    /**
     * Hide and remove the login dialog
     */
    hide() {
        console.log('Hiding login dialog...');
        
        // Mark the dialog as not showing (using the global flag)
        window.loginDialogShowing = false;
        
        if (this.container) {
            // Remove the active class to start the fade-out animation
            this.container.classList.remove('active');
            
            // Wait for animation to complete before removing from DOM
            setTimeout(() => {
                console.log('Animation complete, removing login dialog from DOM');
                
                // Force removal from DOM
                try {
                    if (this.container) {
                        if (this.container.parentNode) {
                            this.container.parentNode.removeChild(this.container);
                        } else {
                            // If no parent node, it might be a detached DOM node
                            document.body.removeChild(this.container);
                        }
                    }
                } catch (error) {
                    console.error('Error removing login dialog:', error);
                    
                    // As a fallback, ensure it's at least hidden
                    if (this.container) {
                        this.container.style.display = 'none';
                        // Try one more direct removal
                        try {
                            document.body.removeChild(this.container);
                        } catch (e) {
                            // Already removed or not a child, ignore
                        }
                    }
                }
                
                // Clear references
                this.dialog = null;
                this.container = null;
            }, 300);
        } else {
            console.warn('Hide called but container is not available');
        }
    }

    /**
     * Create the login dialog elements
     * @private
     */
    _createDialog() {
        console.log('Creating login dialog elements...');
        
        // Create container with overlay
        this.container = document.createElement('div');
        this.container.className = 'login-container';
        
        // Add debug border to help diagnose display issues
        if (window.location.search.includes('debug=true')) {
            this.container.style.border = '5px solid red';
        }

        // Create dialog
        this.dialog = document.createElement('div');
        this.dialog.className = 'login-dialog';
        
        // Add visible debug text in debug mode
        if (window.location.search.includes('debug=true')) {
            const debugText = document.createElement('div');
            debugText.textContent = 'LOGIN DIALOG DEBUG MODE';
            debugText.style.background = 'red';
            debugText.style.color = 'white';
            debugText.style.padding = '5px';
            debugText.style.textAlign = 'center';
            this.dialog.appendChild(debugText);
        }
        
        // Logo/header
        const header = document.createElement('div');
        header.className = 'login-header';
        
        const logo = document.createElement('div');
        logo.className = 'login-logo';
        logo.innerHTML = '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 19V5C3 3.89543 3.89543 3 5 3H19C20.1046 3 21 3.89543 21 5V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19Z" stroke="currentColor" stroke-width="2"></path><path d="M7 9H17M7 12H17M7 15H12" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg>';
        
        const title = document.createElement('h2');
        title.textContent = 'erp';
        
        header.appendChild(logo);
        header.appendChild(title);
        
        // Create form
        this.form = document.createElement('form');
        this.form.className = 'login-form';
        this.form.addEventListener('submit', this._handleSubmit.bind(this));
        
        // Error message area
        this.errorMessage = document.createElement('div');
        this.errorMessage.className = 'login-error';
        this.errorMessage.style.display = 'none';
        
        // Username field
        const usernameGroup = document.createElement('div');
        usernameGroup.className = 'login-field';
        
        const usernameLabel = document.createElement('label');
        usernameLabel.setAttribute('for', 'login-username');
        usernameLabel.textContent = 'Username';
        
        this.usernameInput = document.createElement('input');
        this.usernameInput.type = 'text';
        this.usernameInput.id = 'login-username';
        this.usernameInput.name = 'username';
        this.usernameInput.required = true;
        this.usernameInput.autocomplete = 'username';
        this.usernameInput.placeholder = 'Enter your username';
        
        usernameGroup.appendChild(usernameLabel);
        usernameGroup.appendChild(this.usernameInput);
        
        // Password field
        const passwordGroup = document.createElement('div');
        passwordGroup.className = 'login-field';
        
        const passwordLabel = document.createElement('label');
        passwordLabel.setAttribute('for', 'login-password');
        passwordLabel.textContent = 'Password';
        
        this.passwordInput = document.createElement('input');
        this.passwordInput.type = 'password';
        this.passwordInput.id = 'login-password';
        this.passwordInput.name = 'password';
        this.passwordInput.required = true;
        this.passwordInput.autocomplete = 'current-password';
        this.passwordInput.placeholder = 'Enter your password';
        
        passwordGroup.appendChild(passwordLabel);
        passwordGroup.appendChild(this.passwordInput);
        
        // Remember me checkbox
        const rememberGroup = document.createElement('div');
        rememberGroup.className = 'login-remember';
        
        this.rememberMe = document.createElement('input');
        this.rememberMe.type = 'checkbox';
        this.rememberMe.id = 'login-remember';
        this.rememberMe.name = 'remember';
        
        // Default to checked
        this.rememberMe.checked = true;
        
        const rememberLabel = document.createElement('label');
        rememberLabel.setAttribute('for', 'login-remember');
        rememberLabel.textContent = 'Remember me';
        
        rememberGroup.appendChild(this.rememberMe);
        rememberGroup.appendChild(rememberLabel);
        
        // Submit button
        this.submitButton = document.createElement('button');
        this.submitButton.type = 'submit';
        this.submitButton.className = 'login-button';
        this.submitButton.textContent = 'Sign In';
                
        
        // Assemble the form
        this.form.appendChild(this.errorMessage);
        this.form.appendChild(usernameGroup);
        this.form.appendChild(passwordGroup);
        this.form.appendChild(rememberGroup);
        this.form.appendChild(this.submitButton);
        


        
        // Assemble the dialog
        this.dialog.appendChild(header);
        this.dialog.appendChild(this.form);
        
        // Add dialog to container
        this.container.appendChild(this.dialog);
    }

    /**
     * Handle form submission
     * @param {Event} e - The submit event
     * @private
     */
    async _handleSubmit(e) {
        e.preventDefault();
        
        if (this.isLoading) return;
        
        const username = this.usernameInput.value.trim();
        const password = this.passwordInput.value;
        
        if (!username || !password) {
            this._showError('Please enter both username and password.');
            return;
        }
        
        this._setLoading(true);
        this._hideError();
        
        console.log('Attempting login for user:', username);
        
        try {
            // Send login request to server
            const loginRequest = {
                type: 'controller',
                name: 'Auth',
                action: 'login',
                parameters: {
                    username,
                    password
                }
            };
            
            console.log('Sending login request:', JSON.stringify(loginRequest));
            
            const response = await this.socketService.request(loginRequest);
            
            console.log('Login response received:', JSON.stringify(response));
            
            if (response.success && response.data && response.data.success) {
                // Store token in localStorage if remember me is checked
                // Note: For security reasons, we never store the password, only the token and user info
                const token = response.data.token;
                const user = response.data.user;
                
                console.log('Login successful, token received');
                
                if (this.rememberMe.checked) {
                    localStorage.setItem('auth_token', token);
                    localStorage.setItem('user_data', JSON.stringify(user));
                    console.log('Credentials stored in localStorage (persistent)');
                } else {
                    // Store in sessionStorage if not remembering
                    sessionStorage.setItem('auth_token', token);
                    sessionStorage.setItem('user_data', JSON.stringify(user));
                    console.log('Credentials stored in sessionStorage (session only)');
                }
                
                // Update socket service with the new token
                this.socketService.setAuthToken(token);
                
                // Hide the login dialog first, before calling onLoginSuccess
                // This ensures login dialog is gone before we start loading the application
                this.hide();
                
                // Force a small delay to ensure the dialog is removed before loading the app
                setTimeout(() => {
                    // Notify of successful login
                    this.onLoginSuccess(token, user);
                }, 350); // Just a bit longer than the hide animation
            } else {
                // Show error message from server
                const errorMessage = (response.data && response.data.message) 
                    ? response.data.message 
                    : 'Authentication failed. Please try again.';
                
                console.error('Login failed:', errorMessage);
                this._showError(errorMessage);
            }
        } catch (error) {
            console.error('Login request error:', error);
            this._showError('Connection error. Please try again later.');
        } finally {
            this._setLoading(false);
        }
    }

    /**
     * Show an error message in the form
     * @param {string} message - The error message to display
     * @private
     */
    _showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.style.display = 'block';
    }

    /**
     * Hide the error message
     * @private
     */
    _hideError() {
        this.errorMessage.style.display = 'none';
    }

    /**
     * Set the loading state of the form
     * @param {boolean} isLoading - Whether the form is in loading state
     * @private
     */
    _setLoading(isLoading) {
        this.isLoading = isLoading;
        this.submitButton.disabled = isLoading;
        
        if (isLoading) {
            this.submitButton.innerHTML = '<span class="loading-spinner"></span> Signing In...';
        } else {
            this.submitButton.textContent = 'Sign In';
        }
    }

    /**
     * Restore saved credentials if available
     * @private
     */
    _restoreSavedCredentials() {
        // Check if we have a saved username in localStorage
        const savedUserData = localStorage.getItem('user_data');
        
        if (savedUserData) {
            try {
                const userData = JSON.parse(savedUserData);
                if (userData && userData.username) {
                    // Pre-fill the username field
                    this.usernameInput.value = userData.username;
                    
                    // Focus on password instead since username is already filled
                    setTimeout(() => {
                        this.passwordInput.focus();
                    }, 50);
                }
            } catch (e) {
                console.warn('Error parsing saved user data:', e);
                // If there was an error, clear the saved data
                localStorage.removeItem('user_data');
            }
        }
    }
}

/**
 * Factory function to create a login dialog
 */
export const createLoginDialog = (options = {}) => {
    return new LoginDialog(options);
}; 