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

    onSet(value) {
        value = "mr. " + value.trim();
        return value.trim();
    }

    onGet(value) {
        if (typeof value === 'string' && value.length > 0) {
            return value.charAt(0).toUpperCase() + value.slice(1);
        }
        return value;
    }
}

export default NameField;
