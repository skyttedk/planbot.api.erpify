// models/fields/Field.js
export default class Field {
    /**
     * @param {Object} options
     * @param {string} options.type - The native type (e.g. 'string', 'numeric')
     * @param {number} [options.length] - Maximum length (if applicable)
     * @param {boolean} [options.required=false] - Whether a value is required
     * @param {any} [options.default] - Default value if none is provided
     * @param {RegExp} [options.pattern] - A regex pattern used for validation
     * @param {number} [options.precision] - Precision used for numeric fields
     * @param {number} [options.scale] - Scale used for numeric fields
     */
    constructor(options = {}) {
        this.type = options.type;
        this.length = options.length;
        this.required = options.required || false;
        this.default = options.default;
        this.pattern = options.pattern;
        this.precision = options.precision;
        this.scale = options.scale;
        this.uid = options.uid;
    }

    /**
     * Basic validation against required status, length, and pattern.
     * Extend this method if you need more validations.
     * @param {any} value - The value to validate.
     */
    validate(value) {
        if (this.required && (value === undefined || value === null)) {
            throw new Error('Field is required.');
        }
        if (this.length && typeof value === 'string' && value.length > this.length) {
            throw new Error(`Value exceeds the maximum length of ${this.length}.`);
        }
        if (this.pattern && typeof value === 'string' && !this.pattern.test(value)) {
            throw new Error('Value does not match the required pattern.');
        }
    }
}
