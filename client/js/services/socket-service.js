/**
 * Enhanced WebSocket service for ERP applications
 * Features include:
 * - Configurable reconnection with exponential backoff
 * - Promise-based request/response pattern
 * - Authentication support
 * - Connection heartbeats
 * - Message queuing when disconnected
 * - Comprehensive error handling
 */
export class SocketService {
    constructor(options = {}) {
        // Default configuration
        this.config = {
            url: options.url || this._getDefaultUrl(),
            reconnectInterval: options.reconnectInterval || 1000,
            maxReconnectInterval: options.maxReconnectInterval || 30000,
            reconnectDecay: options.reconnectDecay || 1.5,
            heartbeatInterval: options.heartbeatInterval || 30000,
            heartbeatTimeout: options.heartbeatTimeout || 10000,
            requestTimeout: options.requestTimeout || 10000,
            autoConnect: options.autoConnect !== undefined ? options.autoConnect : true,
            debug: options.debug || false,
            authProvider: options.authProvider || null,
            authToken: options.authToken || "123" // Default token for development
        };

        // Connection state
        this.ws = null;
        this.connectionState = 'disconnected'; // disconnected, connecting, connected, closing
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;
        this.heartbeatTimer = null;
        this.heartbeatTimeoutTimer = null;
        
        // Message handling
        this.messageQueue = [];
        this.listeners = {};
        this.pendingRequests = new Map();
        
        // Authentication
        this.authToken = this._getStoredToken() || this.config.authToken;
        
        // Log authentication state
        if (this.authToken) {
            this._log(`Initialized with authentication token: ${this.authToken.substr(0, 10)}...`);
        } else {
            this._log('Initialized without authentication token');
        }
        
        // Connect if auto-connect is enabled
        if (this.config.autoConnect) {
            this.connect();
        }
    }

    // Get default WebSocket URL based on environment
    _getDefaultUrl() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = process.env.REACT_APP_WS_HOST || window.location.host;
        const path = process.env.REACT_APP_WS_PATH || '/ws';
        return `${protocol}//${host}${path}`;
    }

    // Connect to WebSocket server
    connect() {
        if (this.connectionState === 'connected' || this.connectionState === 'connecting') {
            return;
        }

        this.connectionState = 'connecting';
        this._log('Connecting to WebSocket server...');

        // Clear any existing reconnect timer
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        // Initialize WebSocket connection
        this.ws = new WebSocket(this.config.url);

        // Setup event handlers
        this.ws.onopen = this._handleOpen.bind(this);
        this.ws.onmessage = this._handleMessage.bind(this);
        this.ws.onerror = this._handleError.bind(this);
        this.ws.onclose = this._handleClose.bind(this);
    }

    // Disconnect from WebSocket server
    disconnect(code = 1000, reason = 'Client disconnected') {
        if (this.connectionState === 'disconnected' || this.connectionState === 'closing') {
            return;
        }

        this.connectionState = 'closing';
        this._log(`Disconnecting from WebSocket server: ${reason}`);

        // Clear timers
        this._clearTimers();

        // Close the connection if it exists
        if (this.ws) {
            try {
                this.ws.close(code, reason);
            } catch (error) {
                this._log('Error closing WebSocket connection', error);
            }
        }

        // Set state to disconnected
        this.connectionState = 'disconnected';
        this._emit('close', { code, reason, wasClean: true });
    }

    // Forcefully reconnect (reset connection)
    reconnect() {
        this.disconnect(1000, 'Manual reconnection');
        this.connect();
    }

    /**
     * Send a message to the server
     * @param {Object} message - The message to send
     */
    sendMessage(message) {
        // Clone the message to avoid modifying the original
        const messageToSend = { ...message };
        
        // Check if this message includes a token
        if (messageToSend.token) {
            // Validate token format
            if (typeof messageToSend.token !== 'string' || messageToSend.token.split('.').length !== 3) {
                console.warn('Attempted to send message with invalid token format:', messageToSend);
                
                // Remove the invalid token
                delete messageToSend.token;
                
                // For non-auth requests, emit an auth error event
                if (!(messageToSend.type === 'controller' && messageToSend.name === 'Auth')) {
                    this._emit('auth_error', { message: 'Invalid token format' });
                }
            }
        }
        
        if (this.connectionState === 'connected' && this.ws && this.ws.readyState === WebSocket.OPEN) {
            // If connected, send immediately
            const messageStr = JSON.stringify(messageToSend);
            this.ws.send(messageStr);
            this._log('Sent:', messageToSend);
        } else {
            // Otherwise queue for later
            this.messageQueue.push(messageToSend);
            this._log('Queued message, connection not ready:', messageToSend);
            
            // Attempt reconnect if disconnected
            if (this.connectionState === 'disconnected') {
                this.connect();
            }
        }
    }

    /**
     * Send a request to the server and wait for a response
     * @param {Object} message - The message to send
     * @param {number} timeout - Custom timeout for this request in milliseconds
     * @returns {Promise<Object>} - The response from the server
     */
    async request(message, timeout = null) {
        // Clone the message to avoid modifying the original
        const messageToSend = { ...message };
        
        // Generate a unique request ID if one isn't provided
        const requestId = messageToSend.requestId || this._generateRequestId();
        messageToSend.requestId = requestId;
        
        // For non-Auth requests, explicitly check if we have a valid token
        const isAuthRequest = messageToSend.type === 'controller' && messageToSend.name === 'Auth';
        
        if (!isAuthRequest) {
            // If not an Auth request, we need a valid token
            const token = messageToSend.token || this.authToken;
            
            // Validate token or throw an error
            if (!token || typeof token !== 'string' || token.split('.').length !== 3) {
                this._log('Request rejected due to missing or invalid token:', messageToSend);
                this._emit('auth_error', { message: 'Authentication required' });
                return Promise.reject(new Error('Authentication required'));
            }
            
            // Set the token if not already set
            if (!messageToSend.token) {
                messageToSend.token = token;
            }
        } else {
            // For Auth requests, make sure we don't include a token parameter
            delete messageToSend.token;
        }
        
        // Create a promise that resolves when a response is received
        return new Promise((resolve, reject) => {
            // Set up the timeout
            const timeoutMs = timeout || this.config.requestTimeout;
            const timeoutId = setTimeout(() => {
                // Remove the pending request from the map
                this.pendingRequests.delete(requestId);
                reject(new Error(`Request timed out after ${timeoutMs}ms`));
            }, timeoutMs);
            
            // Store the promise resolve/reject functions and timeout ID
            this.pendingRequests.set(requestId, {
                resolve,
                reject,
                timeoutId,
                sentAt: Date.now()
            });
            
            // Send the message
            this.sendMessage(messageToSend);
        });
    }

    // Register an event listener
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
        return this; // For chaining
    }

    // Remove an event listener
    off(event, callback) {
        if (!this.listeners[event]) return this;
        
        if (callback) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        } else {
            // If no callback specified, remove all listeners for this event
            delete this.listeners[event];
        }
        
        return this; // For chaining
    }

    // Get current connection state
    getState() {
        return this.connectionState;
    }

    /**
     * Handle the WebSocket open event
     * @private
     */
    _handleOpen() {
        this._log('WebSocket connection established');
        this.connectionState = 'connected';
        this.reconnectAttempts = 0;
        
        // Clear reconnect timer if it exists
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        // Start heartbeat to keep connection alive
        this._startHeartbeat();
        
        // Process any messages that were queued while disconnected
        this._processQueue();
        
        // Emit the connected event to let the application know we're ready
        this._emit('connected', { timestamp: Date.now() });
    }

    /**
     * Handle incoming WebSocket messages
     * @param {MessageEvent} event - The WebSocket message event
     * @private
     */
    _handleMessage(event) {
        let message;
        
        try {
            message = JSON.parse(event.data);
            this._log('Message received:', message);
        } catch (error) {
            this._log('Error parsing message:', error);
            this._emit('error', { error, message: 'Failed to parse message from server' });
            return;
        }
        
        // Check for heartbeat response
        if (message.type === 'heartbeat_response') {
            this._log('Heartbeat response received');
            // Clear timeout as heartbeat was acknowledged
            if (this.heartbeatTimeoutTimer) {
                clearTimeout(this.heartbeatTimeoutTimer);
                this.heartbeatTimeoutTimer = null;
            }
            return;
        }
        
        // Check for authentication errors
        if (message.success === false && message.message && 
            (message.message.includes('Unauthorized') || 
             message.message.includes('authentication') ||
             message.message.includes('Invalid token'))) {
            
            // Emit authentication error event
            this._emit('auth_error', { message: message.message });
        }
        
        // Check if this is a response to a pending request
        if (message.requestId && this.pendingRequests.has(message.requestId)) {
            const { resolve, reject, timeoutId } = this.pendingRequests.get(message.requestId);
            
            // Clear the timeout for this request
            clearTimeout(timeoutId);
            
            // Remove from pending requests
            this.pendingRequests.delete(message.requestId);
            
            // Resolve the promise with the message data
            resolve(message);
            return;
        }
        
        // If not a response to a pending request, emit as a normal message
        this._emit('message', message);
    }

    // Handle WebSocket error event
    _handleError(error) {
        this._log('WebSocket error:', error);
        this._emit('error', error);
    }

    // Handle WebSocket close event
    _handleClose(event) {
        // Clear timers
        this._clearTimers();
        
        // Update state
        this.connectionState = 'disconnected';
        
        this._log(`WebSocket closed: Code ${event.code}, Reason: ${event.reason}, Clean: ${event.wasClean}`);
        this._emit('close', event);
        
        // Only attempt to reconnect if it wasn't a clean closure
        if (!event.wasClean) {
            this._scheduleReconnect();
        }
    }

    // Schedule reconnection with exponential backoff
    _scheduleReconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }
        
        // Calculate backoff time
        const backoffTime = Math.min(
            this.config.maxReconnectInterval,
            this.config.reconnectInterval * Math.pow(this.config.reconnectDecay, this.reconnectAttempts)
        );
        
        this._log(`Scheduling reconnection in ${backoffTime}ms (attempt ${this.reconnectAttempts + 1})`);
        
        this.reconnectTimer = setTimeout(() => {
            this.reconnectAttempts++;
            this.connect();
        }, backoffTime);
    }

    // Process queued messages
    _processQueue() {
        this._log(`Processing ${this.messageQueue.length} queued messages`);
        
        while (this.messageQueue.length > 0 && this.connectionState === 'connected') {
            const message = this.messageQueue.shift();
            try {
                this.ws.send(message);
            } catch (error) {
                this._log('Error sending queued message:', error);
                // Put the message back at the front of the queue
                this.messageQueue.unshift(message);
                break;
            }
        }
    }

    // Start heartbeat mechanism
    _startHeartbeat() {
        if (!this.config.heartbeatInterval) return;
        
        this._clearHeartbeat();
        
        this.heartbeatTimer = setInterval(() => {
            if (this.connectionState !== 'connected') {
                return;
            }
            
            this._log('Sending heartbeat ping');
            
            try {
                // Include authentication token in the ping message
                // Use a format that doesn't require model resolution
                this.ws.send(JSON.stringify({ 
                    type: 'heartbeat',    // Changed from 'ping' to a self-contained type
                    timestamp: Date.now(),
                    token: this.config.authToken
                }));
                
                // Set timeout for expecting pong response
                this.heartbeatTimeoutTimer = setTimeout(() => {
                    this._log('Heartbeat timeout - connection is stale');
                    // Force a reconnection
                    this.reconnect();
                }, this.config.heartbeatTimeout);
                
            } catch (error) {
                this._log('Error sending heartbeat:', error);
            }
        }, this.config.heartbeatInterval);
    }

    // Clear heartbeat timers
    _clearHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
        
        if (this.heartbeatTimeoutTimer) {
            clearTimeout(this.heartbeatTimeoutTimer);
            this.heartbeatTimeoutTimer = null;
        }
    }

    // Clear all timers
    _clearTimers() {
        this._clearHeartbeat();
        
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    // Authenticate with the WebSocket server
    async _authenticate() {
        if (!this.config.authProvider || this.connectionState !== 'connected') {
            return;
        }
        
        try {
            const authData = await this.config.authProvider();
            this.sendMessage({
                type: 'authenticate',
                auth: authData
            });
        } catch (error) {
            this._log('Authentication error:', error);
            this._emit('error', { type: 'auth_error', error });
        }
    }

    // Emit an event to listeners
    _emit(event, data) {
        try {
            if (this.listeners[event]) {
                this.listeners[event].forEach(callback => {
                    try {
                        callback(data);
                    } catch (error) {
                        console.error(`Error in ${event} event listener:`, error);
                    }
                });
            }
        } catch (error) {
            console.error(`Error emitting ${event} event:`, error);
        }
    }

    // Generate a unique request ID
    _generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    // Logging with debug option
    _log(...args) {
        if (this.config.debug) {
            console.log('[SocketService]', ...args);
        }
    }

    /**
     * Get stored authentication token from localStorage or sessionStorage
     * @returns {string|null} The stored auth token or null if not found
     * @private
     */
    _getStoredToken() {
        // Check both storage locations and log what we find
        const localToken = localStorage.getItem('auth_token');
        const sessionToken = sessionStorage.getItem('auth_token');
        
        this._log(`Token check - localStorage: ${localToken ? 'found' : 'not found'}, sessionStorage: ${sessionToken ? 'found' : 'not found'}`);
        
        // Try to get token from localStorage first, then fallback to sessionStorage
        const token = localToken || sessionToken || null;
        
        // Validate that the token looks like a JWT (basic check)
        if (token && typeof token === 'string' && token.split('.').length === 3) {
            this._log(`Found valid token: ${token.substr(0, 10)}...`);
            return token;
        }
        
        // If invalid, clear it from storage
        if (localToken) localStorage.removeItem('auth_token');
        if (sessionToken) sessionStorage.removeItem('auth_token');
        
        this._log('No valid token found in storage');
        return null;
    }

    /**
     * Set the authentication token
     * @param {string} token - The JWT token
     */
    setAuthToken(token) {
        // Only set if it's a valid token
        if (token && typeof token === 'string' && token.split('.').length === 3) {
            this.authToken = token;
            this.config.authToken = token;
        } else {
            console.warn('Attempted to set invalid authentication token');
            this.clearAuthToken();
        }
    }

    /**
     * Clear the authentication token
     */
    clearAuthToken() {
        this.authToken = null;
        this.config.authToken = null;
        localStorage.removeItem('auth_token');
        sessionStorage.removeItem('auth_token');
    }

    /**
     * Check if the user is authenticated
     * @returns {boolean} True if authenticated, false otherwise
     */
    isAuthenticated() {
        return !!(this.authToken && typeof this.authToken === 'string' && this.authToken.split('.').length === 3);
    }

    /**
     * Get the current authentication token
     * @returns {string|null} The current token or null if not authenticated
     */
    getAuthToken() {
        return this.authToken;
    }
}

/**
 * Factory function to create a socket service with environment-specific configuration
 */
export const createSocketService = (options = {}) => {
    // Determine environment-specific URL
    let url;
    if (process.env.NODE_ENV === 'production') {
        url = process.env.REACT_APP_WS_URL_PROD;
    } else if (process.env.NODE_ENV === 'staging') {
        url = process.env.REACT_APP_WS_URL_STAGING;
    } else {
        url = process.env.REACT_APP_WS_URL_DEV || 'ws://localhost:8011';
    }
    
    // Create authentication provider if needed
    const authProvider = options.authToken ? 
        async () => ({ token: options.authToken }) : 
        null;
    
    return new SocketService({
        url,
        authProvider,
        debug: process.env.NODE_ENV !== 'production',
        ...options
    });
};

// Example usage (replace the example below with your actual implementation)
// ---------------------------------------------------------
// import { createSocketService } from './socketService';
//
// // Create the socket service with auth token from localStorage
// const socketService = createSocketService({
//     authToken: localStorage.getItem('auth_token'),
//     heartbeatInterval: 15000
// });
//
// // Use the promise-based API for requests
// async function fetchUserData(userId) {
//     try {
//         const response = await socketService.request({
//             type: 'get_user',
//             userId
//         });
//         return response.data;
//     } catch (error) {
//         console.error('Failed to fetch user data:', error);
//         throw error;
//     }
// }
