const Database = require('better-sqlite3');
const db = new Database('./movies.db');
db.function('cyrillic_like', (text, pattern) => {
  if (!text || !pattern) return 0;
  const lowerText = text.toLowerCase();
  const lowerPattern = pattern.toLowerCase().replace(/%/g, '');
  return lowerText.includes(lowerPattern) ? 1 : 0;
});

const q = '%химия%';
const results = db.prepare(`
    SELECT title FROM scraped_movies_cache 
    WHERE cyrillic_like(title, ?) OR cyrillic_like(original_title, ?)
`).all(q, q);

console.log(`Found ${results.length} movies with 'химия' in title/original_title`);
console.log(results.slice(0, 15).map(r => r.title));
