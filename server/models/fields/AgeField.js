// models/fields/AgeField.js
import Field from '../../lib/orm/Field.js';

class AgeField extends Field {
    constructor(options = {}) {
        const fixedProperties = {
            uid: '{cdfaf091-eb39-4573-9467-e4230fffb757}',
            type: 'integer',
            min: 0,
            max: 120,
        };

        // Only allow `required` and `default` to be overridden.
        const allowedOverrides = {
            required: options.required,
            default: options.default,
        };

        super({ ...fixedProperties, ...allowedOverrides });
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

export default AgeField;
