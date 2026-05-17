const Database = require('better-sqlite3');
const path = require('path');

const db = new Database('movies.db', { verbose: console.log });

const initDb = () => {
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
      deleted_at DATETIME DEFAULT NULL
    )
  `;
  db.exec(createTableQuery);

  const createCollectionsTableQuery = `
    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
};

module.exports = { db, initDb };

