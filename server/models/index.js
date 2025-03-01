// Define a configuration object that maps model names to their module paths
import logger from '../lib/logger.js';

const modelPaths = {
    // User: './User.js', - Removed User model
    Customer: './Customer.js',
    Log: './Log.js',
    Country: './Country.js',
    
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
                modelSpinner.text = `Loading model: ${name}`;
                const module = await import(path);
                importedModels[name] = module.default;
                loadedCount++;
                modelSpinner.text = `Loaded ${loadedCount}/${totalModels} models`;
            } catch (error) {
                logger.error(`Failed to load model ${name} from ${path}:`, error);
                throw error;
            }
        })
    );
    
    modelSpinner.succeed(`Successfully loaded ${totalModels} models`);
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
                schemaSpinner.text = `Syncing schema for ${name}`;
                await model.syncSchema(options);
                syncedCount++;
                schemaSpinner.text = `Synced ${syncedCount}/${modelNames.length} schemas`;
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
    async init(options = { forceSyncSchema: false }) {
        if (this._models) return this._models;
        if (!this._initializationPromise) {
            this._initializationPromise = (async () => {
                const initSpinner = logger.spinner('Initializing models');
                try {
                    const models = await loadModels();
                    
                    if (options.forceSyncSchema) {
                        initSpinner.text = 'Forcing schema synchronization';
                    } else {
                        initSpinner.text = 'Checking schema consistency';
                    }
                    
                    await syncSchemas(models, { force: options.forceSyncSchema });
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
