import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('./data/observations.db');
const errors = db.prepare(`
  SELECT status, reason_if_rejected, rejection_detail, block_number, timestamp_ms, COUNT(*) as cnt
  FROM observations
  WHERE status = 'ERROR'
  GROUP BY status, reason_if_rejected, rejection_detail, block_number
`).all();

console.log('Error records in observations table:');
console.log(JSON.stringify(errors, null, 2));

const totalErrors = db.prepare(`SELECT count(*) as total FROM observations WHERE status = 'ERROR'`).get();
console.log('Total ERROR rows:', totalErrors);

const rtErrors = db.prepare(`SELECT count(*) as total FROM round_trip_observations WHERE status = 'ERROR'`).get();
console.log('Total ERROR rows in round_trip_observations:', rtErrors);

db.close();
