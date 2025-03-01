import Field from '../../lib/orm/Field.js';

class String250 extends Field {
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
            description: '<your description here>',
            examples: ['""', '""'],
            usage: '<describe intended usages>'
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

export default String250;