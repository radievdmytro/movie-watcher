const Database = require('better-sqlite3');
const path = require('path');

const db = new Database('movies.db', { verbose: console.log });

const initDb = () => {
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

  // Migration for user_id in movies
  try {
    db.exec("ALTER TABLE movies ADD COLUMN user_id INTEGER");
  } catch (e) { }

  // Migration for user_id in collections
  try {
    db.exec("ALTER TABLE collections ADD COLUMN user_id INTEGER");
  } catch (e) { }

  // Migration for share_token in collections
  try {
    db.exec("ALTER TABLE collections ADD COLUMN share_token TEXT");
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

module.exports = { db, initDb };

