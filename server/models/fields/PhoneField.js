// models/fields/PhoneField.js
import Field from '../../lib/orm/Field.js';

/**
 * A custom field class for storing phone numbers, extending the base Field class.
 * This field enforces a fixed type ('string'), length (15), and a validation pattern
 * for phone numbers, with optional overrides for 'required' and 'default'.
 *
 * @param {Object} options - Configuration options.
 * @param {boolean} [options.required=false] - Whether the field is required.
 * @param {string} [options.default] - Default value if none is provided.
 * @param {string} [options.caption] - Caption for the field.
 */
class PhoneField extends Field {
    constructor(options = {}) {
        // Fixed properties for a phone number field.
        const fixedProperties = {
            uid: '{2880f18c-87a7-4ca9-9029-64969bfb4335}',
            type: 'string',
            length: 15,
            caption: 'Phone Number',
            //pattern: /^\+?\d{10,15}$/, // e.g. allows an optional '+' followed by 10 to 15 digits
        };

        // Only allow `required` and `default` to be overridden.
        const allowedOverrides = {
            required: options.required,
            default: options.default,
            caption: options.caption, // Allow caption to be overridden
        };

        const documentation = {
            description: 'Phone Number Field',
            examples: ['"+1234567890"', '"1234567890"'],
            usage: 'Stores a phone number with an optional international code.',
        };

        // Merge fixed properties and allowed overrides, set field name to 'Phone'
        super({ ...fixedProperties, ...allowedOverrides }, 'Phone');
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

export default PhoneField;