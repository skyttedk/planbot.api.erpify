class BindableInput extends HTMLElement {
    static formAssociated = true;
    
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._record = null;
        this._field = null;
        this._debounceDelay = 300;
        this._immutable = false;
        
        // Form internals for form association
        if (BindableInput.formAssociated) {
            this._internals = this.attachInternals();
        }
        
        // Create input handler with debounce once
        this._createInputHandlerWithDebounce();
        this._createStyles();
        this._createInput();
    }

    static get observedAttributes() {
        return [
            'type', 'field', 'debounce', 'options', 'aria-label',
            'placeholder', 'required', 'disabled', 'readonly', 'immutable',
            'min', 'max', 'pattern', 'minlength', 'maxlength'
        ];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;
        
        switch (name) {
            case 'type':
                this._createInput();
                this.updateValue();
                break;
            case 'field':
                this._field = newValue;
                this.updateValue();
                break;
            case 'debounce':
                this._debounceDelay = Number(newValue) || 300;
                this._createInputHandlerWithDebounce();
                break;
            case 'options':
                if (this.getAttribute('type') === 'select') {
                    this._createInput();
                    this.updateValue();
                }
                break;
            case 'immutable':
                this._immutable = this.hasAttribute('immutable');
                break;
            case 'disabled':
            case 'readonly':
            case 'required':
                if (this.inputElement) {
                    if (newValue === null) {
                        this.inputElement.removeAttribute(name);
                    } else {
                        this.inputElement.setAttribute(name, newValue);
                    }
                    this._updateFormValidity();
                }
                break;
            default:
                // All other attributes are passed through to the input element
                if (this.inputElement) {
                    if (newValue === null) {
                        this.inputElement.removeAttribute(name);
                    } else {
                        this.inputElement.setAttribute(name, newValue);
                    }
                }
        }
    }

    connectedCallback() {
        if (this.hasAttribute('field')) {
            this._field = this.getAttribute('field');
        }
        if (this.hasAttribute('debounce')) {
            this._debounceDelay = Number(this.getAttribute('debounce')) || 300;
            this._createInputHandlerWithDebounce();
        }
        if (this.hasAttribute('immutable')) {
            this._immutable = true;
        }
        
        this._setupLabelAssociation();
    }

    disconnectedCallback() {
        if (this.inputElement) {
            this.inputElement.removeEventListener('input', this._inputHandler);
            this.inputElement.removeEventListener('change', this._inputHandler);
            this.inputElement.removeEventListener('blur', this._onBlur);
        }
    }
    
    _setupLabelAssociation() {
        // For associating with labels via for attribute
        if (this.hasAttribute('id')) {
            this.inputElement.id = `${this.getAttribute('id')}-input`;
        }
    }

    _createStyles() {
        const style = document.createElement('style');
        style.textContent = `
            :host {
                display: inline-block;
                --input-background: white;
                --input-color: black;
                --input-border: 1px solid #ccc;
                --input-border-radius: 4px;
                --input-padding: 8px;
                --input-font-size: 16px;
                --input-focus-border: 1px solid #0066cc;
                --input-focus-outline: 2px solid rgba(0, 102, 204, 0.25);
                --input-error-border: 1px solid #cc0000;
                --input-error-background: #fff8f8;
                --input-disabled-background: #f2f2f2;
                --input-disabled-color: #666;
                --input-placeholder-color: #999;
            }
            
            :host([disabled]) {
                opacity: 0.7;
                cursor: not-allowed;
            }
            
            input, select, textarea {
                box-sizing: border-box;
                width: 100%;
                background: var(--input-background);
                color: var(--input-color);
                border: var(--input-border);
                border-radius: var(--input-border-radius);
                padding: var(--input-padding);
                font-size: var(--input-font-size);
                font-family: inherit;
            }
            
            input:focus, select:focus, textarea:focus {
                border: var(--input-focus-border);
                outline: var(--input-focus-outline);
            }
            
            input:disabled, select:disabled, textarea:disabled {
                background: var(--input-disabled-background);
                color: var(--input-disabled-color);
                cursor: not-allowed;
            }
            
            input::placeholder, textarea::placeholder {
                color: var(--input-placeholder-color);
            }
            
            :host([invalid]) input, 
            :host([invalid]) select, 
            :host([invalid]) textarea {
                border: var(--input-error-border);
                background: var(--input-error-background);
            }
            
            .error-message {
                color: #cc0000;
                font-size: 0.85em;
                margin-top: 4px;
                display: none;
            }
            
            :host([invalid]) .error-message {
                display: block;
            }
        `;
        this.shadowRoot.appendChild(style);
    }

    _createInputHandlerWithDebounce() {
        this._inputHandler = this._debounce(() => this.onInput(), this._debounceDelay);
        this._onBlur = () => this._updateFormValidity();
    }

    _createInput() {
        // Clean up previous input if it exists
        if (this.inputElement && this.shadowRoot.contains(this.inputElement)) {
            this.inputElement.removeEventListener('input', this._inputHandler);
            this.inputElement.removeEventListener('change', this._inputHandler);
            this.inputElement.removeEventListener('blur', this._onBlur);
            this.shadowRoot.removeChild(this.inputElement);
        }
        
        // Remove error message if it exists
        const errorMsg = this.shadowRoot.querySelector('.error-message');
        if (errorMsg) {
            this.shadowRoot.removeChild(errorMsg);
        }
        
        // Create new input based on type
        const inputType = this.getAttribute('type') || 'text';
        this.inputElement = this._createInputByType(inputType);
        
        // Add common attributes to all input types
        this._applyCommonAttributes();
        
        // Add event listeners
        this._addInputEventListeners(inputType);
        
        // Add input to shadow DOM
        this.shadowRoot.appendChild(this.inputElement);
        
        // Add error message container
        const errorMessage = document.createElement('div');
        errorMessage.className = 'error-message';
        errorMessage.setAttribute('aria-live', 'polite');
        this.shadowRoot.appendChild(errorMessage);
    }
    
    _createInputByType(inputType) {
        switch(inputType) {
            case 'textarea':
                return document.createElement('textarea');
                
            case 'select':
                const select = document.createElement('select');
                this._populateSelectOptions(select);
                return select;
                
            default:
                const input = document.createElement('input');
                input.type = inputType;
                return input;
        }
    }
    
    _populateSelectOptions(select) {
        let options = [];
        try {
            const optionsAttr = this.getAttribute('options');
            if (optionsAttr) {
                options = JSON.parse(optionsAttr);
                if (!Array.isArray(options)) {
                    throw new Error('Options must be an array');
                }
            }
        } catch (e) {
            this._reportError(`Invalid options format: ${e.message}`);
            options = [];
        }
        
        // Add empty option if not required
        if (!this.hasAttribute('required')) {
            const emptyOption = document.createElement('option');
            emptyOption.value = '';
            emptyOption.textContent = 'Select...';
            select.appendChild(emptyOption);
        }
        
        // Add all options from the attribute
        options.forEach(opt => {
            const optionEl = document.createElement('option');
            optionEl.value = opt.value;
            optionEl.textContent = opt.label;
            select.appendChild(optionEl);
        });
    }
    
    _applyCommonAttributes() {
        // Apply all standard input attributes that might be set
        const attributesToApply = [
            'placeholder', 'required', 'disabled', 'readonly', 
            'min', 'max', 'pattern', 'minlength', 'maxlength',
            'aria-label', 'aria-required', 'aria-invalid'
        ];
        
        attributesToApply.forEach(attr => {
            if (this.hasAttribute(attr)) {
                this.inputElement.setAttribute(attr, this.getAttribute(attr));
            }
        });
        
        // Set ARIA role
        if (this.getAttribute('type') === 'checkbox' || this.getAttribute('type') === 'radio') {
            this.inputElement.setAttribute('role', this.getAttribute('type'));
        }
        
        // Add name attribute for form association
        if (this.hasAttribute('name')) {
            this.inputElement.name = this.getAttribute('name');
        }
    }
    
    _addInputEventListeners(inputType) {
        if (inputType === 'checkbox' || inputType === 'radio') {
            this.inputElement.addEventListener('change', this._inputHandler);
        } else {
            this.inputElement.addEventListener('input', this._inputHandler);
        }
        
        // Add blur event for validation
        this.inputElement.addEventListener('blur', this._onBlur);
    }

    _debounce(fn, delay) {
        let timeoutId;
        return () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(fn, delay);
        };
    }
    
    _updateFormValidity() {
        if (!BindableInput.formAssociated) return;
        
        const isValid = this.inputElement.checkValidity();
        if (!isValid) {
            this.setAttribute('invalid', '');
            const errorMsg = this.shadowRoot.querySelector('.error-message');
            errorMsg.textContent = this.inputElement.validationMessage;
            this._internals.setValidity(
                { customError: true }, 
                this.inputElement.validationMessage
            );
        } else {
            this.removeAttribute('invalid');
            this._internals.setValidity({});
        }
        
        // Update form control status
        if (this.inputElement.value !== '') {
            this._internals.setFormValue(this.inputElement.value);
        } else {
            this._internals.setFormValue(null);
        }
    }
    
    _reportError(message) {
        console.error(message);
        const event = new CustomEvent('bindable-error', {
            bubbles: true,
            composed: true,
            detail: { message }
        });
        this.dispatchEvent(event);
    }

    // Support for nested object paths (e.g., 'user.address.street')
    _getValueFromPath(obj, path) {
        if (!obj || !path) return null;
        
        const parts = path.split('.');
        let value = obj;
        
        for (const part of parts) {
            if (value === null || value === undefined) return null;
            value = value[part];
        }
        
        return value;
    }
    
    _setValueAtPath(obj, path, value) {
        if (!obj || !path) return false;
        
        const parts = path.split('.');
        let current = obj;
        
        // Navigate to the containing object
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (current[part] === undefined) {
                current[part] = {};
            } else if (typeof current[part] !== 'object') {
                this._reportError(`Cannot set property '${parts[i+1]}' of non-object ${part}`);
                return false;
            }
            current = current[part];
        }
        
        // Set the value on the final property
        current[parts[parts.length - 1]] = value;
        return true;
    }

    set record(newRecord) {
        if (typeof newRecord !== 'object' || newRecord === null) {
            this._reportError('record must be a non-null object');
            return;
        }
        this._record = newRecord;
        this.updateValue();
    }

    get record() {
        return this._record;
    }

    set field(fieldName) {
        if (typeof fieldName !== 'string' || !fieldName.trim()) {
            this._reportError('field must be a non-empty string');
            return;
        }
        this._field = fieldName;
        this.setAttribute('field', fieldName);
        this.updateValue();
    }

    get field() {
        return this._field;
    }
    
    // Form API support
    get form() {
        return BindableInput.formAssociated ? this._internals.form : null;
    }
    
    get name() {
        return this.getAttribute('name');
    }
    
    set name(value) {
        this.setAttribute('name', value);
    }
    
    get validity() {
        return BindableInput.formAssociated ? this._internals.validity : { valid: true };
    }
    
    get validationMessage() {
        return BindableInput.formAssociated ? this._internals.validationMessage : '';
    }
    
    get willValidate() {
        return BindableInput.formAssociated ? this._internals.willValidate : false;
    }
    
    checkValidity() {
        return BindableInput.formAssociated ? this._internals.checkValidity() : true;
    }
    
    reportValidity() {
        return BindableInput.formAssociated ? this._internals.reportValidity() : true;
    }

    updateValue() {
        if (!this._record || !this._field || !this.inputElement) {
            return;
        }
        
        try {
            const inputType = this.getAttribute('type') || 'text';
            const currentValue = this._getValueFromPath(this._record, this._field);
            
            if (inputType === 'checkbox' || inputType === 'radio') {
                const newChecked = !!currentValue;
                if (this.inputElement.checked !== newChecked) {
                    this.inputElement.checked = newChecked;
                }
            } else {
                // Handle null/undefined case
                const newValue = (currentValue != null) ? String(currentValue) : '';
                
                if (this.inputElement.value !== newValue) {
                    this.inputElement.value = newValue;
                }
            }
            
            this._updateFormValidity();
        } catch (error) {
            console.error(`Error updating value for field ${this._field}:`, error);
            this._reportError(`Failed to update ${this._field}: ${error.message}`);
        }
    }

    onInput() {
        if (!this._record || !this._field) {
            this._reportError('Record or field not defined for input event');
            return;
        }
        
        try {
            const inputType = this.getAttribute('type') || 'text';
            let value;
            
            if (inputType === 'checkbox' || inputType === 'radio') {
                value = this.inputElement.checked;
            } else {
                value = this.inputElement.value;
                
                // Type coercion based on input type
                if (inputType === 'number') {
                    value = this.inputElement.value === '' ? null : Number(value);
                    
                    // Check if the value is NaN
                    if (typeof value === 'number' && isNaN(value)) {
                        this._reportError(`Invalid number format for ${this._field}`);
                        return;
                    }
                } else if (inputType === 'date') {
                    value = this.inputElement.value === '' ? null : new Date(value);
                    
                    // Check if the date is invalid
                    if (value instanceof Date && isNaN(value.getTime())) {
                        this._reportError(`Invalid date format for ${this._field}`);
                        return;
                    }
                }
            }
            
            if (this._immutable) {
                // For immutable mode, don't modify the original object
                this.dispatchEvent(new CustomEvent('value-change', {
                    bubbles: true,
                    composed: true,
                    detail: { 
                        field: this._field, 
                        value,
                        record: this._record
                    }
                }));
            } else {
                // Update the data directly
                this._setValueAtPath(this._record, this._field, value);
                
                // Make sure the name attribute is set for easier access in event handlers
                if (!this.hasAttribute('name')) {
                    this.setAttribute('name', this._field);
                }
                
                // Notify about the change
                this.dispatchEvent(new CustomEvent('data-changed', {
                    bubbles: true,
                    composed: true,
                    detail: { 
                        field: this._field, 
                        value,
                        record: this._record
                    }
                }));
            }
            
            this._updateFormValidity();
        } catch (error) {
            console.error(`Error processing input for field ${this._field}:`, error);
            this._reportError(`Failed to process input: ${error.message}`);
        }
    }
}

customElements.define('bindable-input', BindableInput);
