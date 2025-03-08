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
      // Default configuration using nullish coalescing and object spread
      this.config = {
        url: options.url || this._getDefaultUrl(),
        reconnectInterval: options.reconnectInterval ?? 1000,
        maxReconnectInterval: options.maxReconnectInterval ?? 30000,
        reconnectDecay: options.reconnectDecay ?? 1.5,
        heartbeatInterval: options.heartbeatInterval ?? 30000,
        heartbeatTimeout: options.heartbeatTimeout ?? 10000,
        requestTimeout: options.requestTimeout ?? 10000,
        autoConnect: options.autoConnect !== undefined ? options.autoConnect : true,
        debug: options.debug ?? false,
        authProvider: options.authProvider ?? null,
        authToken: options.authToken ?? "123" // Default token for development
      };
  
      // Connection state
      this.ws = null;
      this.connectionState = "disconnected"; // "disconnected", "connecting", "connected", "closing"
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
      this._log(
        this.authToken
          ? `Initialized with authentication token: ${this.authToken.substr(0, 10)}...`
          : "Initialized without authentication token"
      );
  
      if (this.config.autoConnect) {
        this.connect();
      }
    }
  
    /////////////////
    // CONNECTION  //
    /////////////////
  
    // Returns default WebSocket URL based on environment.
    _getDefaultUrl() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = process.env.REACT_APP_WS_HOST || window.location.host;
      const path = process.env.REACT_APP_WS_PATH || "/ws";
      return `${protocol}//${host}${path}`;
    }
  
    connect() {
      if (["connected", "connecting"].includes(this.connectionState)) return;
  
      this.connectionState = "connecting";
      this._log("Connecting to WebSocket server...");
  
      // Clear any pending reconnect timer
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
  
      // Initialize connection
      this.ws = new WebSocket(this.config.url);
      this.ws.onopen = this._handleOpen.bind(this);
      this.ws.onmessage = this._handleMessage.bind(this);
      this.ws.onerror = this._handleError.bind(this);
      this.ws.onclose = this._handleClose.bind(this);
    }
  
    disconnect(code = 1000, reason = "Client disconnected") {
      if (["disconnected", "closing"].includes(this.connectionState)) return;
  
      this.connectionState = "closing";
      this._log(`Disconnecting from WebSocket server: ${reason}`);
      this._clearTimers();
  
      if (this.ws) {
        try {
          this.ws.close(code, reason);
        } catch (error) {
          this._log("Error closing WebSocket connection", error);
        }
      }
      this.connectionState = "disconnected";
      this._emit("close", { code, reason, wasClean: true });
    }
  
    reconnect() {
      this.disconnect(1000, "Manual reconnection");
      this.connect();
    }
  
    /////////////////
    // MESSAGING   //
    /////////////////
  
    sendMessage(message) {
      // Clone message to avoid side effects
      const messageToSend = { ...message };
  
      // Validate token if present
      if (messageToSend.token) {
        if (
          typeof messageToSend.token !== "string" ||
          messageToSend.token.split(".").length !== 3
        ) {
          console.warn("Attempted to send message with invalid token format:", messageToSend);
          delete messageToSend.token;
          if (!(messageToSend.type === "controller" && messageToSend.name === "Auth")) {
            this._emit("auth_error", { message: "Invalid token format" });
          }
        }
      }
  
      if (this.connectionState === "connected" && this.ws?.readyState === WebSocket.OPEN) {
        const messageStr = JSON.stringify(messageToSend);
        this.ws.send(messageStr);
        this._log("Sent:", messageToSend);
      } else {
        this.messageQueue.push(messageToSend);
        this._log("Queued message, connection not ready:", messageToSend);
        if (this.connectionState === "disconnected") {
          this.connect();
        }
      }
    }
  
    async request(message, timeout = null) {
      const messageToSend = { ...message };
      const requestId = messageToSend.requestId || this._generateRequestId();
      messageToSend.requestId = requestId;
  
      const isAuthRequest = messageToSend.type === "controller" && messageToSend.name === "Auth";
  
      if (!isAuthRequest) {
        const token = messageToSend.token || this.authToken;
        if (!token || typeof token !== "string" || token.split(".").length !== 3) {
          this._log("Request rejected due to missing or invalid token:", messageToSend);
          this._emit("auth_error", { message: "Authentication required" });
          return Promise.reject(new Error("Authentication required"));
        }
        if (!messageToSend.token) {
          messageToSend.token = token;
        }
      } else {
        delete messageToSend.token;
      }
  
      return new Promise((resolve, reject) => {
        const timeoutMs = timeout || this.config.requestTimeout;
        const timeoutId = setTimeout(() => {
          this.pendingRequests.delete(requestId);
          reject(new Error(`Request timed out after ${timeoutMs}ms`));
        }, timeoutMs);
  
        this.pendingRequests.set(requestId, { resolve, reject, timeoutId, sentAt: Date.now() });
        this.sendMessage(messageToSend);
      });
    }
  
    //////////////////////
    // EVENT MANAGEMENT //
    //////////////////////
  
    on(event, callback) {
      if (!this.listeners[event]) {
        this.listeners[event] = [];
      }
      this.listeners[event].push(callback);
      return this;
    }
  
    off(event, callback) {
      if (!this.listeners[event]) return this;
      if (callback) {
        this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);
      } else {
        delete this.listeners[event];
      }
      return this;
    }
  
    getState() {
      return this.connectionState;
    }
  
    //////////////////////
    // WEBSOCKET EVENTS //
    //////////////////////
  
    _handleOpen() {
      this._log("WebSocket connection established");
      this.connectionState = "connected";
      this.reconnectAttempts = 0;
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this._startHeartbeat();
      this._processQueue();
      this._emit("connected", { timestamp: Date.now() });
    }
  
    _handleMessage(event) {
      let message;
      try {
        message = JSON.parse(event.data);
        this._log("Message received:", message);
      } catch (error) {
        this._log("Error parsing message:", error);
        this._emit("error", { error, message: "Failed to parse message from server" });
        return;
      }
  
      if (message.type === "heartbeat_response") {
        this._log("Heartbeat response received");
        if (this.heartbeatTimeoutTimer) {
          clearTimeout(this.heartbeatTimeoutTimer);
          this.heartbeatTimeoutTimer = null;
        }
        return;
      }
  
      // Check specifically for token expiration errors
      if (
        message.success === false &&
        message.message &&
        (message.message.includes("jwt expired") || 
         message.message.includes("Invalid or expired token"))
      ) {
        this._log("Token expired, emitting auth_error event");
        this._emit("auth_error", { 
          message: message.message,
          type: "token_expired" 
        });
        return; // Stop processing after emitting auth_error
      }
      
      // Check for other authentication errors
      if (
        message.success === false &&
        message.message &&
        (message.message.includes("Unauthorized") ||
          message.message.includes("authentication") ||
          message.message.includes("Invalid token"))
      ) {
        this._emit("auth_error", { message: message.message });
      }
  
      if (message.requestId && this.pendingRequests.has(message.requestId)) {
        const { resolve, timeoutId } = this.pendingRequests.get(message.requestId);
        clearTimeout(timeoutId);
        this.pendingRequests.delete(message.requestId);
        resolve(message);
        return;
      }
  
      this._emit("message", message);
    }
  
    _handleError(error) {
      this._log("WebSocket error:", error);
      this._emit("error", error);
    }
  
    _handleClose(event) {
      this._clearTimers();
      this.connectionState = "disconnected";
      this._log(
        `WebSocket closed: Code ${event.code}, Reason: ${event.reason}, Clean: ${event.wasClean}`
      );
      this._emit("close", event);
      if (!event.wasClean) {
        this._scheduleReconnect();
      }
    }
  
    ////////////////
    // HEARTBEAT  //
    ////////////////
  
    _startHeartbeat() {
      if (!this.config.heartbeatInterval) return;
      this._clearHeartbeat();
      this.heartbeatTimer = setInterval(() => {
        if (this.connectionState !== "connected") return;
        this._log("Sending heartbeat ping");
        try {
          this.ws.send(
            JSON.stringify({
              type: "heartbeat",
              timestamp: Date.now(),
              token: this.config.authToken
            })
          );
          this.heartbeatTimeoutTimer = setTimeout(() => {
            this._log("Heartbeat timeout - connection is stale");
            this.reconnect();
          }, this.config.heartbeatTimeout);
        } catch (error) {
          this._log("Error sending heartbeat:", error);
        }
      }, this.config.heartbeatInterval);
    }
  
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
  
    _clearTimers() {
      this._clearHeartbeat();
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    }
  
    _scheduleReconnect() {
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
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
  
    _processQueue() {
      this._log(`Processing ${this.messageQueue.length} queued messages`);
      while (this.messageQueue.length > 0 && this.connectionState === "connected") {
        const message = this.messageQueue.shift();
        try {
          this.ws.send(message);
        } catch (error) {
          this._log("Error sending queued message:", error);
          this.messageQueue.unshift(message);
          break;
        }
      }
    }
  
    //////////////////////
    // AUTHENTICATION   //
    //////////////////////
  
    async _authenticate() {
      if (!this.config.authProvider || this.connectionState !== "connected") return;
      try {
        const authData = await this.config.authProvider();
        this.sendMessage({
          type: "authenticate",
          auth: authData
        });
      } catch (error) {
        this._log("Authentication error:", error);
        this._emit("error", { type: "auth_error", error });
      }
    }
  
    //////////////////////
    // HELPER FUNCTIONS //
    //////////////////////
  
    _emit(event, data) {
      if (this.listeners[event]) {
        this.listeners[event].forEach((callback) => {
          try {
            callback(data);
          } catch (error) {
            console.error(`Error in ${event} event listener:`, error);
          }
        });
      }
    }
  
    _generateRequestId() {
      return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
  
    _log(...args) {
      if (this.config.debug) {
        console.log("[SocketService]", ...args);
      }
    }
  
    _getStoredToken() {
      const localToken = localStorage.getItem("auth_token");
      const sessionToken = sessionStorage.getItem("auth_token");
      this._log(
        `Token check - localStorage: ${localToken ? "found" : "not found"}, sessionStorage: ${
          sessionToken ? "found" : "not found"
        }`
      );
      const token = localToken || sessionToken || null;
      if (token && typeof token === "string" && token.split(".").length === 3) {
        this._log(`Found valid token: ${token.substr(0, 10)}...`);
        return token;
      }
      if (localToken) localStorage.removeItem("auth_token");
      if (sessionToken) sessionStorage.removeItem("auth_token");
      this._log("No valid token found in storage");
      return null;
    }
  
    setAuthToken(token) {
      if (token && typeof token === "string" && token.split(".").length === 3) {
        this.authToken = token;
        this.config.authToken = token;
      } else {
        console.warn("Attempted to set invalid authentication token");
        this.clearAuthToken();
      }
    }
  
    clearAuthToken() {
      this.authToken = null;
      this.config.authToken = null;
      localStorage.removeItem("auth_token");
      sessionStorage.removeItem("auth_token");
    }
  
    isAuthenticated() {
      return !!(this.authToken && typeof this.authToken === "string" && this.authToken.split(".").length === 3);
    }
  
    getAuthToken() {
      return this.authToken;
    }
  }
  
  /**
   * Factory function to create a socket service with environment-specific configuration.
   */
  export const createSocketService = (options = {}) => {
    let url;
    if (process.env.NODE_ENV === "production") {
      url = process.env.REACT_APP_WS_URL_PROD;
    } else if (process.env.NODE_ENV === "staging") {
      url = process.env.REACT_APP_WS_URL_STAGING;
    } else {
      url = process.env.REACT_APP_WS_URL_DEV || "ws://localhost:8011";
    }
    const authProvider = options.authToken
      ? async () => ({ token: options.authToken })
      : null;
    return new SocketService({
      url,
      authProvider,
      debug: process.env.NODE_ENV !== "production",
      ...options
    });
  };
  
  // ---------------------------------------------------------
  // Example usage:
  //
  // import { createSocketService } from './socketService';
  //
  // const socketService = createSocketService({
  //   authToken: localStorage.getItem('auth_token'),
  //   heartbeatInterval: 15000
  // });
  //
  // async function fetchUserData(userId) {
  //   try {
  //     const response = await socketService.request({
  //       type: 'get_user',
  //       userId
  //     });
  //     return response.data;
  //   } catch (error) {
  //     console.error('Failed to fetch user data:', error);
  //     throw error;
  //   }
  // }
  