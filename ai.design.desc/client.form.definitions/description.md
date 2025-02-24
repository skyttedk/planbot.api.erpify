Declarative Form Configuration for ERP Applications

Overview

This configuration defines how forms, lists, lookup screens, and other UI elements are rendered in an ERP application. It uses a declarative JSON-based approach, enabling non-UI developers to specify the layout, data source, actions, and dynamic behaviors without hard-coding UI logic. The system ensures consistency, extensibility, and rapid development across various data models (e.g., customers, orders, products).

Problem Statement

ERP applications require forms and lists for diverse data models. The goal is to create a declarative configuration system that:

- Eliminates manual UI design decisions.

- Standardizes the appearance and behavior of all UI elements.

- Provides a machine-readable, extensible format for parsing and rendering.

Requirements

Functional Requirements

- Form Types: Supports "list" (record list), "form" (single record), "lookup/search" (record selection), and other types (e.g., dashboards).

- Data Source Integration: Links to backend models (e.g., "customers") with optional filtering, sorting, and pagination.

- Permissions: Controls actions (insert, delete, modify) at the form and field levels.

- Menu: Defines menu groups and items with actions (e.g., backend functions, client-side scripts).

- Layout & Fields: Organizes fields into groups with properties like name, type, caption, validation, and conditional logic.

Non-Functional Requirements

- Consistency: Uniform rendering across all data models.

- Extensibility: Easy to add new properties or form types.

- Ease of Use: No UI coding required for layout or actions.

- Machine Readability: Standardized JSON format for automated processing.

Configuration Structure

The configuration is written in JSON with the following key sections:

General Properties

- id: Unique identifier for the configuration.

- caption: Object with key (i18n reference) and default (fallback text).

- type: Form type (e.g., "list", "form", "lookup", "search").

- dataSource: Backend model or table name (e.g., "customers").

- filter: Structured query for default filtering (e.g., { field, operator, value }).

- sort: Default sorting field and order (e.g., { field: "name", order: "asc" }).

- pagination: List pagination settings (e.g., page size, current page).

Permissions

- permissions:
  
  - allowInsert, allowDelete, allowModify: Boolean flags for record actions.
  
  - fields: Optional field-level permissions (e.g., read-only).

Menu

- menu: Array of menu groups:
  
  - caption: Internationalized label.
  
  - items: Array of { caption, action } (action maps to a function/command).

Layout

- layout:
  
  - layoutType: Responsive style (e.g., "grid", "flex").
  
  - groups: Array of field groups:
    
    - id: Unique group identifier.
    
    - caption: Internationalized label.
    
    - fields: Array of field definitions:
      
      - name: Unique field identifier.
      
      - caption: Display label (i18n-supported).
      
      - type: Data type (e.g., "text", "number", "date", "select").
      
      - required: Boolean for mandatory fields.
      
      - defaultValue: Pre-populated value.
      
      - maxLength, minLength, pattern: Validation rules.
      
      - readOnly, disabled: UI state controls.
      
      - options: For "select" fields (e.g., [{ value, label }]).
      
      - events: Handlers (e.g., onChange, onBlur) mapped to functions.
      
      - localeFormat: Formatting for dates/numbers.
      
      - conditional: Rules to show/hide based on other field values.

Additional Features

- debug: Boolean to enable detailed error/warning logs during development.

- customTemplates: Hooks for custom rendering (e.g., header, footer).

- metadata: Version, author, and last updated date for tracking.

Example JSON Schema

json

```json
{
  "id": "customerList",
  "caption": { "key": "customer.list", "default": "Customer List" },
  "type": "list",
  "dataSource": "customers",
  "filter": [{ "field": "status", "operator": "equals", "value": "active" }],
  "sort": { "field": "name", "order": "asc" },
  "permissions": {
    "allowInsert": true,
    "allowDelete": true,
    "allowModify": true,
    "fields": { "email": { "readOnly": true } }
  },
  "menu": [
    {
      "caption": { "key": "reports", "default": "Reports" },
      "items": [
        { "caption": { "key": "overview", "default": "Overview" }, "action": "generateReport" }
      ]
    }
  ],
  "layout": {
    "layoutType": "grid",
    "groups": [
      {
        "id": "shipping",
        "caption": { "key": "shipping.info", "default": "Shipping Info" },
        "fields": [
          { "name": "shipToName", "caption": { "key": "shipTo", "default": "Ship-To Name" }, "type": "text", "required": true },
          { "name": "zip", "caption": { "key": "zip", "default": "ZIP Code" }, "type": "number" }
        ]
      }
    ]
  },
  "debug": true,
  "metadata": { "version": "1.0", "author": "xAI", "lastUpdated": "2025-02-19" }
}
```

How to Use

1. Define the Configuration:
   
   - Create a JSON file using the structure above, specifying data sources, layout, fields, and actions.

2. Internationalization (i18n):
   
   - Use caption keys to reference external resource files; provide default values as fallbacks.

3. Parse and Render:
   
   - Implement a Parser to validate the JSON against a schema.
   
   - Use a Renderer (e.g., React, Angular, Vue.js) to dynamically generate the UI.

4. Custom Behaviors:
   
   - Map events and action properties to application functions.
   
   - Define conditional rules for dynamic field visibility.

5. Security:
   
   - Sanitize inputs and enforce backend validation, even with client-side rules.

6. Debugging & Extension:
   
   - Enable debug for detailed logs during development.
   
   - Use customTemplates or additional properties to extend functionality.

7. Validation:
   
   - Integrate schema validation into CI/CD to catch errors early.

Implementation Considerations

- Rendering: Build parser and renderer components for consistent UI generation.

- Extensibility: Allow custom field properties or plugins for future needs.

- Dynamic Menus: Link menu actions to backend or client-side logic.

Example Use Cases

1. Customer List View:
   
   - Type: "list", Data Source: "customers", Features: Filtering, CRUD actions, Menu: Export/Reports.

2. Order Details Form:
   
   - Type: "form", Data Source: "orders", Features: Validation, Menu: Print/Track, Layout: Grouped fields.

Summary

This declarative system simplifies form creation, ensures consistency, and supports rapid development in ERP applications. It provides a flexible, extensible blueprint for standardized UI rendering, leveraging JSON configuration for layout, data integration, permissions, and dynamic behaviors.
