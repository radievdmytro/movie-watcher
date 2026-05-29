const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'server', 'index.js');
let content = fs.readFileSync(p, 'utf8');

const target = `app.get('/api/cache/search', authenticateToken, (req, res) => {
    try {
        const { actor, director, genre, year, query, genres, directors, actors, ratingMin, ratingMax, yearMin, yearMax, type, genreMode } = req.query;`;

const replacement = `app.get('/api/cache/search', authenticateToken, async (req, res) => {
    try {
        const { actor, director, genre, year, query, genres, directors, actors, ratingMin, ratingMax, yearMin, yearMax, type, genreMode, live } = req.query;

        if (live === 'true' && query) {
            console.log(\`[Search Live API] Searching HDRezka for: "\${query}"\`);
            const freshResults = filterHiddenGlobalMovies(await searchMovies(query, getUserHeaders(req)), req.user.id);
            const resultsWithFlag = (freshResults || []).map(m => ({ ...m, isLiveResult: true }));
            
            if (freshResults && freshResults.length > 0) {
                for (const item of freshResults) {
                    try {
                        db.prepare(\`
                            INSERT INTO scraped_movies_cache (title, year, link, poster_url, genres, rating, type, updated_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                            ON CONFLICT(link) DO UPDATE SET
                                title = excluded.title, year = excluded.year,
                                poster_url = excluded.poster_url, genres = excluded.genres,
                                rating = excluded.rating, type = excluded.type,
                                updated_at = CURRENT_TIMESTAMP
                        \`).run(item.title, item.year, item.link, item.img, item.misc, item.rating, item.type);
                    } catch (err) {
                        console.error('Error saving live search item:', err);
                    }
                }
            }
            return res.json({ results: resultsWithFlag, total: resultsWithFlag.length, timeMs: 0 });
        }`;

content = content.replace(target, replacement);
fs.writeFileSync(p, content, 'utf8');
console.log("Patched server/index.js");
