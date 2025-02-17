// socketService.js

export class SocketService {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.isConnected = false;
    this.messageQueue = [];
    this.listeners = {}; // Holds callbacks for events/request IDs
    this.connect();
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.isConnected = true;
      console.log("WebSocket connected");

      // Flush any messages queued before connection was open.
      while (this.messageQueue.length > 0) {
        this.ws.send(this.messageQueue.shift());
      }

      this._emit("open");
    };

    this.ws.onmessage = (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch (e) {
        console.error("Failed to parse message:", event.data);
        return;
      }
      console.log("Received:", message);

      // If the message has a specific requestId, notify listeners.
      if (message.requestId && this.listeners[message.requestId]) {
        this.listeners[message.requestId].forEach((callback) => callback(message));
      }
      // Also trigger any global message listeners.
      this._emit("message", message);
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      this._emit("error", error);
    };

    this.ws.onclose = (event) => {
      this.isConnected = false;
      console.warn("WebSocket closed:", event);
      this._emit("close", event);

      // Optionally, add reconnection logic
      setTimeout(() => this.connect(), 3000);
    };
  }

  /**
   * Sends a message to the server. If the socket isn’t ready, the message is queued.
   * @param {Object|string} message - The message object (will be JSON-stringified) or string.
   */
  sendMessage(message) {
    const messageStr = typeof message === "string" ? message : JSON.stringify(message);
    if (this.isConnected) {
      this.ws.send(messageStr);
    } else {
      this.messageQueue.push(messageStr);
    }
  }

  /**
   * Registers a callback for a specific event or requestId.
   * Common events: "open", "close", "error", "message".
   * You can also use a requestId to handle responses for specific messages.
   *
   * @param {string} event - The event name or requestId.
   * @param {Function} callback - The callback to register.
   */
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  /**
   * Unregisters a callback from an event.
   *
   * @param {string} event - The event name or requestId.
   * @param {Function} callback - The callback to remove.
   */
  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);
    }
  }

  /**
   * Internal method to trigger all callbacks for a given event.
   *
   * @param {string} event - The event name.
   * @param {*} data - Optional data to pass to the callbacks.
   */
  _emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((callback) => callback(data));
    }
  }
}

// Create and export an instance of SocketService.
export const socketService = new SocketService("ws://localhost:8011");
