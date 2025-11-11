-- Migration: Add is_active column to members table
-- Date: 2025-11-11
-- Description: Add is_active column to track active/inactive members (1 = active, 0 = inactive)

ALTER TABLE members ADD COLUMN is_active INTEGER DEFAULT 1;
