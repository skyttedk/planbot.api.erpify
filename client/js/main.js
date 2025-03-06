import './components/bindable-input.js';
import { WindowForm } from './window-form-builder.js';
import { SocketService } from './services/socket-service.js';
import { LoginDialog } from './components/login-dialog.js';

// Create an instance of the SocketService
const socketService = new SocketService({
    url: "ws://localhost:8011",
    debug: true,
    reconnectDelay: 3000,
    requestTimeout: 10000,
    autoConnect: true 
});

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Document loaded, initializing application...');
    
    // Create desktop container if needed
    if (!document.getElementById('desktop')) {
        const desktop = document.createElement('div');
        desktop.id = 'desktop';
        document.body.appendChild(desktop);
    }
    
    // Set up event listeners for socket service
    socketService.on('connected', () => {
        console.log('Socket connected event received');
        // Give the socket a moment to fully initialize before checking auth
        setTimeout(checkAuthenticationAndProceed, 100);
    });
    socketService.on('auth_error', handleAuthError);
    
    // If already connected, wait a moment before checking auth
    if (socketService.getState() === 'connected') {
        console.log('Socket already connected on page load');
        setTimeout(checkAuthenticationAndProceed, 100);
    }
    
    // Force check for authentication after a delay regardless of socket state
    // This ensures we don't get stuck if socket connection has issues
    setTimeout(() => {
        console.log('Performing timeout-based authentication check');
        if (!window.loginDialogShowing && !window.applicationInitialized) {
            checkAuthenticationAndProceed();
        }
    }, 1000);
});

// Global flags to track application state
window.loginDialogShowing = window.loginDialogShowing || false;
window.applicationInitialized = window.applicationInitialized || false;

/**
 * Check authentication status and proceed accordingly
 */
function checkAuthenticationAndProceed() {
    console.log('Checking authentication status...');
    
    // Check if stored token is available
    const localToken = localStorage.getItem('auth_token');
    const sessionToken = sessionStorage.getItem('auth_token');
    console.log(`Token in localStorage: ${localToken ? 'Yes' : 'No'}, sessionStorage: ${sessionToken ? 'Yes' : 'No'}`);
    
    // Check if the user is already authenticated
    if (socketService.isAuthenticated()) {
        console.log('User is authenticated with valid token, initializing application...');
        // If authenticated, initialize the application
        initializeApplication();
    } else {
        console.log('User is not authenticated - no valid token found');
        
        // Try to fetch and validate the token one more time
        // This can help if the token wasn't properly initialized on socket service startup
        const storedToken = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
        if (storedToken) {
            console.log('Found stored token, attempting to set it and validate...');
            // Set and validate the token
            socketService.setAuthToken(storedToken);
            
            // Check if it was accepted as valid
            if (socketService.isAuthenticated()) {
                console.log('Token validated successfully on retry, initializing application...');
                initializeApplication();
                return;
            } else {
                console.log('Stored token failed validation, clearing it');
                socketService.clearAuthToken();
            }
        }
        
        // Show login dialog as last resort
        showLoginDialog();
    }
}

// Force check for authentication on page load - don't wait for socket connection
// This ensures login dialog is shown immediately
setTimeout(() => {
    if (!socketService.isAuthenticated() && !window.loginDialogShowing) {
        console.log('Forcing login dialog display...');
        showLoginDialog();
    }
}, 500);

/**
 * Show the login dialog
 */
function showLoginDialog() {
    // Prevent showing multiple login dialogs
    if (window.loginDialogShowing) {
        console.log('Login dialog already showing, not creating another one');
        return;
    }
    
    console.log('Showing login dialog...');
    window.loginDialogShowing = true;
    
    const loginDialog = new LoginDialog({
        socketService: socketService,
        onLoginSuccess: (token, user) => {
            console.log('Login successful, initializing application...');
            // Store user information in the application state
            window.currentUser = user;
            
            // Mark dialog as closed
            window.loginDialogShowing = false;
            
            // Initialize the application after successful login
            initializeApplication();
        },
        onRegisterClick: () => {
            // In future, this could show a registration form
            console.log('Register clicked');
            alert('Please contact your system administrator to create an account.');
        }
    });
    
    loginDialog.show();
}

/**
 * Initialize the application after successful authentication
 */
function initializeApplication() {
    // Set flag to prevent duplicate initialization
    if (window.applicationInitialized) {
        console.log('Application already initialized, skipping...');
        return;
    }
    
    console.log('Initializing application...');
    window.applicationInitialized = true;
    
    // Fetch menu from server and create top menu bar
    fetchMenuFromServer().then(() => {
        // Menu is created by the fetchMenuFromServer function
        console.log('Menu loaded successfully');
    }).catch(error => {
        console.error('Failed to load menu from server:', error);
        
        // If authentication error, show login dialog
        if (error.message && error.message.includes('Unauthorized')) {
            console.log('Authentication failed, clearing token and showing login...');
            window.applicationInitialized = false; // Reset flag since init failed
            socketService.clearAuthToken();
            showLoginDialog();
            return;
        }
        
        // Show error message for other errors
        showErrorMessage('Failed to load application menu. Please check your connection and try again.');
    });
}

// Function to fetch menu structure from server
async function fetchMenuFromServer() {
    try {
        // Request menu structure from server
        const response = await socketService.request({
            type: 'menu',
            token: socketService.getAuthToken(),
        });
        
        if (response.success && Array.isArray(response.result)) {
            createTopMenuBar(response.result);
            return response.result;
        } else {
            throw new Error(response.message || 'Invalid menu structure received from server');
        }
    } catch (error) {
        console.error('Error fetching menu from server:', error);
        throw error;
    }
}

// Function to create the top menu bar
function createTopMenuBar(serverMenuStructure) {
    // If there's no menu structure, show an error and return
    if (!serverMenuStructure || !Array.isArray(serverMenuStructure) || serverMenuStructure.length === 0) {
        console.error('No valid menu structure available');
        showErrorMessage('Failed to load application menu. Please refresh the page or contact support.');
        return;
    }

    const menuBar = document.createElement('div');
    menuBar.id = 'top-menu-bar';
    menuBar.className = 'top-menu-bar';
    
    // Create menu structure - use server-provided menu
    const menuStructure = serverMenuStructure;
    
    // Create main menu list for left side (application menus)
    const menuList = document.createElement('ul');
    menuList.className = 'left-menu';
    
    // Create menu items
    menuStructure.forEach(menuItem => {
        // Create main menu item
        const li = document.createElement('li');
        
        // Create main menu link
        const a = document.createElement('a');
        a.textContent = menuItem.label;
        a.href = '#'; // Prevent default behavior
        a.addEventListener('click', (e) => e.preventDefault());
        li.appendChild(a);
        
        // Create submenu if it exists
        if (menuItem.submenu && menuItem.submenu.length > 0) {
            // Create submenu list
            const submenu = document.createElement('ul');
            
            // Create submenu items
            menuItem.submenu.forEach(submenuItem => {
                // Create submenu item
                const subLi = document.createElement('li');
                
                // Create submenu link
                const subA = document.createElement('a');
                subA.textContent = submenuItem.label;
                subA.href = '#'; // Prevent default behavior
                
                // Add click event to load the view
                subA.addEventListener('click', (e) => {
                    e.preventDefault();
                    loadView(submenuItem.viewName);
                });
                
                // Add submenu link to submenu item
                subLi.appendChild(subA);
                
                // Add submenu item to submenu list
                submenu.appendChild(subLi);
            });
            
            // Add submenu list to main menu item
            li.appendChild(submenu);
        }
        
        // Add main menu item to main menu list
        menuList.appendChild(li);
    });
    
    // Add main menu list to menu bar
    menuBar.appendChild(menuList);
    
    // Create the right side menu (user/settings menu)
    const userMenuList = document.createElement('ul');
    userMenuList.className = 'right-menu';
    
    // Create settings/profile menu item
    const settingsLi = document.createElement('li');
    settingsLi.className = 'settings-menu';
    
    // Create settings button with icon
    const settingsButton = document.createElement('a');
    settingsButton.href = '#';
    settingsButton.className = 'settings-button';
    settingsButton.innerHTML = '<span class="menu-icon">☰</span>'; // Hamburger menu icon
    settingsButton.addEventListener('click', (e) => e.preventDefault());
    
    settingsLi.appendChild(settingsButton);
    
    // Create settings dropdown menu
    const settingsDropdown = document.createElement('ul');
    
    // Add username display
    const usernameLi = document.createElement('li');
    usernameLi.className = 'username-display';
    
    // Get username from stored user data
    let username = 'User';
    try {
        const userData = JSON.parse(localStorage.getItem('user_data') || sessionStorage.getItem('user_data') || '{}');
        if (userData && userData.username) {
            username = userData.username;
        }
    } catch (e) {
        console.warn('Error parsing user data:', e);
    }
    
    const usernameText = document.createElement('span');
    usernameText.textContent = username;
    usernameLi.appendChild(usernameText);
    
    // Add logout option
    const logoutLi = document.createElement('li');
    const logoutLink = document.createElement('a');
    logoutLink.href = '#';
    logoutLink.textContent = 'Logout';
    logoutLink.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });
    
    logoutLi.appendChild(logoutLink);
    
    // Assemble the dropdown
    settingsDropdown.appendChild(usernameLi);
    settingsDropdown.appendChild(logoutLi);
    settingsLi.appendChild(settingsDropdown);
    
    // Add settings menu to the right menu
    userMenuList.appendChild(settingsLi);
    
    // Add right menu to menu bar
    menuBar.appendChild(userMenuList);
    
    // Insert the menu bar at the top of the body, before the desktop
    const desktop = document.getElementById('desktop');
    document.body.insertBefore(menuBar, desktop);
}

/**
 * Check if any form windows are currently open
 * @returns {boolean} True if any form windows are visible
 */
function hasVisibleForms() {
    // Check if there are any window elements in the DOM
    const windows = document.querySelectorAll('.window');
    return windows.length > 0;
}

/**
 * Handle authentication errors
 * @param {Object} data - Error data
 */
function handleAuthError(data) {
    console.warn('Authentication error detected:', data.message);
    
    // Don't show login dialog if we already have windows open
    if (hasVisibleForms()) {
        console.log('Ignoring auth error because forms are already visible');
        return;
    }
    
    // Only handle authentication errors if we're not intentionally loading a view
    if (window.viewBeingLoaded) {
        console.warn('Ignoring auth error during view loading:', data.message);
        return;
    }
    
    socketService.clearAuthToken();
    showLoginDialog();
}

// Function to load a view by name
function loadView(viewName) {
    console.log(`Loading view: ${viewName}`);
    
    // Check if user is authenticated
    const token = socketService.getAuthToken();
    if (!token) {
        console.error('Not authenticated, showing login dialog');
        showLoginDialog();
        return;
    }
    
    // Set a flag to indicate we're intentionally loading a view
    window.viewBeingLoaded = viewName;
    
    // Show loading indicator
    showLoadingIndicator(viewName);
    
    // Request window configurations from the server using the view name
    socketService.sendMessage({
        type: 'view',
        name: viewName,
        token: token,
        requestId: `req-${viewName}-config`
    });
    
    // Set a timeout for server response
    const timeoutId = setTimeout(() => {
        window.viewBeingLoaded = null; // Clear the flag
        hideLoadingIndicator();
        showErrorMessage(`Failed to load ${viewName}. Server did not respond in time.`);
    }, 10000); // 10 seconds timeout
    
    // Store the timeout ID to clear it when we get a response
    window.pendingRequests = window.pendingRequests || {};
    window.pendingRequests[viewName] = timeoutId;
}

// Listen for server responses
socketService.on('message', (message) => {
    console.log('Received message:', message);
    
    // Handle errors first
    if (message.error) {
        console.error('Server error:', message.error);
        hideLoadingIndicator();
        showErrorMessage(`Error: ${message.error}`);
        
        // Check for authentication errors and show login if needed
        if ((message.error.includes('Unauthorized') || 
            message.error.includes('authentication') || 
            message.error.includes('token')) && !window.viewBeingLoaded) {
                
            // Don't show login dialog if we already have forms visible
            if (!hasVisibleForms()) {
                console.warn('Authentication error detected, showing login dialog');
                socketService.clearAuthToken();
                showLoginDialog();
            } else {
                console.log('Ignoring auth error because forms are already visible');
            }
        }
        
        // Clear view loading flag on errors
        window.viewBeingLoaded = null;
        
        return;
    }
    
    // Check for authentication errors in the regular message format
    if (message.message && !message.success && 
        (message.message.includes('Unauthorized') || 
         message.message.includes('authentication') || 
         message.message.includes('token'))) {
        console.warn('Authentication error detected:', message.message);
        hideLoadingIndicator();
        
        // Only show login dialog if we're not intentionally loading a view
        const wasLoadingView = window.viewBeingLoaded;
        
        // Clear view loading flag
        window.viewBeingLoaded = null;
        
        // Don't show login dialog if we already have forms visible
        if (!wasLoadingView && !hasVisibleForms()) {
            socketService.clearAuthToken();
            showLoginDialog();
        } else {
            console.log('Ignoring auth error because a view was loading or forms are visible');
        }
        
        return;
    }
    
    // Skip processing if response is not successful and doesn't have a requestId
    if (!message.success && !message.requestId) {
        console.error('Unsuccessful response with no requestId:', message);
        return;
    }

    // Process based on requestId pattern
    if (!message.requestId) {
        console.warn('Received message without requestId:', message);
        return;
    }
    
    // Check if the message is a response to a view request
    if (message.requestId.startsWith('req-') && message.requestId.endsWith('-config') && message.result) {
        // Extract the view name from the requestId
        const viewName = message.requestId.replace('req-', '').replace('-config', '');
        console.log('Processing view:', viewName, 'with result:', message.result);
        
        // Clear the timeout for this request
        if (window.pendingRequests && window.pendingRequests[viewName]) {
            clearTimeout(window.pendingRequests[viewName]);
            delete window.pendingRequests[viewName];
        }
        
        // Clear the view loading flag
        window.viewBeingLoaded = null;
        
        // Hide loading indicator
        hideLoadingIndicator();
        
        const windowConfigs = message.result;
        
        // Validate window configs
        if (!Array.isArray(windowConfigs) || windowConfigs.length === 0) {
            console.error('Invalid window configurations received:', windowConfigs);
            showErrorMessage(`Error: Invalid configuration received for ${viewName}`);
            return;
        }
        
        // Handle specific views
        if (viewName === 'customerCard') {
            // For Customer Card, we might want to clear existing windows
            // Uncomment the next line if you want to close other windows when opening Customer Card
            // document.getElementById('desktop').innerHTML = '';
            
            console.log('Loading Customer Card view with config:', windowConfigs);
        }
        
        // Create windows for each config
        windowConfigs.forEach(config => {
            if (!config) {
                console.error('Invalid window configuration:', config);
                return;
            }
            
            // Check if the window has content (could be a form or other content type)
            if (!config.content && !config.formConfig) {
                console.error('Window configuration missing content or formConfig:', config);
                showErrorMessage(`Error: Invalid window configuration for ${viewName}`);
                return;
            }
            
            // For backward compatibility, if formConfig exists use it, otherwise use content
            const finalConfig = {
                ...config,
                formConfig: config.formConfig || config.content
            };
            
            try {
                // Instantiate the WindowForm class with the config and socket service
                const wf = new WindowForm(finalConfig, socketService);
                document.getElementById('desktop').appendChild(wf.getElement());
            } catch (error) {
                console.error('Error creating window:', error);
                showErrorMessage(`Error creating window: ${error.message}`);
            }
        });
    } else if (message.requestId.startsWith('req-update-')) {
        // Update responses are now handled by the autoSave response handler in WindowForm
        console.log('Record update response received:', message.requestId);
    } else if (message.requestId.startsWith('req-find-first-')) {
        // findFirst responses are now handled by the WindowForm response handler
        console.log('Find first record response received:', message.requestId);
    } else if (message.requestId.startsWith('req-lookup-')) {
        // Lookup responses are now handled by the WindowForm response handler
        console.log('Lookup response received:', message.requestId);
    } else if (message.requestId.startsWith('req-find-all-')) {
        // findAll responses are now handled by specific handlers
        console.log('Find all records response received:', message.requestId);
    } else {
        // Unhandled message types
        console.log('Unhandled message type:', message.requestId);
    }
});

// Function to show a loading indicator
function showLoadingIndicator(viewName) {
    // Remove any existing loading indicator
    hideLoadingIndicator();
    
    // Create loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'loading-indicator';
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.innerHTML = `
        <div class="loading-spinner"></div>
        <div class="loading-text">Loading ${viewName}...</div>
    `;
    
    // Add to body
    document.body.appendChild(loadingIndicator);
}

// Function to hide the loading indicator
function hideLoadingIndicator() {
    const existingIndicator = document.getElementById('loading-indicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }
}

// Function to show an error message
function showErrorMessage(message) {
    // Create error message element
    const errorMessage = document.createElement('div');
    errorMessage.className = 'error-message';
    errorMessage.textContent = message;
    
    // Add to desktop
    document.getElementById('desktop').appendChild(errorMessage);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        errorMessage.remove();
    }, 5000);
}

// Function to show a success message
function showSuccessMessage(message) {
    // Create success message element
    const successMessage = document.createElement('div');
    successMessage.className = 'success-message';
    successMessage.textContent = message;
    
    // Add to desktop
    document.getElementById('desktop').appendChild(successMessage);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        successMessage.remove();
    }, 3000);
}

// Set up error handling for socket connection issues
socketService.on('error', (error) => {
    console.error('Socket connection error:', error);
    hideLoadingIndicator();
    showErrorMessage('Connection error. Please check your network connection.');
});

// Connect to socket
socketService.on('open', () => {
    console.log('Socket connected successfully');
});

/**
 * Logs out the current user and returns to login screen
 */
function logout() {
    console.log('Logging out user...');
    
    // Clear tokens from storage
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('user_data');
    
    // Clear token from socket service
    socketService.clearAuthToken();
    
    // Reset application state
    window.applicationInitialized = false;
    
    // Clear desktop content
    const desktop = document.getElementById('desktop');
    if (desktop) {
        desktop.innerHTML = '';
    }
    
    // Remove top menu bar
    const topMenu = document.getElementById('top-menu-bar');
    if (topMenu && topMenu.parentNode) {
        topMenu.parentNode.removeChild(topMenu);
    }
    
    // Show login dialog
    showLoginDialog();
    
    console.log('Logout complete');
}