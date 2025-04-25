import Field from '../../lib/orm/Field.js';

class String50Field extends Field {
    constructor(options = {}) {
        const fixedProperties = {
            uid: '{7c8b9d0a-1e2f-3g4h-5i6j-7k8l9m0n1o2p}',
            type: 'varchar',
            length: 50,
        };

        const allowedOverrides = {
            required: options.required,
            default: options.default,
            caption: options.caption,
        };

        const documentation = {
            description: 'String field with 50 character limit',
            examples: ['"Medium length name"', '"Brief description"', '"Short title with additional context"'],
            usage: 'Use for medium-length text like brief descriptions, titles, or identifiers'
        };

        super({ ...fixedProperties, ...allowedOverrides, documentation }, 'String50Field');
    }

    onSet(value) {
        // Custom setter logic
        if (typeof value === 'string') {
            value = value.trim();
            // Truncate if exceeds length
            if (value.length > 50) {
                value = value.substring(0, 50);
            }
        }
        return value;
    }

    onGet(value) {
        // Custom getter logic
        return value;
    }
}

export default String50Field;