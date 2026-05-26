const fs = require('fs');
let content = fs.readFileSync('client/src/components/TrailerModal.jsx', 'utf8');

content = content.replace(
    "function TrailerModal({ searchQuery, onClose }) {",
    "function TrailerModal({ searchQuery, preloadedTrailers, onClose }) {"
);

const originalUseEffect = `    useEffect(() => {
        if (!searchQuery) return;
        
        const fetchTrailers = async () => {
            setLoading(true);
            setError(null);
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(\`/api/youtube/search?q=\${encodeURIComponent(searchQuery)}\`, {
                    headers: { 'Authorization': \`Bearer \${token}\` }
                });
                
                if (!res.ok) throw new Error('Failed to fetch trailers');
                
                const data = await res.json();
                setResults(data.results || []);
            } catch (err) {
                console.error(err);
                setError('Could not load trailers at this time.');
            } finally {
                setLoading(false);
            }
        };
        
        fetchTrailers();
    }, [searchQuery]);`;

const newUseEffect = `    useEffect(() => {
        if (preloadedTrailers !== undefined && preloadedTrailers !== null) {
            if (preloadedTrailers instanceof Error) {
                setError(preloadedTrailers.message);
                setLoading(false);
            } else {
                setResults(preloadedTrailers);
                setLoading(false);
                setError(null);
            }
            return;
        }

        if (!searchQuery) return;
        
        const fetchTrailers = async () => {
            setLoading(true);
            setError(null);
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(\`/api/youtube/search?q=\${encodeURIComponent(searchQuery)}\`, {
                    headers: { 'Authorization': \`Bearer \${token}\` }
                });
                
                if (!res.ok) throw new Error('Failed to fetch trailers');
                
                const data = await res.json();
                setResults(data.results || []);
            } catch (err) {
                console.error(err);
                setError('Could not load trailers at this time.');
            } finally {
                setLoading(false);
            }
        };
        
        fetchTrailers();
    }, [searchQuery, preloadedTrailers]);`;

content = content.replace(originalUseEffect, newUseEffect);

fs.writeFileSync('client/src/components/TrailerModal.jsx', content);
console.log('Patched TrailerModal.jsx successfully.');
