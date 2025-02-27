import './components/bindable-input.js';
import { WindowForm } from './window-form-builder.js';
import { SocketService } from './services/socket-service.js';

// Create an instance of the SocketService with authentication
const socketService = new SocketService({
    url: "ws://localhost:8011",
    debug: true,
    reconnectDelay: 3000,
    requestTimeout: 10000,
    authToken: "123" // Use the hardcoded token for now
});

// Create the desktop container and top menu bar if they don't exist
document.addEventListener('DOMContentLoaded', () => {
    // Create desktop container
    if (!document.getElementById('desktop')) {
        const desktop = document.createElement('div');
        desktop.id = 'desktop';
        document.body.appendChild(desktop);
    }
    
    // Create top menu bar
    if (!document.getElementById('top-menu-bar')) {
        createTopMenuBar();
    }
});

// Function to create the top menu bar
function createTopMenuBar() {
    const menuBar = document.createElement('div');
    menuBar.id = 'top-menu-bar';
    menuBar.className = 'top-menu-bar';
    
    // Create menu structure
    const menuStructure = [
        {
            label: 'Customers',
            submenu: [
                { label: 'Customer Card', viewName: 'customerCard' },
                { label: 'Customer List', viewName: 'customerList' }
            ]
        },
        {
            label: 'Sales',
            submenu: [
                { label: 'Sales Invoices', viewName: 'salesInvoices' },
                { label: 'Sales Orders', viewName: 'salesOrders' }
            ]
        },
        {
            label: 'Purchases',
            submenu: [
                { label: 'Purchase Invoices', viewName: 'purchaseInvoices' },
                { label: 'Purchase Orders', viewName: 'purchaseOrders' }
            ]
        },
        {
            label: 'Inventory',
            submenu: [
                { label: 'Items', viewName: 'items' },
                { label: 'Stock Movements', viewName: 'stockMovements' }
            ]
        },
        {
            label: 'Reports',
            submenu: [
                { label: 'Sales Report', viewName: 'salesReport' },
                { label: 'Inventory Report', viewName: 'inventoryReport' },
                { label: 'Financial Report', viewName: 'financialReport' }
            ]
        }
    ];
    
    // Create main menu list
    const menuList = document.createElement('ul');
    
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
    
    // Insert the menu bar at the top of the body, before the desktop
    const desktop = document.getElementById('desktop');
    document.body.insertBefore(menuBar, desktop);
}

// Function to load a view by name
function loadView(viewName) {
    console.log(`Loading view: ${viewName}`);
    
    // Show loading indicator
    showLoadingIndicator(viewName);
    
    // Request window configurations from the server using the view name
    socketService.sendMessage({
        type: 'view',
        name: viewName,
        requestId: `req-${viewName}-config`
    });
    
    // Set a timeout for server response
    const timeoutId = setTimeout(() => {
        hideLoadingIndicator();
        showErrorMessage(`Failed to load ${viewName}. Server did not respond in time.`);
    }, 10000); // 10 seconds timeout
    
    // Store the timeout ID to clear it when we get a response
    window.pendingRequests = window.pendingRequests || {};
    window.pendingRequests[viewName] = timeoutId;
}

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

// Listen for server responses
socketService.on('message', (message) => {
    console.log('Received message:', message);
    
    // Handle errors first
    if (message.error) {
        console.error('Server error:', message.error);
        hideLoadingIndicator();
        showErrorMessage(`Error: ${message.error}`);
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