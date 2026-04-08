import path from 'node:path';

import { registerVaultNode } from '../topology.js';

const invocationCwd = process.env.INIT_CWD ?? process.cwd();
const databasePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(invocationCwd, 'data/dj-vault.sqlite');
const name = process.argv[3];
const role = process.argv[4] as 'catalog-primary' | 'media-host' | 'export-worker' | 'hybrid' | undefined;
const transport = (process.argv[5] as 'local' | 'tailscale' | 'ssh' | 'smb' | 'manual' | undefined) ?? null;
const address = process.argv[6] ?? null;
const machineLabel = process.argv[7] ?? null;
const notes = process.argv[8] ?? null;

if (!name || !role) {
  console.error('Usage: npm run register:node -- <database-path> <name> <role> [transport] [address] [machine-label] [notes]');
  process.exit(1);
}

const result = registerVaultNode(databasePath, {
  name,
  role,
  transport,
  address,
  machineLabel,
  isOnline: transport === 'local',
  notes,
});

console.log(JSON.stringify(result, null, 2));
