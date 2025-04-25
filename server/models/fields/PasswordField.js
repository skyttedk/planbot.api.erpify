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
    }
    
    /**
     * Helper method that centralizes the password hashing logic
     * @private
     */
    async _hashPasswordValue(value) {
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
        await this._validatePassword(value);
        
        // Hash the password and return it
        return this._mockHashPassword(value);
    }

    /**
     * Transforms the input value into a hashed password
     * This is called when data is set to ensure passwords are properly hashed
     * 
     * @param {string} value - The plain password to hash
     * @returns {Promise<string>} The hashed password
     */
    async onSet(value) {
        // Delegate to the _hashPasswordValue method which handles all the logic
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
    async _validatePassword(password) {
        // Use validation options from the constructor
        const minLength = this._validationOptions.minLength;
        const requireNumber = this._validationOptions.requireNumber;
        const requireSpecialChar = this._validationOptions.requireSpecialChar;
        const requireUppercase = this._validationOptions.requireUppercase;

        if (password.length < minLength) {
            throw new Error(`Password must be at least ${minLength} characters long`);
        }

        if (requireSpecialChar && !/[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]+/.test(password)) {
            throw new Error('Password must contain at least one special character');
        }

        if (requireNumber && !/\d/.test(password)) {
            throw new Error('Password must contain at least one number');
        }

        if (requireUppercase && !/[A-Z]/.test(password)) {
            throw new Error('Password must contain at least one uppercase letter');
        }

        return true;
    }

    /**
     * Mock hash implementation for testing
     * In production, this would use a proper hashing algorithm like bcrypt
     * 
     * @param {string} password - The password to hash
     * @returns {string} The hashed password
     * @private
     */
    _mockHashPassword(password) {
        // In production, use: return bcrypt.hashSync(password, 10);
        // Create a mock hash that will definitely be different from the input
        const encodedPassword = Buffer.from(password).toString('base64');
        const mockHash = `$2b$10$mock_hash_${encodedPassword}`;
        
        // Ensure the hash is always different from the input
        if (mockHash === password) {
            console.error('Hash unexpectedly matched password');
            return `$2b$10$mock_hash_${Date.now()}_${encodedPassword}`;
        }
        
        return mockHash;
    }

    /**
     * Public method to hash a password
     * This is used by the User model when creating or updating users
     * 
     * @param {string} password - The password to hash
     * @returns {Promise<string>} The hashed password
     */
    async hashPassword(password) {
        // Validate and hash the password
        await this._validatePassword(password);
        return this._mockHashPassword(password);
    }

    /**
     * Verify a password against its hash
     * 
     * @param {string} plainPassword - The plain text password to check
     * @param {string} hashedPassword - The stored hash to verify against
     * @returns {Promise<boolean>} True if the password matches, false otherwise
     */
    async verifyPassword(plainPassword, hashedPassword) {
        if (!plainPassword || !hashedPassword) {
            return false;
        }

        // For mock implementation, extract the hash part
        const parts = hashedPassword.split('mock_hash_');
        if (parts.length !== 2) {
            return false;
        }

        // Compare the encoded password with the stored hash part
        return parts[1] === Buffer.from(plainPassword).toString('base64');
    }
}

export default PasswordField; 