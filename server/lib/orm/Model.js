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
 *
 * Additionally, you can define model-level trigger hooks:
 *
 *   onBeforeCreate(data) -> data
 *   onAfterCreate(record)
 *   onBeforeUpdate(data) -> data
 *   onAfterUpdate(record)
 *   onBeforeDelete(id)
 *   onAfterDelete(result)
 */
export default class Model {
  static tableName = '';
  static primaryKey = 'id';

  // Hardcode default field definitions
  static defaultFields = {
    id: {
      uid: '{f6e2aabc-1e8f-4b19-8e3d-1a2b3c4d5e6f}', // replace with your fixed GUID
      // Instructs _getColumnDefinition() to simply use this SQL fragment.
      // Produces: "id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY"
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

  /**
   * Returns the merged schema of the model,
   * combining parent (super) fields with the current class's fields.
   */
  static getSchema() {
    // If we're at the base class, return the defaultFields
    if (this === Model) {
      return this.defaultFields;
    }
    // Get the parent's schema
    const parentSchema =
      typeof Object.getPrototypeOf(this).getSchema === 'function'
        ? Object.getPrototypeOf(this).getSchema()
        : {};
    // Merge parent's schema with this class's own fields (if defined)
    return { ...parentSchema, ...(this.fields || {}) };
  }

  /* ==================== Public CRUD Methods ==================== */

  static async find(conditions = {}, client = null) {
    const { whereClause, values } = this.buildWhere(conditions);
    const query = `SELECT * FROM ${this._quoteIdentifier(this.tableName)} ${whereClause}`;
    const rows = await this.query(query, values, client);

    // Process onGet hooks for each field if defined.
    return rows.map((row) => {
      for (const key in row) {
        const fieldTemplate = this.fields && this.fields[key];
        if (fieldTemplate && typeof fieldTemplate.onGet === 'function') {
          row[key] = fieldTemplate.onGet(row[key]);
        }
      }
      return row;
    });
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
    const results = await this.find(conditions, client);
    return results.length > 0 ? results[0] : null;
  }

  static async create(data, client = null) {
    // Call the model-level before-create trigger if defined.
    if (typeof this.onBeforeCreate === 'function') {
      data = await this.onBeforeCreate(data);
    }

    // Process onSet hooks for each field if defined.
    const processedData = {};
    for (const key in data) {
      const fieldTemplate = this.fields && this.fields[key];
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
    const result = await this.query(query, values, client);

    // Call the model-level after-create trigger if defined.
    if (typeof this.onAfterCreate === 'function') {
      await this.onAfterCreate(result[0]);
    }

    // Process onGet hooks on the returned record.
    const record = result[0];
    for (const key in record) {
      const fieldTemplate = this.fields && this.fields[key];
      if (fieldTemplate && typeof fieldTemplate.onGet === 'function') {
        record[key] = fieldTemplate.onGet(record[key]);
      }
    }
    return record;
  }

  static async update(id, data, client = null) {
    // Call the model-level before-update trigger if defined.
    if (typeof this.onBeforeUpdate === 'function') {
      data = await this.onBeforeUpdate(data);
    }

    // Process onSet hooks for each field if defined.
    const processedData = {};
    for (const key in data) {
      const fieldTemplate = this.fields && this.fields[key];
      if (fieldTemplate && typeof fieldTemplate.onSet === 'function') {
        processedData[key] = fieldTemplate.onSet(data[key]);
      } else {
        processedData[key] = data[key];
      }
    }

    const keys = Object.keys(processedData);
    const setClause = keys
      .map((k, i) => `${this._quoteIdentifier(k)} = $${i + 1}`)
      .join(', ');
    const values = [...Object.values(processedData), id];
    const query = `
      UPDATE ${this._quoteIdentifier(this.tableName)}
      SET ${setClause}
      WHERE ${this._quoteIdentifier(this.primaryKey)} = $${keys.length + 1}
      RETURNING *
    `;
    const result = await this.query(query, values, client);

    // Call the model-level after-update trigger if defined.
    if (typeof this.onAfterUpdate === 'function') {
      await this.onAfterUpdate(result[0]);
    }

    // Process onGet hooks on the returned record.
    const record = result[0];
    for (const key in record) {
      const fieldTemplate = this.fields && this.fields[key];
      if (fieldTemplate && typeof fieldTemplate.onGet === 'function') {
        record[key] = fieldTemplate.onGet(record[key]);
      }
    }
    return record;
  }

  static async delete(id, client = null) {
    // Call the model-level before-delete trigger if defined.
    if (typeof this.onBeforeDelete === 'function') {
      await this.onBeforeDelete(id);
    }
    const query = `
      DELETE FROM ${this._quoteIdentifier(this.tableName)}
      WHERE ${this._quoteIdentifier(this.primaryKey)} = $1
      RETURNING *
    `;
    const result = await this.query(query, [id], client);
    // Call the model-level after-delete trigger if defined.
    if (typeof this.onAfterDelete === 'function') {
      await this.onAfterDelete(result);
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
    // Process onSet hooks for each record in the array.
    const processedArray = dataArray.map((data) => {
      const newObj = {};
      for (const key in data) {
        const fieldTemplate = this.fields && this.fields[key];
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
    const result = await this.query(query, values, client);
    return result.map((record) => {
      for (const key in record) {
        const fieldTemplate = this.fields && this.fields[key];
        if (fieldTemplate && typeof fieldTemplate.onGet === 'function') {
          record[key] = fieldTemplate.onGet(record[key]);
        }
      }
      return record;
    });
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


  /* ==================== Schema Synchronization ==================== */

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
          dbColumns[row.column_name.toLowerCase()] = row;
        }

        // Process each column defined in our merged schema.
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
      }

      // 2. Index Synchronization: Create, update, and remove indexes.
      if (this.indexes) {
        // Retrieve existing indexes from the database.
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
        // Build the list of index names as they should appear (with table prefix)
        const modelIndexNames = this.indexes.map(idx => this._getIndexName(idx));

        // Drop any extra indexes that exist in the DB but are not in the model.
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

        // Create or update model-defined indexes.
        for (const idx of this.indexes) {
          const computedIndexName = this._getIndexName(idx);
          const existingDef = dbIndexes[computedIndexName];
          let needRecreation = false;
          if (existingDef) {
            // Extract the columns from the existing index definition.
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

  // Add this helper function to your Model class:
  static _getIndexName(indexDef) {
    // If the index name already starts with the table name (case-insensitive), use it as-is.
    const prefix = this.tableName.toLowerCase() + '_';
    if (indexDef.name.toLowerCase().startsWith(prefix)) {
      return indexDef.name;
    }
    return `${this.tableName}_${indexDef.name}`;
  }

}
