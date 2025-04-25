import Field from '../../lib/orm/Field.js';

class EmailField extends Field {
    constructor(options = {}) {
        const fixedProperties = {
            uid: '{b9cabff6-d2d1-499c-9bc6-9c5dae540443}',
            type: 'varchar',
            length: 255,
        };

        const allowedOverrides = {
            required: options.required,
            default: options.default,
        };

        const documentation = {
            description: 'Email Field',
            examples: ['user@example.com', 'contact@company.org'],
            usage: 'Used for storing email addresses'
        };

        super({ ...fixedProperties, ...allowedOverrides, documentation }, 'EmailField');
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

export default EmailField;