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
        
        // Load default record after form is generated
        this._loadDefaultRecord();
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
                input.setAttribute('name', field.name);
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
                        // For lookup fields, we'll fetch data from the server
                        // Set empty options initially, they will be populated when data is fetched
                        options = [];
                        
                        // Request data from the server for this lookup field
                        if (field.dataSource) {
                            this._fetchLookupOptions(field, input);
                        } else {
                            console.warn(`Lookup field ${field.name} has no dataSource specified`);
                        }
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
        const autoSave = this._debounce((event) => {
            // Get the field that was changed from the event detail
            const changedField = event?.detail?.field || event?.target?.name;
            if (!changedField) {
                console.warn("Auto-save triggered but couldn't determine which field changed");
                return;
            }
            
            // Get the model name from the form config
            const modelName = formCfg.model;
            if (!modelName) {
                console.error("Cannot update record: model name is missing in form configuration");
                this._showFormError("Cannot save: Form configuration is incomplete");
                return;
            }
            
            console.log(`Auto-saving field ${changedField} for model ${modelName}`, this.record[changedField]);
            
            // Get the record ID
            const recordId = this.record.id;
            if (!recordId) {
                console.warn("Cannot update record: record ID is missing");
                this._showFormError("Cannot save: No record ID found");
                return;
            }
            
            // Create an object with only the changed field
            const changedData = {
                [changedField]: this.record[changedField]
            };
            
            // Show saving indicator
            statusDiv.textContent = 'Saving...';
            statusDiv.className = 'saving';
            
            // Set a timeout for the save operation
            const saveTimeout = setTimeout(() => {
                statusDiv.textContent = 'Save operation timed out';
                statusDiv.className = 'error';
                setTimeout(() => {
                    statusDiv.textContent = '';
                    statusDiv.className = '';
                }, 3000);
            }, 10000);
            
            // Generate a unique request ID for this update
            const requestId = `req-update-${modelName}-${Date.now()}`;
            
            // Send the update request with the correct format for the server
            // The server expects parameters as an object with id and data properties
            this.socketService.sendMessage({
                type: 'model',
                name: modelName,
                action: 'update',
                parameters: {
                    id: recordId,
                    data: changedData
                },
                requestId: requestId
            });
            
            // Listen for the response to this specific update request
            const responseHandler = (message) => {
                if (message.requestId === requestId) {
                    // Remove the listener and clear the timeout
                    this.socketService.off('message', responseHandler);
                    clearTimeout(saveTimeout);
                    
                    if (message.success) {
                        // Update was successful
                        statusDiv.textContent = 'Saved';
                        statusDiv.className = 'success';
                        setTimeout(() => {
                            statusDiv.textContent = '';
                            statusDiv.className = '';
                        }, 1500);
                        
                        // Update record with any returned data from server
                        if (message.result) {
                            Object.assign(this.record, message.result);
                        }
                    } else {
                        // Update failed
                        console.error('Error updating record:', message.error);
                        statusDiv.textContent = `Error: ${message.error || 'Save failed'}`;
                        statusDiv.className = 'error';
                        setTimeout(() => {
                            statusDiv.textContent = '';
                            statusDiv.className = '';
                        }, 3000);
                    }
                }
            };
            
            // Add the response handler
            this.socketService.on('message', responseHandler);
        }, 500);

        // Attach auto-save listener to each field
        Object.values(fieldMap).forEach(input => {
            input.addEventListener('data-changed', autoSave);
        });

        // Append the form to the window body
        this.body.appendChild(this.formElement);
    }

    // Load the first record from the model
    _loadDefaultRecord() {
        const formCfg = this.config.formConfig;
        if (!formCfg || !formCfg.model) {
            console.warn('Cannot load default record: model name is missing in form configuration');
            return;
        }
        
        const modelName = formCfg.model;
        console.log(`Loading default record for model ${modelName}`);
        
        // Request the first record from the server with the correct format
        this.socketService.sendMessage({
            type: 'model',
            name: modelName,
            action: 'findFirst',
            parameters: {}, // Server expects parameters as an object
            requestId: `req-find-first-${modelName}-${Date.now()}`
        });
        
        // Set a timeout to prevent hanging if the server doesn't respond
        const timeoutId = setTimeout(() => {
            this.socketService.off('message', responseHandler);
            console.warn(`findFirst request for ${modelName} timed out after 10 seconds`);
            this._showFormError(`Failed to load data. Please try again later.`);
        }, 10000);
        
        // Listen for the response
        const responseHandler = (message) => {
            // Check if this is the response to our findFirst request
            if (message.requestId && message.requestId.startsWith(`req-find-first-${modelName}`)) {
                // Clear timeout and remove the event listener
                clearTimeout(timeoutId);
                this.socketService.off('message', responseHandler);
                
                if (message.success && message.result) {
                    console.log(`Received default record for ${modelName}:`, message.result);
                    
                    // Update the record with the received data
                    Object.assign(this.record, message.result);
                    
                    // Update all form fields with the new data
                    this._updateFormFields();
                } else {
                    console.warn(`Failed to load default record for ${modelName}:`, message.error || 'Unknown error');
                    this._showFormError(`Error loading data: ${message.error || 'Unknown error'}`);
                }
            }
        };
        
        // Add the event listener
        this.socketService.on('message', responseHandler);
    }
    
    // Update all form fields with the current record data
    _updateFormFields() {
        // Find all bindable-input elements in the form
        const inputs = this.formElement.querySelectorAll('bindable-input');
        
        // Update each input with the current record
        inputs.forEach(input => {
            input.record = this.record;
            input.updateValue();
        });
    }

    // Fetch lookup options from the server
    _fetchLookupOptions(field, inputElement) {
        const modelName = field.dataSource;
        const displayField = field.displayField || 'name';
        const valueField = field.valueField || 'id';
        
        console.log(`Fetching lookup options for ${field.name} from model ${modelName}`);
        
        // Generate a unique request ID for this lookup
        const requestId = `req-find-all-${modelName}-${field.name}-${Date.now()}`;
        
        // Send request to get all records for this model
        this.socketService.sendMessage({
            type: 'model',
            name: modelName,
            action: 'findAll', // Using findAll to get all records for this model
            parameters: {},
            requestId: requestId
        });
        
        // Set a timeout to prevent hanging if the server doesn't respond
        const timeoutId = setTimeout(() => {
            this.socketService.off('message', responseHandler);
            console.warn(`Lookup request for ${field.name} timed out after 10 seconds`);
            // Update the input element with an error message
            inputElement.setAttribute('options', JSON.stringify([
                { value: '', label: `Error: Timeout loading ${field.name} options` }
            ]));
        }, 10000);
        
        // Listen for the response
        const responseHandler = (message) => {
            // Check if this is the response to our lookup request
            if (message.requestId === requestId) {
                // Clear the timeout and remove the event listener
                clearTimeout(timeoutId);
                this.socketService.off('message', responseHandler);
                
                if (message.success && Array.isArray(message.result)) {
                    console.log(`Received lookup options for ${field.name}:`, message.result);
                    
                    // Format the options for the input element
                    const options = message.result.map(item => ({
                        value: item[valueField] !== undefined ? item[valueField] : '',
                        label: item[displayField] !== undefined ? item[displayField] : '(No name)'
                    }));
                    
                    // Update the input element with the new options
                    inputElement.setAttribute('options', JSON.stringify(options));
                    
                    // If the record already has a value for this field, make sure it's selected
                    if (this.record && this.record[field.name]) {
                        inputElement.updateValue();
                    }
                } else {
                    console.warn(`Failed to load lookup options for ${field.name}:`, message.error || 'Unknown error');
                    // Show empty options with an error message
                    inputElement.setAttribute('options', JSON.stringify([
                        { value: '', label: `Error loading ${field.name} options: ${message.error || 'Unknown error'}` }
                    ]));
                }
            }
        };
        
        // Add the event listener
        this.socketService.on('message', responseHandler);
    }

    // Helper method to show an error message in the form
    _showFormError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'form-error';
        errorDiv.textContent = message;
        
        // Find the form title element and add the error after it
        const formTitle = this.formElement.querySelector('#formTitle');
        if (formTitle && formTitle.parentNode) {
            formTitle.parentNode.insertBefore(errorDiv, formTitle.nextSibling);
            
            // Auto-remove after 5 seconds
            setTimeout(() => {
                errorDiv.remove();
            }, 5000);
        }
    }

    getElement() {
        return this.windowElement;
    }

    close() {
        // Clean up event listeners to prevent memory leaks
        this._cleanupEventListeners();
        
        // Remove the window from the DOM
        this.windowElement.remove();
    }
    
    // Clean up event listeners to prevent memory leaks
    _cleanupEventListeners() {
        // Find all bindable inputs and remove record references
        const inputs = this.formElement.querySelectorAll('bindable-input');
        inputs.forEach(input => {
            input.record = null; // Break circular references
        });
        
        // Remove all message event listeners from the socket service
        // This is a defensive approach since we might not have all references to added listeners
        this.socketService.off('message');
    }
}
