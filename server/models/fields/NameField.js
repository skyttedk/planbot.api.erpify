// models/fields/NameField.js
import Field from '../../lib/orm/Field.js';

class NameField extends Field {
    constructor(options = {}) {
        // Fixed properties for a name field.
        const fixedProperties = {
            uid: '{c21861b4-b411-4560-84ea-d344cacee983}',
            type: 'string',
            length: 100,
        };

        const allowedOverrides = {
            required: options.required,
            default: options.default,
        };

        super({ ...fixedProperties, ...allowedOverrides });
    }
}

export default NameField;
