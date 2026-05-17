require('dotenv').config();
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

// Sync Status Tracking
let lastSyncStatus = 'Not Started';
let lastSyncTime = null;
let lastSyncError = null;

async function uploadBackup() {
    if (!supabaseUrl || !supabaseKey) {
        lastSyncStatus = 'Unconfigured';
        lastSyncError = 'Supabase credentials missing in environment variables';
        return;
    }
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
                lastSyncStatus = 'Success';
                lastSyncTime = new Date().toISOString();
                lastSyncError = null;
            } else {
                const errBody = await res.text();
                console.error(`☁️ Supabase upload failed with status ${res.status}:`, errBody);
                
                if (errBody.includes('Bucket not found')) {
                    console.log('☁️ "backups" bucket not found. Attempting to create it automatically...');
                    try {
                        const createBucketRes = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${supabaseKey}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                id: 'backups',
                                name: 'backups',
                                public: false
                            })
                        });
                        
                        if (createBucketRes.ok) {
                            console.log('☁️ "backups" bucket successfully created! Retrying upload...');
                            const retryRes = await fetch(`${supabaseUrl}/storage/v1/object/backups/movies.db`, {
                                method: 'POST',
                                body: fileBuffer,
                                headers: {
                                    'Authorization': `Bearer ${supabaseKey}`,
                                    'Content-Type': 'application/x-sqlite3',
                                    'x-upsert': 'true'
                                }
                            });
                            
                            if (retryRes.ok) {
                                console.log('☁️ Database backup successfully uploaded after auto-creating bucket!');
                                lastSyncStatus = 'Success';
                                lastSyncTime = new Date().toISOString();
                                lastSyncError = null;
                                isUploading = false;
                                return;
                            } else {
                                const retryErr = await retryRes.text();
                                throw new Error(`Retry upload failed: ${retryErr}`);
                            }
                        } else {
                            const createErr = await createBucketRes.text();
                            throw new Error(`Failed to auto-create bucket: ${createErr}`);
                        }
                    } catch (createErr) {
                        console.error('☁️ Auto-creating bucket failed:', createErr);
                        lastSyncStatus = 'Failed';
                        lastSyncTime = new Date().toISOString();
                        lastSyncError = `Bucket creation & upload retry failed: ${createErr.message}`;
                        isUploading = false;
                        return;
                    }
                }

                lastSyncStatus = 'Failed';
                lastSyncTime = new Date().toISOString();
                lastSyncError = `Upload failed with status ${res.status}: ${errBody}`;
            }
        } catch (err) {
            console.error('☁️ Error uploading database backup:', err);
            lastSyncStatus = 'Failed';
            lastSyncTime = new Date().toISOString();
            lastSyncError = err.message;
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
        
        // Verify that the user still exists in the database
        const dbUser = db.prepare('SELECT id FROM users WHERE id = ?').get(user.id);
        if (!dbUser) {
            return res.status(401).json({ error: 'User session has expired or account was reset. Please log in again.' });
        }
        
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
        const stmt = db.prepare(`
            SELECT m.*, 
                   (
                     -- Community rating: average from movies table (active/deleted) + history table, excluding current user
                     SELECT ROUND(AVG(r), 1) FROM (
                       SELECT m2.user_rating AS r FROM movies m2
                         WHERE m2.link = m.link AND m2.user_rating IS NOT NULL AND m2.user_id != m.user_id
                       UNION ALL
                       SELECT h.user_rating AS r FROM user_movie_history h
                         WHERE h.movie_link = m.link AND h.user_rating IS NOT NULL AND h.user_id != m.user_id
                         AND h.user_id NOT IN (SELECT user_id FROM movies WHERE link = m.link AND user_rating IS NOT NULL)
                     )
                   ) AS community_rating
            FROM movies m 
            WHERE m.user_id = ? AND m.deleted_at IS NULL 
            ORDER BY m.created_at DESC
        `);
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

        // Check if exists for this user (restore if soft-deleted)
        const checkStmt = db.prepare('SELECT id, deleted_at FROM movies WHERE link = ? AND user_id = ?');
        const existing = checkStmt.get(link, req.user.id);
        if (existing) {
            if (existing.deleted_at) {
                // Restore the soft-deleted row and sync back any saved history
                const history = db.prepare('SELECT user_rating, notes, notes_public FROM user_movie_history WHERE user_id = ? AND movie_link = ?').get(req.user.id, link);
                if (history) {
                    db.prepare('UPDATE movies SET deleted_at = NULL, user_rating = ?, notes = ?, notes_public = ? WHERE id = ? AND user_id = ?')
                        .run(history.user_rating, history.notes, history.notes_public, existing.id, req.user.id);
                } else {
                    db.prepare('UPDATE movies SET deleted_at = NULL WHERE id = ? AND user_id = ?').run(existing.id, req.user.id);
                }
                return res.json({ id: existing.id, restored: true });
            }
            return res.status(409).json({ error: 'Movie already exists in your list' });
        }

        // Check if user has history for this movie link (previously rated/noted before permanent delete)
        const history = db.prepare('SELECT user_rating, notes, notes_public FROM user_movie_history WHERE user_id = ? AND movie_link = ?').get(req.user.id, link);

        const stmt = db.prepare(`
          INSERT INTO movies (title, original_title, year, link, rating, description, poster_url, genres, actors, director, writers, type, user_id, user_rating, notes, notes_public)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const info = stmt.run(
            title, original_title, year, link, rating, description, poster_url,
            genres, actors, director, writers, type || 'movie', req.user.id,
            history?.user_rating ?? null,
            history?.notes ?? null,
            history?.notes_public ?? 0
        );
        res.json({ id: info.lastInsertRowid, restored_history: !!history });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// PATCH Update Movie (Status, Notes, Notes Public status, and User Rating)
app.patch('/api/movies/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes, notes_public, user_rating } = req.body;
        
        // Dynamically build fields to update
        const fields = [];
        const values = [];
        
        if (status !== undefined) {
            fields.push('status = ?');
            values.push(status);
        }
        if (notes !== undefined) {
            fields.push('notes = ?');
            values.push(notes);
        }
        if (notes_public !== undefined) {
            fields.push('notes_public = ?');
            values.push(notes_public ? 1 : 0);
        }
        if (user_rating !== undefined) {
            fields.push('user_rating = ?');
            values.push(user_rating);
        }
        
        if (fields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        
        values.push(id, req.user.id);
        const query = `UPDATE movies SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`;
        const stmt = db.prepare(query);
        const result = stmt.run(...values);
        
        if (result.changes === 0) return res.status(404).json({ error: 'Movie not found or unauthorized' });

        // --- Persist rating/notes to history table (survives movie deletion) ---
        if (user_rating !== undefined || notes !== undefined || notes_public !== undefined) {
            const movie = db.prepare('SELECT link, user_rating, notes, notes_public FROM movies WHERE id = ? AND user_id = ?').get(id, req.user.id);
            if (movie && movie.link) {
                db.prepare(`
                    INSERT INTO user_movie_history (user_id, movie_link, user_rating, notes, notes_public, updated_at)
                    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(user_id, movie_link) DO UPDATE SET
                        user_rating = COALESCE(excluded.user_rating, user_movie_history.user_rating),
                        notes = COALESCE(excluded.notes, user_movie_history.notes),
                        notes_public = excluded.notes_public,
                        updated_at = CURRENT_TIMESTAMP
                `).run(req.user.id, movie.link, movie.user_rating, movie.notes, movie.notes_public);
            }
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET public reviews/comments for a specific movie link
app.get('/api/reviews', (req, res) => {
    try {
        const { movie_link } = req.query;
        if (!movie_link) return res.status(400).json({ error: 'movie_link query parameter is required' });

        const stmt = db.prepare('SELECT id, username, content, created_at FROM movie_reviews WHERE movie_link = ? ORDER BY created_at DESC');
        const reviews = stmt.all(movie_link);
        res.json(reviews);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST write a public review for a movie link
app.post('/api/reviews', authenticateToken, (req, res) => {
    try {
        const { movie_link, content } = req.body;
        if (!movie_link || !content || !content.trim()) {
            return res.status(400).json({ error: 'movie_link and content are required' });
        }

        // Get fresh username
        const user = db.prepare('SELECT username FROM users WHERE id = ?').get(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const stmt = db.prepare('INSERT INTO movie_reviews (user_id, username, movie_link, content) VALUES (?, ?, ?, ?)');
        const info = stmt.run(req.user.id, user.username, movie_link, content.trim());

        res.json({
            id: info.lastInsertRowid,
            username: user.username,
            content: content.trim(),
            created_at: new Date().toISOString(),
            success: true
        });
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

// PERMANENT DELETE (Trash) — backfills history first so ratings/notes are never lost
app.delete('/api/trash/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        // Save rating/notes to history before permanent deletion
        const movie = db.prepare('SELECT link, user_rating, notes, notes_public FROM movies WHERE id = ? AND user_id = ?').get(id, req.user.id);
        if (movie && movie.link && (movie.user_rating !== null || movie.notes)) {
            db.prepare(`
                INSERT INTO user_movie_history (user_id, movie_link, user_rating, notes, notes_public, updated_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id, movie_link) DO UPDATE SET
                    user_rating = COALESCE(excluded.user_rating, user_movie_history.user_rating),
                    notes = COALESCE(excluded.notes, user_movie_history.notes),
                    notes_public = excluded.notes_public,
                    updated_at = CURRENT_TIMESTAMP
            `).run(req.user.id, movie.link, movie.user_rating, movie.notes, movie.notes_public);
        }
        const result = db.prepare('DELETE FROM movies WHERE id = ? AND user_id = ?').run(id, req.user.id);
        if (result.changes === 0) return res.status(404).json({ error: 'Movie not found or unauthorized' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// EMPTY TRASH / Bulk Permanent Delete — backfills history first
app.delete('/api/trash', authenticateToken, (req, res) => {
    try {
        const ids = req.body?.ids;
        const backfillStmt = db.prepare(`
            INSERT INTO user_movie_history (user_id, movie_link, user_rating, notes, notes_public, updated_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, movie_link) DO UPDATE SET
                user_rating = COALESCE(excluded.user_rating, user_movie_history.user_rating),
                notes = COALESCE(excluded.notes, user_movie_history.notes),
                notes_public = excluded.notes_public,
                updated_at = CURRENT_TIMESTAMP
        `);
        if (ids && Array.isArray(ids)) {
            const transaction = db.transaction((ids) => {
                for (const id of ids) {
                    const movie = db.prepare('SELECT link, user_rating, notes, notes_public FROM movies WHERE id = ? AND user_id = ?').get(id, req.user.id);
                    if (movie && movie.link && (movie.user_rating !== null || movie.notes)) {
                        backfillStmt.run(req.user.id, movie.link, movie.user_rating, movie.notes, movie.notes_public);
                    }
                    db.prepare('DELETE FROM movies WHERE id = ? AND user_id = ?').run(id, req.user.id);
                }
            });
            transaction(ids);
        } else {
            // Empty all trash — backfill all
            const trashedMovies = db.prepare('SELECT link, user_rating, notes, notes_public FROM movies WHERE deleted_at IS NOT NULL AND user_id = ?').all(req.user.id);
            const transaction = db.transaction(() => {
                for (const movie of trashedMovies) {
                    if (movie.link && (movie.user_rating !== null || movie.notes)) {
                        backfillStmt.run(req.user.id, movie.link, movie.user_rating, movie.notes, movie.notes_public);
                    }
                }
                db.prepare('DELETE FROM movies WHERE deleted_at IS NOT NULL AND user_id = ?').run(req.user.id);
            });
            transaction();
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
        let collection;
        
        // Support backward compatibility (numeric ID) and secure share tokens (hex string)
        const isNumeric = /^\d+$/.test(id);
        if (isNumeric) {
            collection = db.prepare('SELECT * FROM collections WHERE id = ?').get(id);
        } else {
            collection = db.prepare('SELECT * FROM collections WHERE share_token = ?').get(id);
        }
        
        if (!collection) return res.status(404).json({ error: 'Collection not found' });

        const moviesStmt = db.prepare(`
            SELECT m.*,
                   (
                     SELECT ROUND(AVG(r), 1) FROM (
                       SELECT m2.user_rating AS r FROM movies m2
                         WHERE m2.link = m.link AND m2.user_rating IS NOT NULL AND m2.user_id != m.user_id
                       UNION ALL
                       SELECT h.user_rating AS r FROM user_movie_history h
                         WHERE h.movie_link = m.link AND h.user_rating IS NOT NULL AND h.user_id != m.user_id
                         AND h.user_id NOT IN (SELECT user_id FROM movies WHERE link = m.link AND user_rating IS NOT NULL)
                     )
                   ) AS community_rating
            FROM movies m
            JOIN collection_movies cm ON m.id = cm.movie_id
            WHERE cm.collection_id = ? AND m.deleted_at IS NULL
            ORDER BY m.created_at DESC
        `);
        const movies = moviesStmt.all(collection.id).map(movie => {
            // Mask private notes for guests viewing a shared collection!
            if (!movie.notes_public) {
                movie.notes = null;
            }
            return movie;
        });
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

        const crypto = require('crypto');
        const shareToken = crypto.randomBytes(12).toString('hex');

        const insertColl = db.prepare('INSERT INTO collections (title, description, user_id, share_token) VALUES (?, ?, ?, ?)');
        const insertMovie = db.prepare('INSERT INTO collection_movies (collection_id, movie_id) VALUES (?, ?)');

        const runTransaction = db.transaction((title, description, movieIds, shareToken) => {
            const info = insertColl.run(title, description || '', req.user.id, shareToken);
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

        const collectionId = runTransaction(title, description, movieIds, shareToken);
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

// POST share collection with another user by username
app.post('/api/collections/:id/share', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const { username } = req.body;

        if (!username) return res.status(400).json({ error: 'Username is required' });

        const recipientUser = username.trim().toLowerCase();
        const recipient = db.prepare('SELECT id FROM users WHERE username = ?').get(recipientUser);
        if (!recipient) return res.status(404).json({ error: `User "${username}" not found` });

        if (recipient.id === req.user.id) {
            return res.status(400).json({ error: 'You cannot share a collection with yourself' });
        }

        // Verify sender owns the collection
        const collection = db.prepare('SELECT id FROM collections WHERE id = ? AND user_id = ?').get(id, req.user.id);
        if (!collection) return res.status(403).json({ error: 'Collection not found or access denied' });

        // Check if already shared
        const existingShare = db.prepare('SELECT 1 FROM shared_collections WHERE collection_id = ? AND recipient_id = ?').get(id, recipient.id);
        if (existingShare) {
            return res.status(409).json({ error: `Collection is already shared with ${username}` });
        }

        db.prepare('INSERT INTO shared_collections (collection_id, sender_id, recipient_id) VALUES (?, ?, ?)').run(id, req.user.id, recipient.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET collections shared with me
app.get('/api/collections-shared-with-me', authenticateToken, (req, res) => {
    try {
        const stmt = db.prepare(`
            SELECT c.*, u.username as sender_username, COUNT(cm.movie_id) as movie_count 
            FROM collections c 
            JOIN shared_collections sc ON c.id = sc.collection_id 
            JOIN users u ON sc.sender_id = u.id 
            LEFT JOIN collection_movies cm ON c.id = cm.collection_id 
            WHERE sc.recipient_id = ?
            GROUP BY c.id
            ORDER BY sc.created_at DESC
        `);
        const collections = stmt.all(req.user.id);
        res.json(collections);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST clone collection (save a copy to own collections)
app.post('/api/collections/:id/clone', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;

        // Get collection
        const originalCollection = db.prepare('SELECT * FROM collections WHERE id = ?').get(id);
        if (!originalCollection) return res.status(404).json({ error: 'Collection not found' });

        // Get all active movies from that collection
        const originalMovies = db.prepare(`
            SELECT m.* FROM movies m
            JOIN collection_movies cm ON m.id = cm.movie_id
            WHERE cm.collection_id = ? AND m.deleted_at IS NULL
        `).all(id);

        const crypto = require('crypto');
        const shareToken = crypto.randomBytes(12).toString('hex');

        const insertColl = db.prepare('INSERT INTO collections (title, description, user_id, share_token) VALUES (?, ?, ?, ?)');
        const insertMovie = db.prepare(`
            INSERT INTO movies (title, original_title, year, link, rating, description, poster_url, genres, actors, director, writers, type, user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const checkMovie = db.prepare('SELECT id, deleted_at FROM movies WHERE link = ? AND user_id = ?');
        const restoreMovie = db.prepare('UPDATE movies SET deleted_at = NULL WHERE id = ?');
        const insertCollMovie = db.prepare('INSERT OR IGNORE INTO collection_movies (collection_id, movie_id) VALUES (?, ?)');

        const runCloneTransaction = db.transaction(() => {
            // Create collection copy
            const title = `Copy of ${originalCollection.title}`;
            const collInfo = insertColl.run(title, originalCollection.description || '', req.user.id, shareToken);
            const newCollectionId = collInfo.lastInsertRowid;

            for (const m of originalMovies) {
                let targetMovieId;
                // Check if recipient already has this movie by link
                const existing = checkMovie.get(m.link, req.user.id);
                if (existing) {
                    if (existing.deleted_at) {
                        restoreMovie.run(existing.id);
                    }
                    targetMovieId = existing.id;
                } else {
                    // Create movie copy for recipient
                    const movieInfo = insertMovie.run(
                        m.title, m.original_title, m.year, m.link, m.rating,
                        m.description, m.poster_url, m.genres, m.actors, m.director, m.writers,
                        m.type || 'movie', req.user.id
                    );
                    targetMovieId = movieInfo.lastInsertRowid;
                }
                // Add to new collection
                insertCollMovie.run(newCollectionId, targetMovieId);
            }
            return newCollectionId;
        });

        const newCollectionId = runCloneTransaction();
        res.json({ id: newCollectionId, success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// ADMIN DASHBOARD ENDPOINTS
// ==========================================

function requireAdmin(req, res, next) {
    if (req.user && req.user.username.toLowerCase() === 'radev') {
        next();
    } else {
        res.status(403).json({ error: 'Access denied: Admin privileges required' });
    }
}

// GET Admin Stats
app.get('/api/admin/stats', authenticateToken, requireAdmin, (req, res) => {
    try {
        const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
        const totalMovies = db.prepare('SELECT COUNT(*) as count FROM movies WHERE deleted_at IS NULL').get().count;
        const totalCollections = db.prepare('SELECT COUNT(*) as count FROM collections').get().count;
        res.json({ totalUsers, totalMovies, totalCollections });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET Admin Users list
app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
    try {
        const users = db.prepare(`
            SELECT 
                u.id, 
                u.username, 
                u.created_at,
                (SELECT COUNT(*) FROM movies m WHERE m.user_id = u.id AND m.deleted_at IS NULL) as movie_count,
                (SELECT COUNT(*) FROM collections c WHERE c.user_id = u.id) as collection_count
            FROM users u
            ORDER BY u.created_at DESC
        `).all();
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET detailed user data for Admin
app.get('/api/admin/users/:userId/data', authenticateToken, requireAdmin, (req, res) => {
    try {
        const { userId } = req.params;
        const movies = db.prepare('SELECT * FROM movies WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC').all(userId);
        const collections = db.prepare(`
            SELECT c.*, COUNT(cm.movie_id) as movie_count 
            FROM collections c 
            LEFT JOIN collection_movies cm ON c.id = cm.collection_id 
            WHERE c.user_id = ?
            GROUP BY c.id
            ORDER BY c.created_at DESC
        `).all(userId);
        res.json({ movies, collections });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET Admin sync status with Supabase
app.get('/api/admin/sync-status', authenticateToken, requireAdmin, (req, res) => {
    res.json({
        status: lastSyncStatus,
        time: lastSyncTime,
        error: lastSyncError,
        supabaseConfigured: !!(supabaseUrl && supabaseKey)
    });
});

// POST Admin reset password for a user
app.post('/api/admin/users/:userId/reset-password', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { newPassword } = req.body;
        
        const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        if (user.username.toLowerCase() === 'radev') {
            return res.status(400).json({ error: 'You cannot reset the admin password from this panel' });
        }
        
        const passwordToSet = newPassword ? newPassword.trim() : 'Reset123!';
        if (passwordToSet.length < 3) return res.status(400).json({ error: 'Password must be at least 3 characters long' });
        
        const hash = await bcrypt.hash(passwordToSet, 10);
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, userId);
        
        res.json({ success: true, newPassword: passwordToSet, message: `Password for @${user.username} has been reset.` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE Admin delete user account
app.delete('/api/admin/users/:userId', authenticateToken, requireAdmin, (req, res) => {
    try {
        const { userId } = req.params;
        
        const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        if (user.username.toLowerCase() === 'radev') {
            return res.status(400).json({ error: 'You cannot delete the admin account' });
        }
        
        db.prepare('DELETE FROM users WHERE id = ?').run(userId);
        res.json({ success: true, message: `User @${user.username} has been deleted.` });
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
