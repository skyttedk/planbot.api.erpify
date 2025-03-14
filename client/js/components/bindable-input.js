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
      } else if (inputType === "file") {
        // Create a container for the file input
        const container = document.createElement("div");
        container.className = "file-upload-container";
        container.style.width = "100%";
        
        // Create a wrapper for styling
        const wrapper = document.createElement("div");
        wrapper.className = "file-upload-wrapper";
        wrapper.style.display = "flex";
        wrapper.style.flexDirection = "column";
        wrapper.style.width = "100%";
        wrapper.style.border = "1px dashed #ccc";
        wrapper.style.borderRadius = "4px";
        wrapper.style.padding = "10px";
        
        // Create the actual file input element
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.className = "file-input";
        fileInput.style.display = "none"; // Hide the native input
        
        // Create preview area
        const previewArea = document.createElement("div");
        previewArea.className = "file-preview";
        previewArea.style.minHeight = "60px";
        previewArea.style.display = "flex";
        previewArea.style.alignItems = "center";
        previewArea.style.justifyContent = "center";
        previewArea.style.padding = "10px";
        previewArea.style.backgroundColor = "#f9f9f9";
        previewArea.style.borderRadius = "2px";
        previewArea.style.marginBottom = "10px";
        
        // Display placeholder initially
        const placeholderText = document.createElement("span");
        placeholderText.textContent = "No file selected";
        placeholderText.style.color = "#999";
        previewArea.appendChild(placeholderText);
        
        // Create custom button for selecting files
        const selectButton = document.createElement("button");
        selectButton.type = "button";
        selectButton.className = "file-select-button";
        selectButton.textContent = "Select File";
        selectButton.style.backgroundColor = "#f0f0f0";
        selectButton.style.border = "1px solid #ddd";
        selectButton.style.borderRadius = "4px";
        selectButton.style.padding = "6px 12px";
        selectButton.style.cursor = "pointer";
        selectButton.style.fontSize = "12px";
        selectButton.style.alignSelf = "flex-start";
        
        // Event handling
        selectButton.addEventListener("click", () => {
          fileInput.click(); // Trigger native file dialog
        });
        
        fileInput.addEventListener("change", (e) => {
          const file = e.target.files?.[0];
          if (file) {
            this._handleFileSelected(file, previewArea, placeholderText);
          } else {
            // Reset preview if file selection canceled
            this._resetFilePreview(previewArea, placeholderText);
          }
        });
        
        // Add drag and drop support
        this._setupDragAndDrop(wrapper, previewArea, placeholderText, fileInput);
        
        // Assemble elements
        wrapper.appendChild(previewArea);
        wrapper.appendChild(selectButton);
        container.appendChild(fileInput);
        container.appendChild(wrapper);
        
        // Store references for later
        this._fileInput = fileInput;
        this._filePreviewArea = previewArea;
        
        // Return the container instead of the input element
        return container;
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
      
      const currentValue = this._record[this._field];
      const inputType = this.getAttribute('type') || 'text';
      
      // Handle different input types
      if (inputType === "checkbox") {
        this.inputElement.checked = !!currentValue;
      } else if (inputType === "radio") {
        this.inputElement.checked = currentValue === this.inputElement.value;
      } else if (inputType === "select" || inputType === "enum") {
        // For select elements, we need to find the option with the matching value
        const options = this.inputElement.options;
        let valueFound = false;
        
        for (let i = 0; i < options.length; i++) {
          if (options[i].value === String(currentValue)) {
            this.inputElement.selectedIndex = i;
            valueFound = true;
            break;
          }
        }
        
        // If no matching option was found, select the first option
        if (!valueFound && options.length > 0) {
          this.inputElement.selectedIndex = 0;
        }
      } else if (inputType === "file") {
        // For file fields, we need to update the file preview with stored file information
        if (currentValue) {
          console.log(`Displaying file for ${this._field}:`, currentValue);
          
          // Normalize file metadata to ensure all expected fields are present
          const fileMetadata = {
            // Basic defaults
            name: 'Unknown file',
            size: 0,
            type: 'application/octet-stream',
            
            // Override with any values from currentValue that exist
            ...(typeof currentValue === 'object' ? currentValue : {})
          };
          
          // If we only have a path string, extract filename from it
          if (typeof currentValue === 'string') {
            fileMetadata.path = currentValue;
            // Extract filename from path
            const pathParts = currentValue.split(/[/\\]/); // Split on both forward and backslashes
            fileMetadata.name = pathParts[pathParts.length - 1] || 'Unknown file';
            fileMetadata.filename = fileMetadata.name;
            fileMetadata.sourceFilePath = fileMetadata.name;
          }
          
          console.log('File metadata before normalization:', JSON.stringify(fileMetadata, null, 2));
          
          // Use sourceFilePath as name if available and name isn't set
          if (!fileMetadata.name || fileMetadata.name === 'Unknown file') {
            if (fileMetadata.sourceFilePath) {
              fileMetadata.name = fileMetadata.sourceFilePath;
            } else if (fileMetadata.filename) {
              fileMetadata.name = fileMetadata.filename;
            }
          }
          
          // Priority for determining type: type > mimeType > extension lookup
          if (!fileMetadata.type && fileMetadata.mimeType) {
            fileMetadata.type = fileMetadata.mimeType;
          }
          
          // If we don't have a URL but have a path, create a URL
          if (!fileMetadata.url && fileMetadata.path) {
            const filename = this._extractFilenameFromPath(fileMetadata.path);
            fileMetadata.url = `/uploads/${filename}`;
            console.log(`Generated URL from path: ${fileMetadata.url}`);
          }
          
          // For FileBlobField, ensure data field is preserved
          if (fileMetadata.data) {
            console.log(`File has base64 data (length: ${fileMetadata.data.length})`);
          }
          
          console.log(`Normalized file metadata for ${this._field}:`, {
            name: fileMetadata.name,
            filename: fileMetadata.filename,
            sourceFilePath: fileMetadata.sourceFilePath,
            size: fileMetadata.size,
            type: fileMetadata.type,
            hasData: !!fileMetadata.data,
            hasUrl: !!fileMetadata.url,
            path: fileMetadata.path,
            url: fileMetadata.url
          });
          
          // Create mock file for display
          const mockFile = {
            name: fileMetadata.name,
            type: fileMetadata.type || fileMetadata.mimeType || this._getMimeTypeFromFilename(fileMetadata.name),
            size: fileMetadata.size || 0
          };
          
          console.log('Created mockFile for display:', mockFile);
          
          // If preview elements exist, update them
          if (this._filePreviewArea) {
            const placeholderText = this._filePreviewArea.querySelector('span') || document.createElement('span');
            this._resetFilePreview(this._filePreviewArea, placeholderText);
            this._displayStoredFile(mockFile, fileMetadata, this._filePreviewArea, placeholderText);
          }
        } else {
          // If no file data, ensure preview area is reset
          if (this._filePreviewArea) {
            const placeholderText = this._filePreviewArea.querySelector('span') || document.createElement('span');
            placeholderText.textContent = "No file selected";
            placeholderText.style.color = "#999";
            this._resetFilePreview(this._filePreviewArea, placeholderText);
          }
        }
      } else {
        const newValue = currentValue != null ? String(currentValue) : "";
        if (this.inputElement.value !== newValue) {
          this.inputElement.value = newValue;
        }
      }
      this._updateFormValidity();
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
        } else if (inputType === "file") {
          // For file uploads, prepare file information
          if (this._selectedFile) {
            // Create an object with file metadata
            value = {
              sourceFilePath: this._selectedFile.name, // This serves as a flag for the server
              tempFile: this._selectedFile,            // Actual file object for uploads
              filename: this._selectedFile.name,
              mimeType: this._selectedFile.type,
              size: this._selectedFile.size,
              lastModified: this._selectedFile.lastModified
            };
            
            console.log(`File value for ${this._field}:`, {
              filename: value.filename,
              mimeType: value.mimeType,
              size: value.size
            });
          } else {
            // When clearing a file field, just use null
            // The server has been updated to handle this properly
            value = null;
            console.log(`Clearing file field ${this._field}`);
          }
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
  
    /**
     * Handles a file being selected via the file input
     * @param {File} file - The selected file object
     * @param {HTMLElement} previewArea - The element for file preview
     * @param {HTMLElement} placeholderText - The placeholder text element to hide/show
     * @private
     */
    _handleFileSelected(file, previewArea, placeholderText) {
      console.log('File selected:', {
        name: file.name,
        type: file.type,
        size: file.size
      });
      
      // Clear previous preview
      previewArea.innerHTML = '';
      
      // Create file info display
      const fileInfo = document.createElement('div');
      fileInfo.className = 'file-info';
      fileInfo.style.display = 'flex';
      fileInfo.style.alignItems = 'center';
      fileInfo.style.width = '100%';
      
      // Determine file type and show appropriate preview
      const fileType = file.type;
      const isImage = fileType.startsWith('image/');
      
      // File icon based on type
      const fileIcon = document.createElement('div');
      fileIcon.className = 'file-icon';
      fileIcon.style.marginRight = '10px';
      fileIcon.style.fontSize = '24px';
      
      // Choose icon based on file type
      if (isImage) fileIcon.innerHTML = '🖼️';
      else if (fileType === 'application/pdf') fileIcon.innerHTML = '📄';
      else if (fileType.includes('word') || fileType === 'application/msword') fileIcon.innerHTML = '📝';
      else if (fileType.includes('excel') || fileType === 'application/vnd.ms-excel') fileIcon.innerHTML = '📊';
      else if (fileType.includes('zip') || fileType.includes('compressed')) fileIcon.innerHTML = '🗜️';
      else fileIcon.innerHTML = '📁';
      
      // For non-image files, add the icon immediately
      if (!isImage) {
        fileInfo.appendChild(fileIcon);
      }
      
      // If it's an image, create a thumbnail preview
      if (isImage) {
        // Initially show the icon as a placeholder while image loads
        fileInfo.appendChild(fileIcon);
        
        // Create image preview element
        const imgPreview = document.createElement('img');
        imgPreview.style.maxHeight = '50px';
        imgPreview.style.maxWidth = '50px';
        imgPreview.style.objectFit = 'contain';
        imgPreview.style.marginRight = '10px';
        imgPreview.style.border = '1px solid #eee';
        imgPreview.style.borderRadius = '3px';
        imgPreview.style.padding = '2px';
        
        // Read file as data URL
        const reader = new FileReader();
        reader.onload = (e) => {
          // When the image data is ready
          imgPreview.src = e.target.result;
          
          // Once the image is actually loaded, replace the placeholder
          imgPreview.onload = () => {
            // Remove the placeholder icon
            const existingIcon = fileInfo.querySelector('.file-icon');
            if (existingIcon) {
              existingIcon.remove();
            }
            // Add the image at the start
            fileInfo.insertBefore(imgPreview, fileInfo.firstChild);
          };
          
          // Handle errors
          imgPreview.onerror = () => {
            console.warn('Failed to load preview for selected image');
            // Icon placeholder is already there, so no need to add it again
          };
        };
        
        // Start loading the image data
        reader.readAsDataURL(file);
      }
      
      // File name and size
      const fileDetails = document.createElement('div');
      fileDetails.className = 'file-details';
      fileDetails.style.overflow = 'hidden';
      fileDetails.style.textOverflow = 'ellipsis';
      fileDetails.style.flexGrow = '1';
      
      // The File object already has a name property
      const displayName = file.name || 'Unknown file';
                         
      const fileName = document.createElement('div');
      fileName.className = 'file-name';
      fileName.textContent = displayName;
      fileName.style.fontWeight = 'bold';
      fileName.style.fontSize = '12px';
      
      const fileSize = document.createElement('div');
      fileSize.className = 'file-size';
      fileSize.textContent = this._formatFileSize(file.size || 0);
      fileSize.style.fontSize = '10px';
      fileSize.style.color = '#777';
      
      fileDetails.appendChild(fileName);
      fileDetails.appendChild(fileSize);
      fileInfo.appendChild(fileDetails);
      
      // Remove button
      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'file-remove-button';
      removeButton.innerHTML = '×';
      removeButton.style.border = 'none';
      removeButton.style.background = 'none';
      removeButton.style.fontSize = '16px';
      removeButton.style.cursor = 'pointer';
      removeButton.style.color = '#999';
      removeButton.style.marginLeft = '5px';
      removeButton.title = 'Remove file';
      
      removeButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this._resetFilePreview(previewArea, placeholderText);
        
        // Reset the file input
        if (this._fileInput) {
          this._fileInput.value = '';
        }
        
        // Set value to null to clear the field
        this._selectedFile = null;
        
        // Update the record with a simpler format for field clearing
        // Just use null - the server has been updated to handle this properly
        this._setValueAtPath(this._record, this._field, null);
        
        console.log(`Clearing file field ${this._field}`);
        
        // Trigger data-changed event to save the change immediately
        this.dispatchEvent(
          new CustomEvent("data-changed", {
            bubbles: true,
            composed: true,
            detail: { 
              field: this._field, 
              value: null, 
              record: this._record 
            },
          })
        );
      });
      
      fileInfo.appendChild(removeButton);
      previewArea.appendChild(fileInfo);
      
      // Store the file in the component's state
      this._selectedFile = file;
      
      // Trigger input event to update the record
      this.onInput();
    }
    
    /**
     * Resets the file preview area to its initial state
     * @param {HTMLElement} previewArea - The element for file preview
     * @param {HTMLElement} placeholderText - The placeholder text element to show
     * @private
     */
    _resetFilePreview(previewArea, placeholderText) {
      previewArea.innerHTML = '';
      previewArea.appendChild(placeholderText);
      this._selectedFile = null;
    }
    
    /**
     * Sets up drag and drop functionality for file uploads
     * @param {HTMLElement} dropZone - The element to enable as a drop zone
     * @param {HTMLElement} previewArea - The element for file preview
     * @param {HTMLElement} placeholderText - The placeholder text element
     * @param {HTMLInputElement} fileInput - The hidden file input element
     * @private
     */
    _setupDragAndDrop(dropZone, previewArea, placeholderText, fileInput) {
      const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.style.borderColor = '#3F7FE4';
        e.target.style.backgroundColor = '#F0F7FF';
      };
      
      const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.style.borderColor = '#ccc';
        e.target.style.backgroundColor = '';
      };
      
      const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        dropZone.style.borderColor = '#ccc';
        dropZone.style.backgroundColor = '';
        
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length) {
          fileInput.files = files;
          this._handleFileSelected(files[0], previewArea, placeholderText);
        }
      };
      
      dropZone.addEventListener('dragover', handleDragOver);
      dropZone.addEventListener('dragleave', handleDragLeave);
      dropZone.addEventListener('drop', handleDrop);
    }
    
    /**
     * Formats file size in bytes to a human-readable format
     * @param {number} bytes - File size in bytes
     * @returns {string} Formatted file size
     * @private
     */
    _formatFileSize(bytes) {
      if (bytes === 0) return '0 Bytes';
      
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    /**
     * Displays a stored file in the file preview area
     * 
     * @param {Object} mockFile - Basic file information (name, type, size)
     * @param {Object} storedFile - Full file metadata from the server
     * @param {HTMLElement} previewArea - The preview area element
     * @param {HTMLElement} placeholderText - The placeholder text element
     * @private
     */
    _displayStoredFile(mockFile, storedFile, previewArea, placeholderText) {
      console.log('Displaying stored file:', { 
        name: mockFile.name,
        type: mockFile.type,
        size: mockFile.size,
        hasData: !!storedFile.data,
        hasUrl: !!storedFile.url,
        url: storedFile.url
      });
      
      // Clear previous preview
      previewArea.innerHTML = '';
      
      // Create file info display
      const fileInfo$ = document.createElement('div');
      fileInfo$.className = 'file-info';
      fileInfo$.style.display = 'flex';
      fileInfo$.style.alignItems = 'center';
      fileInfo$.style.width = '100%';
      
      // Determine file type 
      const fileType = mockFile.type || 'application/octet-stream';
      const isImage = fileType.startsWith('image/');
      
      // Add visual file indicator as placeholder initially
      const fileIcon = document.createElement('div');
      fileIcon.className = 'file-icon';
      fileIcon.style.marginRight = '10px';
      fileIcon.style.fontSize = '24px';
      
      // Set appropriate icon based on file type
      if (isImage) fileIcon.innerHTML = '🖼️';
      else if (fileType === 'application/pdf') fileIcon.innerHTML = '📄';
      else if (fileType.includes('word') || fileType === 'application/msword') fileIcon.innerHTML = '📝';
      else if (fileType.includes('excel') || fileType === 'application/vnd.ms-excel') fileIcon.innerHTML = '📊';
      else if (fileType.includes('zip') || fileType.includes('compressed')) fileIcon.innerHTML = '🗜️';
      else fileIcon.innerHTML = '📁';
      
      // For non-image files, add the icon immediately
      if (!isImage) {
        fileInfo$.appendChild(fileIcon);
      }
      
      // Try to create an image preview for image files
      if (isImage) {
        console.log('File is an image, attempting to create thumbnail');
        
        // Create image preview element
        const imgPreview = document.createElement('img');
        imgPreview.style.maxHeight = '50px';
        imgPreview.style.maxWidth = '50px';
        imgPreview.style.objectFit = 'contain';
        imgPreview.style.marginRight = '10px';
        imgPreview.style.border = '1px solid #eee';
        imgPreview.style.borderRadius = '3px';
        imgPreview.style.padding = '2px';
        
        // Fallback in case image doesn't load
        imgPreview.style.minWidth = '40px';
        imgPreview.style.minHeight = '40px';
        
        let previewSource = null;
        
        // Find the best source for the image preview (in order of preference):
        
        // 1. If we have a URL from the server, use that
        if (storedFile.url) {
          // Make sure the URL is absolute if it starts with /
          if (storedFile.url.startsWith('/')) {
            previewSource = window.location.origin + storedFile.url;
          } else {
            previewSource = storedFile.url;
          }
          console.log('Using URL for image preview (absolute):', previewSource);
        }
        
        // 2. If we have base64 data, use that
        else if (storedFile.data) {
          try {
            previewSource = `data:${fileType};base64,${storedFile.data}`;
            console.log('Using base64 data for image preview');
          } catch (err) {
            console.warn('Could not create data URL from base64:', err);
          }
        }
        
        // 3. As a last resort, if we have a path and it's accessible, try to use it
        else if (storedFile.path) {
          // Extract just the filename from the path, which may include UUID prefix
          const filename = this._extractFilenameFromPath(storedFile.path);
          // Use path with origin to ensure absolute URL
          previewSource = window.location.origin + '/uploads/' + filename;
          console.log('Attempting to use path for image preview:', previewSource);
        }
        
        // If we found any preview source, try to use it
        if (previewSource) {
          // Start with a loading placeholder
          fileInfo$.appendChild(fileIcon);
          
          // Set up onload handler before setting src to ensure it captures the load event
          imgPreview.onload = () => {
            console.log('Image loaded successfully:', previewSource);
            
            // Remove the placeholder icon once the image loads
            const existingIcon = fileInfo$.querySelector('.file-icon');
            if (existingIcon) {
              existingIcon.remove();
            }
            
            // Add the loaded image
            fileInfo$.insertBefore(imgPreview, fileInfo$.firstChild);
          };
          
          // Add error handler in case image doesn't load
          imgPreview.onerror = (err) => {
            console.warn('Image failed to load:', previewSource, err);
            // Try a direct URL to the file as a last resort
            if (storedFile.path && !previewSource.includes('data:')) {
              const filename = this._extractFilenameFromPath(storedFile.path);
              const fallbackUrl = window.location.origin + '/uploads/' + filename;
              if (fallbackUrl !== previewSource) {
                console.log('Trying fallback URL:', fallbackUrl);
                imgPreview.src = fallbackUrl;
                return; // Don't proceed with the error handling yet
              }
            }
            // The file icon is already in place, so we don't need to do anything else
          };
          
          // Now set the src to trigger loading
          imgPreview.src = previewSource;
        } else {
          // No preview source available, just use the icon
          console.log('No preview source available for image, using icon');
          fileInfo$.appendChild(fileIcon);
        }
      }
      
      // File name and size
      const fileDetails = document.createElement('div');
      fileDetails.className = 'file-details';
      fileDetails.style.overflow = 'hidden';
      fileDetails.style.textOverflow = 'ellipsis';
      fileDetails.style.flexGrow = '1';
      
      // Determine the best filename to display (with priorities)
      const displayName = mockFile.name || 
                         storedFile.name || 
                         storedFile.filename || 
                         storedFile.sourceFilePath ||
                         (storedFile.path ? this._extractFilenameFromPath(storedFile.path) : '') ||
                         'Unknown file';
      
      console.log('Display name determined to be:', displayName);
                         
      const fileName = document.createElement('div');
      fileName.className = 'file-name';
      fileName.textContent = displayName;
      fileName.style.fontWeight = 'bold';
      fileName.style.fontSize = '12px';
      
      const fileSize = document.createElement('div');
      fileSize.className = 'file-size';
      fileSize.textContent = this._formatFileSize(mockFile.size || storedFile.size || 0);
      fileSize.style.fontSize = '10px';
      fileSize.style.color = '#777';
      
      fileDetails.appendChild(fileName);
      fileDetails.appendChild(fileSize);
      fileInfo$.appendChild(fileDetails);
      
      // Remove button (allows clearing the field)
      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'file-remove-button';
      removeButton.innerHTML = '×';
      removeButton.style.border = 'none';
      removeButton.style.background = 'none';
      removeButton.style.fontSize = '16px';
      removeButton.style.cursor = 'pointer';
      removeButton.style.color = '#999';
      removeButton.style.marginLeft = '5px';
      removeButton.title = 'Remove file';
      
      removeButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this._resetFilePreview(previewArea, placeholderText);
        
        // Reset the file input
        if (this._fileInput) {
          this._fileInput.value = '';
        }
        
        // Set value to null to clear the field
        this._selectedFile = null;
        
        // Update the record with a simpler format for field clearing
        // Just use null - the server has been updated to handle this properly
        this._setValueAtPath(this._record, this._field, null);
        
        console.log(`Clearing file field ${this._field}`);
        
        // Trigger data-changed event to save the change immediately
        this.dispatchEvent(
          new CustomEvent("data-changed", {
            bubbles: true,
            composed: true,
            detail: { 
              field: this._field, 
              value: null, 
              record: this._record 
            },
          })
        );
      });
      
      fileInfo$.appendChild(removeButton);
      previewArea.appendChild(fileInfo$);
    }
    
    /**
     * Extracts filename from a path string
     * @param {string} filepath - Path string
     * @returns {string} Extracted filename
     * @private
     */
    _extractFilenameFromPath(filepath) {
      if (!filepath) return '';
      
      // Split on both forward and backslashes
      const parts = filepath.split(/[\/\\]/);
      return parts[parts.length - 1] || '';
    }
    
    /**
     * Gets MIME type from a filename based on extension
     * @param {string} filename - Filename to analyze
     * @returns {string} MIME type
     * @private
     */
    _getMimeTypeFromFilename(filename) {
      if (!filename) return 'application/octet-stream';
      
      const extension = filename.split('.').pop().toLowerCase();
      const mimeTypes = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'txt': 'text/plain',
        'csv': 'text/csv',
        'json': 'application/json',
        'xml': 'application/xml',
        'zip': 'application/zip'
      };
      
      return mimeTypes[extension] || 'application/octet-stream';
    }
  }
  
  customElements.define("bindable-input", BindableInput);
  