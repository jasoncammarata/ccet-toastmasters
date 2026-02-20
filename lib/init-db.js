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
    status TEXT DEFAULT 'scheduled'
  );

  CREATE TABLE IF NOT EXISTS toastmasters_of_the_evening (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER NOT NULL,
    member_id INTEGER,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id),
    FOREIGN KEY (member_id) REFERENCES members(id)
  );

  CREATE TABLE IF NOT EXISTS timers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER NOT NULL,
    member_id INTEGER,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id),
    FOREIGN KEY (member_id) REFERENCES members(id)
  );

  CREATE TABLE IF NOT EXISTS table_topics_masters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER NOT NULL,
    member_id INTEGER,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id),
    FOREIGN KEY (member_id) REFERENCES members(id)
  );

  CREATE TABLE IF NOT EXISTS general_evaluators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER NOT NULL,
    member_id INTEGER,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id),
    FOREIGN KEY (member_id) REFERENCES members(id)
  );

  CREATE TABLE IF NOT EXISTS ah_counter_grammarians (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER NOT NULL,
    member_id INTEGER,
    word_of_the_day TEXT,
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

  CREATE TABLE IF NOT EXISTS evaluators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER NOT NULL,
    slot_number INTEGER NOT NULL,
    member_id INTEGER,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id),
    FOREIGN KEY (member_id) REFERENCES members(id),
    UNIQUE(meeting_id, slot_number)
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
  CREATE TABLE IF NOT EXISTS guests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER NOT NULL,
    member_id INTEGER,
    guest_id INTEGER,
    checked_in_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id),
    FOREIGN KEY (member_id) REFERENCES members(id),
    FOREIGN KEY (guest_id) REFERENCES guests(id),
    UNIQUE(meeting_id, member_id),
    UNIQUE(meeting_id, guest_id)
  );

  CREATE TABLE IF NOT EXISTS table_topics_speakers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER NOT NULL,
    member_id INTEGER,
    guest_id INTEGER,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id),
    FOREIGN KEY (member_id) REFERENCES members(id),
    FOREIGN KEY (guest_id) REFERENCES guests(id),
    UNIQUE(meeting_id, member_id),
    UNIQUE(meeting_id, guest_id)
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
  INSERT OR IGNORE INTO meetings (date, status)
  VALUES (?, ?)
`).run('2024-01-15', 'scheduled');

console.log('Database initialized successfully!');
console.log('Admin login: CCET_Admin / CCET2018Toastmasters!');
console.log('Demo login: demo@demo / demo123');

db.close();
