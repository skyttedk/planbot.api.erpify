/**
 * Unit tests for PasswordField
 */

import PasswordField from '../../../../server/models/fields/PasswordField.js';
import Field from '../../../../server/lib/orm/Field.js';
import { cleanupTestUsers } from '../../../setup.js';

describe('PasswordField', () => {
  // Mock console methods to reduce noise
  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(async () => {
    // Clean up test users
    await cleanupTestUsers();
    jest.restoreAllMocks();
  });

  // Test class structure
  describe('class structure', () => {
    it('should extend the Field class', () => {
      const passwordField = new PasswordField('password');
      expect(passwordField).toBeInstanceOf(Field);
    });

    it('should have required methods', () => {
      const passwordField = new PasswordField('password');
      expect(typeof passwordField.onSet).toBe('function');
      expect(typeof passwordField.onGet).toBe('function');
      expect(typeof passwordField._validatePassword).toBe('function');
      expect(typeof passwordField._mockHashPassword).toBe('function');
      expect(typeof passwordField.verifyPassword).toBe('function');
    });
  });

  // Test password hashing
  describe('password hashing', () => {
    it('should hash passwords with onSet', async () => {
      const passwordField = new PasswordField('password');
      const plainPassword = 'Test@123';
      
      // Now test the onSet method
      const hashedPassword = await passwordField.onSet(plainPassword);
      
      console.log('Plain password:', plainPassword);
      console.log('Hashed password:', hashedPassword);
      
      // Just check that it's a string and matches the expected pattern
      expect(typeof hashedPassword).toBe('string');
      expect(hashedPassword).toMatch(/^\$2b\$10\$mock_hash_/);
    });

    it('should return null when null is passed to onSet', async () => {
      const passwordField = new PasswordField('password');
      const result = await passwordField.onSet(null);
      expect(result).toBeNull();
    });

    it('should return undefined when undefined is passed to onSet', async () => {
      const passwordField = new PasswordField('password');
      const result = await passwordField.onSet(undefined);
      expect(result).toBeUndefined();
    });

    it('should not hash an already hashed password', () => {
      const passwordField = new PasswordField('password');
      const hashedPassword = '$2b$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ012345';
      const result = passwordField.onSet(hashedPassword);
      
      // Should return the same hash
      expect(result).toBe(hashedPassword);
    });
  });

  // Test password validation
  describe('password validation', () => {
    it('should validate password length', async () => {
      const passwordField = new PasswordField('password');
      
      // Too short
      await expect(passwordField._validatePassword('Abc@1')).rejects.toThrow(/at least 8 characters/);
      
      // Long enough
      await expect(passwordField._validatePassword('Abcdef@1')).resolves.toBeTruthy();
    });

    it('should validate password complexity', async () => {
      const passwordField = new PasswordField('password');
      
      // Missing special character
      await expect(passwordField._validatePassword('Abcdef123')).rejects.toThrow(/special character/);
      
      // Missing number
      await expect(passwordField._validatePassword('Abcdef@#')).rejects.toThrow(/number/);
      
      // Missing uppercase
      await expect(passwordField._validatePassword('abcdef@1')).rejects.toThrow(/uppercase/);
      
      // Valid password
      await expect(passwordField._validatePassword('Abcdef@1')).resolves.toBeTruthy();
    });
  });

  // Test password verification
  describe('password verification', () => {
    it('should verify a correct password', async () => {
      const passwordField = new PasswordField('password');
      const plainPassword = 'Test@123';
      const hashedPassword = passwordField._mockHashPassword(plainPassword);
      
      const isValid = await passwordField.verifyPassword(plainPassword, hashedPassword);
      expect(isValid).toBe(true);
    });
    
    it('should not verify an incorrect password', async () => {
      const passwordField = new PasswordField('password');
      const plainPassword = 'Test@123';
      const wrongPassword = 'Wrong@123';
      const hashedPassword = passwordField._mockHashPassword(plainPassword);
      
      const isValid = await passwordField.verifyPassword(wrongPassword, hashedPassword);
      expect(isValid).toBe(false);
    });
  });
}); 