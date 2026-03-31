require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const run = async () => {
  // First, connect to default postgres DB to create parkguard_db
  const defaultClient = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER_ADMIN || 'postgres',
    password: process.env.DB_PASSWORD_ADMIN || process.env.DB_PASSWORD || 'postgres',
    database: 'postgres',
  });

  let createdDb = false;
  try {
    await defaultClient.connect();
    console.log("Connected to default postgres DB. Checking if parkguard_db exists...");
    
    // Create Role if doesn't exist
    const roleRes = await defaultClient.query("SELECT 1 FROM pg_roles WHERE rolname='parkguard_user'");
    if (roleRes.rowCount === 0) {
      await defaultClient.query(`CREATE ROLE parkguard_user WITH LOGIN PASSWORD '${process.env.DB_PASSWORD || 'parkguard_password'}'`);
      console.log("Created role parkguard_user.");
    }

    const dbRes = await defaultClient.query("SELECT 1 FROM pg_database WHERE datname='parkguard_db'");
    if (dbRes.rowCount === 0) {
      await defaultClient.query('CREATE DATABASE parkguard_db OWNER parkguard_user');
      console.log("Created database parkguard_db.");
      createdDb = true;
    } else {
      console.log("Database parkguard_db already exists.");
    }
  } catch (e) {
    console.log("Error checking/creating database. Ensure PostgreSQL is running locally:", e.message);
  } finally {
    try { await defaultClient.end(); } catch(e){}
  }

  // Now connect to parkguard_db
  const dbClient = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'parkguard_user',
    password: process.env.DB_PASSWORD || 'parkguard_password',
    database: 'parkguard_db',
  });

  try {
    await dbClient.connect();
    console.log("Connected to parkguard_db. Running schema.sql...");
    
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      
      // Execute split statements might be safer, but `query` allows multiple statements
      await dbClient.query(sql);
      console.log("Schema successfully executed!");
    } else {
      console.log("schema.sql not found at", schemaPath);
    }
  } catch (e) {
    console.error("Error executing schema:", e.message);
  } finally {
    await dbClient.end();
  }
};

run();
