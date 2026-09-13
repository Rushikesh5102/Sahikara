import { DatabaseSync } from 'node:sqlite';
import { existsSync, unlinkSync, statSync } from 'node:fs';

const targetBackup = './data/test-backup.db';
if (existsSync(targetBackup)) {
  unlinkSync(targetBackup);
}

const db = new DatabaseSync('./data/observations.db');
try {
  // Normalize Windows forward slashes for SQLite string literal
  const backupPath = targetBackup.replace(/\\/g, '/');
  db.exec(`VACUUM INTO '${backupPath}'`);
  console.log('VACUUM INTO executed successfully!');

  // Validate the backup
  const bDb = new DatabaseSync(targetBackup);
  const integrity = bDb.prepare('PRAGMA integrity_check').all();
  console.log('Backup integrity check:', integrity);

  const obsCount = bDb.prepare('SELECT count(*) as total FROM observations').get();
  const rtCount = bDb.prepare('SELECT count(*) as total FROM round_trip_observations').get();
  console.log('Backup observations row count:', obsCount);
  console.log('Backup round_trip row count:', rtCount);

  bDb.close();
  console.log('Backup file size:', statSync(targetBackup).size, 'bytes');

  unlinkSync(targetBackup);
  console.log('Cleanup complete.');
} catch (e) {
  console.error('Backup test failed:', e);
} finally {
  db.close();
}
