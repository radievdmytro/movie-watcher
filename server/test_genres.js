const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
    const url = 'https://hdrezka-home.tv/films/comedy/36292-tom-i-dzherri-2021.html';
    const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(data);
    console.log('Breadcrumbs:', $('.b-breadcrumbs').text().trim());
    console.log('Cat path:', $('.b-post__title h1').parent().text().trim());
}
test();
