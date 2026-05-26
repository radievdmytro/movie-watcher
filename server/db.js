const Database = require('better-sqlite3');
const path = require('path');

const db = new Database('movies.db', { verbose: console.log });

// Register custom case-insensitive LIKE function for Cyrillic/Unicode support in SQLite
db.function('cyrillic_like', (text, pattern) => {
  if (!text || !pattern) return 0;
  const lowerText = text.toLowerCase();
  const lowerPattern = pattern.toLowerCase().replace(/%/g, '');
  return lowerText.includes(lowerPattern) ? 1 : 0;
});

const initDb = () => {

  // Create guest fingerprints table
  db.exec(`
    CREATE TABLE IF NOT EXISTS guest_fingerprints (
      fingerprint_hash TEXT PRIMARY KEY,
      visits INTEGER DEFAULT 0,
      last_visit DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create Users Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS movies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      original_title TEXT,
      year INTEGER,
      link TEXT,
      rating REAL,
      description TEXT,
      poster_url TEXT,
      genres TEXT,
      actors TEXT,
      director TEXT,
      writers TEXT,
      country TEXT,
      duration TEXT,
      voice_acting TEXT,
      source_collection_name TEXT,
      source_collection_token TEXT,
      source_user_name TEXT,
      type TEXT DEFAULT 'movie',
      status TEXT DEFAULT 'want_to_watch',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME DEFAULT NULL,
      user_id INTEGER,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `;
  db.exec(createTableQuery);

  const createCollectionsTableQuery = `
    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      user_id INTEGER,
      share_token TEXT,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `;
  db.exec(createCollectionsTableQuery);

  const createCollectionMoviesTableQuery = `
    CREATE TABLE IF NOT EXISTS collection_movies (
      collection_id INTEGER,
      movie_id INTEGER,
      PRIMARY KEY (collection_id, movie_id),
      FOREIGN KEY (collection_id) REFERENCES collections (id) ON DELETE CASCADE,
      FOREIGN KEY (movie_id) REFERENCES movies (id) ON DELETE CASCADE
    )
  `;
  db.exec(createCollectionMoviesTableQuery);

  // Create Shared Collections Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS shared_collections (
      collection_id INTEGER,
      sender_id INTEGER,
      recipient_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (collection_id, recipient_id),
      FOREIGN KEY (collection_id) REFERENCES collections (id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (recipient_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // Create Global Movie Reviews/Comments Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS movie_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      movie_link TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_reviews_movie_link ON movie_reviews(movie_link)');

  // Create User Movie History Table
  // Stores ratings/notes per user+movie_link permanently — survives movie deletion
  // Used for: community ratings, data restoration when movie is re-added
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_movie_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      movie_link TEXT NOT NULL,
      user_rating REAL DEFAULT NULL,
      notes TEXT DEFAULT NULL,
      notes_public INTEGER DEFAULT 0,
      is_watched INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, movie_link),
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_history_movie_link ON user_movie_history(movie_link)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_history_user_link ON user_movie_history(user_id, movie_link)');

  // Create global scraped movies cache table
  db.exec(`
    CREATE TABLE IF NOT EXISTS scraped_movies_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      original_title TEXT,
      year INTEGER,
      link TEXT UNIQUE,
      rating REAL,
      description TEXT,
      poster_url TEXT,
      genres TEXT,
      actors TEXT,
      director TEXT,
      writers TEXT,
      country TEXT,
      duration TEXT,
      voice_acting TEXT,
      type TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_scraped_cache_link ON scraped_movies_cache(link)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_scraped_cache_title ON scraped_movies_cache(title)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_scraped_cache_original_title ON scraped_movies_cache(original_title)');

  // Create YouTube search cache table
  db.exec(`
    CREATE TABLE IF NOT EXISTS youtube_search_cache (
      query TEXT PRIMARY KEY,
      results_json TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Per-user hidden global-cache movies.
  // Stores normalized link paths so a movie stays hidden even if HDRezka mirror domains rotate.
  db.exec(`
    CREATE TABLE IF NOT EXISTS hidden_global_movies (
      user_id INTEGER NOT NULL,
      movie_link TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, movie_link),
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_hidden_global_movies_user ON hidden_global_movies(user_id)');

  // Crawler page tracking — remembers which catalog pages have been scraped
  // so the crawler never wastes HTTP requests re-visiting them.
  db.exec(`
    CREATE TABLE IF NOT EXISTS crawled_pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      page_number INTEGER NOT NULL,
      movies_found INTEGER DEFAULT 0,
      new_movies_added INTEGER DEFAULT 0,
      crawled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(category, page_number)
    )
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_crawled_pages_cat ON crawled_pages(category)');

  // System Settings Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Migration for user_id in movies
  try {
    db.exec("ALTER TABLE movies ADD COLUMN user_id INTEGER");
  } catch (e) { }

  // Migrations for User Telemetry Metadata
  try { db.exec("ALTER TABLE users ADD COLUMN last_ip TEXT"); } catch (e) { }
  try { db.exec("ALTER TABLE users ADD COLUMN last_country TEXT"); } catch (e) { }
  try { db.exec("ALTER TABLE users ADD COLUMN last_device TEXT"); } catch (e) { }
  try { db.exec("ALTER TABLE users ADD COLUMN last_os TEXT"); } catch (e) { }
  try { db.exec("ALTER TABLE users ADD COLUMN last_browser TEXT"); } catch (e) { }
  try { db.exec("ALTER TABLE users ADD COLUMN last_login_at DATETIME DEFAULT NULL"); } catch (e) { }

  // Migration for user_id in collections
  try {
    db.exec("ALTER TABLE collections ADD COLUMN user_id INTEGER");
  } catch (e) { }

  // Migration for share_token in collections
  try {
    db.exec("ALTER TABLE collections ADD COLUMN share_token TEXT");
  } catch (e) { }

  // Migration for notes in movies
  try {
    db.exec("ALTER TABLE movies ADD COLUMN notes TEXT");
  } catch (e) { }

  // Migration for notes_public in movies
  try {
    db.exec("ALTER TABLE movies ADD COLUMN notes_public INTEGER DEFAULT 0");
  } catch (e) { }

  // Migration for user_rating in movies
  try {
    db.exec("ALTER TABLE movies ADD COLUMN user_rating REAL DEFAULT NULL");
  } catch (e) { }

  try {
    db.exec("ALTER TABLE movies ADD COLUMN hidden_from_library INTEGER DEFAULT 0");
  } catch (e) { }

  try {
    db.exec("ALTER TABLE user_movie_history ADD COLUMN is_watched INTEGER DEFAULT 0");
  } catch (e) { }

  // Cryptographically backfill share_token for any existing collections lacking one
  try {
    const crypto = require('crypto');
    const colsWithoutToken = db.prepare('SELECT id FROM collections WHERE share_token IS NULL').all();
    if (colsWithoutToken.length > 0) {
      console.log(`🔑 Generating secure share tokens for ${colsWithoutToken.length} existing collections...`);
      const updateToken = db.prepare('UPDATE collections SET share_token = ? WHERE id = ?');
      for (const col of colsWithoutToken) {
        const token = crypto.randomBytes(12).toString('hex');
        updateToken.run(token, col.id);
      }
      console.log('🟢 Secure share tokens successfully backfilled.');
    }
  } catch (err) {
    console.error('❌ Failed to backfill secure share tokens:', err);
  }

  // Migration for existing tables: try to add deleted_at
  try {
    db.exec("ALTER TABLE movies ADD COLUMN deleted_at DATETIME DEFAULT NULL");
  } catch (e) { }

  // Migration for writers
  try {
    db.exec("ALTER TABLE movies ADD COLUMN writers TEXT");
  } catch (e) { }

  // Migration for type
  try {
    db.exec("ALTER TABLE movies ADD COLUMN type TEXT DEFAULT 'movie'");
  } catch (e) { }

  // Migrations for country, duration, voice_acting in movies
  try { db.exec("ALTER TABLE movies ADD COLUMN country TEXT"); } catch (e) { }
  try { db.exec("ALTER TABLE movies ADD COLUMN duration TEXT"); } catch (e) { }
  try { db.exec("ALTER TABLE movies ADD COLUMN voice_acting TEXT"); } catch (e) { }

  // Migrations for country, duration, voice_acting in scraped_movies_cache
  try { db.exec("ALTER TABLE scraped_movies_cache ADD COLUMN country TEXT"); } catch (e) { }
  try { db.exec("ALTER TABLE scraped_movies_cache ADD COLUMN duration TEXT"); } catch (e) { }
  try { db.exec("ALTER TABLE scraped_movies_cache ADD COLUMN voice_acting TEXT"); } catch (e) { }

  // Migrations for source tracking in movies
  try { db.exec("ALTER TABLE movies ADD COLUMN source_collection_name TEXT"); } catch (e) { }
  try { db.exec("ALTER TABLE movies ADD COLUMN source_collection_token TEXT"); } catch (e) { }
  try { db.exec("ALTER TABLE movies ADD COLUMN source_user_name TEXT"); } catch (e) { }

  // --- ENTERPRISE DATABASE INTEGRITY AUTO-CLEANUP ---
  console.log('🔄 Running database relation integrity checks...');
  try {
    // 1. Temporarily disable foreign keys to avoid cascade errors during cleanup
    db.exec('PRAGMA foreign_keys = OFF;');

    // 2. Clean up orphaned movies referencing non-existent users
    const orphanedMovies = db.prepare(`
      DELETE FROM movies 
      WHERE user_id IS NOT NULL 
        AND user_id NOT IN (SELECT id FROM users)
    `).run();
    if (orphanedMovies.changes > 0) {
      console.log(`🧹 Cleaned up ${orphanedMovies.changes} orphaned movies referencing missing users.`);
    }

    // 3. Clean up orphaned collections referencing non-existent users
    const orphanedColls = db.prepare(`
      DELETE FROM collections 
      WHERE user_id IS NOT NULL 
        AND user_id NOT IN (SELECT id FROM users)
    `).run();
    if (orphanedColls.changes > 0) {
      console.log(`🧹 Cleaned up ${orphanedColls.changes} orphaned collections referencing missing users.`);
    }

    // 4. Clean up orphaned collection-to-movie mapping relationships
    const orphanedCollMovies = db.prepare(`
      DELETE FROM collection_movies 
      WHERE collection_id NOT IN (SELECT id FROM collections)
         OR movie_id NOT IN (SELECT id FROM movies)
    `).run();
    if (orphanedCollMovies.changes > 0) {
      console.log(`🧹 Cleaned up ${orphanedCollMovies.changes} orphaned movie-collection associations.`);
    }

    // 5. Clean up orphaned shared collections
    const orphanedShared = db.prepare(`
      DELETE FROM shared_collections 
      WHERE collection_id NOT IN (SELECT id FROM collections)
         OR sender_id NOT IN (SELECT id FROM users)
         OR recipient_id NOT IN (SELECT id FROM users)
    `).run();
    if (orphanedShared.changes > 0) {
      console.log(`🧹 Cleaned up ${orphanedShared.changes} orphaned shared collection entries.`);
    }

    // 6. Permanently enable foreign keys for perfect future cascading and reference integrity
    db.exec('PRAGMA foreign_keys = ON;');
    console.log('🟢 SQLite relation integrity verified & FOREIGN KEY constraints enabled.');
  } catch (err) {
    console.error('❌ Database integrity cleanup failed:', err);
  }
};

const getSetting = (key, defaultValue = null) => {
  try {
    const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key);
    if (!row) return defaultValue;
    try {
      return JSON.parse(row.value);
    } catch (e) {
      return row.value;
    }
  } catch (err) {
    console.error(`Failed to get setting ${key}:`, err);
    return defaultValue;
  }
};

const setSetting = (key, value) => {
  try {
    const valStr = typeof value === 'object' ? JSON.stringify(value) : value;
    db.prepare('INSERT INTO system_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?').run(key, valStr, valStr);
    return true;
  } catch (err) {
    console.error(`Failed to set setting ${key}:`, err);
    return false;
  }
};

module.exports = { db, initDb, getSetting, setSetting };
