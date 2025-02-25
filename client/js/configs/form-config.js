// js/configs/form-config.js

export const formConfig = {
    "id": "customerForm",
    "caption": { "key": "customerForm.caption", "default": "Customer Details" },
    "type": "form",
    "dataSource": "customers",
    "layout": {
        "groups": [
            {
                "id": "generalInfo",
                "caption": { "key": "group.generalInfo", "default": "General Information" },
                "fields": [
                    {
                        "name": "customerId",
                        "caption": { "key": "field.customerId", "default": "Customer ID" },
                        "type": "text",
                        "required": true,
                        "maxLength": 10,
                        "events": { "change": "validateName" }
                    },
                    {
                        "name": "name",
                        "caption": { "key": "field.name", "default": "Name" },
                        "type": "text",
                        "required": true,
                        "maxLength": 100
                    },
                    {
                        "name": "email",
                        "caption": { "key": "field.email", "default": "Email" },
                        "type": "email",
                        "required": true,
                        "pattern": "[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$",
                        "events": { "blur": "validateEmail" }
                    },
                    {
                        "name": "subscriptionType",
                        "caption": { "key": "field.subscriptionType", "default": "Subscription Type" },
                        "type": "select",
                        "required": true,
                        "options": [
                            { "value": "free", "label": { "key": "option.free", "default": "Free" } },
                            { "value": "premium", "label": { "key": "option.premium", "default": "Premium" } },
                            { "value": "enterprise", "label": { "key": "option.enterprise", "default": "Enterprise" } }
                        ],
                        "defaultValue": "free",
                        "events": { "change": "handleSubscriptionChange" }
                    }
                ]
            },
            {
                "id": "billingInfo",
                "caption": { "key": "group.billingInfo", "default": "Billing Information" },
                "fields": [
                    {
                        "name": "billingContact",
                        "caption": { "key": "field.billingContact", "default": "Billing Contact" },
                        "type": "text",
                        "required": true,
                        "conditional": {
                            "showWhen": { "field": "subscriptionType", "operator": "notEquals", "value": "free" }
                        }
                    },
                    {
                        "name": "paymentTerms",
                        "caption": { "key": "field.paymentTerms", "default": "Payment Terms" },
                        "type": "select",
                        "options": [
                            { "value": "net30", "label": { "key": "option.net30", "default": "Net 30" } },
                            { "value": "net60", "label": { "key": "option.net60", "default": "Net 60" } }
                        ],
                        "defaultValue": "net30",
                        "conditional": {
                            "showWhen": { "field": "subscriptionType", "operator": "notEquals", "value": "free" }
                        }
                    }
                ]
            },
            {
                "id": "businessInfo",
                "caption": { "key": "group.businessInfo", "default": "Business Information" },
                "conditional": {
                    "showWhen": { "field": "isBusiness", "operator": "equals", "value": true }
                },
                "fields": [
                    {
                        "name": "companyName",
                        "caption": { "key": "field.companyName", "default": "Company Name" },
                        "type": "text",
                        "required": false
                    },
                    {
                        "name": "taxId",
                        "caption": { "key": "field.taxId", "default": "Tax ID" },
                        "type": "text",
                        "required": false
                    }
                ]
            },
            {
                "id": "additionalInfo",
                "caption": { "key": "group.additionalInfo", "default": "Additional Information" },
                "fields": [
                    {
                        "name": "isBusiness",
                        "caption": { "key": "field.isBusiness", "default": "Business Customer" },
                        "type": "checkbox",
                        "defaultValue": false
                    },
                    {
                        "name": "startDate",
                        "caption": { "key": "field.startDate", "default": "Start Date" },
                        "type": "date",
                        "required": false,
                        "localeFormat": "YYYY-MM-DD"
                    },
                    {
                        "name": "comments",
                        "caption": { "key": "field.comments", "default": "Comments" },
                        "type": "textarea",
                        "required": false,
                        "maxLength": 500
                    },
                    {
                        "name": "salesRep",
                        "caption": { "key": "field.salesRep", "default": "Sales Representative" },
                        "type": "lookup",
                        "required": false,
                        "dataSource": "employees",
                        "displayField": "name",
                        "valueField": "id",
                        "defaultValue": null
                    }
                ]
            }
        ]
    },
    "permissions": {
        "fields": {
            "customerId": { "editable": false },
            "email": { "editable": true },
            "billingContact": { "editable": true }
        }
    }
};