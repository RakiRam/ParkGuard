// ===================================
// DATABASE CONFIGURATION
// ===================================

const { Pool } = require('pg');

// Database connection configuration
const dbConfig = {
  user: process.env.DB_USER || 'parkguard_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'parkguard_db',
  password: process.env.DB_PASSWORD || 'secure_password',
  port: process.env.DB_PORT || 5432,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  
  // Connection pool settings
  max: parseInt(process.env.DB_MAX_CONNECTIONS) || 20, // Maximum number of clients in pool
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000, // How long a client is allowed to remain idle
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 2000, // How long to wait for connection
};

// Create connection pool
const pool = new Pool(dbConfig);

// Connection event handlers
pool.on('connect', (client) => {
  console.log('✅ New database connection established');
});

pool.on('acquire', (client) => {
  console.log('🔄 Database connection acquired from pool');
});

pool.on('remove', (client) => {
  console.log('🔥 Database connection removed from pool');
});

pool.on('error', (err, client) => {
  console.error('❌ Database connection error:', err.message);
  
  // Exit process with failure if we lose connection to database
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

// Test database connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version()');
    console.log('📊 Database connected successfully');
    console.log('🕐 Database time:', result.rows[0].current_time);
    console.log('📝 Database version:', result.rows[0].version.split(' ')[0] + ' ' + result.rows[0].version.split(' ')[1]);
    client.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    throw error;
  }
};

// Initialize database connection
testConnection().catch(err => {
  console.error('Failed to connect to database:', err);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

// Helper function to handle database queries with error handling
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Log slow queries (> 100ms)
    if (duration > 100) {
      console.warn(`🐌 Slow query detected (${duration}ms):`, text.substring(0, 100));
    }
    
    return res;
  } catch (error) {
    console.error('Database query error:', error.message);
    console.error('Query:', text);
    console.error('Params:', params);
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
    console.log('🔌 Database pool closed');
  } catch (error) {
    console.error('Error closing database pool:', error);
  }
};

// Handle process termination
process.on('SIGINT', closePool);
process.on('SIGTERM', closePool);

module.exports = {
  pool,
  query,
  transaction,
  closePool,
  testConnection
};