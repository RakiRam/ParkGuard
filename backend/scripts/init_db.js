require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const run = async () => {
  const schemaPath = path.join(__dirname, '../database/schema.sql');
  if (!fs.existsSync(schemaPath)) {
    console.error("❌ schema.sql not found at", schemaPath);
    process.exit(1);
  }
  const sql = fs.readFileSync(schemaPath, 'utf8');

  // Automatically map Render's injected DATABASE_URL, or fallback to local explicit variables
  const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

  const dbClient = new Client({
    connectionString,
    // Required true for managed Render postgres instances
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const MAX_RETRIES = 5;
  for (let i = 1; i <= MAX_RETRIES; i++) {
    try {
      console.log(`🔌 Attempting to connect to target database (Attempt ${i}/${MAX_RETRIES})...`);
      await dbClient.connect();
      console.log("✅ Connected to database. Executing schema.sql safely...");
      
      // Execute the idempotent init schema queries
      await dbClient.query(sql);
      console.log("✅ Schema successfully verified and applied!");
      break;
    } catch (e) {
      console.error(`❌ DB Initialization error on attempt ${i}:`, e.message);
      if (i === MAX_RETRIES) {
        console.error("❌ Max retries reached. Exiting init_db. This may cause deployment delays.");
        process.exit(1);
      }
      // Wait exponentially
      await new Promise(res => setTimeout(res, Math.pow(2, i) * 1000));
    }
  }

  await dbClient.end();
};

run();
