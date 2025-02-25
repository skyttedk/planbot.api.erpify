export class SocketService {
    constructor(url) {
        this.url = url;
        this.ws = null;
        this.isConnected = false;
        this.messageQueue = [];
        this.listeners = {};
        this.connect();
    }

    connect() {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            this.isConnected = true;
            console.log("WebSocket connected");
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
            if (message.requestId && this.listeners[message.requestId]) {
                this.listeners[message.requestId].forEach((callback) => callback(message));
            }
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
            setTimeout(() => this.connect(), 3000);
        };
    }

    sendMessage(message) {
        const messageStr = typeof message === "string" ? message : JSON.stringify(message);
        if (this.isConnected) {
            this.ws.send(messageStr);
        } else {
            this.messageQueue.push(messageStr);
        }
    }

    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    off(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);
        }
    }

    _emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach((callback) => callback(data));
        }
    }
}

export const socketService = new SocketService("ws://localhost:8011");
