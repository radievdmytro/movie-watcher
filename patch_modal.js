const fs = require('fs');
let content = fs.readFileSync('client/src/components/MovieDetailsModal.jsx', 'utf8');

// 1. Add preloadedTrailers state
content = content.replace(
    "const [trailerSearchQuery, setTrailerSearchQuery] = useState('');",
    "const [trailerSearchQuery, setTrailerSearchQuery] = useState('');\n    const [preloadedTrailers, setPreloadedTrailers] = useState(null);"
);

// 2. Add useEffect for background fetch
const useEffectHook = `
    useEffect(() => {
        if (!movie) return;
        let typeStr = 'фильм';
        if (movie.genres && movie.genres.toLowerCase().includes('аниме')) {
            typeStr = 'аниме';
        } else if (movie.genres && movie.genres.toLowerCase().includes('мультфильм')) {
            typeStr = 'мультфильм';
        } else if (movie.type === 'series') {
            typeStr = 'сериал';
        }
        
        const queryTokens = [typeStr, movie.title, movie.year, 'трейлер'].filter(Boolean);
        const query = queryTokens.join(' ');
        setTrailerSearchQuery(query);
    }, [movie]);

    useEffect(() => {
        if (!trailerSearchQuery) return;
        let active = true;
        const fetchTrailers = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(\`/api/youtube/search?q=\${encodeURIComponent(trailerSearchQuery)}\`, {
                    headers: { 'Authorization': \`Bearer \${token}\` }
                });
                if (!res.ok) throw new Error('Failed to fetch trailers');
                const data = await res.json();
                if (active) setPreloadedTrailers(data.results || []);
            } catch (err) {
                console.error(err);
                if (active) setPreloadedTrailers(new Error('Could not load trailers'));
            }
        };
        fetchTrailers();
        return () => { active = false; };
    }, [trailerSearchQuery]);

    const handleCacheSearchClick`;

content = content.replace("    const handleCacheSearchClick", useEffectHook);

// 3. Simplify handleTrailerClick
const oldHandleTrailerClick = `    const handleTrailerClick = (e) => {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        
        let typeStr = 'фильм';
        if (movie.genres && movie.genres.toLowerCase().includes('аниме')) {
            typeStr = 'аниме';
        } else if (movie.genres && movie.genres.toLowerCase().includes('мультфильм')) {
            typeStr = 'мультфильм';
        } else if (movie.type === 'series') {
            typeStr = 'сериал';
        }
        
        const queryTokens = [typeStr, movie.title, movie.year, 'трейлер'].filter(Boolean);
        const query = queryTokens.join(' ');
        setTrailerSearchQuery(query);
        setIsTrailerModalOpen(true);
    };`;

const newHandleTrailerClick = `    const handleTrailerClick = (e) => {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        setIsTrailerModalOpen(true);
    };`;

content = content.replace(oldHandleTrailerClick, newHandleTrailerClick);

// 4. Pass preloadedTrailers to TrailerModal
content = content.replace(
    "<TrailerModal \n                    searchQuery={trailerSearchQuery}\n                    onClose={(e) => {",
    "<TrailerModal \n                    searchQuery={trailerSearchQuery}\n                    preloadedTrailers={preloadedTrailers}\n                    onClose={(e) => {"
);

fs.writeFileSync('client/src/components/MovieDetailsModal.jsx', content);
console.log('Patched MovieDetailsModal.jsx successfully.');
