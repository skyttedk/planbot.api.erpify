import Field from '../../lib/orm/Field.js';

/**
 * A custom field class for storing names, extending the base Field class.
 * This field enforces a fixed type ('varchar') and length (10), with optional
 * overrides for 'required' and 'default'.
 *
 * @param {Object} options - Configuration options.
 * @param {boolean} [options.required=false] - Whether the field is required.
 * @param {string} [options.default] - Default value if none is provided.
 */
class NameField extends Field {
    constructor(options = {}) {
        const fixedProperties = {
            uid: '{b0868557-fcab-4d9d-8e58-bacbb143e649}',
            type: 'varchar',
            length: 50,
        };

        const allowedOverrides = {
            required: options.required,
            default: options.default,
        };

        const documentation = {
            description: 'Name Field',
            examples: ['"Jon Doe"'],
            usage: 'Name of a person',
        };

        // Merge fixed properties and allowed overrides, set field name to 'NameField'
        super({ ...fixedProperties, ...allowedOverrides, documentation }, 'NameField');
    }

    /**
     * Custom setter logic: trims the string value if provided.
     *
     * @param {any} value - The value to transform.
     * @returns {any} The transformed value.
     */
    onSet(value) {
        if (typeof value === 'string') {
            return value.trim();
        }
        return value;
    }

    /**
     * Custom getter logic: currently a no-op, but can be extended.
     *
     * @param {any} value - The value to transform.
     * @returns {any} The transformed value.
     */
    onGet(value) {
        return value;
    }
}

export default NameField;