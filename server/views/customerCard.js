// js/configs/form-config.js

export const customerCardForm = {
    "id": "customerForm",
    "caption": "Customer Information",
    "type": "form",
    "model": "Customer",
    "menuLocation": "Customers.CustomerCard",
    "menu": [
        {
            "location": "Test",
            "caption": "Run Test",
            "type": "controller",
            "name": "Test",
            "action": "performTest"
        }
    ],
    "layout": {
        "groups": [
            {
                "caption": "General Information",
                "fields": [
                    {
                        "name": "name"
                    },
                    {
                        "name": "gender"
                    },
                    {
                        "name": "address"

                    },
                    {
                        "name": "address2"
                    },
                    {
                        "name": "country"
                    },
                    {
                        "name": "email",
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
                        "caption": "Customer Age",
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