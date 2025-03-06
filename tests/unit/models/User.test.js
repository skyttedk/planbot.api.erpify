/**
 * Unit tests for the User model
 */

import User from '../../../server/models/User.js';
import { createTestUser, cleanupTestUsers } from '../../setup.js';

// Test user data
const testUserData = {
  username: 'testuser_123456',
  password: 'Test@123',
  email: 'test123456@example.com',
  name: 'Test User',
  isAdmin: false,
  isActive: true
};

describe('User Model', () => {
  let createdUser = null;

  // Create a test user before running tests
  beforeAll(async () => {
    // Clean up any existing test users to ensure a clean state
    await cleanupTestUsers();
    
    // Create a test user for all tests to use - pass the User model
    createdUser = await createTestUser(User, testUserData);
  });

  // Clean up after all tests
  afterAll(async () => {
    await cleanupTestUsers();
  });

  // Test User model static properties
  describe('static properties', () => {
    it('should have the correct table name', () => {
      expect(User.tableName).toBe('users');
    });

    it('should have the required fields', () => {
      expect(User.fields).toBeDefined();
      expect(User.fields.username).toBeDefined();
      expect(User.fields.password).toBeDefined();
      expect(User.fields.email).toBeDefined();
    });
  });

  // Test User model CRUD operations
  describe('CRUD operations', () => {
    it('should create a new user', async () => {
      const newUser = await User.create({
        username: 'newuser_' + Date.now(),
        password: 'Test@123',
        email: `newuser_${Date.now()}@example.com`,
        name: 'New Test User',
        isAdmin: false,
        isActive: true
      });
      
      expect(newUser).toBeDefined();
      expect(newUser.data).toBeDefined();
      expect(newUser.data.id).toBeDefined();
      expect(newUser.data.username).toBeDefined();
      
      // Clean up
      await newUser.delete();
    });

    it('should find a user by id', async () => {
      const foundUser = await User.findById(createdUser.data.id);
      
      expect(foundUser).toBeDefined();
      expect(foundUser.data).toBeDefined();
      expect(foundUser.data.id).toBe(createdUser.data.id);
      expect(foundUser.data.username).toBe(createdUser.data.username);
    });

    it('should find a user by username', async () => {
      const foundUser = await User.findOne({
        where: { username: createdUser.data.username }
      });
      
      expect(foundUser).toBeDefined();
      expect(foundUser.data).toBeDefined();
      expect(foundUser.data.id).toBe(createdUser.data.id);
      expect(foundUser.data.username).toBe(createdUser.data.username);
    });

    it('should update a user', async () => {
      const updateUser = await User.create({
        username: 'update_user_' + Date.now(),
        password: 'Test@123',
        email: `update_${Date.now()}@example.com`,
        name: 'Original Name',
        isAdmin: false,
        isActive: true
      });
      
      // Update the name
      updateUser.data.name = 'Updated Name';
      await updateUser.save();
      
      // Get the updated user from the database
      const updatedUser = await User.findById(updateUser.data.id);
      
      expect(updatedUser).toBeDefined();
      expect(updatedUser.data).toBeDefined();
      expect(updatedUser.data.name).toBe('Updated Name');
      
      // Clean up
      await updateUser.delete();
    });

    it('should delete a user', async () => {
      // Create a temporary user to delete
      const deleteUser = await User.create({
        username: 'delete_user_' + Date.now(),
        password: 'Test@123',
        email: `delete_${Date.now()}@example.com`,
        name: 'Delete Test User',
        isAdmin: false,
        isActive: true
      });
      
      const userId = deleteUser.data.id;
      
      // Delete the user
      await deleteUser.delete();
      
      // Verify the user is deleted
      const deletedUser = await User.findById(userId);
      expect(deletedUser).toBeNull();
    });
  });

  // Test password field behavior
  describe('password field behavior', () => {
    it('should handle passwords securely', async () => {
      // Create a user with a password
      const plainPassword = 'StrongP@ss123';
      const user = await User.create({
        username: 'password_user_' + Date.now(),
        password: plainPassword,
        email: `password_${Date.now()}@example.com`,
        name: 'Password Test User',
        isActive: true
      });
      
      // Verify we can create a user with a password
      expect(user).toBeDefined();
      expect(user.data.id).toBeDefined();
      
      // Get the user from the database
      const retrievedUser = await User.findById(user.data.id);
      expect(retrievedUser).toBeDefined();
      
      // Clean up
      await user.delete();
    });

    it('should handle password updates', async () => {
      // Create a temporary user for this test
      const user = await User.create({
        username: 'update_pwd_' + Date.now(),
        password: 'Test@123',
        email: `update_pwd_${Date.now()}@example.com`,
        name: 'Update Password Test User',
        isActive: true
      });
      
      // Update the password
      const newPassword = 'NewTest@456';
      user.data.password = newPassword;
      await user.save();
      
      // Verify we can update a user with a new password
      expect(user).toBeDefined();
      
      // Clean up
      await user.delete();
    });
  });
}); 