const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'client', 'src', 'components', 'AddMovie.jsx');
let content = fs.readFileSync(p, 'utf8');

const propsTarget = `function AddMovie({ onMovieAdded, onScrollToMovie, movies, selectedLibraryIds, onGuestActivity, onAddToCollectionClick }) {`;
const propsReplacement = `function AddMovie({ onMovieAdded, onScrollToMovie, movies, selectedLibraryIds, onGuestActivity, onAddToCollectionClick, globalSearchQuery, setGlobalSearchQuery, globalSearchFields, setGlobalSearchFields, includeGlobalDb, setIncludeGlobalDb }) {`;

if (content.includes(propsTarget)) {
    content = content.replace(propsTarget, propsReplacement);
    console.log("Patched AddMovie props signature");
}

const debounceTarget = `        const timer = setTimeout(() => {
            handleSearch(true, false); // auto: dropdown only, never full-page
        }, 300);
        return () => clearTimeout(timer);
    }, [query]);`;
const debounceReplacement = `        const timer = setTimeout(() => {
            handleSearch(true, false); // auto: dropdown only, never full-page
        }, 300);
        return () => clearTimeout(timer);
    }, [query]);

    // Sync local query to global query for MovieGrid
    useEffect(() => {
        const timer = setTimeout(() => setGlobalSearchQuery(query), 200);
        return () => clearTimeout(timer);
    }, [query, setGlobalSearchQuery]);`;

if (content.includes(debounceTarget)) {
    content = content.replace(debounceTarget, debounceReplacement);
    console.log("Patched debounce to sync globalSearchQuery");
}

fs.writeFileSync(p, content, 'utf8');
