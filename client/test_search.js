const movies = [{ title: "Дом", year: 2024 }, { title: "Интерстеллар", year: 2014 }];
const filterQuery = "дом";
const deferredFilterQuery = filterQuery;
const searchFields = { title: true, actor: true, director: true, year: true };

let scored = movies.map(movie => {
    let score = 0;
    if (deferredFilterQuery) {
        const q = deferredFilterQuery.toLowerCase().trim();
        if (searchFields.title && movie.title && movie.title.toLowerCase().includes(q)) score += 1000;
    } else {
        score = 1;
    }
    return { movie, score };
});

const filtered = scored.filter(item => {
    if (deferredFilterQuery && item.score === 0) return false;
    return true;
});

console.log(filtered);
