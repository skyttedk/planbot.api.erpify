export class WindowForm {
    /**
     * @param {Object} config - The window configuration object (includes window properties and formConfig)
     * @param {Object} socketService - Your WebSocket service instance (used for sending messages)
     */
    constructor(config, socketService) {
        this.config = config;
        this.socketService = socketService;
        this.record = {};
        this._createWindow();
        this._generateForm();
    }

    _createWindow() {
        // Create the main window element
        this.windowElement = document.createElement('div');
        this.windowElement.className = 'window';
        // Apply window position and size from config
        this.windowElement.style.top = (this.config.position.top || 50) + 'px';
        this.windowElement.style.left = (this.config.position.left || 50) + 'px';
        this.windowElement.style.width = (this.config.size.width || 700) + 'px';
        this.windowElement.style.height = (this.config.size.height || 400) + 'px';

        // Create header
        const header = document.createElement('div');
        header.className = 'window-header';

        const title = document.createElement('h2');
        title.textContent = this.config.title || 'Window';
        header.appendChild(title);

        // Window controls (for example, close button)
        const controls = document.createElement('div');
        controls.className = 'window-controls';
        const closeButton = document.createElement('button');
        closeButton.textContent = 'X';
        closeButton.addEventListener('click', () => this.close());
        controls.appendChild(closeButton);
        header.appendChild(controls);

        this.windowElement.appendChild(header);

        // Initialize dragging behavior on header
        this._makeDraggable(header);

        // Optional: add a menu bar if specified in config
        if (this.config.menu) {
            const menuBar = document.createElement('div');
            menuBar.className = 'menu-bar';
            // Populate menu items based on this.config.menu if needed
            this.windowElement.appendChild(menuBar);
        }

        // Create the window body (where the form will be injected)
        const body = document.createElement('div');
        body.className = 'window-body';
        this.body = body;
        this.windowElement.appendChild(body);

        // Create footer (can be used for status messages or controls)
        const footer = document.createElement('div');
        footer.className = 'window-footer';
        footer.textContent = this.config.footerText || '';
        this.windowElement.appendChild(footer);

        // Add resize handle and initialize resizing behavior
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        this.windowElement.appendChild(resizeHandle);
        this._makeResizable(resizeHandle);
    }

    _makeDraggable(header) {
        let isDragging = false;
        let offsetX = 0, offsetY = 0;

        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            offsetX = e.clientX - this.windowElement.offsetLeft;
            offsetY = e.clientY - this.windowElement.offsetTop;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            e.preventDefault();
        });

        const onMouseMove = (e) => {
            if (!isDragging) return;
            this.windowElement.style.left = (e.clientX - offsetX) + 'px';
            this.windowElement.style.top = (e.clientY - offsetY) + 'px';
        };

        const onMouseUp = () => {
            isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
    }

    _makeResizable(resizeHandle) {
        let isResizing = false;
        let startX = 0, startY = 0;
        let startWidth = 0, startHeight = 0;

        resizeHandle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = this.windowElement.offsetWidth;
            startHeight = this.windowElement.offsetHeight;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            e.preventDefault();
            e.stopPropagation();
        });

        const onMouseMove = (e) => {
            if (!isResizing) return;
            const newWidth = startWidth + (e.clientX - startX);
            const newHeight = startHeight + (e.clientY - startY);
            // Enforce minimum dimensions if needed
            this.windowElement.style.width = (newWidth > 300 ? newWidth : 300) + 'px';
            this.windowElement.style.height = (newHeight > 200 ? newHeight : 200) + 'px';
        };

        const onMouseUp = () => {
            isResizing = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
    }

    // A simple debounce helper method
    _debounce(fn, delay) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    _generateForm() {
        // Build the form using the provided formConfig in the window config.
        // Expecting formConfig to include properties: id, caption, layout, and permissions.
        const formCfg = this.config.formConfig;
        this.formElement = document.createElement('form');
        this.formElement.id = formCfg.id || 'recordForm';

        // Form title inside the form (or you can display it in the window header)
        const formTitle = document.createElement('div');
        formTitle.id = 'formTitle';
        formTitle.textContent = (formCfg.caption && formCfg.caption.default) || 'Form';
        this.formElement.appendChild(formTitle);

        const fieldMap = {};
        const groupMap = {};

        // Process each group defined in the layout
        (formCfg.layout.groups || []).forEach(group => {
            const section = document.createElement('div');
            section.className = 'form-section';
            section.id = group.id;
            groupMap[group.id] = section;

            const title = document.createElement('div');
            title.className = 'section-title';
            title.textContent = (group.caption && group.caption.default) || '';
            section.appendChild(title);

            const grid = document.createElement('div');
            grid.className = 'field-grid';
            section.appendChild(grid);

            group.fields.forEach(field => {
                const groupDiv = document.createElement('div');
                groupDiv.className = 'form-group';
                if (field.fullWidth) {
                    groupDiv.classList.add('full-width');
                }

                const label = document.createElement('label');
                label.htmlFor = field.name;
                label.textContent = (field.caption && field.caption.default) || field.name;
                groupDiv.appendChild(label);

                // Create bindable-input element
                const input = document.createElement('bindable-input');
                // For lookup types, we use a select input
                const inputType = (field.type === 'lookup') ? 'select' : field.type;
                input.setAttribute('type', inputType);
                input.setAttribute('field', field.name);
                input.setAttribute('aria-label', (field.caption && field.caption.default) || field.name);
                if (field.required) input.setAttribute('required', '');
                if (field.maxLength) input.setAttribute('maxLength', field.maxLength);
                if (field.pattern) input.setAttribute('pattern', field.pattern);
                if (field.defaultValue !== undefined && field.defaultValue !== null) {
                    this.record[field.name] = field.defaultValue;
                }
                // Apply permissions: if field is not editable
                if (
                    formCfg.permissions &&
                    formCfg.permissions.fields &&
                    formCfg.permissions.fields[field.name] &&
                    formCfg.permissions.fields[field.name].editable === false
                ) {
                    input.setAttribute('readonly', '');
                }
                // Setup options for select or lookup fields
                if (field.type === 'select' || field.type === 'lookup') {
                    let options = [];
                    if (field.type === 'lookup') {
                        // For lookup fields, you might fetch real data; here we use mock data
                        const mockOptions = [
                            { id: '1', name: 'John Doe' },
                            { id: '2', name: 'Jane Smith' }
                        ];
                        options = mockOptions.map(opt => ({
                            value: opt[field.valueField || 'id'],
                            label: opt[field.displayField || 'name']
                        }));
                    } else {
                        options = field.options.map(opt => ({
                            value: opt.value,
                            label: (opt.label && opt.label.default) || opt.value
                        }));
                    }
                    input.setAttribute('options', JSON.stringify(options));
                }
                input.record = this.record;

                groupDiv.appendChild(input);
                grid.appendChild(groupDiv);
                fieldMap[field.name] = input;
            });

            this.formElement.appendChild(section);
        });

        // Remove the submit button – auto-save is now in place.
        // Instead, we'll display a brief status message on auto-save.
        const statusDiv = document.createElement('div');
        statusDiv.id = 'statusMessage';
        statusDiv.className = 'success';
        this.formElement.appendChild(statusDiv);

        // Setup Conditional Logic for groups and fields (unchanged)
        (formCfg.layout.groups || []).forEach(group => {
            if (group.conditional) {
                const condition = group.conditional.showWhen;
                const triggerField = fieldMap[condition.field];
                if (triggerField) {
                    triggerField.addEventListener('data-changed', () => {
                        const triggerValue = this.record[condition.field];
                        const conditionValue = condition.value;
                        let shouldShow = triggerValue == conditionValue;
                        if (condition.operator === 'notEquals') {
                            shouldShow = !shouldShow;
                        }
                        groupMap[group.id].style.display = shouldShow ? 'block' : 'none';
                    });
                    triggerField.dispatchEvent(new CustomEvent('data-changed', { bubbles: true }));
                }
            }
            group.fields.forEach(field => {
                if (field.conditional) {
                    const condition = field.conditional.showWhen;
                    const triggerField = fieldMap[condition.field];
                    if (triggerField) {
                        const dependentFieldDiv = fieldMap[field.name].parentElement;
                        triggerField.addEventListener('data-changed', () => {
                            const triggerValue = this.record[condition.field];
                            const conditionValue = condition.value;
                            let shouldShow = triggerValue == conditionValue;
                            if (condition.operator === 'notEquals') {
                                shouldShow = !shouldShow;
                            }
                            dependentFieldDiv.style.display = shouldShow ? 'flex' : 'none';
                        });
                        triggerField.dispatchEvent(new CustomEvent('data-changed', { bubbles: true }));
                    }
                }
            });
        });

        // Attach any event handlers specified for fields (unchanged)
        const eventHandlers = {
            validateName: () => console.log('Validating customer ID'),
            validateEmail: () => console.log('Validating email'),
            handleSubscriptionChange: () => console.log('Subscription type changed')
        };

        (formCfg.layout.groups || []).forEach(group => {
            group.fields.forEach(field => {
                if (field.events) {
                    for (const [event, funcName] of Object.entries(field.events)) {
                        const input = fieldMap[field.name];
                        if (input && eventHandlers[funcName]) {
                            input.addEventListener(event, eventHandlers[funcName]);
                        }
                    }
                }
            });
        });

        // Set up auto-save functionality. Each bindable-input's "data-changed" event will trigger autoSave.
        const autoSave = this._debounce(() => {
            console.log("Auto-saving record", this.record);
            this.socketService.sendMessage({
                action: 'updateRecord',
                data: this.record,
                requestId: `req-update-record-${this.config.windowId}`
            });
            // Optionally show a brief "Saved" message
            statusDiv.textContent = 'Record saved';
            setTimeout(() => (statusDiv.textContent = ''), 1500);
        }, 500);

        // Attach auto-save listener to each field
        Object.values(fieldMap).forEach(input => {
            input.addEventListener('data-changed', autoSave);
        });

        // Append the form to the window body
        this.body.appendChild(this.formElement);
    }

    getElement() {
        return this.windowElement;
    }

    close() {
        this.windowElement.remove();
    }
}
