const axios = require('axios');

// TMDB API Key provided by user
const TMDB_API_KEY = 'd74e44bd257c4324cd9cc2a39aabe12a';
const BASE_URL = 'https://api.themoviedb.org/3';

// Helper to delay requests if needed (TMDB has 40 req/sec limit, which is huge, but good to be safe)
const delay = ms => new Promise(res => setTimeout(res, ms));

/**
 * Maps TMDB data to our database schema
 */
function formatTmdbData(tmdbData, isTv = false) {
    if (!tmdbData) return null;

    const genres = tmdbData.genres ? tmdbData.genres.map(g => g.name).join(', ') : null;
    
    // Extract top 10 actors
    let actors = null;
    let director = null;
    let writers = null;

    if (tmdbData.credits) {
        if (tmdbData.credits.cast) {
            actors = tmdbData.credits.cast.slice(0, 10).map(c => c.name).join(', ');
        }
        if (tmdbData.credits.crew) {
            const directorObj = tmdbData.credits.crew.find(c => c.job === 'Director' || c.department === 'Directing');
            if (directorObj) director = directorObj.name;

            const writerObjs = tmdbData.credits.crew.filter(c => c.department === 'Writing');
            if (writerObjs && writerObjs.length > 0) {
                writers = writerObjs.map(w => w.name).join(', ');
            }
        }
    }

    const country = tmdbData.production_countries ? tmdbData.production_countries.map(c => c.name).join(', ') : null;
    
    let duration = null;
    if (isTv && tmdbData.episode_run_time && tmdbData.episode_run_time.length > 0) {
        duration = `${tmdbData.episode_run_time[0]} мин.`;
    } else if (!isTv && tmdbData.runtime) {
        duration = `${tmdbData.runtime} мин.`;
    }

    const poster_url = tmdbData.poster_path ? `https://image.tmdb.org/t/p/w780${tmdbData.poster_path}` : null;

    return {
        description: tmdbData.overview || null,
        poster_url: poster_url,
        genres: genres,
        actors: actors,
        director: director,
        writers: writers,
        country: country,
        duration: duration
    };
}

/**
 * Searches TMDB for a movie/series and fetches its full details.
 * @param {string} title The title (Russian or Original)
 * @param {string} original_title The original title (optional)
 * @param {number} year The release year
 * @param {string} type 'movie' or 'series'
 * @returns {Promise<Object>} Formatted details
 */
async function getTmdbDetails(title, original_title, year, type) {
    if (!title) return null;

    const isTv = type === 'series';
    const searchEndpoint = isTv ? '/search/tv' : '/search/movie';
    const detailsEndpoint = isTv ? '/tv' : '/movie';

    try {
        // 1. Search for the item
        let results = [];
        
        // Helper function to execute search
        const doSearch = async (queryStr, useYear) => {
            if (!queryStr) return [];
            try {
                // If title has Russian and English like "Интерстеллар / Interstellar", split and take first
                const cleanQuery = queryStr.split('/')[0].trim();
                const res = await axios.get(`${BASE_URL}${searchEndpoint}`, {
                    params: {
                        api_key: TMDB_API_KEY,
                        query: cleanQuery,
                        primary_release_year: (!isTv && useYear) ? year : undefined,
                        first_air_date_year: (isTv && useYear) ? year : undefined,
                        language: 'ru-RU'
                    }
                });
                return res.data.results;
            } catch (e) {
                return [];
            }
        };

        // Try title with year
        results = await doSearch(title, true);
        
        // Try original_title with year
        if (results.length === 0 && original_title) {
            results = await doSearch(original_title, true);
        }
        
        // Try without year
        if (results.length === 0 && year) {
            results = await doSearch(title, false);
            if (results.length === 0 && original_title) {
                results = await doSearch(original_title, false);
            }
        }

        if (results.length === 0) {
            console.log(`[TMDB] No results found for: ${title} / ${original_title} (${year})`);
            return null; // Not found on TMDB
        }

        const topMatch = results[0];
        const tmdbId = topMatch.id;

        // 2. Fetch full details (append_to_response=credits to get actors/director)
        const detailsRes = await axios.get(`${BASE_URL}${detailsEndpoint}/${tmdbId}`, {
            params: {
                api_key: TMDB_API_KEY,
                language: 'ru-RU',
                append_to_response: 'credits'
            }
        });

        const details = formatTmdbData(detailsRes.data, isTv);
        
        // Return original title if needed, but we mainly care about metadata
        return details;

    } catch (err) {
        console.error(`[TMDB Error] Failed to fetch details for ${title}:`, err.message);
        return null; // Gracefully fail
    }
}

module.exports = {
    getTmdbDetails
};
