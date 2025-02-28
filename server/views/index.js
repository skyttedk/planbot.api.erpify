import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { watch } from 'fs'; // Import for file watching
import modelLoader from '../models/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class ViewLoader {
    constructor() {
        this.views = {};
        this.models = null;
        this.watchers = new Map(); // Store file watchers
    }

    async init() {
        this.models = await modelLoader.init();

        try {
            const files = await fs.readdir(__dirname);

            for (const file of files) {
                if (file === 'index.js' || !file.endsWith('.js')) {
                    continue;
                }

                await this._loadViewFile(file);
            }

            console.log(`Loaded ${Object.keys(this.views).length} views`);
            
            // Set up file watchers after initial load
            this._setupFileWatchers();
        } catch (error) {
            // If views directory doesn't exist yet, just return empty object
            if (error.code === 'ENOENT') {
                console.log('Views directory not found, creating empty views object');
            } else {
                console.error('Error loading views:', error);
            }
        }

        return this.views;
    }
    
    /**
     * Set up file watchers for the views directory
     */
    _setupFileWatchers() {
        // Clean up any existing watchers
        this.watchers.forEach(watcher => watcher.close());
        this.watchers.clear();
        
        // Setup watcher for the views directory
        const directoryWatcher = watch(__dirname, async (eventType, filename) => {
            // Skip non-JavaScript files and index.js
            if (!filename || !filename.endsWith('.js') || filename === 'index.js') {
                return;
            }
            
            // Debounce changes - wait a short time to ensure file write is complete
            clearTimeout(this._fileChangeTimeout);
            this._fileChangeTimeout = setTimeout(async () => {
                const viewName = path.basename(filename, '.js');
                
                // When a file changes
                if (eventType === 'change') {
                    console.log(`View file changed: ${filename}`);
                    
                    try {
                        // Check if the file still exists (could have been temporarily renamed)
                        const filePath = path.join(__dirname, filename);
                        try {
                            await fs.access(filePath);
                        } catch (e) {
                            console.log(`File ${filename} not accessible, skipping reload`);
                            return;
                        }
                        
                        // Reload the view file
                        await this._loadViewFile(filename, true);
                        console.log(`Reloaded view: ${filename}`);
                    } catch (error) {
                        console.error(`Error reloading view ${filename}:`, error);
                    }
                }
                // Handle file deletion/renaming
                else if (eventType === 'rename') {
                    try {
                        // Check if the file exists (to distinguish between creation and deletion)
                        const filePath = path.join(__dirname, filename);
                        try {
                            await fs.access(filePath);
                            
                            // File exists, it's a new file or renamed file
                            if (!this.views[viewName]) {
                                console.log(`New view file detected: ${filename}`);
                                await this._loadViewFile(filename);
                                console.log(`Loaded new view: ${filename}`);
                            } else {
                                // It could be that the file was renamed but the content is the same
                                // We'll treat it as a change
                                console.log(`View file renamed or created: ${filename}`);
                                await this._loadViewFile(filename, true);
                                console.log(`Reloaded view: ${filename}`);
                            }
                        } catch (e) {
                            // File doesn't exist, it was deleted
                            if (this.views[viewName]) {
                                console.log(`View file deleted: ${filename}`);
                                delete this.views[viewName];
                            }
                        }
                    } catch (error) {
                        console.error(`Error handling view file rename/delete ${filename}:`, error);
                    }
                }
            }, 100); // Small debounce delay
        });
        
        this.watchers.set('directory', directoryWatcher);
        console.log('Set up view file watcher');
    }
    
    /**
     * Load a single view file
     * @param {string} file - Filename to load
     * @param {boolean} isReload - Whether this is a reload of an existing view
     */
    async _loadViewFile(file, isReload = false) {
        const viewName = path.basename(file, '.js');
        
        try {
            // For reloading, we need to bypass the module cache
            if (isReload) {
                // For ES modules, we'll use a query parameter to bypass cache
                // This adds a timestamp to the import URL to make it unique each time
                const timestamp = Date.now();
                const moduleUrl = `${file}?t=${timestamp}`;
                
                try {
                    // Import with the timestamp query to bypass cache
                    const { default: view } = await import(`./${moduleUrl}`);
                    
                    // Apply model validation properties to view fields
                    this._applyModelValidationToView(view, this.models);
                    
                    // Validate the view's fields against model schema
                    const validationResult = this._validateViewFields(view, this.models, viewName);
                    
                    if (validationResult.valid) {
                        this.views[viewName] = view;
                        console.log(`Updated view "${viewName}" in views collection`);
                        return this.views[viewName];
                    } else {
                        console.error(`\x1b[31mSkipping view "${viewName}" due to field validation errors: ${validationResult.errors.join(', ')}\x1b[0m`);
                        return null;
                    }
                } catch (error) {
                    console.error(`Error reloading view ${file}:`, error);
                    throw error;
                }
            } else {
                // Regular first-time loading without cache concerns
                const { default: view } = await import(`./${file}`);
                
                // Apply model validation properties to view fields
                this._applyModelValidationToView(view, this.models);
                
                // Validate the view's fields against model schema
                const validationResult = this._validateViewFields(view, this.models, viewName);
                
                if (validationResult.valid) {
                    this.views[viewName] = view;
                } else {
                    console.error(`\x1b[31mSkipping view "${viewName}" due to field validation errors: ${validationResult.errors.join(', ')}\x1b[0m`);
                }
                
                return this.views[viewName];
            }
        } catch (error) {
            console.error(`Error loading view ${file}:`, error);
            throw error;
        }
    }

    /**
     * Applies validation properties from the model to the view fields
     * @param {Object|Array|Function} view - The view configuration object, array, or function
     * @param {Object} models - All available models
     */
    _applyModelValidationToView(view, models) {
        // Skip processing if view is a function (dynamically generated)
        if (typeof view === 'function') {
            return;
        }
        
        // Process an array of window configurations
        if (Array.isArray(view)) {
            for (const windowConfig of view) {
                this._applyValidationToWindowConfig(windowConfig, models);
            }
            return;
        }
        
        // Process a single window configuration
        this._applyValidationToWindowConfig(view, models);
    }

    /**
     * Applies validation properties to fields in a window configuration
     * @param {Object} windowConfig - Window configuration object
     * @param {Object} models - All available models
     */
    _applyValidationToWindowConfig(windowConfig, models) {
        // Check if this window has a form configuration
        const formConfig = windowConfig.formConfig;
        if (!formConfig) {
            return;  // No form to process
        }
        
        // Check if the form has a model specified
        const modelName = formConfig.model;
        if (!modelName) {
            return;  // No model to get validation from
        }
        
        // Check if the specified model exists
        const ModelClass = models[modelName];
        if (!ModelClass) {
            return;
        }
        
        // Get fields from the model
        const modelFields = ModelClass.fields || {};
        
        // Extract permissions to apply to individual fields
        const fieldPermissions = {};
        if (formConfig.permissions && formConfig.permissions.fields) {
            Object.entries(formConfig.permissions.fields).forEach(([fieldName, permissions]) => {
                fieldPermissions[fieldName] = permissions;
            });
            // Remove the separate permissions section after transferring
            delete formConfig.permissions;
        }
        
        // Process fields in form layout
        if (formConfig.layout && formConfig.layout.groups) {
            for (let i = 0; i < formConfig.layout.groups.length; i++) {
                const group = formConfig.layout.groups[i];
                
                // Normalize group structure - support both new simple format and legacy format
                // Convert caption object to plain string if needed
                if (group.caption && typeof group.caption === 'object' && group.caption.default) {
                    group.caption = group.caption.default;
                }
                
                // Add auto-generated ID if missing
                if (!group.id) {
                    group.id = `group_${i + 1}`;
                }
                
                // Process fields in the group
                if (group.fields) {
                    for (const field of group.fields) {
                        // Skip processing for lookup fields with dataSource other than this model
                        if (field.type === 'lookup' && field.dataSource && field.dataSource !== modelName) {
                            continue;
                        }
                        
                        // Apply permissions directly to the field
                        if (fieldPermissions[field.name]) {
                            Object.assign(field, fieldPermissions[field.name]);
                        }
                        
                        // Normalize field caption if needed
                        if (field.caption && typeof field.caption === 'object' && field.caption.default) {
                            field.caption = field.caption.default;
                        }
                        
                        const modelField = modelFields[field.name];
                        if (modelField) {
                            // If caption is not defined in the view, use caption from model or generate from field name
                            if (field.caption === undefined) {
                                if (modelField.caption) {
                                    // Use caption from model if available
                                    field.caption = modelField.caption;
                                } else {
                                    // Auto-generate caption from field name
                                    field.caption = this._generateCaptionFromFieldName(field.name);
                                }
                            }
                            
                            // Apply validation properties from model to view field
                            // Only add properties that are not already defined in the view
                            if (modelField.required !== undefined && field.required === undefined) {
                                field.required = modelField.required;
                            }
                            
                            if (modelField.length !== undefined && field.maxLength === undefined) {
                                field.maxLength = modelField.length;
                            }
                            
                            if (modelField.pattern !== undefined && field.pattern === undefined) {
                                // Convert RegExp to string pattern if it exists
                                if (modelField.pattern instanceof RegExp) {
                                    const patternStr = modelField.pattern.toString();
                                    // Extract the pattern between the forward slashes
                                    field.pattern = patternStr.substring(1, patternStr.lastIndexOf('/'));
                                } else if (typeof modelField.pattern === 'string') {
                                    field.pattern = modelField.pattern;
                                }
                            }
                            
                            // Generate field type from model if not already defined
                            if (field.type === undefined && modelField.type !== undefined) {
                                field.type = this._mapModelTypeToFieldType(modelField.type, modelField.constructor.name);
                            }
                        }
                    }
                }
            }
        }
    }

    /**
     * Maps model data types to appropriate HTML input types
     * @param {string} modelType - The data type from the model
     * @param {string} fieldClassName - The class name of the field (for special cases)
     * @returns {string} The corresponding HTML input type
     */
    _mapModelTypeToFieldType(modelType, fieldClassName) {
        // First check for special field classes that should override the type
        switch (fieldClassName) {
            case 'Email':
                return 'email';
            case 'PhoneField':
                return 'tel';
            case 'ZipField':
                return 'text'; // Most ZIP codes need text format for leading zeros
        }
        
        // Then check by data type
        switch (modelType.toLowerCase()) {
            case 'string':
            case 'varchar':
            case 'text':
                return 'text';
            case 'integer':
            case 'int':
            case 'bigint':
            case 'numeric':
            case 'float':
            case 'double':
                return 'number';
            case 'boolean':
                return 'checkbox';
            case 'date':
                return 'date';
            case 'timestamp':
            case 'datetime':
                return 'datetime-local';
            case 'time':
                return 'time';
            case 'password':
                return 'password';
            case 'color':
                return 'color';
            case 'url':
                return 'url';
            default:
                return 'text'; // Default to text input for unknown types
        }
    }

    /**
     * Validates that all fields in a view exist in the specified model
     * @param {Object|Array|Function} view - The view configuration object, array, or function
     * @param {Object} models - All available models
     * @param {string} viewName - Name of the view for error reporting
     * @returns {Object} Result containing valid flag and any error messages
     */
    _validateViewFields(view, models, viewName) {
        const result = { valid: true, errors: [] };
        
        // Skip validation if view is a function (dynamically generated)
        if (typeof view === 'function') {
            return result;
        }
        
        // Process an array of window configurations
        if (Array.isArray(view)) {
            for (const windowConfig of view) {
                const windowResult = this._validateWindowConfig(windowConfig, models, viewName);
                if (!windowResult.valid) {
                    result.valid = false;
                    result.errors.push(...windowResult.errors);
                }
            }
            return result;
        }
        
        // Process a single window configuration
        return this._validateWindowConfig(view, models, viewName);
    }

    /**
     * Validates a window configuration
     * @param {Object} windowConfig - Window configuration object
     * @param {Object} models - All available models
     * @param {string} viewName - Name of the view for error reporting
     * @returns {Object} Result containing valid flag and any error messages
     */
    _validateWindowConfig(windowConfig, models, viewName) {
        const result = { valid: true, errors: [] };
        
        // Check if this window has a form configuration
        const formConfig = windowConfig.formConfig;
        if (!formConfig) {
            return result;  // No form to validate
        }
        
        // Check if the form has a model specified
        const modelName = formConfig.model;
        if (!modelName) {
            return result;  // No model to validate against
        }
        
        // Check if the specified model exists
        const ModelClass = models[modelName];
        if (!ModelClass) {
            result.valid = false;
            result.errors.push(`Model "${modelName}" not found for view "${viewName}"`);
            return result;
        }
        
        // Get field names directly from the model's fields property and default fields
        const modelFieldNames = new Set([
            ...Object.keys(ModelClass.defaultFields || {}),
            ...Object.keys(ModelClass.fields || {})
        ]);
        
        // Check fields in form layout
        if (formConfig.layout && formConfig.layout.groups) {
            for (const group of formConfig.layout.groups) {
                // Normalize field structure - support both new simple format and legacy format
                if (group.fields) {
                    for (const field of group.fields) {
                        // Skip validation for lookup fields with dataSource other than this model
                        if (field.type === 'lookup' && field.dataSource && field.dataSource !== modelName) {
                            continue;
                        }
                        
                        if (field.name && !modelFieldNames.has(field.name)) {
                            result.valid = false;
                            result.errors.push(`Field "${field.name}" in view "${viewName}" does not exist in model "${modelName}"`);
                        }
                    }
                }
            }
        }
        
        // Check fields in permissions
        if (formConfig.permissions && formConfig.permissions.fields) {
            for (const fieldName of Object.keys(formConfig.permissions.fields)) {
                if (!modelFieldNames.has(fieldName)) {
                    result.valid = false;
                    result.errors.push(`Permission field "${fieldName}" in view "${viewName}" does not exist in model "${modelName}"`);
                }
            }
        }
        
        return result;
    }

    /**
     * Generates a caption from a field name
     * @param {string} fieldName - The name of the field
     * @returns {string} The generated caption
     */
    _generateCaptionFromFieldName(fieldName) {
        if (!fieldName) return '';
        
        // Replace underscores with spaces and capitalize each word
        return fieldName
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
}

export default new ViewLoader(); 