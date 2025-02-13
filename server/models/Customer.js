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


    // --------------------------
    // Create Hooks
    // --------------------------

    // Called before a new record is created.
    static async onBeforeCreate(data) {
        console.log('onBeforeCreate: validating and transforming customer data:', data);
        // Example: Trim the name field.
        if (typeof data.name === 'string') {
            data.name = data.name.trim();
        }
        // You can perform additional validation or transformation here.
        return data;
    }

    // Called after a new record is created.
    static async onAfterCreate(record) {
        console.log('onAfterCreate: customer record created:', record);
        // Example: Trigger a welcome email or log the creation.
        return record;
    }

    // --------------------------
    // Update Hooks
    // --------------------------

    // Called before updating an existing record.
    static async onBeforeUpdate(data) {
        console.log('onBeforeUpdate: validating and transforming update data:', data);
        // Example: Ensure that if name is provided, it is trimmed.
        if (data.name && typeof data.name === 'string') {
            data.name = data.name.trim();
        }
        // Add any other update-specific validation here.
        return data;
    }

    // Called after a record is updated.
    static async onAfterUpdate(record) {
        console.log('onAfterUpdate: customer record updated:', record);
        // Example: Log the update or trigger related actions.
        return record;
    }

    // --------------------------
    // Delete Hooks
    // --------------------------

    // Called before deleting a record.
    static async onBeforeDelete(id) {
        console.log('onBeforeDelete: about to delete customer with id:', id);
        // Example: Check if deletion is allowed, or log the intent.
        return id;
    }

    // Called after a record is deleted.
    static async onAfterDelete(result) {
        console.log('onAfterDelete: customer deletion result:', result);
        // Example: Clean up related data or log the deletion.
        return result;
    }
}

export default Customer;
