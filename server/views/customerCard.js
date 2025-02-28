// js/configs/form-config.js

export const customerCardForm = {
    "id": "customerForm",
    "caption": "Customer Details",
    "type": "form",
    "model": "Customer",
    "layout": {
        "groups": [
            {
                "caption": "General Information",
                "fields": [
                    {
                        "name": "name"
                    },
                    {
                        "name": "email",
                        "caption": "Email Addresssss",
                        "editable": false
                    },
                    {
                        "name": "phone"
                    }
                ]
            },
            {
                "caption": "Billing Information",
                "fields": [
                    {
                        "name": "zip"
                    }
                ]
            },
            {
                "caption": "Business Information",
                "fields": [
                    {
                        "name": "age",
                        "caption": "Age",
                        "editable": true
                    }

                ]
            },
            {
                "caption": "Additional Information",
                "fields": [

                ]
            }
        ]
    }
};

// Create a window configuration that includes the form
const customerCardView = [
    {
        "id": "customerWindow",
        "type": "window",
        "width": 800,
        "height": 600,
        "resizable": true,
        "movable": true,
        "position": {
            "top": 100,
            "left": 200
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