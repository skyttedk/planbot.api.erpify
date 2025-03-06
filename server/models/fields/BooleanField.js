import Field from '../../lib/orm/Field.js';

/**
 * A specialized field class for storing boolean values.
 * This field enforces a boolean type and provides type conversion for input values.
 * 
 * @param {Object} options - Configuration options.
 * @param {boolean} [options.required=false] - Whether the field is required.
 * @param {boolean} [options.default=false] - Default value if none is provided.
 * @param {string} [options.caption='Boolean'] - Caption for the field.
 * @param {string} [options.trueLabel='Yes'] - Label to display for true values.
 * @param {string} [options.falseLabel='No'] - Label to display for false values.
 */
class BooleanField extends Field {
    constructor(options = {}) {
        // Fixed properties for a boolean field.
        const fixedProperties = {
            uid: '5f7a9d82-6b8e-4e2c-a6a0-5d4c8e3b7f1d',
            type: 'boolean',
            caption: options.caption || 'Boolean',
        };

        // Only allow specific properties to be overridden by options.
        const allowedOverrides = {
            required: options.required,
            default: options.default !== undefined ? options.default : false,
            caption: options.caption,
        };

        // Field documentation provides metadata about the field.
        const documentation = {
            description: 'Stores boolean (true/false) values with proper type conversion',
            examples: ['true', 'false', '1', '0', 'yes', 'no'],
            usage: 'Use for any true/false, yes/no, or flag values',
        };

        // Merge fixed properties and allowed overrides and pass them to the base Field constructor.
        super({ ...fixedProperties, ...allowedOverrides, documentation });
        
        // Store display labels - MUST BE AFTER super() call
        this._trueLabel = options.trueLabel || 'Yes';
        this._falseLabel = options.falseLabel || 'No';
    }

    /**
     * Converts various input values to proper boolean values.
     *
     * @param {any} value - The value to be set.
     * @returns {boolean|null} The converted boolean value or null.
     */
    onSet(value) {
        if (value === null || value === undefined) {
            return null;
        }

        // Handle different types of input
        if (typeof value === 'boolean') {
            return value;
        }
        
        if (typeof value === 'number') {
            return value !== 0;
        }
        
        if (typeof value === 'string') {
            const lowerValue = value.toLowerCase().trim();
            if (['true', 't', 'yes', 'y', '1', 'on'].includes(lowerValue)) {
                return true;
            }
            if (['false', 'f', 'no', 'n', '0', 'off'].includes(lowerValue)) {
                return false;
            }
        }
        
        // If conversion isn't clear, default to false
        return Boolean(value);
    }

    /**
     * Formats the boolean value for display when retrieved.
     * Now returns just the boolean value for easier integration.
     *
     * @param {boolean} value - The stored boolean value.
     * @returns {boolean} The boolean value.
     */
    onGet(value) {
        // Simply return the boolean value
        return value === true;
    }

    /**
     * Gets rich display information for the boolean value.
     * This method can be called when display formatting is needed.
     * 
     * @param {boolean} value - The boolean value to format.
     * @returns {Object} An object containing value, display text, and raw value.
     */
    getDisplayInfo(value) {
        return {
            value: value === true,
            display: value === true ? this._trueLabel : this._falseLabel,
            raw: value
        };
    }
}

export default BooleanField; 