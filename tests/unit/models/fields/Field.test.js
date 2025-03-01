/**
 * Unit tests for the base Field class
 */

import Field from '../../../../server/lib/orm/Field.js';

describe('Field', () => {
  // Test field instantiation
  describe('constructor', () => {
    it('should create a field with default options', () => {
      const field = new Field({}, 'testField');
      expect(field.fieldName).toBe('testField');
      expect(field.required).toBe(false);
      expect(field.default).toBeUndefined();
    });

    it('should create a field with custom options', () => {
      const options = {
        type: 'string',
        length: 255,
        required: true,
        default: 'default value',
        pattern: /^[a-z]+$/,
        precision: 10,
        scale: 2,
        uid: 'test-uid',
        caption: 'Test Field'
      };
      const field = new Field(options, 'testField');
      expect(field.fieldName).toBe('testField');
      expect(field.type).toBe(options.type);
      expect(field.length).toBe(options.length);
      expect(field.required).toBe(options.required);
      expect(field.default).toBe(options.default);
      expect(field.pattern).toBe(options.pattern);
      expect(field.precision).toBe(options.precision);
      expect(field.scale).toBe(options.scale);
      expect(field.uid).toBe(options.uid);
      expect(field.caption).toBe(options.caption);
    });
  });

  // Test field value processing
  describe('value processing', () => {
    it('should call onSet when setting a value', () => {
      const onSetFn = jest.fn(value => value);
      const field = new Field({ onSet: onSetFn }, 'testField');
      
      field.setValue('test value');
      
      expect(onSetFn).toHaveBeenCalledWith('test value');
    });

    it('should call onGet when getting a value', () => {
      const onGetFn = jest.fn(value => value);
      const field = new Field({ onGet: onGetFn }, 'testField');
      
      field.getValue('test value');
      
      expect(onGetFn).toHaveBeenCalledWith('test value');
    });
    
    it('should return the original value in onSet by default', () => {
      const field = new Field({}, 'testField');
      const result = field.onSet('test value');
      
      expect(result).toBe('test value');
    });
    
    it('should return the original value in onGet by default', () => {
      const field = new Field({}, 'testField');
      const result = field.onGet('test value');
      
      expect(result).toBe('test value');
    });
  });

  // Test validation
  describe('validation', () => {
    it('should validate required fields', () => {
      const requiredField = new Field({ required: true, type: 'string' }, 'testField');
      
      expect(() => requiredField.validate(null)).toThrow('testField is required');
      expect(() => requiredField.validate(undefined)).toThrow('testField is required');
      expect(() => requiredField.validate('')).not.toThrow();
    });
    
    it('should validate string length', () => {
      const field = new Field({ type: 'string', length: 5 }, 'testField');
      
      expect(() => field.validate('12345')).not.toThrow();
      expect(() => field.validate('123456')).toThrow('exceeds the maximum length');
    });
    
    it('should validate string pattern', () => {
      const field = new Field({ 
        type: 'string', 
        pattern: /^[a-z]+$/ 
      }, 'testField');
      
      expect(() => field.validate('abc')).not.toThrow();
      expect(() => field.validate('123')).toThrow('does not match the required pattern');
    });
    
    it('should validate numeric types', () => {
      const intField = new Field({ type: 'integer' }, 'intField');
      const numField = new Field({ type: 'numeric' }, 'numField');
      
      expect(() => intField.validate(123)).not.toThrow();
      expect(() => intField.validate(123.45)).toThrow('must be an integer');
      
      expect(() => numField.validate(123.45)).not.toThrow();
      expect(() => numField.validate('abc')).toThrow('must be a number');
    });
  });

  // Test default value
  describe('default value', () => {
    it('should return the default value', () => {
      const field = new Field({ default: 'default value' }, 'testField');
      
      expect(field.getDefault()).toBe('default value');
    });
  });
}); 