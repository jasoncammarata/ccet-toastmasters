-- Migration: Create independent evaluators table
-- Date: 2025-11-04
-- Description: Separates evaluators from speeches table to allow independent sign-ups

CREATE TABLE IF NOT EXISTS evaluators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER NOT NULL,
    slot_number INTEGER NOT NULL,
    member_id INTEGER,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id),
    FOREIGN KEY (member_id) REFERENCES members(id),
    UNIQUE(meeting_id, slot_number)
);
