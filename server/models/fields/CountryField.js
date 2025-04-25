import Field from '../../lib/orm/Field.js';

/**
 * A field class for establishing a one-to-many relationship with the Country table.
 * This field stores a reference to a country record using an integer ID.
 *
 * @param {Object} options - Configuration options.
 * @param {boolean} [options.required=false] - Whether the field is required.
 * @param {string} [options.default=null] - Default country ID if none is provided.
 */
class CountryField extends Field {
    constructor(options = {}) {
        // Fixed properties for a Country reference field
        const fixedProperties = {
            uid: '{a7e9d312-8f56-4b91-b954-c0e76c3d8e2f}',
            type: 'integer', // Use integer type for the database column
            caption: 'Country',
        };

        // Only allow specific properties to be overridden by options
        const allowedOverrides = {
            required: options.required || false,
            default: options.default || null,
        };

        // Field documentation provides metadata about the field
        const documentation = {
            description: 'Establishes a one-to-many relationship with the Country table',
            examples: ['1', '2'],
            usage: 'Use this field to reference a country from the Country collection',
        };

        super({ 
            ...fixedProperties, 
            ...allowedOverrides, 
            documentation,
            options: {
                dataSource: 'Country',
                displayField: 'name',
                valueField: 'id',
                required: options.required || false,
                fieldType: 'lookup', // This is for UI/application layer, not database
                validation: {
                    message: 'Please select a valid country'
                }
            }
        });
    }
    
    // Get default value (no default country)
    getDefaultValue() {
        return null;
    }

    /**
     * Custom setter logic to validate the country ID
     *
     * @param {any} value - The value to validate and transform.
     * @returns {any} The validated value.
     */
    onSet(value) {
        if (value === null || value === undefined) {
            if (this.required) {
                throw new Error(`${this.fieldName} is required.`);
            }
            return value;
        }
        
        // Check if it's a valid integer
        const intValue = parseInt(value, 10);
        if (isNaN(intValue) || intValue.toString() !== value.toString()) {
            throw new Error(`${this.fieldName} must be a valid integer ID.`);
        }
        
        return intValue;
    }
    
    /**
     * Custom getter logic
     *
     * @param {any} value - The stored value.
     * @returns {any} The processed value.
     */
    onGet(value) {
        return value;
    }
}

export default CountryField; 