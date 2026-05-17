const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { searchMovies, getMovieDetails, getCategoryMovies } = require('./scraper');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Cloud Sync Configuration (Supabase)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const dbPath = path.join(__dirname, 'movies.db');

let db = null;
let initDb = null;

// Throttled / Debounced Backup Uploader
let uploadTimeout = null;
let isUploading = false;

async function uploadBackup() {
    if (!supabaseUrl || !supabaseKey) return;
    if (uploadTimeout) clearTimeout(uploadTimeout);
    uploadTimeout = setTimeout(async () => {
        if (isUploading) {
            uploadBackup(); // Retry if currently busy
            return;
        }
        isUploading = true;
        console.log('☁️ Uploading database backup to Supabase...');
        try {
            const fileBuffer = fs.readFileSync(dbPath);
            const res = await fetch(`${supabaseUrl}/storage/v1/object/backups/movies.db`, {
                method: 'POST',
                body: fileBuffer,
                headers: {
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/x-sqlite3',
                    'x-upsert': 'true'
                }
            });
            if (res.ok) {
                console.log('☁️ Database backup successfully uploaded!');
            } else {
                console.error(`☁️ Supabase upload failed with status ${res.status}:`, await res.text());
            }
        } catch (err) {
            console.error('☁️ Error uploading database backup:', err);
        } finally {
            isUploading = false;
        }
    }, 5000); // 5 seconds debounce
}

// Auto-sync middleware for successful database mutation requests
app.use((req, res, next) => {
    const isWrite = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method);
    if (isWrite) {
        res.on('finish', () => {
            if (res.statusCode >= 200 && res.statusCode < 400) {
                uploadBackup();
            }
        });
    }
    next();
});

// Graceful shutdown sync
async function shutdownGracefully() {
    console.log('☁️ Shutting down gracefully... Doing final database sync.');
    if (uploadTimeout) clearTimeout(uploadTimeout);
    
    if (supabaseUrl && supabaseKey && fs.existsSync(dbPath)) {
        try {
            const fileBuffer = fs.readFileSync(dbPath);
            const res = await fetch(`${supabaseUrl}/storage/v1/object/backups/movies.db`, {
                method: 'POST',
                body: fileBuffer,
                headers: {
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/x-sqlite3',
                    'x-upsert': 'true'
                }
            });
            if (res.ok) {
                console.log('☁️ Final database sync successful!');
            } else {
                console.error(`☁️ Final database sync failed: ${res.status}`);
            }
        } catch (err) {
            console.error('☁️ Error during final database sync:', err);
        }
    }
    process.exit(0);
}

process.on('SIGTERM', shutdownGracefully);
process.on('SIGINT', shutdownGracefully);

const isHdrezkaUrl = (str) => {
    return str.toLowerCase().includes('hdrezka') && (str.startsWith('http://') || str.startsWith('https://'));
};

// Search / Parse Endpoint
app.post('/api/movies/search', async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) return res.status(400).json({ error: 'Query required' });

        if (isHdrezkaUrl(query)) {
            const details = await getMovieDetails(query);
            return res.json({ type: 'detail', data: details });
        } else {
            const results = await searchMovies(query);
            return res.json({ type: 'list', data: results });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch data' });
    }
});

// Category Listing Endpoint
app.get('/api/movies/category/:filter', async (req, res) => {
    try {
        const { filter } = req.params;
        const validFilters = ['watching', 'last', 'popular'];
        if (!validFilters.includes(filter)) {
            return res.status(400).json({ error: 'Invalid filter. Use watching, last, or popular.' });
        }
        const results = await getCategoryMovies(filter);
        res.json(results);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch category data' });
    }
});

// CRUD Endpoints

// GET Active Movies
app.get('/api/movies', (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM movies WHERE deleted_at IS NULL ORDER BY created_at DESC');
        const movies = stmt.all();
        res.json(movies);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET Trash
app.get('/api/trash', (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM movies WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC');
        const movies = stmt.all();
        res.json(movies);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET All Unique Genres
app.get('/api/genres', (req, res) => {
    try {
        const stmt = db.prepare('SELECT genres FROM movies WHERE deleted_at IS NULL');
        const rows = stmt.all();
        const genreCounts = {};
        rows.forEach(row => {
            if (row.genres) {
                row.genres.split(',').forEach(g => {
                    const trimmed = g.trim();
                    if (trimmed) {
                        genreCounts[trimmed] = (genreCounts[trimmed] || 0) + 1;
                    }
                });
            }
        });
        // Sort by count (predominant first)
        const sortedGenres = Object.entries(genreCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([genre]) => genre);

        res.json(sortedGenres);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST Add Movie
app.post('/api/movies', (req, res) => {
    try {
        const { title, original_title, year, link, rating, description, poster_url, genres, actors, director, writers, type } = req.body;

        // Check if exists (check both active and deleted? maybe restore if deleted?)
        const checkStmt = db.prepare('SELECT id, deleted_at FROM movies WHERE link = ?');
        const existing = checkStmt.get(link);
        if (existing) {
            if (existing.deleted_at) {
                // Restore if in trash
                db.prepare('UPDATE movies SET deleted_at = NULL WHERE id = ?').run(existing.id);
                return res.json({ id: existing.id, restored: true });
            }
            return res.status(409).json({ error: 'Movie already exists' });
        }

        const stmt = db.prepare(`
      INSERT INTO movies (title, original_title, year, link, rating, description, poster_url, genres, actors, director, writers, type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        const info = stmt.run(title, original_title, year, link, rating, description, poster_url, genres, actors, director, writers, type || 'movie');
        res.json({ id: info.lastInsertRowid });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// PATCH Update Status
app.patch('/api/movies/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const stmt = db.prepare('UPDATE movies SET status = ? WHERE id = ?');
        stmt.run(status, id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE Soft Delete
app.delete('/api/movies/:id', (req, res) => {
    try {
        const { id } = req.params;
        const stmt = db.prepare('UPDATE movies SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?');
        stmt.run(id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST Bulk Soft Delete
app.post('/api/movies/bulk-delete', (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
        const stmt = db.prepare('UPDATE movies SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?');
        const transaction = db.transaction((ids) => {
            for (const id of ids) stmt.run(id);
        });
        transaction(ids);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// RESTORE
app.post('/api/movies/:id/restore', (req, res) => {
    try {
        const { id } = req.params;
        const stmt = db.prepare('UPDATE movies SET deleted_at = NULL WHERE id = ?');
        stmt.run(id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST Bulk Restore
app.post('/api/movies/bulk-restore', (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
        const stmt = db.prepare('UPDATE movies SET deleted_at = NULL WHERE id = ?');
        const transaction = db.transaction((ids) => {
            for (const id of ids) stmt.run(id);
        });
        transaction(ids);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PERMANENT DELETE (Trash)
app.delete('/api/trash/:id', (req, res) => {
    try {
        const { id } = req.params;
        const stmt = db.prepare('DELETE FROM movies WHERE id = ?');
        stmt.run(id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// EMPTY TRASH / Bulk Permanent Delete
app.delete('/api/trash', (req, res) => {
    try {
        const ids = req.body?.ids;
        // Optional: if ids provided, delete those. Else delete all > 30 days or all trash? User asked for empty trash and auto 30 days.
        // If clean=true, delete older than 30 days. If ids provided diff logic.
        // Let's implement "Empty All"

        let stmt;
        if (ids && Array.isArray(ids)) {
            stmt = db.prepare('DELETE FROM movies WHERE id = ?');
            const transaction = db.transaction((ids) => {
                for (const id of ids) stmt.run(id);
            });
            transaction(ids);
        } else {
            // Empty whole trash
            stmt = db.prepare('DELETE FROM movies WHERE deleted_at IS NOT NULL');
            stmt.run();
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// IMPORT URL Direct (Scrape & Save)
app.post('/api/movies/import', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url || !isHdrezkaUrl(url)) return res.status(400).json({ error: 'Valid HDRezka URL required' });

        // Check duplicates first to avoid scrape
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
            INSERT INTO movies (title, original_title, year, link, rating, description, poster_url, genres, actors, director, writers, type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const info = stmt.run(
            details.title, details.original_title, details.year, url, details.rating,
            details.description, details.poster_url, details.genres, details.actors, details.director, details.writers,
            details.type || 'movie'
        );

        res.json({ id: info.lastInsertRowid, title: details.title });
    } catch (error) {
        console.error('Import failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// REFRESH DATA
app.post('/api/movies/refresh', async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });

        // Get links for these IDs
        const getLinksStmt = db.prepare('SELECT id, link FROM movies WHERE id IN (' + ids.map(() => '?').join(',') + ')');
        const movies = getLinksStmt.all(...ids);

        const updateStmt = db.prepare(`
            UPDATE movies SET 
                title = ?, year = ?, rating = ?, description = ?, poster_url = ?, genres = ?, actors = ?, director = ?, writers = ?, type = ?
            WHERE id = ?
                `);

        // We process sequentially to be nice to scraper target
        for (const movie of movies) {
            if (!movie.link) continue;
            try {
                const details = await getMovieDetails(movie.link);
                updateStmt.run(
                    details.title, details.year, details.rating, details.description,
                    details.poster_url, details.genres, details.actors, details.director, details.writers,
                    details.type || 'movie',
                    movie.id
                );
            } catch (err) {
                console.error(`Failed to refresh movie ${movie.id}: `, err.message);
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Refresh failed' });
    }
});

// ==========================================
// COLLECTIONS ENDPOINTS
// ==========================================

// GET all collections
app.get('/api/collections', (req, res) => {
    try {
        const stmt = db.prepare(`
            SELECT c.*, COUNT(cm.movie_id) as movie_count 
            FROM collections c 
            LEFT JOIN collection_movies cm ON c.id = cm.collection_id 
            GROUP BY c.id
            ORDER BY c.created_at DESC
        `);
        const collections = stmt.all();
        res.json(collections);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET specific collection with movies
app.get('/api/collections/:id', (req, res) => {
    try {
        const { id } = req.params;
        const collectionStmt = db.prepare('SELECT * FROM collections WHERE id = ?');
        const collection = collectionStmt.get(id);
        if (!collection) return res.status(404).json({ error: 'Collection not found' });

        const moviesStmt = db.prepare(`
            SELECT m.* FROM movies m
            JOIN collection_movies cm ON m.id = cm.movie_id
            WHERE cm.collection_id = ? AND m.deleted_at IS NULL
            ORDER BY m.created_at DESC
        `);
        const movies = moviesStmt.all(id);
        res.json({ ...collection, movies });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST create collection
app.post('/api/collections', (req, res) => {
    try {
        const { title, description, movieIds } = req.body;
        if (!title) return res.status(400).json({ error: 'Title is required' });

        const insertColl = db.prepare('INSERT INTO collections (title, description) VALUES (?, ?)');
        const insertMovie = db.prepare('INSERT INTO collection_movies (collection_id, movie_id) VALUES (?, ?)');

        const runTransaction = db.transaction((title, description, movieIds) => {
            const info = insertColl.run(title, description || '');
            const collectionId = info.lastInsertRowid;
            if (movieIds && Array.isArray(movieIds)) {
                for (const movieId of movieIds) {
                    insertMovie.run(collectionId, movieId);
                }
            }
            return collectionId;
        });

        const collectionId = runTransaction(title, description, movieIds);
        res.json({ id: collectionId, success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE collection
app.delete('/api/collections/:id', (req, res) => {
    try {
        const { id } = req.params;
        db.prepare('DELETE FROM collection_movies WHERE collection_id = ?').run(id);
        db.prepare('DELETE FROM collections WHERE id = ?').run(id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST add movies to collection
app.post('/api/collections/:id/movies', (req, res) => {
    try {
        const { id } = req.params;
        const { movieIds } = req.body;
        if (!movieIds || !Array.isArray(movieIds)) return res.status(400).json({ error: 'movieIds array required' });

        const insertMovie = db.prepare('INSERT OR IGNORE INTO collection_movies (collection_id, movie_id) VALUES (?, ?)');
        const runTransaction = db.transaction((id, movieIds) => {
            for (const movieId of movieIds) {
                insertMovie.run(id, movieId);
            }
        });
        runTransaction(id, movieIds);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE remove a movie from collection
app.delete('/api/collections/:id/movies/:movieId', (req, res) => {
    try {
        const { id, movieId } = req.params;
        db.prepare('DELETE FROM collection_movies WHERE collection_id = ? AND movie_id = ?').run(id, movieId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


async function startApp() {
    // 1. Download database backup on startup if Supabase URL and Key are provided
    if (supabaseUrl && supabaseKey) {
        console.log('☁️ Checking for database backup on Supabase...');
        try {
            const res = await fetch(`${supabaseUrl}/storage/v1/object/authenticated/backups/movies.db`, {
                headers: { 'Authorization': `Bearer ${supabaseKey}` }
            });
            if (res.status === 200) {
                const buffer = await res.arrayBuffer();
                fs.writeFileSync(dbPath, Buffer.from(buffer));
                console.log('☁️ Database backup successfully downloaded and restored!');
            } else if (res.status === 404) {
                console.log('☁️ No backup found in Supabase. A new database will be created.');
            } else {
                console.error(`☁️ Supabase download failed with status ${res.status}:`, await res.text());
            }
        } catch (err) {
            console.error('☁️ Error downloading database backup:', err);
        }
    } else {
        console.log('☁️ Supabase credentials not found. Running with local database only.');
    }

    // 2. Load database module dynamically after backup is ready
    const dbModule = require('./db');
    db = dbModule.db;
    initDb = dbModule.initDb;
    initDb();

    // 3. Auto-cleanup trash older than 30 days
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const cleanupRes = db.prepare('DELETE FROM movies WHERE deleted_at IS NOT NULL AND deleted_at < ?').run(thirtyDaysAgo.toISOString());
        if (cleanupRes.changes > 0) console.log(`Cleaned up ${cleanupRes.changes} old items from trash.`);
    } catch (err) {
        console.error('Cleanup error:', err);
    }

    // 4. Start the server
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

startApp();

