// models/User.js
import Model from '../lib/orm/Model.js';
import fields from './fields/index.js'; // Corrected import path

class User extends Model {
    static tableName = 'users';

    // Use the domain‑specific field templates; you can override only `required` and `default`
    static fields = {
        name: new fields.NameField(),
        phone: new fields.PhoneField(),
        zip: new fields.ZipField(),
    };

    // Define indexes if needed.
    static indexes = [
        { name: 'x', columns: ['name'], unique: true }
    ];
}

export default User;
