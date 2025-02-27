// models/fields/index.js

//const ora = require('ora') us eimport
import ora from 'ora';

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
};

// Dynamically import each module based on the above configuration.
// This uses top‑level await, so make sure your environment supports it.
const exportedFields = {};
await Promise.all(
    Object.entries(fieldPaths).map(async ([name, path]) => {
        // make ora log


        const module = await import(path);
        exportedFields[name] = module.default;
    })
);


// Immediately run a function that checks for duplicate UIDs among fields.
// We skip the base Field since it isn’t meant to be instantiated directly.
(function validateUniqueFieldUids(fields) {
    console.log('Validating field UIDs...');
    const uidMap = {}; // uid => array of field names

    for (const key in fields) {
        if (key === 'Field') continue; // Skip base Field

        try {
            const instance = new fields[key](); // instantiate with default options
            const uid = instance.uid;
            console.log(`  Field "${key}" has UID ${uid}`);
            if (uid) {
                uidMap[uid] = uidMap[uid] || [];
                uidMap[uid].push(key);
            }
        } catch (error) {
            console.error(`Error instantiating field "${key}":`, error);
        }
    }

    // Find any UIDs that appear in more than one field.
    const duplicates = Object.entries(uidMap).filter(
        ([, fieldNames]) => fieldNames.length > 1
    );

    if (duplicates.length > 0) {
        let errorMessage = 'Duplicate field UIDs detected:\n';
        duplicates.forEach(([uid, fieldNames]) => {
            errorMessage += `  UID ${uid} is used in: ${fieldNames.join(', ')}\n`;
        });
        throw new Error(errorMessage);
    }
})(exportedFields);


// Export the entire fields object as the default export.
export default exportedFields;
