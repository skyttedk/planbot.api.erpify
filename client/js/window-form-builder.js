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
        
        // Add navigation toolbar on the left side of the footer
        this._createNavigationToolbar(footer);

        // Add status message div in the middle of the footer
        const statusDiv = document.createElement('div');
        statusDiv.id = 'statusMessage';
        statusDiv.className = '';
        footer.appendChild(statusDiv);

        // Footer text if provided (right side)
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
        
        // Handle F3 key for new record
        if (event.key === 'F3') {
            this._createNewRecord();
            event.stopPropagation();
            event.preventDefault();
            return;
        }
        
        // Handle F4 key for delete record
        if (event.key === 'F4') {
            this._deleteRecord();
            event.stopPropagation();
            event.preventDefault();
            return;
        }
        
        // Handle F8 key for zoom (view record as JSON)
        if (event.key === 'F8') {
            this._Zoom();
            event.stopPropagation();
            event.preventDefault();
            return;
        }
        
        // Handle Alt key shortcuts
        if (event.altKey) {
            let handled = true;
            
            switch(event.key.toLowerCase()) {
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
        // If a zoom dialog is open, don't close the form
        if (window.zoomDialogOpen) {
            return;
        }
        
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

        const statusDiv = document.getElementById('statusMessage');
        if (statusDiv) {
            statusDiv.textContent = (!recordId || recordId === 0) ? 'Creating...' : 'Saving...';
            statusDiv.className = 'saving';
        }

        this.isSaving = true;
        const modelName = formCfg.model;

        console.log(`Current record state:`, {
            recordId,
            recordIdType: typeof recordId,
            isRecordIdFalsy: !recordId,
            isZero: recordId === 0,
            fullRecord: this.record
        });
        
        // New record: if id is 0 (or falsy), call create; otherwise update
        if (!recordId || recordId === 0) {
            console.log(`Creating new record for model ${modelName} with data:`, changedData);
            if (statusDiv) {
                statusDiv.textContent = 'Creating...';
                statusDiv.className = 'saving';
            }

            const requestId = `req-create-${modelName}-${Date.now()}`;
            const message = {
                type: 'model',
                name: modelName,
                action: 'create',
                parameters: { data: changedData },
                requestId
            };

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
        } else {
            // Existing record: call update
            console.log(`Updating record ${recordId} for model ${modelName}`, changedData);
            if (statusDiv) {
                statusDiv.textContent = 'Saving...';
                statusDiv.className = 'saving';
            }

            // Additional validation to ensure we have a valid ID for updating
            if (!recordId || recordId === 0 || recordId === '0' || recordId === 'undefined') {
                console.error('Cannot update record: Invalid record ID', {
                    recordId,
                    recordIdType: typeof recordId,
                    fullRecord: this.record
                });
                if (statusDiv) {
                    statusDiv.textContent = 'Error: Invalid record ID for update';
                    statusDiv.className = 'error';
                    setTimeout(() => {
                        statusDiv.textContent = '';
                        statusDiv.className = '';
                    }, 3000);
                }
                this.isClosing = false;
                this.isSaving = false;
                return;
            }

            const requestId = `req-update-${modelName}-${Date.now()}`;
            
            // Ensure we're using the correct format for the update operation
            const message = {
                type: 'model',
                name: modelName,
                action: 'update',
                parameters: { 
                    id: recordId,  // ID passed separately to identify the record to update
                    data: changedData 
                },
                requestId
            };
            
            console.log('Sending update request:', JSON.stringify(message));

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
    }

    _generateForm() {
        const formCfg = this.config.formConfig;
        this.formElement = document.createElement('form');
        this.formElement.id = formCfg.id ?? 'recordForm';
        // Disable browser autocomplete at the form level with multiple techniques
        this.formElement.setAttribute('autocomplete', 'off');
        // Add a random attribute to avoid browser fingerprinting the form
        this.formElement.setAttribute('data-form-random', Math.random().toString(36).substring(2));

        // Removed inline styles - now using external CSS in styles.css
        
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
                
                // Add required class for styling
                if (field.required) {
                    groupDiv.classList.add('required');
                }

                const label = document.createElement('label');
                label.htmlFor = field.name;
                label.textContent = field.caption ?? field.name;
                groupDiv.appendChild(label);

                const input = document.createElement('bindable-input');
                
                // CRITICAL: Determine the correct input type for the UI
                // This is different from the database field type
                let inputType = field.type; // Default to the field type from the model
                
                // Check if field name follows common patterns for lookup fields
                const lookupFieldPatterns = [
                    /Id$/i,                  // Fields ending with "Id" (e.g., countryId)
                    /Reference$/i,           // Fields ending with "Reference"
                ];
                
                // Check if this is likely a lookup field based on name patterns
                const isLikelyLookupByName = lookupFieldPatterns.some(pattern => pattern.test(field.name));
                
                // If field is an integer and matches lookup patterns, it's likely a lookup field
                if ((field.type === 'integer' || field.type === 'number') && isLikelyLookupByName) {
                    console.log(`Field ${field.name}: Detected as likely lookup field based on name pattern`);
                    inputType = 'lookup';
                }
                
                // If a field has explicitly defined relationship or lookup properties, make it a lookup field
                if (field.dataSource || field.relationTable || field.displayField || field.valueField) {
                    console.log(`Field ${field.name}: Detected as lookup field based on field properties`);
                    inputType = 'lookup';
                }
                
                // Check directly for fieldType property (could be from flattened nested options)
                if (field.fieldType) {
                    inputType = field.fieldType;
                    console.log(`Field ${field.name}: Using fieldType '${inputType}' directly from field properties`);
                }
                
                // Check if this field has options with a fieldType property
                if (field.options && field.options.fieldType) {
                    // Use the fieldType from options for the UI
                    inputType = field.options.fieldType;
                    console.log(`Field ${field.name}: Using UI input type '${inputType}' from options.fieldType instead of '${field.type}'`);
                }
                
                // Special case for lookup fields - ensure they're detected by dataSource
                if (inputType === 'lookup' || 
                    (field.options && field.options.dataSource) ||
                    field.dataSource) {
                    console.log(`Field ${field.name}: Setting input type to 'lookup'`);
                    inputType = 'lookup';
                }
                
                // Debug log to help troubleshoot field type issues
                console.log(`Field ${field.name} configuration:`, {
                    originalType: field.type,
                    finalInputType: inputType,
                    hasOptions: !!field.options,
                    fieldOptions: field.options,
                    isLikelyLookupByName
                });
                
                input.setAttribute('type', inputType);
                input.setAttribute('field', field.name);
                
                // Generate a randomized name to prevent browser from recognizing the field
                const randomizedName = `${field.name}_${Math.random().toString(36).substring(2)}`;
                input.setAttribute('name', randomizedName);
                
                input.setAttribute('aria-label', field.caption ?? field.name);
                // Ensure autocomplete is disabled with multiple techniques
                input.setAttribute('autocomplete', 'off');
                input.setAttribute('autocomplete', 'new-password'); // Trick Chrome
                input.setAttribute('autocorrect', 'off');
                input.setAttribute('autocapitalize', 'off');
                input.setAttribute('spellcheck', 'false');
                
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
                if (inputType === 'select' || inputType === 'enum' || inputType === 'lookup') {
                    let options = [];
                    if (inputType === 'lookup') {
                        options = [];
                        // Determine the data source
                        const dataSource = field.dataSource || 
                                         (field.options && field.options.dataSource) || 
                                         null;
                                         
                        if (dataSource) {
                            console.log(`Lookup field ${field.name} using dataSource: ${dataSource}`);
                            // Ensure field has the dataSource property for _fetchLookupOptions
                            field.dataSource = dataSource;
                            
                            // Also set displayField and valueField if available in options
                            if (field.options) {
                                if (field.options.displayField) {
                                    field.displayField = field.options.displayField;
                                }
                                if (field.options.valueField) {
                                    field.valueField = field.options.valueField;
                                }
                            }
                            
                            // Call async lookup fetch (fire and forget)
                            this._fetchLookupOptions(field, input);
                        } else {
                            console.warn(`Lookup field ${field.name} has no dataSource specified`);
                        }
                    } else if (inputType === 'enum') {
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
            
            console.log("========== AUTO-SAVE START ==========");
            console.log("AutoSave triggered with event:", event?.type, "Event detail:", event?.detail);
            
            const changedField = event?.detail?.field || event?.target?.getAttribute('field') || event?.target?.name;
            console.log("Determined changed field:", changedField);
            
            if (!changedField) {
                console.warn("Auto-save triggered but couldn't determine which field changed");
                console.log("========== AUTO-SAVE END (no field) ==========");
                return;
            }
            // Only proceed if the field is marked as dirty
            if (!this.dirtyFields.has(changedField)) {
                console.log(`Field ${changedField} is not marked as dirty, skipping auto-save`);
                console.log("========== AUTO-SAVE END (not dirty) ==========");
                return;
            }
            
            const inputType = event?.target?.getAttribute('type') || 
                             (event?.detail?.field ? fieldMap[event?.detail?.field]?.getAttribute('type') : null);
            
            console.log(`Auto-saving field ${changedField} (type: ${inputType}) with value:`, this.record[changedField]);
            
            // Remove dirty flag for this field
            this.dirtyFields.delete(changedField);
            
            const modelName = formCfg.model;
            if (!modelName) {
                console.error("Cannot update record: model name is missing in form configuration");
                this._showFormError("Cannot save: Form configuration is incomplete");
                return;
            }

            const recordId = this.record.id;
            const statusDiv = document.getElementById('statusMessage');
            
            console.log(`Current record state:`, {
                recordId,
                recordIdType: typeof recordId,
                isRecordIdFalsy: !recordId,
                isZero: recordId === 0,
                fullRecord: this.record
            });
            
            // New record: if id is 0 (or falsy), call create; otherwise update
            if (!recordId || recordId === 0) {
                console.log(`Creating new record for model ${modelName} with data:`, { [changedField]: this.record[changedField] });
                if (statusDiv) {
                    statusDiv.textContent = 'Creating...';
                    statusDiv.className = 'saving';
                }

                const requestId = `req-create-${modelName}-${Date.now()}`;
                const createData = { [changedField]: this.record[changedField] };
                console.log(`Preparing create operation with data:`, createData);
                
                const message = {
                    type: 'model',
                    name: modelName,
                    action: 'create',
                    parameters: { data: createData },
                    requestId
                };
                
                console.log('Sending create request:', JSON.stringify(message));

                try {
                    const response = await this._sendRequest(message);
                    console.log(`Create response received:`, response);
                    
                    if (response.success) {
                        if (statusDiv) {
                            statusDiv.textContent = 'Created';
                            statusDiv.className = 'success';
                            setTimeout(() => {
                                statusDiv.textContent = '';
                                statusDiv.className = '';
                            }, 1500);
                        }
                        if (response.result) {
                            console.log(`Response for ${changedField} creation:`, response.result);
                            Object.assign(this.record, response.result);
                            this._updateFormFields();
                            this._updateRecordIndicator();
                        }
                    } else {
                        console.error('Error creating record:', response.error);
                        if (statusDiv) {
                            statusDiv.textContent = `Error: ${response.error || 'Create failed'}`;
                            statusDiv.className = 'error';
                        } else {
                            this._showFormError(`Error: ${response.error || 'Create failed'}`);
                        }
                        this.dirtyFields.add(changedField);
                        setTimeout(() => {
                            if (statusDiv) {
                                statusDiv.textContent = '';
                                statusDiv.className = '';
                            }
                        }, 3000);
                    }
                } catch (error) {
                    console.error('Create operation failed with error:', error);
                    if (statusDiv) {
                        statusDiv.textContent = 'Create operation timed out';
                        statusDiv.className = 'error';
                        setTimeout(() => {
                            statusDiv.textContent = '';
                            statusDiv.className = '';
                        }, 3000);
                    }
                }
            } else {
                // Existing record: call update
                console.log(`Auto-saving field ${changedField} for model ${modelName}`, this.record[changedField]);
                if (statusDiv) {
                    statusDiv.textContent = 'Saving...';
                    statusDiv.className = 'saving';
                }

                // Create the changed data object with only the field being updated
                if (changedField === undefined || !(changedField in this.record)) {
                    console.error(`Cannot update record: Field ${changedField} not found in record`, this.record);
                    if (statusDiv) {
                        statusDiv.textContent = `Error: Invalid field name ${changedField}`;
                        statusDiv.className = 'error';
                        setTimeout(() => {
                            statusDiv.textContent = '';
                            statusDiv.className = '';
                        }, 3000);
                    }
                    return;
                }
                
                try {
                    // Get the field value
                    let fieldValue = this.record[changedField];
                    
                    // Process file field if needed (containing tempFile property)
                    if (fieldValue && typeof fieldValue === 'object' && fieldValue.tempFile) {
                        console.log(`Processing file field ${changedField} for saving...`);
                        fieldValue = await this._processFileForSave(fieldValue);
                    }
                    
                    const changedData = { [changedField]: fieldValue };
                    console.log(`Preparing update operation for field ${changedField}:`, {
                        field: changedField,
                        value: fieldValue,
                        recordId: recordId,
                        dataToSend: changedData
                    });
                
                    // Additional validation to ensure we have a valid ID for updating
                    if (!recordId || recordId === 0 || recordId === '0' || recordId === 'undefined') {
                        console.error('Cannot update record: Invalid record ID', {
                            recordId,
                            recordIdType: typeof recordId,
                            fullRecord: this.record
                        });
                        if (statusDiv) {
                            statusDiv.textContent = 'Error: Invalid record ID for update';
                            statusDiv.className = 'error';
                            setTimeout(() => {
                                statusDiv.textContent = '';
                                statusDiv.className = '';
                            }, 3000);
                        }
                        return;
                    }

                    const requestId = `req-update-${modelName}-${Date.now()}`;
                    
                    // Ensure we're using the correct format for the update operation
                    const message = {
                        type: 'model',
                        name: modelName,
                        action: 'update',
                        parameters: { 
                            id: recordId,  // ID passed separately to identify the record to update
                            data: changedData 
                        },
                        requestId
                    };
                    
                    console.log('Sending update request:', JSON.stringify(message));

                    try {
                        console.log(`Awaiting response from update request ${requestId}...`);
                        const response = await this._sendRequest(message);
                        console.log(`Update response received for ${requestId}:`, response);
                        
                        if (response.success) {
                            if (statusDiv) {
                                statusDiv.textContent = 'Saved';
                                statusDiv.className = 'success';
                                setTimeout(() => {
                                    statusDiv.textContent = '';
                                    statusDiv.className = '';
                                }, 1500);
                            }
                            if (response.result) {
                                console.log(`Response for ${changedField} update:`, response.result);
                                Object.assign(this.record, response.result);
                                this._updateFormFields();
                                this._updateRecordIndicator();
                            }
                        } else {
                            console.error('Error updating record:', response.error);
                            if (statusDiv) {
                                statusDiv.textContent = `Error: ${response.error || 'Save failed'}`;
                                statusDiv.className = 'error';
                            } else {
                                this._showFormError(`Error: ${response.error || 'Save failed'}`);
                            }
                            this.dirtyFields.add(changedField);
                            setTimeout(() => {
                                if (statusDiv) {
                                    statusDiv.textContent = '';
                                    statusDiv.className = '';
                                }
                            }, 3000);
                        }
                    } catch (error) {
                        console.error('Update operation failed with error:', error);
                        if (statusDiv) {
                            statusDiv.textContent = 'Save operation timed out';
                            statusDiv.className = 'error';
                            setTimeout(() => {
                                statusDiv.textContent = '';
                                statusDiv.className = '';
                            }, 3000);
                        }
                    }
                } catch (error) {
                    console.error('Error in update process:', error);
                    if (statusDiv) {
                        statusDiv.textContent = 'Save operation timed out';
                        statusDiv.className = 'error';
                        setTimeout(() => {
                            statusDiv.textContent = '';
                            statusDiv.className = '';
                        }, 3000);
                    }
                }
            }
            
            console.log("========== AUTO-SAVE END ==========");
        }, 10);

        // Update event listeners so that we mark fields as dirty on input but only trigger auto-save on blur:
        Object.values(fieldMap).forEach(input => {
            // Mark the field as dirty whenever its content changes.
            input.addEventListener('input', (e) => {
                const fieldName = input.getAttribute('field');
                const inputType = input.getAttribute('type');
                console.log(`Input event on field ${fieldName} (type: ${inputType}) - marking as dirty only`);
                this.dirtyFields.add(fieldName);
            });
            
            // Add blur event to trigger auto-save when leaving the field
            input.addEventListener('blur', (e) => {
                const fieldName = input.getAttribute('field');
                const inputType = input.getAttribute('type');
                console.log(`Blur event on field ${fieldName} (type: ${inputType}) - triggering auto-save`);
                autoSave(e);
            });
            
            // Listen for data-changed events from bindable-input components
            input.addEventListener('data-changed', (event) => {
                const fieldName = event.detail?.field || input.getAttribute('field');
                const inputType = input.getAttribute('type');
                
                if (fieldName) {
                    console.log(`data-changed event on field ${fieldName} (type: ${inputType})`);
                    this.dirtyFields.add(fieldName);
                    
                    // Only trigger auto-save for immediate-save fields
                    if (['checkbox', 'radio', 'select', 'enum', 'lookup'].includes(inputType)) {
                        console.log(`Auto-saving immediate-save field ${fieldName} (type: ${inputType}) on data-changed`);
                        autoSave(event);
                    } else {
                        console.log(`Field ${fieldName} (type: ${inputType}) marked dirty, will save on blur`);
                    }
                }
            });
        });

        this.body.appendChild(this.formElement);
    }

    async _Zoom() {
        // Get current record data
        if (!this.record) {
            this._showFormError("No record data available to display");
            return;
        }
        
        // Add a marker to indicate that the zoom dialog is open
        window.zoomDialogOpen = true;
        
        // Create a dialog overlay
        const overlay = document.createElement('div');
        overlay.className = 'zoom-overlay';
        
        // Create dialog container
        const dialog = document.createElement('div');
        dialog.className = 'zoom-dialog';
        
        // Add header with title and close button
        const header = document.createElement('div');
        header.className = 'zoom-header';
        
        const title = document.createElement('h3');
        title.textContent = 'Record Details';
        header.appendChild(title);
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.className = 'zoom-close-btn';
        closeBtn.addEventListener('click', () => {
            closeZoomDialog();
        });
        header.appendChild(closeBtn);
        dialog.appendChild(header);
        
        // Format record as pretty JSON
        const content = document.createElement('div');
        content.className = 'zoom-content';
        
        const pre = document.createElement('pre');
        pre.className = 'json-display';
        pre.textContent = JSON.stringify(this.record, null, 2);
        content.appendChild(pre);
        dialog.appendChild(content);
        
        // Add copy button
        const actions = document.createElement('div');
        actions.className = 'zoom-actions';
        
        const copyBtn = document.createElement('button');
        copyBtn.textContent = 'Copy to Clipboard';
        copyBtn.className = 'zoom-copy-btn';
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(JSON.stringify(this.record, null, 2))
                .then(() => {
                    copyBtn.textContent = 'Copied!';
                    setTimeout(() => {
                        copyBtn.textContent = 'Copy to Clipboard';
                    }, 2000);
                })
                .catch(err => {
                    console.error('Failed to copy: ', err);
                    copyBtn.textContent = 'Copy Failed';
                    setTimeout(() => {
                        copyBtn.textContent = 'Copy to Clipboard';
                    }, 2000);
                });
        });
        actions.appendChild(copyBtn);
        dialog.appendChild(actions);
        
        // Add to DOM
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        
        // Function to close the zoom dialog
        const closeZoomDialog = () => {
            if (document.body.contains(overlay)) {
                document.body.removeChild(overlay);
                window.zoomDialogOpen = false;
                document.removeEventListener('keydown', escHandler);
            }
        };
        
        // Add escape key handler to close
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                e.preventDefault();
                closeZoomDialog();
                return false;
            }
        };
        
        // Ensure this handler runs before the window's ESC handler by using capture phase
        document.addEventListener('keydown', escHandler, { capture: true });
        
        // Add click outside to close
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeZoomDialog();
            }
        });
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
                // Create a fresh record object
                this.record = response.result;
                this._updateFormFields();
                this._updateRecordIndicator();
            } else {
                console.log(`No records found for ${modelName}, creating a new blank record`);
                // If no records found, create a new blank record
                this._createNewRecord();
            }
        } catch (error) {
            console.warn(`findFirst request for ${modelName} timed out`);
            this._showFormError(`Failed to load data. Please try again later.`);
        }
    }

    _updateFormFields() {
        console.log('Updating form fields with record:', this.record);
        const inputs = this.formElement.querySelectorAll('bindable-input');
        
        // First reset all inputs to ensure they don't show old values
        inputs.forEach(input => {
            input.value = '';
        });
        
        // Then update with current record values
        inputs.forEach(input => {
            input.record = this.record;
            input.updateValue();
        });
        
        // Force a repaint to ensure UI is updated
        this.formElement.style.opacity = '0.99';
        setTimeout(() => {
            this.formElement.style.opacity = '1';
        }, 10);
    }

    async _fetchLookupOptions(field, inputElement) {
        // Determine the data source from field configuration
        const dataSource = field.dataSource || 
                         (field.options && field.options.dataSource);
                         
        if (!dataSource) {
            console.warn(`Lookup field ${field.name} has no dataSource specified`);
            if (typeof inputElement.setLookupOptions === 'function') {
                inputElement.setLookupOptions([
                    { id: '', name: `Error: No data source specified for ${field.name}` }
                ]);
            } else {
                inputElement.setAttribute('options', JSON.stringify([
                    { value: '', label: `Error: No data source specified for ${field.name}` }
                ]));
            }
            return;
        }
        
        const displayField = field.displayField || 
                           (field.options && field.options.displayField) || 
                           'name';
                           
        const valueField = field.valueField || 
                         (field.options && field.options.valueField) || 
                         'id';
        
        console.log(`Fetching lookup options for ${field.name} from model ${dataSource}`, {
            field,
            displayField,
            valueField,
            inputType: inputElement.getAttribute('type')
        });
        
        const requestId = `req-find-all-${dataSource}-${field.name}-${Date.now()}`;
        const message = {
            type: 'model',
            name: dataSource,
            action: 'findAll',
            parameters: {},
            requestId
        };
        
        try {
            const response = await this._sendRequest(message);
            if (response.success && Array.isArray(response.result)) {
                console.log(`Received lookup options for ${field.name}:`, response.result);
                
                // Check if this is a lookup field or a select field
                if (inputElement.getAttribute('type') === 'lookup') {
                    // For lookup fields, format options for the lookup dropdown
                    const options = response.result.map(item => ({
                        id: item[valueField] ?? '',
                        name: item[displayField] ?? '(No name)'
                    }));
                    
                    console.log(`Setting lookup options for ${field.name}:`, options);
                    
                    // Call the setLookupOptions method on the input element
                    if (typeof inputElement.setLookupOptions === 'function') {
                        inputElement.setLookupOptions(options);
                        
                        // If we have a current value, update the display value
                        if (this.record && this.record[field.name] !== undefined && this.record[field.name] !== null) {
                            const currentValue = this.record[field.name];
                            inputElement.updateValue();
                        }
                    } else {
                        console.error(`Input element for ${field.name} does not have setLookupOptions method`);
                    }
                } else {
                    // For select fields, use the old approach
                    const selectOptions = response.result.map(item => ({
                        value: item[valueField] ?? '',
                        label: item[displayField] ?? '(No name)'
                    }));
                    inputElement.setAttribute('options', JSON.stringify(selectOptions));
                    if (this.record && this.record[field.name]) {
                        inputElement.updateValue();
                    }
                }
            } else {
                console.warn(`Failed to load lookup options for ${field.name}:`, response.error || 'Unknown error');
                if (inputElement.getAttribute('type') === 'lookup') {
                    // For lookup fields, show an error in the dropdown
                    if (typeof inputElement.setLookupOptions === 'function') {
                        inputElement.setLookupOptions([
                            { id: '', name: `Error loading ${field.name} options: ${response.error || 'Unknown error'}` }
                        ]);
                    }
                } else {
                    // For select fields, use the old approach
                    inputElement.setAttribute('options', JSON.stringify([
                        { value: '', label: `Error loading ${field.name} options: ${response.error || 'Unknown error'}` }
                    ]));
                }
            }
        } catch (error) {
            console.warn(`Lookup request for ${field.name} timed out`);
            if (inputElement.getAttribute('type') === 'lookup') {
                // For lookup fields, show an error in the dropdown
                if (typeof inputElement.setLookupOptions === 'function') {
                    inputElement.setLookupOptions([
                        { id: '', name: `Error: Timeout loading ${field.name} options` }
                    ]);
                }
            } else {
                // For select fields, use the old approach
                inputElement.setAttribute('options', JSON.stringify([
                    { value: '', label: `Error: Timeout loading ${field.name} options` }
                ]));
            }
        }
    }

    /**
     * Displays an error message in the form
     * @param {string} message - The error message to display
     */
    _showFormError(message) {
        const statusDiv = document.getElementById('statusMessage');
        if (statusDiv) {
            statusDiv.textContent = message;
            statusDiv.className = 'error';
            setTimeout(() => {
                statusDiv.textContent = '';
                statusDiv.className = '';
            }, 3000);
        } else {
            console.error('Form error:', message);
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
        this.recordIndicator.textContent = 'Record Id: -';
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
            this.recordIndicator.textContent = `Record Id: ${this.record.id}`;
        } else if (this.recordIndicator) {
            this.recordIndicator.textContent = 'Record Id: -';
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
                    shortcut: 'F3'
                },
                { 
                    label: 'Delete', 
                    action: () => this._deleteRecord(),
                    shortcut: 'F4'
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
                    action: () => this._Zoom(),
                    shortcut: 'F8'
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

            // Create a container for the menu item text
            const textSpan = document.createElement('span');
            textSpan.className = 'menu-item-text';
            textSpan.textContent = item.caption || item.label || '';
            menuItem.appendChild(textSpan);
            
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
                min-width: 180px;
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
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .dropdown-item:hover {
                background-color: var(--dropdown-hover-bg);
                color: var(--dropdown-hover-text);
            }
            
            .menu-item-text {
                flex-grow: 1;
                text-overflow: ellipsis;
                overflow: hidden;
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
                min-width: 180px;
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
                margin-left: 20px;
                opacity: 0.7;
                font-size: 0.85em;
                color: var(--dropdown-text);
                text-align: right;
                flex-shrink: 0;
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
        const statusDiv = document.getElementById('statusMessage');
        if (statusDiv) {
            statusDiv.textContent = 'New record';
            statusDiv.className = 'info';
            setTimeout(() => {
                statusDiv.textContent = '';
                statusDiv.className = '';
            }, 1500);
        }
    }

    /**
     * Deletes the current record after confirmation
     */
    async _deleteRecord() {
        // Check if we have a valid record with an ID
        if (!this.record || !this.record.id || this.record.id === 0) {
            // Show message that there's no record to delete
            const statusDiv = document.getElementById('statusMessage');
            if (statusDiv) {
                statusDiv.textContent = 'No record to delete';
                statusDiv.className = 'error';
                setTimeout(() => {
                    statusDiv.textContent = '';
                    statusDiv.className = '';
                }, 1500);
            }
            return;
        }

        // Show confirmation dialog
        const confirmDelete = window.confirm(`Are you sure you want to delete this record (ID: ${this.record.id})?`);
        if (!confirmDelete) {
            return; // User cancelled the deletion
        }

        const formCfg = this.config.formConfig;
        if (!formCfg?.model) {
            console.error("Cannot delete: model name is missing in form configuration");
            this._showFormError("Cannot delete: Form configuration is incomplete");
            return;
        }

        const recordId = this.record.id;
        const modelName = formCfg.model;

        // Store deleted record ID for later reference
        const deletedRecordId = recordId;

        // Show status
        const statusDiv = document.getElementById('statusMessage');
        if (statusDiv) {
            statusDiv.textContent = 'Deleting...';
            statusDiv.className = 'saving';
        }

        try {
            // First delete the record
            const deleteRequestId = `req-delete-${modelName}-${Date.now()}`;
            const deleteMessage = {
                type: 'model',
                name: modelName,
                action: 'delete',
                parameters: { id: recordId },
                requestId: deleteRequestId
            };

            console.log('Sending delete request for record ID:', recordId);
            const deleteResponse = await this._sendRequest(deleteMessage);
            console.log('Delete response:', deleteResponse);
            
            if (!deleteResponse || !deleteResponse.success) {
                const errorMsg = deleteResponse?.error || 'Failed to delete record';
                this._showFormError(errorMsg);
                return;
            }
            
            // Clear the UI immediately after successful deletion
            // to prevent showing deleted record
            this.record = { id: 0 };
            this.dirtyFields.clear();
            
            // Clear all form inputs
            const inputs = this.formElement.querySelectorAll('bindable-input');
            inputs.forEach(input => {
                if (input.reset) {
                    input.reset();
                } else {
                    input.value = '';
                }
            });
            
            // Show success message
            if (statusDiv) {
                statusDiv.textContent = 'Record deleted';
                statusDiv.className = 'success';
            }
            
            // Now find the next record after deletion
            const nextRequestId = `req-findNext-${modelName}-${Date.now()}`;
            const nextMessage = {
                type: 'model',
                name: modelName,
                action: 'findNext',
                parameters: { id: deletedRecordId },
                requestId: nextRequestId
            };
            
            console.log('Looking for next record after deletion...');
            try {
                const nextResponse = await this._sendRequest(nextMessage);
                console.log('Next record response:', nextResponse);
                
                if (nextResponse.success && nextResponse.result) {
                    // Verify the next record isn't the same as the deleted one
                    if (nextResponse.result.id !== deletedRecordId) {
                        console.log('Found valid next record:', nextResponse.result);
                        this.record = nextResponse.result;
                        this._updateFormFields();
                        this._updateRecordIndicator();
                        return;
                    } else {
                        console.warn('Server returned the deleted record as next record!');
                    }
                }
                
                // If no next record found or it returned the deleted record, 
                // try to find the previous record
                const prevRequestId = `req-findPrevious-${modelName}-${Date.now()}`;
                const prevMessage = {
                    type: 'model',
                    name: modelName,
                    action: 'findPrevious',
                    parameters: { id: deletedRecordId },
                    requestId: prevRequestId
                };
                
                console.log('Looking for previous record after deletion...');
                const prevResponse = await this._sendRequest(prevMessage);
                console.log('Previous record response:', prevResponse);
                
                if (prevResponse.success && prevResponse.result) {
                    // Verify the previous record isn't the same as the deleted one
                    if (prevResponse.result.id !== deletedRecordId) {
                        console.log('Found valid previous record:', prevResponse.result);
                        this.record = prevResponse.result;
                        this._updateFormFields();
                        this._updateRecordIndicator();
                        return;
                    } else {
                        console.warn('Server returned the deleted record as previous record!');
                    }
                }
                
                // If we still don't have a valid record, create a new one
                console.log('No valid next or previous records found, creating new record');
                this._createNewRecord();
                
            } catch (navError) {
                console.error('Error finding next/previous record:', navError);
                // If navigation fails, create a new record
                this._createNewRecord();
            }
        } catch (error) {
            console.error('Error in delete process:', error);
            this._showFormError(`Error: ${error.message || 'Failed to delete record'}`);
        }
    }

    /**
     * Process a file field for saving, converting to appropriate format
     * @param {Object} value - The file field value with tempFile object
     * @returns {Promise<Object|string>} - Processed file object or path
     * @private
     */
    async _processFileForSave(value) {
        if (!value || !value.tempFile || !(value.tempFile instanceof File)) {
            return value; // Return as is if not a valid file object
        }
        
        // Read the file as base64
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = () => {
                try {
                    // Create file data object with base64 content
                    const fileData = {
                        filename: value.filename,
                        mimeType: value.mimeType,
                        size: value.size,
                        data: reader.result.split(',')[1], // Remove data URL prefix
                        uploadDate: new Date().toISOString()
                    };
                    
                    // Resolve with processed file data
                    resolve(fileData);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };
            
            // Read as data URL (base64)
            reader.readAsDataURL(value.tempFile);
        });
    }

    /**
     * Process a file field value for saving to the server
     * @param {Object} fileValue - The file field value containing tempFile
     * @returns {Promise<Object>} - The processed file data
     * @private
     */
    _processFileForSave(fileValue) {
        return new Promise((resolve, reject) => {
            if (!fileValue || !fileValue.tempFile) {
                console.warn('No file to process:', fileValue);
                return resolve(fileValue);
            }
            
            const file = fileValue.tempFile;
            const reader = new FileReader();
            
            reader.onload = function(event) {
                try {
                    // Convert the file to base64
                    const base64Data = event.target.result;
                    // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
                    const base64Content = base64Data.split(',')[1];
                    
                    const fileData = {
                        filename: file.name,
                        mimeType: file.type,
                        size: file.size,
                        data: base64Content,
                        uploadDate: new Date().toISOString()
                    };
                    
                    console.log(`File processed successfully: ${file.name} (${file.type}, ${file.size} bytes)`);
                    resolve(fileData);
                } catch (err) {
                    console.error('Error processing file data:', err);
                    reject(err);
                }
            };
            
            reader.onerror = function(error) {
                console.error('Error reading file:', error);
                reject(error);
            };
            
            reader.readAsDataURL(file);
        });
    }
}
