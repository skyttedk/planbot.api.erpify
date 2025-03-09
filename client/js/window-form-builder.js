/**
 * FormMenuManager - A utility for managing menu items in forms
 * Integrated directly into the WindowForm class
 */
class FormMenuManager {
    constructor() {
        // Store registered form menu items by form ID
        this.menuItems = {};
        console.log('FormMenuManager initialized');
    }

    /**
     * Add a new menu item to a form
     * 
     * @param {string} formId - The ID of the form to add the menu item to
     * @param {Object} menuItem - Menu item configuration
     * @returns {string} ID of the added menu item
     */
    addMenuItem(formId, menuItem) {
        if (!formId) {
            console.error('Form ID is required to add a menu item');
            return null;
        }

        if (!menuItem) {
            console.error('Menu item is required');
            return null;
        }

        // Initialize menu items for this form if not exists
        if (!this.menuItems[formId]) {
            this.menuItems[formId] = [];
            console.log(`FormMenuManager: Created items array for form ${formId}`);
        }

        // Generate unique ID for this menu item
        const menuItemId = `menu_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

        // Add ID to the menu item
        const newMenuItem = {
            ...menuItem,
            id: menuItemId,
            formId: formId // Store the formId with the menu item for reference
        };

        // Add to the collection
        this.menuItems[formId].push(newMenuItem);
        console.log(`FormMenuManager: Added menu item to form ${formId}, total items: ${this.menuItems[formId].length}`);

        return menuItemId;
    }

    /**
     * Remove a menu item from a form
     * 
     * @param {string} formId - The ID of the form 
     * @param {string} menuItemId - ID of the menu item to remove
     * @returns {boolean} True if removed successfully
     */
    removeMenuItem(formId, menuItemId) {
        if (!this.menuItems[formId]) {
            console.log(`FormMenuManager: No items found for form ${formId}`);
            return false;
        }

        const initialCount = this.menuItems[formId].length;
        this.menuItems[formId] = this.menuItems[formId].filter(item => item.id !== menuItemId);

        const removed = initialCount !== this.menuItems[formId].length;
        console.log(`FormMenuManager: Removed item from form ${formId}? ${removed}`);

        return removed;
    }

    /**
     * Get all menu items for a specific form
     * 
     * @param {string} formId - The ID of the form
     * @returns {Array} Array of menu items for the form
     */
    getMenuItems(formId) {
        console.log(`FormMenuManager: Getting items for form ${formId}, has ${this.menuItems[formId]?.length || 0} items`);
        console.log('FormMenuManager: Current state:', this.menuItems);
        return this.menuItems[formId] || [];
    }

    /**
     * Convert menu items array to hierarchical structure based on location
     * 
     * @param {Array} items - Flat array of menu items
     * @returns {Array} Hierarchical menu structure
     */
    buildMenuStructure(items) {
        const menuStructure = [];

        items.forEach(item => {
            // If the item has a location, use it to determine position
            if (item.location) {
                const path = item.location.split('.');
                let currentLevel = menuStructure;

                // Process path segments except the last one (which is the menu item)
                for (let i = 0; i < path.length - 1; i++) {
                    const segment = path[i];

                    // Look for existing menu group at this level
                    let menuGroup = currentLevel.find(group => group.label === segment);

                    // Create new menu group if it doesn't exist
                    if (!menuGroup) {
                        menuGroup = {
                            label: segment,
                            items: []
                        };
                        currentLevel.push(menuGroup);
                    }

                    // Initialize items array if needed
                    if (!menuGroup.items) {
                        menuGroup.items = [];
                    }

                    // Move to next level
                    currentLevel = menuGroup.items;
                }

                // Add the menu item at the last segment
                const lastSegment = path[path.length - 1];
                const menuItemLabel = item.caption || lastSegment;

                // Check if item already exists (avoid duplicates)
                if (!currentLevel.some(existing => existing.label === menuItemLabel)) {
                    currentLevel.push({
                        label: menuItemLabel,
                        id: item.id,
                        type: item.type,
                        name: item.name,
                        action: item.action
                    });
                }
            }
            // Direct menu item without location hierarchy
            else {
                menuStructure.push({
                    label: item.caption,
                    id: item.id,
                    type: item.type,
                    name: item.name,
                    action: item.action
                });
            }
        });

        return menuStructure;
    }

    // Clear out all menu items
    clear() {
        console.log('FormMenuManager: Clearing all menu items');
        this.menuItems = {};
    }
}

// Create a singleton instance
const formMenuManager = new FormMenuManager();

// Initialize the active window forms tracking array
window.activeWindowForms = window.activeWindowForms || [];

export class WindowForm {
    /**
     * Creates a window container with a form inside
     * @param {Object} config - The configuration for the window and form
     * @param {Object} socketService - The socket service for communication
     */
    constructor(config, socketService) {
        this.config = config;
        this.socketService = socketService;
        this.formId = this.config.formConfig?.id || `form-${Date.now()}`;
        this.windowElement = null;
        this.menuBar = null;
        this.isClosing = false;
        this.isSaving = false;
        this.record = { id: 0 };
        this.messageHandlers = [];
        this.dirtyFields = new Set();
        
        // Register any menu items from the form config BEFORE creating the window
        this._registerConfigMenuItems();

        // Track active window forms globally
        if (!window.activeWindowForms) {
            window.activeWindowForms = [];
        }
        window.activeWindowForms.push(this);

        this.hasUnsavedChanges = false;
        this.currentRecord = {};
        this.currentRecordIndex = 0;
        this.totalRecords = 0;
        this.currentFocusElement = null;
        this.isNavigating = false;
        this.recordIndicator = null;

        // Create the window and form
        this._createWindow();
        this._generateForm();

        // Setup keyboard handlers for navigation
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

        // Add menu bar to all forms
        this._createMenuBar();

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
        this.keydownHandler = (event) => {
            // Handle Escape key specifically
            if (event.key === 'Escape') {
                this._handleEscapeKey();
                event.preventDefault();
                event.stopPropagation();
                return false;
            }
            
            // Handle other keyboard shortcuts
            this._handleKeydown(event);
        };
        
        // Use capture phase for all keyboard events
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
        
        // Only process shortcut keys when our window is active
        if (!this.windowElement.contains(document.activeElement) && 
            document.activeElement !== document.body) {
            return;
        }
        
        // Handle Alt key shortcuts
        if (event.altKey) {
            let handled = true;
            
            switch(event.key.toLowerCase()) {
                case 'n':  // Alt+N - New record
                    this._createNewRecord();
                    break;
                case 'r':  // Alt+R - Refresh
                    this._loadDefaultRecord();
                    break;
                default:
                    handled = false;
                    break;
            }
            
            if (handled) {
                event.stopPropagation();
                event.preventDefault();
                return;
            }
        }
        
        // Handle Ctrl key shortcuts
        if (event.ctrlKey) {
            let handled = true;
            
            switch(event.key.toLowerCase()) {
                case 's':  // CTRL+S - Save
                    this._saveAndClose();
                    break;
                case 'arrowleft':  // CTRL+Left - Previous record
                    this._navigateToRecord('previous');
                    break;
                case 'arrowright':  // CTRL+Right - Next record
                    this._navigateToRecord('next');
                    break;
                case 'home':  // CTRL+Home - First record
                    this._navigateToRecord('first');
                    break;
                case 'end':  // CTRL+End - Last record
                    this._navigateToRecord('last');
                    break;
                default:
                    handled = false;
                    break;
            }
            
            // If we handled the shortcut, prevent the default browser action
            if (handled) {
                event.stopPropagation();
                event.preventDefault();
                return;
            }
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

        // Collect changed data
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
            statusDiv.textContent = (!recordId || recordId === 0) ? 'Creating...' : 'Saving...';
            statusDiv.className = 'saving';
        }

        this.isSaving = true;
        const modelName = formCfg.model;

        // For new records (id=0 or no id), use create operation
        let message;
        if (!recordId || recordId === 0) {
            const requestId = `req-create-close-${modelName}-${Date.now()}`;
            message = {
                type: 'model',
                name: modelName,
                action: 'create',
                parameters: { data: changedData },
                requestId
            };
        } else {
            // For existing records, use update operation
            const requestId = `req-update-close-${modelName}-${Date.now()}`;
            message = {
                type: 'model',
                name: modelName,
                action: 'update',
                parameters: { id: recordId, data: changedData },
                requestId
            };
        }

        try {
            const response = await this._sendRequest(message);
            this.isSaving = false;
            if (response.success) {
                this.close();
            } else {
                const action = (!recordId || recordId === 0) ? 'creating' : 'updating';
                console.error(`Error ${action} record:`, response.error);
                this.isClosing = false;
                if (statusDiv) {
                    statusDiv.textContent = `Error: ${response.error || ((!recordId || recordId === 0) ? 'Create failed' : 'Save failed')}`;
                    statusDiv.className = 'error';
                } else {
                    this._showFormError(`Error: ${response.error || ((!recordId || recordId === 0) ? 'Create failed' : 'Save failed')}`);
                }
                this.currentFocusElement?.focus();
            }
        } catch (error) {
            this.isSaving = false;
            this.isClosing = false;
            if (statusDiv) {
                statusDiv.textContent = (!recordId || recordId === 0) ? 'Create operation timed out' : 'Save operation timed out';
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
                if (field.type === 'select' || field.type === 'lookup' || field.type === 'enum') {
                    let options = [];
                    if (field.type === 'lookup') {
                        options = [];
                        if (field.dataSource) {
                            // Call async lookup fetch (fire and forget)
                            this._fetchLookupOptions(field, input);
                        } else {
                            console.warn(`Lookup field ${field.name} has no dataSource specified`);
                        }
                    } else if (field.type === 'enum') {
                        // For enum fields, use the options provided by the field definition
                        if (field.options && Array.isArray(field.options)) {
                            // Preserve the exact case of options as defined in the model
                            options = field.options.map(opt => ({
                                value: opt, // Preserve exact case
                                label: opt  // Preserve exact case
                            }));
                            console.log(`Enum options for ${field.name}:`, options);
                        } else {
                            console.warn(`Enum field ${field.name} has no options specified`);
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


        // Inside _generateForm(), after building fieldMap:
        const autoSave = this._debounce(async (event) => {
            if (this.isClosing || this.isSaving) return;
            const changedField = event?.detail?.field || event?.target?.name;
            if (!changedField) {
                console.warn("Auto-save triggered but couldn't determine which field changed");
                return;
            }
            // Only proceed if the field is marked as dirty
            if (!this.dirtyFields.has(changedField)) return;
            // Remove dirty flag for this field
            this.dirtyFields.delete(changedField);

            const modelName = formCfg.model;
            if (!modelName) {
                console.error("Cannot update record: model name is missing in form configuration");
                this._showFormError("Cannot save: Form configuration is incomplete");
                return;
            }

            const recordId = this.record.id;
            // New record: if id is 0 (or falsy), call create; otherwise update
            if (!recordId || recordId === 0) {
                console.log(`Creating new record for model ${modelName} with data:`, { [changedField]: this.record[changedField] });
                statusDiv.textContent = 'Creating...';
                statusDiv.className = 'saving';

                const requestId = `req-create-${modelName}-${Date.now()}`;
                const message = {
                    type: 'model',
                    name: modelName,
                    action: 'create',
                    parameters: { data: { [changedField]: this.record[changedField] } },
                    requestId
                };

                try {
                    const response = await this._sendRequest(message);
                    if (response.success) {
                        statusDiv.textContent = 'Created';
                        statusDiv.className = 'success';
                        setTimeout(() => {
                            statusDiv.textContent = '';
                            statusDiv.className = '';
                        }, 1500);
                        if (response.result) {
                            console.log(`Response for ${changedField} creation:`, response.result);
                            Object.assign(this.record, response.result);
                            this._updateFormFields();
                            this._updateRecordIndicator();
                        }
                    } else {
                        console.error('Error creating record:', response.error);
                        statusDiv.textContent = `Error: ${response.error || 'Create failed'}`;
                        statusDiv.className = 'error';
                        this.dirtyFields.add(changedField);
                        setTimeout(() => {
                            statusDiv.textContent = '';
                            statusDiv.className = '';
                        }, 3000);
                    }
                } catch (error) {
                    statusDiv.textContent = 'Create operation timed out';
                    statusDiv.className = 'error';
                    setTimeout(() => {
                        statusDiv.textContent = '';
                        statusDiv.className = '';
                    }, 3000);
                }
            } else {
                // Existing record: call update
                console.log(`Auto-saving field ${changedField} for model ${modelName}`, this.record[changedField]);
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
                            console.log(`Response for ${changedField} update:`, response.result);
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
            }
        }, 10);

        // Update event listeners so that we mark fields as dirty on input but only trigger auto-save on blur:
        Object.values(fieldMap).forEach(input => {
            // Mark the field as dirty whenever its content changes.
            input.addEventListener('input', () => {
                const fieldName = input.getAttribute('field');
                this.dirtyFields.add(fieldName);
            });
            
            // Special handler for enum fields to ensure their values are properly synchronized
            if (input.getAttribute('type') === 'enum') {
                input.addEventListener('change', (event) => {
                    console.log(`Enum field ${input.getAttribute('field')} changed:`, event.target.value);
                    const fieldName = input.getAttribute('field');
                    // Ensure value is set in the record
                    this.record[fieldName] = event.target.value === "" ? null : event.target.value;
                    this.dirtyFields.add(fieldName);
                });
            }
            
            // Trigger auto-save when the field loses focus.
            input.addEventListener('blur', autoSave);
            // Also trigger auto-save on data-changed if needed.
            input.addEventListener('data-changed', autoSave);

        });


        this.body.appendChild(this.formElement);
    }


    async _Zoom() {
        // Not implemented yet
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

    /**
     * Close the window and clean up resources
     */
    close() {
        this._cleanupEventListeners();
        this.windowElement.remove();

        // Remove this form from active windows
        if (window.activeWindowForms) {
            window.activeWindowForms = window.activeWindowForms.filter(wf => wf !== this);
        }

        // Clean up form menu items
        if (formMenuManager.menuItems[this.formId]) {
            delete formMenuManager.menuItems[this.formId];
        }
    }

    _cleanupEventListeners() {
        // Remove keydown event listener
        if (this.keydownHandler) {
            document.removeEventListener('keydown', this.keydownHandler, { capture: true });
            this.keydownHandler = null;
        }
        
        // Remove focus event listener
        if (this.focusHandler && this.windowElement) {
            this.windowElement.removeEventListener('focusin', this.focusHandler);
            this.focusHandler = null;
        }
        
        // Clean up form inputs
        if (this.formElement) {
            const inputs = this.formElement.querySelectorAll('bindable-input');
            inputs.forEach(input => {
                if (input._record) {
                    input._record = {};
                }
            });
        }
        
        // Clean up message handlers
        if (this.messageHandlers && this.messageHandlers.length > 0) {
            this.messageHandlers.forEach(handler => {
                if (this.socketService) {
                    this.socketService.off('message', handler);
                }
            });
            this.messageHandlers = [];
        }
        
        // Remove from global tracking
        const index = window.activeWindowForms.indexOf(this);
        if (index !== -1) {
            window.activeWindowForms.splice(index, 1);
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

    /**
     * Register menu items defined in the form configuration
     */
    _registerConfigMenuItems() {
        const formConfig = this.config.formConfig;

        // If the form has menu items defined, register them
        if (formConfig && Array.isArray(formConfig.menu) && formConfig.menu.length > 0) {
            console.log(`[${this.formId}] Registering ${formConfig.menu.length} menu items for form`);

            formConfig.menu.forEach(menuItem => {
                // Ensure caption is set for display (use location's last segment if not provided)
                if (!menuItem.caption && menuItem.location) {
                    const segments = menuItem.location.split('.');
                    menuItem.caption = segments[segments.length - 1];
                }

                console.log(`[${this.formId}] Registering menu item:`, menuItem);

                // Register menu item with the form menu manager
                formMenuManager.addMenuItem(this.formId, menuItem);
            });

            // Verify items were registered
            const items = formMenuManager.getMenuItems(this.formId);
            console.log(`[${this.formId}] Verified ${items.length} menu items are registered`);
        } else {
            console.log(`[${this.formId}] No menu items found in form config`);
        }
    }

    /**
     * Creates a menu bar with support for submenus similar to Windows forms
     */
    _createMenuBar() {
        console.log(`[${this.formId}] Creating menu bar`);

        // Create main menu bar container
        const menuBar = document.createElement('div');
        menuBar.className = 'window-menu-bar';
        this.menuBar = menuBar;

        // Get form model name from config or default to "Form"
        const modelName = this.config.formConfig?.model || 'Form';

        // Define standard menu items that every form will have
        const standardMenus = {
            [modelName]: [
                { 
                    label: 'New', 
                    action: () => this._createNewRecord(),
                    shortcut: 'Alt+N'
                },
                { 
                    label: 'Delete', 
                    action: () => console.log('Delete record clicked') 
                }
            ],
            'View': [
                { 
                    label: 'Refresh', 
                    action: () => this._loadDefaultRecord(),
                    shortcut: 'Alt+R'
                },
                { 
                    label: 'First Record', 
                    action: () => this._navigateToRecord('first'),
                    shortcut: 'Ctrl+Home'
                },
                { 
                    label: 'Previous Record', 
                    action: () => this._navigateToRecord('previous'),
                    shortcut: 'Ctrl+←'
                },
                { 
                    label: 'Next Record', 
                    action: () => this._navigateToRecord('next'),
                    shortcut: 'Ctrl+→'
                },
                { 
                    label: 'Last Record', 
                    action: () => this._navigateToRecord('last'),
                    shortcut: 'Ctrl+End'
                },
                { 
                    label: 'Zoom', 
                    action: () => this._Zoom() 
                }
            ]
        };

        // Get custom menu items for this form
        const customMenuItems = formMenuManager.getMenuItems(this.formId);
        console.log(`[${this.formId}] Found ${customMenuItems.length} custom menu items:`, customMenuItems);

        // Add custom menu items to the appropriate menus
        customMenuItems.forEach(item => {
            const menuName = item.location || 'Custom';
            if (!standardMenus[menuName]) {
                standardMenus[menuName] = [];
                console.log(`[${this.formId}] Created new menu section: ${menuName}`);
            }

            standardMenus[menuName].push({
                label: item.caption,
                type: item.type,
                name: item.name,
                action: item.action
            });
            console.log(`[${this.formId}] Added item "${item.caption}" to menu "${menuName}"`);
        });

        // Log all menu sections we'll be creating
        console.log(`[${this.formId}] Creating menu sections:`, Object.keys(standardMenus));

        // Create each menu in the menu bar
        Object.entries(standardMenus).forEach(([menuName, menuItems]) => {
            if (menuItems.length === 0) {
                console.log(`[${this.formId}] Skipping empty menu: ${menuName}`);
                return; // Skip empty menus
            }

            const menuItem = document.createElement('div');
            menuItem.className = 'menu-item';
            menuItem.textContent = menuName;
            console.log(`[${this.formId}] Created menu: ${menuName} with ${menuItems.length} items`);

            // Create dropdown for this menu item
            const dropdown = document.createElement('div');
            dropdown.className = 'menu-dropdown';

            // Add menu subitems
            this._createSubMenu(dropdown, menuItems);

            // Show dropdown on hover
            menuItem.addEventListener('mouseenter', () => {
                // Close any other open dropdowns at this level
                document.querySelectorAll('.menu-dropdown.active').forEach(el => {
                    if (el !== dropdown) el.classList.remove('active');
                });
                dropdown.classList.add('active');
            });

            // Add click event for touch devices that don't support hover
            menuItem.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            menuItem.appendChild(dropdown);
            menuBar.appendChild(menuItem);
        });

        // Handle closing menus when moving away from the menu bar
        menuBar.addEventListener('mouseleave', () => {
            // Only close top-level dropdowns when leaving the menu bar completely
            setTimeout(() => {
                // Check if we've truly left the menu area (including dropdowns)
                const isOverMenuElement = document.querySelectorAll('.window-menu-bar:hover, .menu-dropdown:hover, .submenu-dropdown:hover').length > 0;
                if (!isOverMenuElement) {
                    document.querySelectorAll('.menu-dropdown.active, .submenu-dropdown.active').forEach(el => {
                        el.classList.remove('active');
                    });
                }
            }, 100); // Small delay to check if we're still over a menu element
        });

        // Close menus when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.window-menu-bar')) {
                document.querySelectorAll('.menu-dropdown.active, .submenu-dropdown.active').forEach(el => {
                    el.classList.remove('active');
                });
            }
        });

        this.windowElement.appendChild(menuBar);

        // Add default CSS if needed
        this._addMenuStyles();
    }

    /**
     * Refreshes the menu bar with the latest menu items
     * Called when menu items are dynamically added or removed
     */
    refreshMenuBar() {
        // Remove existing menu bar
        if (this.menuBar) {
            this.menuBar.remove();
        }

        // Recreate the menu bar
        this._createMenuBar();
    }

    /**
     * Recursively creates submenu items and handles controller actions
     * @param {HTMLElement} parent - The parent element to append items to
     * @param {Array} items - Array of menu item configurations
     */
    _createSubMenu(parent, items) {
        items.forEach(item => {
            if (item.type === 'separator') {
                const separator = document.createElement('div');
                separator.className = 'menu-separator';
                parent.appendChild(separator);
                return;
            }

            // Add directly executable action items
            const menuItem = document.createElement('div');
            menuItem.className = 'dropdown-item';

            // Use caption or label property for display
            menuItem.textContent = item.caption || item.label || '';
            
            // Add shortcut text if available
            if (item.shortcut) {
                const shortcutSpan = document.createElement('span');
                shortcutSpan.className = 'menu-shortcut';
                shortcutSpan.textContent = item.shortcut;
                menuItem.appendChild(shortcutSpan);
            }

            // If there are subitems, create a nested dropdown
            if (item.items && item.items.length) {
                menuItem.classList.add('has-submenu');
                const subDropdown = document.createElement('div');
                subDropdown.className = 'submenu-dropdown';

                // Recursively create nested menu
                this._createSubMenu(subDropdown, item.items);

                menuItem.appendChild(subDropdown);

                // Show submenu on hover
                menuItem.addEventListener('mouseenter', () => {
                    subDropdown.classList.add('active');
                });

                menuItem.addEventListener('mouseleave', () => {
                    subDropdown.classList.remove('active');
                });
            }
            // Handle controller action menu items
            else if (item.type === 'controller' && item.name && item.action) {
                menuItem.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    // Close all dropdowns
                    document.querySelectorAll('.menu-dropdown.active, .submenu-dropdown.active').forEach(el => {
                        el.classList.remove('active');
                    });

                    // Call controller action via socket
                    try {
                        const controllerName = item.name;
                        const actionName = item.action;

                        console.log(`Calling controller: ${controllerName}, action: ${actionName}`);
                        console.log('Menu item:', item);  // Debug the menu item

                        // Example implementation of controller call
                        if (this.socketService) {
                            // Fix: Match parameter names expected by the server
                            const requestData = {
                                type: "controller",
                                name: controllerName,     // Changed from "controller" to "name"
                                action: actionName,       // Changed from "method" to "action" 
                                parameters: [],           // Changed from "params" to "parameters"
                                requestId: `req-${controllerName}-${actionName}`
                            };

                            console.log('Sending request:', requestData);  // Debug the request

                            const result = await this._sendRequest(requestData);
                            console.log('Controller result:', result);
                        } else {
                            console.error('Socket service not available for controller call');
                        }
                    } catch (error) {
                        console.error('Error calling controller:', error);
                    }
                });
            }
            // Handle standard function action
            else if (item.action && typeof item.action === 'function') {
                menuItem.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // Close all dropdowns
                    document.querySelectorAll('.menu-dropdown.active, .submenu-dropdown.active').forEach(el => {
                        el.classList.remove('active');
                    });
                    // Execute the menu action
                    item.action();
                });
            }

            parent.appendChild(menuItem);
        });
    }

    /**
     * Adds necessary CSS styles for the menu
     */

    _addMenuStyles() {
        if (document.getElementById('window-menu-styles')) return;

        const styleEl = document.createElement('style');
        styleEl.id = 'window-menu-styles';
        styleEl.textContent = `
            /* CSS Variables for theming */
            :root {
                --dropdown-bg: #f8f8f8;
                --dropdown-text: #333;
                --dropdown-hover-bg: #e0e0e0;
                --dropdown-hover-text: #000;
                --dropdown-shadow: 1px 1px 3px rgba(0,0,0,0.2);
                --dropdown-border: 1px solid #ccc;
            }
            
            .window-menu-bar {
                display: flex;
                background-color: #f0f0f0;
                border-bottom: 1px solid #ccc;
                padding: 1px 0;
                font-family: Arial, sans-serif;
                font-size: 10px;
                position: relative;
            }
            
            .menu-item {
                padding: 2px 6px;
                cursor: pointer;
                position: relative;
            }
            
            .menu-item:hover {
                background-color: #e0e0e0;
            }
            
            .menu-dropdown {
                display: none;
                position: absolute;
                top: 100%;
                left: 0;
                background-color: var(--dropdown-bg);
                border: var(--dropdown-border);
                box-shadow: var(--dropdown-shadow);
                z-index: 1000;
                min-width: 120px;
                padding: 1px 0;
            }
            
            .menu-dropdown.active {
                display: block;
            }
            
            .dropdown-item {
                padding: 4px 8px;
                cursor: pointer;
                position: relative;
                white-space: nowrap;
                color: var(--dropdown-text);
            }
            
            .dropdown-item:hover {
                background-color: var(--dropdown-hover-bg);
                color: var(--dropdown-hover-text);
            }
            
            .menu-separator {
                height: 1px;
                background-color: #ccc;
                margin: 3px 0;
            }
            
            .has-submenu {
                position: relative;
            }
            
            .has-submenu::after {
                content: '▶';
                position: absolute;
                right: 4px;
                font-size: 10px;
            }
            
            .submenu-dropdown {
                display: none;
                position: absolute;
                top: -2px;
                left: 100%;
                background-color: var(--dropdown-bg);
                border: var(--dropdown-border);
                box-shadow: var(--dropdown-shadow);
                z-index: 1001;
                min-width: 120px;
                padding: 1px 0;
            }
            
            .submenu-dropdown.active {
                display: block;
            }
            
            .menu-item,
            .dropdown-item.has-submenu {
                transition: background-color 0.2s;
            }
            
            .menu-shortcut {
                margin-left: 10px;
                opacity: 0.7;
                font-size: 0.85em;
                color: var(--dropdown-text);
                float: right;
            }
            
            .dropdown-item:hover .menu-shortcut {
                color: var(--dropdown-hover-text);
            }
        `;
        document.head.appendChild(styleEl);
    }

    /**
     * Creates a new blank record for the form
     */
    _createNewRecord() {
        // Clear the current record and create a blank one with id=0
        this.record = { id: 0 };

        // Reset dirty fields
        this.dirtyFields.clear();

        // Update form fields with the blank record
        this._updateFormFields();

        // Update the record indicator
        this._updateRecordIndicator();

        console.log('Created new blank record');

        // Show status message
        const statusDiv = this.formElement.querySelector('#statusMessage');
        if (statusDiv) {
            statusDiv.textContent = 'New record';
            statusDiv.className = 'info';
            setTimeout(() => {
                statusDiv.textContent = '';
                statusDiv.className = '';
            }, 1500);
        }
    }
}
