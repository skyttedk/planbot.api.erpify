import Model from '../lib/orm/Model.js';
import fields from './fields/index.js'; // Import field definitions


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
        console.log('onBeforeCreate: validating and transforming Log data:', data);
        if (typeof data.name === 'string') {
            data.name = data.name.trim();
        }
        return data;
    }

    static async onAfterCreate(record) {
        console.log('onAfterCreate: Log record created:', record);

        // Add a log entry
        

        return record;
    }

    // Update Hooks
    static async onBeforeUpdate(data) {
        console.log('onBeforeUpdate: validating and transforming update data:', data);
        if (data.name && typeof data.name === 'string') {
            data.name = data.name.trim();
        }
        return data;
    }

    static async onAfterUpdate(record) {
        console.log('onAfterUpdate: Log record updated:', record);
        return record;
    }

    // Delete Hooks
    static async onBeforeDelete(id) {
        console.log('onBeforeDelete: about to delete Log with id:', id);
        return id;
    }

    static async onAfterDelete(result) {
        console.log('onAfterDelete: Log deletion result:', result);
        return result;
    }
}

export default Log;