#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import inquirer from 'inquirer';

const program = new Command();

program
    .version('1.0.0')
    .description('CLI for managing application resources');

// Helper function to write a file only if it doesn't exist
const writeFileIfNotExists = (filePath, content) => {
    if (fs.existsSync(filePath)) {
        console.error(`Error: File already exists at ${filePath}`);
        process.exit(1); // Exit with failure
    }
    try {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, content.trim());
        console.log(`File created at ${filePath}`);
    } catch (error) {
        console.error(`Error creating file at ${filePath}: ${error.message}`);
    }
};

// Function to update modelPaths in index.js
const updateModelPaths = (modelName) => {
    const indexFilePath = path.join(process.cwd(), 'server', 'models', 'index.js');
    const relativeModelPath = `./${modelName}.js`;

    // Read the existing content of index.js
    let indexFileContent = fs.readFileSync(indexFilePath, 'utf8');

    // Ensure the new model entry is not duplicated
    if (indexFileContent.includes(`${modelName}: '${relativeModelPath}'`)) {
        console.error(`Error: ${modelName} already exists in modelPaths`);
        process.exit(1); // Exit with failure
    }

    // Find the position to insert the new model path
    const closingBracketIndex = indexFileContent.indexOf('};', indexFileContent.indexOf('const modelPaths = {'));
    if (closingBracketIndex === -1) {
        console.error(`Closing bracket for modelPaths not found.`);
        process.exit(1);
    }

    // Construct the new model entry
    const newModelEntry = `    ${modelName}: '${relativeModelPath}',\n`;

    // Insert the new model entry before the closing bracket
    const before = indexFileContent.slice(0, closingBracketIndex);
    const after = indexFileContent.slice(closingBracketIndex);
    indexFileContent = `${before}${newModelEntry}${after}`;
    fs.writeFileSync(indexFilePath, indexFileContent);
    console.log(`Updated modelPaths in ${indexFilePath}`);
};

// Function to update fieldPaths in index.js
const updateFieldPaths = (fieldName) => {
    const indexFilePath = path.join(process.cwd(), 'server', 'models', 'fields', 'index.js');
    const relativeFieldPath = `./${fieldName}.js`;

    let indexFileContent = fs.readFileSync(indexFilePath, 'utf8');

    if (indexFileContent.includes(`${fieldName}: '${relativeFieldPath}'`)) {
        console.error(`Error: ${fieldName} already exists in fieldPaths`);
        process.exit(1);
    }

    const closingBracketIndex = indexFileContent.indexOf('};', indexFileContent.indexOf('const fieldPaths = {'));
    if (closingBracketIndex === -1) {
        console.error(`Closing bracket for fieldPaths not found.`);
        process.exit(1);
    }

    const newFieldEntry = `    ${fieldName}: '${relativeFieldPath}',\n`;

    const before = indexFileContent.slice(0, closingBracketIndex);
    const after = indexFileContent.slice(closingBracketIndex);
    indexFileContent = `${before}${newFieldEntry}${after}`;
    fs.writeFileSync(indexFilePath, indexFileContent);
    console.log(`Updated fieldPaths in ${indexFilePath}`);
};

// Command to add a new field class
program
    .command('field:add')
    .description('Add a new Field class')
    .action(() => {
        inquirer.prompt([
            {
                type: 'input',
                name: 'fieldName',
                message: 'Enter the name of the field:',
                validate: input => !!input || 'Field name is required!'
            },
            {
                type: 'list',
                name: 'sqlType',
                message: 'Select the SQL type for the field:',
                choices: [
                    'integer', 'smallint', 'bigint', 'serial', 'bigserial', 'numeric',
                    'real', 'double precision', 'varchar', 'char', 'text', 'date',
                    'timestamp', 'timestamptz', 'time', 'interval', 'boolean', 'json',
                    'jsonb', 'uuid'
                ]
            },
            {
                type: 'input',
                name: 'length',
                message: 'Enter the length for the type (optional):',
                when: (answers) => ['varchar', 'char'].includes(answers.sqlType),
                validate: input => {
                    return input === '' || (!isNaN(input) && parseInt(input, 10) > 0) || 'Please enter a valid positive number.';
                }
            }
        ]).then(answers => {
            const { fieldName, sqlType, length } = answers;
            const fieldPath = path.join(process.cwd(), 'server', 'models', 'fields', `${fieldName}.js`);
            const lengthStr = length ? `length: ${length},` : '';
            const fieldContent = `
            import Field from '../../lib/orm/Field.js';
            
            class ${fieldName} extends Field {
                constructor(options = {}) {
                    const fixedProperties = {
                        uid: '${generateUID()}',
                        type: '${sqlType}',
                        ${lengthStr}
                    };

                    const allowedOverrides = {
                        required: options.required,
                        default: options.default,
                    };

                    const documentation = {
                        description: '<your description here>',
                        examples: ['""', '""'],
                        usage: '<describe intended usages>'
                    };

                    super({ ...fixedProperties, ...allowedOverrides });
                }

                onSet(value) {
                    // Custom setter logic
                    if (typeof value === 'string') {
                        value = value.trim();
                    }
                    return value;
                }

                onGet(value) {
                    // Custom getter logic
                    return value;
                }
            }

            export default ${fieldName};
        `;
            writeFileIfNotExists(fieldPath, fieldContent);
            updateFieldPaths(fieldName);
        });
    });

// Command to create a new model class
program
    .command('model:create')
    .description('Create a new Model class')
    .action(() => {
        inquirer.prompt([
            {
                type: 'input',
                name: 'modelName',
                message: 'Enter the name of the model:',
                validate: input => !!input || 'Model name is required!'
            }
        ]).then(answers => {
            const modelName = answers.modelName;
            const modelPath = path.join(process.cwd(), 'server', 'models', `${modelName}.js`);
            const modelContent = `
            import Model from '../lib/orm/Model.js';
            import fields from './fields/index.js'; // Import field definitions

            class ${modelName} extends Model {
                static tableName = '${modelName.toLowerCase()}s';

                static fields = {
                    name: new fields.NameField(),
                    age: new fields.AgeField(),
                    phone: new fields.PhoneField(),
                    zip: new fields.ZipField(),
                };

                static indexes = [
                    { name: '${modelName.toLowerCase()}_name_idx', columns: ['name'], unique: true },
                ];

                // Create Hooks
                static async onBeforeCreate(data) {
                    console.log('onBeforeCreate: validating and transforming ${modelName} data:', data);
                    if (typeof data.name === 'string') {
                        data.name = data.name.trim();
                    }
                    return data;
                }
                
                static async onAfterCreate(record) {
                    console.log('onAfterCreate: ${modelName} record created:', record);
                    return record;
                }

                // Update Hooks
                static async onBeforeUpdate(data) {
                    console.log('onBeforeUpdate: validating and transforming update data:', data);
                    if (data.name && typeof data.name === 'string') {
                        data.name = data.name.trim();
                    }
                    return data;
                }

                static async onAfterUpdate(record) {
                    console.log('onAfterUpdate: ${modelName} record updated:', record);
                    return record;
                }

                // Delete Hooks
                static async onBeforeDelete(id) {
                    console.log('onBeforeDelete: about to delete ${modelName} with id:', id);
                    return id;
                }

                static async onAfterDelete(result) {
                    console.log('onAfterDelete: ${modelName} deletion result:', result);
                    return result;
                }
            }

            export default ${modelName};
        `;
            writeFileIfNotExists(modelPath, modelContent);
            updateModelPaths(modelName);
        });
    });

// Utility function to generate a unique identifier
const generateUID = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0,
            v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });

program.parse(process.argv);