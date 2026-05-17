const axios = require('axios');
const cheerio = require('cheerio');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
};

const MIRRORS = [
    'https://hdrezka.ag',
    'https://hdrezka.sh',
    'https://hdrezka.me',
    'https://hdrezka.re'
];

async function testMirrors(query) {
    for (const mirror of MIRRORS) {
        try {
            const url = `${mirror}/search/?do=search&subaction=search&q=${encodeURIComponent(query)}`;
            console.log(`\nTesting Mirror: ${mirror}`);
            const { data } = await axios.get(url, { headers: HEADERS, timeout: 5000 });
            const $ = cheerio.load(data);

            $('.b-content__inline_item').each((i, el) => {
                if (i > 0) return;
                const title = $(el).find('.b-content__inline_item-link a').text().trim();
                const rating = $(el).find('.rating').text().trim();
                const average = $(el).find('.average').text().trim();
                console.log(`  Result: ${title} | .rating: "${rating}" | .average: "${average}"`);
            });
        } catch (err) {
            console.log(`  Error on ${mirror}: ${err.message}`);
        }
    }
}

testMirrors('Inception');
