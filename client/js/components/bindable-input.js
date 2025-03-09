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
      
      
      if (inputType === "textarea") {
        return document.createElement("textarea");
      }
      if (inputType === "select" || inputType === "enum") {
        const select = document.createElement("select");
        this._populateSelectOptions(select);
        return select;
      }
      const input = document.createElement("input");
      input.type = inputType;
      return input;
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
          this.dispatchEvent(
            new CustomEvent("input", {
              bubbles: true,
              composed: true,
              detail: { field: this._field, value, record: this._record },
            })
          );
          if (["checkbox", "radio", "select", "enum"].includes(inputType)) {
            this.dispatchEvent(
              new CustomEvent("data-changed", {
                bubbles: true,
                composed: true,
                detail: { field: this._field, value, record: this._record },
              })
            );
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
      const isValid = this.inputElement.checkValidity();
      const errorMsg = this.shadowRoot.querySelector(".error-message");
      if (!isValid) {
        this.setAttribute("invalid", "");
        errorMsg.textContent = this.inputElement.validationMessage;
        this._internals.setValidity({ customError: true }, this.inputElement.validationMessage);
      } else {
        this.removeAttribute("invalid");
        this._internals.setValidity({});
      }
      this._internals.setFormValue(this.inputElement.value !== "" ? this.inputElement.value : null);
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
  }
  
  customElements.define("bindable-input", BindableInput);
  