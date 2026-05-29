const Database = require('better-sqlite3');
const db = new Database('./movies.db');
const results = db.prepare(`SELECT title FROM scraped_movies_cache WHERE title LIKE '%урок%' OR original_title LIKE '%урок%' LIMIT 500`).all();
console.log(`Found ${results.length} movies with 'урок'`);
if (results.length > 0) {
    console.log(results.slice(0, 15).map(r => r.title));
}
