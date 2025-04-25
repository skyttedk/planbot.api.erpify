import Field from '../../lib/orm/Field.js';

class String20Field extends Field {
    constructor(options = {}) {
        const fixedProperties = {
            uid: '{45b7c8a1-2d3e-4f56-a7b8-c9d0e1f2a3b4}',
            type: 'varchar',
            length: 20,
        };

        const allowedOverrides = {
            required: options.required,
            default: options.default,
            caption: options.caption,
        };

        const documentation = {
            description: 'String field with 20 character limit',
            examples: ['"Title"', '"Short name"', '"Abbreviation"'],
            usage: 'Use for short text fields like titles, codes, or brief identifiers'
        };

        super({ ...fixedProperties, ...allowedOverrides, documentation }, 'String20Field');
    }

    onSet(value) {
        // Custom setter logic
        if (typeof value === 'string') {
            value = value.trim();
            // Truncate if exceeds length
            if (value.length > 20) {
                value = value.substring(0, 20);
            }
        }
        return value;
    }

    onGet(value) {
        // Custom getter logic
        return value;
    }
}

export default String20Field;