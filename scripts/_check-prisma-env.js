const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
console.log('DATABASE_URL:', process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0,50) + '...' : 'NOT SET');
console.log('Length:', process.env.DATABASE_URL?.length || 0);
