const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
    const res = await axios.get('https://hdrezka-home.tv/films/fiction/981-matrica-1999-latest.html', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        }
    });
    const $ = cheerio.load(res.data);
    
    // Log comment related classes
    const classList = [];
    $('[class*="comment"]').each((i, el) => {
        classList.push($(el).attr('class'));
    });
    console.log('Classes containing "comment":', [...new Set(classList)].slice(0, 15));

    // Try b-comment
    const comments = [];
    $('.b-comment').each((i, el) => {
        const author = $(el).find('.author, .name, .b-post__author').text().trim() || $(el).find('[itemprop="author"]').text().trim() || $(el).find('.title').text().trim();
        const date = $(el).find('.date, .b-post__date').text().trim();
        const text = $(el).find('.text, .b-post__txt').text().trim() || $(el).find('.message').text().trim();
        const avatar = $(el).find('.ava img, .b-post__ava img').attr('src');
        if (text) {
            comments.push({ author, date, text, avatar });
        }
    });
    console.log(`Found ${comments.length} comments.`);

    // If 0, let's look for ul.comments-tree or similar
    if (comments.length === 0) {
        console.log('Trying .comments-tree li');
        $('.comments-tree li').each((i, el) => {
            const author = $(el).find('.author').text().trim() || $(el).find('span.name').text().trim();
            const date = $(el).find('.date').text().trim();
            const text = $(el).find('.text').text().trim() || $(el).find('div.message').text().trim();
            const avatar = $(el).find('.ava img').attr('src') || $(el).find('img.avatar').attr('src');
            if (text) {
                comments.push({ author, date, text, avatar });
            }
        });
        console.log(`Found ${comments.length} comments with .comments-tree.`);
        if (comments.length > 0) console.log(comments[0]);
    }
}
test();
