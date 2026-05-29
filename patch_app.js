const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'client', 'src', 'App.jsx');
let content = fs.readFileSync(p, 'utf8');

const stateTarget = `const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);`;
const stateReplacement = `const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    // Global Search State hoisted from unified search
    const [globalSearchQuery, setGlobalSearchQuery] = useState('');
    const [globalSearchFields, setGlobalSearchFields] = useState(() => {
        try {
            const saved = localStorage.getItem('searchFields');
            if (saved) return { ...{ title: true, actor: true, director: true, year: true, description: false }, ...JSON.parse(saved) };
        } catch (e) {}
        return { title: true, actor: true, director: true, year: true, description: false };
    });
    const [includeGlobalDb, setIncludeGlobalDb] = useState(() => {
        const stored = localStorage.getItem('movieGrid_searchDb');
        return stored === 'global' || stored === 'cache';
    });`;

if (content.includes(stateTarget)) {
    content = content.replace(stateTarget, stateReplacement);
    console.log("Patched App.jsx state");
}

const addMovieTarget = `<AddMovie 
                                    onMovieAdded={() => fetchMovies(true)} 
                                    onScrollToMovie={handleScrollToMovie} 
                                    movies={movies} 
                                    selectedLibraryIds={selectedIds}
                                    onGuestActivity={triggerGuestActivity}
                                    onAddToCollectionClick={setCollectionMovie}
                                />`;
const addMovieReplacement = `<AddMovie 
                                    onMovieAdded={() => fetchMovies(true)} 
                                    onScrollToMovie={handleScrollToMovie} 
                                    movies={movies} 
                                    selectedLibraryIds={selectedIds}
                                    onGuestActivity={triggerGuestActivity}
                                    onAddToCollectionClick={setCollectionMovie}
                                    globalSearchQuery={globalSearchQuery}
                                    setGlobalSearchQuery={setGlobalSearchQuery}
                                    globalSearchFields={globalSearchFields}
                                    setGlobalSearchFields={setGlobalSearchFields}
                                    includeGlobalDb={includeGlobalDb}
                                    setIncludeGlobalDb={setIncludeGlobalDb}
                                />`;

if (content.includes(addMovieTarget)) {
    content = content.replace(addMovieTarget, addMovieReplacement);
    console.log("Patched AddMovie props");
}

const gridTarget = `<MovieGrid
                                    movies={displayedMovies}
                                    allMovies={movies}
                                    historyList={historyList}
                                    onFetchHistory={fetchHistoryList}`;
const gridReplacement = `<MovieGrid
                                    movies={displayedMovies}
                                    allMovies={movies}
                                    historyList={historyList}
                                    onFetchHistory={fetchHistoryList}
                                    globalSearchQuery={globalSearchQuery}
                                    globalSearchFields={globalSearchFields}
                                    includeGlobalDb={includeGlobalDb}`;

if (content.includes(gridTarget)) {
    content = content.replace(gridTarget, gridReplacement);
    console.log("Patched MovieGrid props");
}

fs.writeFileSync(p, content, 'utf8');
