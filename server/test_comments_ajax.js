const axios = require('axios');
const cheerio = require('cheerio');
const qs = require('querystring');

async function test() {
    const res = await axios.get('https://hdrezka-home.tv/films/fiction/981-matrica-1999-latest.html', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        }
    });
    
    // Search for news_id inside HTML (var news_id = 123)
    const newsIdMatch = res.data.match(/news_id\s*=\s*(\d+)/) || res.data.match(/data-id="(\d+)"/);
    const newsId = newsIdMatch ? newsIdMatch[1] : null;
    console.log('News ID:', newsId);

    if (newsId) {
        // Fetch comments via AJAX
        // Try DLE comments API
        try {
            const commentsRes = await axios.get(`https://hdrezka-home.tv/ajax/get_comments/?news_id=${newsId}&cstart=1`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0'
                }
            });
            console.log('AJAX response keys:', Object.keys(commentsRes.data));
            if (commentsRes.data.comments) {
                const $ = cheerio.load(commentsRes.data.comments);
                console.log('Found comments HTML. First element:', $('li, div').first().attr('class'));
            } else {
                console.log('AJAX response:', commentsRes.data.substring(0, 200));
            }
        } catch (e) {
            console.log('AJAX get_comments failed:', e.message);
        }
    }
}
test();
