import Field from '../../lib/orm/Field.js';

/**
 * A custom field class for storing file paths, extending the base Field class.
 * This field enforces a fixed type ('varchar') and length (255), with optional
 * overrides for 'required' and 'default'.
 *
 * @param {Object} options - Configuration options.
 * @param {boolean} [options.required=false] - Whether the field is required.
 * @param {string} [options.default] - Default value if none is provided.
 */
class PathField extends Field {
    constructor(options = {}) {
        const fixedProperties = {
            uid: 'c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f', // Unique GUID for PathField
            type: 'varchar',
            length: 255,
        };

        const allowedOverrides = {
            required: options.required,
            default: options.default,
        };

        const documentation = {
            description: 'Path Field',
            examples: ['"/documents/file.txt"'],
            usage: 'File or directory path',
        };

        // Merge fixed properties and allowed overrides, set field name to 'Path'
        super({ ...fixedProperties, ...allowedOverrides }, 'Path');
    }

    /**
     * Custom setter logic: trims the string value if provided.
     *
     * @param {any} value - The value to transform.
     * @returns {any} The transformed value.
     */
    onSet(value) {
        if (typeof value === 'string') {
            return value.trim();
        }
        return value;
    }

    /**
     * Custom getter logic: currently a no-op, but can be extended.
     *
     * @param {any} value - The value to transform.
     * @returns {any} The transformed value.
     */
    onGet(value) {
        return value;
    }
}

export default PathField;