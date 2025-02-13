import Model from '../lib/orm/Model.js';
import fields from './fields/index.js'; // Import field definitions

class Buffer extends Model {
    static tableName = 'buffers';

    static fields = {
        name: new fields.NameField(),
        age: new fields.AgeField(),
        phone: new fields.PhoneField(),
        zip: new fields.ZipField(),
    };

    static indexes = [
        { name: 'buffer_name_idx', columns: ['name'], unique: true },
    ];

    // Create Hooks
    static async onBeforeCreate(data) {
        console.log('onBeforeCreate: validating and transforming Buffer data:', data);
        if (typeof data.name === 'string') {
            data.name = data.name.trim();
        }
        return data;
    }

    static async onAfterCreate(record) {
        console.log('onAfterCreate: Buffer record created:', record);
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
        console.log('onAfterUpdate: Buffer record updated:', record);
        return record;
    }

    // Delete Hooks
    static async onBeforeDelete(id) {
        console.log('onBeforeDelete: about to delete Buffer with id:', id);
        return id;
    }

    static async onAfterDelete(result) {
        console.log('onAfterDelete: Buffer deletion result:', result);
        return result;
    }
}

export default Buffer;