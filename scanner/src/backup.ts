/**
 * SAHIKARA Phase 1D — Database Online Backup & Verification Tool
 *
 * Performs a transactionally safe, non-blocking online backup using
 * SQLite's VACUUM INTO command. Works while the observer is actively writing.
 *
 * Usage:
 *   npm run backup
 *   node dist/backup.js [optional_output_path]
 */

import { existsSync, unlinkSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { DatabaseSync } from 'node:sqlite';
import { loadConfig } from './config/config.js';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function performBackup(customDest?: string): string {
  const config = loadConfig();
  const dbPath = resolve(process.cwd(), config.dbPath);

  if (!existsSync(dbPath)) {
    throw new Error(`Source database does not exist at: ${dbPath}`);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const destPath = customDest ?? resolve(dirname(dbPath), `observations_backup_${timestamp}.db`);

  if (existsSync(destPath)) {
    unlinkSync(destPath);
  }

  const srcDb = new DatabaseSync(dbPath);
  try {
    const safeDest = destPath.replace(/\\/g, '/');
    srcDb.exec(`VACUUM INTO '${safeDest}'`);
  } finally {
    srcDb.close();
  }

  // Validate backup
  const backupDb = new DatabaseSync(destPath);
  try {
    const integrity = backupDb.prepare('PRAGMA integrity_check').all() as Array<{ integrity_check: string }>;
    if (!integrity[0] || integrity[0].integrity_check !== 'ok') {
      throw new Error(`Backup integrity check failed: ${JSON.stringify(integrity)}`);
    }

    const obsCount = backupDb.prepare('SELECT count(*) as total FROM observations').get() as { total: number };
    const rtCount = backupDb.prepare('SELECT count(*) as total FROM round_trip_observations').get() as { total: number };

    console.log('✅ SQLite online backup created and verified successfully!');
    console.log(`Source DB:      ${dbPath}`);
    console.log(`Backup File:    ${destPath}`);
    console.log(`Backup Size:    ${formatBytes(statSync(destPath).size)}`);
    console.log(`Observations:   ${obsCount.total}`);
    console.log(`Round Trips:    ${rtCount.total}`);
    console.log(`Integrity:      ${integrity[0].integrity_check}`);
  } finally {
    backupDb.close();
  }

  return destPath;
}

if (process.argv[1]?.includes('backup')) {
  try {
    performBackup(process.argv[2]);
  } catch (err) {
    console.error('Backup failed:', err);
    process.exit(1);
  }
}
