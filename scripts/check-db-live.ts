import pg from 'pg';
const { Pool } = pg;
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  try {
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name = 'ai_configurations' OR table_name = 'prospects');
    `);
    console.log("Tables found:", res.rows.map(r => r.table_name));
    
    if (res.rows.find(r => r.table_name === 'ai_configurations')) {
        const columns = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'ai_configurations'`);
        console.log("Columns in ai_configurations:", columns.rows);
    }
  } catch (err) {
    console.error("Error checking DB:", err);
  } finally {
    await pool.end();
  }
}

check();
