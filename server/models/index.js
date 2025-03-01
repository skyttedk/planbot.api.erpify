// Define a configuration object that maps model names to their module paths
const modelPaths = {
    User: './User.js',
    Customer: './Customer.js',
    Log: './Log.js',
    
    // Add more models here as needed

};

// Function to load models asynchronously
async function loadModels() {
    const importedModels = {};
    await Promise.all(
        Object.entries(modelPaths).map(async ([name, path]) => {
            try {
                const module = await import(path);
                importedModels[name] = module.default;
            } catch (error) {
                console.error(`Failed to load model ${name} from ${path}:`, error);
                throw error;
            }
        })
    );
    return importedModels;
}

// Function to synchronize the schema for each model
async function syncSchemas(models, options = { force: false }) {
    try {
        console.log('Checking database schemas...');
        const syncPromises = Object.values(models).map((model) =>
            typeof model.syncSchema === 'function' ? model.syncSchema(options) : Promise.resolve()
        );
        await Promise.all(syncPromises);
        console.log('Schema check completed.');
    } catch (err) {
        console.error('Failed to synchronize schemas:', err);
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
                const models = await loadModels();
                await syncSchemas(models, { force: options.forceSyncSchema });
                this._models = models;
                return models;
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
