const axios = require('axios');
const qs = require('querystring');

async function test() {
    try {
        const res = await axios.post('https://hdrezka-home.tv/ajax/get_comments/?t=' + Date.now(), qs.stringify({
            news_id: 981,
            cstart: 1,
            type: 0,
            comment_id: 0,
            skin: 'hdrezka'
        }), {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': 'https://hdrezka-home.tv/films/fiction/981-matrica-1999-latest.html'
            }
        });
        console.log('AJAX POST success!');
        console.log(Object.keys(res.data));
        console.log(typeof res.data.comments);
        if (typeof res.data === 'string') {
           console.log('String length:', res.data.length);
        } else {
           console.log(res.data.comments ? res.data.comments.substring(0, 500) : res.data);
        }
    } catch (e) {
        console.log('Error:', e.message);
    }
}
test();
