// models/fields/Field.js
import crypto from 'crypto'; // Ensure this import is available if using Node.js

/**
 * Represents a field in an ORM model with validation and transformation capabilities.
 *
 * @param {Object} options - Configuration options for the field.
 * @param {string} options.type - The native type (e.g., 'string', 'integer', 'numeric', 'boolean', 'date', 'timestamp').
 * @param {number} [options.length] - Maximum length for string fields.
 * @param {boolean} [options.required=false] - Whether the field is required.
 * @param {any} [options.default] - Default value if none is provided.
 * @param {RegExp} [options.pattern] - Regex pattern for string validation.
 * @param {number} [options.precision] - Precision for numeric fields.
 * @param {number} [options.scale] - Scale for numeric fields.
 * @param {string} [options.uid] - Unique identifier for the field (must be provided manually).
 * @param {function} [options.onSet] - Transformation function applied before saving.
 * @param {function} [options.onGet] - Transformation function applied after retrieval.
 * @param {string} [fieldName='Field'] - Name of the field for error reporting.
 */
export default class Field {
    constructor(options = {}, fieldName = 'Field') {
        this.type = options.type;
        this.length = options.length;
        this.required = options.required || false;
        this.default = options.default;
        this.pattern = options.pattern;
        this.precision = options.precision;
        this.scale = options.scale;
        this.uid = options.uid; // UID must be provided manually
        this.onSet = options.onSet || ((value) => value);
        this.onGet = options.onGet || ((value) => value);
        this.fieldName = fieldName;
    }

    /**
     * Validates the provided value against the field's constraints.
     * Throws an error if validation fails.
     *
     * @param {any} value - The value to validate.
     */
    validate(value) {
        const name = this.fieldName;

        // Check if the field is required
        if (this.required && (value === undefined || value === null)) {
            throw new Error(`${name} is required.`);
        }

        // Skip further validation if value is null or undefined (allowed if not required)
        if (value === undefined || value === null) {
            return;
        }

        // Type-specific validation
        switch (this.type.toLowerCase()) {
            case 'string':
            case 'varchar':
            case 'text':
                if (typeof value !== 'string') {
                    throw new Error(`${name} must be a string.`);
                }
                if (this.length && value.length > this.length) {
                    throw new Error(`${name} exceeds the maximum length of ${this.length}.`);
                }
                if (this.pattern && !this.pattern.test(value)) {
                    throw new Error(`${name} does not match the required pattern.`);
                }
                break;
            case 'integer':
            case 'int':
                if (!Number.isInteger(value)) {
                    throw new Error(`${name} must be an integer.`);
                }
                break;
            case 'bigint':
                if (typeof value !== 'bigint' && !Number.isInteger(value)) {
                    throw new Error(`${name} must be a bigint or integer.`);
                }
                break;
            case 'numeric':
                if (isNaN(Number(value))) {
                    throw new Error(`${name} must be a number.`);
                }
                // Additional precision/scale checks can be added if needed
                break;
            case 'boolean':
                if (typeof value !== 'boolean') {
                    throw new Error(`${name} must be a boolean.`);
                }
                break;
            case 'date':
                if (!(value instanceof Date) || isNaN(value.getTime())) {
                    throw new Error(`${name} must be a valid date.`);
                }
                break;
            case 'timestamp':
                if (!(value instanceof Date) || isNaN(value.getTime())) {
                    throw new Error(`${name} must be a valid timestamp.`);
                }
                break;
            default:
                // No additional validation for unknown types
                break;
        }
    }

    /**
     * Returns the default value for the field.
     *
     * @returns {any} The default value.
     */
    getDefault() {
        return this.default;
    }

    /**
     * Applies the onSet transformation to the value.
     *
     * @param {any} value - The value to transform.
     * @returns {any} The transformed value.
     */
    setValue(value) {
        return this.onSet(value);
    }

    /**
     * Applies the onGet transformation to the value.
     *
     * @param {any} value - The value to transform.
     * @returns {any} The transformed value.
     */
    getValue(value) {
        return this.onGet(value);
    }
}