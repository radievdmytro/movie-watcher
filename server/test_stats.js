const Database = require('better-sqlite3');
const db = new Database('/Users/radev/AG/scratch/movie-watcher/server/movies.db');

try {
    const row = db.prepare('SELECT COUNT(*) as count FROM scraped_movies_cache').get();
    const lastScraped = db.prepare(`
        SELECT id, title, poster_url, rating, year, link 
        FROM scraped_movies_cache 
        WHERE description IS NOT NULL AND description != '' 
        ORDER BY updated_at DESC LIMIT 1
    `).get();
    console.log("Stats count:", row.count);
    console.log("Last scraped:", lastScraped);
} catch (err) {
    console.error("Error:", err.message);
}
db.close();
