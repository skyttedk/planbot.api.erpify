/**
 * PostgreSQL connection configuration using node-postgres.
 *
 * This configuration uses environment variables for connection details.
 * If the environment variables are not set, default values will be used.
 */

import pkg from 'pg';
import logger from '../lib/logger.js';

const { Pool } = pkg;

const config = {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'test2',
    password: process.env.DB_PASSWORD || 'dit5740',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
};

const pool = new Pool(config);

pool.on('error', (err) => {
    logger.error('Unexpected error on idle PostgreSQL client', err);
    process.exit(-1);
});

export default pool;