const axios = require('axios');
const cheerio = require('cheerio');

// Polite delays
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Rotation of realistic user agents
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36'
];

const BASE_HEADERS = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Upgrade-Insecure-Requests': '1'
};

// Active HDRezka mirrors
const MIRRORS = [
    'https://hdrezka-home.tv',
    'https://hdrezka.ag',
    'https://hdrezka.sh',
    'https://hdrezka.me',
    'https://hdrezka.re'
];
let currentMirrorIndex = 0;

// Dual In-Memory Caches to prevent unnecessary outbound traffic
const searchCache = new Map();
const detailsCache = new Map();
const categoryCache = new Map();
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 Hours TTL
const CATEGORY_CACHE_TTL = 60 * 60 * 1000; // 1 Hour TTL

function getFromCache(cache, key, ttl = CACHE_TTL) {
    const entry = cache.get(key);
    if (entry && (Date.now() - entry.timestamp < ttl)) {
        return entry.data;
    }
    return null;
}

function setToCache(cache, key, data) {
    cache.set(key, { data, timestamp: Date.now() });
    if (cache.size > 250) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
    }
}

// Rewrites any target path/URL to use the currently active mirror
function getActiveUrl(pathOrUrl) {
    const mirror = MIRRORS[currentMirrorIndex];
    if (!pathOrUrl) return mirror;
    // Strip old domains if a full URL was provided
    const path = pathOrUrl.replace(/^https?:\/\/[^\/]+/, '');
    return `${mirror}${path}`;
}

// Professional request wrapper with retry, backoff, UA-rotation, and mirror fallbacks
async function requestWithRetry(urlPath, options = {}, retries = 3) {
    let lastError;
    for (let attempt = 0; attempt < retries; attempt++) {
        // Only delay on retries, not on the first attempt
        if (attempt > 0) {
            await delay(300 + Math.random() * 300);
        }

        const activeUrl = getActiveUrl(urlPath);
        const headers = {
            ...BASE_HEADERS,
            'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
            'Referer': MIRRORS[currentMirrorIndex] + '/',
            ...(options.headers || {}) // Merge custom client spoofed headers if provided!
        };

        try {
            console.log(`[Scraper] Request (Attempt ${attempt + 1}/${retries}): ${activeUrl}`);
            const response = await axios.get(activeUrl, {
                ...options,
                headers,
                timeout: 6000 // reduced from 8s to 6s
            });
            return response;
        } catch (err) {
            lastError = err;
            const status = err.response ? err.response.status : null;
            console.warn(`[Scraper] Failed on ${activeUrl} (Status ${status}): ${err.message}`);

            // Automatically switch to next mirror on blocking, timeouts, or server faults
            if (!status || status === 429 || status === 403 || status >= 500) {
                currentMirrorIndex = (currentMirrorIndex + 1) % MIRRORS.length;
                console.log(`[Scraper] Rotating active mirror domain to: ${MIRRORS[currentMirrorIndex]}`);
            }

            // Exponential backoff on retries
            await delay(800 * Math.pow(2, attempt));
        }
    }
    throw new Error(`Scraper request failed after ${retries} retries. Last error: ${lastError.message}`);
}

function parseMovieList($) {
    const results = [];
    $('.b-content__inline_item').each((i, el) => {
        const link = $(el).find('.b-content__inline_item-link a').attr('href');
        const title = $(el).find('.b-content__inline_item-link a').text().trim();
        let misc = $(el).find('.b-content__inline_item-link div').text().trim();
        const img = $(el).find('.b-content__inline_item-cover img').attr('src');
        const rating = ($(el).find('.rating').text() ||
            $(el).find('.average').text() ||
            $(el).find('.ra').text() ||
            $(el).find('.kp').text() ||
            $(el).find('.imdb').text() ||
            $(el).find('.ball').text()).trim();

        const yearMatch = misc.match(/(\d{4})/);
        const year = yearMatch ? parseInt(yearMatch[1]) : null;
        const type = link?.includes('/series/') ? 'series' : 'movie';

        if (link?.includes('/cartoons/')) {
            if (!misc.includes('Мультфильм')) misc += ', Мультфильм';
        }
        if (link?.includes('/animation/')) {
            if (!misc.includes('Аниме')) misc += ', Аниме';
        }

        if (link && title) {
            results.push({ link, title, year, img, misc, rating, type });
        }
    });
    return results;
}

async function searchMovies(query, customHeaders = {}) {
    const cacheKey = query.trim().toLowerCase();
    const cached = getFromCache(searchCache, cacheKey);
    if (cached) {
        console.log(`[Scraper] Cache hit for search query: "${query}"`);
        return cached;
    }

    try {
        const searchPath = `/search/?do=search&subaction=search&q=${encodeURIComponent(query)}`;
        const { data } = await requestWithRetry(searchPath, { headers: customHeaders });
        const $ = cheerio.load(data);

        const results = parseMovieList($);
        console.log(`[Scraper] Search found ${results.length} results`);

        // Cache and return immediately — rating enrichment happens async via background updates
        setToCache(searchCache, cacheKey, results);
        return results;

    } catch (error) {
        console.error('Search Error:', error.message);
        return [];
    }
}

async function getCategoryMovies(filter) {
    const cached = getFromCache(categoryCache, filter, CATEGORY_CACHE_TTL);
    if (cached) {
        console.log(`[Scraper] Cache hit for category filter: ${filter}`);
        return cached;
    }

    try {
        const catPath = `/new/?filter=${filter}`;
        const { data } = await requestWithRetry(catPath);
        const $ = cheerio.load(data);
        const results = parseMovieList($);
        setToCache(categoryCache, filter, results);
        return results;
    } catch (error) {
        console.error(`Category Error (${filter}):`, error.message);
        return [];
    }
}

async function getMovieDetails(url, customHeaders = {}) {
    const cached = getFromCache(detailsCache, url);
    if (cached) {
        console.log(`[Scraper] Cache hit for details URL: ${url}`);
        return cached;
    }

    try {
        const { data } = await requestWithRetry(url, { headers: customHeaders });
        const $ = cheerio.load(data);

        const original_title = $('.b-post__origtitle').text().trim();
        const title = $('.b-post__title h1').text().trim();
        const trailer_id = $('.show-trailer').attr('data-id') || null;

        const getTableValue = (label) => {
            return $(`.b-post__info tr:contains("${label}") td:nth-child(2)`).text().trim();
        };

        let ratingText = $('.b-post__rating span.num').text().trim();
        if (!ratingText) {
            ratingText = $('[itemprop="average"]').text().trim();
        }
        if (!ratingText) {
            ratingText = $('.b-post__rating_wrapper .bold').text().trim();
        }
        const rating = ratingText ? parseFloat(ratingText) : null;
        const description = $('.b-post__description_text').text().trim();

        let poster_url = $('img[itemprop="image"]').attr('src');
        if (!poster_url) {
            poster_url = $('.b-side__poster img').attr('src');
        }

        let genres = $('span[itemprop="genre"]').map((i, el) => $(el).text().trim()).get().join(', ');
        if (!genres) {
            genres = $(`.b-post__info tr:contains("Жанр") td:nth-child(2)`).text().trim();
        }

        const directorLine = getTableValue('Режиссер');
        const director = directorLine || '';

        const writersLine = getTableValue('Сценарист');
        const writers = writersLine || '';

        let actors = $('[itemprop="actor"] [itemprop="name"]').map((i, el) => $(el).text().trim()).get().join(', ');
        if (!actors) {
            const rowText = $(`.b-post__info tr:contains("В ролях")`).text().trim();
            if (rowText) {
                actors = rowText.replace(/^.*:\s*/, '').trim();
            }
        }

        const yearRow = getTableValue('Дата выхода');
        const yearMatch = yearRow ? yearRow.match(/\d{4}/) : title.match(/\d{4}/);
        const year = yearMatch ? parseInt(yearMatch[0]) : null;

        const country = getTableValue('Страна');
        const duration = getTableValue('Время');
        
        let voice_acting = getTableValue('В переводе');
        if (!voice_acting) voice_acting = getTableValue('Озвучка');

        let type = url.includes('/series/') ? 'series' : 'movie';

        if (url.includes('/cartoons/') && !genres.toLowerCase().includes('мульт')) {
            genres = 'Мультфильмы, ' + genres;
        }
        if (url.includes('/animation/') && !genres.toLowerCase().includes('аниме')) {
            genres = 'Аниме, ' + genres;
        }

        const result = {
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
            country,
            duration,
            voice_acting,
            type,
            trailer_id
        };

        setToCache(detailsCache, url, result);
        return result;

    } catch (error) {
        console.error('Parse Details Error:', error.message);
        throw error;
    }
}

async function getHdrezkaComments(url, page = 1) {
    if (!url) return { comments: [], hasMore: false };
    const PAGE_SIZE = 25;
    try {
        const qs = require('querystring');
        // Fetch the page HTML first to get the news_id
        const { data: html } = await requestWithRetry(url);
        if (!html) return { comments: [], hasMore: false };
        
        const newsIdMatch = html.match(/news_id\s*=\s*(\d+)/) || html.match(/data-id="(\d+)"/);
        const newsId = newsIdMatch ? newsIdMatch[1] : null;
        if (!newsId) {
            console.warn('[Scraper] Could not extract news_id from page:', url);
            return { comments: [], hasMore: false };
        }

        const parsedUrl = new URL(url);
        const origin = parsedUrl.origin;
        const randomUA = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

        // cstart is 1-based page number in HDRezka's API
        const cstart = page;
        console.log(`[Scraper] Fetching comments page ${page} (cstart=${cstart}) for news_id=${newsId}`);

        // Fetch comments HTML via their AJAX endpoint
        const commentsRes = await axios.post(`${origin}/ajax/get_comments/?t=${Date.now()}`, qs.stringify({
            news_id: newsId,
            cstart,
            type: 0,
            comment_id: 0,
            skin: 'hdrezka'
        }), {
            headers: {
                ...BASE_HEADERS,
                'User-Agent': randomUA,
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': url,
                'Origin': origin
            },
            timeout: 15000
        });

        const responseData = commentsRes.data;
        console.log('[Scraper] Comments response keys:', Object.keys(responseData || {}));

        const commentsHtml = responseData.comments || responseData.html || responseData.data;
        if (!commentsHtml) {
            console.warn('[Scraper] No comments HTML in response:', JSON.stringify(responseData).slice(0, 200));
            return { comments: [], hasMore: false };
        }

        const $ = cheerio.load(commentsHtml);
        const comments = [];
        
        $('.comments-tree-item').each((i, el) => {
            const author = $(el).find('.name, .author, span.name').first().text().trim();
            const date = $(el).find('.date').first().text().trim();
            const text = $(el).find('div.text').first().text().trim() || $(el).find('div.message').first().text().trim();
            const avatar = $(el).find('.ava img').attr('src');
            
            if (author && text) {
                comments.push({
                    id: $(el).attr('data-id') || `${page}_${i}`,
                    author,
                    date,
                    text,
                    avatar: avatar && avatar.startsWith('http') ? avatar : (avatar ? `${origin}${avatar}` : null)
                });
            }
        });

        console.log(`[Scraper] Parsed ${comments.length} comments from page ${page}`);

        // HDRezka paginates by PAGE_SIZE (25) per cstart page
        // If we got a full page, there are likely more
        const hasMore = comments.length >= PAGE_SIZE;

        return { comments, hasMore, page };
    } catch (e) {
        console.error('[Scraper] Failed to fetch comments:', e.message);
        return { comments: [], hasMore: false };
    }
}

async function getHdrezkaTrailer(id) {
    if (!id) return null;
    try {
        const qs = require('querystring');
        const url = MIRRORS[currentMirrorIndex] + '/ajax/get_trailer/';
        const randomUA = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
        
        const res = await axios.post(url, qs.stringify({ id }), {
            headers: {
                ...BASE_HEADERS,
                'User-Agent': randomUA,
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                'Origin': MIRRORS[currentMirrorIndex]
            },
            timeout: 10000
        });
        
        // Response is usually JSON: { success: true, code: "<iframe ...></iframe>" }
        // Or sometimes just plain HTML.
        const data = res.data;
        if (data && data.success && data.code) {
            return data.code;
        } else if (typeof data === 'string' && data.includes('<iframe')) {
            return data;
        }
        return null;
    } catch (e) {
        console.error('[Scraper] Failed to fetch trailer:', e.message);
        return null;
    }
}

async function scrapeCatalogPage(path) {
    try {
        const { data } = await requestWithRetry(path);
        const $ = cheerio.load(data);
        return parseMovieList($);
    } catch (error) {
        console.error(`Catalog Page Scrape Error (${path}):`, error.message);
        return [];
    }
}

module.exports = { searchMovies, getMovieDetails, getCategoryMovies, getHdrezkaComments, scrapeCatalogPage, getHdrezkaTrailer };
