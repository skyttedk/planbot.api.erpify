// models/Employee.js
import Model from '../lib/orm/Model.js';
import fields from './fields/index.js';

class Employee extends Model {
    static tableName = 'employees';

    // Define fields for the Employee model
    static fields = {
        name: new fields.NameField(),
        position: { type: 'string', required: true },
        email: { type: 'string', required: true },
        phone: new fields.PhoneField(),
        hireDate: { type: 'date', required: true }
    };

    // Define indexes
    static indexes = [
        { name: 'idx_employee_name', columns: ['name'], unique: false },
        { name: 'idx_employee_email', columns: ['email'], unique: true }
    ];

    // Hooks
    static async onBeforeCreate(record) {
        console.log('Before creating employee:', record);
        return record;
    }

    static async onAfterCreate(record) {
        console.log('Employee created:', record);
        return record;
    }
}

export default Employee; 