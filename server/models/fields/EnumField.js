import Field from '../../lib/orm/Field.js';

/**
 * A specialized field class for storing enumerated values.
 * This field enforces that values must be one of the provided options.
 * 
 * @param {Object} options - Configuration options.
 * @param {boolean} [options.required=false] - Whether the field is required.
 * @param {string} [options.default] - Default value if none is provided.
 * @param {string} [options.caption='Enum'] - Caption for the field.
 * @param {Array<string>} [options.options=[]] - Array of valid enum options.
 * @param {boolean} [options.caseSensitive=false] - Whether enum values are case sensitive.
 */
class EnumField extends Field {
    constructor(options = {}) {
        // Fixed properties for an enum field.
        const fixedProperties = {
            uid: '7e3a9f82-5c8e-4d2c-b6a0-3e4c8e3b7f2d',
            // Use varchar instead of enum for database compatibility
            type: 'varchar',
            // Set a length for the varchar field
            length: 255,
            caption: options.caption || 'Enum',
        };

        // Default value processing - ensure it's properly quoted if it's a string
        let processedDefault = options.default;
        if (typeof processedDefault === 'string') {
            // Store default directly, the ORM will handle quoting
            processedDefault = options.default;
        }

        // Only allow specific properties to be overridden by options.
        const allowedOverrides = {
            required: options.required,
            default: processedDefault,
            caption: options.caption,
        };

        // Field documentation provides metadata about the field.
        const documentation = {
            description: 'Stores values from a predefined set of options',
            examples: ['option1', 'option2', 'option3'],
            usage: 'Use for fields with a fixed set of possible values',
        };

        // Merge fixed properties and allowed overrides and pass them to the base Field constructor.
        super({ ...fixedProperties, ...allowedOverrides, documentation });
        
        // Store enum options - MUST BE AFTER super() call
        this._options = Array.isArray(options.options) ? options.options : [];
        // Default to case-insensitive unless explicitly set to true
        this._caseSensitive = options.caseSensitive === true;
        
        // Store original options for reference
        this._originalOptions = options;
        
        // Validate default value against options if provided
        if (options.default !== undefined && this._options.length > 0) {
            const isValidDefault = this._validateAgainstOptions(options.default);
            if (!isValidDefault) {
                throw new Error(`Default value "${options.default}" is not in the provided options list`);
            }
        }
    }

    /**
     * Validates and normalizes the input value against the defined options.
     *
     * @param {any} value - The value to be set.
     * @returns {string|null} The validated value or null.
     */
    onSet(value) {
        console.log(`EnumField.onSet called with value: ${JSON.stringify(value)}`);
        console.log(`Available options: ${JSON.stringify(this._options)}`);
        
        if (value === null || value === undefined || value === '') {
            console.log(`Returning null for empty value`);
            return null;
        }

        // Convert to string for comparison
        const stringValue = String(value);
        
        // Validate against options
        if (this._options.length > 0) {
            // Find the matching option (case insensitive if configured)
            let matchedOption;
            if (this._caseSensitive) {
                matchedOption = this._options.includes(stringValue) ? stringValue : null;
            } else {
                const lowerValue = stringValue.toLowerCase();
                matchedOption = this._options.find(option => 
                    String(option).toLowerCase() === lowerValue
                );
            }
            
            if (!matchedOption) {
                console.log(`Validation failed for value: ${stringValue}`);
                throw new Error(`Value "${stringValue}" is not in the allowed options: ${this._options.join(', ')}`);
            }
            
            // Return the matched option with correct case from the options list
            console.log(`Returning normalized value: ${matchedOption}`);
            return matchedOption;
        }
        
        // If no options defined, just return the value as is
        return stringValue;
    }

    /**
     * Returns the stored enum value.
     *
     * @param {string} value - The stored enum value.
     * @returns {string} The enum value.
     */
    onGet(value) {
        return value;
    }

    /**
     * Validates a value against the defined options.
     * 
     * @private
     * @param {string} value - The value to validate.
     * @returns {boolean} Whether the value is valid.
     */
    _validateAgainstOptions(value) {
        if (this._options.length === 0) {
            return true; // No options defined, so any value is valid
        }
        
        // Handle null, undefined, and empty strings
        if (value === null || value === undefined || value === '') {
            return false; // These values are handled by onSet, not valid options here
        }
        
        // Use case sensitive or insensitive comparison as configured
        if (this._caseSensitive) {
            return this._options.includes(value);
        } else {
            const lowerValue = String(value).toLowerCase();
            const foundOption = this._options.find(option => 
                String(option).toLowerCase() === lowerValue
            );
            
            console.log(`Case-insensitive validation: ${lowerValue} against options, found: ${foundOption}`);
            return foundOption !== undefined;
        }
    }

    /**
     * Gets the list of valid options for this enum field.
     * 
     * @returns {Array<string>} The list of valid options.
     */
    getOptions() {
        return [...this._options]; // Return a copy to prevent modification
    }
}

export default EnumField; 