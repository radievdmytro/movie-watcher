const Database = require('better-sqlite3');
const db = new Database('./database.sqlite');
const schema = db.prepare("PRAGMA table_info('scraped_movies_cache')").all();
console.log(schema);
