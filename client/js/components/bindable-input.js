class BindableInput extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._record = null;
        this._field = null;
        this._debounceDelay = 300;
        this._createInput();
    }

    static get observedAttributes() {
        return ['type', 'field', 'debounce', 'options', 'aria-label'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        switch (name) {
            case 'type':
                if (oldValue !== newValue) {
                    this._createInput();
                    this.updateValue();
                }
                break;
            case 'field':
                this._field = newValue;
                this.updateValue();
                break;
            case 'debounce':
                this._debounceDelay = Number(newValue) || 300;
                break;
            case 'options':
                if (this.getAttribute('type') === 'select') {
                    this._createInput();
                    this.updateValue();
                }
                break;
            case 'aria-label':
                if (this.inputElement) {
                    this.inputElement.setAttribute('aria-label', newValue);
                }
                break;
        }
    }

    connectedCallback() {
        if (this.hasAttribute('field')) {
            this._field = this.getAttribute('field');
        }
        if (this.hasAttribute('debounce')) {
            this._debounceDelay = Number(this.getAttribute('debounce')) || 300;
        }
    }

    disconnectedCallback() {
        if (this.inputElement) {
            this.inputElement.removeEventListener('input', this._inputHandler);
            this.inputElement.removeEventListener('change', this._inputHandler);
        }
    }

    _createInput() {
        if (this.inputElement && this.shadowRoot.contains(this.inputElement)) {
            this.inputElement.removeEventListener('input', this._inputHandler);
            this.inputElement.removeEventListener('change', this._inputHandler);
            this.shadowRoot.removeChild(this.inputElement);
        }
        const inputType = this.getAttribute('type') || 'text';
        this._inputHandler = this._debounce(() => this.onInput(), this._debounceDelay);

        if (inputType === 'textarea') {
            this.inputElement = document.createElement('textarea');
            this.inputElement.addEventListener('input', this._inputHandler);
        } else if (inputType === 'select') {
            this.inputElement = document.createElement('select');
            let options = [];
            try {
                const optionsAttr = this.getAttribute('options');
                options = optionsAttr ? JSON.parse(optionsAttr) : [];
            } catch (e) {
                console.error('Invalid JSON for options attribute', e);
            }
            options.forEach(opt => {
                const optionEl = document.createElement('option');
                optionEl.value = opt.value;
                optionEl.textContent = opt.label;
                this.inputElement.appendChild(optionEl);
            });
            this.inputElement.addEventListener('change', this._inputHandler);
        } else {
            this.inputElement = document.createElement('input');
            this.inputElement.type = inputType;
            if (inputType === 'checkbox' || inputType === 'radio') {
                this.inputElement.addEventListener('change', this._inputHandler);
            } else {
                this.inputElement.addEventListener('input', this._inputHandler);
            }
        }
        if (this.hasAttribute('aria-label')) {
            this.inputElement.setAttribute('aria-label', this.getAttribute('aria-label'));
        }
        this.shadowRoot.appendChild(this.inputElement);
    }

    _debounce(fn, delay) {
        let timeoutId;
        return () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(fn, delay);
        };
    }

    set record(newRecord) {
        if (typeof newRecord !== 'object' || newRecord === null) {
            console.error('record must be a non-null object');
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
            console.error('field must be a non-empty string');
            return;
        }
        this._field = fieldName;
        this.setAttribute('field', fieldName);
        this.updateValue();
    }

    get field() {
        return this._field;
    }

    updateValue() {
        if (!this._record || !this._field) {
            return;
        }
        const inputType = this.getAttribute('type') || 'text';
        if (inputType === 'checkbox' || inputType === 'radio') {
            const newChecked = !!this._record[this._field];
            if (this.inputElement.checked !== newChecked) {
                this.inputElement.checked = newChecked;
            }
        } else {
            const newValue = (this._record[this._field] != null) ? this._record[this._field] : '';
            if (this.inputElement.value !== newValue) {
                this.inputElement.value = newValue;
            }
        }
    }

    onInput() {
        if (!this._record || !this._field) {
            console.error('Record or field not defined for input event');
            return;
        }
        const inputType = this.getAttribute('type') || 'text';
        let value;
        if (inputType === 'checkbox' || inputType === 'radio') {
            value = this.inputElement.checked;
        } else {
            value = this.inputElement.value;
        }
        this._record[this._field] = value;
        this.dispatchEvent(new CustomEvent('data-changed', {
            detail: { field: this._field, value }
        }));
    }
}

customElements.define('bindable-input', BindableInput);
