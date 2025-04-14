import { BindableInputCore } from "./form-inputs/bindable-input-core.js";

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
      "datasource",
      "displayfield",
      "valuefield",
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
    this._requestHandler = null;
    this._inputComponentFactory = null; // Will hold our input component factory

    // Form internals for form association
    if (BindableInput.formAssociated) {
      this._internals = this.attachInternals();
    }

    // Initialize input-related handlers and UI
    this._createInputHandlerWithDebounce();
    this._createStyles();
    this._createInput();
  }

  /**
   * Sets the function used to make server requests (e.g., for lookups).
   * @param {Function} handler - An async function that takes a message object and returns a Promise<response>.
   */
  setRequestHandler(handler) {
    if (typeof handler === "function") {
      this._requestHandler = handler;

      // Pass the request handler to the form (the parent component)
      if (this._inputComponentFactory && this._inputComponentFactory.form) {
        this._inputComponentFactory.form.sendRequest = handler;
      }
    } else {
      console.error('[BindableInput] Invalid request handler provided.');
    }
  }

  /////////////////
  // LIFECYCLE   //
  /////////////////

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    // Update the component's field configuration based on attribute changes
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
        if (["select", "enum", "lookup"].includes(this.getAttribute("type"))) {
          if (this._inputComponentFactory) {
            try {
              const parsedOptions = JSON.parse(newValue || "[]");
              this._inputComponentFactory.updateOptions(parsedOptions);
            } catch (err) {
              console.error(`[BindableInput] Error parsing options:`, err);
            }
          }
          this.updateValue();
        }
        break;
      case "immutable":
        this._immutable = this.hasAttribute("immutable");
        break;
      case "datasource":
      case "displayfield":
      case "valuefield":
        // Update lookup fields when their configuration changes
        if (this.getAttribute("type") === "lookup" && this._inputComponentFactory) {
          // The component might need to be recreated with new datasource
          this._createInput();
          this.updateValue();
        }
        break;
      case "disabled":
      case "readonly":
      case "required":
        // Pass these attributes to the input component
        if (this._inputComponentFactory) {
          if (name === "disabled") {
            this._inputComponentFactory.setDisabled(newValue !== null);
          } else if (name === "readonly") {
            this._inputComponentFactory.setReadOnly(newValue !== null);
          }
          this._updateFormValidity();
        }
        break;
      default:
        // For other attributes, they are applied when the input is created
        // If we already have an input component, we may need to recreate it
        if (this._inputComponentFactory) {
          // Only recreate for certain critical attribute changes
          if (["min", "max", "pattern", "minlength", "maxlength"].includes(name)) {
            this._createInput();
            this.updateValue();
          }
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
  }

  disconnectedCallback() {
    // Clean up any event listeners or references
    this._cleanup();
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
        
        /* Style for the input container */
        .input-container {
          width: 100%;
          position: relative;
        }
        
        /* Styles that will be applied to any wrapped inputs */
        ::slotted(input), 
        ::slotted(select), 
        ::slotted(textarea),
        .input-container :not(slot) input,
        .input-container :not(slot) select,
        .input-container :not(slot) textarea {
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
        
        /* Focus styles */
        ::slotted(input:focus), 
        ::slotted(select:focus), 
        ::slotted(textarea:focus),
        .input-container :not(slot) input:focus,
        .input-container :not(slot) select:focus,
        .input-container :not(slot) textarea:focus {
          border: var(--input-focus-border);
          outline: var(--input-focus-outline);
        }
        
        /* Disabled styles */
        ::slotted(input:disabled), 
        ::slotted(select:disabled), 
        ::slotted(textarea:disabled),
        .input-container :not(slot) input:disabled,
        .input-container :not(slot) select:disabled,
        .input-container :not(slot) textarea:disabled {
          background: var(--input-disabled-background);
          color: var(--input-disabled-color);
          cursor: not-allowed;
        }
        
        /* Placeholder styles */
        ::slotted(input::placeholder), 
        ::slotted(textarea::placeholder),
        .input-container :not(slot) input::placeholder,
        .input-container :not(slot) textarea::placeholder {
          color: var(--input-placeholder-color);
        }
        
        /* Error message styles */
        .error-message {
          color: #cc0000;
          font-size: 0.85em;
          margin-top: 2px;
          display: none;
        }
        
        :host([invalid]) .error-message {
          display: block;
        }
        
        :host([invalid]) .input-container :not(slot) input,
        :host([invalid]) .input-container :not(slot) select,
        :host([invalid]) .input-container :not(slot) textarea {
          border: var(--input-error-border);
          background: var(--input-error-background);
        }
      `;
    this.shadowRoot.appendChild(style);
  }

  _createInput() {
    // Clean up existing input elements
    this._cleanup();

    // Create a container for the input
    const container = document.createElement("div");
    container.className = "input-container";

    // Get field configuration from attributes
    const fieldConfig = this._buildFieldConfig();

    // Create the form object that will be passed to input components
    const form = {
      handleFieldChange: (field, value, shouldSave) => {
        // Only mark dirty if the value changed
        if (this._hasValueChanged(this._record[field], value)) {
          this._valueChanged = true;

          // Update the record value
          if (!this._immutable) {
            this._record[field] = value;
          }

          // Dispatch events
          this.dispatchEvent(
            new CustomEvent("input", {
              bubbles: true,
              composed: true,
              detail: { field, value, record: this._record },
            })
          );

          // Dispatch data-changed event to trigger immediate save if needed
          if (shouldSave) {
            this.dispatchEvent(
              new CustomEvent("data-changed", {
                bubbles: true,
                composed: true,
                detail: { field, value, record: this._record },
              })
            );
          }
        }
      },
      sendRequest: this._requestHandler
    };

    // Create input component through factory
    this._inputComponentFactory = new BindableInputCore(form, fieldConfig);
    const inputElement = this._inputComponentFactory.getElement();
    container.appendChild(inputElement);

    // Append error message container
    const errorMessage = document.createElement("div");
    errorMessage.className = "error-message";
    errorMessage.setAttribute("aria-live", "polite");
    container.appendChild(errorMessage);

    // Clear previous content and append the new container
    this.shadowRoot.querySelectorAll('.input-container, .error-message').forEach(el => el.remove());
    this.shadowRoot.appendChild(container);

    // Set up event listeners on the new input component
    this._setupEventListeners();

    // Update validity state
    this._updateFormValidity();
  }

  /**
   * Build a field configuration object from component attributes
   */
  _buildFieldConfig() {
    const inputType = this.getAttribute("type") || "text";
    const fieldName = this.getAttribute("field") || "";

    // Start with basic configuration
    const config = {
      name: fieldName,
      type: inputType,
      fieldType: inputType,  // This helps with input type mapping
      caption: this.getAttribute("aria-label") || fieldName
    };

    // Add validation attributes if present
    if (this.hasAttribute("required")) config.required = true;
    if (this.hasAttribute("min")) config.min = this.getAttribute("min");
    if (this.hasAttribute("max")) config.max = this.getAttribute("max");
    if (this.hasAttribute("pattern")) config.pattern = this.getAttribute("pattern");
    if (this.hasAttribute("minlength")) config.minLength = this.getAttribute("minlength");
    if (this.hasAttribute("maxlength")) config.maxLength = this.getAttribute("maxlength");
    if (this.hasAttribute("placeholder")) config.placeholder = this.getAttribute("placeholder");

    // For select, enum, and lookup inputs, handle options
    if (["select", "enum"].includes(inputType)) {
      try {
        const optionsAttr = this.getAttribute("options");
        if (optionsAttr) {
          config.options = JSON.parse(optionsAttr);
        } else {
          config.options = [];
        }
      } catch (e) {
        console.error(`[BindableInput] Invalid options format: ${e.message}`);
        config.options = [];
      }
    }

    // For lookup fields, add data source information
    if (inputType === "lookup" || inputType === "relation") {
      config.dataSource = this.getAttribute("datasource");
      config.displayField = this.getAttribute("displayfield") || "name";
      config.valueField = this.getAttribute("valuefield") || "id";
    }

    return config;
  }

  _setupEventListeners() {
    if (!this._inputComponentFactory) return;

    // Set up event listeners on input element
    this._inputComponentFactory.setupEventListeners((field, value, shouldSave) => {
      // Only update if field name matches
      if (field === this._field) {
        // Track if value has changed
        this._valueChanged = this._hasValueChanged(this._record[field], value);

        // Update record if not immutable
        if (!this._immutable && this._valueChanged) {
          this._record[field] = value;

          // Dispatch input event
          this.dispatchEvent(
            new CustomEvent("input", {
              bubbles: true,
              composed: true,
              detail: { field, value, record: this._record },
            })
          );

          // Dispatch data-changed event to trigger save if needed
          if (shouldSave) {
            this.dispatchEvent(
              new CustomEvent("data-changed", {
                bubbles: true,
                composed: true,
                detail: { field, value, record: this._record },
              })
            );
          }
        }

        // Update form validity
        this._updateFormValidity();
      }
    });
  }

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

      // Trigger data-changed event on blur if value has been changed
      if (this._record && this._field && this._valueChanged) {
        const value = this._record[this._field];
        this.dispatchEvent(
          new CustomEvent("data-changed", {
            bubbles: true,
            composed: true,
            detail: { field: this._field, value, record: this._record },
          })
        );
        this._valueChanged = false;
      }
    };
  }

  onInput() {
    // This method is kept for backward compatibility
    // Most functionality is now handled by the input components
  }

  /////////////////
  // VALUE LOGIC //
  /////////////////

  updateValue() {
    if (!this._record || !this._field || !this._inputComponentFactory) return;

    // Use the input component to update the value
    this._inputComponentFactory.updateValue(this._record);

    // Update form validity
    this._updateFormValidity();
  }

  _updateFormValidity() {
    if (!BindableInput.formAssociated || !this._inputComponentFactory) return;

    // Check validity through the input component
    const isValid = this._inputComponentFactory.isValid();
    const errorMsg = this.shadowRoot.querySelector(".error-message");

    if (!isValid) {
      // Get validation message from component
      const validationMessage = this._inputComponentFactory.getValidationMessage();
      if (errorMsg) errorMsg.textContent = validationMessage;

      // Set invalid attribute
      this.setAttribute("invalid", "");
      this._internals.setValidity({ customError: true }, validationMessage);
    } else {
      // Clear invalid state
      this.removeAttribute("invalid");
      this._internals.setValidity({});
    }

    // Set form value
    const value = this._inputComponentFactory.getValue();
    this._internals.setFormValue(value === null || value === undefined ? null : String(value));
  }

  _hasValueChanged(currentValue, newValue) {
    // Handle null/undefined cases
    if (currentValue == null && newValue == null) return false;
    if (currentValue == null || newValue == null) return true;

    // Handle dates
    if (currentValue instanceof Date && newValue instanceof Date) {
      return currentValue.getTime() !== newValue.getTime();
    }

    // Handle file objects
    if (typeof currentValue === 'object' && typeof newValue === 'object' &&
      currentValue !== null && newValue !== null) {
      // If both are file objects with 'filename' or 'name' property
      if (('filename' in currentValue || 'name' in currentValue) &&
        ('filename' in newValue || 'name' in newValue)) {
        // Compare filenames
        const currentName = currentValue.filename || currentValue.name || '';
        const newName = newValue.filename || newValue.name || '';
        return currentName !== newName;
      }
    }

    // Default comparison
    return currentValue !== newValue;
  }

  _cleanup() {
    // Clean up event listeners and references
    if (this._inputComponentFactory) {
      // No specific cleanup needed for input components
      // They handle their own event listeners
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
}

customElements.define("bindable-input", BindableInput);
