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
        name: new fields.NameField({
            required: false,
            caption: 'Full Name'
        }),

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
        isAdmin: new fields.BooleanField({
            caption: 'Administrator',
            default: false,
            trueLabel: 'Admin',
            falseLabel: 'Regular User'
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
        logger.info('User deleted');
        return result;
    }

    /**
     * Update the last login timestamp for a user
     * @param {number|string} userId - The ID of the user to update
     * @returns {Promise<boolean>} Success status
     */
    static async updateLastLogin(userId) {
        try {
            const user = await this.findById(userId);
            if (!user) {
                return false;
            }
            
            user.data.lastLoginDate = new Date();
            await user.save();
            return true;
        } catch (error) {
            logger.error('Error updating last login date:', error);
            return false;
        }
    }
}

export default User; 