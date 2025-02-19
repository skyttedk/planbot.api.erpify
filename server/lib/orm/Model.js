import pool from '../../config/db.js';

/**
 * Base Model class for ORM operations with automatic schema synchronization.
 *
 * Each subclass should define:
 * - **static tableName**: The name of the database table this model represents.
 * - **static fields (preferred) OR static schema**: An object describing the fields of the table.
 *   - **Fields**: Each field is an object specifying its properties.
 *   - Example:
 *     ```javascript
 *     static fields = {
 *       name: {
 *         type: 'string',              // Data type (e.g., 'string', 'integer', 'boolean', 'date')
 *         required: true,              // Whether the field is mandatory
 *         default: 'Unknown',          // Default value if not provided
 *         length: 100,                 // Optional length for VARCHAR (defaults to 255)
 *         validate: (value) => {       // Optional validation function
 *           if (typeof value !== 'string') throw new Error('Name must be a string');
 *         },
 *         onSet: (value) => value.trim(), // Optional transformation before saving
 *         onGet: (value) => value.toUpperCase() // Optional transformation after retrieval
 *       },
 *       age: {
 *         type: 'integer',
 *         required: false,
 *         default: 0
 *       }
 *     };
 *     ```
 *   - Supported properties:
 *     - `type`: The SQL data type (e.g., 'string', 'integer', 'boolean', 'date', 'timestamp', 'numeric').
 *     - `required`: Boolean indicating if the field must be non-null.
 *     - `default`: Default value if none is provided.
 *     - `length`: For 'string' types, specifies VARCHAR length (defaults to 255).
 *     - `precision` and `scale`: For 'numeric' types, defines precision and scale.
 *     - `validate`: Function to validate the field value; throws an error on failure.
 *     - `onSet`: Function to transform the value before insertion/update.
 *     - `onGet`: Function to transform the value after retrieval.
 *
 * - **(Optional) static renameMap**: An object mapping new field names to old names for schema evolution.
 *   - Example:
 *     ```javascript
 *     static renameMap = { newFieldName: 'oldFieldName' };
 *     ```
 *
 * - **(Optional) static indexes**: An array of index definitions to optimize queries.
 *   - Each index is an object with:
 *     - `name`: The index name (prefixed with table name if not already).
 *     - `columns`: Array of column names to index.
 *     - `unique`: Boolean indicating if the index enforces uniqueness.
 *   - Example:
 *     ```javascript
 *     static indexes = [
 *       { name: 'idx_name', columns: ['name'], unique: false },
 *       { name: 'idx_age_unique', columns: ['age'], unique: true }
 *     ];
 *     ```
 *
 * **Default Fields**: This base `Model` automatically includes:
 *   - `id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY`
 *   - `createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()`
 *   - `updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()`
 *
 * **Model-Level Trigger Hooks**: Subclasses can define these optional hooks:
 *   - `onBeforeCreate(data)`: Modify data before insertion; returns modified data.
 *   - `onAfterCreate(record)`: Perform actions after insertion.
 *   - `onBeforeUpdate(data)`: Modify data before update; returns modified data.
 *   - `onAfterUpdate(record)`: Perform actions after update.
 *   - `onBeforeDelete(id)`: Perform actions before deletion.
 *   - `onAfterDelete(result)`: Perform actions after deletion.
 *   - Hooks can be asynchronous.
 *
 * **Schema Synchronization**: The `syncSchema` method aligns the database table with the defined schema, adding columns, renaming fields (via `renameMap`), and managing indexes.
 */
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

  static async find(conditions = {}, options = {}, client = null) {
    const { whereClause, values } = this.buildWhere(conditions);
    const { limit, offset, orderBy } = options;
    let query = `SELECT * FROM ${this._quoteIdentifier(this.tableName)} ${whereClause}`;
    if (orderBy) query += ` ORDER BY ${this._quoteIdentifier(orderBy)}`;
    if (limit) query += ` LIMIT ${limit}`;
    if (offset) query += ` OFFSET ${offset}`;
    const rows = await this.query(query, values, client);
    return rows.map(row => this._processOnGet(row));
  }

  static async findById(id, client = null) {
    const query = `SELECT * FROM ${this._quoteIdentifier(this.tableName)} WHERE ${this._quoteIdentifier(this.primaryKey)} = $1`;
    const rows = await this.query(query, [id], client);
    if (rows.length > 0) {
      const row = rows[0];
      for (const key in row) {
        const fieldTemplate = this.fields && this.fields[key];
        if (fieldTemplate && typeof fieldTemplate.onGet === 'function') {
          row[key] = fieldTemplate.onGet(row[key]);
        }
      }
      return row;
    }
    return null;
  }

  static async findOne(conditions = {}, client = null) {
    const results = await this.find(conditions, { limit: 1 }, client);
    return results[0] || null;
  }

  static async first(conditions = {}, client = null) {
    return this.findOne(conditions, client);
  }

  static async last(conditions = {}, orderBy = 'id', client = null) {
    const { whereClause, values } = this.buildWhere(conditions);
    const query = `
      SELECT * FROM ${this._quoteIdentifier(this.tableName)}
      ${whereClause}
      ORDER BY ${this._quoteIdentifier(orderBy)} DESC
      LIMIT 1
    `;
    const rows = await this.query(query, values, client);
    return rows.length > 0 ? rows[0] : null;
  }

  static async count(conditions = {}, client = null) {
    const { whereClause, values } = this.buildWhere(conditions);
    const query = `SELECT COUNT(*) FROM ${this._quoteIdentifier(this.tableName)} ${whereClause}`;
    const result = await this.query(query, values, client);
    return parseInt(result[0].count, 10);
  }

  static async create(data, client = null) {
    const schema = this.getSchema();
    for (const [key, value] of Object.entries(data)) {
      if (schema[key] && typeof schema[key].validate === 'function') {
        try {
          schema[key].validate(value);
        } catch (error) {
          throw new Error(`Validation failed for field '${key}' in table '${this.tableName}': ${error.message}`);
        }
      }
    }
    if (typeof this.onBeforeCreate === 'function') {
      data = await this.onBeforeCreate(data);
    }
    const processedData = {};
    for (const key in data) {
      const fieldTemplate = schema[key];
      if (fieldTemplate && typeof fieldTemplate.onSet === 'function') {
        processedData[key] = fieldTemplate.onSet(data[key]);
      } else {
        processedData[key] = data[key];
      }
    }
    const keys = Object.keys(processedData);
    const quotedKeys = keys.map((k) => this._quoteIdentifier(k));
    const values = Object.values(processedData);
    const params = keys.map((_, i) => `$${i + 1}`);
    const query = `
      INSERT INTO ${this._quoteIdentifier(this.tableName)} (${quotedKeys.join(', ')})
      VALUES (${params.join(', ')})
      RETURNING *
    `;
    try {
      const result = await this.query(query, values, client);
      if (typeof this.onAfterCreate === 'function') {
        await this.onAfterCreate(result[0]);
      }
      const record = result[0];
      for (const key in record) {
        const fieldTemplate = schema[key];
        if (fieldTemplate && typeof fieldTemplate.onGet === 'function') {
          record[key] = fieldTemplate.onGet(record[key]);
        }
      }
      return record;
    } catch (error) {
      throw new Error(`Failed to create record in table '${this.tableName}': ${error.message}\nData: ${JSON.stringify(data)}`);
    }
  }


  /**
   * Updates a single record in the database by its primary key.
   * @param {string|number} id - The primary key value of the record to update.
   * @param {Object} data - An object containing the fields and values to update.
   * @param {Object} [client=null] - An optional database client for transaction support.
   * @returns {Object|null} The updated record, or null if no record was found.
   * @throws {Error} If validation fails, no data is provided, or a database error occurs.
   */
  static async update(id, data, client = null) {
    const schema = this.getSchema();
    for (const [key, value] of Object.entries(data)) {
      if (schema[key] && typeof schema[key].validate === 'function') {
        try {
          schema[key].validate(value);
        } catch (error) {
          throw new Error(`Validation failed for field '${key}' in table '${this.tableName}': ${error.message}`);
        }
      }
    }
    if (typeof this.onBeforeUpdate === 'function') {
      data = await this.onBeforeUpdate(data);
    }
    const processedData = {};
    for (const key in data) {
      const fieldTemplate = schema[key];
      if (fieldTemplate && typeof fieldTemplate.onSet === 'function') {
        processedData[key] = fieldTemplate.onSet(data[key]);
      } else {
        processedData[key] = data[key];
      }
    }
    const updateKeys = Object.keys(processedData).filter(k => k !== this.primaryKey);
    if (updateKeys.length === 0) {
      throw new Error(`No data provided for update in table '${this.tableName}'`);
    }
    const setClause = updateKeys
      .map((k, i) => `${this._quoteIdentifier(k)} = $${i + 1}`)
      .join(', ');
    const updateValues = updateKeys.map(k => processedData[k]);
    const values = [...updateValues, id];
    const query = `
      UPDATE ${this._quoteIdentifier(this.tableName)}
      SET ${setClause}
      WHERE ${this._quoteIdentifier(this.primaryKey)} = $${updateKeys.length + 1}
      RETURNING *
    `;
    try {
      const result = await this.query(query, values, client);
      if (result.length === 0) {
        return null;
      }
      if (typeof this.onAfterUpdate === 'function') {
        await this.onAfterUpdate(result[0]);
      }
      const record = result[0];
      for (const key in record) {
        const fieldTemplate = schema[key];
        if (fieldTemplate && typeof fieldTemplate.onGet === 'function') {
          record[key] = fieldTemplate.onGet(record[key]);
        }
      }
      return record;
    } catch (error) {
      throw new Error(`Failed to update record with ID '${id}' in table '${this.tableName}': ${error.message}\nData: ${JSON.stringify(data)}`);
    }
  }

  static async delete(id, client = null) {
    if (typeof this.onBeforeDelete === 'function') {
      await this.onBeforeDelete(id);
    }
    const query = `
      DELETE FROM ${this._quoteIdentifier(this.tableName)}
      WHERE ${this._quoteIdentifier(this.primaryKey)} = $1
      RETURNING *
    `;
    const result = await this.query(query, [id], client);
    if (typeof this.onAfterDelete === 'function') {
      await this.onAfterDelete(result);
    }
    return result;
  }

  /**
 * Deletes all records from the table, invoking hooks for each record if defined.
 * @param {Object} [client=null] - An optional database client for use within an existing transaction.
 * @returns {Object[]} An array of deleted records.
 * @throws {Error} If a database error occurs or hooks fail.
 */
  static async deleteBatch(client = null) {
    const quotedTableName = this._quoteIdentifier(this.tableName);

    // If hooks are defined, fetch all records to trigger hooks per record
    if (typeof this.onBeforeDelete === 'function' || typeof this.onAfterDelete === 'function') {
      const records = await this.find({}, {}, client);
      if (records.length === 0) return [];

      // Trigger onBeforeDelete for each record
      if (typeof this.onBeforeDelete === 'function') {
        for (const record of records) {
          await this.onBeforeDelete(record[this.primaryKey]);
        }
      }

      // Delete all records
      const query = `DELETE FROM ${quotedTableName} RETURNING *`;
      const result = await this.query(query, [], client);
      const deletedRecords = result.map(row => this._processOnGet(row));

      // Trigger onAfterDelete for each record
      if (typeof this.onAfterDelete === 'function') {
        for (const record of deletedRecords) {
          await this.onAfterDelete([record]); // Match the signature of delete(id)
        }
      }

      return deletedRecords;
    } else {
      // No hooks, perform a simple bulk delete
      const query = `DELETE FROM ${quotedTableName} RETURNING *`;
      const result = await this.query(query, [], client);
      return result.map(row => this._processOnGet(row));
    }
  }

  static async createBatch(dataArray, client = null) {
    if (!Array.isArray(dataArray) || dataArray.length === 0) {
      throw new Error(`dataArray must be a non-empty array for batch create in table '${this.tableName}'`);
    }
    const baseKeys = Object.keys(dataArray[0]).sort();
    for (const data of dataArray) {
      const keys = Object.keys(data).sort();
      if (baseKeys.join(',') !== keys.join(',')) {
        throw new Error(`All objects in dataArray must have the same keys for batch create in table '${this.tableName}'`);
      }
      const schema = this.getSchema();
      for (const [key, value] of Object.entries(data)) {
        if (schema[key] && typeof schema[key].validate === 'function') {
          try {
            schema[key].validate(value);
          } catch (error) {
            throw new Error(`Validation failed for field '${key}' in table '${this.tableName}' during batch create: ${error.message}\nData: ${JSON.stringify(data)}`);
          }
        }
      }
    }
    const processedArray = dataArray.map((data) => {
      const newObj = {};
      const schema = this.getSchema();
      for (const key in data) {
        const fieldTemplate = schema[key];
        if (fieldTemplate && typeof fieldTemplate.onSet === 'function') {
          newObj[key] = fieldTemplate.onSet(data[key]);
        } else {
          newObj[key] = data[key];
        }
      }
      return newObj;
    });
    const keys = baseKeys;
    const quotedKeys = keys.map((k) => this._quoteIdentifier(k));
    let values = [];
    let rowsPlaceholders = [];
    processedArray.forEach((data, rowIndex) => {
      const placeholders = keys.map((_, colIndex) => {
        values.push(data[keys[colIndex]]);
        return `$${rowIndex * keys.length + colIndex + 1}`;
      });
      rowsPlaceholders.push(`(${placeholders.join(', ')})`);
    });
    const query = `
      INSERT INTO ${this._quoteIdentifier(this.tableName)} (${quotedKeys.join(', ')})
      VALUES ${rowsPlaceholders.join(', ')}
      RETURNING *
    `;
    try {
      const result = await this.query(query, values, client);
      return result.map((record) => {
        const schema = this.getSchema();
        for (const key in record) {
          const fieldTemplate = schema[key];
          if (fieldTemplate && typeof fieldTemplate.onGet === 'function') {
            record[key] = fieldTemplate.onGet(record[key]);
          }
        }
        return record;
      });
    } catch (error) {
      throw new Error(`Failed to batch create records in table '${this.tableName}': ${error.message}\nData: ${JSON.stringify(dataArray)}`);
    }
  }



  /* ==================== Query Helpers ==================== */

  static buildWhere(conditions) {
    const keys = Object.keys(conditions);
    if (keys.length === 0) return { whereClause: '', values: [] };
    let clauses = [];
    let values = [];
    keys.forEach((key) => {
      const condition = conditions[key];
      const quotedKey = this._quoteIdentifier(key);
      if (condition && typeof condition === 'object' && 'operator' in condition && 'value' in condition) {
        clauses.push(`${quotedKey} ${condition.operator} $${values.length + 1}`);
        values.push(condition.value);
      } else {
        clauses.push(`${quotedKey} = $${values.length + 1}`);
        values.push(condition);
      }
    });
    const whereClause = `WHERE ${clauses.join(' AND ')}`;
    return { whereClause, values };
  }

  static async query(text, params, client = null) {
    const tableName = this.tableName || 'unknown_table'; // Fallback if not set
    if (client) {
      try {
        const result = await client.query(text, params);
        return result.rows;
      } catch (error) {
        // Enhance error with query context
        const enhancedError = new Error(
          `Database error in table '${tableName}': ${error.message}\nQuery: ${text}\nParameters: ${JSON.stringify(params)}`
        );
        // Attempt to extract field name from PostgreSQL error
        if (error.column) {
          enhancedError.field = error.column;
          enhancedError.message += `\nProblematic field: '${error.column}'`;
        } else if (error.detail) {
          const match = error.detail.match(/column "([^"]+)"/i);
          if (match) {
            enhancedError.field = match[1];
            enhancedError.message += `\nProblematic field: '${match[1]}'`;
          }
        }
        enhancedError.originalError = error;
        console.error('Database query error (transaction client):', { tableName, text, params, error });
        throw enhancedError;
      }
    } else {
      const clientFromPool = await pool.connect();
      try {
        const result = await clientFromPool.query(text, params);
        return result.rows;
      } catch (error) {
        const enhancedError = new Error(
          `Database error in table '${tableName}': ${error.message}\nQuery: ${text}\nParameters: ${JSON.stringify(params)}`
        );
        if (error.column) {
          enhancedError.field = error.column;
          enhancedError.message += `\nProblematic field: '${error.column}'`;
        } else if (error.detail) {
          const match = error.detail.match(/column "([^"]+)"/i);
          if (match) {
            enhancedError.field = match[1];
            enhancedError.message += `\nProblematic field: '${match[1]}'`;
          }
        }
        enhancedError.originalError = error;
        console.error('Database query error:', { tableName, text, params, error });
        throw enhancedError;
      } finally {
        clientFromPool.release();
      }
    }
  }

  /* ==================== Schema Synchronization ==================== */

  static async syncSchema(options = { dropExtraColumns: false }) {
    const schema = { ...this.defaultFields, ...(this.fields || this.schema) };
    const quotedTableName = this._quoteIdentifier(this.tableName);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const tableExistsQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = $1
        );
      `;
      const tableExistsResult = await client.query(tableExistsQuery, [this.tableName]);
      const tableExists = tableExistsResult.rows[0].exists;

      if (!tableExists) {
        let columnDefinitions = [];
        for (const [fieldName, fieldDef] of Object.entries(schema)) {
          if (fieldDef.sql) {
            columnDefinitions.push(`${this._quoteIdentifier(fieldName)} ${fieldDef.sql}`);
          } else {
            columnDefinitions.push(this._getColumnDefinition(fieldName, fieldDef));
          }
        }
        const createTableQuery = `CREATE TABLE ${quotedTableName} (${columnDefinitions.join(', ')});`;
        console.log('Creating table:', createTableQuery);
        await client.query(createTableQuery);
      } else {
        const currentSchemaQuery = `
          SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_name = $1 AND table_schema = 'public'
        `;
        const result = await client.query(currentSchemaQuery, [this.tableName]);
        const dbColumns = {};
        for (const row of result.rows) {
          dbColumns[row.column_name.toLowerCase()] = row;
        }

        for (const [fieldName, fieldDef] of Object.entries(schema)) {
          const key = fieldName.toLowerCase();
          if (!dbColumns[key]) {
            if (this.renameMap && this.renameMap[fieldName]) {
              const oldField = this.renameMap[fieldName];
              const oldKey = oldField.toLowerCase();
              if (dbColumns[oldKey]) {
                const renameQuery = `ALTER TABLE ${quotedTableName} RENAME COLUMN ${this._quoteIdentifier(oldKey)} TO ${this._quoteIdentifier(fieldName)};`;
                console.log('Renaming column:', renameQuery);
                await client.query(renameQuery);
                dbColumns[key] = dbColumns[oldKey];
                delete dbColumns[oldKey];
                continue;
              }
            }
            if (fieldDef.required && fieldDef.default === undefined) {
              let tempDef = fieldDef.sql
                ? fieldDef.sql
                : this._getColumnDefinition(fieldName, { ...fieldDef, required: false });
              const addColumnQuery = `ALTER TABLE ${quotedTableName} ADD COLUMN ${this._quoteIdentifier(fieldName)} ${tempDef};`;
              console.log('Adding column as nullable:', addColumnQuery);
              await client.query(addColumnQuery);
              const safeDefault = this._getSafeDefault(fieldDef);
              if (safeDefault !== null) {
                const updateQuery = `UPDATE ${quotedTableName} SET ${this._quoteIdentifier(fieldName)} = ${safeDefault} WHERE ${this._quoteIdentifier(fieldName)} IS NULL;`;
                console.log('Updating column with safe default:', updateQuery);
                await client.query(updateQuery);
              }
              const alterQuery = `ALTER TABLE ${quotedTableName} ALTER COLUMN ${this._quoteIdentifier(fieldName)} SET NOT NULL;`;
              console.log('Altering column to NOT NULL:', alterQuery);
              await client.query(alterQuery);
            } else {
              let defString = fieldDef.sql ? fieldDef.sql : this._getColumnDefinition(fieldName, fieldDef);
              const addColumnQuery = `ALTER TABLE ${quotedTableName} ADD COLUMN ${this._quoteIdentifier(fieldName)} ${defString};`;
              console.log('Adding column:', addColumnQuery);
              await client.query(addColumnQuery);
            }
          } else {
            if (fieldDef.sql) {
              continue;
            }
            const dbCol = dbColumns[key];
            const desiredDef = this._parseFieldDefinition(fieldDef);
            if (
              desiredDef.dataType !== dbCol.data_type ||
              (desiredDef.maxLength && parseInt(dbCol.character_maximum_length, 10) !== desiredDef.maxLength)
            ) {
              let typeClause = desiredDef.dataType;
              if (desiredDef.maxLength) {
                typeClause += `(${desiredDef.maxLength})`;
              }
              try {
                const alterQuery = `ALTER TABLE ${quotedTableName} ALTER COLUMN ${this._quoteIdentifier(fieldName)} TYPE ${typeClause} USING ${this._quoteIdentifier(fieldName)}::${typeClause};`;
                console.log('Altering column type with cast:', alterQuery);
                await client.query(alterQuery);
              } catch (error) {
                console.error(`Error casting column ${fieldName} to new type ${typeClause}. Applying safe default.`, error);
                const safeDefault = this._getSafeDefault(fieldDef);
                const updateQuery = `UPDATE ${quotedTableName} SET ${this._quoteIdentifier(fieldName)} = ${safeDefault} WHERE ${this._quoteIdentifier(fieldName)} IS NOT NULL;`;
                console.log('Updating column to safe default for type change:', updateQuery);
                await client.query(updateQuery);
                const alterQuery2 = `ALTER TABLE ${quotedTableName} ALTER COLUMN ${this._quoteIdentifier(fieldName)} TYPE ${typeClause};`;
                console.log('Altering column type after applying safe default:', alterQuery2);
                await client.query(alterQuery2);
              }
            }
            const isNullable = dbCol.is_nullable === 'YES';
            if (desiredDef.notNull && isNullable) {
              const alterQuery = `ALTER TABLE ${quotedTableName} ALTER COLUMN ${this._quoteIdentifier(fieldName)} SET NOT NULL;`;
              console.log('Altering column nullability (SET NOT NULL):', alterQuery);
              await client.query(alterQuery);
            } else if (!desiredDef.notNull && !isNullable) {
              const alterQuery = `ALTER TABLE ${quotedTableName} ALTER COLUMN ${this._quoteIdentifier(fieldName)} DROP NOT NULL;`;
              console.log('Altering column nullability (DROP NOT NULL):', alterQuery);
              await client.query(alterQuery);
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
        const indexesResult = await client.query(
          `SELECT indexname, indexdef 
           FROM pg_indexes 
           WHERE tablename = $1 AND schemaname = 'public';`,
          [this.tableName]
        );
        const dbIndexes = {};
        for (const row of indexesResult.rows) {
          dbIndexes[row.indexname] = row.indexdef;
        }
        const modelIndexNames = this.indexes.map(idx => this._getIndexName(idx));
        for (const existingIndexName in dbIndexes) {
          if (existingIndexName.toLowerCase() === `${this.tableName.toLowerCase()}_pkey`) {
            continue;
          }
          if (!modelIndexNames.includes(existingIndexName)) {
            console.log(`Dropping extra index ${existingIndexName} (not defined in the model).`);
            const dropQuery = `DROP INDEX ${this._quoteIdentifier(existingIndexName)};`;
            await client.query(dropQuery);
          }
        }
        for (const idx of this.indexes) {
          const computedIndexName = this._getIndexName(idx);
          const existingDef = dbIndexes[computedIndexName];
          let needRecreation = false;
          if (existingDef) {
            const regex = /\(([^)]+)\)/;
            const match = existingDef.match(regex);
            let dbColumns = [];
            if (match && match[1]) {
              dbColumns = match[1].split(',').map((s) => s.trim().replace(/"/g, '').toLowerCase());
            }
            const desiredColumns = idx.columns.map((col) => col.toLowerCase()).sort();
            const currentColumns = dbColumns.sort();
            if (desiredColumns.join(',') !== currentColumns.join(',')) {
              needRecreation = true;
            }
            const dbUnique = existingDef.includes('UNIQUE INDEX') || existingDef.includes('UNIQUE');
            const desiredUnique = !!idx.unique;
            if (dbUnique !== desiredUnique) {
              needRecreation = true;
            }
            if (needRecreation) {
              const dropQuery = `DROP INDEX ${this._quoteIdentifier(computedIndexName)};`;
              console.log(`Dropping index ${computedIndexName} due to definition changes:`, dropQuery);
              await client.query(dropQuery);
            }
          }
          if (!existingDef || needRecreation) {
            const uniqueClause = idx.unique ? 'UNIQUE' : '';
            const idxQuery = `CREATE ${uniqueClause} INDEX ${this._quoteIdentifier(computedIndexName)} ON ${quotedTableName} (${idx.columns
              .map((col) => this._quoteIdentifier(col))
              .join(', ')});`;
            console.log('Creating index:', idxQuery);
            await client.query(idxQuery);
          }
        }
      }

      for (const [fieldName, fieldDef] of Object.entries(schema)) {
        if (fieldDef.uid) {
          const quotedFieldName = this._quoteIdentifier(fieldName);
          const commentQuery = `COMMENT ON COLUMN ${quotedTableName}.${quotedFieldName} IS 'uid: ${fieldDef.uid}'`;
          await client.query(commentQuery);
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error during schema synchronization:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static _quoteIdentifier(identifier) {
    return '"' + identifier.replace(/"/g, '""') + '"';
  }

  static _getColumnDefinition(fieldName, fieldDef) {
    if (fieldDef.sql) {
      return `${this._quoteIdentifier(fieldName)} ${fieldDef.sql}`;
    }
    let sql = `${this._quoteIdentifier(fieldName)} `;
    switch (fieldDef.type.toLowerCase()) {
      case 'string':
      case 'varchar':
        sql += `VARCHAR(${fieldDef.length || 255})`;
        break;
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
        if (fieldDef.precision && fieldDef.scale) {
          sql += `NUMERIC(${fieldDef.precision}, ${fieldDef.scale})`;
        } else {
          sql += `NUMERIC`;
        }
        break;
      default:
        sql += fieldDef.type.toUpperCase();
    }
    if (fieldDef.required) {
      sql += ' NOT NULL';
    }
    if (fieldDef.default !== undefined) {
      if (['string', 'varchar', 'text'].includes(fieldDef.type.toLowerCase())) {
        if (typeof fieldDef.default === 'string' && !/^'.*'$/.test(fieldDef.default)) {
          sql += ` DEFAULT '${fieldDef.default}'`;
        } else {
          sql += ` DEFAULT ${fieldDef.default}`;
        }
      } else {
        sql += ` DEFAULT ${fieldDef.default}`;
      }
    }
    return sql;
  }

  static _parseFieldDefinition(fieldDef) {
    let dataType;
    let maxLength = null;
    switch (fieldDef.type.toLowerCase()) {
      case 'string':
      case 'varchar':
        dataType = 'character varying';
        maxLength = fieldDef.length || 255;
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
    return {
      dataType,
      maxLength,
      notNull: !!fieldDef.required,
      default: fieldDef.default,
    };
  }

  static _getSafeDefault(fieldDef) {
    switch (fieldDef.type.toLowerCase()) {
      case 'string':
      case 'varchar':
      case 'text':
        return "''";
      case 'integer':
      case 'int':
      case 'bigint':
        return "0";
      case 'boolean':
        return "false";
      case 'date':
        return "CURRENT_DATE";
      case 'timestamp':
        return "CURRENT_TIMESTAMP";
      case 'numeric':
        return "0";
      default:
        return null;
    }
  }

  static _getIndexName(indexDef) {
    const prefix = this.tableName.toLowerCase() + '_';
    if (indexDef.name.toLowerCase().startsWith(prefix)) {
      return indexDef.name;
    }
    return `${this.tableName}_${indexDef.name}`;
  }

  static _processOnGet(row) {
    const schema = this.getSchema();
    const processedRow = { ...row };
    for (const key in processedRow) {
      const fieldTemplate = schema[key];
      if (fieldTemplate && typeof fieldTemplate.onGet === 'function') {
        processedRow[key] = fieldTemplate.onGet(processedRow[key]);
      }
    }
    return processedRow;
  }
}