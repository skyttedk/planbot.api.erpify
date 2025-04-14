import { BaseInput } from "./base-input.js";

/**
 * Select/Enum dropdown input component
 * Handles dropdown selection inputs including enums and option lists
 */
export class SelectInput extends BaseInput {
    /**
     * Create a select input component
     * @param {Object} form - Parent form reference
     * @param {Object} fieldConfig - Field configuration
     */
    constructor(form, fieldConfig) {
        super(form, fieldConfig);
        this.options = this._extractOptions(fieldConfig);
        this.inputElement = this.createInputElement();
        this.applyCommonAttributes();
    }

    /**
     * Create the DOM element for this input
     * @returns {HTMLSelectElement} The select element
     */
    createInputElement() {
        const select = document.createElement("select");
        select.id = this.field.name;
        select.name = this.field.name;

        // Add empty option for non-required fields
        if (!this.field.required) {
            const emptyOption = document.createElement("option");
            emptyOption.value = "";
            emptyOption.textContent = this.field.placeholder || "Select...";
            select.appendChild(emptyOption);
        }

        // Add all options from the options array
        this.options.forEach(option => {
            const optionEl = document.createElement("option");
            optionEl.value = option.value;
            optionEl.textContent = option.label;
            select.appendChild(optionEl);
        });

        return select;
    }

    /**
     * Extract options from field configuration
     * @param {Object} field - Field configuration
     * @returns {Array} Array of {value, label} option objects
     */
    _extractOptions(field) {
        let options = [];

        try {
            // Check if options are provided in field.options directly
            if (field.options) {
                if (Array.isArray(field.options)) {
                    // Handle different options formats
                    if (field.options.length > 0) {
                        if (typeof field.options[0] === "object") {
                            // Options are already in {value, label} format
                            options = field.options.map(opt => ({
                                value: String(opt.value ?? ""),
                                label: opt.label || opt.caption || String(opt.value ?? "")
                            }));
                        } else {
                            // Options are simple strings (enum case)
                            options = field.options.map(opt => ({
                                value: String(opt),
                                label: String(opt)
                            }));
                        }
                    }
                } else if (typeof field.options === "object") {
                    // Handle object format like {key1: "Label 1", key2: "Label 2"}
                    options = Object.entries(field.options).map(([key, value]) => ({
                        value: key,
                        label: value
                    }));
                }
            }
        } catch (error) {
            console.error("Error parsing options for field", field.name, error);
            options = [];
        }

        return options;
    }

    /**
     * Update the select element value from the record data
     * @param {Object} record - The record data
     */
    updateValue(record) {
        if (!this.inputElement || !record) return;

        const value = record[this.field.name];
        const stringValue = value != null ? String(value) : "";

        // Try to find a matching option
        const options = this.inputElement.options;
        let found = false;

        for (let i = 0; i < options.length; i++) {
            if (options[i].value === stringValue) {
                this.inputElement.selectedIndex = i;
                found = true;
                break;
            }
        }

        // If no match found and not required, select the empty option
        if (!found && !this.field.required && options.length > 0) {
            this.inputElement.selectedIndex = 0;
        }
    }

    /**
     * Get the current value from the select input with proper type conversion
     * @returns {*} The input value in appropriate data type
     */
    getValue() {
        if (!this.inputElement) return null;

        const selectedValue = this.inputElement.value;

        // Convert empty string to null
        if (selectedValue === "") return null;

        // Try to determine if the original field type was numeric
        if (this.field.type === "number" || this.field.type === "integer") {
            return Number(selectedValue);
        }

        return selectedValue;
    }

    /**
     * Override setupEventListeners to use change event for select elements
     * @param {Function} onChangeCallback - Called when select changes
     */
    setupEventListeners(onChangeCallback) {
        if (!this.inputElement || !onChangeCallback) return;

        // Select elements should use change event instead of input
        this.inputElement.addEventListener("change", () => {
            onChangeCallback(this.field.name, this.getValue(), true);
        });
    }

    /**
     * Update the available options in the select element
     * @param {Array} newOptions - New options array in [{value, label}] format
     */
    updateOptions(newOptions) {
        if (!this.inputElement) return;

        // Store the current value to preserve it if possible
        const currentValue = this.inputElement.value;

        // Clear existing options
        this.inputElement.innerHTML = "";

        // Add empty option for non-required fields
        if (!this.field.required) {
            const emptyOption = document.createElement("option");
            emptyOption.value = "";
            emptyOption.textContent = this.field.placeholder || "Select...";
            this.inputElement.appendChild(emptyOption);
        }

        // Add new options
        newOptions.forEach(option => {
            const optionEl = document.createElement("option");
            optionEl.value = option.value;
            optionEl.textContent = option.label;
            this.inputElement.appendChild(optionEl);
        });

        // Update internal options array
        this.options = newOptions;

        // Try to restore previous selection if it still exists
        const options = this.inputElement.options;
        let found = false;

        for (let i = 0; i < options.length; i++) {
            if (options[i].value === currentValue) {
                this.inputElement.selectedIndex = i;
                found = true;
                break;
            }
        }

        // If previous value not found and not required, select empty option
        if (!found && !this.field.required && options.length > 0) {
            this.inputElement.selectedIndex = 0;
        }
    }
}
