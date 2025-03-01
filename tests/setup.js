/**
 * Common test setup and utilities for the test suite
 */

import pool from '../server/config/db.js';

// Make Jest available globally
import { jest } from '@jest/globals';
global.jest = jest;
global.expect = expect;
global.test = test;
global.describe = describe;
global.beforeAll = beforeAll;
global.afterAll = afterAll;
global.beforeEach = beforeEach;
global.afterEach = afterEach;

// Setup global beforeAll and afterAll hooks
beforeAll(async () => {
  // Ensure database connection is ready
  // This could include things like setting up test data, etc.
  console.log('Setting up test environment...');
});

afterAll(async () => {
  // Perform global cleanup after all tests
  console.log('Cleaning up test environment...');
  await pool.end();
});

// Helper function for cleaning test data
export async function cleanupTestUsers() {
  const client = await pool.connect();
  try {
    await client.query('DELETE FROM users WHERE username LIKE $1', ['testuser_%']);
  } finally {
    client.release();
  }
}

// Helper function for creating a test user
export async function createTestUser(User, customData = {}) {
  const defaultData = {
    username: `testuser_${Date.now()}`,
    password: 'Test@123',
    email: `test${Date.now()}@example.com`,
    name: 'Test User',
    isAdmin: false,
    isActive: true
  };
  
  return await User.create({ ...defaultData, ...customData });
}

// Export any other test helpers as needed 