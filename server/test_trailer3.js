const axios = require('axios');
const qs = require('querystring');

async function testTrailer() {
    const id = 46317;
    const url = 'https://hdrezka.me/ajax/get_trailer/';
    try {
        const res = await axios.post(url, qs.stringify({ id }), {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                'Origin': 'https://hdrezka.me'
            }
        });
        console.log('Status:', res.status);
        console.log('Data:', res.data);
    } catch (e) {
        console.error('Error fetching trailer:', e.message);
        if (e.response) {
            console.error('Response data:', e.response.data);
        }
    }
}
testTrailer();
