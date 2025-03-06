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
      id: new Field({ primary: true, type: 'integer' }, 'id'),
      name: new Field({ nullable: false, type: 'string' }, 'name'),
      description: new Field({ type: 'string' }, 'description')
    };
  }
}

describe('Model', () => {
  // Mocking console methods to reduce output noise
  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock the query method for testing
    jest.spyOn(Model, 'query').mockImplementation((query, params) => {
      return Promise.resolve([{ id: 1, name: 'Test', description: 'Test Description' }]);
    });
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
      const customField = new Field({ onSet: jest.fn(value => `processed_${value}`) }, 'custom');
      
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
    it('should transform data with _processOnSet', async () => {
      // Create a custom field with a known transformation
      const customField = new Field({ onSet: value => `transformed_${value}` }, 'testField');
      
      // Call _processOnSet directly
      const result = await Model._processOnSet(customField, 'value');
      
      expect(result).toBe('transformed_value');
    });
    
    it('should transform data with _processOnGet', () => {
      // Create a custom field with a known transformation
      const customField = new Field({ onGet: value => `retrieved_${value}` }, 'testField');
      
      // Call _processOnGet directly
      const result = Model._processOnGet(customField, 'value');
      
      expect(result).toBe('retrieved_value');
    });
  });

  // Test the create static method (without actually saving to the database)
  describe('create static method', () => {
    it('should create a new model instance', async () => {
      // Create a test instance
      const testData = {
        name: 'Created Model',
        description: 'Created through the create method'
      };
      
      // Mock the create method to return a model instance
      jest.spyOn(TestModel, 'query').mockResolvedValue([
        { id: 1, name: 'Created Model', description: 'Created through the create method' }
      ]);
      
      const model = await TestModel.create(testData);
      
      expect(model).toBeDefined();
      expect(model.data.name).toBe('Created Model');
      
      // Restore the mock
      jest.restoreAllMocks();
    });
  });
  
  // Test hooks
  describe('lifecycle hooks', () => {
    it('should call the onBeforeCreate hook when creating a model', async () => {
      // Define a subclass with a hook
      class ModelWithHook extends TestModel {
        static async onBeforeCreate(data) {
          data.description = 'Modified by hook';
          return data;
        }
      }
      
      // Mock the query method for this test
      jest.spyOn(ModelWithHook, 'query').mockResolvedValue([
        { id: 1, name: 'Model with Hook', description: 'Modified by hook' }
      ]);
      
      const model = await ModelWithHook.create({ name: 'Model with Hook' });
      
      expect(model.data.description).toBe('Modified by hook');
      
      // Restore the mock
      jest.restoreAllMocks();
    });
  });
}); 