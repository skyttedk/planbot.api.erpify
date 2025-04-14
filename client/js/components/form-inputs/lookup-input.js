import { BaseInput } from "./base-input.js";

/**
 * Lookup Input Component
 * Handles dynamic lookup fields that fetch options from a data source
 */
export class LookupInput extends BaseInput {
    /**
     * Create a lookup input component
     * @param {Object} form - Parent form reference
     * @param {Object} fieldConfig - Field configuration
     */
    constructor(form, fieldConfig) {
        super(form, fieldConfig);
        this.options = [];
        this.dataSource = this._determineDataSource(fieldConfig);
        this.displayField = fieldConfig.displayField || "name";
        this.valueField = fieldConfig.valueField || "id";
        this.isLoading = false;
        this.inputElement = this.createInputElement();
        this.applyCommonAttributes();
    }

    /**
     * Determine the data source from field configuration
     * @param {Object} field - Field configuration
     * @returns {string} Data source name
     */
    _determineDataSource(field) {
        // Check all possible places where dataSource could be defined
        return field.dataSource ||
            (field.options && field.options.dataSource) ||
            null;
    }

    /**
     * Create the DOM element for this input
     * @returns {HTMLElement} The created container element
     */
    createInputElement() {
        // Create container for lookup components
        const container = document.createElement("div");
        container.className = "lookup-container";
        container.style.position = "relative";
        container.style.width = "100%";

        // Create text input for displaying/entering search value
        this.textInput = document.createElement("input");
        this.textInput.type = "text";
        this.textInput.className = "lookup-input";
        this.textInput.id = this.field.name;
        this.textInput.name = this.field.name;
        this.textInput.placeholder = this.field.placeholder || "Type to search...";
        this.textInput.setAttribute("autocomplete", "off");
        this.textInput.setAttribute("autocorrect", "off");
        this.textInput.setAttribute("autocapitalize", "off");
        this.textInput.setAttribute("spellcheck", "false");

        // Add a hidden input to store the actual value (id/key)
        this.hiddenInput = document.createElement("input");
        this.hiddenInput.type = "hidden";
        this.hiddenInput.name = `${this.field.name}_value`;

        // Create dropdown for displaying options
        this.dropdown = document.createElement("div");
        this.dropdown.className = "lookup-dropdown";
        this.dropdown.style.position = "absolute";
        this.dropdown.style.top = "100%";
        this.dropdown.style.left = "0";
        this.dropdown.style.right = "0";
        this.dropdown.style.zIndex = "1000";
        this.dropdown.style.background = "white";
        this.dropdown.style.border = "1px solid #ddd";
        this.dropdown.style.borderTop = "none";
        this.dropdown.style.borderRadius = "0 0 4px 4px";
        this.dropdown.style.maxHeight = "200px";
        this.dropdown.style.overflowY = "auto";
        this.dropdown.style.display = "none";
        this.dropdown.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";

        // Create clear button
        this.clearButton = document.createElement("div");
        this.clearButton.className = "lookup-clear";
        this.clearButton.innerHTML = "×";
        this.clearButton.style.position = "absolute";
        this.clearButton.style.right = "20px";
        this.clearButton.style.top = "50%";
        this.clearButton.style.transform = "translateY(-50%)";
        this.clearButton.style.fontSize = "14px";
        this.clearButton.style.color = "#999";
        this.clearButton.style.cursor = "pointer";
        this.clearButton.style.display = "none";
        this.clearButton.style.width = "14px";
        this.clearButton.style.height = "14px";
        this.clearButton.style.textAlign = "center";
        this.clearButton.style.lineHeight = "14px";

        // Add dropdown indicator
        this.indicator = document.createElement("div");
        this.indicator.className = "lookup-indicator";
        this.indicator.innerHTML = "▼";
        this.indicator.style.position = "absolute";
        this.indicator.style.right = "5px";
        this.indicator.style.top = "50%";
        this.indicator.style.transform = "translateY(-50%)";
        this.indicator.style.fontSize = "8px";
        this.indicator.style.color = "#666";
        this.indicator.style.pointerEvents = "none";

        // Assemble the components
        container.appendChild(this.textInput);
        container.appendChild(this.hiddenInput);
        container.appendChild(this.clearButton);
        container.appendChild(this.dropdown);
        container.appendChild(this.indicator);

        return container;
    }

    /**
     * Set up event listeners for the lookup input
     * @param {Function} onChangeCallback - Called when value changes
     */
    setupEventListeners(onChangeCallback) {
        if (!this.textInput || !onChangeCallback) return;

        // Input event for filtering options
        this.textInput.addEventListener("input", (e) => {
            const query = e.target.value.toLowerCase();

            // Show clear button when input has content
            this.clearButton.style.display = query ? "block" : "none";

            // Filter options based on input
            this._filterAndShowOptions(query);

            // Mark as dirty but don't save yet (wait for selection)
            onChangeCallback(this.field.name, this.getValue());
        });

        // Click event to show all options
        this.textInput.addEventListener("click", () => {
            // Show options dropdown
            this._showAllOptions();

            // Show clear button if there's a value
            this.clearButton.style.display = this.textInput.value ? "block" : "none";
        });

        // Clear button click
        this.clearButton.addEventListener("click", (e) => {
            e.stopPropagation(); // Prevent dropdown from opening

            // Clear inputs
            this.textInput.value = "";
            this.hiddenInput.value = "";
            this.clearButton.style.display = "none";

            // Hide dropdown
            this.dropdown.style.display = "none";

            // Trigger change
            onChangeCallback(this.field.name, null, true);
        });

        // Hide dropdown on blur after a short delay
        this.textInput.addEventListener("blur", () => {
            setTimeout(() => {
                this.dropdown.style.display = "none";
            }, 200);
        });

        // If we have a data source, trigger fetch when input receives focus
        if (this.dataSource) {
            this.textInput.addEventListener("focus", () => {
                if (this.options.length === 0 && !this.isLoading) {
                    this._fetchOptions();
                } else {
                    this._showAllOptions();
                }
            });
        }
    }

    /**
     * Update the lookup input value from record data
     * @param {Object} record - The record data
     */
    updateValue(record) {
        if (!this.textInput || !this.hiddenInput || !record) return;

        const value = record[this.field.name];

        if (value === null || value === undefined) {
            // Clear inputs for null/undefined values
            this.textInput.value = "";
            this.hiddenInput.value = "";
            this.clearButton.style.display = "none";
            return;
        }

        // Store the value in the hidden input
        this.hiddenInput.value = String(value);

        // Try to find the display text for this value
        const option = this.options.find(opt =>
            String(opt[this.valueField]) === String(value));

        if (option) {
            // Set the display text from the matched option
            this.textInput.value = option[this.displayField] || String(value);
        } else {
            // If we can't find a match, just use the value
            this.textInput.value = String(value);

            // If we have a data source, try to fetch the display value
            if (this.dataSource && !this.isLoading) {
                this._fetchOptionById(value);
            }
        }

        // Show clear button if we have a value
        this.clearButton.style.display = this.textInput.value ? "block" : "none";
    }

    /**
     * Get the current value from the lookup input
     * @returns {*} The selected value
     */
    getValue() {
        if (!this.hiddenInput) return null;

        const value = this.hiddenInput.value;

        // Return null for empty values
        if (!value) return null;

        // Try to convert to number if it looks like one
        if (/^\d+$/.test(value)) {
            return Number(value);
        }

        return value;
    }

    /**
     * Fetch options from the data source
     * @private
     */
    async _fetchOptions() {
        if (!this.dataSource || !this.form.sendRequest) {
            console.warn(`Cannot fetch options for ${this.field.name}: Missing data source or request handler`);
            return;
        }

        this.isLoading = true;
        this._showLoadingState();

        try {
            const requestId = `req-find-all-${this.dataSource}-${Date.now()}`;
            const message = {
                type: 'model',
                name: this.dataSource,
                action: 'findAll',
                parameters: {},
                requestId
            };

            const response = await this.form.sendRequest(message);

            if (response.success && Array.isArray(response.result)) {
                this.options = response.result;
                this._filterAndShowOptions(this.textInput.value.toLowerCase());
            } else {
                this._showErrorInDropdown(`Error loading options: ${response.error || 'Unknown error'}`);
            }
        } catch (error) {
            this._showErrorInDropdown('Failed to load options. Please try again.');
            console.error(`Error fetching options for ${this.field.name}:`, error);
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Fetch a specific option by ID
     * @param {*} id - The ID to fetch
     * @private
     */
    async _fetchOptionById(id) {
        if (!this.dataSource || !this.form.sendRequest) {
            return;
        }

        try {
            const requestId = `req-find-by-id-${this.dataSource}-${id}-${Date.now()}`;
            const message = {
                type: 'model',
                name: this.dataSource,
                action: 'findById',
                parameters: { id },
                requestId
            };

            const response = await this.form.sendRequest(message);

            if (response.success && response.result) {
                // Add to options cache and update display
                const newOption = response.result;

                // Only add if not already in the options array
                if (!this.options.some(opt => String(opt[this.valueField]) === String(id))) {
                    this.options.push(newOption);
                }

                // Update the display text
                this.textInput.value = newOption[this.displayField] || String(id);
            }
        } catch (error) {
            console.error(`Error fetching option by ID for ${this.field.name}:`, error);
        }
    }

    /**
     * Show loading state in the dropdown
     * @private
     */
    _showLoadingState() {
        this.dropdown.innerHTML = "";
        this.dropdown.style.display = "block";

        const loadingItem = document.createElement("div");
        loadingItem.className = "lookup-loading";
        loadingItem.textContent = "Loading options...";
        loadingItem.style.padding = "8px";
        loadingItem.style.color = "#666";
        loadingItem.style.textAlign = "center";

        this.dropdown.appendChild(loadingItem);
    }

    /**
     * Show error message in the dropdown
     * @param {string} message - Error message to display
     * @private
     */
    _showErrorInDropdown(message) {
        this.dropdown.innerHTML = "";
        this.dropdown.style.display = "block";

        const errorItem = document.createElement("div");
        errorItem.className = "lookup-error";
        errorItem.textContent = message;
        errorItem.style.padding = "8px";
        errorItem.style.color = "#cc0000";
        errorItem.style.textAlign = "center";

        this.dropdown.appendChild(errorItem);
    }

    /**
     * Show all available options in the dropdown
     * @private
     */
    _showAllOptions() {
        if (this.options.length === 0) {
            if (this.dataSource && !this.isLoading) {
                this._fetchOptions();
            } else {
                this._showErrorInDropdown("No options available");
            }
            return;
        }

        this._renderOptions(this.options);
    }

    /**
     * Filter and show options based on input query
     * @param {string} query - Search query to filter by
     * @private
     */
    _filterAndShowOptions(query) {
        if (this.options.length === 0) {
            if (this.dataSource && !this.isLoading) {
                this._fetchOptions();
            }
            return;
        }

        // Filter options that match the query
        const filtered = !query ? this.options : this.options.filter(option => {
            const displayText = String(option[this.displayField] || '').toLowerCase();
            return displayText.includes(query);
        });

        this._renderOptions(filtered);
    }

    /**
     * Render options in the dropdown
     * @param {Array} options - Options to render
     * @private
     */
    _renderOptions(options) {
        this.dropdown.innerHTML = "";

        if (options.length === 0) {
            const noResults = document.createElement("div");
            noResults.className = "lookup-no-results";
            noResults.textContent = "No matching options found";
            noResults.style.padding = "8px";
            noResults.style.color = "#666";
            noResults.style.textAlign = "center";

            this.dropdown.appendChild(noResults);
            this.dropdown.style.display = "block";
            return;
        }

        // Add header with count
        const header = document.createElement("div");
        header.className = "lookup-header";
        header.textContent = `${options.length} option${options.length !== 1 ? 's' : ''} found`;
        header.style.padding = "4px 8px";
        header.style.color = "#666";
        header.style.fontSize = "12px";
        header.style.borderBottom = "1px solid #eee";
        header.style.background = "#f9f9f9";

        this.dropdown.appendChild(header);

        // Get current value for highlighting
        const currentValue = this.hiddenInput.value;

        // Add options
        options.forEach(option => {
            const optionEl = document.createElement("div");
            optionEl.className = "lookup-option";
            optionEl.textContent = option[this.displayField] || "(unnamed)";
            optionEl.style.padding = "6px 8px";
            optionEl.style.cursor = "pointer";

            // Highlight if this is the selected option
            if (currentValue && String(option[this.valueField]) === String(currentValue)) {
                optionEl.classList.add("selected");
                optionEl.style.background = "#f0f8ff";
                optionEl.style.fontWeight = "bold";
            }

            // Store option data 
            const optionValue = option[this.valueField];

            // Add hover effect
            optionEl.addEventListener("mouseover", () => {
                optionEl.style.backgroundColor = optionEl.classList.contains("selected")
                    ? "#e6f2ff"
                    : "#f0f0f0";
            });

            optionEl.addEventListener("mouseout", () => {
                optionEl.style.backgroundColor = optionEl.classList.contains("selected")
                    ? "#f0f8ff"
                    : "";
            });

            // Handle option selection
            optionEl.addEventListener("mousedown", () => {
                // Update display and hidden values
                this.textInput.value = option[this.displayField] || "(unnamed)";
                this.hiddenInput.value = String(optionValue);
                this.clearButton.style.display = "block";

                // Hide dropdown
                this.dropdown.style.display = "none";

                // Trigger change event on the parent form
                if (this.form && typeof this.form.handleFieldChange === 'function') {
                    this.form.handleFieldChange(this.field.name, optionValue, true);
                }
            });

            this.dropdown.appendChild(optionEl);
        });

        // Display the dropdown
        this.dropdown.style.display = "block";
    }

    /**
     * Update the options for this lookup input
     * @param {Array} newOptions - New options to use
     */
    updateOptions(newOptions) {
        this.options = newOptions || [];

        // Update dropdown if it's currently visible
        if (this.dropdown.style.display === "block") {
            this._filterAndShowOptions(this.textInput.value.toLowerCase());
        }
    }

    /**
     * Checks if the input is valid
     * Override the base implementation to check the text input element
     * @returns {boolean} True if valid, false otherwise
     */
    isValid() {
        // Use the text input for validation instead of the container div
        return this.textInput?.checkValidity() ?? true;
    }

    /**
     * Get validation message if input is invalid
     * Override to use the text input element
     * @returns {string} Validation message
     */
    getValidationMessage() {
        return this.textInput?.validationMessage ?? '';
    }
}
