// models/Country.js
import Model from '../lib/orm/Model.js';
import Log from './Log.js';
import fields from './fields/index.js';
import logger from '../lib/logger.js';

/**
 * Model class for Country.
 * Represents countries with their code, name, and other relevant information.
 */
class Country extends Model {
    // The database table name for the model.
    static tableName = 'countries';

    // Field definitions using domain-specific field templates.
    static fields = {
        code: new fields.Code10({ required: true, caption: 'Country Code' }),
        name: new fields.NameField({ required: true, caption: 'Country Name' }),
    };

    // Define indexes for performance and uniqueness.
    static indexes = [
        { name: 'idx_country_code', columns: ['code'], unique: true },
        { name: 'idx_country_name', columns: ['name'], unique: true }
    ];

    // --------------------------
    // Hooks
    // --------------------------

    /**
     * Hook executed before creating a new country record.
     * @param {Object} country - The country data.
     * @returns {Object} The processed country data.
     */
    static async onBeforeCreate(country) {

        return country;
    }

    /**
     * Hook executed after a new country record is created.
     * @param {Object} country - The created country data.
     */
    static async onAfterCreate(country) {
    }

    /**
     * Hook executed before updating an existing country record.
     * @param {Object} country - The country data to update.
     * @returns {Object} The processed country data.
     */
    static async onBeforeUpdate(country) {
        return country;
    }

    /**
     * Hook executed after a country record is updated.
     * @param {Object} country - The updated country data.
     */
    static async onAfterUpdate(country) {
        // Add a log entry for the update
    }

    /**
     * Hook executed before deleting a country record.
     * @param {any} id - The identifier of the country record to delete.
     */
    static async onBeforeDelete(id) {
    }

    /**
     * Hook executed after a country record is deleted.
     * @param {Object} result - The result of the deletion operation.
     */
    static async onAfterDelete(result) {
    }
}

export default Country; 