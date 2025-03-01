/**
 * Unit tests for the base Model class
 */

import Model from '../../../server/lib/orm/Model.js';
import Field from '../../../server/lib/orm/Field.js';
import PasswordField from '../../../server/models/fields/PasswordField.js';
import BooleanField from '../../../server/models/fields/BooleanField.js';

// Create a test model class that extends Model
class TestModel extends Model {
  static get tableName() {
    return 'test_models';
  }

  static get fields() {
    return {
      id: new Field('id', { primary: true }),
      name: new Field('name', { nullable: false }),
      description: new Field('description')
    };
  }
}

describe('Model', () => {
  // Mocking console methods to reduce output noise
  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  // Test static properties and methods
  describe('static properties', () => {
    it('should have the correct table name', () => {
      expect(TestModel.tableName).toBe('test_models');
    });

    it('should have the correct fields', () => {
      const fields = TestModel.fields;
      
      expect(fields.id).toBeInstanceOf(Field);
      expect(fields.name).toBeInstanceOf(Field);
      expect(fields.description).toBeInstanceOf(Field);

      expect(fields.id.options.primary).toBe(true);
      expect(fields.name.options.nullable).toBe(false);
    });
  });

  // Test instance methods
  describe('instance methods', () => {
    it('should create a model instance with data', () => {
      const testData = {
        id: 1,
        name: 'Test Model',
        description: 'A test model instance'
      };
      
      const model = new TestModel(testData);
      
      expect(model.data).toEqual(testData);
    });

    it('should process field values with onSet when setting data', () => {
      // Create a field with a custom onSet method
      const customField = new Field('custom');
      customField.onSet = jest.fn(value => `processed_${value}`);
      
      // Replace the fields method temporarily for this test
      const originalFields = TestModel.fields;
      jest.spyOn(TestModel, 'fields', 'get').mockReturnValue({
        ...originalFields,
        custom: customField
      });
      
      // Create a model instance with data for the custom field
      const model = new TestModel({ custom: 'value' });
      
      // Check if onSet was called with the right value
      expect(customField.onSet).toHaveBeenCalledWith('value');
      
      // Restore the original fields method
      jest.restoreAllMocks();
    });
  });

  // Test _processOnSet and _processOnGet
  describe('_processOnSet and _processOnGet', () => {
    it('should transform data with _processOnSet', () => {
      // Create a custom field with a known transformation
      const customField = new Field('testField');
      customField.onSet = value => `transformed_${value}`;
      
      // Call _processOnSet directly
      const result = Model._processOnSet(customField, 'value');
      
      expect(result).toBe('transformed_value');
    });
    
    it('should transform data with _processOnGet', () => {
      // Create a custom field with a known transformation
      const customField = new Field('testField');
      customField.onGet = value => `retrieved_${value}`;
      
      // Call _processOnGet directly
      const result = Model._processOnGet(customField, 'value');
      
      expect(result).toBe('retrieved_value');
    });
  });

  // Test the create static method (without actually saving to the database)
  describe('create static method', () => {
    it('should create a new model instance', () => {
      // Mock the save method to avoid database operations
      jest.spyOn(TestModel.prototype, 'save').mockImplementation(function() {
        return Promise.resolve(this);
      });
      
      const testData = {
        name: 'Created Model',
        description: 'Created through the create method'
      };
      
      return TestModel.create(testData).then(model => {
        expect(model).toBeInstanceOf(TestModel);
        expect(model.data.name).toBe('Created Model');
        expect(model.save).toHaveBeenCalled();
        
        // Restore the mock
        TestModel.prototype.save.mockRestore();
      });
    });
  });
  
  // Test hooks
  describe('lifecycle hooks', () => {
    it('should call the onBeforeCreate hook when creating a model', () => {
      // Define a subclass with a hook
      class ModelWithHook extends TestModel {
        static async onBeforeCreate(data) {
          data.description = 'Modified by hook';
          return data;
        }
      }
      
      // Mock the save method to avoid database operations
      jest.spyOn(ModelWithHook.prototype, 'save').mockImplementation(function() {
        return Promise.resolve(this);
      });
      
      return ModelWithHook.create({ name: 'Model with Hook' }).then(model => {
        expect(model.data.description).toBe('Modified by hook');
        
        // Restore the mock
        ModelWithHook.prototype.save.mockRestore();
      });
    });
  });
}); 