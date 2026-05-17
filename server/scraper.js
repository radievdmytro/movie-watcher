const axios = require('axios');
const cheerio = require('cheerio');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Referer': 'https://hdrezka-home.tv/',
    'Upgrade-Insecure-Requests': '1'
};

const BASE_URL = 'https://hdrezka-home.tv';

function parseMovieList($) {
    const results = [];
    $('.b-content__inline_item').each((i, el) => {
        const link = $(el).find('.b-content__inline_item-link a').attr('href');
        const title = $(el).find('.b-content__inline_item-link a').text().trim();
        let misc = $(el).find('.b-content__inline_item-link div').text().trim(); // E.g., "2010, США, Фантастика"
        const img = $(el).find('.b-content__inline_item-cover img').attr('src');
        const rating = ($(el).find('.rating').text() ||
            $(el).find('.average').text() ||
            $(el).find('.ra').text() ||
            $(el).find('.kp').text() ||
            $(el).find('.imdb').text() ||
            $(el).find('.ball').text()).trim();

        // Extract Year
        const yearMatch = misc.match(/(\d{4})/);
        const year = yearMatch ? parseInt(yearMatch[1]) : null;

        const type = link.includes('/series/') ? 'series' : 'movie';

        if (link.includes('/cartoons/')) {
            if (!misc.includes('Мультфильм')) misc += ', Мультфильм';
        }
        if (link.includes('/animation/')) {
            if (!misc.includes('Аниме')) misc += ', Аниме';
        }

        if (link && title) {
            results.push({ link, title, year, img, misc, rating, type });
        }
    });
    return results;
}

async function searchMovies(query) {
    try {
        const url = `${BASE_URL}/search/?do=search&subaction=search&q=${encodeURIComponent(query)}`;
        console.log(`[Scraper] Searching: ${url}`);
        const { data } = await axios.get(url, { headers: HEADERS });
        const $ = cheerio.load(data);

        const results = parseMovieList($);
        console.log(`[Scraper] Found ${results.length} results`);

        // Optimization: Fetch ratings for top 8 results if they are missing
        const resultsToEnhance = results.slice(0, 8).filter(r => !r.rating);
        if (resultsToEnhance.length > 0) {
            await Promise.all(resultsToEnhance.map(async (r) => {
                try {
                    const details = await getMovieDetails(r.link);
                    if (details && details.rating) {
                        r.rating = details.rating;
                    }
                } catch (e) {
                    // Ignore fail for individual items
                }
            }));
        }

        return results;

    } catch (error) {
        console.error('Search Error:', error.message);
        return [];
    }
}

async function getCategoryMovies(filter) {
    try {
        // filter: 'watching', 'last', 'popular'
        const url = `${BASE_URL}/new/?filter=${filter}`;
        const { data } = await axios.get(url, { headers: HEADERS });
        const $ = cheerio.load(data);
        return parseMovieList($);
    } catch (error) {
        console.error(`Category Error (${filter}):`, error.message);
        return [];
    }
}

async function getMovieDetails(url) {
    try {
        console.log(`[Scraper] Getting details: ${url}`);
        const { data } = await axios.get(url, { headers: HEADERS });
        const $ = cheerio.load(data);

        const original_title = $('.b-post__origtitle').text().trim();
        const title = $('.b-post__title h1').text().trim();

        // Handling table data
        const getTableValue = (label) => {
            return $(`.b-post__info tr:contains("${label}") td:nth-child(2)`).text().trim();
        };

        // Handling rating from multiple potential sources
        let ratingText = $('.b-post__rating span.num').text().trim(); // User suggestion area
        if (!ratingText) {
            ratingText = $('[itemprop="average"]').text().trim();
        }
        if (!ratingText) {
            ratingText = $('.b-post__rating_wrapper .bold').text().trim();
        }
        const rating = ratingText ? parseFloat(ratingText) : null;

        const description = $('.b-post__description_text').text().trim();

        // Try precise selector first, fall back to class based
        let poster_url = $('img[itemprop="image"]').attr('src');
        if (!poster_url) {
            poster_url = $('.b-side__poster img').attr('src');
        }

        // Extract raw strings or arrays
        // Extract genres using schema markup or fallback to table row
        let genres = $('span[itemprop="genre"]').map((i, el) => $(el).text().trim()).get().join(', ');
        if (!genres) {
            // Fallback: finding the row with "Жанр" and getting text
            genres = $(`.b-post__info tr:contains("Жанр") td:nth-child(2)`).text().trim();
        }

        const directorLine = getTableValue('Режиссер');
        const director = directorLine || '';

        const writersLine = getTableValue('Сценарист');
        const writers = writersLine || '';

        // Extract actors using schema
        let actors = $('[itemprop="actor"] [itemprop="name"]').map((i, el) => $(el).text().trim()).get().join(', ');
        if (!actors) {
            // Fallback to table text, handling potential colspan
            const rowText = $(`.b-post__info tr:contains("В ролях")`).text().trim();
            if (rowText) {
                actors = rowText.replace(/^.*:\s*/, '').trim();
            }
        }

        // Year often in title or table
        const yearRow = getTableValue('Дата выхода');
        const yearMatch = yearRow ? yearRow.match(/\d{4}/) : title.match(/\d{4}/);
        const year = yearMatch ? parseInt(yearMatch[0]) : null;

        let type = url.includes('/series/') ? 'series' : 'movie';

        // Augment genres from URL path if missing
        if (url.includes('/cartoons/') && !genres.toLowerCase().includes('мульт')) {
            genres = 'Мультфильмы, ' + genres;
        }
        if (url.includes('/animation/') && !genres.toLowerCase().includes('аниме')) {
            genres = 'Аниме, ' + genres;
        }

        return {
            title,
            original_title,
            year,
            link: url,
            rating,
            description,
            poster_url,
            genres,
            actors,
            director,
            writers,
            type
        };

    } catch (error) {
        console.error('Parse Details Error:', error.message);
        throw error;
    }
}

module.exports = { searchMovies, getMovieDetails, getCategoryMovies };
