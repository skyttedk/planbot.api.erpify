import Field from '../../lib/orm/Field.js';

class String100Field extends Field {
    constructor(options = {}) {
        const fixedProperties = {
            uid: '{d1e2f3g4-h5i6-j7k8-l9m0-n1o2p3q4r5s6}',
            type: 'varchar',
            length: 100,
        };

        const allowedOverrides = {
            required: options.required,
            default: options.default,
            caption: options.caption,
        };

        const documentation = {
            description: 'String field with 100 character limit',
            examples: ['"Longer descriptive name"', '"A sentence describing something"', '"Multiple word title with specific details"'],
            usage: 'Use for longer text fields like full names, addresses, or brief paragraphs'
        };

        super({ ...fixedProperties, ...allowedOverrides, documentation }, 'String100Field');
    }

    onSet(value) {
        // Custom setter logic
        if (typeof value === 'string') {
            value = value.trim();
            // Truncate if exceeds length
            if (value.length > 100) {
                value = value.substring(0, 100);
            }
        }
        return value;
    }

    onGet(value) {
        // Custom getter logic
        return value;
    }
}

export default String100Field;