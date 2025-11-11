-- Migration: Create role-specific tables and migrate data
-- Date: 2025-11-11
-- Description: Split meeting_roles into separate tables for each role type

-- Create new tables
CREATE TABLE toastmasters_of_the_evening (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER NOT NULL,
    member_id INTEGER,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id),
    FOREIGN KEY (member_id) REFERENCES members(id)
);

CREATE TABLE timers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER NOT NULL,
    member_id INTEGER,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id),
    FOREIGN KEY (member_id) REFERENCES members(id)
);

CREATE TABLE table_topics_masters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER NOT NULL,
    member_id INTEGER,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id),
    FOREIGN KEY (member_id) REFERENCES members(id)
);

CREATE TABLE general_evaluators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER NOT NULL,
    member_id INTEGER,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id),
    FOREIGN KEY (member_id) REFERENCES members(id)
);

CREATE TABLE ah_counter_grammarians (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER NOT NULL,
    member_id INTEGER,
    word_of_the_day TEXT,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id),
    FOREIGN KEY (member_id) REFERENCES members(id)
);

-- Migrate data
INSERT INTO toastmasters_of_the_evening (meeting_id, member_id)
SELECT meeting_id, member_id FROM meeting_roles WHERE role_name = 'Toastmaster of the Evening';

INSERT INTO timers (meeting_id, member_id)
SELECT meeting_id, member_id FROM meeting_roles WHERE role_name = 'Timer';

INSERT INTO table_topics_masters (meeting_id, member_id)
SELECT meeting_id, member_id FROM meeting_roles WHERE role_name = 'Table Topics Master';

INSERT INTO general_evaluators (meeting_id, member_id)
SELECT meeting_id, member_id FROM meeting_roles WHERE role_name = 'General Evaluator';

INSERT INTO ah_counter_grammarians (meeting_id, member_id, word_of_the_day)
SELECT meeting_id, member_id, word_of_the_day FROM meeting_roles WHERE role_name = 'Ah-Counter/Grammarian';

-- Note: meeting_roles table kept for backward compatibility during transition
