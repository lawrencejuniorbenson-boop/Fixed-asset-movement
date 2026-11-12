/**
 * src/db/seed.js
 * Resets the database to a clean, production-ready zero state.
 */

import db from './database.js';

async function seed() {
  console.log('Initializing clean database...');
  
  // Clear all data
  db.data.users = [];
  db.data.movement_requests = [];
  db.data.movement_items = [];
  db.data.transport_tasks = [];
  db.data.audit_log = [];
  db.data.counters = {
    users: 0,
    movement_requests: 0,
    movement_items: 0,
    transport_tasks: 0,
    audit_log: 0,
  };
  db.data.drafts = {};
  db.save();

  console.log('Database reset to clean state. Ready for user registrations.');
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
