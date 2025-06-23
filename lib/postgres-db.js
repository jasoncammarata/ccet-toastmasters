const { sql } = require('@vercel/postgres');
const bcrypt = require('bcryptjs');

// Initialize database tables
async function initializeDatabase() {
  try {
    // Create members table
    await sql`
      CREATE TABLE IF NOT EXISTS members (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'member',
        joined_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create meetings table
    await sql`
      CREATE TABLE IF NOT EXISTS meetings (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        theme TEXT,
        status TEXT DEFAULT 'scheduled'
      )
    `;

    // Create meeting_roles table
    await sql`
      CREATE TABLE IF NOT EXISTS meeting_roles (
        id SERIAL PRIMARY KEY,
        meeting_id INTEGER REFERENCES meetings(id),
        role_name TEXT NOT NULL,
        member_id INTEGER REFERENCES members(id)
      )
    `;

    // Create speeches table
    await sql`
      CREATE TABLE IF NOT EXISTS speeches (
        id SERIAL PRIMARY KEY,
        meeting_id INTEGER REFERENCES meetings(id),
        speaker_id INTEGER REFERENCES members(id),
        speech_title TEXT,
        speech_project TEXT,
        evaluator_id INTEGER REFERENCES members(id)
      )
    `;

    // Create applications table
    await sql`
      CREATE TABLE IF NOT EXISTS applications (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        reason TEXT,
        status TEXT DEFAULT 'pending',
        submitted_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create default admin user
    const adminPassword = bcrypt.hashSync('CCET2018Toastmasters!', 10);
    await sql`
      INSERT INTO members (email, password, name, role) 
      VALUES ('CCET_Admin', ${adminPassword}, 'Admin', 'admin')
      ON CONFLICT (email) DO NOTHING
    `;

    // Create demo users
    const demoPassword = bcrypt.hashSync('demo123', 10);
    const demoUsers = [
      { email: 'demo@demo', password: demoPassword, name: 'Demo User', role: 'member' },
      { email: 'lisa@demo123', password: demoPassword, name: 'Lisa Simpson', role: 'member' },
      { email: 'john@demo123', password: demoPassword, name: 'John Doe', role: 'member' },
      { email: 'emily@demo123', password: demoPassword, name: 'Emily Johnson', role: 'member' }
    ];

    for (const user of demoUsers) {
      await sql`
        INSERT INTO members (email, password, name, role) 
        VALUES (${user.email}, ${user.password}, ${user.name}, ${user.role})
        ON CONFLICT (email) DO NOTHING
      `;
    }

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

// Database wrapper with SQLite-compatible methods
const db = {
  prepare: (query) => {
    // Convert SQLite-style queries to Postgres
    const postgresQuery = query
      .replace(/\?/g, (match, offset) => {
        const index = query.substring(0, offset).match(/\?/g)?.length || 0;
        return `$${index + 1}`;
      });

    return {
      get: async (...params) => {
        try {
          const result = await sql.query(postgresQuery, params);
          return result.rows[0];
        } catch (error) {
          console.error('Database query error:', error);
          throw error;
        }
      },
      
      all: async (...params) => {
        try {
          const result = await sql.query(postgresQuery, params);
          return result.rows;
        } catch (error) {
          console.error('Database query error:', error);
          throw error;
        }
      },
      
      run: async (...params) => {
        try {
          const isInsert = postgresQuery.toLowerCase().includes('insert');
          const modifiedQuery = isInsert && !postgresQuery.toLowerCase().includes('returning') 
            ? postgresQuery + ' RETURNING id'
            : postgresQuery;
            
          const result = await sql.query(modifiedQuery, params);
          
          return {
            lastInsertRowid: result.rows[0]?.id,
            changes: result.rowCount
          };
        } catch (error) {
          console.error('Database query error:', error);
          throw error;
        }
      }
    };
  },
  
  exec: async (query) => {
    // Not used in Postgres version
    console.log('exec called - skipping for Postgres');
  }
};

// Initialize database on first load
initializeDatabase().catch(console.error);

module.exports = db;