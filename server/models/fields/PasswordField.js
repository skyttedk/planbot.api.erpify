import Field from '../../lib/orm/Field.js';

/**
 * A specialized field class for securely storing and handling password data.
 * This field enforces password security practices and handles hashing.
 * 
 * @param {Object} options - Configuration options.
 * @param {boolean} [options.required=false] - Whether the field is required.
 * @param {string} [options.default] - Default value if none is provided.
 * @param {boolean} [options.minLength=8] - Minimum password length.
 * @param {boolean} [options.requireSpecialChar=true] - Whether to require at least one special character.
 * @param {boolean} [options.requireNumber=true] - Whether to require at least one number.
 * @param {boolean} [options.requireUppercase=true] - Whether to require at least one uppercase letter.
 */
class PasswordField extends Field {
    constructor(options = {}) {
        // Fixed properties for a password field.
        const fixedProperties = {
            uid: '7ec3d8a1-5c9f-4e8b-9a7d-68c09b64f1d3',
            type: 'varchar',
            length: 255, // Sufficient length for bcrypt hashes
            caption: 'Password',
        };

        // Only allow specific properties to be overridden by options.
        const allowedOverrides = {
            required: options.required,
            default: options.default,
            caption: options.caption,
        };

        // Field documentation provides metadata about the field.
        const documentation = {
            description: 'Securely stores password values with proper hashing and validation',
            examples: ['********'],
            usage: 'Use for any user password or credential that needs to be securely stored',
        };

        // Merge fixed properties and allowed overrides and pass them to the base Field constructor.
        super({ ...fixedProperties, ...allowedOverrides, documentation });
        
        // Store password validation options - MOVED AFTER super() call
        this._validationOptions = {
            minLength: options.minLength ?? 8,
            requireSpecialChar: options.requireSpecialChar ?? true,
            requireNumber: options.requireNumber ?? true,
            requireUppercase: options.requireUppercase ?? true,
        };

        // IMPORTANT: Override the onSet method at the instance level
        // This ensures the method is always available when the field is stored in the schema
        this.onSet = (value) => {
            return this._hashPasswordValue(value);
        };
    }
    
    /**
     * Helper method that centralizes the password hashing logic
     * @private
     */
    _hashPasswordValue(value) {
        if (value === null || value === undefined) {
            return value;
        }

        if (typeof value !== 'string') {
            throw new Error('Password must be a string');
        }

        // Skip validation if the value looks like it's already hashed
        if (value.length >= 40 && /[$./]/.test(value)) {
            return value;
        }

        // Perform validation
        this._validatePassword(value);

        // Hash the password
        return this._mockHashPassword(value);
    }

    /**
     * This method is defined for backward compatibility
     * but all actual implementation is in _hashPasswordValue
     */
    onSet(value) {
        return this._hashPasswordValue(value);
    }

    /**
     * Custom getter logic: never returns the actual password.
     *
     * @param {string} value - The stored (hashed) password.
     * @returns {string} Masked password value.
     */
    onGet(value) {
        // Never return the actual password/hash, return a masked version
        return value ? '********' : '';
    }

    /**
     * Validates a password against the configured requirements.
     * 
     * @param {string} password - The password to validate.
     * @throws {Error} If the password doesn't meet requirements.
     */
    _validatePassword(password) {
        const { minLength, requireSpecialChar, requireNumber, requireUppercase } = this._validationOptions;
        
        if (password.length < minLength) {
            throw new Error(`Password must be at least ${minLength} characters long`);
        }
        
        if (requireSpecialChar && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(password)) {
            throw new Error('Password must contain at least one special character');
        }
        
        if (requireNumber && !/\d/.test(password)) {
            throw new Error('Password must contain at least one number');
        }
        
        if (requireUppercase && !/[A-Z]/.test(password)) {
            throw new Error('Password must contain at least one uppercase letter');
        }
    }

    /**
     * Mock password hashing function - DO NOT USE IN PRODUCTION
     * In a real application, use a proper library like bcrypt or argon2
     * 
     * @param {string} password - The password to hash.
     * @returns {string} A mock hash.
     */
    _mockHashPassword(password) {
        // This is just a placeholder to demonstrate the concept
        // In production, use: return bcrypt.hashSync(password, 10);
        return `$2b$10$mock_hash_${Buffer.from(password).toString('base64')}`;
    }

    /**
     * Verify a password against its hash
     * 
     * @param {string} plainPassword - The plain text password to check
     * @param {string} hashedPassword - The stored hash to verify against
     * @returns {boolean} True if password matches
     */
    verifyPassword(plainPassword, hashedPassword) {
        // In a real implementation, you would use bcrypt.compareSync
        // This is a mock implementation - DO NOT USE IN PRODUCTION
        const mockPart = hashedPassword.split('_hash_')[1];
        return mockPart === Buffer.from(plainPassword).toString('base64');
    }
}

export default PasswordField; 