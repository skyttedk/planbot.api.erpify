// models/Customer.js
import Model from '../lib/orm/Model.js';

import Log from './Log.js'; // Corrected import path

//import models from './Log.js';
//import modelLoader from '../../server/models/index.js';
//const models = await modelLoader.init();

import fields from './fields/index.js'; // Corrected import path

class Customer extends Model {
    static tableName = 'customers';

    // Use the domain‑specific field templates; you can override only `required` and `default`
    static fields = {
        name: new fields.NameField(),
        age: new fields.AgeField(),
        phone: new fields.PhoneField(),
        zip: new fields.ZipField(),
    };

    // Optionally add renameMap, indexes, etc.

    static indexes = [
        { name: 'idx_name', columns: ['name'], unique: true }, // Unique index on name
        { name: 'idx_zip', columns: ['zip'], unique: false }, // Non-unique index on zip
    ];

    // --------------------------
    // Hooks
    // --------------------------

    static async onBeforeCreate(record) {
        console.log('Before creating customer:', record);
        return record;
    }

    static async onAfterCreate(record) {
        console.log('Customer created:', record);

        // Add a log entry
        //let a = models
        await Log.create({ path: '/customers', data: record });

        throw new Error('Test error'); // Test error handling

    }

    static async onBeforeUpdate(record) {
        console.log('Before updating customer:', record);
        //record.age += 1; // Increment age

        this.fields.age.validate(1); // Validate age

        return record;
    }

    static async onAfterUpdate(record) {
        console.log('Customer updated:', record);
    }

    static async onBeforeDelete(id) {
        console.log('Before deleting customer ID:', id);
    }

    static async onAfterDelete(result) {
        console.log('Customer deleted:', result);
    }
}

export default Customer;
