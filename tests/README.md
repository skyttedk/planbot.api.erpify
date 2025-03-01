# Testing Framework

This directory contains the testing infrastructure for the application. We use Jest as our testing framework.

## Directory Structure

```
tests/
├── setup.js                # Common setup and utilities for all tests
├── unit/                   # Unit tests
│   ├── models/             # Tests for models
│   │   ├── fields/         # Tests for field types
│   │   │   ├── Field.test.js
│   │   │   └── PasswordField.test.js
│   │   ├── Model.test.js
│   │   └── User.test.js
│   └── ...
├── integration/            # Integration tests (future)
└── e2e/                    # End-to-end tests (future)
```

## Running Tests

You can run the tests using the following npm commands:

```bash
# Run all tests
npm test

# Run tests in watch mode (automatically re-run on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run a specific test file
npm test -- PasswordField.test.js
```

## Writing Tests

### Test File Naming

Test files should be named with the `.test.js` extension and placed in a directory structure that mirrors the application code.

### Test Structure

Each test file should follow this general structure:

```javascript
/**
 * Description of what is being tested
 */

import { thingBeingTested } from '../path/to/thing';

describe('ThingBeingTested', () => {
  // Setup before tests
  beforeAll(() => {
    // Setup that runs once before all tests
  });

  afterAll(() => {
    // Cleanup that runs once after all tests
  });

  beforeEach(() => {
    // Setup that runs before each test
  });

  afterEach(() => {
    // Cleanup that runs after each test
  });

  // Group related tests
  describe('specific functionality', () => {
    it('should do something specific', () => {
      // Test code
      expect(result).toBe(expectedValue);
    });

    it('should handle edge cases', () => {
      // Test code
      expect(() => functionThatThrows()).toThrow();
    });
  });
});
```

### Common Utilities

The `setup.js` file contains common utilities for tests, including:

- Database connection management
- Test user creation and cleanup
- Other helper functions

Import these utilities in your test files as needed:

```javascript
import { createTestUser, cleanupTestUsers } from '../../setup.js';
```

## Best Practices

1. **Isolation**: Each test should be independent and not rely on the state from other tests.
2. **Mocking**: Use Jest's mocking capabilities to isolate the code being tested.
3. **Coverage**: Aim for high test coverage, especially for critical paths.
4. **Descriptive Names**: Use descriptive test names that explain what is being tested.
5. **Clean Up**: Always clean up resources (database records, mocks, etc.) after tests. 