const { db } = require('./db.js');
const query = "test query";
const videos = [{id: "1", title: "Video 1"}];

// Save
db.prepare(`
    INSERT INTO youtube_search_cache (query, results_json, updated_at) 
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(query) DO UPDATE SET results_json = excluded.results_json, updated_at = CURRENT_TIMESTAMP
`).run(query, JSON.stringify(videos));

// Load
const cached = db.prepare('SELECT results_json FROM youtube_search_cache WHERE query = ?').get(query);
console.log('Cached:', cached);
