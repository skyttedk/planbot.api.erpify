import { BaseInput } from "./base-input.js";

/**
 * Standard text input component
 * Handles text, number, email, password and other basic HTML5 input types
 */
export class TextInput extends BaseInput {
    /**
     * Create a text input component
     * @param {Object} form - Parent form reference
     * @param {Object} fieldConfig - Field configuration
     */
    constructor(form, fieldConfig) {
        super(form, fieldConfig);
        this.inputType = this._determineInputType(fieldConfig);
        this.inputElement = this.createInputElement();
        this.applyCommonAttributes();
    }

    /**
     * Create the DOM element for this input
     * @returns {HTMLInputElement} The input element
     */
    createInputElement() {
        const input = document.createElement("input");
        input.type = this.inputType;
        input.id = this.field.name;
        input.name = this.field.name;

        // Apply additional type-specific attributes
        if (this.inputType === "number") {
            if (this.field.min !== undefined) input.min = this.field.min;
            if (this.field.max !== undefined) input.max = this.field.max;
            if (this.field.step !== undefined) input.step = this.field.step;
        }

        if (this.inputType === "date" || this.inputType === "datetime-local") {
            if (this.field.min) input.min = this.field.min;
            if (this.field.max) input.max = this.field.max;
        }

        return input;
    }

    /**
     * Determine the appropriate HTML input type based on field configuration
     * @param {Object} field - Field configuration
     * @returns {string} HTML input type
     */
    _determineInputType(field) {
        // First check if there's an explicit fieldType (UI type)
        if (field.fieldType) {
            return field.fieldType;
        }

        // Then map data types to appropriate HTML input types
        switch (field.type) {
            case "email":
                return "email";
            case "password":
                return "password";
            case "url":
                return "url";
            case "phone":
            case "tel":
                return "tel";
            case "number":
            case "integer":
            case "decimal":
            case "float":
                return "number";
            case "date":
                return "date";
            case "datetime":
                return "datetime-local";
            case "time":
                return "time";
            case "color":
                return "color";
            case "search":
                return "search";
            default:
                return "text";
        }
    }

    /**
     * Update the input value from the record data
     * @param {Object} record - The record data
     */
    updateValue(record) {
        if (!this.inputElement || !record) return;

        const value = record[this.field.name];

        if (value === null || value === undefined) {
            this.inputElement.value = "";
            return;
        }

        // Format values appropriately based on input type
        if (this.inputType === "date" && value instanceof Date) {
            // Format as YYYY-MM-DD for date inputs
            const dateStr = value.toISOString().split("T")[0];
            this.inputElement.value = dateStr;
        } else if (this.inputType === "datetime-local" && value instanceof Date) {
            // Format as YYYY-MM-DDThh:mm for datetime-local inputs
            const dateTimeStr = value.toISOString().slice(0, 16);
            this.inputElement.value = dateTimeStr;
        } else {
            // Regular conversion for other types
            this.inputElement.value = String(value);
        }
    }

    /**
     * Get the current value from the input with proper type conversion
     * @returns {*} The input value in appropriate data type
     */
    getValue() {
        if (!this.inputElement) return null;

        const rawValue = this.inputElement.value;

        // Return appropriate data type based on the input type
        if (rawValue === "") return null;

        switch (this.inputType) {
            case "number":
                return Number(rawValue);
            case "date":
            case "datetime-local":
                return rawValue ? new Date(rawValue) : null;
            case "checkbox":
                return this.inputElement.checked;
            default:
                return rawValue;
        }
    }
}
