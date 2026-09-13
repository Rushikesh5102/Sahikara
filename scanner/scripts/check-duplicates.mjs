import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('./data/observations.db');

console.log('=== Checking duplicates in round_trip_observations ===');
// Logical identity: (route, amount_in, block_number)
const rtDups = db.prepare(`
  SELECT route, amount_in, block_number, COUNT(*) as cnt, GROUP_CONCAT(observation_id, ' | ') as ids
  FROM round_trip_observations
  GROUP BY route, amount_in, block_number
  HAVING count(*) > 1
`).all();

console.log('Logical duplicates in round_trip_observations (route, amount_in, block_number):', rtDups.length);
if (rtDups.length > 0) {
  console.log(JSON.stringify(rtDups, null, 2));
}

console.log('=== Checking duplicates in observations ===');
// Logical identity: (pool_address, trade_size_usd, block_number)
const obsDups = db.prepare(`
  SELECT pool_address, trade_size_usd, block_number, COUNT(*) as cnt, GROUP_CONCAT(observation_id, ' | ') as ids
  FROM observations
  GROUP BY pool_address, trade_size_usd, block_number
  HAVING count(*) > 1
`).all();

console.log('Logical duplicates in observations (pool_address, trade_size_usd, block_number):', obsDups.length);
if (obsDups.length > 0) {
  console.log(JSON.stringify(obsDups, null, 2));
}

db.close();
