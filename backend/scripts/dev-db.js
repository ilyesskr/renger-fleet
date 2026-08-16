// Local-only dev database: a self-contained Postgres binary, no root/install
// needed. Not used in production — deploy against a real hosted Postgres
// (see README) and point DATABASE_URL at that instead.
require('dotenv').config();
const path = require('path');
const EmbeddedPostgres = require('embedded-postgres').default;

const DB_NAME = 'ranger_fleet';
const PORT = 5433;

const pg = new EmbeddedPostgres({
  databaseDir: path.join(__dirname, '..', '.pgdata'),
  user: 'postgres',
  password: 'password',
  port: PORT,
  persistent: true,
});

async function main() {
  await pg.initialise();
  await pg.start();
  try {
    await pg.createDatabase(DB_NAME);
  } catch (err) {
    if (!/already exists/i.test(String(err))) throw err;
  }
  console.log(`Local dev Postgres ready on port ${PORT}.`);
  console.log(`DATABASE_URL=postgres://postgres:password@localhost:${PORT}/${DB_NAME}`);
  console.log('Leave this running; Ctrl+C to stop.');
}

process.on('SIGINT', async () => {
  await pg.stop();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await pg.stop();
  process.exit(0);
});

main().catch((err) => {
  console.error('Failed to start local dev Postgres:', err);
  process.exit(1);
});
