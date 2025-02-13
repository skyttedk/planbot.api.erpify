// models/fields/ZipField.js
import Field from '../../lib/orm/Field.js';

class ZipField extends Field {
    constructor(options = {}) {
        // Fixed properties for a zip code — for example, a US ZIP code.
        const fixedProperties = {
            uid: '{426581fa-3698-4c30-84aa-2648eed7592c}',
            type: 'string',
            length: 10,
            pattern: /^\d{5}(-\d{4})?$/, // Allows 5 digits or '12345-6789'
        };

        const allowedOverrides = {
            required: options.required,
            default: options.default,
        };

        super({ ...fixedProperties, ...allowedOverrides });
    }
}

export default ZipField;
