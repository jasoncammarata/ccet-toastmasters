-- Migration: Add word_of_the_day to meeting_roles table
-- Date: 2025-11-05
-- Description: Allows Ah-Counter/Grammarian to specify word of the day

ALTER TABLE meeting_roles ADD COLUMN word_of_the_day TEXT;
