// models/fields/Field.js

/**
 * Represents a field in an ORM model with validation and transformation capabilities.
 *
 * @param {Object} options - Configuration options for the field.
 * @param {string} fieldName - Name of the field for error reporting.
 * @param {string} options.type - The native type (e.g., 'string', 'integer', 'numeric', 'boolean', 'date', 'timestamp').
 * @param {number} [options.length] - Maximum length for string fields.
 * @param {boolean} [options.required=false] - Whether the field is required.
 * @param {any} [options.default] - Default value if none is provided.
 * @param {RegExp} [options.pattern] - Regex pattern for string validation.
 * @param {number} [options.precision] - Precision for numeric fields.
 * @param {number} [options.scale] - Scale for numeric fields.
 * @param {string} [options.uid] - Unique identifier for the field (must be provided manually).
 * @param {string} [options.caption] - User-friendly caption for the field for UI display.
 * @param {function} [options.onSet] - Transformation function applied before saving.
 * @param {function} [options.onGet] - Transformation function applied after retrieval.
 * @param {boolean} [options.primary=false] - Whether this is a primary key field.
 * @param {boolean} [options.nullable=true] - Whether this field can be null.
 */
export default class Field {
    constructor(options = {}, fieldName = 'Field') {
        this.fieldName = fieldName;
        this.type = options.type;
        this.length = options.length;
        this.required = options.required || false;
        this.default = options.default;
        this.pattern = options.pattern;
        this.precision = options.precision;
        this.scale = options.scale;
        this.uid = options.uid; // UID must be provided manually
        this.caption = options.caption; // User-friendly display name
        this.options = options; // Store all options for reference
        
        
    }

    /**
     * Default onSet function that returns the value unchanged.
     * 
     * @param {any} value - The value to be set.
     * @returns {any} The original value.
     */
    defaultOnSet(value) {
        return value;
    }

    /**
     * Default onGet function that returns the value unchanged.
     * 
     * @param {any} value - The value to be retrieved.
     * @returns {any} The original value.
     */
    defaultOnGet(value) {
        return value;
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
        if (this.type) {
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