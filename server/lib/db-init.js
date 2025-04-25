/**
 * Database initialization script
 * This script ensures that all required infrastructure tables exist before any
 * other database operations are performed.
 */

import pool from '../config/db.js';
import logger from './logger.js';

/**
 * Initialize database by ensuring required system tables exist
 * This function should be called before any other database operations
 */
async function initDatabase() {
    const client = await pool.connect();
    try {
        // Silent database initialization
        
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
            // Creating schema_versions table
            // Create schema_versions table if it doesn't exist
            await client.query(`
                CREATE TABLE schema_versions (
                    table_name VARCHAR(255) PRIMARY KEY,
                    hash VARCHAR(64) NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            `);
            // Schema_versions table created successfully
        } else {
            // Schema_versions table already exists
        }
        
        // Database infrastructure tables initialized successfully
        return true;
    } catch (error) {
        logger.error('Error initializing database:', error);
        throw error;
    } finally {
        client.release();
    }
}

export {
    initDatabase
}; 