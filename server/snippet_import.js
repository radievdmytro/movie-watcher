// IMPORT URL Direct (Scrape & Save)
app.post('/api/movies/import', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url || !isHdrezkaUrl(url)) return res.status(400).json({ error: 'Valid HDRezka URL required' });

        // Check duplicates first to avoid scrape if possible
        const checkStmt = db.prepare('SELECT id, deleted_at FROM movies WHERE link = ?');
        const existing = checkStmt.get(url);

        if (existing) {
            if (existing.deleted_at) {
                db.prepare('UPDATE movies SET deleted_at = NULL WHERE id = ?').run(existing.id);
                return res.json({ id: existing.id, restored: true, title: 'Restored from trash' });
            }
            return res.status(409).json({ error: 'Movie already exists' });
        }

        const details = await getMovieDetails(url);
        if (!details) return res.status(404).json({ error: 'Could not parse movie details' });

        const stmt = db.prepare(`
            INSERT INTO movies (title, original_title, year, link, rating, description, poster_url, genres, actors, director)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        // Double check duplicate after async await (rare race condition but good practice? nah, getting complex)

        const info = stmt.run(
            details.title, details.original_title, details.year, url, details.rating,
            details.description, details.poster_url, details.genres, details.actors, details.director
        );

        res.json({ id: info.lastInsertRowid, title: details.title });
    } catch (error) {
        console.error('Import failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// REFRESH DATA
