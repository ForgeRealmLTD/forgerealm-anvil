import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { pool } from './index';

// Numbered SQL migrations. Each file in db/migrations runs once, in filename
// order, inside its own transaction, and is recorded in schema_migrations.
// 001_baseline is fully idempotent, so databases created by the old
// single-file migrate script pick up cleanly: 001 re-runs as a no-op and is
// recorded, then newer migrations apply on top.

function migrationsDir(): string {
  const local = path.join(__dirname, 'migrations');
  return fs.existsSync(local) ? local : path.resolve(process.cwd(), 'db', 'migrations');
}

async function migrate(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const applied = new Set(
      (await client.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map(
        (r) => r.name
      )
    );

    const files = fs
      .readdirSync(migrationsDir())
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = fs.readFileSync(path.join(migrationsDir(), file), 'utf8');
      console.log(`Applying ${file}...`);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    console.log('Migrations up to date.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
