const axios = require('axios');
const cheerio = require('cheerio');
const { getMovieDetails } = require('./scraper');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'ru-RU,ru;q=0.8,en-US;q=0.5,en;q=0.3'
};

(async () => {
    try {
        const url = 'https://hdrezka-home.tv/films/action/770-nachalo-2010.html';
        const { data } = await axios.get(url, { headers: HEADERS });
        const $ = cheerio.load(data);

        console.log('--- Debugging Actors Row ---');
        const actorsRow = $('.b-post__info tr').filter((i, el) => $(el).text().includes('В ролях')).html();
        console.log('Actors Row HTML:', actorsRow);

        console.log('--- Debugging Writers ---');
        const bodyText = $('body').text();
        const hasWriter = bodyText.includes('Сценарист');
        console.log('Page has "Сценарист":', hasWriter);

        if (hasWriter) {
            // Find where it is
            console.log('Finding parent of Сценарист...');
            const writerEl = $('*:contains("Сценарист")').last();
            console.log('Writer Element:', writerEl.prop('tagName'), writerEl.parent().html());
        }

    } catch (e) {
        console.error(e);
    }
})();
