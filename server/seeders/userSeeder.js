import logger from '../lib/logger.js';

// Default admin user credentials - these should be changed in production!
const DEFAULT_ADMIN = {
    username: 'admin',
    password: 'Admin@123', // This is a secure password for seeding purposes
    email: 'admin@example.com',
    name: 'System Administrator',
    isAdmin: true,
    isActive: true
};

/**
 * Seed the users table with an admin user if none exists
 * @param {Object} models - Loaded application models
 * @param {Object} options - Seeder options
 * @param {boolean} options.force - Force re-seed even if admin exists
 * @returns {Promise<void>}
 */
async function run(models, options = { force: false }) {
    const { User } = models;
    
    try {
        // Check if admin user already exists
        const existingAdmin = await User.findOne({
            where: { 
                isAdmin: true,
                isActive: true
            }
        });
        
        if (existingAdmin && !options.force) {
            // Silent skip
            return;
        }

        if (existingAdmin && options.force) {
            logger.info('Force option enabled. Creating additional admin user.');
        } else {
            logger.info('No admin users found. Creating default admin user.');
        }

        // Create the admin user
        const adminUser = await User.create(DEFAULT_ADMIN);
        
        logger.info(`Admin user created with ID: ${adminUser.id}`);

        // For security, log a reminder to change the default password
        logger.warn('Default admin user created. Please change the password immediately in production!');
        
    } catch (error) {
        logger.error('Failed to seed admin user:', error);
        throw error;
    }
}

export default {
    name: 'User Seeder',
    run
}; 