import Model from '../lib/orm/Model.js';
import logger from '../lib/logger.js';
import fields from './fields/index.js';

/**
 * Model class for User.
 * Handles user authentication and management.
 */
class User extends Model {
    // The database table name for the model.
    static tableName = 'users';

    // Field definitions using domain-specific field templates.
    static fields = {
        username: new fields.String250({ 
            required: true,
            caption: 'Username'
        }),
        password: new fields.PasswordField({ 
            required: true,
            caption: 'Password'
        }),
        email: new fields.Email({
            required: true,
            caption: 'Email Address'
        }),
        lastLoginDate: new fields.Field({
            type: 'timestamp',
            caption: 'Last Login Date',
            default: null
        }),
        isActive: new fields.Field({
            type: 'boolean',
            caption: 'Is Active',
            default: true
        })
    };

    // Define indexes for performance and uniqueness.
    static indexes = [
        { name: 'idx_username', columns: ['username'], unique: true },
        { name: 'idx_email', columns: ['email'], unique: true }
    ];

    // --------------------------
    // Hooks
    // --------------------------

    /**
     * Hook executed before creating a new user.
     * @param {Object} user - The user data.
     * @returns {Object} The processed user data.
     */
    static async onBeforeCreate(user) {
        logger.info(`Creating new user: ${user.username}`);
        return user;
    }

    /**
     * Hook executed after a new user is created.
     * @param {Object} user - The created user data.
     */
    static async onAfterCreate(user) {
        logger.info(`User created: ${user.username}`);
    }

    /**
     * Hook executed before updating an existing user.
     * @param {Object} user - The user data to update.
     * @returns {Object} The processed user data.
     */
    static async onBeforeUpdate(user) {
        logger.info(`Updating user: ${user.username}`);
        return user;
    }

    /**
     * Hook executed after a user is updated.
     * @param {Object} user - The updated user data.
     */
    static async onAfterUpdate(user) {
        logger.info(`User updated: ${user.username}`);
    }

    /**
     * Hook executed before deleting a user.
     * @param {any} id - The identifier of the user to delete.
     */
    static async onBeforeDelete(id) {
        logger.info(`Deleting user with ID: ${id}`);
    }

    /**
     * Hook executed after a user is deleted.
     * @param {Object} result - The result of the deletion operation.
     */
    static async onAfterDelete(result) {
        logger.info(`User deleted`);
    }

    /**
     * Updates the last login date for a user
     * @param {string|number} userId - The ID of the user
     * @returns {Promise<Object>} The updated user record
     */
    static async updateLastLogin(userId) {
        const user = await this.findById(userId);
        if (!user) {
            throw new Error(`User with ID ${userId} not found`);
        }

        user.lastLoginDate = new Date();
        return await this.update(userId, user);
    }

    /**
     * Authenticates a user with username and password
     * @param {string} username - The username to authenticate
     * @param {string} password - The password to verify
     * @returns {Promise<Object|null>} The authenticated user or null if authentication fails
     */
    static async authenticate(username, password) {
        try {
            // Find the user by username
            const user = await this.findOne({ where: { username } });
            if (!user) {
                return null;
            }

            // In a real implementation, you would use a password field method to verify
            // This should be handled by the PasswordField implementation
            const passwordField = this.fields.password;
            
            // Get the raw hashed password from the database
            // Note: This assumes we have a way to get the raw value,
            // bypassing the onGet masking in PasswordField
            const hashedPassword = await this.getRawFieldValue(user.id, 'password');
            
            if (passwordField.verifyPassword(password, hashedPassword)) {
                // Update the last login date
                await this.updateLastLogin(user.id);
                return user;
            }
            
            return null;
        } catch (error) {
            logger.error('Authentication error:', error);
            return null;
        }
    }

    /**
     * Helper method to get raw field value from database
     * This bypasses the field's onGet transformation
     * @param {number|string} id - Record ID
     * @param {string} fieldName - Field name to retrieve
     * @returns {Promise<any>} Raw field value
     */
    static async getRawFieldValue(id, fieldName) {
        // Implementation would depend on your database access layer
        // This is a placeholder for the concept
        const query = `SELECT ${fieldName} FROM ${this.tableName} WHERE id = ?`;
        const result = await this.db.raw(query, [id]);
        return result[0]?.[fieldName];
    }
}

export default User; 