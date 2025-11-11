-- Migration: Remove theme column from meetings table
-- Date: 2025-11-11
-- Description: Removed unused theme column from meetings table

ALTER TABLE meetings DROP COLUMN theme;
