const { db } = require('./server/db');

const addCol = (col, type) => {
    try {
        console.log(`Attempting to add column ${col}...`);
        db.exec(`ALTER TABLE movies ADD COLUMN ${col} ${type}`);
        console.log(`Column ${col} added successfully.`);
    } catch (e) {
        console.log(`Error adding ${col}:`, e.message);
    }
};

addCol('country', 'TEXT');
addCol('duration', 'TEXT');
addCol('voice_acting', 'TEXT');
addCol('source_collection_name', 'TEXT');
addCol('source_collection_token', 'TEXT');
addCol('source_user_name', 'TEXT');

const cols = db.prepare("PRAGMA table_info(movies)").all();
console.log("Final Columns:", cols.map(c => c.name));
