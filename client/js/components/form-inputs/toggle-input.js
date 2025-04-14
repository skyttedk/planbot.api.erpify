import { BaseInput } from "./base-input.js";

/**
 * Toggle Input Component
 * Handles checkbox and radio button inputs
 */
export class ToggleInput extends BaseInput {
    /**
     * Create a toggle input component (checkbox/radio)
     * @param {Object} form - Parent form reference
     * @param {Object} fieldConfig - Field configuration
     */
    constructor(form, fieldConfig) {
        super(form, fieldConfig);
        this.inputType = fieldConfig.fieldType || (fieldConfig.type === "boolean" ? "checkbox" : "radio");
        this.inputElement = this.createInputElement();
        this.applyCommonAttributes();
    }

    /**
     * Create the DOM element for this input
     * @returns {HTMLInputElement} The input element
     */
    createInputElement() {
        // Create container for the input and label
        const container = document.createElement("div");
        container.className = "toggle-container";
        container.style.display = "flex";
        container.style.alignItems = "center";

        // Create the actual input element
        const input = document.createElement("input");
        input.type = this.inputType;
        input.id = this.field.name;
        input.name = this.field.name;

        // For radio buttons, we need a value
        if (this.inputType === "radio") {
            input.value = this.field.value || "true";
        }

        // Store reference to actual input element
        this.actualInput = input;

        // Create label that appears after the checkbox/radio
        const label = document.createElement("label");
        label.htmlFor = this.field.name;
        label.textContent = this.field.checkboxLabel || "";
        label.style.marginLeft = "8px";
        label.style.cursor = "pointer";

        // Assemble the elements
        container.appendChild(input);
        container.appendChild(label);

        return container;
    }

    /**
     * Apply common attributes to the input element
     * Override to apply to the actual input rather than container
     */
    applyCommonAttributes() {
        if (!this.actualInput) return;

        // Apply field properties to the actual input element
        if (this.field.required) this.actualInput.setAttribute("required", "");
        if (this.field.disabled) this.actualInput.setAttribute("disabled", "");
        if (this.field.readonly) this.actualInput.setAttribute("readonly", "");

        // Accessibility attributes
        this.actualInput.setAttribute("aria-label", this.field.caption || this.field.name);
    }

    /**
     * Update the input value from the record data
     * @param {Object} record - The record data
     */
    updateValue(record) {
        if (!this.actualInput || !record) return;

        const value = record[this.field.name];

        if (this.inputType === "checkbox") {
            // For checkboxes, convert any truthy/falsy value to boolean
            this.actualInput.checked = Boolean(value);
        } else if (this.inputType === "radio") {
            // For radio buttons, check if the value matches
            const radioValue = this.actualInput.value;
            this.actualInput.checked = String(value) === radioValue;
        }
    }

    /**
     * Get the current value from the input
     * @returns {*} The input value in appropriate data type
     */
    getValue() {
        if (!this.actualInput) return null;

        if (this.inputType === "checkbox") {
            return this.actualInput.checked;
        } else if (this.inputType === "radio") {
            // For radio, return the value if checked, otherwise null
            return this.actualInput.checked ? this.actualInput.value : null;
        }

        return null;
    }

    /**
     * Set up event listeners for the toggle input
     * @param {Function} onChangeCallback - Called when input changes
     */
    setupEventListeners(onChangeCallback) {
        if (!this.actualInput || !onChangeCallback) return;

        // For toggle inputs, use change event instead of input
        this.actualInput.addEventListener("change", () => {
            // For checkboxes/radios, we want to trigger immediate save on change
            onChangeCallback(this.field.name, this.getValue(), true);
        });
    }
}
