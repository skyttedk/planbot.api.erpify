import {
    BaseInput,
    TextInput,
    SelectInput,
    ToggleInput,
    LookupInput,
    FileInput,
    getInputComponentForType
} from './index.js';

/**
 * BindableInputCore - Core class that instantiates the appropriate input component
 * This serves as a factory for creating input components based on field type
 */
export class BindableInputCore {
    /**
     * Create a bindable input component
     * @param {Object} form - Parent form reference
     * @param {Object} fieldConfig - Field configuration
     */
    constructor(form, fieldConfig) {
        this.form = form;
        this.field = fieldConfig;
        this.inputType = fieldConfig.type || 'text';
        this.componentType = this._determineComponentType();
        this.inputComponent = this._createInputComponent();
    }

    /**
     * Determine the appropriate component type for this field
     * @returns {string} The component type name
     */
    _determineComponentType() {
        // First check if field has an explicit fieldType property
        if (this.field.fieldType) {
            return getInputComponentForType(this.field.fieldType);
        }

        // Check if this is a lookup field based on name patterns or properties
        const lookupFieldPatterns = [/Id$/i, /Reference$/i];
        const isLikelyLookupByName = lookupFieldPatterns.some(pattern =>
            pattern.test(this.field.name));

        if ((this.field.type === 'integer' || this.field.type === 'number') && isLikelyLookupByName) {
            return 'LookupInput';
        }

        // If field has lookup-related properties
        if (this.field.dataSource || this.field.relationTable ||
            this.field.displayField || this.field.valueField ||
            (this.field.options && this.field.options.dataSource)) {
            return 'LookupInput';
        }

        // Default to component mapped from input type
        return getInputComponentForType(this.inputType);
    }

    /**
     * Create the appropriate input component based on type
     * @returns {BaseInput} The instantiated input component
     */
    _createInputComponent() {
        switch (this.componentType) {
            case 'TextInput':
                return new TextInput(this.form, this.field);
            case 'SelectInput':
                return new SelectInput(this.form, this.field);
            case 'ToggleInput':
                return new ToggleInput(this.form, this.field);
            case 'LookupInput':
                return new LookupInput(this.form, this.field);
            case 'FileInput':
                return new FileInput(this.form, this.field);
            default:
                console.warn(`Unknown component type: ${this.componentType}, defaulting to TextInput`);
                return new TextInput(this.form, this.field);
        }
    }

    /**
     * Get the actual DOM element for this input
     * @returns {HTMLElement} The input DOM element
     */
    getElement() {
        return this.inputComponent.inputElement;
    }

    /**
     * Update the input value from a record
     * @param {Object} record - Record data
     */
    updateValue(record) {
        this.inputComponent.updateValue(record);
    }

    /**
     * Get the current value from the input
     * @returns {*} The input value
     */
    getValue() {
        return this.inputComponent.getValue();
    }

    /**
     * Set up event listeners for this input
     * @param {Function} onChange - Change callback
     */
    setupEventListeners(onChange) {
        this.inputComponent.setupEventListeners(onChange);
    }

    /**
     * Check if input is valid
     * @returns {boolean} Validation result
     */
    isValid() {
        return this.inputComponent.isValid();
    }

    /**
     * Get validation message if any
     * @returns {string} Validation message
     */
    getValidationMessage() {
        return this.inputComponent.getValidationMessage();
    }

    /**
     * Enable/disable the input
     * @param {boolean} disabled - Whether to disable the input
     */
    setDisabled(disabled) {
        this.inputComponent.setDisabled(disabled);
    }

    /**
     * Make the input read-only
     * @param {boolean} readonly - Whether to make input read-only
     */
    setReadOnly(readonly) {
        this.inputComponent.setReadOnly(readonly);
    }

    /**
     * Update options for select/lookup inputs
     * @param {Array} options - New options array
     */
    updateOptions(options) {
        if (this.inputComponent.updateOptions) {
            this.inputComponent.updateOptions(options);
        }
    }
}
