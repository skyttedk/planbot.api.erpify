export class LoginDialog {
    constructor(options = {}) {
      this.onLoginSuccess = options.onLoginSuccess || (() => {});
      this.socketService = options.socketService;
      this.isLoading = false;
  
      // Element references
      this.container = null;
      this.dialog = null;
      this.form = null;
      this.errorMessage = null;
      this.usernameInput = null;
      this.passwordInput = null;
      this.rememberMe = null;
      this.submitButton = null;
      this.registerLink = null;
    }
  
    /////////////////
    // LIFECYCLE   //
    /////////////////
  
    show() {
      console.log("Showing login dialog...");
      if (!this.dialog) {
        this._createDialog();
      }
      this._restoreSavedCredentials();
      document.body.appendChild(this.container);
      setTimeout(() => {
        this.container.classList.add("active");
        this.usernameInput?.focus();
      }, 10);
    }
  
    hide() {
      console.log("Hiding login dialog...");
      window.loginDialogShowing = false;
      if (!this.container) {
        console.warn("Hide called but container is not available");
        return;
      }
      this.container.classList.remove("active");
      setTimeout(() => {
        console.log("Animation complete, removing login dialog from DOM");
        try {
          if (this.container?.parentNode) {
            this.container.parentNode.removeChild(this.container);
          } else {
            document.body.removeChild(this.container);
          }
        } catch (error) {
          console.error("Error removing login dialog:", error);
          if (this.container) {
            this.container.style.display = "none";
            try {
              document.body.removeChild(this.container);
            } catch (e) {
              // Ignore if already removed
            }
          }
        }
        this.dialog = null;
        this.container = null;
      }, 300);
    }
  
    /////////////////
    // UI CREATION //
    /////////////////
  
    _createDialog() {
      console.log("Creating login dialog elements...");
  
      // Container & debug border if in debug mode
      this.container = document.createElement("div");
      this.container.className = "login-container";
      if (window.location.search.includes("debug=true")) {
        this.container.style.border = "5px solid red";
      }
  
      // Dialog
      this.dialog = document.createElement("div");
      this.dialog.className = "login-dialog";
      if (window.location.search.includes("debug=true")) {
        const debugText = document.createElement("div");
        debugText.textContent = "LOGIN DIALOG DEBUG MODE";
        debugText.style.cssText =
          "background:red;color:white;padding:5px;text-align:center;";
        this.dialog.appendChild(debugText);
      }
  
      // Header with logo and title
      const header = document.createElement("div");
      header.className = "login-header";
      const logo = document.createElement("div");
      logo.className = "login-logo";
      logo.innerHTML = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" 
        xmlns="http://www.w3.org/2000/svg">
        <path d="M3 19V5C3 3.89543 3.89543 3 5 3H19C20.1046 3 21 3.89543 21 5V19C21 
        20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19Z" stroke="currentColor" 
        stroke-width="2"></path>
        <path d="M7 9H17M7 12H17M7 15H12" stroke="currentColor" stroke-width="2" 
        stroke-linecap="round"></path></svg>`;
      const title = document.createElement("h2");
      title.textContent = "erp";
      header.append(logo, title);
  
      // Form creation and event handling
      this.form = document.createElement("form");
      this.form.className = "login-form";
      this.form.addEventListener("submit", this._handleSubmit.bind(this));
  
      // Error message area
      this.errorMessage = document.createElement("div");
      this.errorMessage.className = "login-error";
      this.errorMessage.style.display = "none";
  
      // Username field group
      const usernameGroup = document.createElement("div");
      usernameGroup.className = "login-field";
      const usernameLabel = document.createElement("label");
      usernameLabel.setAttribute("for", "login-username");
      usernameLabel.textContent = "Username";
      this.usernameInput = document.createElement("input");
      this.usernameInput.type = "text";
      this.usernameInput.id = "login-username";
      this.usernameInput.name = "username";
      this.usernameInput.required = true;
      this.usernameInput.autocomplete = "username";
      this.usernameInput.placeholder = "Enter your username";
      usernameGroup.append(usernameLabel, this.usernameInput);
  
      // Password field group
      const passwordGroup = document.createElement("div");
      passwordGroup.className = "login-field";
      const passwordLabel = document.createElement("label");
      passwordLabel.setAttribute("for", "login-password");
      passwordLabel.textContent = "Password";
      this.passwordInput = document.createElement("input");
      this.passwordInput.type = "password";
      this.passwordInput.id = "login-password";
      this.passwordInput.name = "password";
      this.passwordInput.required = true;
      this.passwordInput.autocomplete = "current-password";
      this.passwordInput.placeholder = "Enter your password";
      passwordGroup.append(passwordLabel, this.passwordInput);
  
      // Remember-me checkbox group
      const rememberGroup = document.createElement("div");
      rememberGroup.className = "login-remember";
      this.rememberMe = document.createElement("input");
      this.rememberMe.type = "checkbox";
      this.rememberMe.id = "login-remember";
      this.rememberMe.name = "remember";
      this.rememberMe.checked = true;
      const rememberLabel = document.createElement("label");
      rememberLabel.setAttribute("for", "login-remember");
      rememberLabel.textContent = "Remember me";
      rememberGroup.append(this.rememberMe, rememberLabel);
  
      // Submit button
      this.submitButton = document.createElement("button");
      this.submitButton.type = "submit";
      this.submitButton.className = "login-button";
      this.submitButton.textContent = "Sign In";
  
      // Assemble form elements
      this.form.append(
        this.errorMessage,
        usernameGroup,
        passwordGroup,
        rememberGroup,
        this.submitButton
      );
  
      // Assemble dialog and container
      this.dialog.append(header, this.form);
      this.container = this.container || document.createElement("div");
      this.container.appendChild(this.dialog);
    }
  
    /////////////////
    // EVENT HANDLING //
    /////////////////
  
    async _handleSubmit(e) {
      e.preventDefault();
      if (this.isLoading) return;
  
      const username = this.usernameInput.value.trim();
      const password = this.passwordInput.value;
      if (!username || !password) {
        this._showError("Please enter both username and password.");
        return;
      }
  
      this._setLoading(true);
      this._hideError();
      console.log("Attempting login for user:", username);
  
      try {
        const loginRequest = {
          type: "controller",
          name: "Auth",
          action: "login",
          parameters: { username, password },
        };
  
        console.log("Sending login request:", JSON.stringify(loginRequest));
        const response = await this.socketService.request(loginRequest);
        console.log("Login response received:", JSON.stringify(response));
  
        if (response.success && response.data?.success) {
          const token = response.data.token;
          const user = response.data.user;
          console.log("Login successful, token received");
  
          if (this.rememberMe.checked) {
            localStorage.setItem("auth_token", token);
            localStorage.setItem("user_data", JSON.stringify(user));
            console.log("Credentials stored in localStorage (persistent)");
          } else {
            sessionStorage.setItem("auth_token", token);
            sessionStorage.setItem("user_data", JSON.stringify(user));
            console.log("Credentials stored in sessionStorage (session only)");
          }
          this.socketService.setAuthToken(token);
          this.hide();
          setTimeout(() => {
            this.onLoginSuccess(token, user);
          }, 350);
        } else {
          const errorMessage =
            response.data?.message || "Authentication failed. Please try again.";
          console.error("Login failed:", errorMessage);
          this._showError(errorMessage);
        }
      } catch (error) {
        console.error("Login request error:", error);
        this._showError("Connection error. Please try again later.");
      } finally {
        this._setLoading(false);
      }
    }
  
    _showError(message) {
      this.errorMessage.textContent = message;
      this.errorMessage.style.display = "block";
    }
  
    _hideError() {
      this.errorMessage.style.display = "none";
    }
  
    _setLoading(isLoading) {
      this.isLoading = isLoading;
      this.submitButton.disabled = isLoading;
      this.submitButton.innerHTML = isLoading
        ? `<span class="loading-spinner"></span> Signing In...`
        : "Sign In";
    }
  
    _restoreSavedCredentials() {
      const savedUserData = localStorage.getItem("user_data");
      if (savedUserData) {
        try {
          const userData = JSON.parse(savedUserData);
          if (userData?.username) {
            this.usernameInput.value = userData.username;
            setTimeout(() => {
              this.passwordInput.focus();
            }, 50);
          }
        } catch (e) {
          console.warn("Error parsing saved user data:", e);
          localStorage.removeItem("user_data");
        }
      }
    }
  }
  
  export const createLoginDialog = (options = {}) => new LoginDialog(options);
  