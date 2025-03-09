// models/Customer.js
import Model from '../lib/orm/Model.js';
import Log from './Log.js'; // Corrected import path
import fields from './fields/index.js'; // Corrected import path
import logger from '../lib/logger.js'; // Import the logger

//import models from './Log.js';
//import modelLoader from '../../server/models/index.js';
//const models = await modelLoader.init();

class Customer extends Model {
    static tableName = 'customers';

    // Use the domain‑specific field templates; you can override only `required` and `default`
    static fields = {
        name: new fields.NameField(),
        address: new fields.String250(),
        address2: new fields.String250(),
        age: new fields.AgeField(),
        phone: new fields.PhoneField(),
        zip: new fields.ZipField(),
        email: new fields.Email(),
        gender: new fields.EnumField({
            caption: 'Gender',
            options: ['Male', 'Female', 'Non-binary', 'Prefer not to say'],
            default: 'Prefer not to say'
        }),
    };

    // Optionally add renameMap, indexes, etc.

    static indexes = [
        { name: 'idx_name', columns: ['name'], unique: true }, // Unique index on name
        { name: 'idx_zip', columns: ['zip'], unique: false }, // Non-unique index on zip
    ];

    // --------------------------
    // Hooks
    // --------------------------

    static async onBeforeCreate(customer) {
        logger.model('beforeCreate', 'Customer', customer);
        return customer;
    }

    static async onAfterCreate(customer) {
        logger.model('afterCreate', 'Customer', customer);

        // Add a log entry
        //let a = models
        await Log.create({ path: '/customers', data: customer });

        
    }

    static async onBeforeUpdate(customer) {
        logger.model('beforeUpdate', 'Customer', customer);

        customer.age += 1; // Increment age
        //this.fields.age.validate(1); // Validate age

        //customer.fields.age.validate(1); // Validate ag
        // e
        return customer;
    }

    static async onAfterUpdate(customer) {
        logger.model('afterUpdate', 'Customer', customer);
    }

    static async onBeforeDelete(id) {
        logger.model('beforeDelete', 'Customer', { id });
    }

    static async onAfterDelete(result) {
        logger.model('afterDelete', 'Customer', result);
    }
}

export default Customer;
