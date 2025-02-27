// js/configs/form-config.js

export const customerCardForm = {
    "id": "customerForm",
    "caption": { "key": "customerForm.caption", "default": "Customer Details" },
    "type": "form",
    "model": "Customer",
    "layout": {
        "groups": [
            {
                "id": "generalInfo",
                "caption": { "key": "group.generalInfo", "default": "General Information" },
                "fields": [
                      {
                        "name": "name",
                        "caption": { "key": "field.name", "default": "Name" },
                        "type": "text"
                    },
                    {
                        "name": "email",
                        "caption": { "key": "field.email", "default": "Email" },
                        "type": "email",
                        "events": { "blur": "validateEmail" }
                    },
                    {
                        "name": "phone",
                        "caption": { "key": "field.phone", "default": "Phone" },
                        "type": "tel"
                    },
                    {
                        "name": "zip",
                        "caption": { "key": "field.zip", "default": "Zip" },
                        "type": "text"
                    }
                    
                ]
            },
            {
                "id": "billingInfo",
                "caption": { "key": "group.billingInfo", "default": "Billing Information" },
                "fields": [
                  
                ]
            },
            {
                "id": "businessInfo",
                "caption": { "key": "group.businessInfo", "default": "Business Information" },
                "conditional": {
                    "showWhen": { "field": "isBusiness", "operator": "equals", "value": true }
                },
                "fields": [
                  
                ]
            },
            {
                "id": "additionalInfo",
                "caption": { "key": "group.additionalInfo", "default": "Additional Information" },
                "fields": [
                    
                ]
            }
        ]
    },
    "permissions": {
        "fields": {
            "email": { "editable": true },
        }
    }
};

// Create a window configuration that includes the form
const customerCardView = [
    {
        "id": "customerWindow",
        "type": "window",
        "title": "Customer Record",
        "width": 800,
        "height": 600,
        "resizable": true,
        "movable": true,
        "position": {
            "top": 50,
            "left": 50
        },
        "size": {
            "width": 800,
            "height": 600
        },
        "formConfig": customerCardForm
    }
];

// Export the window configuration as the default export
export default customerCardView;