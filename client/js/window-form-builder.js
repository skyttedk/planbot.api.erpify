export class WindowForm {
    /**
     * @param {Object} config - The window configuration object (includes window properties and formConfig)
     * @param {Object} socketService - Your WebSocket service instance (used for sending messages)
     */
    constructor(config, socketService) {
        this.config = config;
        this.socketService = socketService;
        this.record = {};
        this.dirtyFields = new Set(); // Track which fields have unsaved changes
        this.isSaving = false; // Track if save operation is in progress
        this.isClosing = false; // Track if form is in the process of closing
        this.currentFocusElement = null; // Track currently focused element
        this.messageHandlers = []; // Track added message handlers
        
        this._createWindow();
        this._generateForm();
        
        // Add escape key handler
        this._setupKeyboardHandlers();
        
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
        
        // Create the navigation toolbar in the footer
        this._createNavigationToolbar(footer);
        
        // Add footer text if specified
        const footerText = document.createElement('div');
        footerText.className = 'footer-text';
        footerText.textContent = this.config.footerText || '';
        footer.appendChild(footerText);
        
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

    _setupKeyboardHandlers() {
        // Add keyboard event listener to the document with capture:true to ensure we get the event first
        this.keydownHandler = this._handleKeydown.bind(this);
        document.addEventListener('keydown', this.keydownHandler, { capture: true });
        
        // Track focused element
        this.focusHandler = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
                this.currentFocusElement = e.target;
            }
        };
        this.windowElement.addEventListener('focusin', this.focusHandler);
    }
    
    _handleKeydown(event) {
        // Only process if the form is actually visible in the DOM
        if (!this.windowElement.isConnected) {
            return;
        }
        
        // Check if Escape key was pressed
        if (event.key === 'Escape') {
            // Immediately stop propagation to prevent other handlers from processing it
            event.stopPropagation();
            event.preventDefault();
            
            // Handle the escape key immediately
            this._handleEscapeKey();
        }
    }
    
    _handleEscapeKey() {
        // Prevent processing if form is already closing or saving
        if (this.isClosing || this.isSaving) {
            return;
        }
        
        // If the form has unsaved changes
        if (this.dirtyFields.size > 0) {
            // Show confirmation dialog
            const confirmAction = window.confirm('You have unsaved changes! Do you want to save before closing?');
            
            if (confirmAction) {
                // User wants to save changes
                this._saveAndClose();
            } else {
                // User doesn't want to save changes
                this.close();
            }
        } else {
            // No unsaved changes, close directly
            this.close();
        }
    }
    
    _saveAndClose() {
        if (this.isClosing || this.isSaving) {
            return; // Prevent multiple save attempts or saving when already closing
        }
        
        // Mark form as closing to prevent other operations
        this.isClosing = true;
        
        const formCfg = this.config.formConfig;
        if (!formCfg || !formCfg.model) {
            console.error("Cannot save: model name is missing in form configuration");
            this._showFormError("Cannot save: Form configuration is incomplete");
            this.isClosing = false; // Reset closing state if we can't proceed
            return;
        }
        
        const recordId = this.record.id;
        if (!recordId) {
            console.warn("Cannot update record: record ID is missing");
            this._showFormError("Cannot save: No record ID found");
            this.isClosing = false; // Reset closing state if we can't proceed
            return;
        }
        
        // Create an object with only the dirty fields
        const changedData = {};
        this.dirtyFields.forEach(field => {
            changedData[field] = this.record[field];
        });
        
        if (Object.keys(changedData).length === 0) {
            // No changes to save
            this.close();
            return;
        }
        
        // Show saving indicator
        const statusDiv = this.formElement.querySelector('#statusMessage');
        if (statusDiv) {
            statusDiv.textContent = 'Saving...';
            statusDiv.className = 'saving';
        }
        
        // Set saving flag
        this.isSaving = true;
        
        // Generate a unique request ID for this update
        const modelName = formCfg.model;
        const requestId = `req-update-close-${modelName}-${Date.now()}`;
        
        // Send the update request
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
        
        // Set a timeout for the save operation
        const saveTimeout = setTimeout(() => {
            this.isSaving = false;
            this.isClosing = false; // Reset closing state on timeout
            if (statusDiv) {
                statusDiv.textContent = 'Save operation timed out';
                statusDiv.className = 'error';
            }
            
            // Return focus to the element that had focus when escape was pressed
            if (this.currentFocusElement) {
                this.currentFocusElement.focus();
            }
        }, 10000);
        
        // Listen for the response
        const responseHandler = (message) => {
            if (message.requestId === requestId) {
                // Remove the listener and clear the timeout
                this.socketService.off('message', responseHandler);
                clearTimeout(saveTimeout);
                this.isSaving = false;
                
                if (message.success) {
                    // Update was successful, close the form
                    this.close(); // This already sets isClosing to true
                } else {
                    // Update failed, show error and return focus
                    console.error('Error updating record:', message.error);
                    this.isClosing = false; // Reset closing state on error
                    
                    if (statusDiv) {
                        statusDiv.textContent = `Error: ${message.error || 'Save failed'}`;
                        statusDiv.className = 'error';
                    } else {
                        this._showFormError(`Error: ${message.error || 'Save failed'}`);
                    }
                    
                    // Return focus to the element that had focus when escape was pressed
                    if (this.currentFocusElement) {
                        this.currentFocusElement.focus();
                    }
                }
            }
        };
        
        // Add the response handler and track it
        this.socketService.on('message', responseHandler);
        this.messageHandlers.push(responseHandler);
    }

    _generateForm() {
        // Build the form using the provided formConfig in the window config.
        // Expecting formConfig to include properties: id, caption, layout, and permissions.
        const formCfg = this.config.formConfig;
        this.formElement = document.createElement('form');
        this.formElement.id = formCfg.id || 'recordForm';

        // Form title has been removed to avoid duplication with window header
        // The caption is now displayed only in the window title bar

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
            title.textContent = group.caption || '';
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
                label.textContent = field.caption || field.name;
                groupDiv.appendChild(label);

                // Create bindable-input element
                const input = document.createElement('bindable-input');
                // For lookup types, we use a select input
                const inputType = (field.type === 'lookup') ? 'select' : field.type;
                input.setAttribute('type', inputType);
                input.setAttribute('field', field.name);
                input.setAttribute('name', field.name);
                input.setAttribute('aria-label', field.caption || field.name);
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
                            label: opt.caption || opt.label || opt.value
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
            // Skip auto-save if form is closing or already saving
            if (this.isClosing || this.isSaving) {
                return;
            }
            
            // Get the field that was changed from the event detail
            const changedField = event?.detail?.field || event?.target?.name;
            if (!changedField) {
                console.warn("Auto-save triggered but couldn't determine which field changed");
                return;
            }
            
            // Remove field from dirty fields list since we're about to save it
            this.dirtyFields.delete(changedField);
            
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
                        
                        // Update the entire record with the returned data from server
                        if (message.result) {
                            // Store the previously changed field name to check if it was visually updated
                            const changedFieldName = changedField;
                            
                            // Update the complete record with server response
                            Object.assign(this.record, message.result);
                            
                            // Update all form fields to reflect the new data
                            // This ensures any server-side changes (like field value transformations
                            // or changes to other fields from triggers) are immediately visible
                            this._updateFormFields();
                            
                            // Update the record indicator
                            this._updateRecordIndicator();
                        }
                    } else {
                        // Update failed
                        console.error('Error updating record:', message.error);
                        statusDiv.textContent = `Error: ${message.error || 'Save failed'}`;
                        statusDiv.className = 'error';
                        
                        // Add the field back to dirtyFields because the save failed
                        this.dirtyFields.add(changedField);
                        
                        setTimeout(() => {
                            statusDiv.textContent = '';
                            statusDiv.className = '';
                        }, 3000);
                    }
                }
            };
            
            // Add the response handler and track it
            this.socketService.on('message', responseHandler);
            this.messageHandlers.push(responseHandler);
        }, 10);

        // Track input changes for dirty state and attach auto-save listener to each field
        const trackChangesHandler = (event) => {
            const changedField = event?.detail?.field;
            if (changedField) {
                // Mark the field as dirty
                this.dirtyFields.add(changedField);
            }
        };

        // Attach change tracking and auto-save to all inputs
        Object.values(fieldMap).forEach(input => {
            // Add change tracking to all inputs (happens on every input change)
            input.addEventListener('input', trackChangesHandler);
            
            // Add auto-save listener (this will trigger on data-changed events)
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
        
        // Add the message handler before sending the request
        const requestId = `req-find-first-${modelName}-${Date.now()}`;
        
        // Set up the response handler with proper event listener
        const responseHandler = (message) => {
            // Check if this is the response to our findFirst request
            console.log(`Checking message response for findFirst ${modelName}:`, 
                message.requestId, 
                requestId,
                message.requestId && message.requestId.startsWith(`req-find-first-${modelName}`));
                
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
                    
                    // Update the record indicator
                    this._updateRecordIndicator();
                } else {
                    console.warn(`Failed to load default record for ${modelName}:`, 
                        message.success ? 'No data received' : message.message || 'Unknown error');
                        
                    if (!message.success) {
                        this._showFormError(`Failed to load data: ${message.message || 'Unknown error'}`);
                    }
                }
            }
        };
        
        // Add the message handler to track list for cleanup
        this.messageHandlers.push(responseHandler);
        this.socketService.on('message', responseHandler);
        
        // Create message with token
        const message = this._ensureTokenInMessage({
            type: 'model',
            name: modelName,
            action: 'findFirst',
            parameters: {}, // Server expects parameters as an object
            requestId: requestId
        });
        
        // Request the first record from the server
        this.socketService.sendMessage(message);
        
        // Set a timeout to prevent hanging if the server doesn't respond
        const timeoutId = setTimeout(() => {
            this.socketService.off('message', responseHandler);
            console.warn(`findFirst request for ${modelName} timed out after 10 seconds`);
            this._showFormError(`Failed to load data. Please try again later.`);
        }, 10000);
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
        
        // Add the event listener and track it
        this.socketService.on('message', responseHandler);
        this.messageHandlers.push(responseHandler);
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

    /**
     * Returns the window element to be added to the DOM
     * @returns {HTMLElement} The window element
     */
    getElement() {
        return this.windowElement;
    }

    close() {
        // Mark form as closing to prevent further auto-saves
        this.isClosing = true;
        
        // Clean up event listeners to prevent memory leaks
        this._cleanupEventListeners();
        
        // Remove the window from the DOM
        this.windowElement.remove();
    }
    
    // Clean up event listeners to prevent memory leaks
    _cleanupEventListeners() {
        // Remove global keyboard handler
        if (this.keydownHandler) {
            document.removeEventListener('keydown', this.keydownHandler);
        }
        
        // Remove focus tracking handler
        if (this.focusHandler) {
            this.windowElement.removeEventListener('focusin', this.focusHandler);
        }
        
        // Find all bindable inputs and remove record references
        const inputs = this.formElement.querySelectorAll('bindable-input');
        inputs.forEach(input => {
            // Don't use the setter which has validation
            // Instead, directly set the internal property or use a property we know exists
            if (input._record) {
                // Create a temporary empty object to satisfy the non-null requirement
                input._record = {};
            }
        });
        
        // Remove only the message event listeners we've explicitly added
        // instead of removing all message listeners from the socket service
        if (this.messageHandlers && this.messageHandlers.length > 0) {
            this.messageHandlers.forEach(handler => {
                this.socketService.off('message', handler);
            });
            this.messageHandlers = []; // Clear the handlers array
        }
    }

    /**
     * Creates a record navigation toolbar with buttons for first, previous, next, and last record
     * @param {HTMLElement} container - The container element to append the toolbar to
     */
    _createNavigationToolbar(container) {
        const formCfg = this.config.formConfig;
        
        // Only create the toolbar if we have a model defined
        if (!formCfg || !formCfg.model) return;
        
        const navToolbar = document.createElement('div');
        navToolbar.className = 'record-navigation-toolbar';
        
        // First record button
        const firstButton = document.createElement('button');
        firstButton.className = 'nav-button first-record';
        firstButton.innerHTML = '&laquo;'; // Double left arrow
        firstButton.title = 'First Record';
        firstButton.addEventListener('click', () => this._navigateToRecord('first'));
        navToolbar.appendChild(firstButton);
        
        // Previous record button
        const prevButton = document.createElement('button');
        prevButton.className = 'nav-button prev-record';
        prevButton.innerHTML = '&lsaquo;'; // Single left arrow
        prevButton.title = 'Previous Record';
        prevButton.addEventListener('click', () => this._navigateToRecord('previous'));
        navToolbar.appendChild(prevButton);
        
        // Record indicator
        this.recordIndicator = document.createElement('span');
        this.recordIndicator.className = 'record-indicator';
        this.recordIndicator.textContent = 'Record: -';
        navToolbar.appendChild(this.recordIndicator);
        
        // Next record button
        const nextButton = document.createElement('button');
        nextButton.className = 'nav-button next-record';
        nextButton.innerHTML = '&rsaquo;'; // Single right arrow
        nextButton.title = 'Next Record';
        nextButton.addEventListener('click', () => this._navigateToRecord('next'));
        navToolbar.appendChild(nextButton);
        
        // Last record button
        const lastButton = document.createElement('button');
        lastButton.className = 'nav-button last-record';
        lastButton.innerHTML = '&raquo;'; // Double right arrow
        lastButton.title = 'Last Record';
        lastButton.addEventListener('click', () => this._navigateToRecord('last'));
        navToolbar.appendChild(lastButton);
        
        container.appendChild(navToolbar);
    }

    /**
     * Navigates to a specific record based on the direction
     * @param {string} direction - 'first', 'previous', 'next', or 'last'
     */
    _navigateToRecord(direction) {
        if (this.isNavigating) {
            console.log('Navigation already in progress, ignoring request');
            return;
        }
        
        // Set flag to prevent multiple navigation requests
        this.isNavigating = true;
        
        const formCfg = this.config.formConfig;
        if (!formCfg || !formCfg.model) {
            console.warn('Cannot navigate: model name is missing in form configuration');
            this.isNavigating = false;
            return;
        }
        
        // Check if we have a current record and ID
        if (!this.record || !this.record.id) {
            console.warn('Cannot navigate: no current record or record ID');
            // In this case, attempt to load the first record anyway
            if (direction === 'first') {
                this._loadDefaultRecord();
            }
            this.isNavigating = false;
            return;
        }
        
        const modelName = formCfg.model;
        const currentId = this.record.id;
        let action;
        let parameters = {};
        
        // Determine which action to use based on the direction
        switch (direction) {
            case 'first':
                action = 'findFirst';
                // Empty parameters object is fine for findFirst
                break;
                
            case 'previous':
                action = 'findPrevious';
                parameters = {
                    id: currentId
                };
                break;
                
            case 'next':
                action = 'findNext';
                parameters = {
                    id: currentId
                };
                break;
                
            case 'last':
                action = 'findLast';
                // Empty parameters object is fine for findLast
                break;
                
            default:
                console.warn(`Unknown navigation direction: ${direction}`);
                this.isNavigating = false;
                return;
        }
        
        // Generate a unique request ID
        const requestId = `req-${action}-${modelName}-${Date.now()}`;
        
        console.log(`Navigating ${direction} from record ${currentId} in model ${modelName}`);
        
        // Create message with token
        const message = this._ensureTokenInMessage({
            type: 'model',
            name: modelName,
            action: action,
            parameters: parameters,
            requestId: requestId
        });
        
        // Send the message
        this.socketService.sendMessage(message);
        
        // Set up a timeout
        const timeoutId = setTimeout(() => {
            this.socketService.off('message', responseHandler);
            console.warn(`${direction} request for ${modelName} timed out after 10 seconds`);
            this._showFormError(`Failed to navigate ${direction}. Please try again later.`);
        }, 10000);
        
        // Listen for the response
        const responseHandler = (message) => {
            if (message.requestId === requestId) {
                // Clear the timeout and remove the event listener
                clearTimeout(timeoutId);
                this.socketService.off('message', responseHandler);
                
                if (message.success && message.result) {
                    console.log(`Received ${direction} record for ${modelName}:`, message.result);
                    
                    // Update the record with the received data
                    Object.assign(this.record, message.result);
                    
                    // Update all form fields with the new data
                    this._updateFormFields();
                    
                    // Update the record indicator
                    this._updateRecordIndicator();
                } else {
                    console.warn(`Failed to navigate ${direction} for ${modelName}:`, message.error || 'Unknown error');
                    this._showFormError(`Error navigating ${direction}: ${message.error || 'Unknown error'}`);
                }
            }
        };
        
        // Add the event listener and track it
        this.socketService.on('message', responseHandler);
        this.messageHandlers.push(responseHandler);
    }

    /**
     * Updates the record indicator with the current record ID
     */
    _updateRecordIndicator() {
        if (this.recordIndicator && this.record && this.record.id) {
            this.recordIndicator.textContent = `Record: ${this.record.id}`;
        } else if (this.recordIndicator) {
            this.recordIndicator.textContent = 'Record: -';
        }
    }

    /**
     * Handles internal authentication errors without showing login dialog
     * @private
     */
    _handleAuthError(error) {
        console.warn('WindowForm handling auth error internally:', error);
        
        // Show a message inside the form
        const errorEl = document.createElement('div');
        errorEl.className = 'form-error auth-error';
        errorEl.textContent = 'Authentication error: Your session may have expired. Please refresh the page.';
        
        // Add a refresh button
        const refreshBtn = document.createElement('button');
        refreshBtn.textContent = 'Refresh Page';
        refreshBtn.className = 'auth-refresh-btn';
        refreshBtn.addEventListener('click', () => window.location.reload());
        
        errorEl.appendChild(document.createElement('br'));
        errorEl.appendChild(refreshBtn);
        
        // Find a good place to show this message
        const formContent = this.windowElement.querySelector('.window-body');
        if (formContent) {
            formContent.prepend(errorEl);
        } else {
            this.windowElement.appendChild(errorEl);
        }
    }

    /**
     * Helper method to ensure a token is included in all requests
     * @param {Object} message - The message to send
     * @returns {Object} - The message with a token added if needed
     * @private
     */
    _ensureTokenInMessage(message) {
        // Clone the message to avoid modifying the original
        const result = { ...message };
        
        // Add token if not already present
        if (!result.token) {
            result.token = this.socketService.getAuthToken();
        }
        
        return result;
    }
}
