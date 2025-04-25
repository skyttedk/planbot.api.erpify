import Field from '../../lib/orm/Field.js';

/**
 * A custom field class for storing code values, extending the base Field class.
 * This field enforces a fixed type ('varchar'), a fixed length (10), and ensures values are uppercase.
 *
 * @param {Object} options - Configuration options.
 * @param {boolean} [options.required=false] - Whether the field is required.
 * @param {string} [options.default] - Default value if none is provided.
 * @param {string} [options.caption] - Caption for the field.
 */
class Code10Field extends Field {
    constructor(options = {}) {
        // Fixed properties for a Code10 field.
        const fixedProperties = {
            uid: 'c2d85e7a-f9b4-48e9-9a78-5e7fc3d91b66',
            type: 'varchar',
            length: 10,
            caption: 'Code',
        };

        // Only allow specific properties to be overridden by options.
        const allowedOverrides = {
            required: options.required,
            default: options.default,
            caption: options.caption, // This allows the caption to be overridden.
        };

        // Field documentation provides metadata about the field.
        const documentation = {
            description: 'A 10-character uppercase code field',
            examples: ['ABCDE12345', 'CODE123456'],
            usage: 'Used for fixed-length code identifiers that should always be uppercase',
        };

        // Merge fixed properties and allowed overrides and pass them to the base Field constructor.
        super({ ...fixedProperties, ...allowedOverrides, documentation }, 'Code10Field');
    }

    /**
     * Custom setter logic: transforms the input value to uppercase and ensures 10 character length.
     *
     * @param {any} value - The value to be set.
     * @returns {string} The transformed value.
     */
    onSet(value) {
        if (value === null || value === undefined) {
            return value;
        }
        
        // Convert to string if not already
        let stringValue = String(value);
        
        // Trim and convert to uppercase
        stringValue = stringValue.trim().toUpperCase();
        
        // Pad or truncate to exactly 10 characters
        if (stringValue.length < 10) {
            // Pad with spaces if shorter than 10 characters
            stringValue = stringValue.padEnd(10, ' ');
        } else if (stringValue.length > 10) {
            // Truncate if longer than 10 characters
            stringValue = stringValue.substring(0, 10);
        }
        
        return stringValue;
    }

    /**
     * Custom getter logic: ensures the value is properly formatted when retrieved.
     *
     * @param {any} value - The stored value.
     * @returns {string} The processed value.
     */
    onGet(value) {
        // Ensure value is properly formatted when retrieved
        return value;
    }
}

export default Code10Field; 