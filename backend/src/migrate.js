// Manual/optional: the server also applies the schema automatically on
// startup (see server.js), so this is only useful for applying it without
// starting the server.
require('dotenv').config();
const pool = require('./db');
const { ensureSchema } = require('./schema');

ensureSchema()
  .then(async () => {
    console.log('Schema applied.');
    await pool.end();
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
