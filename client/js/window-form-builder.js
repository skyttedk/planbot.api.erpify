export class WindowForm {
    /**
     * @param {Object} config - The window configuration object (includes window properties and formConfig)
     * @param {Object} socketService - Your WebSocket service instance (used for sending messages)
     */
    constructor(config, socketService) {
        this.config = config;
        this.socketService = socketService;
        this.record = {};
        this.dirtyFields = new Set(); // Track unsaved fields
        this.isSaving = false;
        this.isClosing = false;
        this.isNavigating = false;
        this.currentFocusElement = null;
        this.messageHandlers = [];

        this._createWindow();
        this._generateForm();
        this._setupKeyboardHandlers();
        this._loadDefaultRecord();
    }

    /**
     * Helper to send a message and wait for its response.
     * @param {Object} message - The message object to send.
     * @param {number} timeoutDuration - Duration before timing out (ms).
     * @returns {Promise<Object>} - Resolves with the response message.
     */
    _sendRequest(message, timeoutDuration = 10000) {
        return new Promise((resolve, reject) => {
            const requestId = message.requestId;
            const responseHandler = (response) => {
                if (response.requestId === requestId) {
                    clearTimeout(timeoutId);
                    this.socketService.off('message', responseHandler);
                    resolve(response);
                }
            };
            this.socketService.on('message', responseHandler);
            this.messageHandlers.push(responseHandler);
            this.socketService.sendMessage(this._ensureTokenInMessage(message));

            const timeoutId = setTimeout(() => {
                this.socketService.off('message', responseHandler);
                reject(new Error('Request timed out'));
            }, timeoutDuration);
        });
    }

    _createWindow() {
        // Create the main window element
        this.windowElement = document.createElement('div');
        this.windowElement.className = 'window';
        // Apply position and size from config using defaults if needed
        this.windowElement.style.top = `${this.config.position?.top ?? 50}px`;
        this.windowElement.style.left = `${this.config.position?.left ?? 50}px`;
        this.windowElement.style.width = `${this.config.size?.width ?? 700}px`;
        this.windowElement.style.height = `${this.config.size?.height ?? 400}px`;

        // Create header
        const header = document.createElement('div');
        header.className = 'window-header';

        const title = document.createElement('h2');
        title.textContent = this.config.title ?? 'Window';
        header.appendChild(title);

        // Window controls (e.g. close button)
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

        // Optional menu bar if specified in config
        if (this.config.menu) {
            const menuBar = document.createElement('div');
            menuBar.className = 'menu-bar';
            // Populate menu items based on this.config.menu if needed
            this.windowElement.appendChild(menuBar);
        }

        // Create window body (where the form is injected)
        const body = document.createElement('div');
        body.className = 'window-body';
        this.body = body;
        this.windowElement.appendChild(body);

        // Create footer (for status messages or controls)
        const footer = document.createElement('div');
        footer.className = 'window-footer';
        this._createNavigationToolbar(footer);

        // Footer text if provided
        const footerText = document.createElement('div');
        footerText.className = 'footer-text';
        footerText.textContent = this.config.footerText ?? '';
        footer.appendChild(footerText);

        this.windowElement.appendChild(footer);

        // Add resize handle and initialize resizing behavior
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        this.windowElement.appendChild(resizeHandle);
        this._makeResizable(resizeHandle);
    }

    _makeDraggable(header) {
        let isDragging = false, offsetX = 0, offsetY = 0;

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
            this.windowElement.style.left = `${e.clientX - offsetX}px`;
            this.windowElement.style.top = `${e.clientY - offsetY}px`;
        };

        const onMouseUp = () => {
            isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
    }

    _makeResizable(resizeHandle) {
        let isResizing = false, startX = 0, startY = 0;
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
            this.windowElement.style.width = `${newWidth > 300 ? newWidth : 300}px`;
            this.windowElement.style.height = `${newHeight > 200 ? newHeight : 200}px`;
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
        this.keydownHandler = this._handleKeydown.bind(this);
        document.addEventListener('keydown', this.keydownHandler, { capture: true });

        this.focusHandler = (e) => {
            if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) {
                this.currentFocusElement = e.target;
            }
        };
        this.windowElement.addEventListener('focusin', this.focusHandler);
    }

    _handleKeydown(event) {
        if (!this.windowElement.isConnected) return;
        if (event.key === 'Escape') {
            event.stopPropagation();
            event.preventDefault();
            this._handleEscapeKey();
        }
    }

    _handleEscapeKey() {
        if (this.isClosing || this.isSaving) return;
        if (this.dirtyFields.size > 0) {
            const confirmAction = window.confirm('You have unsaved changes! Do you want to save before closing?');
            confirmAction ? this._saveAndClose() : this.close();
        } else {
            this.close();
        }
    }

    async _saveAndClose() {
        if (this.isClosing || this.isSaving) return;
        this.isClosing = true;

        const formCfg = this.config.formConfig;
        if (!formCfg?.model) {
            console.error("Cannot save: model name is missing in form configuration");
            this._showFormError("Cannot save: Form configuration is incomplete");
            this.isClosing = false;
            return;
        }

        const recordId = this.record.id;
        if (!recordId) {
            console.warn("Cannot update record: record ID is missing");
            this._showFormError("Cannot save: No record ID found");
            this.isClosing = false;
            return;
        }

        const changedData = {};
        this.dirtyFields.forEach(field => {
            changedData[field] = this.record[field];
        });

        if (Object.keys(changedData).length === 0) {
            this.close();
            return;
        }

        const statusDiv = this.formElement.querySelector('#statusMessage');
        if (statusDiv) {
            statusDiv.textContent = 'Saving...';
            statusDiv.className = 'saving';
        }

        this.isSaving = true;
        const modelName = formCfg.model;
        const requestId = `req-update-close-${modelName}-${Date.now()}`;

        const message = {
            type: 'model',
            name: modelName,
            action: 'update',
            parameters: { id: recordId, data: changedData },
            requestId
        };

        try {
            const response = await this._sendRequest(message);
            this.isSaving = false;
            if (response.success) {
                this.close();
            } else {
                console.error('Error updating record:', response.error);
                this.isClosing = false;
                if (statusDiv) {
                    statusDiv.textContent = `Error: ${response.error || 'Save failed'}`;
                    statusDiv.className = 'error';
                } else {
                    this._showFormError(`Error: ${response.error || 'Save failed'}`);
                }
                this.currentFocusElement?.focus();
            }
        } catch (error) {
            this.isSaving = false;
            this.isClosing = false;
            if (statusDiv) {
                statusDiv.textContent = 'Save operation timed out';
                statusDiv.className = 'error';
            }
            this.currentFocusElement?.focus();
        }
    }

    _generateForm() {
        const formCfg = this.config.formConfig;
        this.formElement = document.createElement('form');
        this.formElement.id = formCfg.id ?? 'recordForm';

        const fieldMap = {};
        const groupMap = {};

        (formCfg.layout.groups || []).forEach(group => {
            const section = document.createElement('div');
            section.className = 'form-section';
            section.id = group.id;
            groupMap[group.id] = section;

            const title = document.createElement('div');
            title.className = 'section-title';
            title.textContent = group.caption ?? '';
            section.appendChild(title);

            const grid = document.createElement('div');
            grid.className = 'field-grid';
            section.appendChild(grid);

            group.fields.forEach(field => {
                const groupDiv = document.createElement('div');
                groupDiv.className = 'form-group';
                if (field.fullWidth) groupDiv.classList.add('full-width');

                const label = document.createElement('label');
                label.htmlFor = field.name;
                label.textContent = field.caption ?? field.name;
                groupDiv.appendChild(label);

                const input = document.createElement('bindable-input');
                const inputType = field.type === 'lookup' ? 'select' : field.type;
                input.setAttribute('type', inputType);
                input.setAttribute('field', field.name);
                input.setAttribute('name', field.name);
                input.setAttribute('aria-label', field.caption ?? field.name);
                if (field.required) input.setAttribute('required', '');
                if (field.maxLength) input.setAttribute('maxLength', field.maxLength);
                if (field.pattern) input.setAttribute('pattern', field.pattern);
                if (field.defaultValue !== undefined && field.defaultValue !== null) {
                    this.record[field.name] = field.defaultValue;
                }
                if (
                    formCfg.permissions &&
                    formCfg.permissions.fields &&
                    formCfg.permissions.fields[field.name] &&
                    formCfg.permissions.fields[field.name].editable === false
                ) {
                    input.setAttribute('readonly', '');
                }
                if (field.type === 'select' || field.type === 'lookup') {
                    let options = [];
                    if (field.type === 'lookup') {
                        options = [];
                        if (field.dataSource) {
                            // Call async lookup fetch (fire and forget)
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

        const statusDiv = document.createElement('div');
        statusDiv.id = 'statusMessage';
        statusDiv.className = 'success';
        this.formElement.appendChild(statusDiv);

        // Set up conditional display for groups and fields
        (formCfg.layout.groups || []).forEach(group => {
            if (group.conditional) {
                const condition = group.conditional.showWhen;
                const triggerField = fieldMap[condition.field];
                if (triggerField) {
                    triggerField.addEventListener('data-changed', () => {
                        const triggerValue = this.record[condition.field];
                        let shouldShow = triggerValue == condition.value;
                        if (condition.operator === 'notEquals') shouldShow = !shouldShow;
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
                            let shouldShow = triggerValue == condition.value;
                            if (condition.operator === 'notEquals') shouldShow = !shouldShow;
                            dependentFieldDiv.style.display = shouldShow ? 'flex' : 'none';
                        });
                        triggerField.dispatchEvent(new CustomEvent('data-changed', { bubbles: true }));
                    }
                }
            });
        });

        // Attach field-specific event handlers if provided
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

        // Auto-save functionality (debounced)
        const autoSave = this._debounce(async (event) => {
            if (this.isClosing || this.isSaving) return;
            const changedField = event?.detail?.field || event?.target?.name;
            if (!changedField) {
                console.warn("Auto-save triggered but couldn't determine which field changed");
                return;
            }
            this.dirtyFields.delete(changedField);
            const modelName = formCfg.model;
            if (!modelName) {
                console.error("Cannot update record: model name is missing in form configuration");
                this._showFormError("Cannot save: Form configuration is incomplete");
                return;
            }
            console.log(`Auto-saving field ${changedField} for model ${modelName}`, this.record[changedField]);
            const recordId = this.record.id;
            if (!recordId) {
                console.warn("Cannot update record: record ID is missing");
                this._showFormError("Cannot save: No record ID found");
                return;
            }
            statusDiv.textContent = 'Saving...';
            statusDiv.className = 'saving';

            const requestId = `req-update-${modelName}-${Date.now()}`;
            const message = {
                type: 'model',
                name: modelName,
                action: 'update',
                parameters: { id: recordId, data: { [changedField]: this.record[changedField] } },
                requestId
            };

            try {
                const response = await this._sendRequest(message);
                if (response.success) {
                    statusDiv.textContent = 'Saved';
                    statusDiv.className = 'success';
                    setTimeout(() => {
                        statusDiv.textContent = '';
                        statusDiv.className = '';
                    }, 1500);
                    if (response.result) {
                        Object.assign(this.record, response.result);
                        this._updateFormFields();
                        this._updateRecordIndicator();
                    }
                } else {
                    console.error('Error updating record:', response.error);
                    statusDiv.textContent = `Error: ${response.error || 'Save failed'}`;
                    statusDiv.className = 'error';
                    this.dirtyFields.add(changedField);
                    setTimeout(() => {
                        statusDiv.textContent = '';
                        statusDiv.className = '';
                    }, 3000);
                }
            } catch (error) {
                statusDiv.textContent = 'Save operation timed out';
                statusDiv.className = 'error';
                setTimeout(() => {
                    statusDiv.textContent = '';
                    statusDiv.className = '';
                }, 3000);
            }
        }, 10);

        // Track changes and attach auto-save to inputs
        const trackChangesHandler = (event) => {
            const changedField = event?.detail?.field;
            if (changedField) this.dirtyFields.add(changedField);
        };

        Object.values(fieldMap).forEach(input => {
            input.addEventListener('input', trackChangesHandler);
            input.addEventListener('data-changed', autoSave);
        });

        this.body.appendChild(this.formElement);
    }

    async _loadDefaultRecord() {
        const formCfg = this.config.formConfig;
        if (!formCfg?.model) {
            console.warn('Cannot load default record: model name is missing in form configuration');
            return;
        }
        const modelName = formCfg.model;
        console.log(`Loading default record for model ${modelName}`);
        const requestId = `req-find-first-${modelName}-${Date.now()}`;
        const message = {
            type: 'model',
            name: modelName,
            action: 'findFirst',
            parameters: {},
            requestId
        };
        try {
            const response = await this._sendRequest(message);
            if (response.success && response.result) {
                console.log(`Received default record for ${modelName}:`, response.result);
                Object.assign(this.record, response.result);
                this._updateFormFields();
                this._updateRecordIndicator();
            } else {
                console.warn(`Failed to load default record for ${modelName}:`, response.success ? 'No data received' : response.message || 'Unknown error');
                if (!response.success) {
                    this._showFormError(`Failed to load data: ${response.message || 'Unknown error'}`);
                }
            }
        } catch (error) {
            console.warn(`findFirst request for ${modelName} timed out`);
            this._showFormError(`Failed to load data. Please try again later.`);
        }
    }

    _updateFormFields() {
        const inputs = this.formElement.querySelectorAll('bindable-input');
        inputs.forEach(input => {
            input.record = this.record;
            input.updateValue();
        });
    }

    async _fetchLookupOptions(field, inputElement) {
        const modelName = field.dataSource;
        const displayField = field.displayField || 'name';
        const valueField = field.valueField || 'id';
        console.log(`Fetching lookup options for ${field.name} from model ${modelName}`);
        const requestId = `req-find-all-${modelName}-${field.name}-${Date.now()}`;
        const message = {
            type: 'model',
            name: modelName,
            action: 'findAll',
            parameters: {},
            requestId
        };
        try {
            const response = await this._sendRequest(message);
            if (response.success && Array.isArray(response.result)) {
                console.log(`Received lookup options for ${field.name}:`, response.result);
                const options = response.result.map(item => ({
                    value: item[valueField] ?? '',
                    label: item[displayField] ?? '(No name)'
                }));
                inputElement.setAttribute('options', JSON.stringify(options));
                if (this.record && this.record[field.name]) {
                    inputElement.updateValue();
                }
            } else {
                console.warn(`Failed to load lookup options for ${field.name}:`, response.error || 'Unknown error');
                inputElement.setAttribute('options', JSON.stringify([
                    { value: '', label: `Error loading ${field.name} options: ${response.error || 'Unknown error'}` }
                ]));
            }
        } catch (error) {
            console.warn(`Lookup request for ${field.name} timed out`);
            inputElement.setAttribute('options', JSON.stringify([
                { value: '', label: `Error: Timeout loading ${field.name} options` }
            ]));
        }
    }

    _showFormError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'form-error';
        errorDiv.textContent = message;
        const formTitle = this.formElement.querySelector('#formTitle');
        if (formTitle && formTitle.parentNode) {
            formTitle.parentNode.insertBefore(errorDiv, formTitle.nextSibling);
            setTimeout(() => errorDiv.remove(), 5000);
        }
    }

    /**
     * Returns the window element for DOM insertion.
     * @returns {HTMLElement}
     */
    getElement() {
        return this.windowElement;
    }

    close() {
        this.isClosing = true;
        this._cleanupEventListeners();
        this.windowElement.remove();
    }

    _cleanupEventListeners() {
        if (this.keydownHandler) {
            document.removeEventListener('keydown', this.keydownHandler);
        }
        if (this.focusHandler) {
            this.windowElement.removeEventListener('focusin', this.focusHandler);
        }
        const inputs = this.formElement.querySelectorAll('bindable-input');
        inputs.forEach(input => {
            if (input._record) {
                input._record = {};
            }
        });
        if (this.messageHandlers.length > 0) {
            this.messageHandlers.forEach(handler => {
                this.socketService.off('message', handler);
            });
            this.messageHandlers = [];
        }
    }

    /**
     * Creates the navigation toolbar for record navigation.
     * @param {HTMLElement} container - The container element.
     */
    _createNavigationToolbar(container) {
        const formCfg = this.config.formConfig;
        if (!formCfg?.model) return;
        const navToolbar = document.createElement('div');
        navToolbar.className = 'record-navigation-toolbar';

        const firstButton = document.createElement('button');
        firstButton.className = 'nav-button first-record';
        firstButton.innerHTML = '&laquo;';
        firstButton.title = 'First Record';
        firstButton.addEventListener('click', () => this._navigateToRecord('first'));
        navToolbar.appendChild(firstButton);

        const prevButton = document.createElement('button');
        prevButton.className = 'nav-button prev-record';
        prevButton.innerHTML = '&lsaquo;';
        prevButton.title = 'Previous Record';
        prevButton.addEventListener('click', () => this._navigateToRecord('previous'));
        navToolbar.appendChild(prevButton);

        this.recordIndicator = document.createElement('span');
        this.recordIndicator.className = 'record-indicator';
        this.recordIndicator.textContent = 'Record: -';
        navToolbar.appendChild(this.recordIndicator);

        const nextButton = document.createElement('button');
        nextButton.className = 'nav-button next-record';
        nextButton.innerHTML = '&rsaquo;';
        nextButton.title = 'Next Record';
        nextButton.addEventListener('click', () => this._navigateToRecord('next'));
        navToolbar.appendChild(nextButton);

        const lastButton = document.createElement('button');
        lastButton.className = 'nav-button last-record';
        lastButton.innerHTML = '&raquo;';
        lastButton.title = 'Last Record';
        lastButton.addEventListener('click', () => this._navigateToRecord('last'));
        navToolbar.appendChild(lastButton);

        container.appendChild(navToolbar);
    }

    /**
     * Navigates to a record in a given direction.
     * @param {string} direction - 'first', 'previous', 'next', or 'last'
     */
    async _navigateToRecord(direction) {
        if (this.isNavigating) {
            console.log('Navigation already in progress, ignoring request');
            return;
        }
        this.isNavigating = true;
        const formCfg = this.config.formConfig;
        if (!formCfg?.model) {
            console.warn('Cannot navigate: model name is missing in form configuration');
            this.isNavigating = false;
            return;
        }
        if (!this.record?.id) {
            console.warn('Cannot navigate: no current record or record ID');
            if (direction === 'first') this._loadDefaultRecord();
            this.isNavigating = false;
            return;
        }
        const modelName = formCfg.model;
        const currentId = this.record.id;
        let action, parameters = {};
        switch (direction) {
            case 'first':
                action = 'findFirst';
                break;
            case 'previous':
                action = 'findPrevious';
                parameters = { id: currentId };
                break;
            case 'next':
                action = 'findNext';
                parameters = { id: currentId };
                break;
            case 'last':
                action = 'findLast';
                break;
            default:
                console.warn(`Unknown navigation direction: ${direction}`);
                this.isNavigating = false;
                return;
        }
        const requestId = `req-${action}-${modelName}-${Date.now()}`;
        console.log(`Navigating ${direction} from record ${currentId} in model ${modelName}`);
        const message = {
            type: 'model',
            name: modelName,
            action,
            parameters,
            requestId
        };
        try {
            const response = await this._sendRequest(message);
            if (response.success && response.result) {
                console.log(`Received ${direction} record for ${modelName}:`, response.result);
                Object.assign(this.record, response.result);
                this._updateFormFields();
                this._updateRecordIndicator();
            } else {
                console.warn(`Failed to navigate ${direction} for ${modelName}:`, response.error || 'Unknown error');
                this._showFormError(`Error navigating ${direction}: ${response.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.warn(`${direction} request for ${modelName} timed out`);
            this._showFormError(`Failed to navigate ${direction}. Please try again later.`);
        } finally {
            this.isNavigating = false;
        }
    }

    _updateRecordIndicator() {
        if (this.recordIndicator && this.record?.id) {
            this.recordIndicator.textContent = `Record: ${this.record.id}`;
        } else if (this.recordIndicator) {
            this.recordIndicator.textContent = 'Record: -';
        }
    }

    /**
     * Handles authentication errors by showing an in-form error message.
     * @param {any} error - The error that occurred.
     */
    _handleAuthError(error) {
        console.warn('WindowForm handling auth error internally:', error);
        const errorEl = document.createElement('div');
        errorEl.className = 'form-error auth-error';
        errorEl.textContent = 'Authentication error: Your session may have expired. Please refresh the page.';
        const refreshBtn = document.createElement('button');
        refreshBtn.textContent = 'Refresh Page';
        refreshBtn.className = 'auth-refresh-btn';
        refreshBtn.addEventListener('click', () => window.location.reload());
        errorEl.appendChild(document.createElement('br'));
        errorEl.appendChild(refreshBtn);
        const formContent = this.windowElement.querySelector('.window-body');
        if (formContent) {
            formContent.prepend(errorEl);
        } else {
            this.windowElement.appendChild(errorEl);
        }
    }

    /**
     * Ensures the given message includes an authentication token.
     * @param {Object} message - The message to send.
     * @returns {Object} - The updated message.
     */
    _ensureTokenInMessage(message) {
        return { ...message, token: message.token || this.socketService.getAuthToken() };
    }
}
