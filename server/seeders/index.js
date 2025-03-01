import logger from '../lib/logger.js';

// Import all seeders here
import userSeeder from './userSeeder.js';

// Collect all seeders in an array
const seeders = [
    userSeeder,
    // Add more seeders here as needed
];

/**
 * Run all database seeders to ensure mandatory data exists
 * @param {Object} models - The loaded application models
 * @param {Object} options - Seeder options
 * @param {boolean} options.force - Force re-seed even if data exists
 * @returns {Promise<void>}
 */
async function runSeeders(models, options = { force: false }) {
    try {
        const seederSpinner = logger.spinner('Running database seeders');
        
        // Get array of seeder names for better progress reporting
        let completedCount = 0;
        const totalSeeders = seeders.length;
        
        // Execute each seeder in sequence
        for (const seeder of seeders) {
            seederSpinner.text = `Running seeder: ${seeder.name}`;
            
            try {
                await seeder.run(models, options);
                completedCount++;
                seederSpinner.text = `Completed ${completedCount}/${totalSeeders} seeders`;
            } catch (error) {
                logger.error(`Error in seeder ${seeder.name}:`, error);
                // Continue with other seeders even if one fails
            }
        }
        
        seederSpinner.succeed(`Database seeding completed: ${completedCount}/${totalSeeders} seeders`);
    } catch (err) {
        logger.error('Failed to run seeders:', err);
        throw err;
    }
}

export default {
    runSeeders
}; 