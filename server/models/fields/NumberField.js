import Field from '../../lib/orm/Field.js';

/**
 * A field for storing reference numbers (like invoice numbers, order numbers, etc.)
 */
class NumberField extends Field {
    constructor(options = {}) {
        const fixedProperties = {
            uid: '{12345678-9abc-def0-1234-56789abcdef0}',
            type: 'varchar',
            length: 50,
            caption: options.caption || 'Number',
        };

        const allowedOverrides = {
            required: options.required,
            default: options.default,
            pattern: options.pattern,
        };

        const documentation = {
            description: 'Number/Reference Field',
            examples: ['"INV-12345"', '"ORD-2023-001"', '"REF-ABC-123"'],
            usage: 'Used for storing reference numbers or identifiers'
        };

        super({ ...fixedProperties, ...allowedOverrides, documentation }, 'Number');
        
        // Default pattern if none provided
        this._pattern = options.pattern || /^[A-Za-z0-9\-\/]+$/;
    }

    onSet(value) {
        if (typeof value === 'string') {
            value = value.trim();
            
            // Validate against pattern if specified
            if (value && this._pattern && !this._pattern.test(value)) {
                throw new Error(`Value "${value}" does not match the required pattern for reference numbers`);
            }
        }
        return value;
    }

    onGet(value) {
        return value;
    }
}

export default NumberField;