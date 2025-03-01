import Model from '../lib/orm/Model.js';
import fields from './fields/index.js'; // Import field definitions
import logger from '../lib/logger.js';


class Log extends Model {
    static tableName = 'logs';

    static fields = {
        path: new fields.PathField(),
        data: new fields.JsonField(),
    };

    static indexes = [
    ];

    // Create Hooks
    static async onBeforeCreate(data) {
        logger.model('beforeCreate', 'Log', data);
        if (typeof data.name === 'string') {
            data.name = data.name.trim();
        }
        return data;
    }

    static async onAfterCreate(record) {
        logger.model('afterCreate', 'Log', record);

        // Add a log entry
        

        return record;
    }

    // Update Hooks
    static async onBeforeUpdate(data) {
        logger.model('beforeUpdate', 'Log', data);
        if (data.name && typeof data.name === 'string') {
            data.name = data.name.trim();
        }
        return data;
    }

    static async onAfterUpdate(record) {
        logger.model('afterUpdate', 'Log', record);
        return record;
    }

    // Delete Hooks
    static async onBeforeDelete(id) {
        logger.model('beforeDelete', 'Log', { id });
        return id;
    }

    static async onAfterDelete(result) {
        logger.model('afterDelete', 'Log', result);
        return result;
    }
}

export default Log;