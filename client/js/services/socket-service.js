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

    // Send a message through the WebSocket
    sendMessage(message) {
        // Ensure message is an object
        const msgObj = typeof message === 'string' ? JSON.parse(message) : message;
        
        // Add authentication token to every outgoing message
        msgObj.token = this.config.authToken;
        
        // Add timestamp if not present
        if (!msgObj.timestamp) {
            msgObj.timestamp = new Date().toISOString();
        }

        // Stringify for sending
        const messageStr = JSON.stringify(msgObj);
        
        if (this.connectionState === 'connected') {
            this._log('Sending message:', msgObj);
            this.ws.send(messageStr);
        } else {
            this._log('Queueing message (not connected):', msgObj);
            this.messageQueue.push(messageStr);
        }
    }

    // Send a request and return a promise that resolves with the response
    async request(message, timeout = null) {
        return new Promise((resolve, reject) => {
            const requestId = this._generateRequestId();
            const timeoutMs = timeout || this.config.requestTimeout;
            
            // Add requestId to the message
            const requestMessage = {
                ...(typeof message === 'object' ? message : { data: message }),
                requestId
            };
            
            // Set timeout for the request
            const timeoutId = setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    reject(new Error(`Request timed out after ${timeoutMs}ms`));
                }
            }, timeoutMs);
            
            // Store the handlers
            this.pendingRequests.set(requestId, {
                resolve,
                reject,
                timeoutId
            });
            
            // Send the request
            this.sendMessage(requestMessage);
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

    // Handle WebSocket open event
    _handleOpen() {
        this.connectionState = 'connected';
        this.reconnectAttempts = 0;
        this._log('WebSocket connected');
        
        // Start heartbeat
        this._startHeartbeat();
        
        // Authenticate if provider exists
        this._authenticate();
        
        // Process queued messages
        this._processQueue();
        
        // Emit event
        this._emit('open');
    }

    // Handle WebSocket message event
    _handleMessage(event) {
        let message;
        
        try {
            message = JSON.parse(event.data);
        } catch (error) {
            this._log('Failed to parse WebSocket message:', event.data);
            this._emit('error', { 
                type: 'parse_error', 
                error, 
                rawData: event.data 
            });
            return;
        }
        
        // Log received message if debug is enabled
        if (this.config.debug) {
            this._log('Received:', message);
        }
        
        // Handle heartbeat response
        if (message.type === 'pong' || message.type === 'heartbeat_response') {
            clearTimeout(this.heartbeatTimeoutTimer);
            return;
        }
        
        // Handle response to a specific request
        if (message.requestId && this.pendingRequests.has(message.requestId)) {
            const { resolve, timeoutId } = this.pendingRequests.get(message.requestId);
            clearTimeout(timeoutId);
            this.pendingRequests.delete(message.requestId);
            resolve(message);
        }
        
        // Emit event for the specific message type
        if (message.type) {
            this._emit(message.type, message);
        }
        
        // Emit general message event
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
