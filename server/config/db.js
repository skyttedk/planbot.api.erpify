/**
 * PostgreSQL connection configuration using node-postgres.
 *
 * This configuration uses environment variables for connection details.
 * Environment variables are loaded from .env file using dotenv.
 */

import pkg from 'pg';
import logger from '../lib/logger.js';
import 'dotenv/config';

const { Pool } = pkg;

const config = {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
};

// Log connection without password for debugging
logger.debug('DB Connection config:', { 
    ...config,
    password: '****' // Hide password in logs
});

const pool = new Pool(config);

pool.on('error', (err) => {
    logger.error('Unexpected error on idle PostgreSQL client', err);
    process.exit(-1);
});

export default pool;