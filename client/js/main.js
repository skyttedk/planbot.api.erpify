import './components/bindable-input.js';
import { WindowForm } from './window-form-builder.js';
import { socketService } from './services/socket-service.js';

// Request window configurations from the server
socketService.sendMessage({
    action: 'getWindowConfigs',
    requestId: 'req-get-window-configs'
});

// Listen for server responses
socketService.on('message', (message) => {
    if (message.requestId === 'req-get-window-configs' && message.windowConfigs) {
        message.windowConfigs.forEach(config => {
            // Instantiate the unified WindowForm class with the config and socket service
            const wf = new WindowForm(config, socketService);
            document.getElementById('desktop').appendChild(wf.getElement());
        });
    }
});

// For demo purposes, simulate a server response after 1 second
setTimeout(() => {
    const simulatedResponse = {
        requestId: 'req-get-window-configs',
        windowConfigs: [
            {
                windowId: 'customerWindow',
                title: 'Customer Record',
                position: { top: 50, left: 50 },
                size: { width: 700, height: 400 },
                formConfig: {
                    id: 'customerForm',
                    caption: { default: 'Customer Details' },
                    submitLabel: 'Save Customer',
                    layout: {
                        groups: [
                            {
                                id: 'generalInfo',
                                caption: { default: 'General Information' },
                                fields: [
                                    {
                                        name: 'name',
                                        caption: { default: 'Customer Name' },
                                        type: 'text',
                                        required: true,
                                        events: { change: 'validateName' }
                                    },
                                    {
                                        name: 'email',
                                        caption: { default: 'Email' },
                                        type: 'email',
                                        required: true,
                                        events: { blur: 'validateEmail' }
                                    },
                                    {
                                        name: 'subscriptionType',
                                        caption: { default: 'Subscription Type' },
                                        type: 'select',
                                        required: true,
                                        options: [
                                            { value: 'free', label: { default: 'Free' } },
                                            { value: 'premium', label: { default: 'Premium' } },
                                            { value: 'enterprise', label: { default: 'Enterprise' } }
                                        ],
                                        defaultValue: 'free',
                                        events: { change: 'handleSubscriptionChange' }
                                    }
                                ]
                            },
                            {
                                id: 'billingInfo',
                                caption: { default: 'Billing Information' },
                                fields: [
                                    {
                                        name: 'billingContact',
                                        caption: { default: 'Billing Contact' },
                                        type: 'text',
                                        required: true,
                                        conditional: {
                                            showWhen: { field: 'subscriptionType', operator: 'notEquals', value: 'free' }
                                        }
                                    },
                                    {
                                        name: 'paymentTerms',
                                        caption: { default: 'Payment Terms' },
                                        type: 'select',
                                        options: [
                                            { value: 'net30', label: { default: 'Net 30' } },
                                            { value: 'net60', label: { default: 'Net 60' } }
                                        ],
                                        defaultValue: 'net30',
                                        conditional: {
                                            showWhen: { field: 'subscriptionType', operator: 'notEquals', value: 'free' }
                                        }
                                    }
                                ]
                            },
                            {
                                id: 'additionalInfo',
                                caption: { default: 'Additional Information' },
                                fields: [
                                    {
                                        name: 'isBusiness',
                                        caption: { default: 'Business Customer' },
                                        type: 'checkbox',
                                        defaultValue: false
                                    },
                                    {
                                        name: 'startDate',
                                        caption: { default: 'Start Date' },
                                        type: 'date'
                                    },
                                    {
                                        name: 'comments',
                                        caption: { default: 'Comments' },
                                        type: 'textarea',
                                        maxLength: 500
                                    },
                                    {
                                        name: 'salesRep',
                                        caption: { default: 'Sales Representative' },
                                        type: 'lookup',
                                        dataSource: 'employees',
                                        displayField: 'name',
                                        valueField: 'id'
                                    }
                                ]
                            }
                        ]
                    },
                    permissions: {
                        fields: {
                            name: { editable: true },
                            email: { editable: true },
                            billingContact: { editable: true }
                        }
                    }
                }
            }
        ]
    };

    // Trigger the "message" event instead of directly invoking request-id listeners
    socketService._emit('message', simulatedResponse);
}, 1000);