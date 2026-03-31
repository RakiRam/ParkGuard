// ===================================
// DATABASE CONFIGURATION
// ===================================

const { Pool } = require('pg');
const logger = require('../utils/logger');
const env = require('./env');

const dbConfig = {
  user: env.DB_USER,
  host: env.DB_HOST,
  database: env.DB_NAME,
  password: env.DB_PASSWORD,
  port: env.DB_PORT,
  ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  
  max: 20, 
  idleTimeoutMillis: 30000, 
  connectionTimeoutMillis: 2000, 
};

// Create connection pool
const pool = new Pool(dbConfig);

pool.on('connect', () => {
  logger.info('✅ New database connection established');
});

pool.on('acquire', () => {
  logger.debug('🔄 Database connection acquired from pool');
});

pool.on('remove', () => {
  logger.debug('🔥 Database connection removed from pool');
});

pool.on('error', (err) => {
  logger.error({ err }, '❌ Database transient connection error. Pool will automatically attempt to reconnect.');
  // Deliberately removed process.exit(1) to avoid total crash due to transient DB instability network drops.
});

const MAX_RETRIES = 5;

// Test database connection with Exponential Backoff
const testConnection = async (retries = 0) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version()');
    logger.info(`📊 Database connected successfully. Server: ${result.rows[0].version.split(' ')[1]}`);
    client.release();
  } catch (error) {
    if (retries < MAX_RETRIES) {
      const waitTime = Math.pow(2, retries) * 1000;
      logger.warn(`❌ DB Connection failed. Waiting ${waitTime}ms before retry (${retries + 1}/${MAX_RETRIES})...`);
      setTimeout(() => {
        testConnection(retries + 1);
      }, waitTime);
    } else {
      logger.error({ err: error }, '❌ Maximum database retries reached. API online but database access endpoints will 500.');
    }
  }
};

testConnection();

// Helper function to handle database queries with error handling
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Log slow queries (> 100ms)
    if (duration > 100) {
      logger.warn({ query: text.substring(0, 100), duration }, `🐌 Slow query detected`);
    }
    
    return res;
  } catch (error) {
    logger.error({ err: error, query: text, params }, 'Database query error');
    throw error;
  }
};

// Helper function for transactions
const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Graceful shutdown
const closePool = async () => {
  try {
    await pool.end();
    logger.info('🔌 Database pool closed gracefully.');
  } catch (error) {
    logger.error({ err: error }, 'Error closing database pool');
  }
};

// Handle process termination cleanup
process.on('SIGINT', closePool);
process.on('SIGTERM', closePool);

module.exports = {
  pool,
  query,
  transaction,
  closePool,
  testConnection
};