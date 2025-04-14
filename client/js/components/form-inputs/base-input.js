/**
 * Base class for form input components
 * Extended by specific input type implementations
 */
export class BaseInput {
    constructor(form, fieldConfig) {
        this.form = form; // Reference to the parent form
        this.field = fieldConfig; // Field configuration
        this.inputElement = null; // DOM element reference
    }

    /**
     * Create the DOM element for this input
     * Must be implemented by subclasses
     * @returns {HTMLElement} The created input element
     */
    createInputElement() {
        throw new Error('createInputElement must be implemented by subclass');
    }

    /**
     * Update the input value from the record data
     * @param {Object} record - The record data
     */
    updateValue(record) {
        if (!this.inputElement || !record) return;
        // Base implementation - override in subclasses as needed
        const value = record[this.field.name];
        if (this.inputElement.value !== String(value || '')) {
            this.inputElement.value = value || '';
        }
    }

    /**
     * Get the current value from the input
     * @returns {*} The input value in appropriate data type
     */
    getValue() {
        if (!this.inputElement) return null;
        return this.inputElement.value;
    }

    /**
     * Set up event listeners for the input element
     * @param {Function} onChangeCallback - Called when input changes
     */
    setupEventListeners(onChangeCallback) {
        if (!this.inputElement || !onChangeCallback) return;

        // Default event listening - override in subclasses for different event types
        this.inputElement.addEventListener('input', () => {
            onChangeCallback(this.field.name, this.getValue());
        });

        this.inputElement.addEventListener('blur', () => {
            onChangeCallback(this.field.name, this.getValue(), true);
        });
    }

    /**
     * Apply common HTML attributes to the input element
     */
    applyCommonAttributes() {
        if (!this.inputElement) return;

        // Apply field properties to input element
        if (this.field.required) this.inputElement.setAttribute('required', '');
        if (this.field.maxLength) this.inputElement.setAttribute('maxLength', this.field.maxLength);
        if (this.field.pattern) this.inputElement.setAttribute('pattern', this.field.pattern);
        if (this.field.placeholder) this.inputElement.setAttribute('placeholder', this.field.placeholder);

        // Ensure autocomplete is disabled
        this.inputElement.setAttribute('autocomplete', 'off');
        this.inputElement.setAttribute('autocorrect', 'off');
        this.inputElement.setAttribute('autocapitalize', 'off');
        this.inputElement.setAttribute('spellcheck', 'false');

        // Accessibility attributes
        this.inputElement.setAttribute('aria-label', this.field.caption || this.field.name);
    }

    /**
     * Checks if the input is valid
     * @returns {boolean} True if valid, false otherwise
     */
    isValid() {
        if (this.inputElement && typeof this.inputElement.checkValidity === 'function') {
            return this.inputElement.checkValidity();
        }
        // Fallback: always valid, or implement custom validation logic for non-native inputs
        return true;
    }

    /**
     * Get validation message if input is invalid
     * @returns {string} Validation message
     */
    getValidationMessage() {
        return this.inputElement?.validationMessage ?? '';
    }

    /**
     * Enable or disable the input element
     * @param {boolean} disabled - Whether the input should be disabled
     */
    setDisabled(disabled) {
        if (this.inputElement) {
            if (disabled) {
                this.inputElement.setAttribute('disabled', '');
            } else {
                this.inputElement.removeAttribute('disabled');
            }
        }
    }

    /**
     * Make the input read-only
     * @param {boolean} readonly - Whether the input should be read-only
     */
    setReadOnly(readonly) {
        if (this.inputElement) {
            if (readonly) {
                this.inputElement.setAttribute('readonly', '');
            } else {
                this.inputElement.removeAttribute('readonly');
            }
        }
    }
}
