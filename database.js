const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY,
    displayName TEXT,
    roles TEXT,
    isAdmin INTEGER
  )`);
});

module.exports = db;
