import './components/bindable-input.js';
import { WindowForm } from './window-form-builder.js';
import { SocketService } from './services/socket-service.js';
import { LoginDialog } from './components/login-dialog.js';

class App {
  constructor() {
    this.socketService = new SocketService({
      url: "ws://localhost:8011",
      debug: true,
      reconnectDelay: 3000,
      requestTimeout: 10000,
      autoConnect: true,
    });

    // Application state stored as properties instead of globals
    this.loginDialogShowing = false;
    this.applicationInitialized = false;
    this.viewBeingLoaded = null;
    this.pendingRequests = {};
    this.currentUser = null;

    this.init();
  }

  init() {
    document.addEventListener("DOMContentLoaded", () => {
      console.log("Document loaded, initializing application...");
      this.ensureDesktop();
      this.setupSocketListeners();

      // If the socket is already connected, check authentication shortly after page load.
      if (this.socketService.getState() === "connected") {
        console.log("Socket already connected on page load");
        setTimeout(() => this.checkAuthenticationAndProceed(), 100);
      }

      // Force authentication check after a short delay regardless of socket state.
      setTimeout(() => {
        console.log("Performing timeout-based authentication check");
        if (!this.loginDialogShowing && !this.applicationInitialized) {
          this.checkAuthenticationAndProceed();
        }
      }, 1000);
    });
  }

  ensureDesktop() {
    if (!document.getElementById("desktop")) {
      const desktop = document.createElement("div");
      desktop.id = "desktop";
      document.body.appendChild(desktop);
    }
  }

  setupSocketListeners() {
    this.socketService.on("connected", () => {
      console.log("Socket connected event received");
      setTimeout(() => this.checkAuthenticationAndProceed(), 100);
    });

    this.socketService.on("auth_error", this.handleAuthError.bind(this));

    this.socketService.on("error", (error) => {
      console.error("Socket connection error:", error);
      this.hideLoadingIndicator();
      this.showErrorMessage("Connection error. Please check your network connection.");
    });

    this.socketService.on("open", () => {
      console.log("Socket connected successfully");
    });

    // Centralize all message handling in one method.
    this.socketService.on("message", this.handleSocketMessage.bind(this));
  }

  checkAuthenticationAndProceed() {
    console.log("Checking authentication status...");
    const localToken = localStorage.getItem("auth_token");
    const sessionToken = sessionStorage.getItem("auth_token");
    console.log(
      `Token in localStorage: ${localToken ? "Yes" : "No"}, sessionStorage: ${sessionToken ? "Yes" : "No"}`
    );

    if (this.socketService.isAuthenticated()) {
      console.log("User is authenticated with valid token, initializing application...");
      this.initializeApplication();
    } else {
      console.log("User is not authenticated - no valid token found");
      const storedToken = localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token");
      if (storedToken) {
        console.log("Found stored token, attempting to set it and validate...");
        this.socketService.setAuthToken(storedToken);
        if (this.socketService.isAuthenticated()) {
          console.log("Token validated successfully on retry, initializing application...");
          this.initializeApplication();
          return;
        } else {
          console.log("Stored token failed validation, clearing it");
          this.socketService.clearAuthToken();
        }
      }
      this.showLoginDialog();
    }
  }

  showLoginDialog() {
    if (this.loginDialogShowing) {
      console.log("Login dialog already showing, not creating another one");
      return;
    }
    console.log("Showing login dialog...");
    this.loginDialogShowing = true;

    const loginDialog = new LoginDialog({
      socketService: this.socketService,
      onLoginSuccess: (token, user) => {
        console.log("Login successful, initializing application...");
        this.currentUser = user;
        this.loginDialogShowing = false;
        this.initializeApplication();
      },
      onRegisterClick: () => {
        console.log("Register clicked");
        alert("Please contact your system administrator to create an account.");
      },
    });

    loginDialog.show();
  }

  async initializeApplication() {
    if (this.applicationInitialized) {
      console.log("Application already initialized, skipping...");
      return;
    }
    console.log("Initializing application...");
    this.applicationInitialized = true;
    try {
      const menu = await this.fetchMenuFromServer();
      console.log("Menu loaded successfully", menu);
    } catch (error) {
      console.error("Failed to load menu from server:", error);
      if (error.message?.includes("Unauthorized")) {
        console.log("Authentication failed, clearing token and showing login...");
        this.applicationInitialized = false;
        this.socketService.clearAuthToken();
        this.showLoginDialog();
        return;
      }
      this.showErrorMessage(
        "Failed to load application menu. Please check your connection and try again."
      );
    }
  }

  async fetchMenuFromServer() {
    try {
      const response = await this.socketService.request({
        type: "menu",
        token: this.socketService.getAuthToken(),
      });
      if (response.success && Array.isArray(response.result)) {
        this.createTopMenuBar(response.result);
        return response.result;
      } else {
        throw new Error(response.message || "Invalid menu structure received from server");
      }
    } catch (error) {
      console.error("Error fetching menu from server:", error);
      throw error;
    }
  }

  createTopMenuBar(serverMenuStructure) {
    if (!serverMenuStructure || !Array.isArray(serverMenuStructure) || serverMenuStructure.length === 0) {
      console.error("No valid menu structure available");
      this.showErrorMessage("Failed to load application menu. Please refresh the page or contact support.");
      return;
    }

    const menuBar = document.createElement("div");
    menuBar.id = "top-menu-bar";
    menuBar.className = "top-menu-bar";

    // Left-side menu (application menus)
    const menuList = document.createElement("ul");
    menuList.className = "left-menu";
    serverMenuStructure.forEach((menuItem) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.textContent = menuItem.label;
      a.href = "#";
      a.addEventListener("click", (e) => e.preventDefault());
      li.appendChild(a);

      // Submenu (if available)
      if (menuItem.submenu && menuItem.submenu.length > 0) {
        const submenu = document.createElement("ul");
        menuItem.submenu.forEach((submenuItem) => {
          const subLi = document.createElement("li");
          const subA = document.createElement("a");
          subA.textContent = submenuItem.label;
          subA.href = "#";
          subA.addEventListener("click", (e) => {
            e.preventDefault();
            this.loadView(submenuItem.viewName);
          });
          subLi.appendChild(subA);
          submenu.appendChild(subLi);
        });
        li.appendChild(submenu);
      }
      menuList.appendChild(li);
    });
    menuBar.appendChild(menuList);

    // Right-side menu (user/settings)
    const userMenuList = document.createElement("ul");
    userMenuList.className = "right-menu";
    const settingsLi = document.createElement("li");
    settingsLi.className = "settings-menu";

    const settingsButton = document.createElement("a");
    settingsButton.href = "#";
    settingsButton.className = "settings-button";
    settingsButton.innerHTML = '<span class="menu-icon">☰</span>';
    settingsButton.addEventListener("click", (e) => e.preventDefault());
    settingsLi.appendChild(settingsButton);

    const settingsDropdown = document.createElement("ul");
    const usernameLi = document.createElement("li");
    usernameLi.className = "username-display";

    let username = "User";
    try {
      const userData = JSON.parse(
        localStorage.getItem("user_data") || sessionStorage.getItem("user_data") || "{}"
      );
      if (userData?.username) {
        username = userData.username;
      }
    } catch (e) {
      console.warn("Error parsing user data:", e);
    }
    const usernameText = document.createElement("span");
    usernameText.textContent = username;
    usernameLi.appendChild(usernameText);

    const logoutLi = document.createElement("li");
    const logoutLink = document.createElement("a");
    logoutLink.href = "#";
    logoutLink.textContent = "Logout";
    logoutLink.addEventListener("click", (e) => {
      e.preventDefault();
      this.logout();
    });
    logoutLi.appendChild(logoutLink);

    settingsDropdown.append(usernameLi, logoutLi);
    settingsLi.appendChild(settingsDropdown);
    userMenuList.appendChild(settingsLi);
    menuBar.appendChild(userMenuList);

    const desktop = document.getElementById("desktop");
    document.body.insertBefore(menuBar, desktop);
  }

  hasVisibleForms() {
    return document.querySelectorAll(".window").length > 0;
  }

  handleAuthError(data) {
    console.warn("Authentication error detected:", data.message);
    
    // Always show login dialog for expired tokens, regardless of form visibility
    if (data.type === "token_expired" || 
        (data.message && (data.message.includes("jwt expired") || 
                          data.message.includes("Invalid or expired token")))) {
      console.warn("Token expired, forcing login dialog");
      this.socketService.clearAuthToken();
      this.showLoginDialog();
      
      // Notify the user that their session has expired
      this.showErrorMessage("Your session has expired. Please log in again.");
      return;
    }
    
    // For other auth errors, maintain the existing behavior
    if (this.hasVisibleForms()) {
      console.log("Ignoring auth error because forms are already visible");
      return;
    }
    if (this.viewBeingLoaded) {
      console.warn("Ignoring auth error during view loading:", data.message);
      return;
    }
    
    this.socketService.clearAuthToken();
    this.showLoginDialog();
  }

  loadView(viewName) {
    console.log(`Loading view: ${viewName}`);
    const token = this.socketService.getAuthToken();
    if (!token) {
      console.error("Not authenticated, showing login dialog");
      this.showLoginDialog();
      return;
    }
    this.viewBeingLoaded = viewName;
    this.showLoadingIndicator(viewName);

    this.socketService.sendMessage({
      type: "view",
      name: viewName,
      token,
      requestId: `req-${viewName}-config`,
    });

    const timeoutId = setTimeout(() => {
      this.viewBeingLoaded = null;
      this.hideLoadingIndicator();
      this.showErrorMessage(`Failed to load ${viewName}. Server did not respond in time.`);
    }, 10000);

    this.pendingRequests[viewName] = timeoutId;
  }

  handleSocketMessage(message) {
    console.log("Received message:", message);
    if (message.error) {
      console.error("Server error:", message.error);
      this.hideLoadingIndicator();
      this.showErrorMessage(`Error: ${message.error}`);

      // Check specifically for token expiration errors
      if (message.error.includes("jwt expired") || message.error.includes("Invalid or expired token")) {
        console.warn("Token expiration detected, showing login dialog");
        this.socketService.clearAuthToken();
        this.showLoginDialog();
        this.showErrorMessage("Your session has expired. Please log in again.");
        this.viewBeingLoaded = null;
        return;
      }

      if (
        (message.error.includes("Unauthorized") ||
          message.error.includes("authentication") ||
          message.error.includes("token")) &&
        !this.viewBeingLoaded
      ) {
        if (!this.hasVisibleForms()) {
          console.warn("Authentication error detected, showing login dialog");
          this.socketService.clearAuthToken();
          this.showLoginDialog();
        } else {
          console.log("Ignoring auth error because forms are already visible");
        }
      }
      this.viewBeingLoaded = null;
      return;
    }

    // Check specifically for token expiration errors in message
    if (
      message.message &&
      !message.success &&
      (message.message.includes("jwt expired") || message.message.includes("Invalid or expired token"))
    ) {
      console.warn("Token expiration detected in message:", message.message);
      this.hideLoadingIndicator();
      this.socketService.clearAuthToken();
      this.showLoginDialog();
      this.showErrorMessage("Your session has expired. Please log in again.");
      this.viewBeingLoaded = null;
      return;
    }

    if (
      message.message &&
      !message.success &&
      (message.message.includes("Unauthorized") ||
        message.message.includes("authentication") ||
        message.message.includes("token"))
    ) {
      console.warn("Authentication error detected:", message.message);
      this.hideLoadingIndicator();
      const wasLoadingView = this.viewBeingLoaded;
      this.viewBeingLoaded = null;
      if (!wasLoadingView && !this.hasVisibleForms()) {
        this.socketService.clearAuthToken();
        this.showLoginDialog();
      } else {
        console.log("Ignoring auth error because a view was loading or forms are visible");
      }
      return;
    }

    if (!message.success && !message.requestId) {
      console.error("Unsuccessful response with no requestId:", message);
      return;
    }
    if (!message.requestId) {
      console.warn("Received message without requestId:", message);
      return;
    }

    // Process view configuration responses.
    if (
      message.requestId.startsWith("req-") &&
      message.requestId.endsWith("-config") &&
      message.result
    ) {
      const viewName = message.requestId.replace("req-", "").replace("-config", "");
      console.log("Processing view:", viewName, "with result:", message.result);

      if (this.pendingRequests[viewName]) {
        clearTimeout(this.pendingRequests[viewName]);
        delete this.pendingRequests[viewName];
      }
      this.viewBeingLoaded = null;
      this.hideLoadingIndicator();

      const windowConfigs = message.result;
      if (!Array.isArray(windowConfigs) || windowConfigs.length === 0) {
        console.error("Invalid window configurations received:", windowConfigs);
        this.showErrorMessage(`Error: Invalid configuration received for ${viewName}`);
        return;
      }
      if (viewName === "customerCard") {
        console.log("Loading Customer Card view with config:", windowConfigs);
      }
      windowConfigs.forEach((config) => {
        if (!config) {
          console.error("Invalid window configuration:", config);
          return;
        }
        if (!config.content && !config.formConfig) {
          console.error("Window configuration missing content or formConfig:", config);
          this.showErrorMessage(`Error: Invalid window configuration for ${viewName}`);
          return;
        }
        const finalConfig = { ...config, formConfig: config.formConfig || config.content };
        try {
          const wf = new WindowForm(finalConfig, this.socketService);
          document.getElementById("desktop").appendChild(wf.getElement());
        } catch (error) {
          console.error("Error creating window:", error);
          this.showErrorMessage(`Error creating window: ${error.message}`);
        }
      });
    } else if (message.requestId.startsWith("req-update-")) {
      console.log("Record update response received:", message.requestId);
    } else if (message.requestId.startsWith("req-find-first-")) {
      console.log("Find first record response received:", message.requestId);
    } else if (message.requestId.startsWith("req-lookup-")) {
      console.log("Lookup response received:", message.requestId);
    } else if (message.requestId.startsWith("req-find-all-")) {
      console.log("Find all records response received:", message.requestId);
    } else {
      console.log("Unhandled message type:", message.requestId);
    }
  }

  showLoadingIndicator(viewName) {
    this.hideLoadingIndicator();
    const loadingIndicator = document.createElement("div");
    loadingIndicator.id = "loading-indicator";
    loadingIndicator.className = "loading-indicator";
    loadingIndicator.innerHTML = `
      <div class="loading-spinner"></div>
      <div class="loading-text">Loading ${viewName}...</div>
    `;
    document.body.appendChild(loadingIndicator);
  }

  hideLoadingIndicator() {
    const existingIndicator = document.getElementById("loading-indicator");
    if (existingIndicator) {
      existingIndicator.remove();
    }
  }

  showErrorMessage(message) {
    const errorMessage = document.createElement("div");
    errorMessage.className = "error-message";
    errorMessage.textContent = message;
    document.getElementById("desktop").appendChild(errorMessage);
    setTimeout(() => errorMessage.remove(), 5000);
  }

  showSuccessMessage(message) {
    const successMessage = document.createElement("div");
    successMessage.className = "success-message";
    successMessage.textContent = message;
    document.getElementById("desktop").appendChild(successMessage);
    setTimeout(() => successMessage.remove(), 3000);
  }

  logout() {
    console.log("Logging out user...");
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_data");
    sessionStorage.removeItem("auth_token");
    sessionStorage.removeItem("user_data");
    this.socketService.clearAuthToken();
    this.applicationInitialized = false;

    const desktop = document.getElementById("desktop");
    if (desktop) {
      desktop.innerHTML = "";
    }
    const topMenu = document.getElementById("top-menu-bar");
    if (topMenu && topMenu.parentNode) {
      topMenu.parentNode.removeChild(topMenu);
    }
    this.showLoginDialog();
    console.log("Logout complete");
  }
}

new App();
