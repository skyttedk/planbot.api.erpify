import pool from '../../config/db.js';

import { asyncLocalStorage } from '../../lib/orm/asyncContext.js';

import logger from '../../lib/logger.js';


export default class Model {
  static tableName = '';
  static primaryKey = 'id';

  // Hardcode default field definitions
  static defaultFields = {
    id: {
      uid: '{f6e2aabc-1e8f-4b19-8e3d-1a2b3c4d5e6f}', // Replace with your fixed GUID
      sql: 'INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY',
      required: true,
    },
    createdAt: {
      uid: '{a1b2c3d4-e5f6-7890-abcd-ef1234567890}', // Replace with your fixed GUID
      sql: 'TIMESTAMPTZ NOT NULL DEFAULT NOW()',
      required: true,
    },
    updatedAt: {
      uid: '{09876543-21fe-dcba-0987-654321fedcba}', // Replace with your fixed GUID
      sql: 'TIMESTAMPTZ NOT NULL DEFAULT NOW()',
      required: true,
    },
  };

  /**
   * Constructor for Model instances
   * @param {Object} data - The data to initialize the model with
   */
  constructor(data = {}) {
    this.data = data;
    
    // Instead of using a Proxy, copy properties from data to this for direct access
    // This preserves debuggability while allowing direct property access
    Object.keys(data).forEach(key => {
      // Skip if this property already exists on the instance
      if (!(key in this)) {
        // Define a property with getters and setters
        Object.defineProperty(this, key, {
          get() {
            return this.data[key];
          },
          set(value) {
            this.data[key] = value;
          },
          enumerable: true
        });
      }
    });
  }

  /**
   * Process the model's data by applying onSet transformations
   * @private
   */
  _processData() {
    if (!this.data) return;
    
    const fields = this.constructor.fields;
    if (!fields) return;
    
    // Note: This method can't be async because it's called from the constructor
    // For async onSet methods, the values will be processed when saved to database
    for (const [key, value] of Object.entries(this.data)) {
      // Apply onSet transformation when setting data initially
      if (fields[key] && typeof fields[key].onSet === 'function') {
        const result = fields[key].onSet(value);
        
        // For async transformations, we can't await here
        // The actual value will be processed when saved
        if (result instanceof Promise) {
          console.log(`Warning: Async onSet detected for field ${key}. Using original value until save.`);
        } else {
          // If synchronous, use the transformed value
          this.data[key] = result;
        }
      }
    }
  }

  /**
   * Process a database row by applying field transformations
   * @param {Object} row - The database row to process
   * @returns {Object} The model instance with processed data
   * @private
   */
  static _processOnGet(row, value) {
    // If a field and value are provided directly, process a single value
    if (arguments.length === 2 && typeof row.onGet === 'function') {
      return row.onGet(value);
    }
    
    // Otherwise process an entire row
    if (!row) return null;
    
    const fields = this.fields || {};
    const processedData = { ...row };
    
    // Apply onGet transformations for each field
    for (const [key, value] of Object.entries(row)) {
      if (fields[key] && typeof fields[key].onGet === 'function') {
        processedData[key] = fields[key].onGet(value);
      }
    }
    
    // Return a new instance of the model with the processed data
    return new this(processedData);
  }

  /**
   * Returns the merged schema of the model, combining parent fields with the current class's fields.
   * @returns {Object} The merged schema.
   */
  static getSchema() {
    if (this === Model) {
      return this.defaultFields;
    }
    const parentSchema =
      typeof Object.getPrototypeOf(this).getSchema === 'function'
        ? Object.getPrototypeOf(this).getSchema()
        : {};
    return { ...parentSchema, ...(this.fields || {}) };
  }

  /* ==================== Public CRUD Methods ==================== */

  /**
   * Retrieves multiple records based on the provided options.
   * @param {Object} [options={}] - Query options.
   * @param {Object} [options.where] - Conditions for filtering records.
   * @param {number} [options.limit] - Maximum number of records to return.
   * @param {number} [options.offset] - Number of records to skip.
   * @param {string} [options.orderBy] - Column to order results by.
   * @returns {Promise<Object[]>} Array of records.
   */
  static async find(options = {}) {
    // Ensure options is an object, not null
    options = options || {};
    
    const { where = {}, limit, offset, orderBy } = options;
    const { whereClause, values } = this.buildWhere(where);
    let query = `SELECT * FROM ${this._quoteIdentifier(this.tableName)} ${whereClause}`;
    if (orderBy) {
      const { column, direction = 'ASC' } = orderBy;
      query += ` ORDER BY ${this._quoteIdentifier(column)} ${direction.toUpperCase()}`;
    }
    if (limit) query += ` LIMIT ${limit}`;
    if (offset) query += ` OFFSET ${offset}`;
    const rows = await this.query(query, values);
    return rows.map(row => this._processOnGet(row));
  }

  /**
   * Retrieves a single record by its primary key.
   * @param {string|number} id - The primary key value.
   * @returns {Promise<Object|null>} The record or null if not found.
   */
  static async findById(id) {
    const query = `SELECT * FROM ${this._quoteIdentifier(this.tableName)} WHERE ${this._quoteIdentifier(this.primaryKey)} = $1`;
    const rows = await this.query(query, [id]);
    
    return rows.length > 0 ? this._processOnGet(rows[0]) : null;
  }

  /**
   * Retrieves the first record matching the options.
   * @param {Object} [options={}] - Query options including `where`.
   * @returns {Promise<Object|null>} The first record or null if none found.
   */
  static async findOne(options = {}) {
    const results = await this.find({ ...options, limit: 1 });
    
    return results[0] || null;
  }

  /**
   * Alias for find. Retrieves all records matching the options.
   * @param {Object} [options={}] - Query options including `where`, `orderBy`, `limit`, and `offset`.
   * @returns {Promise<Array>} Array of matching records.
   */
  static async findAll(options = {}) {
    return this.find(options);
  }

  /**
   * Retrieves the last record matching the options.
   * @param {Object} [options={}] - Query options including `where` and `orderBy`.
   * @returns {Promise<Object|null>} The last record or null.
   */
  static async findLast(options = {}) {
    // Ensure options is an object, not null
    options = options || {};
    
    // Use descending order by ID to get the last record
    const { where = {}, ...otherOptions } = options;
    const lastOptions = {
      where,
      orderBy: { column: this.primaryKey, direction: 'DESC' },
      limit: 1,
      ...otherOptions
    };
    
    const results = await this.find(lastOptions);
    return results[0] || null;
  }

  /**
   * Finds the next record after the one with the specified ID.
   * If no next record exists, returns the last record in the table.
   * 
   * @param {string|number} id - The reference ID to find the next record from.
   * @param {Object} [options={}] - Additional query options.
   * @param {Object} [options.where] - Additional conditions for filtering records.
   * @returns {Promise<Object|null>} The next record or the last record if no next exists, or null if table is empty.
   */
  static async findNext(id, options = {}) {
    // Ensure options is an object, not null
    options = options || {};
    
    // Find the next record with ID > current ID
    const { where = {}, ...otherOptions } = options;
    const nextOptions = {
      where: {
        ...where,
        [this.primaryKey]: { operator: '>', value: id }
      },
      orderBy: { column: this.primaryKey, direction: 'ASC' },
      limit: 1,
      ...otherOptions
    };
    
    const nextRecord = await this.find(nextOptions);
    
    // If we found a next record, return it
    if (nextRecord.length > 0) {
      return nextRecord[0];
    }
    
    // Otherwise, return the last record (which might be the current one if it's the last)
    return this.findLast(options);
  }

  /**
   * Finds the previous record before the one with the specified ID.
   * If no previous record exists, returns the first record in the table.
   * 
   * @param {string|number} id - The reference ID to find the previous record from.
   * @param {Object} [options={}] - Additional query options.
   * @param {Object} [options.where] - Additional conditions for filtering records.
   * @returns {Promise<Object|null>} The previous record or the first record if no previous exists, or null if table is empty.
   */
  static async findPrevious(id, options = {}) {
    // Ensure options is an object, not null
    options = options || {};
    
    // Find the previous record with ID < current ID
    const { where = {}, ...otherOptions } = options;
    const prevOptions = {
      where: {
        ...where,
        [this.primaryKey]: { operator: '<', value: id }
      },
      orderBy: { column: this.primaryKey, direction: 'DESC' },
      limit: 1,
      ...otherOptions
    };
    
    const prevRecord = await this.find(prevOptions);
    
    // If we found a previous record, return it
    if (prevRecord.length > 0) {
      return prevRecord[0];
    }
    
    // Otherwise, return the first record (which might be the current one if it's the first)
    return this.findFirst(options);
  }

  /**
   * Counts records matching the options.
   * @param {Object} [options={}] - Query options with `where`.
   * @returns {Promise<number>} The number of matching records.
   */
  static async count(options = {}) {
    const { where = {} } = options;
    const { whereClause, values } = this.buildWhere(where);
    const query = `SELECT COUNT(*) FROM ${this._quoteIdentifier(this.tableName)} ${whereClause}`;
    const result = await this.query(query, values);
    return parseInt(result[0].count, 10);
  }

  /**
   * Creates a new record.
   * @param {Object} data - The record data.
   * @returns {Promise<Object>} The created record.
   */
  static async create(data) {
    // Run the onBeforeCreate hook if it exists
    if (typeof this.onBeforeCreate === 'function') {2222
      data = await this.onBeforeCreate(data);
    }

    // Process the data through onSet transformations
    const processedData = {};
    const fields = this.fields || {};
    
    // Process all fields asynchronously if needed
    for (const [key, value] of Object.entries(data)) {
      if (fields[key] && typeof fields[key].onSet === 'function') {
        try {
          // Handle async onSet methods
          processedData[key] = await fields[key].onSet(value);
        } catch (error) {
          console.error(`Error processing field ${key}:`, error);
          throw error;
        }
      } else {
        processedData[key] = value;
      }
    }
    
    // Build the SQL query
    const columns = Object.keys(processedData).map(key => this._quoteIdentifier(key)).join(', ');
    const placeholders = Object.keys(processedData).map((_, i) => `$${i + 1}`).join(', ');
    const values = Object.values(processedData);
    
    const query = `INSERT INTO ${this._quoteIdentifier(this.tableName)} (${columns}) 
                  VALUES (${placeholders}) 
                  RETURNING *`;
    
    // Execute the query
    const result = await this.query(query, values);
    
    // Create a model instance with the result
    const model = new this(result[0]);
    
    // Run the onAfterCreate hook if it exists
    if (typeof this.onAfterCreate === 'function') {
      await this.onAfterCreate(model);
    }
    
    return model;
  }

  /**
   * Updates a single record by its primary key.
   * @param {string|number} id - The primary key value.
   * @param {Object} data - The fields to update.
   * @returns {Promise<Object>} The updated record.
   */
  static async update(id, data) {
    console.log(`[Model:${this.tableName}] Update request received for ID:`, id, 'with data:', JSON.stringify(data));
    
    try {
      // Convert id to the right type
      if (typeof id === 'string' && !isNaN(parseInt(id))) {
        id = parseInt(id);
        console.log(`[Model:${this.tableName}] Converted string ID to number:`, id);
      }
      
      // Skip the primary key from updates
      const updateData = { ...data };
      delete updateData[this.primaryKey];
      console.log(`[Model:${this.tableName}] UpdateData after removing primary key:`, JSON.stringify(updateData));
  
      // Get the existing record to run hooks
      const existingRecord = await this.findById(id);
      if (!existingRecord) {
        console.error(`[Model:${this.tableName}] Record with ${this.primaryKey} = ${id} not found for update`);
        throw new Error(`Record with ${this.primaryKey} = ${id} not found for update`);
      }
      console.log(`[Model:${this.tableName}] Found existing record:`, JSON.stringify(existingRecord.data));
  
      // Run the onBeforeUpdate hook if it exists
      if (typeof this.onBeforeUpdate === 'function') {
        await this.onBeforeUpdate(existingRecord);
      }
  
      // Process fields with validation
      const processedData = {};
      const fields = this.fields || {};
      const schema = this.getSchema();
  
      for (const [key, value] of Object.entries(updateData)) {
        // Skip the primary key from updates
        if (key === this.primaryKey) continue;
  
        console.log(`Processing field ${key} with value: ${JSON.stringify(value)}`);
  
        // Process the field through onSet transformation
        if (fields[key] && typeof fields[key].onSet === 'function') {
          try {
            // Handle async onSet methods
            processedData[key] = await fields[key].onSet(value);
            console.log(`After onSet, field ${key} value: ${JSON.stringify(processedData[key])}`);
          } catch (error) {
            console.error(`Error processing field ${key}:`, error);
            throw error;
          }
        } else {
          processedData[key] = value;
        }
  
        // Validate against the schema
        if (schema[key] && typeof schema[key].validate === 'function') {
          try {
            schema[key].validate(processedData[key]);
          } catch (error) {
            throw new Error(`Validation failed for field '${key}' in table '${this.tableName}': ${error.message}`);
          }
        }
      }
  
      // Add updatedAt timestamp
      if (fields.updatedAt) {
        processedData.updatedAt = new Date();
      }
  
      // Build the SQL query
      if (Object.keys(processedData).length === 0) {
        console.log('No valid fields to update.');
        return existingRecord;
      }
  
      const setClause = Object.keys(processedData)
        .map((key, i) => `${this._quoteIdentifier(key)} = $${i + 1}`)
        .join(', ');
      const values = Object.values(processedData);
      values.push(id); // Add the ID for the WHERE clause
  
      const query = `UPDATE ${this._quoteIdentifier(this.tableName)} 
                    SET ${setClause} 
                    WHERE ${this._quoteIdentifier(this.primaryKey)} = $${values.length} 
                    RETURNING *`;
  
      console.log(`[Model:${this.tableName}] Executing update query:`, query, 'with values:', values);
      
      // Execute the query
      const result = await this.query(query, values);
      
      // Create a model instance with the result
      const updatedModel = new this(result[0]);
      
      // Run the onAfterUpdate hook if it exists
      if (typeof this.onAfterUpdate === 'function') {
        await this.onAfterUpdate(updatedModel);
      }
      
      return updatedModel;
    } catch (error) {
      // Check for unique constraint violations
      if (error.message && error.message.includes('duplicate key') && error.message.includes('unique constraint')) {
        // Extract the constraint name if available
        const constraintMatch = error.message.match(/unique constraint "([^"]+)"/);
        const constraintName = constraintMatch ? constraintMatch[1] : 'unknown';
        
        // Create a more specific error message
        const enhancedError = new Error(
          `Duplicate value detected for unique constraint '${constraintName}' in table '${this.tableName}'. ` +
          `The value you provided already exists in another record.`
        );
        
        console.error(`[Model:${this.tableName}] ${enhancedError.message}`, error);
        throw enhancedError;
      }
      
      // Re-throw other errors
      console.error(`[Model:${this.tableName}] Update error:`, error);
      throw error;
    }
  }

  /**
   * Updates multiple records based on conditions.
   * @param {Object} options - Options with where and data.
   * @param {Object} options.where - Conditions to identify records.
   * @param {Object} options.data - Fields to update.
   * @returns {Promise<Object[]>} Array of updated records.
   */
  static async updateBatch({ where, data } = {}) {
    if (!where || !Object.keys(where).length) throw new Error("A 'where' condition is required for updateBatch.");
    if (!data || !Object.keys(data).length) throw new Error("No data provided for updateBatch.");
    const schema = this.getSchema();
    for (const [key, value] of Object.entries(data)) {
      if (schema[key]?.validate) {
        try {
          schema[key].validate(value);
        } catch (error) {
          throw new Error(`Validation failed for field '${key}' in table '${this.tableName}': ${error.message}`);
        }
      }
    }
    if (this.onBeforeUpdate) data = await this.onBeforeUpdate(data);
    const processedData = this._processOnSet(data, schema);
    const { whereClause, values: whereValues } = this.buildWhere(where);
    const updateKeys = Object.keys(processedData);
    const setClause = updateKeys.map((k, i) => `${this._quoteIdentifier(k)} = $${i + 1}`).join(', ');
    const adjustedWhereClause = whereClause.replace(/\$\d+/g, match => `$${parseInt(match.slice(1)) + updateKeys.length}`);
    const query = `UPDATE ${this._quoteIdentifier(this.tableName)} SET ${setClause} ${adjustedWhereClause} RETURNING *`;
    const result = await this.query(query, [...Object.values(processedData), ...whereValues]);
    const updatedRecords = result.map(row => this._processOnGet(row));
    if (this.onAfterUpdate) for (const record of updatedRecords) await this.onAfterUpdate(record);
    return updatedRecords;
  }

  /**
   * Deletes a single record by its primary key.
   * @param {string|number} id - The primary key value.
   * @returns {Promise<Object[]>} Array of deleted records (typically one).
   */
  static async delete(id) {
    if (this.onBeforeDelete) await this.onBeforeDelete(id);
    const query = `DELETE FROM ${this._quoteIdentifier(this.tableName)} WHERE ${this._quoteIdentifier(this.primaryKey)} = $1 RETURNING *`;
    const result = await this.query(query, [id]);
    if (this.onAfterDelete) await this.onAfterDelete(result);
    return result;
  }

  /**
   * Deletes multiple records based on conditions.
   * @param {Object} options - Options with where condition.
   * @param {Object} options.where - Conditions to identify records.
   * @returns {Promise<Object[]>} Array of deleted records.
   */
  static async deleteBatch({ where } = {}) {
    if (!where || !Object.keys(where).length) throw new Error("A 'where' condition is required for deleteBatch.");
    const { whereClause, values } = this.buildWhere(where);
    if (this.onBeforeDelete) {
      const idQuery = `SELECT ${this._quoteIdentifier(this.primaryKey)} FROM ${this._quoteIdentifier(this.tableName)} ${whereClause}`;
      const ids = (await this.query(idQuery, values)).map(row => row[this.primaryKey]);
      for (const id of ids) await this.onBeforeDelete(id);
    }
    const query = `DELETE FROM ${this._quoteIdentifier(this.tableName)} ${whereClause} RETURNING *`;
    const result = await this.query(query, values);
    if (this.onAfterDelete) await this.onAfterDelete(result);
    return result.map(row => this._processOnGet(row));
  }

  /**
   * Creates multiple records in a single query.
   * @param {Object[]} dataArray - Array of data objects to insert.
   * @returns {Promise<Object[]>} Array of created records.
   */
  static async createBatch(dataArray) {
    if (!Array.isArray(dataArray) || !dataArray.length) throw new Error(`dataArray must be a non-empty array for batch create in table '${this.tableName}'`);
    const schema = this.getSchema();
    const baseKeys = Object.keys(dataArray[0]).sort();
    for (const data of dataArray) {
      if (Object.keys(data).sort().join(',') !== baseKeys.join(',')) {
        throw new Error(`All objects in dataArray must have the same keys for batch create in table '${this.tableName}'`);
      }
      for (const [key, value] of Object.entries(data)) {
        if (schema[key]?.validate) {
          try {
            schema[key].validate(value);
          } catch (error) {
            throw new Error(`Validation failed for field '${key}' in table '${this.tableName}': ${error.message}`);
          }
        }
      }
    }
    const processedArray = dataArray.map(data => this._processOnSet(data, schema));
    const keys = baseKeys;
    let values = [];
    const rowsPlaceholders = processedArray.map((data, rowIndex) => {
      const placeholders = keys.map((_, colIndex) => {
        values.push(data[keys[colIndex]]);
        return `$${rowIndex * keys.length + colIndex + 1}`;
      });
      return `(${placeholders.join(', ')})`;
    });
    const query = `
      INSERT INTO ${this._quoteIdentifier(this.tableName)} (${keys.map(k => this._quoteIdentifier(k)).join(', ')})
      VALUES ${rowsPlaceholders.join(', ')}
      RETURNING *
    `;
    const result = await this.query(query, values);
    return result.map(row => this._processOnGet(row));
  }

  /**
   * Alias for findOne.
   * @param {Object} [options={}] - Query options.
   * @returns {Promise<Object|null>} The first record or null.
   */
  static async findFirst(options = {}) {
    // Ensure options is an object, not null
    options = options || {};
    
    // Ensure we always order by ID in ascending order by default
    const orderBy = options.orderBy || { column: this.primaryKey, direction: 'ASC' };
    return this.findOne({ ...options, orderBy });
  }

  /* ==================== Query Helpers ==================== */

  /**
   * Builds a WHERE clause from conditions.
   * @param {Object} [where={}] - Filtering conditions.
   * @returns {{ whereClause: string, values: any[] }} WHERE clause and parameter values.
   */
  static buildWhere(where = {}) {
    const keys = Object.keys(where);
    if (!keys.length) return { whereClause: '', values: [] };
    const clauses = [];
    const values = [];
    keys.forEach(key => {
      const condition = where[key];
      const quotedKey = this._quoteIdentifier(key);
      if (condition && typeof condition === 'object' && 'operator' in condition && 'value' in condition) {
        clauses.push(`${quotedKey} ${condition.operator} $${values.length + 1}`);
        values.push(condition.value);
      } else {
        clauses.push(`${quotedKey} = $${values.length + 1}`);
        values.push(condition);
      }
    });
    return { whereClause: `WHERE ${clauses.join(' AND ')}`, values };
  }

  /**
   * Executes a database query.
   * @param {string} text - SQL query text.
   * @param {any[]} params - Query parameters.
   * @returns {Promise<Object[]>} Query results.
   */
  static async query(text, params) {
    let client;
    let releaseClient = false;
    const store = asyncLocalStorage.getStore();

    if (store?.client) {
      client = store.client; // Use client from request context
    } else {
      client = await pool.connect(); // Fallback for non-request contexts
      releaseClient = true;
    }

    const tableName = this.tableName || 'unknown_table';
    try {
      const result = await client.query(text, params);
      return result.rows;
    } catch (error) {
      const enhancedError = new Error(
        `Database error in table '${tableName}': ${error.message}\nQuery: ${text}\nParameters: ${JSON.stringify(params)}`
      );
      if (error.column) enhancedError.field = error.column;
      else if (error.detail?.match(/column "([^"]+)"/i)) enhancedError.field = error.detail.match(/column "([^"]+)"/i)[1];
      enhancedError.originalError = error;
      logger.error('Database query error:', { tableName, text, params, error });
      throw enhancedError;
    } finally {
      if (releaseClient) client.release();
    }
  }

  /* ==================== Schema Synchronization ==================== */

  /**
   * Synchronizes the database schema with the model definition.
   * @param {Object} [options={dropExtraColumns: false}] - Sync options.
   * @returns {Promise<void>}
   */
  static async syncSchema(options = { dropExtraColumns: false, force: false }) {
    // Import SchemaManager dynamically to avoid circular dependencies
    const { default: SchemaManager } = await import('./SchemaManager.js');
    
    // Create a schema manager for this model and run sync
    const schemaManager = new SchemaManager(this);
    return schemaManager.syncSchema(options);
  }

  /* ==================== Utility Methods ==================== */

  static _quoteIdentifier(identifier) {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  // Methods used only for backward compatibility
  // These are now properly implemented in SchemaManager
  
  static _quoteIdentifier(identifier) {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  /**
   * Process a field value through its onSet transformation
   * @param {Object} field - The field definition
   * @param {*} value - The value to process
   * @returns {*} The processed value
   * @private
   */
  static async _processOnSet(field, value) {
    if (field && typeof field.onSet === 'function') {
      try {
        // Handle async onSet methods properly
        return await field.onSet(value);
      } catch (error) {
        console.error('Error in _processOnSet:', error);
        throw error;
      }
    }
    return value;
  }

  /**
   * Save method for instances - Add record if new, update if exists
   * @returns {Promise<this>} Returns this instance after save operation
   */
  async save() {
    if (this.data && this.data[this.constructor.primaryKey]) {
      // Update existing record
      await this.constructor.update(this.data[this.constructor.primaryKey], this.data);
    } else {
      // Create new record
      const result = await this.constructor.create(this.data);
      if (result) {
        this.data = result.data || result; // Update with returned data
      }
    }
    return this;
  }

  /**
   * Delete the current model instance from the database
   * @returns {Promise<boolean>} True if successful
   */
  async delete() {
    if (!this.data || !this.data[this.constructor.primaryKey]) {
      throw new Error('Cannot delete a model that has not been saved');
    }
    
    await this.constructor.delete(this.data[this.constructor.primaryKey]);
    return true;
  }
}