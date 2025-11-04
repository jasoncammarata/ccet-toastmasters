# Database Migrations

This folder contains SQL migration files for database schema changes.

## How to Apply Migrations

To apply a migration, run:
```bash
sqlite3 data/toastmasters.db < data/migrations/MIGRATION_FILE.sql
```

## Migration History

- **001_create_evaluators_table.sql** - Created independent evaluators table to decouple evaluators from speeches (2025-11-04)
