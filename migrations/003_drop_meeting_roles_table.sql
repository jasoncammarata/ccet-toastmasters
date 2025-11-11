-- Migration: Drop old meeting_roles table
-- Date: 2025-11-11
-- Description: Remove deprecated meeting_roles table after migrating to role-specific tables

DROP TABLE IF EXISTS meeting_roles;
