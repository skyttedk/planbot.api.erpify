import logger from '../lib/logger.js';
import { asyncLocalStorage } from '../lib/orm/asyncContext.js';
import  pool  from '../config/db.js'


// Import all seeders here
import userSeeder from './userSeeder.js';
import countrySeeder from './countrySeeder.js';

// Collect all seeders in an array
const seeders = [
    userSeeder,
    countrySeeder,
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
    let client;
    try {
        const seederSpinner = logger.spinner('Running database seeders');
        
        // Get array of seeder names for better progress reporting
        let completedCount = 0;
        const totalSeeders = seeders.length;
        
        // Acquire a database client
        client = await pool.connect();
        
        // Start a transaction
        await client.query('BEGIN');
        
        // Execute all seeders within the transaction context
        await asyncLocalStorage.run({ client }, async () => {
            // Execute each seeder in sequence
            for (const seeder of seeders) {
                seederSpinner.text = `Running seeder: ${seeder.name}`;
                
                try {
                    await seeder.run(models, options);
                    completedCount++;
                    seederSpinner.text = `Running database seeders`;
                } catch (error) {
                    logger.error(`Error in seeder ${seeder.name}:`, error);
                    // Instead of continuing, we'll throw to trigger transaction rollback
                    throw error;
                }
            }
        });
        
        // If we got here, all seeders completed successfully, so commit the transaction
        await client.query('COMMIT');
        
        seederSpinner.succeed(`Database seeding completed: ${completedCount}/${totalSeeders} seeders`);
    } catch (err) {
        // Roll back the transaction if there was an error
        if (client) {
            await client.query('ROLLBACK').catch(rollbackErr => {
                logger.error('Error rolling back seeder transaction:', rollbackErr);
            });
        }
        
        logger.error('Failed to run seeders:', err);
        throw err;
    } finally {
        // Release the client back to the pool
        if (client) {
            client.release();
        }
    }
}

export default {
    runSeeders
}; 