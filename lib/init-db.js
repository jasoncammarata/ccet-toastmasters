const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// Create database
const db = new Database(path.join(dataDir, 'toastmasters.db'));

// Create tables
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

// Create admin user
const adminPassword = bcrypt.hashSync('CCET2018Toastmasters!', 10);
db.prepare(`
  INSERT OR IGNORE INTO members (email, password, name, role) 
  VALUES (?, ?, ?, ?)
`).run('CCET_Admin', adminPassword, 'Admin', 'admin');

// Create demo users
const demoPassword = bcrypt.hashSync('demo123', 10);
const demoUsers = [
  { email: 'demo@demo', password: demoPassword, name: 'Demo User', role: 'member' },
  { email: 'lisa@demo123', password: bcrypt.hashSync('john@demo123', 10), name: 'Lisa Simpson', role: 'member' },
  { email: 'john@demo123', password: bcrypt.hashSync('emily@demo123', 10), name: 'John Doe', role: 'member' },
  { email: 'emily@demo123', password: bcrypt.hashSync('demo123', 10), name: 'Emily Johnson', role: 'member' }
];

const insertUser = db.prepare(`
  INSERT OR IGNORE INTO members (email, password, name, role) 
  VALUES (?, ?, ?, ?)
`);

demoUsers.forEach(user => {
  insertUser.run(user.email, user.password, user.name, user.role);
});

// Create sample meeting
db.prepare(`
  INSERT OR IGNORE INTO meetings (date, theme, status) 
  VALUES (?, ?, ?)
`).run('2024-01-15', 'New Year Goals', 'scheduled');

console.log('Database initialized successfully!');
console.log('Admin login: CCET_Admin / CCET2018Toastmasters!');
console.log('Demo login: demo@demo / demo123');

db.close();