// models/index.js
import User from './User.js';
import Customer from './Customer.js';
import fields from '../lib/orm/Field.js';


const models = { User, Customer };

(async function syncSchemas() {
    try {
        console.log('Synchronizing database schemas...');

        // Synchronize schema for each model.
        const syncPromises = Object.values(models).map((model) =>
            typeof model.syncSchema === 'function' ? model.syncSchema() : Promise.resolve()
        );
        await Promise.all(syncPromises);
        console.log('All schemas have been synchronized.');
    } catch (err) {
        console.error("Failed to initialize application:", err);
        process.exit(1);
    }
})();

export default models;