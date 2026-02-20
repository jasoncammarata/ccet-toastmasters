-- Create guests table
CREATE TABLE IF NOT EXISTS guests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Create attendance table
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

-- Create table topics speakers table
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
