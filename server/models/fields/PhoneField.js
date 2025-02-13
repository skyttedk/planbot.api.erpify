// models/fields/PhoneField.js
import Field from '../../lib/orm/Field.js';

class PhoneField extends Field {
    constructor(options = {}) {
        // Fixed properties for a phone number field.
        const fixedProperties = {
            uid: '{2880f18c-87a7-4ca9-9029-64969bfb4335}',
            type: 'string',
            length: 15,
            pattern: /^\+?\d{10,15}$/, // e.g. allows an optional '+' followed by 10 to 15 digits
        };

        // Only allow `required` and `default` to be overridden.
        const allowedOverrides = {
            required: options.required,
            default: options.default,
        };

        super({ ...fixedProperties, ...allowedOverrides });
    }
}

export default PhoneField;
