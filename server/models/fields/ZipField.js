// models/fields/ZipField.js
import Field from '../../lib/orm/Field.js';

/**
 * A custom field class for storing zip codes, extending the base Field class.
 * This field enforces a fixed type ('string'), length (10), and a validation pattern
 * for US zip codes, with optional overrides for 'required' and 'default'.
 *
 * @param {Object} options - Configuration options.
 * @param {boolean} [options.required=false] - Whether the field is required.
 * @param {string} [options.default] - Default value if none is provided.
 */
class ZipField extends Field {
    constructor(options = {}) {
        // Fixed properties for a zip code — for example, a US ZIP code.
        const fixedProperties = {
            uid: '{426581fa-3698-4c30-84aa-2648eed7592c}',
            type: 'varchar',
            length: 10,
            pattern: /^\d{5}(-\d{4})?$/, // Allows 5 digits or '12345-6789'
        };

        const allowedOverrides = {
            required: options.required,
            default: options.default,
        };

        const documentation = {
            description: 'Zip Code Field',
            examples: ['"12345"', '"12345-6789"'],
            usage: 'Stores a US zip code, either 5 digits or 5+4 format.',
        };

        // Merge fixed properties and allowed overrides, set field name to 'Zip'
        super({ ...fixedProperties, ...allowedOverrides }, 'Zip');
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

export default ZipField;