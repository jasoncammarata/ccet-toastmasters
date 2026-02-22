const Database = require('better-sqlite3');
const path = require('path');

let db;

if (process.env.NODE_ENV === 'production' && process.env.POSTGRES_URL) {
  // Use Postgres in production if available
  console.log('Using Postgres database');
  db = require('./postgres-db');
} else if (process.env.NODE_ENV === 'production') {
  // Fallback to in-memory SQLite if no Postgres
  console.log('Using in-memory SQLite database');
  const Database = require('better-sqlite3');
  
  db = new Database(':memory:');
  
  // Initialize schema for in-memory database
  db.exec(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'member',
      joined_date TEXT DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS meetings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      theme TEXT,
      status TEXT DEFAULT 'scheduled'
    );
    
    CREATE TABLE IF NOT EXISTS meeting_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id INTEGER,
      role_name TEXT NOT NULL,
      member_id INTEGER,
      FOREIGN KEY (meeting_id) REFERENCES meetings(id),
      FOREIGN KEY (member_id) REFERENCES members(id)
    );
    
    CREATE TABLE IF NOT EXISTS speeches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id INTEGER,
      speaker_id INTEGER,
      speech_title TEXT,
      speech_project TEXT,
      evaluator_id INTEGER,
      FOREIGN KEY (meeting_id) REFERENCES meetings(id),
      FOREIGN KEY (speaker_id) REFERENCES members(id),
      FOREIGN KEY (evaluator_id) REFERENCES members(id)
    );
    
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      reason TEXT,
      status TEXT DEFAULT 'pending',
      submitted_date TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  // Add default users for in-memory database
  const bcrypt = require('bcryptjs');
  const adminPassword = bcrypt.hashSync('CCET2018Toastmasters!', 10);
  
  db.prepare(`
    INSERT OR IGNORE INTO members (email, password, name, role) 
    VALUES (?, ?, ?, ?)
  `).run('CCET_Admin', adminPassword, 'Admin', 'admin');

  // Add demo users
  const demoPassword = bcrypt.hashSync('demo123', 10);
  const demoUsers = [
    { email: 'demo@demo', password: demoPassword, name: 'Demo User', role: 'member' },
    { email: 'lisa@demo123', password: demoPassword, name: 'Lisa Simpson', role: 'member' },
    { email: 'john@demo123', password: demoPassword, name: 'John Doe', role: 'member' },
    { email: 'emily@demo123', password: demoPassword, name: 'Emily Johnson', role: 'member' }
  ];

  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO members (email, password, name, role) 
    VALUES (?, ?, ?, ?)
  `);

  demoUsers.forEach(user => {
    insertUser.run(user.email, user.password, user.name, user.role);
  });
  
} else {
  // In development, use file-based SQLite database
  console.log('Using file-based SQLite database');
  const Database = require('better-sqlite3');
  const dbPath = path.join(process.cwd(), 'data', 'toastmasters.db');
  db = new Database(dbPath);
}

module.exports = db;