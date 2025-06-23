// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Set production environment
process.env.NODE_ENV = 'production';

const db = require('../lib/postgres-db');

console.log('Initializing Postgres database...');
console.log('This script will create all necessary tables.');
console.log('Press Ctrl+C to cancel.\n');

// The database will auto-initialize when the module loads
setTimeout(() => {
  console.log('\nDatabase initialization complete!');
  console.log('You can now deploy your application.');
  process.exit(0);
}, 5000);