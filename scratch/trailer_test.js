const { requestWithRetry } = require('../server/scraper.js');

async function test() {
    try {
        const res = await requestWithRetry('https://hdrezka-home.tv/ajax/get_trailer/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest'
            },
            data: 'id=46317'
        });
        console.log(res.data);
    } catch (e) {
        console.error(e);
    }
}
test();
