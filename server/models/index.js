// Define a configuration object that maps model names to their module paths
import logger from '../lib/logger.js';
import ora from 'ora';
import seeders from '../seeders/index.js';
import { initDatabase } from '../lib/db-init.js';

const modelPaths = {
    User: './User.js',
    Customer: './Customer.js',
    Log: './Log.js',
    Country: './Country.js',
    Resource: './Resource.js',
    
    // Add more models here as needed
};

// Function to load models asynchronously
async function loadModels() {
    const importedModels = {};
    const modelSpinner = logger.spinner('Loading models');
    let loadedCount = 0;
    const totalModels = Object.keys(modelPaths).length;
    
    await Promise.all(
        Object.entries(modelPaths).map(async ([name, path]) => {
            try {
                // Loading model
                const module = await import(path);
                importedModels[name] = module.default;
                loadedCount++;
                modelSpinner.text = `Loading models`;
            } catch (error) {
                logger.error(`Failed to load model ${name} from ${path}:`, error);
                throw error;
            }
        })
    );
    
    modelSpinner.succeed(`Models loaded successfully`);
    return importedModels;
}

// Function to synchronize the schema for each model
async function syncSchemas(models, options = { force: false }) {
    try {
        const schemaSpinner = logger.spinner('Checking database schemas');
        
        // Get array of model names for better progress reporting
        const modelNames = Object.keys(models);
        let syncedCount = 0;
        
        const syncPromises = Object.entries(models).map(async ([name, model]) => {
            if (typeof model.syncSchema === 'function') {
                // Syncing schema
                // When force is true, also drop extra columns
                const syncOptions = { 
                    force: options.force,
                    dropExtraColumns: options.force || options.dropExtraColumns
                };
                await model.syncSchema(syncOptions);
                syncedCount++;
                schemaSpinner.text = `Checking database schemas`;
            }
        });
        
        await Promise.all(syncPromises);
        
        if (options.force) {
            schemaSpinner.succeed('Forced schema synchronization completed successfully');
        } else {
            schemaSpinner.succeed('Schema check completed successfully');
        }
    } catch (err) {
        logger.error('Failed to synchronize schemas:', err);
        throw err;
    }
}

// Singleton class to load and initialize models only once
class ModelLoader {
    constructor() {
        // If an instance already exists, return it
        if (ModelLoader.instance) {
            return ModelLoader.instance;
        }
        ModelLoader.instance = this;
        this._models = null;
        this._initializationPromise = null;
    }

    // Call this method to initialize the models (or await an ongoing init)
    async init(options = { forceSyncSchema: false, runSeeders: true, forceReseed: false }) {
        if (this._models) return this._models;
        if (!this._initializationPromise) {
            this._initializationPromise = (async () => {
                const initSpinner = logger.spinner('Initializing models');
                try {
                    // First ensure database infrastructure is ready
                    initSpinner.text = 'Initializing database infrastructure';
                    await initDatabase();
                    
                    const models = await loadModels();
                    
                    if (options.forceSyncSchema) {
                        // Forcing schema synchronization
                    } else {
                        // Checking schema consistency
                    }
                    
                    await syncSchemas(models, { force: options.forceSyncSchema });
                    
                    // Run seeders if enabled
                    if (options.runSeeders) {
                        // Running database seeders
                        await seeders.runSeeders(models, { force: options.forceReseed });
                    }
                    
                    this._models = models;
                    
                    initSpinner.succeed('Models initialized successfully');
                    return models;
                } catch (error) {
                    initSpinner.fail('Model initialization failed');
                    throw error;
                }
            })();
        }
        return this._initializationPromise;
    }

    // Getter for the models (throws if not initialized)
    get models() {
        if (!this._models) {
            throw new Error("Models have not been initialized. Call init() first.");
        }
        return this._models;
    }
}

// Export a single instance of ModelLoader (singleton)
export default new ModelLoader();
