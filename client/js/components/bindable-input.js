class BindableInput extends HTMLElement {
    static formAssociated = true;
  
    static get observedAttributes() {
      return [
        "type",
        "field",
        "debounce",
        "options",
        "aria-label",
        "placeholder",
        "required",
        "disabled",
        "readonly",
        "immutable",
        "min",
        "max",
        "pattern",
        "minlength",
        "maxlength",
        "autocomplete",
      ];
    }
  
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._record = null;
      this._field = null;
      this._debounceDelay = 300;
      this._immutable = false;
      this._valueChanged = false;
  
      // Form internals for form association
      if (BindableInput.formAssociated) {
        this._internals = this.attachInternals();
      }
  
      // Initialize input-related handlers and UI
      this._createInputHandlerWithDebounce();
      this._createStyles();
      this._createInput();
    }
  
    /////////////////
    // LIFECYCLE   //
    /////////////////
  
    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) return;
      switch (name) {
        case "type":
          this._createInput();
          this.updateValue();
          break;
        case "field":
          this._field = newValue;
          this.updateValue();
          break;
        case "debounce":
          this._debounceDelay = Number(newValue) || 300;
          this._createInputHandlerWithDebounce();
          break;
        case "options":
          if (this.getAttribute("type") === "select" || this.getAttribute("type") === "enum") {
            this._createInput();
            this.updateValue();
          }
          break;
        case "immutable":
          this._immutable = this.hasAttribute("immutable");
          break;
        case "disabled":
        case "readonly":
        case "required":
          if (this.inputElement) {
            newValue === null
              ? this.inputElement.removeAttribute(name)
              : this.inputElement.setAttribute(name, newValue);
            this._updateFormValidity();
          }
          break;
        default:
          if (this.inputElement) {
            newValue === null
              ? this.inputElement.removeAttribute(name)
              : this.inputElement.setAttribute(name, newValue);
          }
      }
    }
  
    connectedCallback() {
      if (this.hasAttribute("field")) {
        this._field = this.getAttribute("field");
      }
      if (this.hasAttribute("debounce")) {
        this._debounceDelay = Number(this.getAttribute("debounce")) || 300;
        this._createInputHandlerWithDebounce();
      }
      if (this.hasAttribute("immutable")) {
        this._immutable = true;
      }
      // Comment out the problematic call until we implement it properly
      // this._setupLabelAssociation();
    }
  
    disconnectedCallback() {
      if (this.inputElement) {
        this.inputElement.removeEventListener("input", this._inputHandler);
        this.inputElement.removeEventListener("change", this._inputHandler);
        this.inputElement.removeEventListener("blur", this._onBlur);
      }
    }
  
    /////////////////
    // STYLING & UI //
    /////////////////
  
    _createStyles() {
      const style = document.createElement("style");
      style.textContent = `
        :host {
          display: inline-block;
          /* Compact input variables */
          --input-background: white;
          --input-color: black;
          --input-border: 1px solid #ddd;
          --input-border-radius: 4px;
          --input-padding: 4px 6px;       /* Reduced padding */
          --input-font-size: 10px;        /* Smaller font */
          --input-focus-border: 1px solid #3498db;
          --input-focus-outline: 2px solid rgba(52,152,219,0.25);
          --input-error-border: 1px solid #cc0000;
          --input-error-background: #fff8f8;
          --input-disabled-background: #f2f2f2;
          --input-disabled-color: #666;
          --input-placeholder-color: #999;
        }
        
        :host([disabled]) {
          opacity: 0.7;
          cursor: not-allowed;
        }
        
        input, select, textarea {
          box-sizing: border-box;
          width: 100%;
          background: var(--input-background);
          color: var(--input-color);
          border: var(--input-border);
          border-radius: var(--input-border-radius);
          padding: var(--input-padding);
          font-size: var(--input-font-size);
          font-family: inherit;
          /* Disable autocomplete UI */
          background-image: none !important;
        }
        
        input:focus, select:focus, textarea:focus {
          border: var(--input-focus-border);
          outline: var(--input-focus-outline);
        }
        
        input:disabled, select:disabled, textarea:disabled {
          background: var(--input-disabled-background);
          color: var(--input-disabled-color);
          cursor: not-allowed;
        }
        
        input::placeholder, textarea::placeholder {
          color: var(--input-placeholder-color);
        }
        
        /* Aggressive browser autocomplete disabling - inside shadow DOM */
        input:-webkit-autofill,
        input:-webkit-autofill:hover, 
        input:-webkit-autofill:focus,
        input:-webkit-autofill:active,
        input:autofill,
        input:autofill:hover,
        input:autofill:focus,
        input:autofill:active {
          transition-property: background-color, color !important;
          transition-delay: 99999s !important;
          transition-duration: 99999s !important;
          -webkit-text-fill-color: var(--input-color) !important;
          caret-color: var(--input-color) !important;
          box-shadow: 0 0 0 30px transparent inset !important;
        }
        
        /* Remove browser-specific UI elements inside shadow DOM */
        input::-webkit-contacts-auto-fill-button,
        input::-webkit-credentials-auto-fill-button,
        input::-webkit-credit-card-auto-fill-button,
        input::-webkit-calendar-picker-indicator,
        input::-webkit-inner-spin-button,
        input::-webkit-outer-spin-button,
        input::-webkit-search-cancel-button,
        input::-webkit-search-decoration,
        input::-webkit-search-results-button,
        input::-webkit-search-results-decoration {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          appearance: none !important;
          -webkit-appearance: none !important;
        }
        
        :host([invalid]) input, 
        :host([invalid]) select, 
        :host([invalid]) textarea {
          border: var(--input-error-border);
          background: var(--input-error-background);
        }
        
        .error-message {
          color: #cc0000;
          font-size: 0.85em;
          margin-top: 2px;        /* Tighter spacing */
          display: none;
        }
        
        :host([invalid]) .error-message {
          display: block;
        }
      `;
      this.shadowRoot.appendChild(style);
    }
    
    _createInput() {
      // Clean up existing input and error message (if any)
      if (this.inputElement && this.shadowRoot.contains(this.inputElement)) {
        this.inputElement.removeEventListener("input", this._inputHandler);
        this.inputElement.removeEventListener("change", this._inputHandler);
        this.inputElement.removeEventListener("blur", this._onBlur);
        this.shadowRoot.removeChild(this.inputElement);
      }
      const existingError = this.shadowRoot.querySelector(".error-message");
      if (existingError) {
        this.shadowRoot.removeChild(existingError);
      }
  
      const inputType = this.getAttribute("type") || "text";
      this.inputElement = this._createInputByType(inputType);
      this._applyCommonAttributes();
      this._addInputEventListeners(inputType);
      this.shadowRoot.appendChild(this.inputElement);
  
      // Append error message container
      const errorMessage = document.createElement("div");
      errorMessage.className = "error-message";
      errorMessage.setAttribute("aria-live", "polite");
      this.shadowRoot.appendChild(errorMessage);
    }
  
    _createInputByType(inputType) {
      let element;
      
      if (inputType === "textarea") {
        element = document.createElement("textarea");
      } else if (inputType === "select" || inputType === "enum") {
        element = document.createElement("select");
        this._populateSelectOptions(element);
      } else if (inputType === "lookup") {
        // Create a container for the lookup input
        const container = document.createElement("div");
        container.className = "lookup-container";
        container.style.position = "relative";
        container.style.width = "100%";

        // Create the text input element for entering search query
        const input = document.createElement("input");
        input.type = "text";
        input.className = "lookup-input";
        input.placeholder = "Type to search...";
        
        // Apply autocomplete attributes to the input element
        input.setAttribute("autocomplete", "off");
        input.setAttribute("autocorrect", "off");
        input.setAttribute("autocapitalize", "off");
        input.setAttribute("spellcheck", "false");
        
        container.appendChild(input);

        // Create a clear button for the input
        const clearButton = document.createElement("div");
        clearButton.className = "lookup-clear";
        clearButton.innerHTML = "×";
        clearButton.style.position = "absolute";
        clearButton.style.right = "20px"; // Leave space for the dropdown indicator
        clearButton.style.top = "50%";
        clearButton.style.transform = "translateY(-50%)";
        clearButton.style.fontSize = "14px";
        clearButton.style.color = "#999";
        clearButton.style.cursor = "pointer";
        clearButton.style.display = "none"; // Hide by default
        clearButton.style.width = "14px";
        clearButton.style.height = "14px";
        clearButton.style.textAlign = "center";
        clearButton.style.lineHeight = "14px";
        
        // Show clear button when input has content
        input.addEventListener("input", () => {
          clearButton.style.display = input.value ? "block" : "none";
        });
        
        // Clear input when button is clicked
        clearButton.addEventListener("click", (e) => {
          e.stopPropagation(); // Prevent dropdown from opening
          input.value = "";
          input.dataset.value = "";
          clearButton.style.display = "none";
          
          // Hide dropdown
          dropdown.style.display = "none";
          
          // Trigger change to update record
          input.dispatchEvent(new Event("change"));
        });
        
        container.appendChild(clearButton);

        // Create the dropdown container for displaying lookup options
        const dropdown = document.createElement("div");
        dropdown.className = "lookup-dropdown";
        dropdown.style.position = "absolute";
        dropdown.style.top = "100%";
        dropdown.style.left = "0";
        dropdown.style.right = "0";
        dropdown.style.zIndex = "1000";
        dropdown.style.background = "white";
        dropdown.style.border = "1px solid #ddd";
        dropdown.style.borderTop = "none";
        dropdown.style.borderRadius = "0 0 4px 4px";
        dropdown.style.maxHeight = "200px";
        dropdown.style.overflowY = "auto";
        dropdown.style.display = "none";
        dropdown.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
        container.appendChild(dropdown);

        // Save references for later use
        this._lookupInput = input;
        this._lookupDropdown = dropdown;

        // Event handler for input change
        input.addEventListener("input", (e) => {
          const query = e.target.value.toLowerCase();
          console.log(`Lookup search query for ${this._field}: "${query}"`);
          
          // Store reference to component instance
          const self = this;
          
          // If we have local options, filter them by the search term
          if (this._lookupOptions && Array.isArray(this._lookupOptions) && this._lookupOptions.length > 0) {
            const filteredOptions = this._lookupOptions.filter(option => {
              const displayText = (option.name || option.label || option.toString()).toLowerCase();
              return displayText.includes(query);
            });
            
            // Show filtered options
            self._renderLookupOptions(filteredOptions);
            dropdown.style.display = "block";
          } else {
            // Dispatch a custom event so that the parent form can fetch lookup options
            this.dispatchEvent(new CustomEvent("lookup-search", {
              detail: { 
                query, 
                field: this._field 
              },
              bubbles: true,
              composed: true
            }));
            
            // If the dropdown is not visible, show it
            if (dropdown.style.display !== "block") {
              dropdown.style.display = "block";
            }
          }
        });
        
        // Handle change event to update the record
        input.addEventListener("change", () => {
          this.onInput();
        });
        
        // Hide dropdown on blur after a short delay
        input.addEventListener("blur", () => {
          setTimeout(() => { dropdown.style.display = "none"; }, 200);
        });
        
        // Show dropdown when clicking on the input
        input.addEventListener("click", (e) => {
          // If dropdown is already showing, keep it that way
          if (dropdown.style.display === "block") {
            return;
          }
          
          // Show clear button if there's a value
          clearButton.style.display = input.value ? "block" : "none";
          
          // Store reference to component instance
          const self = this;
          
          // If we have options stored, show them
          if (this._lookupOptions && Array.isArray(this._lookupOptions) && this._lookupOptions.length > 0) {
            if (input.value) {
              // If there's text in the input, filter the options
              const query = input.value.toLowerCase();
              const filteredOptions = this._lookupOptions.filter(option => {
                const displayText = (option.name || option.label || option.toString()).toLowerCase();
                return displayText.includes(query);
              });
              self._renderLookupOptions(filteredOptions);
            } else {
              // Otherwise show all options
              self._renderLookupOptions(this._lookupOptions);
            }
            dropdown.style.display = "block";
          } else {
            // Dispatch a search event with empty query to get all options
            this.dispatchEvent(new CustomEvent("lookup-search", {
              detail: { query: "", field: this._field },
              bubbles: true,
              composed: true
            }));
          }
        });

        // Add a small dropdown indicator
        const indicator = document.createElement("div");
        indicator.className = "lookup-indicator";
        indicator.innerHTML = "▼";
        indicator.style.position = "absolute";
        indicator.style.right = "5px";
        indicator.style.top = "50%";
        indicator.style.transform = "translateY(-50%)";
        indicator.style.fontSize = "8px";
        indicator.style.color = "#666";
        indicator.style.pointerEvents = "none";
        container.appendChild(indicator);

        // The actual input element is this._lookupInput, not the container
        this.inputElement = input;
        
        return container;
      } else {
        element = document.createElement("input");
        element.type = inputType;
      }
      
      // Apply aggressive autocomplete disabling
      // Use multiple techniques to ensure browsers respect it
      element.setAttribute("autocomplete", "off");
      element.setAttribute("autocorrect", "off");
      element.setAttribute("autocapitalize", "off");
      element.setAttribute("spellcheck", "false");
      
      // For text/search inputs, add additional attributes browsers look for
      if (["text", "search", "email", "url", "tel", "number"].includes(inputType)) {
        // Chrome respects "new-password" for disabling autocomplete
        element.setAttribute("autocomplete", "new-password");
      }
      
      return element;
    }
  
    _populateSelectOptions(select) {
      let options = [];
      try {
        const optionsAttr = this.getAttribute("options");
        if (optionsAttr) {
          options = JSON.parse(optionsAttr);
          if (!Array.isArray(options)) {
            throw new Error("Options must be an array");
          }
        }
      } catch (e) {
        this._reportError(`Invalid options format: ${e.message}`);
        options = [];
      }
      
      console.log(`Populating select options for ${this._field}:`, options);
      
      if (!this.hasAttribute("required")) {
        const emptyOption = document.createElement("option");
        emptyOption.value = "";
        emptyOption.textContent = "Select...";
        select.appendChild(emptyOption);
      }
      options.forEach((opt) => {
        const optionEl = document.createElement("option");
        optionEl.value = opt.value;
        optionEl.textContent = opt.label;
        select.appendChild(optionEl);
      });
    }
  
    _applyCommonAttributes() {
      const attributesToApply = [
        "placeholder",
        "required",
        "disabled",
        "readonly",
        "min",
        "max",
        "pattern",
        "minlength",
        "maxlength",
        "aria-label",
        "aria-required",
        "aria-invalid",
      ];
      attributesToApply.forEach((attr) => {
        if (this.hasAttribute(attr)) {
          this.inputElement.setAttribute(attr, this.getAttribute(attr));
        }
      });
      
      // Always enforce autocomplete off regardless of attribute settings
      // Chrome respects "new-password" for disabling autocomplete on text fields
      if (["text", "search", "email", "url", "tel", "number"].includes(this.getAttribute("type"))) {
        this.inputElement.setAttribute("autocomplete", "new-password");
      } else {
        this.inputElement.setAttribute("autocomplete", "off");
      }
      this.inputElement.setAttribute("autocorrect", "off");
      this.inputElement.setAttribute("autocapitalize", "off");
      this.inputElement.setAttribute("spellcheck", "false");
      
      if (["checkbox", "radio"].includes(this.getAttribute("type"))) {
        this.inputElement.setAttribute("role", this.getAttribute("type"));
      }
      if (this.hasAttribute("name")) {
        this.inputElement.name = this.getAttribute("name");
      }
    }
  
    _addInputEventListeners(inputType) {
      if (["checkbox", "radio", "select", "enum"].includes(inputType)) {
        this.inputElement.addEventListener("change", this._inputHandler);
      } else {
        this.inputElement.addEventListener("input", this._inputHandler);
      }
      this.inputElement.addEventListener("blur", this._onBlur);
    }
  
    //////////////////////////
    // EVENT HANDLING LOGIC //
    //////////////////////////
  
    _createInputHandlerWithDebounce() {
      let timeoutId;
      this._inputHandler = () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => this.onInput(), this._debounceDelay);
      };
  
      this._onBlur = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          this.onInput();
        }
        this._updateFormValidity();
        if (this._record && this._field) {
          const value = this._getValueFromPath(this._record, this._field);
          const inputType = this.getAttribute("type") || "text";
          if (this._valueChanged || ["checkbox", "radio", "select", "enum"].includes(inputType)) {
            this.dispatchEvent(
              new CustomEvent("data-changed", {
                bubbles: true,
                composed: true,
                detail: { field: this._field, value, record: this._record },
              })
            );
          }
          this._valueChanged = false;
        }
      };
    }
  
    /////////////////
    // VALUE LOGIC //
    /////////////////
  
    updateValue() {
      if (!this._record || !this._field || !this.inputElement) return;
      try {
        const inputType = this.getAttribute("type") || "text";
        const currentValue = this._getValueFromPath(this._record, this._field);
        

        
        if (["checkbox", "radio"].includes(inputType)) {
          const newChecked = !!currentValue;
          if (this.inputElement.checked !== newChecked) {
            this.inputElement.checked = newChecked;
          }
        } else if (["select", "enum"].includes(inputType)) {
          // For select and enum fields, handle null values gracefully
          const newValue = currentValue != null ? String(currentValue) : "";
          if (this.inputElement.value !== newValue) {
            this.inputElement.value = newValue;
          }
        } else if (inputType === "lookup") {
          // For lookup fields, we need to handle the display value and the actual value
          if (this._lookupInput) {
            // If we have stored lookup options, find the matching option
            if (this._lookupOptions && Array.isArray(this._lookupOptions) && this._lookupOptions.length > 0) {
              const matchingOption = this._lookupOptions.find(opt => 
                opt.id == currentValue || opt.value == currentValue
              );
              
              if (matchingOption) {
                console.log(`Found matching option for ${this._field}:`, matchingOption);
                this._lookupInput.value = matchingOption.name || matchingOption.label || matchingOption.toString();
                this._lookupInput.dataset.value = matchingOption.id !== undefined ? matchingOption.id : 
                                                (matchingOption.value !== undefined ? matchingOption.value : matchingOption);
              } else {
                console.log(`No matching option found for ${this._field} with value ${currentValue}`);
                // If no matching option found, just show the ID/value
                this._lookupInput.value = currentValue != null ? String(currentValue) : '';
                this._lookupInput.dataset.value = currentValue != null ? String(currentValue) : '';
              }
            } else {
              console.log(`No lookup options available for ${this._field}`);
              // If no options available yet, just show the ID/value
              this._lookupInput.value = currentValue != null ? String(currentValue) : '';
              this._lookupInput.dataset.value = currentValue != null ? String(currentValue) : '';
            }
            
            // Ensure dropdown is hidden when updating value
            if (this._lookupDropdown) {
              this._lookupDropdown.style.display = "none";
            }
          }
        } else {
          const newValue = currentValue != null ? String(currentValue) : "";
          if (this.inputElement.value !== newValue) {
            this.inputElement.value = newValue;
          }
        }
        this._updateFormValidity();
      } catch (error) {
        console.error(`Error updating value for field ${this._field}:`, error);
        this._reportError(`Failed to update ${this._field}: ${error.message}`);
      }
    }
  
    onInput() {
      if (!this._record || !this._field) {
        this._reportError("Record or field not defined for input event");
        return;
      }
      try {
        const inputType = this.getAttribute("type") || "text";
        let value;
        
        console.log(`onInput triggered for ${this._field}, type: ${inputType}`);
        
        if (["checkbox", "radio"].includes(inputType)) {
          value = this.inputElement.checked;
        } else if (["select", "enum"].includes(inputType)) {
          // For select and enum fields, empty string becomes null
          value = this.inputElement.value === "" ? null : this.inputElement.value;
          console.log(`Select/Enum value for ${this._field}: ${value}`);
        } else if (inputType === "lookup") {
          // For lookup fields, get the value from the dataset
          if (this._lookupInput && this._lookupInput.dataset.value) {
            const rawValue = this._lookupInput.dataset.value;
            // Convert to number if it looks like a number
            const numValue = Number(rawValue);
            value = !isNaN(numValue) ? numValue : rawValue;
          } else {
            value = null;
          }
          console.log(`Lookup value for ${this._field}: ${value}`);
        } else {
          value = this.inputElement.value;
          if (inputType === "number") {
            value = this.inputElement.value === "" ? null : Number(value);
            if (typeof value === "number" && isNaN(value)) {
              this._reportError(`Invalid number format for ${this._field}`);
              return;
            }
          } else if (inputType === "date") {
            value = this.inputElement.value === "" ? null : new Date(value);
            if (value instanceof Date && isNaN(value.getTime())) {
              this._reportError(`Invalid date format for ${this._field}`);
              return;
            }
          }
        }
        const currentValue = this._getValueFromPath(this._record, this._field);
        const hasChanged = this._hasValueChanged(currentValue, value);
        this._valueChanged = hasChanged;
        
        if (this._immutable) {
          this.dispatchEvent(
            new CustomEvent("value-change", {
              bubbles: true,
              composed: true,
              detail: { field: this._field, value, record: this._record },
            })
          );
        } else if (hasChanged) {
          console.log(`Value changed for field ${this._field}:`, value);
          this._setValueAtPath(this._record, this._field, value);
          if (!this.hasAttribute("name")) {
            this.setAttribute("name", this._field);
          }
          
          console.log(`Dispatching "input" event for ${this._field} (type: ${inputType})`);
          this.dispatchEvent(
            new CustomEvent("input", {
              bubbles: true,
              composed: true,
              detail: { field: this._field, value, record: this._record },
            })
          );
          
          // Dispatch data-changed for field types that should trigger immediate save 
          // like checkbox, radio, select, lookup, etc.
          if (["checkbox", "radio", "select", "enum", "lookup"].includes(inputType)) {
            console.log(`Dispatching "data-changed" event for ${this._field} (type: ${inputType}) - immediate save type`);
            this.dispatchEvent(
              new CustomEvent("data-changed", {
                bubbles: true,
                composed: true,
                detail: { field: this._field, value, record: this._record },
              })
            );
          } else {
            console.log(`NOT dispatching "data-changed" for text field ${this._field} (type: ${inputType}) - will save on blur`);
          }
        }
        this._updateFormValidity();
      } catch (error) {
        console.error(`Error processing input for field ${this._field}:`, error);
        this._reportError(`Failed to process input: ${error.message}`);
      }
    }
  
    _updateFormValidity() {
      if (!BindableInput.formAssociated) return;
      
      // For lookup inputs, check validity on the inner input element
      const inputType = this.getAttribute("type") || "text";
      
      let isValid = true;
      const errorMsg = this.shadowRoot.querySelector(".error-message");
      
      if (inputType === "lookup") {
        // For lookup fields, use our own validation logic
        if (this.hasAttribute("required") && (!this._lookupInput || !this._lookupInput.value)) {
          isValid = false;
          if (errorMsg) errorMsg.textContent = "This field is required";
          this.setAttribute("invalid", "");
          this._internals.setValidity({ valueMissing: true }, "This field is required");
        } else {
          isValid = true;
          this.removeAttribute("invalid");
          this._internals.setValidity({});
        }
        
        // Set form value from the lookup input
        if (this._lookupInput) {
          const value = this._lookupInput.dataset.value || "";
          this._internals.setFormValue(value !== "" ? value : null);
        }
      } else {
        // For regular inputs, use the native validity checking
        try {
          if (this.inputElement && typeof this.inputElement.checkValidity === 'function') {
            isValid = this.inputElement.checkValidity();
            if (!isValid && errorMsg) {
              errorMsg.textContent = this.inputElement.validationMessage;
              this.setAttribute("invalid", "");
              this._internals.setValidity({ customError: true }, this.inputElement.validationMessage);
            } else {
              this.removeAttribute("invalid");
              this._internals.setValidity({});
            }
            
            // Set form value
            if (this.inputElement) {
              const value = this.inputElement.value;
              this._internals.setFormValue(value !== "" ? value : null);
            }
          }
        } catch (error) {
          console.error(`Error checking validity for ${this._field}:`, error);
          // Fall back to default validity state
          this.removeAttribute("invalid");
          this._internals.setValidity({});
        }
      }
    }
  
    _hasValueChanged(currentValue, newValue) {
      if (currentValue == null && newValue == null) return false;
      if (currentValue === newValue) return false;
      if (currentValue instanceof Date && newValue instanceof Date) {
        return currentValue.getTime() !== newValue.getTime();
      }
      return true;
    }
  
    /////////////////
    // PATH HELPERS//
    /////////////////
  
    _getValueFromPath(obj, path) {
      if (!obj || !path) return null;
      return path.split(".").reduce((acc, part) => acc?.[part] ?? null, obj);
    }
  
    _setValueAtPath(obj, path, value) {
      if (!obj || !path) return false;
      const parts = path.split(".");
      let current = obj;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (current[part] === undefined) {
          current[part] = {};
        } else if (typeof current[part] !== "object") {
          this._reportError(`Cannot set property '${parts[i + 1]}' of non-object ${part}`);
          return false;
        }
        current = current[part];
      }
      current[parts[parts.length - 1]] = value;
      return true;
    }
  
    //////////////////////
    // GETTERS / SETTERS//
    //////////////////////
  
    set record(newRecord) {
      if (typeof newRecord !== "object" || newRecord === null) {
        this._reportError("record must be a non-null object");
        return;
      }
      this._record = newRecord;
      this.updateValue();
    }
  
    get record() {
      return this._record;
    }
  
    set field(fieldName) {
      if (typeof fieldName !== "string" || !fieldName.trim()) {
        this._reportError("field must be a non-empty string");
        return;
      }
      this._field = fieldName;
      this.setAttribute("field", fieldName);
      this.updateValue();
    }
  
    get field() {
      return this._field;
    }
  
    ///////////////
    // FORM API  //
    ///////////////
  
    get form() {
      return BindableInput.formAssociated ? this._internals.form : null;
    }
  
    get name() {
      return this.getAttribute("name");
    }
  
    set name(value) {
      this.setAttribute("name", value);
    }
  
    get validity() {
      return BindableInput.formAssociated ? this._internals.validity : { valid: true };
    }
  
    get validationMessage() {
      return BindableInput.formAssociated ? this._internals.validationMessage : "";
    }
  
    get willValidate() {
      return BindableInput.formAssociated ? this._internals.willValidate : false;
    }
  
    checkValidity() {
      return BindableInput.formAssociated ? this._internals.checkValidity() : true;
    }
  
    reportValidity() {
      return BindableInput.formAssociated ? this._internals.reportValidity() : true;
    }
  
    /**
     * Sets up association between the input and its label if one exists.
     * This ensures proper accessibility and label click behavior.
     * @private
     */
    _setupLabelAssociation() {
      // This method will be implemented in a future update
      // For now we'll leave it empty to prevent errors
      if (!this.inputElement) return;
      
      // Generate a unique ID for the input element if it doesn't have one
      if (!this.inputElement.id) {
        this.inputElement.id = `input_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      }
      
      // Look for a label in the parent element
      const parentNode = this.getRootNode() || document;
      const labels = parentNode.querySelectorAll(`label[for="${this.inputElement.id}"]`);
      
      // If no explicit label exists, look for a wrapping label
      if (labels.length === 0) {
        const closestLabel = this.closest('label');
        if (closestLabel) {
          closestLabel.setAttribute('for', this.inputElement.id);
        }
      }
    }
  
    /**
     * Reports an error to the console and creates a validation message
     * @param {string} message - The error message to report
     * @private
     */
    _reportError(message) {
      console.error(`[BindableInput] ${message}`);
      
      // Set validation message if the element is attached to a form
      if (this._internals) {
        this._internals.setValidity({ customError: true }, message);
      }
      
      // Dispatch an error event that can be caught by parent components
      const errorEvent = new CustomEvent('bindingerror', { 
        bubbles: true, 
        composed: true,
        detail: { message, field: this._field }
      });
      this.dispatchEvent(errorEvent);
    }
  
    // Method to set lookup options in the dropdown
    setLookupOptions(options) {
      if (!this._lookupDropdown) return;
      
      // Store options for later use
      this._lookupOptions = options;
      
      // Render the options
      this._renderLookupOptions(options);
    }
    
    /**
     * Creates an event handler function with proper 'this' binding
     * @param {Function} fn - The function to bind
     * @returns {Function} The bound function
     * @private
     */
    _bindMethod(fn) {
      return fn.bind(this);
    }
    
    /**
     * Helper method to render lookup options
     * @param {Array} options - The options to render
     * @private
     */
    _renderLookupOptions(options) {
      if (!this._lookupDropdown) return;
      
      // Clear existing options
      this._lookupDropdown.innerHTML = "";
      
      if (options && options.length > 0) {
        // Create a header showing number of options
        const header = document.createElement("div");
        header.className = "lookup-header";
        header.textContent = `${options.length} option${options.length !== 1 ? 's' : ''} found`;
        header.style.padding = "4px 6px";
        header.style.borderBottom = "1px solid #eee";
        header.style.fontSize = "9px";
        header.style.color = "#666";
        header.style.background = "#f9f9f9";
        this._lookupDropdown.appendChild(header);
        
        // Create option elements
        options.forEach(option => {
          const optionElem = document.createElement("div");
          optionElem.className = "lookup-option";
          optionElem.style.padding = "4px 6px";
          optionElem.style.cursor = "pointer";
          optionElem.style.fontSize = "var(--input-font-size, 10px)";
          
          // Highlight if this is the currently selected option
          const currentValue = this._getValueFromPath(this._record, this._field);
          if (option.id == currentValue || option.value == currentValue) {
            optionElem.classList.add("selected");
            optionElem.style.backgroundColor = "#f0f8ff";
            optionElem.style.fontWeight = "bold";
          }
          
          // Set option text and value
          optionElem.textContent = option.name || option.label || option.toString();
          optionElem.dataset.value = option.id !== undefined ? option.id : 
                                    (option.value !== undefined ? option.value : option);
          
          // Handle option selection
          optionElem.addEventListener("mousedown", () => {
            // Store reference to component instance
            const self = this;
            
            // Update input value and dataset
            self._lookupInput.value = optionElem.textContent;
            self._lookupInput.dataset.value = optionElem.dataset.value;
            
            // Hide dropdown
            self._lookupDropdown.style.display = "none";
            
            // Trigger change event to update record
            self._lookupInput.dispatchEvent(new Event("change"));
            
            // Set custom property to indicate this is a user selection
            self._valueChanged = true;
            
            // Also update the component immediately
            self.onInput();
          });
          
          // Add hover effect
          optionElem.addEventListener("mouseover", () => {
            optionElem.style.backgroundColor = optionElem.classList.contains("selected") ? "#e6f2ff" : "#f0f0f0";
          });
          
          optionElem.addEventListener("mouseout", () => {
            optionElem.style.backgroundColor = optionElem.classList.contains("selected") ? "#f0f8ff" : "";
          });
          
          this._lookupDropdown.appendChild(optionElem);
        });
      } else {
        // Show "No results" message
        const noResults = document.createElement("div");
        noResults.className = "lookup-no-results";
        noResults.textContent = "No matching options found";
        noResults.style.padding = "4px 6px";
        noResults.style.color = "#666";
        noResults.style.fontStyle = "italic";
        noResults.style.fontSize = "var(--input-font-size, 10px)";
        this._lookupDropdown.appendChild(noResults);
      }
    }
  }
  
  customElements.define("bindable-input", BindableInput);
  