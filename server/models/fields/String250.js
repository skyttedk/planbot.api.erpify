import Field from '../../lib/orm/Field.js';

class String250Field extends Field {
    constructor(options = {}) {
        const fixedProperties = {
            uid: 'b79030b2-11e6-43fb-92af-c91625827674',
            type: 'varchar',
            length: 250,
        };

        const allowedOverrides = {
            required: options.required,
            default: options.default,
        };

        const documentation = {
            description: 'Standard string field with 250 character limit',
            examples: ['"Short text"', '"Longer description with multiple words"'],
            usage: 'Use for names, descriptions, and general text content under 250 characters'
        };

        super({ ...fixedProperties, ...allowedOverrides, documentation }, 'String250Field');
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

export default String250Field;