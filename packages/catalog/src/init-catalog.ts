import { mkdir } from 'node:fs/promises';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { catalogSchemaSql, catalogSchemaVersion } from './schema.js';

export type CatalogInitResult = {
  databasePath: string;
  created: boolean;
  schemaVersion: number;
  tableCount: number;
};

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function hasColumn(database: DatabaseSync, tableName: string, columnName: string): boolean {
  const rows = database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === columnName);
}

function runMigrations(database: DatabaseSync): void {
  if (!hasColumn(database, 'tracks', 'content_hash_sha256')) {
    database.exec(`ALTER TABLE tracks ADD COLUMN content_hash_sha256 TEXT;`);
  }

  database.exec(`CREATE INDEX IF NOT EXISTS idx_tracks_content_hash_sha256 ON tracks(content_hash_sha256);`);
  database.exec(`UPDATE tracks SET content_hash_sha256 = hash_sha256 WHERE content_hash_sha256 IS NULL;`);
}

export async function initializeCatalog(databasePath: string): Promise<CatalogInitResult> {
  await mkdir(path.dirname(databasePath), { recursive: true });

  const created = !(await fileExists(databasePath));
  const database = new DatabaseSync(databasePath);

  try {
    database.exec('PRAGMA journal_mode = WAL;');
    database.exec('PRAGMA synchronous = NORMAL;');
    database.exec(catalogSchemaSql);
    runMigrations(database);

    const setMetadata = database.prepare(`
      INSERT INTO app_metadata (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    setMetadata.run('schema_version', String(catalogSchemaVersion));
    setMetadata.run('initialized_at', new Date().toISOString());

    const tableCountRow = database
      .prepare(`SELECT COUNT(*) as count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`)
      .get() as { count?: number | bigint } | undefined;
    const tableCount = Number(tableCountRow?.count ?? 0);

    return {
      databasePath,
      created,
      schemaVersion: catalogSchemaVersion,
      tableCount,
    };
  } finally {
    database.close();
  }
}
