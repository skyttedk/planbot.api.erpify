// server/lib/orm/SchemaManager.js
import pool from '../../config/db.js';
import logger from '../logger.js';

/**
 * SchemaManager class to handle database schema synchronization
 * Encapsulates schema management functionality that was previously embedded in Model class
 */
export default class SchemaManager {
  /**
   * Creates a new SchemaManager instance
   * @param {Object} model - The model class to synchronize schema for
   */
  constructor(model) {
    this.model = model;
    this.tableName = model.tableName;
    this.quotedTableName = this._quoteIdentifier(model.tableName);
  }

  /**
   * Synchronizes the database schema with the model definition
   * @param {Object} [options={dropExtraColumns: false, force: false}] - Sync options
   * @returns {Promise<void>}
   */
  async syncSchema(options = { dropExtraColumns: false, force: false }) {
    const schema = { 
      ...this.model.defaultFields, 
      ...(this.model.fields || this.model.schema) 
    };
    
    // Acquire database client
    const client = await pool.connect();
    let clientReleased = false;

    try {
      // Start a transaction
      await client.query('BEGIN');

      // Ensure schema_versions table exists
      await this._ensureSchemaVersionsTable(client);
      
      // Calculate schema hash to detect changes
      const schemaHash = this._calculateSchemaHash(schema);
      
      // Check if synchronization is needed
      const syncInfo = await this._checkSyncRequired(client, schemaHash, options);
      const { tableExists, needsSync } = syncInfo;
      
      // If no sync needed, commit and exit early
      if (!needsSync) {
        await client.query('COMMIT');
        client.release();
        clientReleased = true;
        return;
      }

      // Log schema synchronization start
      logger.schema(`Syncing schema for table: ${this.tableName}`);

      if (!tableExists) {
        // Create table if it doesn't exist
        await this._createTable(client, schema);
      } else {
        // Update existing table structure
        await this._updateTableStructure(client, schema, options);
      }

      // Handle indexes
      if (this.model.indexes) {
        await this._syncIndexes(client, this.model.indexes);
      }

      // Save field UIDs as column comments
      await this._saveFieldMetadata(client, schema);
      
      // Update schema version
      await client.query(`
        INSERT INTO schema_versions (table_name, hash, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (table_name) 
        DO UPDATE SET hash = $2, updated_at = NOW()
      `, [this.tableName, schemaHash]);

      // Commit transaction
      await client.query('COMMIT');
      logger.schema(`Schema synchronization completed for table: ${this.tableName}`);
    } catch (error) {
      // Roll back transaction on error
      await client.query('ROLLBACK');
      logger.error(`Schema sync error for table ${this.tableName}:`, error);
      
      // Provide more context for specific errors
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
      // Release client back to pool if not already released
      if (!clientReleased) {
        client.release();
      }
    }
  }

  /**
   * Ensures the schema_versions table exists for tracking schema changes
   * @param {Object} client - Database client
   * @returns {Promise<void>}
   * @private
   */
  async _ensureSchemaVersionsTable(client) {
    // Check if schema_versions table exists
    const versionTableExists = (await client.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'schema_versions'
      )`,
      []
    )).rows[0].exists;
    
    if (!versionTableExists) {
      logger.schema('Creating schema_versions table');
      // Create schema_versions table if it doesn't exist
      await client.query(`
        CREATE TABLE schema_versions (
          table_name VARCHAR(255) PRIMARY KEY,
          hash VARCHAR(64) NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      logger.schema('schema_versions table created successfully');
    }
  }

  /**
   * Checks if schema synchronization is required
   * @param {Object} client - Database client
   * @param {string} schemaHash - Hash of the current schema definition
   * @param {Object} options - Sync options
   * @returns {Promise<{tableExists: boolean, needsSync: boolean}>} Sync status info
   * @private
   */
  async _checkSyncRequired(client, schemaHash, options) {
    // Check if table exists
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
    
    return { tableExists, needsSync };
  }

  /**
   * Creates a new database table
   * @param {Object} client - Database client
   * @param {Object} schema - Schema definition
   * @returns {Promise<void>}
   * @private
   */
  async _createTable(client, schema) {
    // Create column definitions
    const columns = Object.entries(schema).map(([name, def]) => {
      let columnDef;
      if (def.sql) {
        columnDef = `${this._quoteIdentifier(name)} ${def.sql}`;
      } else {
        columnDef = this._getColumnDefinition(name, def);
      }
      logger.schema(`Column definition for ${name}: ${columnDef}`);
      return columnDef;
    });
    
    // Execute CREATE TABLE statement
    const createTableSQL = `CREATE TABLE ${this.quotedTableName} (${columns.join(', ')})`;
    logger.schema(`CREATE TABLE SQL: ${createTableSQL}`);
    await client.query(createTableSQL);
  }

  /**
   * Updates an existing table structure
   * @param {Object} client - Database client
   * @param {Object} schema - Schema definition
   * @param {Object} options - Sync options
   * @returns {Promise<void>}
   * @private
   */
  async _updateTableStructure(client, schema, options) {
    // Get existing columns from database
    const dbColumns = {};
    (await client.query(
      `SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
       FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public'`,
      [this.tableName]
    )).rows.forEach(row => dbColumns[row.column_name.toLowerCase()] = row);

    // Process each field in the schema
    for (const [fieldName, fieldDef] of Object.entries(schema)) {
      const key = fieldName.toLowerCase();
      
      // Check if column doesn't exist
      if (!dbColumns[key]) {
        // Handle renamed columns if a rename map is provided
        if (this.model.renameMap?.[fieldName] && dbColumns[this.model.renameMap[fieldName].toLowerCase()]) {
          const oldKey = this.model.renameMap[fieldName].toLowerCase();
          await client.query(`ALTER TABLE ${this.quotedTableName} RENAME COLUMN ${this._quoteIdentifier(oldKey)} TO ${this._quoteIdentifier(fieldName)}`);
          dbColumns[key] = dbColumns[oldKey];
          delete dbColumns[oldKey];
          continue;
        }
        
        // Add new column
        const defString = fieldDef.sql ? 
          `${fieldDef.sql}` : 
          this._getColumnDefinition(fieldName, fieldDef).replace(`${this._quoteIdentifier(fieldName)} `, '');
        
        logger.schema(`Adding column ${fieldName}, SQL: ALTER TABLE ${this.quotedTableName} ADD COLUMN ${this._quoteIdentifier(fieldName)} ${defString}`);
        await client.query(`ALTER TABLE ${this.quotedTableName} ADD COLUMN ${this._quoteIdentifier(fieldName)} ${defString}`);
        
        // Handle required columns with no default
        if (fieldDef.required && fieldDef.default === undefined) {
          const safeDefault = this._getSafeDefault(fieldDef);
          if (safeDefault !== null) {
            await client.query(`UPDATE ${this.quotedTableName} SET ${this._quoteIdentifier(fieldName)} = ${safeDefault} WHERE ${this._quoteIdentifier(fieldName)} IS NULL`);
          }
          await client.query(`ALTER TABLE ${this.quotedTableName} ALTER COLUMN ${this._quoteIdentifier(fieldName)} SET NOT NULL`);
        }
      } else if (!fieldDef.sql) {
        // Update existing column if needed
        await this._updateColumn(client, fieldName, fieldDef, dbColumns[key]);
      }
    }

    // Handle dropping extra columns if specified
    if (options.dropExtraColumns) {
      await this._dropExtraColumns(client, schema, dbColumns);
    }
  }

  /**
   * Updates an existing column to match the schema definition
   * @param {Object} client - Database client
   * @param {string} fieldName - Field name
   * @param {Object} fieldDef - Field definition
   * @param {Object} dbCol - Database column information
   * @returns {Promise<void>}
   * @private
   */
  async _updateColumn(client, fieldName, fieldDef, dbCol) {
    const desiredDef = this._parseFieldDefinition(fieldDef);
    
    // Check if type change is needed
    if (
      desiredDef.dataType !== dbCol.data_type ||
      (desiredDef.maxLength && parseInt(dbCol.character_maximum_length, 10) !== desiredDef.maxLength)
    ) {
      let typeClause = desiredDef.dataType + (desiredDef.maxLength ? `(${desiredDef.maxLength})` : '');
      logger.schema(`Type change needed for ${fieldName}, type clause: ${typeClause}`);
      
      try {
        // Try to convert with USING clause
        const usingClause = desiredDef.dataType === 'character varying' ? 
          `${this._quoteIdentifier(fieldName)}::text` : 
          `${this._quoteIdentifier(fieldName)}::${typeClause}`;
        
        const alterSQL = `ALTER TABLE ${this.quotedTableName} ALTER COLUMN ${this._quoteIdentifier(fieldName)} TYPE ${typeClause} USING ${usingClause}`;
        logger.db(`Executing SQL: ${alterSQL}`);
        await client.query(alterSQL);
      } catch (error) {
        // Fallback to a simpler approach if conversion fails
        logger.warn(`Error changing type of ${fieldName}, falling back to simpler approach: ${error.message}`);
        const safeDefault = this._getSafeDefault(fieldDef);
        const updateSQL = `UPDATE ${this.quotedTableName} SET ${this._quoteIdentifier(fieldName)} = ${safeDefault} WHERE ${this._quoteIdentifier(fieldName)} IS NOT NULL`;
        logger.db(`Executing SQL: ${updateSQL}`);
        await client.query(updateSQL);
        
        const alterSQL = `ALTER TABLE ${this.quotedTableName} ALTER COLUMN ${this._quoteIdentifier(fieldName)} TYPE ${typeClause}`;
        logger.db(`Executing SQL: ${alterSQL}`);
        await client.query(alterSQL);
      }
    }
    
    // Update NOT NULL constraint if needed
    if (desiredDef.notNull && dbCol.is_nullable === 'YES') {
      await client.query(`ALTER TABLE ${this.quotedTableName} ALTER COLUMN ${this._quoteIdentifier(fieldName)} SET NOT NULL`);
    } else if (!desiredDef.notNull && dbCol.is_nullable === 'NO') {
      await client.query(`ALTER TABLE ${this.quotedTableName} ALTER COLUMN ${this._quoteIdentifier(fieldName)} DROP NOT NULL`);
    }
  }

  /**
   * Drops columns that are in the database but not in the schema
   * @param {Object} client - Database client
   * @param {Object} schema - Schema definition
   * @param {Object} dbColumns - Database columns
   * @returns {Promise<void>}
   * @private
   */
  async _dropExtraColumns(client, schema, dbColumns) {
    const schemaKeys = Object.keys(schema).map(k => k.toLowerCase());
    for (const dbKey in dbColumns) {
      if (!schemaKeys.includes(dbKey)) {
        await client.query(`ALTER TABLE ${this.quotedTableName} DROP COLUMN ${this._quoteIdentifier(dbKey)}`);
      }
    }
  }

  /**
   * Synchronizes indexes for the table
   * @param {Object} client - Database client
   * @param {Array} indexes - Index definitions
   * @returns {Promise<void>}
   * @private
   */
  async _syncIndexes(client, indexes) {
    // Get existing indexes
    const dbIndexes = {};
    (await client.query(
      `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = $1 AND schemaname = 'public'`,
      [this.tableName]
    )).rows.forEach(row => dbIndexes[row.indexname] = row.indexdef);

    // Get model index names
    const modelIndexNames = indexes.map(idx => this._getIndexName(idx));
    
    // Drop indexes that aren't in the model definition
    for (const indexName in dbIndexes) {
      if (indexName.toLowerCase() !== `${this.tableName.toLowerCase()}_pkey` && !modelIndexNames.includes(indexName)) {
        await client.query(`DROP INDEX ${this._quoteIdentifier(indexName)}`);
      }
    }
    
    // Create or recreate indexes from the model definition
    for (const idx of indexes) {
      const name = this._getIndexName(idx);
      const existingDef = dbIndexes[name];
      if (!existingDef || this._indexNeedsRecreation(existingDef, idx)) {
        if (existingDef) await client.query(`DROP INDEX ${this._quoteIdentifier(name)}`);
        const unique = idx.unique ? 'UNIQUE' : '';
        await client.query(
          `CREATE ${unique} INDEX ${this._quoteIdentifier(name)} ON ${this.quotedTableName} (${idx.columns.map(col => this._quoteIdentifier(col)).join(', ')})`
        );
      }
    }
  }

  /**
   * Saves field UIDs as column comments
   * @param {Object} client - Database client
   * @param {Object} schema - Schema definition
   * @returns {Promise<void>}
   * @private
   */
  async _saveFieldMetadata(client, schema) {
    for (const [fieldName, fieldDef] of Object.entries(schema)) {
      if (fieldDef.uid) {
        await client.query(`COMMENT ON COLUMN ${this.quotedTableName}.${this._quoteIdentifier(fieldName)} IS 'uid: ${fieldDef.uid}'`);
      }
    }
  }

  /**
   * Quote an identifier to make it safe for SQL
   * @param {string} identifier - The identifier to quote
   * @returns {string} - Quoted identifier
   * @private
   */
  _quoteIdentifier(identifier) {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  /**
   * Get the column definition SQL
   * @param {string} fieldName - Field name
   * @param {Object} fieldDef - Field definition
   * @returns {string} - Column definition SQL
   * @private
   */
  _getColumnDefinition(fieldName, fieldDef) {
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

  /**
   * Parse field definition to get type information
   * @param {Object} fieldDef - Field definition
   * @returns {Object} - Parsed field definition
   * @private
   */
  _parseFieldDefinition(fieldDef) {
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

  /**
   * Get a safe default value for a field type
   * @param {Object} fieldDef - Field definition
   * @returns {string|null} - Safe default value SQL
   * @private
   */
  _getSafeDefault(fieldDef) {
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

  /**
   * Get the index name
   * @param {Object} indexDef - Index definition
   * @returns {string} - Index name
   * @private
   */
  _getIndexName(indexDef) {
    const prefix = `${this.tableName.toLowerCase()}_`;
    return indexDef.name.toLowerCase().startsWith(prefix) ? indexDef.name : `${this.tableName}_${indexDef.name}`;
  }

  /**
   * Check if an index needs to be recreated
   * @param {string} existingDef - Existing index definition
   * @param {Object} idx - Index definition
   * @returns {boolean} - Whether the index needs recreation
   * @private
   */
  _indexNeedsRecreation(existingDef, idx) {
    const columns = existingDef.match(/\(([^)]+)\)/)?.[1].split(',').map(s => s.trim().replace(/"/g, '').toLowerCase()).sort().join(',') || '';
    const desiredColumns = idx.columns.map(col => col.toLowerCase()).sort().join(',');
    const dbUnique = existingDef.includes('UNIQUE');
    return columns !== desiredColumns || dbUnique !== !!idx.unique;
  }

  /**
   * Calculate a hash of the schema definition
   * @param {Object} schema - The schema object
   * @returns {string} - A hash string representing the schema
   * @private
   */
  _calculateSchemaHash(schema) {
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
}