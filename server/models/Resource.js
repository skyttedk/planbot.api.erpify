// models/Resource.js
import Model from '../lib/orm/Model.js';
import logger from '../lib/logger.js';
import fields from './fields/index.js';

/**
 * Model class for Resources.
 * Manages resource records that can be of different types (person, company, service, etc.)
 * with common properties like name, email, phone number, etc.
 */
class Resource extends Model {
    // The database table name for the model.
    static tableName = 'resources';

    // Field definitions using domain-specific field templates.
    static fields = {
        // Resource type (person, company, service, system, etc.)
        type: new fields.EnumField({ 
            required: true,
            default: 'person',
            options: ['person', 'company', 'service', 'system'],
            caption: 'Resource Type'
        }),
        
        // Primary name of the resource
        name: new fields.NameField({ 
            required: true 
        }),
        
        // Title or prefix (Mr., Mrs., Dr., etc.)
        title: new fields.String20({ caption: 'Title' }),
        
        // Reference number or identifier
        number: new fields.NumberField(),
        
        // Email address
        email: new fields.Email(),
        
        // Phone number
        phone: new fields.PhoneField()
    };

    // Define indexes for performance and uniqueness.
    static indexes = [
        { name: 'idx_resource_type', columns: ['type'], unique: false },
        { name: 'idx_resource_name', columns: ['name'], unique: false },
        { name: 'idx_resource_email', columns: ['email'], unique: false }
    ];

    // --------------------------
    // Hooks
    // --------------------------

    /**
     * Hook executed before creating a new record.
     * @param {Object} resource - The record data.
     * @returns {Object} The processed record data.
     */
    static async onBeforeCreate(resource) {
        logger.info(`Creating ${resource.type} resource: ${resource.name}`);
        return resource;
    }

    /**
     * Hook executed after a new record is created.
     * @param {Object} resource - The created record data.
     */
    static async onAfterCreate(resource) {
        logger.info(`Resource created: ${resource.name} (${resource.id})`);
    }

    /**
     * Hook executed before updating an existing record.
     * @param {Object} resource - The record data to update.
     * @returns {Object} The processed record data.
     */
    static async onBeforeUpdate(resource) {
        logger.info(`Updating resource: ${resource.name}`);
        return resource;
    }

    /**
     * Hook executed after a record is updated.
     * @param {Object} resource - The updated record data.
     */
    static async onAfterUpdate(resource) {
        logger.info(`Resource updated: ${resource.name} (${resource.id})`);
    }

    /**
     * Hook executed before deleting a record.
     * @param {any} id - The identifier of the record to delete.
     */
    static async onBeforeDelete(id) {
        logger.info(`Deleting resource with ID: ${id}`);
    }

    /**
     * Hook executed after a record is deleted.
     * @param {Object} result - The result of the deletion operation.
     */
    static async onAfterDelete(result) {
        logger.info(`Resource deleted successfully`);
    }
}

export default Resource;