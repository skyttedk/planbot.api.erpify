// models/fields/JsonField.js
import Field from '../../lib/orm/Field.js';

/**
 * A custom field class for storing JSON data, extending the base Field class.
 * This field enforces a fixed type ('json') with optional overrides for 'required' and 'default'.
 *
 * @param {Object} options - Configuration options.
 * @param {boolean} [options.required=false] - Whether the field is required.
 * @param {Object|string} [options.default] - Default value if none is provided (e.g., '{}', '{"key": "value"}').
 */
class JsonField extends Field {
    constructor(options = {}) {
        // Fixed properties for a JSON field
        const fixedProperties = {
            uid: '{dbe2d9cc-1443-4199-9fde-54ced5456c85}',
            type: 'json',
        };

        // Allow `required` and `default` to be overridden
        const allowedOverrides = {
            required: options.required,
            default: options.default,
        };

        const documentation = {
            description: 'JSON Data Field',
            examples: ['"{}"', '{"key": "value"}'],
            usage: 'Stores structured JSON data.',
        };

        // Merge fixed properties and allowed overrides, set field name to 'Json'
        super({ ...fixedProperties, ...allowedOverrides }, 'Json');
    }

    /**
     * Custom setter logic: ensures the value is a valid JSON string or object.
     * If an object is provided, it’s stringified; strings are trimmed.
     *
     * @param {any} value - The value to transform (object or string).
     * @returns {string} The transformed JSON string.
     */
    onSet(value) {
        if (value === undefined || value === null) {
            return value; // Let the base validation handle required checks
        }
        if (typeof value === 'object') {
            return JSON.stringify(value);
        }
        if (typeof value === 'string') {
            return value.trim();
        }
        return value; // Pass through other types unchanged (validation will catch them)
    }

    /**
     * Custom getter logic: parses the JSON string into an object if possible.
     *
     * @param {any} value - The value to transform (typically a JSON string).
     * @returns {Object|string} The parsed object or original value if parsing fails.
     */
    onGet(value) {
        if (typeof value === 'string') {
            try {
                return JSON.parse(value);
            } catch (e) {
                // Log the error but don't throw it to avoid breaking the application
                console.error(`Error parsing JSON value in JsonField: ${e.message}`);
                // Return a safe default for invalid JSON
                return {};
            }
        }
        return value; // Return non-string values unchanged
    }
}

export default JsonField;