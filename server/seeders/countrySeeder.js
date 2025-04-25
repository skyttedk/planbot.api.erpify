import logger from '../lib/logger.js';

// List of countries to seed
const COUNTRIES = [
    { code: 'US', name: 'United States' },
    { code: 'CA', name: 'Canada' },
    { code: 'MX', name: 'Mexico' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'FR', name: 'France' },
    { code: 'DE', name: 'Germany' },
    { code: 'IT', name: 'Italy' },
    { code: 'ES', name: 'Spain' },
    { code: 'JP', name: 'Japan' },
    { code: 'CN', name: 'China' },
    { code: 'IN', name: 'India' },
    { code: 'BR', name: 'Brazil' },
    { code: 'AU', name: 'Australia' },
    { code: 'RU', name: 'Russia' },
    { code: 'ZA', name: 'South Africa' },
    // Add more countries as needed
];

/**
 * Seed the countries table with initial country data
 * @param {Object} models - Loaded application models
 * @param {Object} options - Seeder options
 * @param {boolean} options.force - Force re-seed even if countries exist
 * @returns {Promise<void>}
 */
async function run(models, options = { force: false }) {
    const { Country } = models;

    try {
        // Check if countries already exist
        const existingCountries = await Country.findAll();

        if (existingCountries.length > 0 && !options.force) {
            // Silent skip
            return;
        }

        if (existingCountries.length > 0 && options.force) {
            logger.info('Force option enabled. Recreating country data.');
            // In a real application, you might want to delete existing countries first
        } else {
            logger.info('No countries found. Creating initial country data.');
        }

        // Create countries
        let createdCount = 0;
        for (const countryData of COUNTRIES) {
            try {
                // Check if this specific country already exists
                const existingCountry = await Country.findOne({
                    where: { code: countryData.code }
                });

                if (existingCountry && !options.force) {
                    logger.debug(`Country ${countryData.code} already exists, skipping`);
                    continue;
                }

                if (existingCountry && options.force) {
                    // Update existing country
                    await Country.update(existingCountry.id, countryData);
                    logger.debug(`Updated country: ${countryData.name}`);
                } else {
                    // Create new country
                    const country = await Country.create(countryData);
                    logger.debug(`Created country: ${country.name} with ID: ${country.id}`);
                }

                createdCount++;
            } catch (error) {
                logger.error(`Failed to create/update country ${countryData.code}:`, error);
                // Continue with other countries instead of failing the entire seeder
            }
        }

        logger.info(`Created/updated ${createdCount} countries`);

    } catch (error) {
        logger.error('Failed to seed countries:', error);
        throw error;
    }
}

export default {
    name: 'Country Seeder',
    run
}; 