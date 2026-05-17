const axios = require('axios');
const cheerio = require('cheerio');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
};

const BASE_URL = 'https://hdrezka.ag';

async function testSearch(query) {
    try {
        const url = `${BASE_URL}/search/?do=search&subaction=search&q=${encodeURIComponent(query)}`;
        const { data } = await axios.get(url, { headers: HEADERS });
        const $ = cheerio.load(data);

        $('.b-content__inline_item').each((i, el) => {
            const title = $(el).find('.b-content__inline_item-link a').text().trim();
            console.log(`\nResult ${i + 1}: ${title}`);

            // Log ALL children text and classes
            $(el).find('*').each((j, node) => {
                const cls = $(node).attr('class');
                const text = $(node).text().trim();
                const id = $(node).attr('id');
                const dataRating = $(node).attr('data-rating');

                if (text || cls || id || dataRating) {
                    console.log(`  - ${node.tagName}${cls ? '.' + cls.split(' ').join('.') : ''}${id ? '#' + id : ''} content: "${text}" data-rating: "${dataRating || ''}"`);
                }
            });
        });
    } catch (err) {
        console.error(err);
    }
}

testSearch('The Dark Knight');
