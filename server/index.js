const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { searchMovies, getMovieDetails, getCategoryMovies } = require('./scraper');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Cloud Sync Configuration (Supabase)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const dbPath = path.join(__dirname, 'movies.db');

const JWT_SECRET = process.env.JWT_SECRET || 'movie_watcher_super_secret_key_12345';

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

// ==========================================
// AUTHENTICATION MIDDLEWARE & ENDPOINTS
// ==========================================

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Authentication token required' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token' });
        req.user = user;
        next();
    });
}

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

        const trimmedUser = username.trim().toLowerCase();
        if (trimmedUser.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' });
        if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

        const checkUser = db.prepare('SELECT id FROM users WHERE username = ?').get(trimmedUser);
        if (checkUser) return res.status(409).json({ error: 'Username is already taken' });

        const passwordHash = await bcrypt.hash(password, 10);
        const stmt = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
        const info = stmt.run(trimmedUser, passwordHash);
        const userId = info.lastInsertRowid;

        // Auto-assign any existing orphaned movies or collections (user_id IS NULL) to the first registered user!
        try {
            db.prepare('UPDATE movies SET user_id = ? WHERE user_id IS NULL').run(userId);
            db.prepare('UPDATE collections SET user_id = ? WHERE user_id IS NULL').run(userId);
            console.log(`☁️ Assigned orphaned movies/collections to first user: ${trimmedUser}`);
        } catch (e) {
            console.error('Migration update failed:', e);
        }

        const token = jwt.sign({ id: userId, username: trimmedUser }, JWT_SECRET, { expiresIn: '30d' });
        res.json({ token, user: { id: userId, username: trimmedUser } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

        const trimmedUser = username.trim().toLowerCase();
        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(trimmedUser);
        if (!user) return res.status(401).json({ error: 'Invalid username or password' });

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(401).json({ error: 'Invalid username or password' });

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
        res.json({ token, user: { id: user.id, username: user.username } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Current User (Me)
app.get('/api/auth/me', authenticateToken, (req, res) => {
    res.json({ user: req.user });
});

// Helper: Check if URL is HDRezka
const isHdrezkaUrl = (str) => {
    return str.toLowerCase().includes('hdrezka') && (str.startsWith('http://') || str.startsWith('https://'));
};

// Search / Parse Endpoint
app.post('/api/movies/search', authenticateToken, async (req, res) => {
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
app.get('/api/movies/category/:filter', authenticateToken, async (req, res) => {
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

// ==========================================
// CRUD MOVIE ENDPOINTS (USER SCOPED)
// ==========================================

// GET Active Movies
app.get('/api/movies', authenticateToken, (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM movies WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC');
        const movies = stmt.all(req.user.id);
        res.json(movies);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET Trash
app.get('/api/trash', authenticateToken, (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM movies WHERE user_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC');
        const movies = stmt.all(req.user.id);
        res.json(movies);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET All Unique Genres
app.get('/api/genres', authenticateToken, (req, res) => {
    try {
        const stmt = db.prepare('SELECT genres FROM movies WHERE user_id = ? AND deleted_at IS NULL');
        const rows = stmt.all(req.user.id);
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
        const sortedGenres = Object.entries(genreCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([genre]) => genre);

        res.json(sortedGenres);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST Add Movie
app.post('/api/movies', authenticateToken, (req, res) => {
    try {
        const { title, original_title, year, link, rating, description, poster_url, genres, actors, director, writers, type } = req.body;

        // Check if exists for this user (restore if deleted)
        const checkStmt = db.prepare('SELECT id, deleted_at FROM movies WHERE link = ? AND user_id = ?');
        const existing = checkStmt.get(link, req.user.id);
        if (existing) {
            if (existing.deleted_at) {
                db.prepare('UPDATE movies SET deleted_at = NULL WHERE id = ? AND user_id = ?').run(existing.id, req.user.id);
                return res.json({ id: existing.id, restored: true });
            }
            return res.status(409).json({ error: 'Movie already exists in your list' });
        }

        const stmt = db.prepare(`
          INSERT INTO movies (title, original_title, year, link, rating, description, poster_url, genres, actors, director, writers, type, user_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const info = stmt.run(title, original_title, year, link, rating, description, poster_url, genres, actors, director, writers, type || 'movie', req.user.id);
        res.json({ id: info.lastInsertRowid });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// PATCH Update Status
app.patch('/api/movies/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const stmt = db.prepare('UPDATE movies SET status = ? WHERE id = ? AND user_id = ?');
        const result = stmt.run(status, id, req.user.id);
        if (result.changes === 0) return res.status(404).json({ error: 'Movie not found or unauthorized' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE Soft Delete
app.delete('/api/movies/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const stmt = db.prepare('UPDATE movies SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?');
        const result = stmt.run(id, req.user.id);
        if (result.changes === 0) return res.status(404).json({ error: 'Movie not found or unauthorized' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST Bulk Soft Delete
app.post('/api/movies/bulk-delete', authenticateToken, (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
        const stmt = db.prepare('UPDATE movies SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?');
        const transaction = db.transaction((ids) => {
            for (const id of ids) stmt.run(id, req.user.id);
        });
        transaction(ids);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// RESTORE
app.post('/api/movies/:id/restore', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const stmt = db.prepare('UPDATE movies SET deleted_at = NULL WHERE id = ? AND user_id = ?');
        const result = stmt.run(id, req.user.id);
        if (result.changes === 0) return res.status(404).json({ error: 'Movie not found or unauthorized' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST Bulk Restore
app.post('/api/movies/bulk-restore', authenticateToken, (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
        const stmt = db.prepare('UPDATE movies SET deleted_at = NULL WHERE id = ? AND user_id = ?');
        const transaction = db.transaction((ids) => {
            for (const id of ids) stmt.run(id, req.user.id);
        });
        transaction(ids);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PERMANENT DELETE (Trash)
app.delete('/api/trash/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const stmt = db.prepare('DELETE FROM movies WHERE id = ? AND user_id = ?');
        const result = stmt.run(id, req.user.id);
        if (result.changes === 0) return res.status(404).json({ error: 'Movie not found or unauthorized' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// EMPTY TRASH / Bulk Permanent Delete
app.delete('/api/trash', authenticateToken, (req, res) => {
    try {
        const ids = req.body?.ids;
        if (ids && Array.isArray(ids)) {
            const stmt = db.prepare('DELETE FROM movies WHERE id = ? AND user_id = ?');
            const transaction = db.transaction((ids) => {
                for (const id of ids) stmt.run(id, req.user.id);
            });
            transaction(ids);
        } else {
            const stmt = db.prepare('DELETE FROM movies WHERE deleted_at IS NOT NULL AND user_id = ?');
            stmt.run(req.user.id);
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// IMPORT URL Direct (Scrape & Save)
app.post('/api/movies/import', authenticateToken, async (req, res) => {
    try {
        const { url } = req.body;
        if (!url || !isHdrezkaUrl(url)) return res.status(400).json({ error: 'Valid HDRezka URL required' });

        // Check duplicates for this user
        const checkStmt = db.prepare('SELECT id, deleted_at FROM movies WHERE link = ? AND user_id = ?');
        const existing = checkStmt.get(url, req.user.id);

        if (existing) {
            if (existing.deleted_at) {
                db.prepare('UPDATE movies SET deleted_at = NULL WHERE id = ? AND user_id = ?').run(existing.id, req.user.id);
                return res.json({ id: existing.id, restored: true, title: 'Restored from trash' });
            }
            return res.status(409).json({ error: 'Movie already exists in your list' });
        }

        const details = await getMovieDetails(url);
        if (!details) return res.status(404).json({ error: 'Could not parse movie details' });

        const stmt = db.prepare(`
            INSERT INTO movies (title, original_title, year, link, rating, description, poster_url, genres, actors, director, writers, type, user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const info = stmt.run(
            details.title, details.original_title, details.year, url, details.rating,
            details.description, details.poster_url, details.genres, details.actors, details.director, details.writers,
            details.type || 'movie', req.user.id
        );

        res.json({ id: info.lastInsertRowid, title: details.title });
    } catch (error) {
        console.error('Import failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// REFRESH DATA
app.post('/api/movies/refresh', authenticateToken, async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });

        // Get links for these IDs belonging to the logged-in user
        const getLinksStmt = db.prepare('SELECT id, link FROM movies WHERE id IN (' + ids.map(() => '?').join(',') + ') AND user_id = ?');
        const movies = getLinksStmt.all(...ids, req.user.id);

        const updateStmt = db.prepare(`
            UPDATE movies SET 
                title = ?, year = ?, rating = ?, description = ?, poster_url = ?, genres = ?, actors = ?, director = ?, writers = ?, type = ?
            WHERE id = ? AND user_id = ?
        `);

        for (const movie of movies) {
            if (!movie.link) continue;
            try {
                const details = await getMovieDetails(movie.link);
                updateStmt.run(
                    details.title, details.year, details.rating, details.description,
                    details.poster_url, details.genres, details.actors, details.director, details.writers,
                    details.type || 'movie',
                    movie.id, req.user.id
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
// COLLECTIONS ENDPOINTS (USER SCOPED / PUBLIC DISCOVERY)
// ==========================================

// GET all collections
app.get('/api/collections', authenticateToken, (req, res) => {
    try {
        const stmt = db.prepare(`
            SELECT c.*, COUNT(cm.movie_id) as movie_count 
            FROM collections c 
            LEFT JOIN collection_movies cm ON c.id = cm.collection_id 
            WHERE c.user_id = ?
            GROUP BY c.id
            ORDER BY c.created_at DESC
        `);
        const collections = stmt.all(req.user.id);
        res.json(collections);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET specific collection with movies (PUBLIC! Required for Shared view)
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
app.post('/api/collections', authenticateToken, (req, res) => {
    try {
        const { title, description, movieIds } = req.body;
        if (!title) return res.status(400).json({ error: 'Title is required' });

        const insertColl = db.prepare('INSERT INTO collections (title, description, user_id) VALUES (?, ?, ?)');
        const insertMovie = db.prepare('INSERT INTO collection_movies (collection_id, movie_id) VALUES (?, ?)');

        const runTransaction = db.transaction((title, description, movieIds) => {
            const info = insertColl.run(title, description || '', req.user.id);
            const collectionId = info.lastInsertRowid;
            if (movieIds && Array.isArray(movieIds)) {
                // Ensure only movies belonging to this user are added
                const checkStmt = db.prepare('SELECT id FROM movies WHERE id = ? AND user_id = ?');
                for (const movieId of movieIds) {
                    const isOwnMovie = checkStmt.get(movieId, req.user.id);
                    if (isOwnMovie) {
                        insertMovie.run(collectionId, movieId);
                    }
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
app.delete('/api/collections/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const check = db.prepare('DELETE FROM collections WHERE id = ? AND user_id = ?').run(id, req.user.id);
        if (check.changes === 0) return res.status(403).json({ error: 'Access denied or not found' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST add movies to collection
app.post('/api/collections/:id/movies', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const { movieIds } = req.body;
        if (!movieIds || !Array.isArray(movieIds)) return res.status(400).json({ error: 'movieIds array required' });

        const checkColl = db.prepare('SELECT id FROM collections WHERE id = ? AND user_id = ?').get(id, req.user.id);
        if (!checkColl) return res.status(403).json({ error: 'Access denied or collection not found' });

        const insertMovie = db.prepare('INSERT OR IGNORE INTO collection_movies (collection_id, movie_id) VALUES (?, ?)');
        const checkMovie = db.prepare('SELECT id FROM movies WHERE id = ? AND user_id = ?');

        const runTransaction = db.transaction((id, movieIds) => {
            for (const movieId of movieIds) {
                const isOwnMovie = checkMovie.get(movieId, req.user.id);
                if (isOwnMovie) {
                    insertMovie.run(id, movieId);
                }
            }
        });
        runTransaction(id, movieIds);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE remove a movie from collection
app.delete('/api/collections/:id/movies/:movieId', authenticateToken, (req, res) => {
    try {
        const { id, movieId } = req.params;
        const checkColl = db.prepare('SELECT id FROM collections WHERE id = ? AND user_id = ?').get(id, req.user.id);
        if (!checkColl) return res.status(403).json({ error: 'Access denied or collection not found' });

        db.prepare('DELETE FROM collection_movies WHERE collection_id = ? AND movie_id = ?').run(id, movieId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// LIFECYCLE & SERVER START
// ==========================================

async function startApp() {
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

    const dbModule = require('./db');
    db = dbModule.db;
    initDb = dbModule.initDb;
    initDb();

    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const cleanupRes = db.prepare('DELETE FROM movies WHERE deleted_at IS NOT NULL AND deleted_at < ?').run(thirtyDaysAgo.toISOString());
        if (cleanupRes.changes > 0) console.log(`Cleaned up ${cleanupRes.changes} old items from trash.`);
    } catch (err) {
        console.error('Cleanup error:', err);
    }

    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

startApp();
