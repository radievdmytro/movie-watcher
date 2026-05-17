const { getMovieDetails } = require('./scraper');

(async () => {
    try {
        const url = 'https://hdrezka-home.tv/films/action/770-nachalo-2010.html';
        const details = await getMovieDetails(url);
        console.log('Genres:', details.genres);
        console.log('Director:', details.director);
        console.log('Writers:', details.writers);
        console.log('Actors:', details.actors);
    } catch (e) {
        console.error(e);
    }
})();
