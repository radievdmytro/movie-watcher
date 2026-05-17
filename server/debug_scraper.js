const { searchMovies, getCategoryMovies } = require('./scraper');

async function test() {
    console.log('Testing search for "Matrix"...');
    const results = await searchMovies('Matrix');
    console.log('Results count:', results.length);
    if (results.length > 0) {
        console.log('First result:', results[0]);
    } else {
        console.log('No results found.');
    }

    console.log('\nTesting category "last"...');
    const catResults = await getCategoryMovies('last');
    console.log('Category results count:', catResults.length);
    if (catResults.length > 0) {
        console.log('First category result:', catResults[0]);
    }
}

test();
