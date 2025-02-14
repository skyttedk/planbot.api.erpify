import Field from '../../lib/orm/Field.js';

class NameField extends Field {
    constructor(options = {}) {
        const fixedProperties = {
            uid: 'b0868557-fcab-4d9d-8e58-bacbb143e649',
            type: 'varchar',
            length: 10,
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

        super({ ...fixedProperties, ...allowedOverrides });
    }

    onSet(value) {
        // Custom setter logic
        if (typeof value === 'string') {
            value = value.trim();
        }
        return value;
    }

    onGet(value) {
        // Custom getter logic
        return value;
    }
}

export default NameField;