require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const sharp = require('sharp');
const { searchMovies, getMovieDetails, getCategoryMovies, getHdrezkaComments, scrapeCatalogPage } = require('./scraper');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

const getClientIp = (req) => {
    return req.headers['x-forwarded-for'] || 
           req.headers['x-real-ip'] || 
           req.socket.remoteAddress || 
           '127.0.0.1';
};

const updateTelemetry = async (userId, req) => {
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';
    
    // Parse OS, Browser, Device from User-Agent
    let os = 'Unknown OS';
    if (userAgent.includes('Windows')) os = 'Windows';
    else if (userAgent.includes('Macintosh') || userAgent.includes('Mac OS')) os = 'macOS';
    else if (userAgent.includes('iPhone')) os = 'iOS (iPhone)';
    else if (userAgent.includes('iPad')) os = 'iOS (iPad)';
    else if (userAgent.includes('Android')) os = 'Android';
    else if (userAgent.includes('Linux')) os = 'Linux';

    let browser = 'Unknown Browser';
    if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) browser = 'Chrome';
    else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browser = 'Safari';
    else if (userAgent.includes('Edg')) browser = 'Edge';
    else if (userAgent.includes('Opera') || userAgent.includes('OPR')) browser = 'Opera';

    let device = 'Desktop';
    if (/Mobile|Android|iPhone|iPad|Tablet/i.test(userAgent)) {
        device = userAgent.includes('iPad') || userAgent.includes('Tablet') ? 'Tablet' : 'Mobile';
    }

    // Quick local checks
    let country = 'Unknown';
    const cleanIp = ip.replace(/^::ffff:/, '');
    if (cleanIp === '127.0.0.1' || cleanIp === '::1') {
        country = '🖥 Localhost';
    } else if (cleanIp.startsWith('192.168.') || cleanIp.startsWith('10.') || cleanIp.startsWith('172.16.') || cleanIp.startsWith('172.31.')) {
        country = '🏠 LAN';
    }

    // Update database immediately with local telemetry
    try {
        db.prepare(`
            UPDATE users 
            SET last_ip = ?, last_device = ?, last_os = ?, last_browser = ?, last_login_at = datetime('now')
            WHERE id = ?
        `).run(cleanIp, device, os, browser, userId);
    } catch (e) {
        console.error('Failed to update basic user telemetry:', e);
    }

    // Non-blocking background IP geolocator if external public IP
    if (country === 'Unknown') {
        axios.get(`http://ip-api.com/json/${cleanIp}?fields=status,country,countryCode`).then(res => {
            if (res.data && res.data.status === 'success') {
                const geoCountry = `${res.data.countryCode === 'UA' ? '🇺🇦' : res.data.countryCode === 'RU' ? '🇷🇺' : res.data.countryCode === 'KZ' ? '🇰🇿' : res.data.countryCode === 'US' ? '🇺🇸' : '🌐'} ${res.data.country}`;
                db.prepare('UPDATE users SET last_country = ? WHERE id = ?').run(geoCountry, userId);
                console.log(`🌐 Geolocated user ${userId} to: ${geoCountry}`);
            } else {
                db.prepare('UPDATE users SET last_country = ? WHERE id = ?').run('🌐 Global User', userId);
            }
        }).catch(err => {
            console.log(`⚠️ Geolocation failed for IP ${cleanIp}: ${err.message}`);
            db.prepare('UPDATE users SET last_country = ? WHERE id = ?').run('🌐 Global User', userId);
        });
    } else {
        try {
            db.prepare('UPDATE users SET last_country = ? WHERE id = ?').run(country, userId);
        } catch (e) {
            console.error('Failed to update country in database:', e);
        }
    }
};

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

        updateTelemetry(userId, req);
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

        updateTelemetry(user.id, req);
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
        res.json({ token, user: { id: user.id, username: user.username } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Guest Auto-Login
app.post('/api/auth/guest', async (req, res) => {
    try {
        const randomId = Math.random().toString(36).substring(2, 9);
        const username = `guest_${randomId}`;
        const password = Math.random().toString(36).substring(2, 15);
        
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        
        const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hash);
        const userId = result.lastInsertRowid;
        
        updateTelemetry(userId, req);
        const token = jwt.sign({ id: userId, username: username }, JWT_SECRET, { expiresIn: '30d' });
        res.json({ token, user: { id: userId, username: username } });
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
    if (!str) return false;
    const lower = str.toLowerCase().trim();
    return lower.includes('rezka') && (lower.startsWith('http://') || lower.startsWith('https://'));
};

// Helper: clean URL paths for domain-agnostic mirroring
const cleanUrlPath = (url) => {
    if (!url) return '';
    return url
        .toLowerCase()
        .replace(/^https?:\/\/[^\/]+/, '') // strip http/https and domain
        .replace(/^\/+|\/+$/g, '')         // strip leading/trailing slashes
        .split('?')[0]                     // strip query params
        .split('#')[0];                    // strip hash
};

// Helper: Save movie details to global cache
const saveToCache = (details) => {
    if (!details || !details.link) return;
    try {
        db.prepare(`
            INSERT INTO scraped_movies_cache (title, original_title, year, link, rating, description, poster_url, genres, actors, director, writers, country, duration, voice_acting, type, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(link) DO UPDATE SET
                title = excluded.title,
                original_title = excluded.original_title,
                year = excluded.year,
                rating = excluded.rating,
                description = excluded.description,
                poster_url = excluded.poster_url,
                genres = excluded.genres,
                actors = excluded.actors,
                director = excluded.director,
                writers = excluded.writers,
                country = excluded.country,
                duration = excluded.duration,
                voice_acting = excluded.voice_acting,
                type = excluded.type,
                updated_at = CURRENT_TIMESTAMP
        `).run(
            details.title, details.original_title, details.year, details.link, details.rating,
            details.description, details.poster_url, details.genres, details.actors, details.director, details.writers,
            details.country, details.duration, details.voice_acting,
            details.type
        );
    } catch (e) {
        console.error('[Cache Save Error]', e.message);
    }
};

// Helper: Trigger background update to keep cache fresh
const triggerBackgroundUpdate = (url) => {
    (async () => {
        try {
            console.log(`[Cache Background Update] Triggered for: ${url}`);
            const latestDetails = await getMovieDetails(url);
            if (latestDetails) {
                saveToCache(latestDetails);
                console.log(`[Cache Background Update] Successfully updated cache for: ${latestDetails.title}`);
            }
        } catch (e) {
            console.error('[Cache Background Update Error]', e.message);
        }
    })();
};

// Get total stats of global website cache
app.get('/api/cache/stats', authenticateToken, (req, res) => {
    try {
        const row = db.prepare('SELECT COUNT(*) as count FROM scraped_movies_cache').get();
        res.json({ totalCached: row.count });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Seedable random number generator (Mulberry32)
function seedRandom(seedStr) {
    let h = 1779033703 ^ seedStr.length;
    for (let i = 0; i < seedStr.length; i++) {
        h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
        h = h << 13 | h >>> 19;
    }
    return function() {
        h = Math.imul(h ^ h >>> 16, 2246822507);
        h = Math.imul(h ^ h >>> 13, 3266489909);
        return ((h ^= h >>> 16) >>> 0) / 4294967296;
    }
}

// Seedable array shuffle
function seedShuffle(array, seed) {
    const rnd = seedRandom(seed);
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Get paginated cache directory for sparse library view
app.get('/api/cache/directory', authenticateToken, (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const seed = req.query.seed || 'default_seed';

        // 1. Fetch all eligible cached movies
        const rows = db.prepare(`
            SELECT title, original_title, year, link, poster_url as img, genres as misc, rating, type, description
            FROM scraped_movies_cache
            WHERE poster_url IS NOT NULL AND title IS NOT NULL
        `).all();

        // 2. Initialize seedable random generator
        const rnd = seedRandom(seed);

        // 3. Map each movie to a score with a seedable random offset
        // Higher rated movies will naturally have higher scores, but random offset up to 6.0 introduces beautiful variety
        const scoredMovies = rows.map(row => {
            const r = parseFloat(row.rating) || 5.5; // fallback rating for unrated movies
            const randomOffset = rnd() * 6.0;
            return {
                movie: row,
                score: r + randomOffset
            };
        });

        // 4. Sort by score in descending order
        scoredMovies.sort((a, b) => b.score - a.score);

        // 5. Extract sorted movies
        const sorted = scoredMovies.map(item => item.movie);

        // 6. Slice according to limit and offset
        const sliced = sorted.slice(offset, offset + limit);

        res.json(sliced);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Global cache search endpoint
app.get('/api/cache/search', authenticateToken, (req, res) => {
    try {
        const { actor, director, genre, year, query } = req.query;
        let sql = 'SELECT * FROM scraped_movies_cache WHERE 1=1';
        const params = [];
        
        if (actor) {
            sql += ' AND actors LIKE ?';
            params.push(`%${actor.trim()}%`);
        }
        if (director) {
            sql += ' AND director LIKE ?';
            params.push(`%${director.trim()}%`);
        }
        if (genre) {
            sql += ' AND genres LIKE ?';
            params.push(`%${genre.trim()}%`);
        }
        if (year) {
            sql += ' AND year = ?';
            params.push(parseInt(year) || year);
        }
        if (query) {
            sql += ' AND (title LIKE ? OR original_title LIKE ? OR description LIKE ?)';
            params.push(`%${query.trim()}%`, `%${query.trim()}%`, `%${query.trim()}%`);
        }
        
        sql += ' ORDER BY updated_at DESC LIMIT 150';
        
        const stmt = db.prepare(sql);
        const results = stmt.all(...params);
        res.json(results);
    } catch (err) {
        console.error('Cache search failed:', err);
        res.status(500).json({ error: err.message });
    }
});

const getUserHeaders = (req) => {
    if (!req) return {};
    const headers = {};
    if (req.headers['user-agent']) {
        headers['User-Agent'] = req.headers['user-agent'];
    }
    if (req.headers['accept-language']) {
        headers['Accept-Language'] = req.headers['accept-language'];
    }
    if (req.headers['referer']) {
        headers['Referer'] = req.headers['referer'];
    }
    for (const key of Object.keys(req.headers)) {
        if (key.startsWith('sec-ch-ua')) {
            headers[key] = req.headers[key];
        }
    }
    return headers;
};

// Search / Parse Endpoint
app.post('/api/movies/search', authenticateToken, async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) return res.status(400).json({ error: 'Query required' });

        if (isHdrezkaUrl(query)) {
            // 1. Search by URL
            const cleanQuery = cleanUrlPath(query);
            
            // Check cache
            const cached = db.prepare('SELECT * FROM scraped_movies_cache WHERE link LIKE ?').get(`%${cleanQuery}%`);
            // Only use cache instantly if it has description (meaning it was fully scraped, not just a partial search result)
            if (cached && cached.description) {
                console.log(`[Search Cache Hit] Instantly returning full details for: ${query}`);
                // Trigger background update to keep it fresh
                triggerBackgroundUpdate(query);
                return res.json({ type: 'detail', data: cached, fromCache: true });
            }

            // Fallback to real-time scrape
            console.log(`[Search Cache Miss] Scraping HDRezka for: ${query}`);
            const details = await getMovieDetails(query, getUserHeaders(req));
            if (details) {
                saveToCache(details);
            }
            return res.json({ type: 'detail', data: details });
        } else {
            // 2. Search by Text
            const searchLike = `%${query.trim()}%`;
            
            // Check cache first
            const localResults = db.prepare(`
                SELECT title, original_title, year, link, poster_url as img, genres as misc, rating, type
                FROM scraped_movies_cache
                WHERE cyrillic_like(title, ?) OR cyrillic_like(original_title, ?)
                LIMIT 150
            `).all(query.trim(), query.trim());

            if (localResults.length > 0) {
                console.log(`[Search Cache Hit] Instantly returning ${localResults.length} text search results for: "${query}"`);
                
                // Still trigger HDRezka search in the background to discover any new items or update existing ones
                (async () => {
                    try {
                        const results = await searchMovies(query, getUserHeaders(req));
                        if (results && results.length > 0) {
                            for (const item of results) {
                                // Save simple search results to cache so they can be discovered next time
                                db.prepare(`
                                    INSERT INTO scraped_movies_cache (title, year, link, poster_url, genres, rating, type, updated_at)
                                    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                                    ON CONFLICT(link) DO UPDATE SET
                                        title = excluded.title,
                                        year = excluded.year,
                                        poster_url = excluded.poster_url,
                                        genres = excluded.genres,
                                        rating = excluded.rating,
                                        type = excluded.type,
                                        updated_at = CURRENT_TIMESTAMP
                                `).run(item.title, item.year, item.link, item.img, item.misc, item.rating, item.type);
                            }
                        }
                    } catch (e) {
                        console.error('[Search Background HDRezka Fetch Error]', e.message);
                    }
                })();

                return res.json({ type: 'list', data: localResults, fromCache: true });
            }

            // Fallback to real-time search
            console.log(`[Search Cache Miss] Searching HDRezka for: "${query}"`);
            const results = await searchMovies(query, getUserHeaders(req));
            if (results && results.length > 0) {
                for (const item of results) {
                    try {
                        db.prepare(`
                            INSERT INTO scraped_movies_cache (title, year, link, poster_url, genres, rating, type, updated_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                            ON CONFLICT(link) DO UPDATE SET
                                title = excluded.title,
                                year = excluded.year,
                                poster_url = excluded.poster_url,
                                genres = excluded.genres,
                                rating = excluded.rating,
                                type = excluded.type,
                                updated_at = CURRENT_TIMESTAMP
                        `).run(item.title, item.year, item.link, item.img, item.misc, item.rating, item.type);
                    } catch (e) {
                        // ignore
                    }
                }
            }
            return res.json({ type: 'list', data: results });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch data' });
    }
});

// ==========================================
// GLOBAL CACHE SEARCH ENDPOINT
// ==========================================
app.get('/api/cache/search', authenticateToken, (req, res) => {
    const { actor, director, genre, year } = req.query;

    let queryStr = 'SELECT * FROM scraped_movies_cache WHERE 1=1';
    const params = [];

    if (actor) {
        queryStr += ' AND cyrillic_like(actors, ?)';
        params.push(`%${actor}%`);
    }
    if (director) {
        queryStr += ' AND cyrillic_like(director, ?)';
        params.push(`%${director}%`);
    }
    if (genre) {
        queryStr += ' AND cyrillic_like(genres, ?)';
        params.push(`%${genre}%`);
    }
    if (year) {
        queryStr += ' AND year = ?';
        params.push(parseInt(year, 10));
    }

    // Limit to 50 results to keep it super performant
    queryStr += ' ORDER BY year DESC, rating DESC LIMIT 50';

    try {
        const movies = db.prepare(queryStr).all(...params);
        res.json(movies);
    } catch (err) {
        console.error('Cache search failed:', err);
        res.status(500).json({ error: 'Cache search failed' });
    }
});

// ==========================================
// STREAMING SEARCH ENDPOINT (SSE)
// Returns results progressively via Server-Sent Events
// ==========================================
app.get('/api/movies/search/stream', authenticateToken, async (req, res) => {
    const { q: query } = req.query;
    if (!query) {
        res.status(400).json({ error: 'Query required' });
        return;
    }

    // Setup SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const send = (eventName, data) => {
        res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const isDone = () => res.writableEnded;

    try {
        if (isHdrezkaUrl(query)) {
            // ---- URL MODE: instant cache lookup, then scrape ----
            const cleanQuery = cleanUrlPath(query);
            const cached = db.prepare('SELECT * FROM scraped_movies_cache WHERE link LIKE ?').get(`%${cleanQuery}%`);

            // Only return from cache instantly if it's a full record with description
            if (cached && cached.description) {
                send('result', { type: 'detail', data: cached, fromCache: true });
                send('done', { fromCache: true });
                res.end();
                // Background freshness update
                triggerBackgroundUpdate(query);
                return;
            }

            // Not cached — scrape in real time
            send('status', { msg: 'Fetching from HDRezka...' });
            const details = await getMovieDetails(query, getUserHeaders(req));
            if (details) {
                saveToCache(details);
                send('result', { type: 'detail', data: details });
            }
            send('done', {});
            res.end();
        } else {
            // ---- TEXT SEARCH MODE ----
            const qTrimmed = query.trim();

            // 1. Instant local DB results
            const localResults = db.prepare(`
                SELECT title, original_title, year, link, poster_url as img, genres as misc, rating, type
                FROM scraped_movies_cache
                WHERE cyrillic_like(title, ?) OR cyrillic_like(original_title, ?)
                ORDER BY updated_at DESC
                LIMIT 150
            `).all(qTrimmed, qTrimmed);

            if (localResults.length > 0) {
                send('results', { items: localResults, fromCache: true });
            }

            // 2. Fetch from HDRezka (may return new items not in cache)
            send('status', { msg: 'Searching HDRezka...' });
            try {
                const freshResults = await searchMovies(query, getUserHeaders(req));
                if (!isDone()) {
                    // Save to cache
                    for (const item of (freshResults || [])) {
                        try {
                            db.prepare(`
                                INSERT INTO scraped_movies_cache (title, year, link, poster_url, genres, rating, type, updated_at)
                                VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                                ON CONFLICT(link) DO UPDATE SET
                                    title = excluded.title, year = excluded.year,
                                    poster_url = excluded.poster_url, genres = excluded.genres,
                                    rating = excluded.rating, type = excluded.type,
                                    updated_at = CURRENT_TIMESTAMP
                            `).run(item.title, item.year, item.link, item.img, item.misc, item.rating, item.type);
                        } catch (e) { /* ignore */ }
                    }

                    // Find items that are genuinely new (not already sent from cache)
                    const cachedLinks = new Set(localResults.map(r => cleanUrlPath(r.link)));
                    const newItems = (freshResults || []).filter(r => !cachedLinks.has(cleanUrlPath(r.link)));

                    if (newItems.length > 0) {
                        send('results', { items: newItems, fromCache: false });
                    } else if (localResults.length === 0) {
                        // Send the fresh results even if no new ones (in case cache was empty)
                        send('results', { items: freshResults || [], fromCache: false });
                    }
                }
            } catch (scrapeErr) {
                if (!isDone()) send('error', { msg: 'HDRezka search failed' });
            }

            if (!isDone()) {
                send('done', {});
                res.end();
            }
        }
    } catch (err) {
        console.error('[SSE Search Error]', err);
        if (!isDone()) {
            send('error', { msg: err.message });
            res.end();
        }
    }
});


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
// Get HDRezka comments directly via URL (paginated)
app.get('/api/hdrezka-comments', async (req, res) => {
    try {
        const { url, page } = req.query;
        if (!url) {
            return res.status(400).json({ error: 'Missing url parameter' });
        }
        const pageNum = parseInt(page) || 1;
        const result = await getHdrezkaComments(url, pageNum);
        res.json(result);
    } catch (err) {
        console.error('Failed to get hdrezka comments:', err);
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
});

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
            WHERE m.user_id = ? AND m.deleted_at IS NULL AND m.hidden_from_library = 0
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

// GET All Unique Directors (sorted by count)
app.get('/api/directors', authenticateToken, (req, res) => {
    try {
        const stmt = db.prepare('SELECT director FROM movies WHERE user_id = ? AND deleted_at IS NULL');
        const rows = stmt.all(req.user.id);
        const directorCounts = {};
        rows.forEach(row => {
            if (row.director) {
                row.director.split(',').forEach(d => {
                    const trimmed = d.trim();
                    if (trimmed) {
                        directorCounts[trimmed] = (directorCounts[trimmed] || 0) + 1;
                    }
                });
            }
        });
        const sortedDirectors = Object.entries(directorCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) => ({ name, count }));

        res.json(sortedDirectors);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET All Unique Actors (sorted by count)
app.get('/api/actors', authenticateToken, (req, res) => {
    try {
        const stmt = db.prepare('SELECT actors FROM movies WHERE user_id = ? AND deleted_at IS NULL');
        const rows = stmt.all(req.user.id);
        const actorCounts = {};
        rows.forEach(row => {
            if (row.actors) {
                row.actors.split(',').forEach(a => {
                    const trimmed = a.trim();
                    if (trimmed) {
                        actorCounts[trimmed] = (actorCounts[trimmed] || 0) + 1;
                    }
                });
            }
        });
        const sortedActors = Object.entries(actorCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) => ({ name, count }));

        res.json(sortedActors);
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
          INSERT INTO movies (title, original_title, year, link, rating, description, poster_url, genres, actors, director, writers, country, duration, voice_acting, type, user_id, user_rating, notes, notes_public)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const info = stmt.run(
            title, original_title, year, link, rating, description, poster_url,
            genres, actors, director, writers, req.body.country || null, req.body.duration || null, req.body.voice_acting || null, type || 'movie', req.user.id,
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

        const stmt = db.prepare('SELECT id, user_id, username, content, created_at FROM movie_reviews WHERE movie_link = ? ORDER BY created_at DESC');
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
            user_id: req.user.id,
            username: user.username,
            content: content.trim(),
            created_at: new Date().toISOString(),
            success: true
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PATCH edit a public review
app.patch('/api/reviews/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'content is required' });
        }

        const review = db.prepare('SELECT user_id FROM movie_reviews WHERE id = ?').get(id);
        if (!review) return res.status(404).json({ error: 'Review not found' });

        const isAdmin = req.user.username.toLowerCase() === 'radev';
        if (review.user_id !== req.user.id && !isAdmin) {
            return res.status(403).json({ error: 'Access denied: You can only edit your own reviews' });
        }

        db.prepare('UPDATE movie_reviews SET content = ? WHERE id = ?').run(content.trim(), id);
        res.json({ success: true, content: content.trim() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE a public review
app.delete('/api/reviews/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const review = db.prepare('SELECT user_id FROM movie_reviews WHERE id = ?').get(id);
        if (!review) return res.status(404).json({ error: 'Review not found' });

        const isAdmin = req.user.username.toLowerCase() === 'radev';
        if (review.user_id !== req.user.id && !isAdmin) {
            return res.status(403).json({ error: 'Access denied: You can only delete your own reviews' });
        }

        db.prepare('DELETE FROM movie_reviews WHERE id = ?').run(id);
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

// POST Check if movies are in collections
app.post('/api/movies/check-collections', authenticateToken, (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) return res.json({ inCollections: false, collectionNames: [] });
        
        const stmt = db.prepare(`
            SELECT DISTINCT c.title
            FROM collections c
            JOIN collection_movies cm ON c.id = cm.collection_id
            WHERE cm.movie_id IN (${ids.map(() => '?').join(',')})
        `);
        const collectionNames = stmt.all(...ids).map(row => row.title);
        res.json({ inCollections: collectionNames.length > 0, collectionNames });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST Bulk Hide from library
app.post('/api/movies/bulk-hide', authenticateToken, (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
        const stmt = db.prepare('UPDATE movies SET hidden_from_library = 1 WHERE id = ? AND user_id = ?');
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
        const { url, source_collection_name, source_collection_token, source_user_name } = req.body;
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

        const details = await getMovieDetails(url, getUserHeaders(req));
        if (!details) return res.status(404).json({ error: 'Could not parse movie details' });

        // Cache the newly imported details
        saveToCache(details);

        const stmt = db.prepare(`
            INSERT INTO movies (title, original_title, year, link, rating, description, poster_url, genres, actors, director, writers, country, duration, voice_acting, source_collection_name, source_collection_token, source_user_name, type, user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const info = stmt.run(
            details.title, details.original_title, details.year, url, details.rating,
            details.description, details.poster_url, details.genres, details.actors, details.director, details.writers,
            details.country, details.duration, details.voice_acting,
            source_collection_name || null, source_collection_token || null, source_user_name || null,
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
                const details = await getMovieDetails(movie.link, getUserHeaders(req));
                
                // Update details cache
                saveToCache(details);

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

// ==========================================
// PUBLIC MOVIE ENDPOINTS (No authentication required)
// ==========================================

// Public endpoint to fetch a single movie for sharing
app.get('/api/public/movie/:id', (req, res) => {
    try {
        const stmt = db.prepare(`
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
            WHERE m.id = ? AND m.deleted_at IS NULL
        `);
        const movie = stmt.get(req.params.id);
        if (!movie) return res.status(404).json({ error: 'Movie not found' });
        
        if (!movie.notes_public) {
            movie.notes = null;
        }
        res.json(movie);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Telegram Open Graph Metadata endpoint
app.get('/share/movie/:id', (req, res) => {
    try {
        const movie = db.prepare('SELECT title, original_title, year, description, poster_url, genres, rating FROM movies WHERE id = ?').get(req.params.id);
        if (!movie) return res.status(404).send('Movie not found');
        
        const title = `${movie.title} (${movie.year})`;
        const description = `⭐️ ${movie.rating || '-'} | 🎭 ${movie.genres || '-'}\n\n${movie.description || ''}`;
        
        const html = `<!DOCTYPE html>
<html>
<head>
    <meta property="og:title" content="${title.replace(/"/g, '&quot;')}" />
    <meta property="og:description" content="${description.replace(/"/g, '&quot;')}" />
    <meta property="og:image" content="${movie.poster_url}" />
    <meta name="twitter:card" content="summary_large_image" />
    <script>
        window.location.href = "https://radievdmytro.github.io/movie-watcher/?movie=${req.params.id}";
    </script>
</head>
<body style="background: #121212; color: #fff; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
    <p>Redirecting to Movie Watcher...</p>
</body>
</html>`;
        res.send(html);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Collection Share endpoint for Telegram HTML
app.get('/share/collection/:id', (req, res) => {
    try {
        const id = req.params.id;
        const isNumeric = /^\d+$/.test(id);
        const collection = isNumeric 
            ? db.prepare('SELECT * FROM collections WHERE id = ?').get(id)
            : db.prepare('SELECT * FROM collections WHERE share_token = ?').get(id);

        if (!collection) return res.status(404).send('Collection not found');

        // Fetch top 5 movies by rating
        const topMovies = db.prepare(`
            SELECT m.title, m.rating
            FROM movies m
            JOIN collection_movies cm ON m.id = cm.movie_id
            WHERE cm.collection_id = ? AND m.deleted_at IS NULL
            ORDER BY m.rating DESC NULLS LAST
            LIMIT 5
        `).all(collection.id);

        const title = collection.title.replace(/"/g, '&quot;');
        let description = collection.description || topMovies.map(m => m.title).join(', ');
        description = description.replace(/"/g, '&quot;');
        
        const imageUrl = `https://movie-watcher-y1bc.onrender.com/api/public/collection/${id}/og-image.jpg`;

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta name="twitter:card" content="summary_large_image" />
    <script>
        window.location.href = "https://radievdmytro.github.io/movie-watcher/?collection=${id}";
    </script>
</head>
<body style="background: #121212; color: #fff; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
    <p>Redirecting to Collection...</p>
</body>
</html>`;
        res.send(html);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Dynamic OG Image generation for Collections
app.get('/api/public/collection/:id/og-image.jpg', async (req, res) => {
    try {
        const id = req.params.id;
        const isNumeric = /^\d+$/.test(id);
        const collection = isNumeric 
            ? db.prepare('SELECT * FROM collections WHERE id = ?').get(id)
            : db.prepare('SELECT * FROM collections WHERE share_token = ?').get(id);

        if (!collection) return res.status(404).send('Not found');

        const topMovies = db.prepare(`
            SELECT m.poster_url
            FROM movies m
            JOIN collection_movies cm ON m.id = cm.movie_id
            WHERE cm.collection_id = ? AND m.deleted_at IS NULL AND m.poster_url IS NOT NULL
            ORDER BY m.rating DESC NULLS LAST
            LIMIT 5
        `).all(collection.id);

        if (topMovies.length === 0) {
            return res.status(404).send('No posters available');
        }

        const buffers = [];
        for (const movie of topMovies) {
            try {
                const imgRes = await axios.get(movie.poster_url, { responseType: 'arraybuffer', timeout: 5000 });
                buffers.push(Buffer.from(imgRes.data));
            } catch (e) {
                console.error('Failed to fetch poster for OG image', e.message);
            }
        }

        if (buffers.length === 0) {
            return res.status(404).send('No posters available');
        }

        const posterWidth = 300;
        const posterHeight = 450;
        const resizedPosters = await Promise.all(buffers.map(buf => 
            sharp(buf).resize(posterWidth, posterHeight, { fit: 'cover' }).toBuffer()
        ));

        const overlap = 200; 
        const totalWidth = (resizedPosters.length - 1) * overlap + posterWidth;
        const startX = Math.max(0, Math.floor((1200 - totalWidth) / 2));
        const startY = Math.floor((630 - posterHeight) / 2);

        const compositeInputs = resizedPosters.map((buf, i) => ({
            input: buf,
            left: startX + (i * overlap),
            top: startY
        }));

        const baseImage = await sharp(buffers[0])
            .resize(1200, 630, { fit: 'cover' })
            .blur(30)
            .composite([
                { input: Buffer.from('<svg><rect width="1200" height="630" fill="rgba(0,0,0,0.6)"/></svg>'), blend: 'over' },
                ...compositeInputs
            ])
            .jpeg({ quality: 80 })
            .toBuffer();

        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
        res.send(baseImage);
    } catch (err) {
        console.error('OG Image Generation Error:', err);
        res.status(500).send('Internal Server Error');
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

        const owner = db.prepare('SELECT username FROM users WHERE id = ?').get(collection.user_id);
        collection.owner_username = owner ? owner.username : 'Unknown';

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
        res.json({ id: collectionId, share_token: shareToken, success: true });
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

// PATCH collection (Update title/description)
app.patch('/api/collections/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const { title, description } = req.body;
        
        const existing = db.prepare('SELECT * FROM collections WHERE id = ? AND user_id = ?').get(id, req.user.id);
        if (!existing) return res.status(403).json({ error: 'Access denied or not found' });

        const newTitle = title !== undefined ? title : existing.title;
        const newDescription = description !== undefined ? description : existing.description;

        db.prepare('UPDATE collections SET title = ?, description = ? WHERE id = ?').run(newTitle, newDescription, id);
        
        res.json({ success: true, title: newTitle, description: newDescription });
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

// POST copy or move movie(s) to another collection
app.post('/api/collections/copy-move-movie', authenticateToken, async (req, res) => {
    try {
        const { movieIds, sourceCollectionId, targetCollectionId, actionType } = req.body;
        if (!movieIds || !Array.isArray(movieIds) || movieIds.length === 0 || !targetCollectionId || !actionType) {
            return res.status(400).json({ error: 'movieIds array, targetCollectionId, and actionType required' });
        }

        // 1. Ensure target collection exists and is owned by us
        const targetColl = db.prepare('SELECT id FROM collections WHERE id = ? AND user_id = ?').get(targetCollectionId, req.user.id);
        if (!targetColl) return res.status(403).json({ error: 'Target collection not found or access denied' });

        const checkMovie = db.prepare('SELECT * FROM movies WHERE id = ?');
        const checkExistingOwn = db.prepare('SELECT id, deleted_at FROM movies WHERE link = ? AND user_id = ?');
        const restoreMovie = db.prepare('UPDATE movies SET deleted_at = NULL WHERE id = ?');
        const insertMovie = db.prepare(`
            INSERT INTO movies (title, original_title, year, link, rating, description, poster_url, genres, actors, director, writers, country, duration, voice_acting, source_collection_name, source_collection_token, source_user_name, type, user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const addMovieToColl = db.prepare('INSERT OR IGNORE INTO collection_movies (collection_id, movie_id) VALUES (?, ?)');
        
        let sourceColl = null;
        if (actionType === 'move' && sourceCollectionId) {
            sourceColl = db.prepare('SELECT id FROM collections WHERE id = ? AND user_id = ?').get(sourceCollectionId, req.user.id);
        }
        const removeMovieFromColl = db.prepare('DELETE FROM collection_movies WHERE collection_id = ? AND movie_id = ?');

        const runTransaction = db.transaction((movieIds, sourceCollectionId, targetCollectionId, actionType) => {
            for (const movieId of movieIds) {
                const movie = checkMovie.get(movieId);
                if (!movie) continue;

                // Find or import
                let myMovieId;
                const existingOwnMovie = checkExistingOwn.get(movie.link, req.user.id);
                if (existingOwnMovie) {
                    myMovieId = existingOwnMovie.id;
                    if (existingOwnMovie.deleted_at) {
                        restoreMovie.run(existingOwnMovie.id);
                    }
                } else {
                    const info = insertMovie.run(
                        movie.title, movie.original_title, movie.year, movie.link, movie.rating,
                        movie.description, movie.poster_url, movie.genres, movie.actors, movie.director, movie.writers,
                        movie.country, movie.duration, movie.voice_acting,
                        movie.source_collection_name || null, movie.source_collection_token || null, movie.source_user_name || null,
                        movie.type || 'movie', req.user.id
                    );
                    myMovieId = info.lastInsertRowid;
                }

                // Add to target collection
                addMovieToColl.run(targetCollectionId, myMovieId);

                // Remove from source if 'move'
                if (actionType === 'move' && sourceColl) {
                    removeMovieFromColl.run(sourceCollectionId, movieId);
                }
            }
        });

        runTransaction(movieIds, sourceCollectionId, targetCollectionId, actionType);
        res.json({ success: true });
    } catch (error) {
        console.error('Bulk Copy/Move failed:', error);
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

// POST remove multiple movies from collection in bulk
app.post('/api/collections/:id/movies/bulk-delete', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const { movieIds } = req.body;
        if (!movieIds || !Array.isArray(movieIds) || movieIds.length === 0) {
            return res.status(400).json({ error: 'movieIds array required' });
        }

        const checkColl = db.prepare('SELECT id FROM collections WHERE id = ? AND user_id = ?').get(id, req.user.id);
        if (!checkColl) return res.status(403).json({ error: 'Access denied or collection not found' });

        const deleteStmt = db.prepare('DELETE FROM collection_movies WHERE collection_id = ? AND movie_id = ?');
        const runTransaction = db.transaction((id, movieIds) => {
            for (const movieId of movieIds) {
                deleteStmt.run(id, movieId);
            }
        });
        runTransaction(id, movieIds);
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
            INSERT INTO movies (title, original_title, year, link, rating, description, poster_url, genres, actors, director, writers, country, duration, voice_acting, type, user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                        m.country, m.duration, m.voice_acting,
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

// POST import movies from collection to library (without cloning collection)
app.post('/api/collections/:id/import-movies', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const { movieIds } = req.body;

        // Fetch collection to get owner details and title for source metadata
        const collection = db.prepare(`
            SELECT c.*, u.username as owner_username 
            FROM collections c 
            JOIN users u ON c.user_id = u.id 
            WHERE c.id = ?
        `).get(id);
        
        if (!collection) return res.status(404).json({ error: 'Collection not found' });

        let query = `
            SELECT m.* FROM movies m
            JOIN collection_movies cm ON m.id = cm.movie_id
            WHERE cm.collection_id = ? AND m.deleted_at IS NULL
        `;
        const params = [id];

        if (movieIds && Array.isArray(movieIds) && movieIds.length > 0) {
            query += ` AND m.id IN (${movieIds.map(() => '?').join(',')})`;
            params.push(...movieIds);
        }

        const moviesToImport = db.prepare(query).all(...params);

        const checkMovie = db.prepare('SELECT id, deleted_at FROM movies WHERE link = ? AND user_id = ?');
        const restoreMovie = db.prepare('UPDATE movies SET deleted_at = NULL WHERE id = ?');
        const insertMovie = db.prepare(`
            INSERT INTO movies (title, original_title, year, link, rating, description, poster_url, genres, actors, director, writers, country, duration, voice_acting, source_collection_name, source_collection_token, source_user_name, type, user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let importedCount = 0;
        let skippedCount = 0;

        const runImportTransaction = db.transaction(() => {
            for (const m of moviesToImport) {
                const existing = checkMovie.get(m.link, req.user.id);
                if (existing) {
                    if (existing.deleted_at) {
                        restoreMovie.run(existing.id);
                        importedCount++;
                    } else {
                        skippedCount++;
                    }
                } else {
                    insertMovie.run(
                        m.title, m.original_title, m.year, m.link, m.rating,
                        m.description, m.poster_url, m.genres, m.actors, m.director, m.writers,
                        m.country, m.duration, m.voice_acting,
                        collection.title, collection.share_token, collection.owner_username,
                        m.type || 'movie', req.user.id
                    );
                    importedCount++;
                }
            }
        });

        runImportTransaction();

        res.json({ success: true, importedCount, skippedCount });
    } catch (error) {
        console.error('Bulk import failed:', error);
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
        const totalCached = db.prepare('SELECT COUNT(*) as count FROM scraped_movies_cache').get().count;
        res.json({ totalUsers, totalMovies, totalCollections, totalCached });
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
                u.last_ip,
                u.last_country,
                u.last_device,
                u.last_os,
                u.last_browser,
                u.last_login_at,
                (SELECT COUNT(*) FROM movies m WHERE m.user_id = u.id AND m.deleted_at IS NULL) as movie_count,
                (SELECT COUNT(*) FROM collections c WHERE c.user_id = u.id) as collection_count,
                (SELECT COUNT(*) FROM movie_reviews r WHERE r.user_id = u.id) as comment_count
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
// BACKGROUND MOVIE CRAWLER PIPELINE
// ==========================================
const SETTINGS_FILE = path.join(__dirname, 'crawler_settings.json');

let crawlerSettings = {
    enabled: false,
    ratePerHour: 60,
    currentPage: 1,
    currentStatus: 'Idle'
};

// Load settings
try {
    if (fs.existsSync(SETTINGS_FILE)) {
        const fileData = fs.readFileSync(SETTINGS_FILE, 'utf8');
        const parsed = JSON.parse(fileData);
        crawlerSettings = { ...crawlerSettings, ...parsed };
    }
} catch (e) {
    console.error('[Crawler] Failed to load settings:', e.message);
}

let crawlerTimeoutId = null;

const saveCrawlerSettings = () => {
    try {
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify({
            enabled: crawlerSettings.enabled,
            ratePerHour: crawlerSettings.ratePerHour,
            currentPage: crawlerSettings.currentPage
        }, null, 2), 'utf8');
    } catch (e) {
        console.error('[Crawler] Failed to save settings:', e.message);
    }
};

async function runCrawlerStep() {
    if (!crawlerSettings.enabled) {
        crawlerSettings.currentStatus = 'Idle (Disabled)';
        return;
    }

    try {
        crawlerSettings.currentStatus = 'Checking database...';
        
        // 1. Check if we have partially scraped movies (description is null or empty)
        let targetMovie = db.prepare(`
            SELECT link, title FROM scraped_movies_cache 
            WHERE description IS NULL OR description = '' 
            ORDER BY RANDOM() LIMIT 1
        `).get();

        // 2. If no target movie is found, discover new ones!
        if (!targetMovie) {
            crawlerSettings.currentStatus = 'Discovering new movies...';
            console.log('[Crawler] No unscraped movies in cache. Triggering page discovery...');
            
            const categories = ['films', 'series', 'cartoons', 'animation'];
            const category = categories[Math.floor(Math.random() * categories.length)];
            const pageNum = Math.floor(Math.random() * 500) + 1;
            const targetPath = `/${category}/page/${pageNum}/`;
            
            console.log(`[Crawler] Scraping catalog page: ${targetPath}`);
            const discovered = await scrapeCatalogPage(targetPath);
            
            if (discovered && discovered.length > 0) {
                let newCount = 0;
                for (const item of discovered) {
                    try {
                        const info = db.prepare(`
                            INSERT INTO scraped_movies_cache (title, year, link, poster_url, genres, rating, type, updated_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                            ON CONFLICT(link) DO NOTHING
                        `).run(item.title, item.year, item.link, item.img, item.misc, item.rating, item.type);
                        if (info.changes > 0) newCount++;
                    } catch (e) {}
                }
                console.log(`[Crawler] Catalog page parsed. Discovered ${discovered.length} movies (${newCount} new links added).`);
                
                // Trigger Supabase cloud backup sync if we discovered new movies!
                if (newCount > 0) {
                    uploadBackup();
                }

                crawlerSettings.currentStatus = `Discovered ${newCount} new movies. Retrying scrape...`;
                
                // Fetch target movie again
                targetMovie = db.prepare(`
                    SELECT link, title FROM scraped_movies_cache 
                    WHERE description IS NULL OR description = '' 
                    ORDER BY RANDOM() LIMIT 1
                `).get();
            }
        }

        // 3. Scrape the full details for the target movie
        if (targetMovie) {
            crawlerSettings.currentStatus = `Scraping "${targetMovie.title}"...`;
            console.log(`[Crawler] Scraping details for: ${targetMovie.title} (${targetMovie.link})`);
            
            const details = await getMovieDetails(targetMovie.link);
            if (details) {
                saveToCache(details);
                console.log(`[Crawler] Successfully crawled details for: ${details.title}`);
                crawlerSettings.currentStatus = `Idle. Crawled: "${details.title}"`;
                
                // Trigger Supabase cloud backup sync!
                uploadBackup();
            } else {
                crawlerSettings.currentStatus = 'Details page scrape returned empty.';
            }
        } else {
            crawlerSettings.currentStatus = 'Idle. No new movies discovered.';
        }

    } catch (err) {
        console.error('[Crawler Loop Error]', err.message);
        crawlerSettings.currentStatus = `Error: ${err.message}`;
    }

    // Schedule next run
    scheduleNextCrawlerStep();
}

function scheduleNextCrawlerStep() {
    if (crawlerTimeoutId) {
        clearTimeout(crawlerTimeoutId);
        crawlerTimeoutId = null;
    }

    if (!crawlerSettings.enabled) {
        crawlerSettings.currentStatus = 'Idle (Disabled)';
        return;
    }

    // Interval math
    const baseIntervalMs = (3600 / crawlerSettings.ratePerHour) * 1000;
    // Jitter: +/- 25% random variation to mimic human browsing and prevent scraping patterns
    const jitterFactor = Math.random() * 0.5 - 0.25;
    const delayMs = Math.max(5000, Math.floor(baseIntervalMs + baseIntervalMs * jitterFactor));

    console.log(`[Crawler] Next request scheduled in ${(delayMs / 1000).toFixed(1)} seconds.`);
    
    crawlerTimeoutId = setTimeout(() => {
        runCrawlerStep();
    }, delayMs);
}

// Global Fast Crawler State
let fastCrawlerState = {
    isRunning: false,
    pagesCrawled: 0,
    totalPages: 0,
    totalImported: 0,
    logs: [],
    currentCategory: '',
    shouldStop: false
};

function addFastCrawlerLog(message) {
    const timestamp = new Date().toLocaleTimeString();
    const formatted = `[${timestamp}] ${message}`;
    console.log(`[FastCrawler] ${message}`);
    fastCrawlerState.logs.push(formatted);
    if (fastCrawlerState.logs.length > 100) {
        fastCrawlerState.logs.shift(); // keep last 100 logs
    }
}

// Fast Crawler Async loop
async function runFastCrawlerProcess({ pages, categories, pageDelay }) {
    fastCrawlerState.isRunning = true;
    fastCrawlerState.pagesCrawled = 0;
    fastCrawlerState.totalImported = 0;
    fastCrawlerState.totalPages = categories.length * pages;
    fastCrawlerState.shouldStop = false;
    fastCrawlerState.logs = [];

    addFastCrawlerLog(`🚀 Fast Crawler started. Target: ${pages} pages across ${categories.length} categories.`);

    const categoryMap = {
        'films': { path: '/films/', type: 'movie', label: 'Films' },
        'series': { path: '/series/', type: 'series', label: 'Series' },
        'cartoons': { path: '/cartoons/', type: 'movie', label: 'Cartoons' },
        'animation': { path: '/animation/', type: 'series', label: 'Anime' }
    };

    try {
        for (const catKey of categories) {
            if (fastCrawlerState.shouldStop) break;

            const cat = categoryMap[catKey];
            if (!cat) continue;

            fastCrawlerState.currentCategory = cat.label;
            addFastCrawlerLog(`📂 Crawling category: ${cat.label} (${cat.path})...`);

            for (let page = 1; page <= pages; page++) {
                if (fastCrawlerState.shouldStop) {
                    addFastCrawlerLog('🛑 Stop signal received. Terminating crawl...');
                    break;
                }

                const pagePath = page === 1 ? cat.path : `${cat.path}page/${page}/`;
                addFastCrawlerLog(`📖 Fetching page ${page}/${pages}: ${pagePath}`);

                try {
                    const discovered = await scrapeCatalogPage(pagePath);
                    if (!discovered || discovered.length === 0) {
                        addFastCrawlerLog(`⚠️ No movies found on page ${page}, skipping.`);
                        continue;
                    }

                    addFastCrawlerLog(`📦 Found ${discovered.length} movies on catalog page. Inserting/updating...`);

                    const insertStmt = db.prepare(`
                        INSERT INTO scraped_movies_cache 
                        (title, original_title, year, link, rating, poster_url, genres, type, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                        ON CONFLICT(link) DO UPDATE SET
                            rating = EXCLUDED.rating,
                            poster_url = EXCLUDED.poster_url,
                            genres = EXCLUDED.genres,
                            updated_at = CURRENT_TIMESTAMP
                    `);

                    const insertTx = db.transaction((list) => {
                        let count = 0;
                        for (const m of list) {
                            try {
                                const parsedRating = m.rating ? parseFloat(m.rating) : null;
                                const info = insertStmt.run(
                                    m.title,
                                    m.original_title || '',
                                    m.year,
                                    m.link,
                                    parsedRating,
                                    m.img,
                                    m.misc,
                                    m.type || cat.type
                                );
                                if (info.changes > 0) count++;
                            } catch (err) {
                                // ignore duplicates
                            }
                        }
                        return count;
                    });

                    const insertedCount = insertTx(discovered);
                    fastCrawlerState.totalImported += insertedCount;
                    fastCrawlerState.pagesCrawled++;
                    addFastCrawlerLog(`✅ Successfully cached ${insertedCount} movies from page ${page}.`);

                    // Trigger cloud backup if new movies were imported
                    if (insertedCount > 0) {
                        uploadBackup();
                    }

                    // Polite delay between requests
                    if (page < pages || categories.indexOf(catKey) < categories.length - 1) {
                        const delayTime = pageDelay + (Math.random() * 500);
                        await delay(delayTime);
                    }
                } catch (err) {
                    addFastCrawlerLog(`❌ Error on page ${pagePath}: ${err.message}`);
                    await delay(3000);
                }
            }
        }

        if (fastCrawlerState.shouldStop) {
            addFastCrawlerLog('🛑 Fast Crawler stopped by user.');
        } else {
            addFastCrawlerLog(`🎉 Fast Crawler completed successfully! Total imported/updated: ${fastCrawlerState.totalImported} movies.`);
        }
    } catch (e) {
        addFastCrawlerLog(`❌ Critical crawler exception: ${e.message}`);
    } finally {
        fastCrawlerState.isRunning = false;
        fastCrawlerState.currentCategory = '';
    }
}

// Fast Crawler endpoints (admin-only)
app.get('/api/admin/fast-crawler/status', authenticateToken, requireAdmin, (req, res) => {
    res.json(fastCrawlerState);
});

app.post('/api/admin/fast-crawler/start', authenticateToken, requireAdmin, (req, res) => {
    if (fastCrawlerState.isRunning) {
        return res.status(400).json({ error: 'Fast crawler is already running.' });
    }
    const pages = parseInt(req.body.pages) || 5;
    const categories = req.body.categories || ['films', 'series', 'cartoons', 'animation'];
    const pageDelay = parseInt(req.body.pageDelay) || 1500;

    // Run crawler asynchronously in background
    runFastCrawlerProcess({ pages, categories, pageDelay });

    res.json({ success: true, message: 'Fast crawler started successfully.' });
});

app.post('/api/admin/fast-crawler/stop', authenticateToken, requireAdmin, (req, res) => {
    if (!fastCrawlerState.isRunning) {
        return res.status(400).json({ error: 'Fast crawler is not running.' });
    }
    fastCrawlerState.shouldStop = true;
    res.json({ success: true, message: 'Termination signal sent to crawler.' });
});

app.get('/api/admin/recent-scraped', authenticateToken, requireAdmin, (req, res) => {
    try {
        const limit = Math.min(100, parseInt(req.query.limit) || 20);
        const rows = db.prepare('SELECT title, original_title, year, link, poster_url, rating, type, updated_at, description FROM scraped_movies_cache ORDER BY updated_at DESC LIMIT ?').all(limit);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Crawler settings endpoints (admin-only)
app.get('/api/admin/crawler-settings', authenticateToken, requireAdmin, (req, res) => {
    try {
        res.json({
            enabled: crawlerSettings.enabled,
            ratePerHour: crawlerSettings.ratePerHour,
            currentStatus: crawlerSettings.currentStatus,
            totalCached: db.prepare('SELECT COUNT(*) as count FROM scraped_movies_cache').get().count,
            partiallyScraped: db.prepare("SELECT COUNT(*) as count FROM scraped_movies_cache WHERE description IS NULL OR description = ''").get().count
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/crawler-settings', authenticateToken, requireAdmin, (req, res) => {
    try {
        const { enabled, ratePerHour } = req.body;
        if (enabled !== undefined) crawlerSettings.enabled = !!enabled;
        if (ratePerHour !== undefined) {
            crawlerSettings.ratePerHour = Math.max(1, Math.min(600, parseInt(ratePerHour) || 60));
        }

        saveCrawlerSettings();

        if (crawlerSettings.enabled) {
            console.log('[Crawler] Settings updated: Enabled background crawler.');
            runCrawlerStep();
        } else {
            console.log('[Crawler] Settings updated: Disabled background crawler.');
            if (crawlerTimeoutId) {
                clearTimeout(crawlerTimeoutId);
                crawlerTimeoutId = null;
            }
            crawlerSettings.currentStatus = 'Idle (Disabled)';
        }

        res.json({
            success: true,
            enabled: crawlerSettings.enabled,
            ratePerHour: crawlerSettings.ratePerHour,
            currentStatus: crawlerSettings.currentStatus,
            totalCached: db.prepare('SELECT COUNT(*) as count FROM scraped_movies_cache').get().count,
            partiallyScraped: db.prepare("SELECT COUNT(*) as count FROM scraped_movies_cache WHERE description IS NULL OR description = ''").get().count
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
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
        
        // Start background crawler if enabled on server start
        if (crawlerSettings.enabled) {
            console.log('[Crawler] Background crawler is ENABLED on server start.');
            runCrawlerStep();
        }
    });
}

startApp();
