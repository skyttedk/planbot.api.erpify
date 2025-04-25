import Field from '../../lib/orm/Field.js';

class CurrencyField extends Field {
    constructor(options = {}) {
        const fixedProperties = {
            uid: '{47d8f2e0-6b3d-4c82-9a1f-c0e2a42d5e91}',
            type: 'decimal',
            precision: 10, // Total digits
            scale: 2,      // Decimal places
        };

        // Only allow `required` and `default` to be overridden.
        const allowedOverrides = {
            required: options.required,
            default: options.default,
        };
        
        // Store currency code after super()

        const documentation = {
            description: 'Currency Field',
            examples: ['19.99', '1250.00', '0.50'],
            usage: 'Used for storing monetary values with currency information'
        };

        super({ ...fixedProperties, ...allowedOverrides, documentation });
        
        // Store currency setting - AFTER super() call
        this._currency = options.currency || 'USD'; // Default currency is USD
    }

    onSet(value) {
        // Custom setter logic
        if (typeof value === 'string') {
            // Remove currency symbols and commas
            value = value.replace(/[$,€£¥]/g, '').trim();
            // Convert to a number
            value = parseFloat(value);
        }
        
        // Round to 2 decimal places
        if (typeof value === 'number' && !isNaN(value)) {
            return Math.round(value * 100) / 100;
        }
        
        return value;
    }

    onGet(value) {
        // Custom getter logic
        if (value !== null && value !== undefined) {
            const currency = this._currency || 'USD';
            // Format the number as currency
            return {
                value: parseFloat(value),
                formatted: this.formatCurrency(value, currency)
            };
        }
        return value;
    }

    formatCurrency(value, currency) {
        const formatter = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
        });
        return formatter.format(value);
    }
}

export default CurrencyField; 