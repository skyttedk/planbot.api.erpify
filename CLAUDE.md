# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Test Commands

- Frontend dev: `npm run frontend dev`
- Backend dev: `npm run backend dev`
- Backend start: `node server/index.js`
- Run all tests: `npm test`
- Run single test file: `cross-env NODE_OPTIONS=--experimental-vm-modules npx jest tests/path/to/file.test.js`
- Watch tests: `npm run test:watch`
- Test with coverage: `npm run test:coverage`
- Pretty test output: `npm run test:pretty`

## Code Style Guidelines

- **ES Modules**: Use import/export syntax - project uses ES modules (type: "module")
- **Field Template Pattern**: Follow field.template structure when creating new field types
- **Model Template Pattern**: Follow model.template structure when creating new models
- **Error Handling**: Use try/catch blocks with specific error messages
- **Naming**: PascalCase for classes, camelCase for variables/functions
- **Documentation**: JSDoc comments for classes and methods
- **Architecture**: Follow the MVC pattern with model-driven development approach
- **Code Cleanup**: Keep code clean, sleek and simple; avoid unnecessary complexity
- **Simplicity**: Don't build a "Rube Goldberg Machine" - aim for the simplest solution

## Adding New Components

- **Field Templates**: Create in server/models/fields following the field.template structure
- **Model Templates**: Create in server/models following the model.template structure
- **Always add new fields** to fieldPaths in server/models/fields/index.js
- **Always add new models** to modelPaths in server/models/index.js

## Project Vision

AI.ERPIFY is a Rapid Application Development platform for quickly building business applications with minimal coding, inspired by Microsoft Access and Dynamics NAV.

## Key Architectural Components

### Database Tier

- PostgreSQL database with pooled connections
- Caching mechanisms via global objects
- Automatic schema synchronization through ORM

### Server Tier

- Node.js backend with WebSockets
- Custom ORM with transaction support and field templates
- JWT-based authentication and RBAC authorization

### Field Templates System

- Centralized field definitions for consistency
- Reusable field components with validation
- Field inheritance and override capabilities
- Auto-generated UI components from field templates

### Socket Communication

- Structured message format for client-server communication
- Request/response pattern with unique request IDs
- Event-based architecture for real-time updates
