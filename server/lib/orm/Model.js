import pool from '../../config/db.js';

/**
 * Base Model class for ORM operations with automatic schema synchronization.
 *
 * Each subclass should define:
 * - static tableName: the table name.
 * - static fields (preferred) OR static schema: an object describing the fields.
 *   Example:
 *     static fields = {
 *       name: new NameField({ required: true }),
 *       phone: new PhoneField({ required: false }),
 *       zip: new ZipField({ required: true, default: '00000' })
 *     };
 *
 * - (Optional) static renameMap: an object mapping new field names to their old names.
 * - (Optional) static indexes: an array of index definitions.
 *
 * This base Model automatically includes these default fields:
 *
 *   id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 *   createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *   updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
 */
export default class Model {
  static tableName = '';
  static primaryKey = 'id';

  // Hardcode default field definitions
  static defaultFields = {
    id: {
      uid: '{f6e2aabc-1e8f-4b19-8e3d-1a2b3c4d5e6f}', // replace with your fixed GUID
      /*  
         The next line instructs _getColumnDefinition() to simply use this SQL fragment.
         This produces: "id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY"
      */
      sql: 'INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY',
      required: true,
    },
    createdAt: {
      uid: '{a1b2c3d4-e5f6-7890-abcd-ef1234567890}', // replace with your fixed GUID
      sql: 'TIMESTAMPTZ NOT NULL DEFAULT NOW()',
      required: true,
    },
    updatedAt: {
      uid: '{09876543-21fe-dcba-0987-654321fedcba}', // replace with your fixed GUID
      sql: 'TIMESTAMPTZ NOT NULL DEFAULT NOW()',
      required: true,
    },
  };

  /* ==================== Public CRUD Methods ==================== */

  static async find(conditions = {}, client = null) {
    const { whereClause, values } = this.buildWhere(conditions);
    const query = `SELECT * FROM ${this._quoteIdentifier(this.tableName)} ${whereClause}`;
    return this.query(query, values, client);
  }

  static async findById(id, client = null) {
    const query = `SELECT * FROM ${this._quoteIdentifier(this.tableName)} WHERE ${this._quoteIdentifier(this.primaryKey)} = $1`;
    const rows = await this.query(query, [id], client);
    return rows.length > 0 ? rows[0] : null;
  }

  static async findOne(conditions = {}, client = null) {
    const results = await this.find(conditions, client);
    return results.length > 0 ? results[0] : null;
  }

  static async create(data, client = null) {
    if (typeof this.beforeCreate === 'function') {
      data = await this.beforeCreate(data);
    }
    const keys = Object.keys(data);
    const quotedKeys = keys.map((k) => this._quoteIdentifier(k));
    const values = Object.values(data);
    const params = keys.map((_, i) => `$${i + 1}`);
    const query = `
      INSERT INTO ${this._quoteIdentifier(this.tableName)} (${quotedKeys.join(', ')})
      VALUES (${params.join(', ')})
      RETURNING *
    `;
    const result = await this.query(query, values, client);
    if (typeof this.afterCreate === 'function') {
      await this.afterCreate(result);
    }
    return result;
  }

  static async update(id, data, client = null) {
    if (typeof this.beforeUpdate === 'function') {
      data = await this.beforeUpdate(data);
    }
    const keys = Object.keys(data);
    const setClause = keys
      .map((k, i) => `${this._quoteIdentifier(k)} = $${i + 1}`)
      .join(', ');
    const values = [...Object.values(data), id];
    const query = `
      UPDATE ${this._quoteIdentifier(this.tableName)}
      SET ${setClause}
      WHERE ${this._quoteIdentifier(this.primaryKey)} = $${keys.length + 1}
      RETURNING *
    `;
    const result = await this.query(query, values, client);
    if (typeof this.afterUpdate === 'function') {
      await this.afterUpdate(result);
    }
    return result;
  }

  static async delete(id, client = null) {
    if (typeof this.beforeDelete === 'function') {
      await this.beforeDelete(id);
    }
    const query = `
      DELETE FROM ${this._quoteIdentifier(this.tableName)}
      WHERE ${this._quoteIdentifier(this.primaryKey)} = $1
      RETURNING *
    `;
    const result = await this.query(query, [id], client);
    if (typeof this.afterDelete === 'function') {
      await this.afterDelete(result);
    }
    return result;
  }

  static async createBatch(dataArray, client = null) {
    if (!Array.isArray(dataArray) || dataArray.length === 0) {
      throw new Error('dataArray must be a non-empty array');
    }
    const baseKeys = Object.keys(dataArray[0]).sort();
    for (const data of dataArray) {
      const keys = Object.keys(data).sort();
      if (baseKeys.join(',') !== keys.join(',')) {
        throw new Error('All objects in dataArray must have the same keys');
      }
    }
    const keys = baseKeys;
    const quotedKeys = keys.map((k) => this._quoteIdentifier(k));
    let values = [];
    let rowsPlaceholders = [];
    dataArray.forEach((data, rowIndex) => {
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
    return this.query(query, values, client);
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
    if (client) {
      try {
        const result = await client.query(text, params);
        return result.rows;
      } catch (error) {
        console.error('Database query error (transaction client):', { text, params, error });
        throw error;
      }
    } else {
      const clientFromPool = await pool.connect();
      try {
        const result = await clientFromPool.query(text, params);
        return result.rows;
      } catch (error) {
        console.error('Database query error:', { text, params, error });
        throw error;
      } finally {
        clientFromPool.release();
      }
    }
  }

  static async beginTransaction() {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      return client;
    } catch (error) {
      client.release();
      console.error('Error beginning transaction:', error);
      throw error;
    }
  }

  static async commitTransaction(client) {
    try {
      await client.query('COMMIT');
    } catch (error) {
      console.error('Error committing transaction:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async rollbackTransaction(client) {
    try {
      await client.query('ROLLBACK');
    } catch (error) {
      console.error('Error rolling back transaction:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /* ==================== Schema Synchronization ==================== */

  /**
   * Synchronize the database table schema with the model definition.
   * This method supports reusable field templates defined via static fields
   * (or falling back to static schema).
   * It automatically includes default fields: id, createdAt and updatedAt.
   */
  static async syncSchema() {
    // Merge default fields with the model's own fields (child fields override defaults if keys conflict)
    const schema = { ...this.defaultFields, ...(this.fields || this.schema) };

    const quotedTableName = this._quoteIdentifier(this.tableName);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Check if the table exists.
      const tableExistsQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = $1
        );
      `;
      const tableExistsResult = await client.query(tableExistsQuery, [this.tableName]);
      const tableExists = tableExistsResult.rows[0].exists;

      if (!tableExists) {
        // Build the CREATE TABLE statement using the merged schema.
        let columnDefinitions = [];
        for (const [fieldName, fieldDef] of Object.entries(schema)) {
          // If a custom SQL fragment is provided, use it.
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
        // Retrieve current table schema.
        const currentSchemaQuery = `
          SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_name = $1 AND table_schema = 'public'
        `;
        const result = await client.query(currentSchemaQuery, [this.tableName]);
        const dbColumns = {};
        for (const row of result.rows) {
          // Use lowercased column name for comparison.
          dbColumns[row.column_name.toLowerCase()] = row;
        }

        // Process each column defined in our merged schema.
        for (const [fieldName, fieldDef] of Object.entries(schema)) {
          const key = fieldName.toLowerCase();
          if (!dbColumns[key]) {
            // Check for rename mapping.
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
            // Adding a new column.
            if (fieldDef.required && fieldDef.default === undefined) {
              // Add column as nullable first.
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
            // Column exists.
            // If a custom SQL fragment is provided, skip updating this column.
            if (fieldDef.sql) {
              continue;
            }

            // Otherwise, check if its definition needs an update.
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
      }

      // 2. Index Synchronization: Create, update, and remove indexes.
      if (this.indexes) {
        // Retrieve existing indexes (with definitions) for this table.
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

        // Build a list of index names that should exist according to the model.
        const modelIndexNames = this.indexes.map((idx) => idx.name);

        // --- Remove any extra indexes that exist in the DB but not in the model.
        for (const existingIndexName in dbIndexes) {
          // Skip the primary key index.
          if (existingIndexName.toLowerCase() === `${this.tableName.toLowerCase()}_pkey`) {
            continue;
          }
          if (!modelIndexNames.includes(existingIndexName)) {
            console.log(`Dropping extra index ${existingIndexName} (not defined in the model).`);
            const dropQuery = `DROP INDEX ${this._quoteIdentifier(existingIndexName)};`;
            await client.query(dropQuery);
          }
        }

        // --- Process each model-defined index.
        for (const idx of this.indexes) {
          const existingDef = dbIndexes[idx.name];
          let needRecreation = false;
          if (existingDef) {
            // Extract the column list from the existing index definition (using a simple regexp).
            const regex = /\(([^)]+)\)/;
            const match = existingDef.match(regex);
            let dbColumns = [];
            if (match && match[1]) {
              dbColumns = match[1]
                .split(',')
                .map((s) => s.trim().replace(/"/g, '').toLowerCase());
            }
            const desiredColumns = idx.columns.map((col) => col.toLowerCase()).sort();
            const currentColumns = dbColumns.sort();
            if (desiredColumns.join(',') !== currentColumns.join(',')) {
              needRecreation = true;
            }
            // Check uniqueness.
            const dbUnique = existingDef.includes('UNIQUE INDEX') || existingDef.includes('UNIQUE');
            const desiredUnique = !!idx.unique;
            if (dbUnique !== desiredUnique) {
              needRecreation = true;
            }
            if (needRecreation) {
              const dropQuery = `DROP INDEX ${this._quoteIdentifier(idx.name)};`;
              console.log(`Dropping index ${idx.name} due to definition changes:`, dropQuery);
              await client.query(dropQuery);
            }
          }
          // If the index does not exist or was dropped/recreated, create it.
          if (!existingDef || needRecreation) {
            const uniqueClause = idx.unique ? 'UNIQUE' : '';
            const idxQuery = `CREATE ${uniqueClause} INDEX ${this._quoteIdentifier(idx.name)} ON ${quotedTableName} (${idx.columns
              .map((col) => this._quoteIdentifier(col))
              .join(', ')});`;
            console.log('Creating index:', idxQuery);
            await client.query(idxQuery);
          }
        }
      }

      // 3. Set UID Comments on Columns.
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

  /* ==================== Helper Methods ==================== */

  static _quoteIdentifier(identifier) {
    return '"' + identifier.replace(/"/g, '""') + '"';
  }

  static _getColumnDefinition(fieldName, fieldDef) {
    // If a custom SQL fragment is provided, use that.
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
        return "''"; // empty string
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
}
