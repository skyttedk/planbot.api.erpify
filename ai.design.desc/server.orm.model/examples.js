
// models/CustomerExamples.js
import { WebSocketServer } from 'ws';
import pool from '../../server/config/db.js';

import Models from '../../server/models/index.js';

async function createDeleteAll() {
    // 1. Deleting All Customers
    const deleted = await Models.Customer.deleteBatch();
    console.log('Deleted all customers:', deleted);

}


// 2. Creating a Single Customer
async function createCustomer() {

    const customer = await Models.Customer.create({
        name: 'John Doe',
        phone: '+1234567890',
        zip: '12345',
    });
    console.log('Created customer:', customer);

}

// 3. Finding a Customer by ID
async function findCustomerById() {
    const customer = await Models.Customer.findById(1);
    if (customer) {
        console.log('Found customer:', customer);
    } else {
        console.log('Customer not found.');
    }

}

// 4. Finding Customers with Conditions
async function findCustomers() {

    const customers = await Models.Customer.find(
        { zip: '12345' }, // Condition
        { limit: 10, orderBy: 'name' } // Options
    );
    console.log('Found customers:', customers);

}

// 5. Updating a Customer
async function updateCustomer() {

    const updatedCustomer = await Models.Customer.update(1, {
        phone: '+1987654321',

    });
    if (updatedCustomer) {
        console.log('Updated customer:', updatedCustomer);
    } else {
        console.log('Customer not found.');
    }

}

// 6. Deleting a Customer
async function deleteCustomer() {

    const result = await Models.Customer.delete(1);
    console.log('Deletion result:', result);

}

// 7. Batch Creating Customers
async function createBatchCustomers() {

    const customers = await Models.Customer.createBatch([
        { name: 'Jane Smith', phone: '+1234567891', zip: '67890' },
        { name: 'Bob Johnson', phone: '+1234567892', zip: '54321' }
    ]);
    console.log('Batch created customers:', customers);

}

// 8. Counting Customers
async function countCustomers() {
    const count = await Models.Customer.count({ zip: '12345' });
    console.log('Number of customers with zip 12345:', count);

}



// 10. Advanced Query with Custom Conditions
async function findCustomersByPhonePrefix() {

    const customers = await Models.Customer.find({
        phone: { operator: 'LIKE', value: '+123%' }
    });
    console.log('Customers with phone prefix +123:', customers);

}

// 11. Handling Validation Errors
async function createInvalidCustomer() {
    await Models.Customer.create({
        name: 'TooLongNameHere', // Exceeds length 10
        phone: 'invalid', // Doesn’t match pattern
        zip: 'abcde' // Doesn’t match pattern
    });

}

// 12. Fetching the Last Customer
async function getLastCustomer() {
    try {
        const lastCustomer = await Models.Customer.last({}, 'createdAt');
        console.log('Last customer:', lastCustomer);
    } catch (error) {
        console.error('Error fetching last customer:', error);
    }
}

// Main Function to Run All Examples Sequentially
async function runExamples() {

    await createDeleteAll();


    console.log('1. Creating a Single Customer');
    await createCustomer();
    console.log('\n');

    console.log('2. Finding a Customer by ID');

    await findCustomerById();
    console.log('\n');

    console.log('4. Finding Customers with Conditions');
    await findCustomers();
    console.log('\n');

    console.log('5. Updating a Customer');
    await updateCustomer();
    console.log('\n');

    console.log('6. Deleting a Customer');
    await deleteCustomer();
    console.log('\n');

    console.log('7. Batch Creating Customers');
    await createDeleteAll();
    await createBatchCustomers();
    console.log('\n');

    console.log('8. Counting Customers');
    await countCustomers();
    console.log('\n');



    console.log('10. Finding Customers by Phone Prefix');
    await findCustomersByPhonePrefix();
    console.log('\n');

    console.log('11. Handling Validation Errors');
    await createInvalidCustomer();
    console.log('\n');

    console.log('12. Fetching the Last Customer');
    await getLastCustomer();
    console.log('\n');

    console.log('=== Customer Model Examples Completed ===');
}

// Execute the Examples
runExamples().catch((error) => {
    console.error('Error running examples:', error);
});

export default runExamples;