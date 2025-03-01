/**
 * Unit tests for the User model
 */

import User from '../../../server/models/User.js';
import { createTestUser, cleanupTestUsers } from '../../setup.js';

describe('User Model', () => {
  // Mocking console methods to reduce output noise
  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(async () => {
    // Clean up any test users created during tests
    await cleanupTestUsers();
    jest.restoreAllMocks();
  });

  // Test User model static properties
  describe('static properties', () => {
    it('should have the correct table name', () => {
      expect(User.tableName).toBe('users');
    });

    it('should have the required fields', () => {
      const fields = User.fields;
      expect(fields.id).toBeDefined();
      expect(fields.username).toBeDefined();
      expect(fields.password).toBeDefined();
      expect(fields.email).toBeDefined();
      expect(fields.isAdmin).toBeDefined();
      expect(fields.isActive).toBeDefined();
    });
  });

  // Test User model CRUD operations
  describe('CRUD operations', () => {
    // Unique identifier for test users in this run
    const testId = Date.now();

    it('should create a new user', async () => {
      const userData = {
        username: `testuser_${testId}`,
        password: 'Test@123',
        email: `test${testId}@example.com`,
        name: 'Test User',
        isAdmin: false,
        isActive: true
      };

      const user = await User.create(userData);
      
      expect(user.data.id).toBeDefined();
      expect(user.data.username).toBe(userData.username);
      expect(user.data.password).not.toBe(userData.password); // Password should be hashed
      expect(user.data.email).toBe(userData.email);
    });

    it('should find a user by id', async () => {
      // Create a test user first
      const createdUser = await createTestUser(User);
      
      // Then find it by ID
      const foundUser = await User.findById(createdUser.data.id);
      
      expect(foundUser).toBeDefined();
      expect(foundUser.data.id).toBe(createdUser.data.id);
      expect(foundUser.data.username).toBe(createdUser.data.username);
    });

    it('should find a user by username', async () => {
      // Create a test user first
      const testUsername = `testuser_${Date.now()}`;
      const createdUser = await createTestUser(User, { username: testUsername });
      
      // Then find it by username
      const foundUser = await User.findOne({ username: testUsername });
      
      expect(foundUser).toBeDefined();
      expect(foundUser.data.id).toBe(createdUser.data.id);
      expect(foundUser.data.username).toBe(testUsername);
    });

    it('should update a user', async () => {
      // Create a test user first
      const createdUser = await createTestUser(User);
      
      // Update the user
      const newEmail = `updated${Date.now()}@example.com`;
      createdUser.data.email = newEmail;
      await createdUser.save();
      
      // Then find it again to verify the update
      const updatedUser = await User.findById(createdUser.data.id);
      
      expect(updatedUser.data.email).toBe(newEmail);
    });

    it('should delete a user', async () => {
      // Create a test user first
      const createdUser = await createTestUser(User);
      const userId = createdUser.data.id;
      
      // Delete the user
      await createdUser.delete();
      
      // Try to find it again
      const deletedUser = await User.findById(userId);
      
      expect(deletedUser).toBeNull();
    });
  });

  // Test authentication
  describe('authentication', () => {
    it('should authenticate a user with correct credentials', async () => {
      const testPassword = 'Test@123';
      
      // Create a test user
      const createdUser = await createTestUser(User, { password: testPassword });
      
      // Authenticate
      const authenticatedUser = await User.authenticate(createdUser.data.username, testPassword);
      
      expect(authenticatedUser).toBeDefined();
      expect(authenticatedUser.data.id).toBe(createdUser.data.id);
    });

    it('should not authenticate a user with incorrect password', async () => {
      // Create a test user
      const createdUser = await createTestUser(User);
      
      // Try to authenticate with wrong password
      const authenticatedUser = await User.authenticate(createdUser.data.username, 'wrong_password');
      
      expect(authenticatedUser).toBeNull();
    });

    it('should not authenticate a non-existent user', async () => {
      // Try to authenticate a user that doesn't exist
      const authenticatedUser = await User.authenticate('nonexistent_user', 'password');
      
      expect(authenticatedUser).toBeNull();
    });

    it('should not authenticate an inactive user', async () => {
      // Create an inactive test user
      const createdUser = await createTestUser(User, { isActive: false });
      
      // Try to authenticate
      const authenticatedUser = await User.authenticate(createdUser.data.username, 'Test@123');
      
      expect(authenticatedUser).toBeNull();
    });
  });

  // Test password hashing
  describe('password handling', () => {
    it('should hash the password when creating a user', async () => {
      const plainPassword = 'Test@123';
      
      // Create a test user
      const user = await createTestUser(User, { password: plainPassword });
      
      // Check that the password is hashed
      expect(user.data.password).not.toBe(plainPassword);
      expect(user.data.password).toMatch(/^\$2[ayb]\$.{56}$/); // bcrypt hash format
    });

    it('should hash the password when updating a user', async () => {
      // Create a test user
      const user = await createTestUser(User);
      
      // Update with new password
      const newPassword = 'NewTest@456';
      user.data.password = newPassword;
      await user.save();
      
      // Check that the new password is hashed
      expect(user.data.password).not.toBe(newPassword);
      expect(user.data.password).toMatch(/^\$2[ayb]\$.{56}$/); // bcrypt hash format
    });

    it('should verify a correct password', async () => {
      const plainPassword = 'Test@123';
      
      // Create a test user
      const user = await createTestUser(User, { password: plainPassword });
      
      // Verify the password
      const isValid = await User.fields.password.verifyPassword(plainPassword, user.data.password);
      
      expect(isValid).toBe(true);
    });

    it('should not verify an incorrect password', async () => {
      const plainPassword = 'Test@123';
      
      // Create a test user
      const user = await createTestUser(User, { password: plainPassword });
      
      // Try to verify with wrong password
      const isValid = await User.fields.password.verifyPassword('wrong_password', user.data.password);
      
      expect(isValid).toBe(false);
    });
  });
}); 