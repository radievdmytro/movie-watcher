const { db } = require('./server/db');

try {
    console.log("Attempting to add column...");
    db.exec("ALTER TABLE movies ADD COLUMN deleted_at DATETIME DEFAULT NULL");
    console.log("Column added.");
} catch (e) {
    console.log("Error (probably exists):", e.message);
}

const cols = db.prepare("PRAGMA table_info(movies)").all();
console.log("Columns:", cols.map(c => c.name));
