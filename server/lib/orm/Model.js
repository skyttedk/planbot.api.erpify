import pool from '../../config/db.js';

import { asyncLocalStorage } from '../../lib/orm/asyncContext.js';


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
    const { where = {}, orderBy = { column: 'id', direction: 'DESC' }, ...otherOptions } = options;
    const results = await this.find({ where, orderBy, limit: 1, ...otherOptions });
    return results[0] || null;
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
   * @param {Object} data - Data to insert.
   * @returns {Promise<Object>} The created record.
   */
  static async create(data) {
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
    if (this.onBeforeCreate) data = await this.onBeforeCreate(data);
    const processedData = this._processOnSet(data, schema);
    const keys = Object.keys(processedData);
    const query = `
      INSERT INTO ${this._quoteIdentifier(this.tableName)} (${keys.map(k => this._quoteIdentifier(k)).join(', ')})
      VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')})
      RETURNING *
    `;
    const result = await this.query(query, Object.values(processedData));
    if (this.onAfterCreate) await this.onAfterCreate(result[0]);
    return this._processOnGet(result[0]);
  }

  /**
   * Updates a single record by its primary key.
   * @param {string|number} id - The primary key value.
   * @param {Object} data - Fields to update.
   * @returns {Promise<Object|null>} The updated record or null if not found.
   */
  static async update(id, data) {
    const schema = this.getSchema();
    
    // Validate the input data
    for (const [key, value] of Object.entries(data)) {
      if (schema[key]?.validate) {
        try {
          schema[key].validate(value);
        } catch (error) {
          throw new Error(`Validation failed for field '${key}' in table '${this.tableName}': ${error.message}`);
        }
      }
    }
    
    // First retrieve the current complete record
    const currentRecord = await this.findById(id);
    if (!currentRecord) {
      throw new Error(`Record with id ${id} not found in table '${this.tableName}'`);
    }
    
    // Merge the update data with the current record to get a complete record
    const completeData = { ...currentRecord, ...data };
    
    // Save a copy of the original merged data to compare after the trigger
    const beforeTriggerData = { ...completeData };
    
    // Call onBeforeUpdate with the complete record
    let processedData = completeData;
    if (this.onBeforeUpdate) {
      processedData = await this.onBeforeUpdate(completeData);
    }
    
    // Determine which fields were actually changed, either by the original update
    // or by the onBeforeUpdate trigger
    const fieldsToUpdate = {};
    
    // Include all original fields from the update
    for (const key of Object.keys(data)) {
      fieldsToUpdate[key] = processedData[key];
    }
    
    // Also include any fields modified by the onBeforeUpdate trigger
    for (const key of Object.keys(processedData)) {
      // Skip the primary key
      if (key === this.primaryKey) continue;
      
      // If this field wasn't in the original update data but was changed by the trigger,
      // include it in the update
      if (!data.hasOwnProperty(key) && 
          JSON.stringify(beforeTriggerData[key]) !== JSON.stringify(processedData[key])) {
        fieldsToUpdate[key] = processedData[key];
      }
    }
    
    // Process the final data for database update
    const finalData = this._processOnSet(fieldsToUpdate, schema);
    const updateKeys = Object.keys(finalData).filter(k => k !== this.primaryKey);
    
    if (updateKeys.length === 0) {
      throw new Error(`No data provided for update in table '${this.tableName}'`);
    }
    
    const query = `
      UPDATE ${this._quoteIdentifier(this.tableName)}
      SET ${updateKeys.map((k, i) => `${this._quoteIdentifier(k)} = $${i + 1}`).join(', ')}
      WHERE ${this._quoteIdentifier(this.primaryKey)} = $${updateKeys.length + 1}
      RETURNING *
    `;
    
    const values = [...updateKeys.map(k => finalData[k]), id];
    const result = await this.query(query, values);
    
    if (result.length === 0) return null;
    
    if (this.onAfterUpdate) await this.onAfterUpdate(result[0]);
    
    return this._processOnGet(result[0]);
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
      console.error('Database query error:', { tableName, text, params, error });
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
  static async syncSchema(options = { dropExtraColumns: false }) {
    const schema = { ...this.defaultFields, ...(this.fields || this.schema) };
    const quotedTableName = this._quoteIdentifier(this.tableName);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Add debugging log to see table name
      console.log(`Syncing schema for table: ${this.tableName}`);

      const tableExists = (await client.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)`,
        [this.tableName]
      )).rows[0].exists;

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
          console.log(`Column definition for ${name}: ${columnDef}`);
          return columnDef;
        });
        const createTableSQL = `CREATE TABLE ${quotedTableName} (${columns.join(', ')})`;
        console.log(`CREATE TABLE SQL: ${createTableSQL}`);
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
            
            console.log(`Adding column ${fieldName}, SQL: ALTER TABLE ${quotedTableName} ADD COLUMN ${this._quoteIdentifier(fieldName)} ${defString}`);
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
            console.log(`Field ${fieldName} current: ${dbCol.data_type}(${dbCol.character_maximum_length}), desired: ${desiredDef.dataType}(${desiredDef.maxLength})`);
            
            if (
              desiredDef.dataType !== dbCol.data_type ||
              (desiredDef.maxLength && parseInt(dbCol.character_maximum_length, 10) !== desiredDef.maxLength)
            ) {
              let typeClause = desiredDef.dataType + (desiredDef.maxLength ? `(${desiredDef.maxLength})` : '');
              console.log(`Type change needed for ${fieldName}, type clause: ${typeClause}`);
              
              try {
                const usingClause = desiredDef.dataType === 'character varying' ? 
                  `${this._quoteIdentifier(fieldName)}::text` : 
                  `${this._quoteIdentifier(fieldName)}::${typeClause}`;
                
                const alterSQL = `ALTER TABLE ${quotedTableName} ALTER COLUMN ${this._quoteIdentifier(fieldName)} TYPE ${typeClause} USING ${usingClause}`;
                console.log(`Executing SQL: ${alterSQL}`);
                await client.query(alterSQL);
              } catch (error) {
                console.log(`Error changing type of ${fieldName}, falling back to simpler approach: ${error.message}`);
                const safeDefault = this._getSafeDefault(fieldDef);
                const updateSQL = `UPDATE ${quotedTableName} SET ${this._quoteIdentifier(fieldName)} = ${safeDefault} WHERE ${this._quoteIdentifier(fieldName)} IS NOT NULL`;
                console.log(`Executing SQL: ${updateSQL}`);
                await client.query(updateSQL);
                
                const alterSQL = `ALTER TABLE ${quotedTableName} ALTER COLUMN ${this._quoteIdentifier(fieldName)} TYPE ${typeClause}`;
                console.log(`Executing SQL: ${alterSQL}`);
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

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`Schema sync error for table ${this.tableName}:`, error);
      if (error.message && error.message.includes('syntax error at or near "VARCHAR"')) {
        console.error('VARCHAR syntax error details:', {
          table: this.tableName,
          errorDetail: error.detail,
          errorHint: error.hint,
          errorPosition: error.position
        });
      }
      throw error;
    } finally {
      client.release();
    }
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

  static _processOnSet(data, schema) {
    const processed = {};
    for (const key in data) {
      processed[key] = schema[key]?.onSet ? schema[key].onSet(data[key]) : data[key];
    }
    return processed;
  }

  static _processOnGet(row) {
    const schema = this.getSchema();
    const processed = { ...row };
    for (const key in processed) {
      if (schema[key]?.onGet) processed[key] = schema[key].onGet(processed[key]);
    }
    return processed;
  }
}