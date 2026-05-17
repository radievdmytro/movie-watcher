const axios = require('axios');
const cheerio = require('cheerio');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1',
};

const BASE_URL = 'https://m.hdrezka.ag'; // Mobile version

async function testSearch(query) {
    try {
        const url = `${BASE_URL}/search/?q=${encodeURIComponent(query)}`;
        console.log('Fetching:', url);
        const { data } = await axios.get(url, { headers: HEADERS });
        const $ = cheerio.load(data);

        $('.b-content__inline_item').each((i, el) => {
            if (i > 0) return;
            const title = $(el).find('.b-content__inline_item-link a').text().trim();
            console.log(`Result ${i + 1}: ${title}`);

            $(el).find('*').each((j, node) => {
                const t = $(node).text().trim();
                const cls = $(node).attr('class');
                if (t && t.length < 50) {
                    console.log(`  [${node.tagName}.${cls}]: "${t}"`);
                }
            });
        });
    } catch (err) {
        console.error(err);
    }
}

testSearch('The Dark Knight');
