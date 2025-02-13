// models/fields/NameField.js
import Field from '../../lib/orm/Field.js';

//A route/path like models/users/fields/NameField

class PathField extends Field {
    constructor(options = {}) {
        // Fixed properties for a name field.
        const fixedProperties = {
            uid: '{7b9d2ec7-4830-402e-afd4-f283b38c91b2}',
            type: 'string',
            length: 1024,
        };

        const allowedOverrides = {
            required: options.required,
            default: options.default,
        };

        // Description or documentation for the field
        const documentation = {
            description: 'Represents a path string used for routing or file locations.',
            examples: ['"/users/profile"', '"/home/index.html"'],
            usage: 'Use this field for storing URL paths or system file paths, ensuring the length does not exceed 1024 characters.'
        };

        super({ ...fixedProperties, ...allowedOverrides });
    }


}

export default PathField;
