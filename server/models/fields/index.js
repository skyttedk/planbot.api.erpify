// models/fields/index.js

//const ora = require('ora') us eimport
import ora from 'ora';
import logger from '../../lib/logger.js';

// Define a single configuration object that maps field names to their module paths.
const fieldPaths = {
    Field: '../../lib/orm/Field.js',
    PhoneField: './PhoneField.js',
    ZipField: './ZipField.js',
    AgeField: './AgeField.js',
    JsonField: './JsonField.js',
    PathField: './PathField.js',
    NameField: './NameField.js',
    Email: './Email.js',
    String250: './String250.js',
    CurrencyField: './CurrencyField.js',
    Code10: './Code10.js',
    PasswordField: './PasswordField.js',
};

// Dynamically import each module based on the above configuration.
// This uses top‑level await, so make sure your environment supports it.
const exportedFields = {};

// Create a spinner for field loading
const spinner = logger.spinner('Loading field definitions');

await Promise.all(
    Object.entries(fieldPaths).map(async ([name, path]) => {
        try {
            spinner.text = `Loading field: ${name}`;
            const module = await import(path);
            exportedFields[name] = module.default;
        } catch (error) {
            logger.error(`Failed to load field ${name} from ${path}:`, error);
            throw error;
        }
    })
);

spinner.succeed('All fields loaded successfully');

// Immediately run a function that checks for duplicate UIDs among fields.
// We skip the base Field since it isn't meant to be instantiated directly.
(function validateUniqueFieldUids(fields) {
    const validationSpinner = logger.spinner('Validating field UIDs');
    const uidMap = {}; // uid => array of field names

    for (const key in fields) {
        if (key === 'Field') continue; // Skip base Field

        try {
            validationSpinner.text = `Validating field: ${key}`;
            const instance = new fields[key](); // instantiate with default options
            const uid = instance.uid;
            
            if (uid) {
                uidMap[uid] = uidMap[uid] || [];
                uidMap[uid].push(key);
            }
        } catch (error) {
            logger.error(`Error instantiating field "${key}":`, error);
        }
    }

    // Find any UIDs that appear in more than one field.
    const duplicates = Object.entries(uidMap).filter(
        ([, fieldNames]) => fieldNames.length > 1
    );

    if (duplicates.length > 0) {
        validationSpinner.fail('Duplicate field UIDs detected');
        let errorMessage = 'Duplicate field UIDs detected:\n';
        duplicates.forEach(([uid, fieldNames]) => {
            errorMessage += `  UID ${uid} is used in: ${fieldNames.join(', ')}\n`;
        });
        throw new Error(errorMessage);
    }

    validationSpinner.succeed('All field UIDs are unique');
})(exportedFields);

// Export the entire fields object as the default export.
export default exportedFields;
