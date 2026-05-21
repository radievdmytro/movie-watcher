const { scrapeCatalogPage } = require('./scraper');
const { db } = require('./db');

// Gentle helper to wait
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runBulkCrawler() {
    console.log('🚀 Starting Seed Bulk Crawler for Web Cache Database...');
    
    // We will scrape catalog pages for films, series, cartoons, and anime
    const categories = [
        { path: '/films/', type: 'movie' },
        { path: '/series/', type: 'series' },
        { path: '/cartoons/', type: 'movie' },
        { path: '/animation/', type: 'series' }
    ];

    // Grab command line arguments if provided
    const args = process.argv.slice(2);
    const pagesToScrape = parseInt(args.find(a => a.startsWith('--pages='))?.split('=')[1]) || 5;

    console.log(`ℹ️ Configured to scrape the first ${pagesToScrape} pages of each category.`);
    let totalImported = 0;

    for (const cat of categories) {
        const catName = cat.path.replace(/\//g, ''); // e.g. films
        console.log(`\n📂 Crawling category: ${cat.path} (type: ${cat.type})...`);
        
        // Get already-crawled page numbers
        const crawledRows = db.prepare(
            'SELECT page_number FROM crawled_pages WHERE category = ? ORDER BY page_number ASC'
        ).all(catName);
        const crawledSet = new Set(crawledRows.map(r => r.page_number));
        
        // Find next N uncrawled pages
        const uncrawledPages = [];
        let candidate = 1;
        while (uncrawledPages.length < pagesToScrape && candidate <= 2000) {
            if (!crawledSet.has(candidate)) {
                uncrawledPages.push(candidate);
            }
            candidate++;
        }

        console.log(`ℹ️ Found ${crawledSet.size} previously crawled pages. Will crawl ${uncrawledPages.length} new pages.`);

        for (let i = 0; i < uncrawledPages.length; i++) {
            const page = uncrawledPages[i];
            const pagePath = page === 1 ? cat.path : `${cat.path}page/${page}/`;
            console.log(`📖 Loading page ${page} (${i+1}/${uncrawledPages.length}): ${pagePath}`);

            try {
                const movies = await scrapeCatalogPage(pagePath);
                const moviesFound = movies ? movies.length : 0;
                let insertedCount = 0;

                if (!movies || movies.length === 0) {
                    console.log(`⚠️ No movies found on page ${page}. Marking as empty.`);
                } else {
                    console.log(`📦 Found ${movies.length} movies on catalog page. Inserting into cache...`);
                    
                    const insertStmt = db.prepare(`
                        INSERT INTO scraped_movies_cache 
                        (title, original_title, year, link, rating, poster_url, genres, type, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                        ON CONFLICT(link) DO NOTHING
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
                                // ignore individual errors
                            }
                        }
                        return count;
                    });

                    insertedCount = insertTx(movies);
                    totalImported += insertedCount;
                    console.log(`✅ Successfully cached ${insertedCount} NEW movies from this page.`);
                }
                
                // Record page as crawled
                try {
                    db.prepare(`
                        INSERT INTO crawled_pages (category, page_number, movies_found, new_movies_added, crawled_at)
                        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                        ON CONFLICT(category, page_number) DO UPDATE SET
                            movies_found = excluded.movies_found,
                            new_movies_added = excluded.new_movies_added,
                            crawled_at = CURRENT_TIMESTAMP
                    `).run(catName, page, moviesFound, insertedCount);
                } catch (e) {}

                // Gentle delay to be polite to the mirror
                await delay(1500 + Math.random() * 1000);
            } catch (err) {
                console.error(`❌ Failed to crawl page ${pagePath}:`, err.message);
                // Record broken page to avoid infinite retries
                try {
                    db.prepare(`
                        INSERT OR IGNORE INTO crawled_pages (category, page_number, movies_found, new_movies_added, crawled_at)
                        VALUES (?, ?, 0, 0, CURRENT_TIMESTAMP)
                    `).run(catName, page);
                } catch (e) {}
                await delay(5000); // larger fallback delay
            }
        }
    }

    // Output stats of the cache database
    try {
        const stats = db.prepare('SELECT COUNT(*) as count FROM scraped_movies_cache').get();
        console.log(`\n🎉 Crawl finished! Cache database now contains: ${stats.count} movies.`);
    } catch (e) {
        console.log(`\n🎉 Crawl finished! Successfully indexed ${totalImported} movies.`);
    }
    process.exit(0);
}

runBulkCrawler();
