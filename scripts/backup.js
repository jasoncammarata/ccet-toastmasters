const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, '..', 'data', 'toastmasters.db');
const backup = path.join(__dirname, '..', 'backups', `backup-${Date.now()}.db`);

// Create backups directory if it doesn't exist
const backupsDir = path.join(__dirname, '..', 'backups');
if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir);
}

// Copy database file
fs.copyFileSync(source, backup);
console.log(`Backup created: ${backup}`);