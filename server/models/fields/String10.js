import Field from '../../lib/orm/Field.js';

class String10Field extends Field {
    constructor(options = {}) {
        const fixedProperties = {
            uid: '{a7d5b3f1-8c2e-4d9b-a5e3-c8f91b2d3e4f}',
            type: 'varchar',
            length: 10,
        };

        const allowedOverrides = {
            required: options.required,
            default: options.default,
            caption: options.caption,
        };

        const documentation = {
            description: 'Short string field with 10 character limit',
            examples: ['"Code"', '"ID"', '"Prefix"'],
            usage: 'Use for short text fields like codes, prefixes, or short acronyms'
        };

        super({ ...fixedProperties, ...allowedOverrides, documentation }, 'String10Field');
    }

    onSet(value) {
        // Custom setter logic
        if (typeof value === 'string') {
            value = value.trim();
            // Truncate if exceeds length
            if (value.length > 10) {
                value = value.substring(0, 10);
            }
        }
        return value;
    }

    onGet(value) {
        // Custom getter logic
        return value;
    }
}

export default String10Field;