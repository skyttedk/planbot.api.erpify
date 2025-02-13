// models/Customer.js
import Model from '../lib/orm/Model.js';
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
        { name: 'users_email_idx', columns: ['name'], unique: true },
    ];
}

export default Customer;
