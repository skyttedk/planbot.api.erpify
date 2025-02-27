import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import modelLoader from '../models/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class ViewLoader {
    async init() {
        const views = {};
        const models = await modelLoader.init();

        try {
            const files = await fs.readdir(__dirname);

            for (const file of files) {
                if (file === 'index.js' || !file.endsWith('.js')) {
                    continue;
                }

                const viewName = path.basename(file, '.js');
                const { default: view } = await import(`./${file}`);
                
                // Apply model validation properties to view fields
                this._applyModelValidationToView(view, models);
                
                // Validate the view's fields against model schema
                const validationResult = this._validateViewFields(view, models, viewName);
                if (validationResult.valid) {
                    views[viewName] = view;
                } else {
                    console.error(`\x1b[31mSkipping view "${viewName}" due to field validation errors: ${validationResult.errors.join(', ')}\x1b[0m`);
                }
            }

            console.log(`Loaded ${Object.keys(views).length} views`);
        } catch (error) {
            // If views directory doesn't exist yet, just return empty object
            if (error.code === 'ENOENT') {
                console.log('Views directory not found, creating empty views object');
            } else {
                console.error('Error loading views:', error);
            }
        }

        return views;
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