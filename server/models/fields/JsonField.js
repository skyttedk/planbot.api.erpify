// models/fields/ZipField.js
import Field from '../../lib/orm/Field.js';

class JsonField extends Field {
    constructor(options = {}) {
        // Fixed properties for a zip code — for example, a US ZIP code.
        const fixedProperties = {
            uid: '{dbe2d9cc-1443-4199-9fde-54ced5456c85}',
            type: 'json'
        };

        const allowedOverrides = {
            required: options.required,
            default: options.default,
        };



        super({ ...fixedProperties, ...allowedOverrides });
    }
}

export default JsonField;
