// models/index.js

// Define a configuration object that maps model names to their module paths.
const modelPaths = {
    User: './User.js',
    Customer: './Customer.js',
    Log: './Log.js',
    // Add more models here
};

// Dynamically import each module based on the above configuration
// This uses top‑level await, so ensure your environment supports it
const models = await (async () => {
    const importedModels = {};

    await Promise.all(
        Object.entries(modelPaths).map(async ([name, path]) => {
            const module = await import(path);
            importedModels[name] = module.default;
        })
    );

    return importedModels;
})();

// Synchronize the schema for each model
(async function syncSchemas() {
    try {
        console.log('Synchronizing database schemas...');

        // Synchronize schema for each model, if it has a syncSchema method
        const syncPromises = Object.values(models).map((model) =>
            typeof model.syncSchema === 'function' ? model.syncSchema() : Promise.resolve()
        );
        await Promise.all(syncPromises);
        console.log('All schemas have been synchronized.');
    } catch (err) {
        console.error("Failed to synchronize schemas:", err);
        process.exit(1);
    }
})();

export default models;