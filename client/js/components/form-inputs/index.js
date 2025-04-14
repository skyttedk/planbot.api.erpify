/**
 * Form Input Components
 * Index file that exports all input component types
 */

// Export all input components
export { BaseInput } from './base-input.js';
export { TextInput } from './text-input.js';
export { SelectInput } from './select-input.js';
export { ToggleInput } from './toggle-input.js';
export { LookupInput } from './lookup-input.js';
export { FileInput } from './file-input.js';

// Input Type to Component mapping
export const INPUT_TYPES = {
    // Text-based inputs
    'text': 'TextInput',
    'email': 'TextInput',
    'password': 'TextInput',
    'url': 'TextInput',
    'tel': 'TextInput',
    'phone': 'TextInput',
    'search': 'TextInput',
    'number': 'TextInput',
    'decimal': 'TextInput',
    'float': 'TextInput',
    'integer': 'TextInput',
    'date': 'TextInput',
    'datetime': 'TextInput',
    'time': 'TextInput',
    'color': 'TextInput',

    // Selection inputs
    'select': 'SelectInput',
    'enum': 'SelectInput',

    // Toggle inputs
    'checkbox': 'ToggleInput',
    'radio': 'ToggleInput',
    'boolean': 'ToggleInput',

    // Lookup fields
    'lookup': 'LookupInput',
    'relation': 'LookupInput',
    'foreignKey': 'LookupInput',
    'country': 'LookupInput',

    // File inputs
    'file': 'FileInput',
    'image': 'FileInput',
    'document': 'FileInput'
};

/**
 * Get the appropriate component class for a given input type
 * @param {string} inputType - The input type string
 * @returns {string} The component class name to use
 */
export function getInputComponentForType(inputType) {
    // Default to TextInput if type is not recognized
    return INPUT_TYPES[inputType?.toLowerCase()] || 'TextInput';
}
