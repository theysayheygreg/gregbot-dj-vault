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

export async function initializeCatalog(databasePath: string): Promise<CatalogInitResult> {
  await mkdir(path.dirname(databasePath), { recursive: true });

  const created = !(await fileExists(databasePath));
  const database = new DatabaseSync(databasePath);

  try {
    database.exec('PRAGMA journal_mode = WAL;');
    database.exec('PRAGMA synchronous = NORMAL;');
    database.exec(catalogSchemaSql);

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
