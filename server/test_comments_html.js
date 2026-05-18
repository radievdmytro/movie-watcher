const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
    const res = await axios.get('https://hdrezka-home.tv/films/fiction/981-matrica-1999-latest.html', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            'Cookie': 'dle_user_id=0' // Just to set some cookies
        }
    });
    
    // Look for comments inside the HTML
    const $ = cheerio.load(res.data);
    
    const commentsList = $('#comments-tree-item, .comments-tree-list, #comments-list');
    console.log('Comments container found:', commentsList.length);
    
    let html = res.data;
    // extract anything with class="comments"
    const commentsDivs = $('.comments-tree-list li');
    console.log('Comments list items:', commentsDivs.length);
    
    // If not found, let's output a chunk of HTML that contains "комментари" or "comments"
    if (commentsDivs.length === 0) {
        const commentIndex = html.indexOf('id="comments"');
        if (commentIndex > -1) {
            console.log(html.substring(commentIndex - 50, commentIndex + 500));
        } else {
             const commentIdx2 = html.indexOf('comments-tree');
             if (commentIdx2 > -1) {
                 console.log(html.substring(commentIdx2 - 50, commentIdx2 + 500));
             } else {
                 console.log("No comments section found in HTML.");
                 // Write the entire HTML to a file so I can grep it.
                 require('fs').writeFileSync('server/rezka_html.html', html);
             }
        }
    } else {
         const first = commentsDivs.first();
         console.log(first.html().substring(0, 500));
    }
}
test();
