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
        console.log(`\n📂 Crawling category: ${cat.path} (type: ${cat.type})...`);
        for (let page = 1; page <= pagesToScrape; page++) {
            const pagePath = page === 1 ? cat.path : `${cat.path}page/${page}/`;
            console.log(`📖 Loading page ${page}/${pagesToScrape}: ${pagePath}`);

            try {
                const movies = await scrapeCatalogPage(pagePath);
                if (!movies || movies.length === 0) {
                    console.log(`⚠️ No movies found on page ${page}, skipping.`);
                    continue;
                }

                console.log(`📦 Found ${movies.length} movies on catalog page. Inserting into cache...`);
                
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
                            insertStmt.run(
                                m.title,
                                m.original_title || '',
                                m.year,
                                m.link,
                                parsedRating,
                                m.img,
                                m.misc,
                                m.type || cat.type
                            );
                            count++;
                        } catch (err) {
                            // ignore individual errors like duplicates
                        }
                    }
                    return count;
                });

                const insertedCount = insertTx(movies);
                totalImported += insertedCount;
                console.log(`✅ Successfully cached ${insertedCount} movies from this page.`);

                // Gentle delay to be polite to the mirror
                await delay(1500 + Math.random() * 1000);
            } catch (err) {
                console.error(`❌ Failed to crawl page ${pagePath}:`, err.message);
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
