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
    // Convert id to the right type
    if (typeof id === 'string' && !isNaN(parseInt(id))) {
      id = parseInt(id);
    }
    
    // Skip the primary key from updates
    const updateData = { ...data };
    delete updateData[this.primaryKey];

    // Get the existing record to run hooks
    const existingRecord = await this.findById(id);
    if (!existingRecord) {
      throw new Error(`Record with ${this.primaryKey} = ${id} not found for update`);
    }

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

      // Process the field through onSet transformation
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

    // Execute the query
    const result = await this.query(query, values);
    
    // Create a model instance with the result
    const updatedModel = new this(result[0]);
    
    // Run the onAfterUpdate hook if it exists
    if (typeof this.onAfterUpdate === 'function') {
      await this.onAfterUpdate(updatedModel);
    }
    
    return updatedModel;
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
    const schema = { ...this.defaultFields, ...(this.fields || this.schema) };
    const quotedTableName = this._quoteIdentifier(this.tableName);
    
    // First, ensure the schema_versions table exists
    try {
      const checkClient = await pool.connect();
      try {
        // Check if schema_versions table exists
        const versionTableExists = (await checkClient.query(
          `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'schema_versions')`,
          []
        )).rows[0].exists;
        
        if (!versionTableExists) {
          logger.schema('Creating schema_versions table');
          // Create schema_versions table if it doesn't exist
          await checkClient.query(`
            CREATE TABLE schema_versions (
              table_name VARCHAR(255) PRIMARY KEY,
              hash VARCHAR(64) NOT NULL,
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
          `);
          logger.schema('schema_versions table created successfully');
        }
      } finally {
        checkClient.release();
      }
    } catch (error) {
      logger.error('Error ensuring schema_versions table exists:', error);
      throw error;
    }
    
    // Now proceed with main schema synchronization
    const client = await pool.connect();
    let clientReleased = false;

    try {
      await client.query('BEGIN');

      // Calculate schema hash to detect changes
      const schemaHash = this._calculateSchemaHash(schema);
      
      // Check if we need to sync by comparing schema hash with stored hash
      const tableExists = (await client.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)`,
        [this.tableName]
      )).rows[0].exists;
      
      let needsSync = options.force || !tableExists;
      
      if (tableExists && !options.force) {
        // Check if there's a hash for this table
        const versionResult = await client.query(
          `SELECT hash FROM schema_versions WHERE table_name = $1`,
          [this.tableName]
        );
        
        if (versionResult.rows.length === 0) {
          // No record for this table, we should sync
          needsSync = true;
        } else {
          // Compare stored hash with current hash
          const storedHash = versionResult.rows[0].hash;
          needsSync = storedHash !== schemaHash;
        }
      }
      
      if (!needsSync) {
        await client.query('COMMIT');
        client.release();
        clientReleased = true;
        return;
      }

      // Add debugging log to see table name
      logger.schema(`Syncing schema for table: ${this.tableName}`);

      // Check if JSON type exists before proceeding
      const jsonTypeExists = (await client.query(
        `SELECT EXISTS (SELECT FROM pg_type WHERE typname = 'json')`,
        []
      )).rows[0].exists;

      logger.db(`JSON type exists in database: ${jsonTypeExists}`);

      if (!tableExists) {
        // Debug the CREATE TABLE statement
        const columns = Object.entries(schema).map(([name, def]) => {
          let columnDef;
          if (def.sql) {
            columnDef = `${this._quoteIdentifier(name)} ${def.sql}`;
          } else {
            // Use the newly improved _getColumnDefinition method
            columnDef = this._getColumnDefinition(name, def);
          }
          logger.schema(`Column definition for ${name}: ${columnDef}`);
          return columnDef;
        });
        const createTableSQL = `CREATE TABLE ${quotedTableName} (${columns.join(', ')})`;
        logger.schema(`CREATE TABLE SQL: ${createTableSQL}`);
        await client.query(createTableSQL);
      } else {
        const dbColumns = {};
        (await client.query(
          `SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
           FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public'`,
          [this.tableName]
        )).rows.forEach(row => dbColumns[row.column_name.toLowerCase()] = row);

        for (const [fieldName, fieldDef] of Object.entries(schema)) {
          const key = fieldName.toLowerCase();
          if (!dbColumns[key]) {
            if (this.renameMap?.[fieldName] && dbColumns[this.renameMap[fieldName].toLowerCase()]) {
              const oldKey = this.renameMap[fieldName].toLowerCase();
              await client.query(`ALTER TABLE ${quotedTableName} RENAME COLUMN ${this._quoteIdentifier(oldKey)} TO ${this._quoteIdentifier(fieldName)}`);
              dbColumns[key] = dbColumns[oldKey];
              delete dbColumns[oldKey];
              continue;
            }
            const defString = fieldDef.sql ? 
              `${fieldDef.sql}` : 
              this._getColumnDefinition(fieldName, fieldDef).replace(`${this._quoteIdentifier(fieldName)} `, '');
            
            logger.schema(`Adding column ${fieldName}, SQL: ALTER TABLE ${quotedTableName} ADD COLUMN ${this._quoteIdentifier(fieldName)} ${defString}`);
            await client.query(`ALTER TABLE ${quotedTableName} ADD COLUMN ${this._quoteIdentifier(fieldName)} ${defString}`);
            if (fieldDef.required && fieldDef.default === undefined) {
              const safeDefault = this._getSafeDefault(fieldDef);
              if (safeDefault !== null) {
                await client.query(`UPDATE ${quotedTableName} SET ${this._quoteIdentifier(fieldName)} = ${safeDefault} WHERE ${this._quoteIdentifier(fieldName)} IS NULL`);
              }
              await client.query(`ALTER TABLE ${quotedTableName} ALTER COLUMN ${this._quoteIdentifier(fieldName)} SET NOT NULL`);
            }
          } else if (!fieldDef.sql) {
            const dbCol = dbColumns[key];
            const desiredDef = this._parseFieldDefinition(fieldDef);
            
            // Debug field and desired definition
            //console.log(`Field ${fieldName} current: ${dbCol.data_type}(${dbCol.character_maximum_length}), desired: ${desiredDef.dataType}(${desiredDef.maxLength})`);
            
            if (
              desiredDef.dataType !== dbCol.data_type ||
              (desiredDef.maxLength && parseInt(dbCol.character_maximum_length, 10) !== desiredDef.maxLength)
            ) {
              let typeClause = desiredDef.dataType + (desiredDef.maxLength ? `(${desiredDef.maxLength})` : '');
              logger.schema(`Type change needed for ${fieldName}, type clause: ${typeClause}`);
              
              try {
                const usingClause = desiredDef.dataType === 'character varying' ? 
                  `${this._quoteIdentifier(fieldName)}::text` : 
                  `${this._quoteIdentifier(fieldName)}::${typeClause}`;
                
                const alterSQL = `ALTER TABLE ${quotedTableName} ALTER COLUMN ${this._quoteIdentifier(fieldName)} TYPE ${typeClause} USING ${usingClause}`;
                logger.db(`Executing SQL: ${alterSQL}`);
                await client.query(alterSQL);
              } catch (error) {
                logger.warn(`Error changing type of ${fieldName}, falling back to simpler approach: ${error.message}`);
                const safeDefault = this._getSafeDefault(fieldDef);
                const updateSQL = `UPDATE ${quotedTableName} SET ${this._quoteIdentifier(fieldName)} = ${safeDefault} WHERE ${this._quoteIdentifier(fieldName)} IS NOT NULL`;
                logger.db(`Executing SQL: ${updateSQL}`);
                await client.query(updateSQL);
                
                const alterSQL = `ALTER TABLE ${quotedTableName} ALTER COLUMN ${this._quoteIdentifier(fieldName)} TYPE ${typeClause}`;
                logger.db(`Executing SQL: ${alterSQL}`);
                await client.query(alterSQL);
              }
            }
            if (desiredDef.notNull && dbCol.is_nullable === 'YES') {
              await client.query(`ALTER TABLE ${quotedTableName} ALTER COLUMN ${this._quoteIdentifier(fieldName)} SET NOT NULL`);
            } else if (!desiredDef.notNull && dbCol.is_nullable === 'NO') {
              await client.query(`ALTER TABLE ${quotedTableName} ALTER COLUMN ${this._quoteIdentifier(fieldName)} DROP NOT NULL`);
            }
          }
        }

        if (options.dropExtraColumns) {
          const schemaKeys = Object.keys(schema).map(k => k.toLowerCase());
          for (const dbKey in dbColumns) {
            if (!schemaKeys.includes(dbKey)) {
              await client.query(`ALTER TABLE ${quotedTableName} DROP COLUMN ${this._quoteIdentifier(dbKey)}`);
            }
          }
        }
      }

      if (this.indexes) {
        const dbIndexes = {};
        (await client.query(
          `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = $1 AND schemaname = 'public'`,
          [this.tableName]
        )).rows.forEach(row => dbIndexes[row.indexname] = row.indexdef);

        const modelIndexNames = this.indexes.map(idx => this._getIndexName(idx));
        for (const indexName in dbIndexes) {
          if (indexName.toLowerCase() !== `${this.tableName.toLowerCase()}_pkey` && !modelIndexNames.includes(indexName)) {
            await client.query(`DROP INDEX ${this._quoteIdentifier(indexName)}`);
          }
        }
        for (const idx of this.indexes) {
          const name = this._getIndexName(idx);
          const existingDef = dbIndexes[name];
          if (!existingDef || this._indexNeedsRecreation(existingDef, idx)) {
            if (existingDef) await client.query(`DROP INDEX ${this._quoteIdentifier(name)}`);
            const unique = idx.unique ? 'UNIQUE' : '';
            await client.query(
              `CREATE ${unique} INDEX ${this._quoteIdentifier(name)} ON ${quotedTableName} (${idx.columns.map(col => this._quoteIdentifier(col)).join(', ')})`
            );
          }
        }
      }

      for (const [fieldName, fieldDef] of Object.entries(schema)) {
        if (fieldDef.uid) {
          await client.query(`COMMENT ON COLUMN ${quotedTableName}.${this._quoteIdentifier(fieldName)} IS 'uid: ${fieldDef.uid}'`);
        }
      }
      
      // Update schema version
      await client.query(`
        INSERT INTO schema_versions (table_name, hash, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (table_name) 
        DO UPDATE SET hash = $2, updated_at = NOW()
      `, [this.tableName, schemaHash]);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Schema sync error for table ${this.tableName}:`, error);
      if (error.message && error.message.includes('syntax error at or near "VARCHAR"')) {
        logger.error('VARCHAR syntax error details:', {
          table: this.tableName,
          errorDetail: error.detail,
          errorHint: error.hint,
          errorPosition: error.position
        });
      }
      throw error;
    } finally {
      if (!clientReleased) {
        client.release();
      }
    }
  }
  
  /**
   * Calculate a hash of the schema definition to detect changes
   * @param {Object} schema - The schema object
   * @returns {string} A hash string representing the schema
   */
  static _calculateSchemaHash(schema) {
    // Convert schema to a stable JSON string (sorted keys)
    const schemaStr = JSON.stringify(schema, (key, value) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return Object.keys(value).sort().reduce((result, key) => {
          result[key] = value[key];
          return result;
        }, {});
      }
      return value;
    });
    
    // Use a simple hash function
    let hash = 0;
    for (let i = 0; i < schemaStr.length; i++) {
      const char = schemaStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16).padStart(8, '0');
  }

  /* ==================== Utility Methods ==================== */

  static _quoteIdentifier(identifier) {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  static _getColumnDefinition(fieldName, fieldDef) {
    if (fieldDef.sql) return fieldDef.sql;
    
    // First get the quoted field name
    const quotedName = this._quoteIdentifier(fieldName);
    let sql = '';
    
    // Handle the type
    switch (fieldDef.type.toLowerCase()) {
      case 'string':
      case 'varchar': {
        // Parse length to ensure it's a valid number
        const length = parseInt(fieldDef.length, 10);
        const validLength = isNaN(length) || length <= 0 ? 255 : length;
        sql += `VARCHAR(${validLength})`;
        break;
      }
      case 'text':
        sql += `TEXT`;
        break;
      case 'integer':
      case 'int':
        sql += `INTEGER`;
        break;
      case 'bigint':
        sql += `BIGINT`;
        break;
      case 'boolean':
        sql += `BOOLEAN`;
        break;
      case 'date':
        sql += `DATE`;
        break;
      case 'timestamp':
        sql += `TIMESTAMP`;
        break;
      case 'numeric':
        sql += fieldDef.precision && fieldDef.scale ? `NUMERIC(${fieldDef.precision}, ${fieldDef.scale})` : `NUMERIC`;
        break;
      default:
        sql += fieldDef.type.toUpperCase();
    }
    
    // Add NOT NULL constraint if required
    if (fieldDef.required) sql += ' NOT NULL';
    
    // Add DEFAULT clause if specified
    if (fieldDef.default !== undefined) {
      if (typeof fieldDef.default === 'string' && 
          !/^'.*'$/.test(fieldDef.default) && 
          ['string', 'varchar', 'text'].includes(fieldDef.type.toLowerCase())) {
        // Properly quote string defaults
        sql += ` DEFAULT '${fieldDef.default.replace(/'/g, "''")}'`;
      } else {
        sql += ` DEFAULT ${fieldDef.default}`;
      }
    }
    
    return `${quotedName} ${sql}`;
  }

  static _parseFieldDefinition(fieldDef) {
    let dataType, maxLength = null;
    switch (fieldDef.type.toLowerCase()) {
      case 'string':
      case 'varchar':
        dataType = 'character varying';
        maxLength = parseInt(fieldDef.length, 10);
        // Ensure maxLength is a valid positive number
        if (isNaN(maxLength) || maxLength <= 0) maxLength = 255;
        break;
      case 'text':
        dataType = 'text';
        break;
      case 'integer':
      case 'int':
        dataType = 'integer';
        break;
      case 'bigint':
        dataType = 'bigint';
        break;
      case 'boolean':
        dataType = 'boolean';
        break;
      case 'date':
        dataType = 'date';
        break;
      case 'timestamp':
        dataType = 'timestamp without time zone';
        break;
      case 'numeric':
        dataType = 'numeric';
        maxLength = fieldDef.precision || null;
        break;
      default:
        dataType = fieldDef.type.toLowerCase();
    }
    return { dataType, maxLength, notNull: !!fieldDef.required, default: fieldDef.default };
  }

  static _getSafeDefault(fieldDef) {
    switch (fieldDef.type.toLowerCase()) {
      case 'string': case 'varchar': case 'text': return "''";
      case 'integer': case 'int': case 'bigint': return "0";
      case 'boolean': return "false";
      case 'date': return "CURRENT_DATE";
      case 'timestamp': return "CURRENT_TIMESTAMP";
      case 'numeric': return "0";
      default: return null;
    }
  }

  static _getIndexName(indexDef) {
    const prefix = `${this.tableName.toLowerCase()}_`;
    return indexDef.name.toLowerCase().startsWith(prefix) ? indexDef.name : `${this.tableName}_${indexDef.name}`;
  }

  static _indexNeedsRecreation(existingDef, idx) {
    const columns = existingDef.match(/\(([^)]+)\)/)?.[1].split(',').map(s => s.trim().replace(/"/g, '').toLowerCase()).sort().join(',') || '';
    const desiredColumns = idx.columns.map(col => col.toLowerCase()).sort().join(',');
    const dbUnique = existingDef.includes('UNIQUE');
    return columns !== desiredColumns || dbUnique !== !!idx.unique;
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