import { useState, useEffect, useRef } from 'react';

function AddMovie({ onMovieAdded, onScrollToMovie, movies = [] }) {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [searchStreaming, setSearchStreaming] = useState(false); // SSE in progress
    const [searchStatus, setSearchStatus] = useState('');          // status text
    const [preview, setPreview] = useState(null);
    const [searchResults, setSearchResults] = useState(null);
    const [showResultsPanel, setShowResultsPanel] = useState(false);
    const [logs, setLogs] = useState([]);
    const [isFadingLogs, setIsFadingLogs] = useState(false);
    const activeStreamRef = useRef(null); // track open SSE connection

    // Filters for search results
    const [searchFilterType, setSearchFilterType] = useState('all');
    const [searchFilterYear, setSearchFilterYear] = useState([1900, new Date().getFullYear() + 2]);
    const [searchFilterGenres, setSearchFilterGenres] = useState([]);
    const [searchFilterGenreMode, setSearchFilterGenreMode] = useState('include');
    const [showSearchFilters, setShowSearchFilters] = useState(false);

    const containerRef = useRef(null);
    const [selectedLinks, setSelectedLinks] = useState(new Set());
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
    const [fullPageResults, setFullPageResults] = useState(false);

    const isHdrezkaUrl = (str) => {
        if (!str) return false;
        const lower = str.toLowerCase().trim();
        return lower.includes('rezka') && (lower.startsWith('http://') || lower.startsWith('https://'));
    };

    const extractUrls = (text) => {
        const match = text.match(/\bhttps?:\/\/\S+/gi);
        return match ? match.filter(url => url.toLowerCase().includes('rezka')) : [];
    };

    // Domain-agnostic path extractor for library ownership check
    const cleanLinkPath = (url) => {
        if (!url) return '';
        return url.toLowerCase()
            .replace(/^https?:\/\/[^/]+/, '')
            .replace(/^\/+|\/+$/g, '')
            .split('?')[0].split('#')[0];
    };

    // Set of link paths the current user already owns (deleted_at = null)
    const ownedPaths = new Set(
        movies.filter(m => !m.deleted_at).map(m => cleanLinkPath(m.link))
    );

    const isOwned = (link) => {
        const clean = cleanLinkPath(link);
        return clean && ownedPaths.has(clean);
    };

    const handleSearch = async (isAuto = false, openFullPage = false) => {
        const q = query.trim();
        if (!q) {
            setPreview(null);
            setSearchResults(null);
            setShowResultsPanel(false);
            setSearchStreaming(false);
            setSearchStatus('');
            return;
        }

        const urls = extractUrls(q);
        if (isAuto && (urls.length > 1 || q.length < 3)) return;

        // Close any running SSE stream
        if (activeStreamRef.current) {
            activeStreamRef.current.abort();
            activeStreamRef.current = null;
        }

        if (!isAuto) {
            setPreview(null);
            setSearchResults(null);
            setLogs([]);
            setIsFadingLogs(false);
        }

        if (urls.length > 1) {
            setLoading(true);
            await handleBatchImport(urls);
            setLoading(false);
            return;
        }

        setLoading(true);
        setSearchStreaming(true);
        setSearchStatus('Searching...');
        if (openFullPage) {
            setFullPageResults(true);
        } else {
            // Auto/dropdown mode: reset full-page mode so dropdown becomes visible
            setFullPageResults(false);
        }

        const token = localStorage.getItem('token');
        const controller = new AbortController();
        activeStreamRef.current = controller;

        try {
            const res = await fetch(`/api/movies/search/stream?q=${encodeURIComponent(q)}`, {
                headers: { 'Authorization': `Bearer ${token}` },
                signal: controller.signal
            });

            if (!res.ok) throw new Error('Stream failed');

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let accumulatedResults = [];

            const parseSSEChunk = (chunk) => {
                buffer += chunk;
                const lines = buffer.split('\n');
                buffer = lines.pop(); // keep incomplete line
                let eventName = '';
                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        eventName = line.slice(7).trim();
                    } else if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (eventName === 'result' && data.type === 'detail') {
                                // URL mode — show preview immediately
                                setPreview(data.data);
                                setShowResultsPanel(false);
                                setSearchStreaming(false);
                                setSearchStatus('');
                                setLoading(false);
                            } else if (eventName === 'results') {
                                // Text mode — merge results progressively
                                const incoming = data.items || [];
                                const existingLinks = new Set(accumulatedResults.map(r => r.link));
                                const merged = [...accumulatedResults];
                                for (const item of incoming) {
                                    if (!existingLinks.has(item.link)) {
                                        merged.push(item);
                                        existingLinks.add(item.link);
                                    } else {
                                        // Update existing entry with fresher data
                                        const idx = merged.findIndex(r => r.link === item.link);
                                        if (idx !== -1) merged[idx] = { ...merged[idx], ...item };
                                    }
                                }
                                accumulatedResults = merged;
                                setSearchResults([...merged]);
                                setSelectedLinks(new Set());
                                setShowResultsPanel(!openFullPage);
                                if (data.fromCache) setSearchStatus('Searching HDRezka for more...');
                                else setSearchStatus('');
                            } else if (eventName === 'status') {
                                setSearchStatus(data.msg || '');
                            } else if (eventName === 'done') {
                                setSearchStreaming(false);
                                setSearchStatus('');
                                setLoading(false);
                            } else if (eventName === 'error') {
                                setSearchStatus('');
                                setSearchStreaming(false);
                                setLoading(false);
                            }
                        } catch (e) { /* ignore parse errors */ }
                        eventName = '';
                    }
                }
            };

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                parseSSEChunk(decoder.decode(value, { stream: true }));
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Search stream failed:', error);
                if (!isAuto) {
                    setLogs([{ msg: '✗ Search failed', type: 'error' }]);
                    setIsFadingLogs(false);
                    setTimeout(() => setIsFadingLogs(true), 4000);
                }
            }
        } finally {
            setLoading(false);
            setSearchStreaming(false);
            setSearchStatus('');
        }
    };

    // Debounced auto-search (text mode only; URL mode triggers instantly)
    useEffect(() => {
        const q = query.trim();
        if (!q) {
            setPreview(null);
            setSearchResults(null);
            setShowResultsPanel(false);
            setSearchStatus('');
            if (activeStreamRef.current) { activeStreamRef.current.abort(); activeStreamRef.current = null; }
            return;
        }
        // If it's a URL, trigger immediately (no debounce needed)
        if (isHdrezkaUrl(q)) {
            handleSearch(true, false);
            return;
        }
        const timer = setTimeout(() => {
            if (q) {
                handleSearch(true, false); // auto: dropdown only, never full-page
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [query]);

    // Close results when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setShowResultsPanel(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleBatchImport = async (urls) => {
        let successCount = 0;
        const newLogs = [];
        setIsFadingLogs(false);

        for (const url of urls) {
            newLogs.push({ msg: `Processing ${url}...`, type: 'info' });
            setLogs([...newLogs]);

            try {
                const res = await fetch('/api/movies/import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url })
                });
                const data = await res.json();

                if (res.ok) {
                    successCount++;
                    newLogs.push({ msg: `✓ Added: ${data.title}`, type: 'success' });
                } else if (res.status === 409) {
                    newLogs.push({ msg: `Already in library: ${url.split('/').filter(Boolean).pop()}`, type: 'info' });
                    if (onScrollToMovie) onScrollToMovie(url);
                } else {
                    newLogs.push({ msg: `✗ Failed: ${data.error || 'Unknown error'}`, type: 'error' });
                }
            } catch (err) {
                newLogs.push({ msg: `✗ Network Error for ${url}`, type: 'error' });
            }
            setLogs([...newLogs]);
        }

        if (successCount > 0) {
            onMovieAdded();
            setQuery('');
            // Smoothly hide first
            setShowResultsPanel(false);
            // Delay clearing the results until the transition is done (~400ms)
            setTimeout(() => {
                setSearchResults(null);
            }, 400);
        }

        setTimeout(() => {
            setIsFadingLogs(true);
            setTimeout(() => {
                setLogs([]);
                setIsFadingLogs(false);
            }, 1000);
        }, 10000);
    };

    const handleSelectMovie = async (link) => {
        setShowResultsPanel(false);
        setFullPageResults(false);
        setTimeout(() => {
            setSearchResults(null);
        }, 400);
        setLoading(true);
        try {
            const res = await fetch('/api/movies/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: link })
            });
            const data = await res.json();
            if (data.type === 'detail') {
                setPreview(data.data);
            }
        } catch (error) {
            console.error('Selection fetch failed', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async () => {
        if (!preview) return;
        try {
            const payload = { ...preview };
            if (!payload.link && isHdrezkaUrl(query)) payload.link = query;

            const res = await fetch('/api/movies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setQuery('');
                setPreview(null);
                onMovieAdded();
            } else {
                const d = await res.json();
                if (res.status === 409 && onScrollToMovie && payload.link) {
                    setPreview(null);
                    setQuery('');
                    onScrollToMovie(payload.link);
                } else {
                    setLogs([{ msg: `✗ ${d.error || 'Failed to add movie'}`, type: 'error' }]);
                    setIsFadingLogs(false);
                    setTimeout(() => setIsFadingLogs(true), 4000);
                }
            }
        } catch (error) {
            console.error(error);
        }
    };

    const toggleSelect = (link) => {
        setSelectedLinks(prev => {
            const next = new Set(prev);
            if (next.has(link)) next.delete(link); else next.add(link);
            return next;
        });
    };

    const handleAddSelected = async () => {
        const links = [...selectedLinks];
        if (!links.length) return;
        await handleBatchImport(links);
        setSelectedLinks(new Set());
        setFullPageResults(false);
        setShowResultsPanel(false);
        setTimeout(() => setSearchResults(null), 400);
    };

    const handleFetchCategory = async (filter) => {
        setLoading(true);
        setPreview(null);
        setSearchResults(null);
        setLogs([]);
        setIsFadingLogs(false);
        try {
            const res = await fetch(`/api/movies/category/${filter}`);
            const data = await res.json();
            setSearchResults(data);
            setSelectedLinks(new Set());
            setShowResultsPanel(true);
            setFullPageResults(true);
        } catch (error) {
            console.error('Category fetch failed:', error);
            setLogs([{ msg: '✗ Failed to fetch category', type: 'error' }]);
            setIsFadingLogs(false);
            setTimeout(() => setIsFadingLogs(true), 4000);
        } finally {
            setLoading(false);
        }
    };

    const filteredSearchResults = (searchResults || []).filter(item => {
        const rating = parseFloat(item.rating) || 0;
        const year = parseInt(item.year) || 0;

        if (searchFilterType !== 'all') {
            if (searchFilterType === 'cartoon') {
                const isCartoon = item.misc?.toLowerCase().includes('мульт') ||
                    item.misc?.toLowerCase().includes('анимац') ||
                    item.link?.includes('/cartoons/') ||
                    item.link?.includes('/animation/');
                if (!isCartoon) return false;
            } else if (item.type !== searchFilterType) {
                return false;
            }
        }
        if (year < searchFilterYear[0] || year > searchFilterYear[1]) return false;

        // Genre Filter
        if (searchFilterGenres.length > 0) {
            const itemGenres = (item.misc || '').toLowerCase();
            if (searchFilterGenreMode === 'include') {
                if (!searchFilterGenres.every(fg => itemGenres.includes(fg.toLowerCase()))) return false;
            } else {
                if (searchFilterGenres.some(fg => itemGenres.includes(fg.toLowerCase()))) return false;
            }
        }

        return true;
    });

    const inputLines = query.split(/\n/).length;

    return (
        <div style={{ marginBottom: '30px', position: 'relative', zIndex: 200 }} ref={containerRef}>
            {/* Search Bar Container - High Z-Index to stay on top */}
            <div style={{
                display: 'flex',
                background: 'var(--bg-card)',
                borderRadius: '30px',
                padding: '5px',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                transition: 'all 0.3s ease',
                alignItems: inputLines > 1 ? 'flex-start' : 'center',
                flexWrap: 'wrap',
                position: 'relative',
                zIndex: 10
            }}
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent-gold)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
            >
                <div style={{ padding: '0 15px', display: 'flex', alignItems: 'center', color: '#666' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </div>

                {inputLines > 1 || query.length > 80 ? (
                    <textarea
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Paste HDRezka link(s) or movie title..."
                        className="search-input"
                        style={{
                            flex: 1,
                            minHeight: '80px',
                            background: 'transparent',
                            border: 'none',
                            color: '#fff',
                            fontSize: '1rem',
                            outline: 'none',
                            padding: '10px 0',
                            resize: 'vertical',
                            fontFamily: 'inherit'
                        }}
                    />
                ) : (
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Paste HDRezka link(s) or movie title..."
                        className="search-input"
                        style={{
                            flex: 1,
                            background: 'transparent',
                            border: 'none',
                            color: '#fff',
                            fontSize: '1rem',
                            height: '40px',
                            outline: 'none'
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch(false, true)}
                    />
                )}

                <button
                    onClick={() => setShowSearchFilters(!showSearchFilters)}
                    style={{
                        background: showSearchFilters ? 'rgba(212, 175, 55, 0.1)' : 'transparent',
                        color: showSearchFilters ? 'var(--accent-gold)' : '#888',
                        border: '1px solid ' + (showSearchFilters ? 'var(--accent-gold)' : 'rgba(255,255,255,0.1)'),
                        borderRadius: '20px',
                        padding: '0 15px',
                        height: '40px',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginLeft: '10px',
                        transition: 'all 0.2s',
                        alignSelf: inputLines > 1 ? 'flex-start' : 'auto',
                        marginTop: inputLines > 1 ? '10px' : '0'
                    }}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                    Filters
                </button>

                <button
                    onClick={() => handleSearch(false, true)}
                    disabled={loading}
                    style={{
                        background: 'linear-gradient(135deg, var(--accent-gold) 0%, #b5952f 100%)',
                        color: '#000',
                        border: 'none',
                        borderRadius: '25px',
                        padding: '0 30px',
                        height: '40px',
                        fontWeight: 'bold',
                        fontSize: '0.9rem',
                        cursor: loading ? 'wait' : 'pointer',
                        boxShadow: '0 2px 10px rgba(212, 175, 55, 0.3)',
                        transition: 'transform 0.2s',
                        marginLeft: '10px',
                        marginRight: '2px',
                        alignSelf: inputLines > 1 ? 'flex-start' : 'auto',
                        marginTop: inputLines > 1 ? '10px' : '0'
                    }}
                    onMouseOver={(e) => !loading && (e.currentTarget.style.transform = 'scale(1.05)')}
                    onMouseOut={(e) => !loading && (e.currentTarget.style.transform = 'scale(1)')}
                >
                    {loading ? (
                        <div style={{ width: '20px', height: '20px', border: '2px solid #000', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                    ) : (extractUrls(query).length > 1 ? 'IMPORT ALL' : 'SEARCH')}
                </button>
            </div>

            {/* Streaming progress bar */}
            <div style={{
                height: '2px',
                borderRadius: '2px',
                background: 'rgba(255,255,255,0.05)',
                overflow: 'hidden',
                marginTop: '4px',
                opacity: searchStreaming ? 1 : 0,
                transition: 'opacity 0.3s'
            }}>
                <div style={{
                    height: '100%',
                    background: 'linear-gradient(90deg, var(--accent-gold) 0%, #ffe066 50%, var(--accent-gold) 100%)',
                    backgroundSize: '200% 100%',
                    animation: searchStreaming ? 'shimmer 1.4s infinite linear' : 'none',
                    width: '100%'
                }} />
            </div>
            {searchStatus && (
                <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px', paddingLeft: '16px', transition: 'opacity 0.3s' }}>
                    {searchStatus}
                </div>
            )}

            {/* Category Quick Buttons */}
            <div style={{
                display: 'flex',
                gap: '8px',
                marginTop: '12px',
                flexWrap: 'wrap',
                justifyContent: 'center'
            }}>
                {[
                    { id: 'watching', label: 'Watching Now', icon: '👀' },
                    { id: 'last', label: 'New Releases', icon: '✨' },
                    { id: 'popular', label: 'Popular', icon: '🔥' }
                ].map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => handleFetchCategory(cat.id)}
                        disabled={loading}
                        className="btn-ghost"
                        style={{
                            padding: '6px 15px',
                            borderRadius: '20px',
                            fontSize: '0.8rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.05)',
                            transition: 'all 0.2s',
                            cursor: loading ? 'wait' : 'pointer'
                        }}
                        onMouseOver={(e) => !loading && (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                        onMouseOut={(e) => !loading && (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                    >
                        <span>{cat.icon}</span>
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* Global Search Filters Panel (Below Bar) */}
            <div style={{
                maxHeight: showSearchFilters ? '200px' : '0',
                overflow: 'hidden',
                transition: 'all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1)',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '15px',
                marginTop: showSearchFilters ? '15px' : '0',
                padding: showSearchFilters ? '20px' : '0 20px',
                border: showSearchFilters ? '1px solid rgba(255,255,255,0.05)' : 'none',
                position: 'relative',
                zIndex: 8
            }}>
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    {/* Type Filter */}
                    <div>
                        <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '8px' }}>Content Type</div>
                        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '20px', padding: '2px' }}>
                            {[
                                { id: 'all', label: 'All' },
                                { id: 'movie', label: 'Movies' },
                                { id: 'series', label: 'Series' },
                                { id: 'cartoon', label: 'Cartoon' }
                            ].map(t => (
                                <button key={t.id} onClick={() => setSearchFilterType(t.id)} style={{
                                    padding: '5px 15px', fontSize: '0.8rem', borderRadius: '18px', border: 'none', cursor: 'pointer',
                                    background: searchFilterType === t.id ? 'var(--accent-gold)' : 'transparent',
                                    color: searchFilterType === t.id ? '#000' : '#888',
                                    transition: 'all 0.2s'
                                }}>{t.label}</button>
                            ))}
                        </div>
                    </div>

                    {/* Genre Exclusion Example (Cartoons) */}
                    <div>
                        <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Exclude Genres</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--danger)' }}>{searchFilterGenres.length > 0 ? 'Active' : ''}</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                            {['Мультфильмы', 'Аниме', 'Ужасы'].map(g => {
                                const isExcl = searchFilterGenres.includes(g) && searchFilterGenreMode === 'exclude';
                                return (
                                    <button
                                        key={g}
                                        onClick={() => {
                                            if (isExcl) {
                                                setSearchFilterGenres(searchFilterGenres.filter(i => i !== g));
                                            } else {
                                                setSearchFilterGenres([...searchFilterGenres, g]);
                                                setSearchFilterGenreMode('exclude');
                                            }
                                        }}
                                        style={{
                                            padding: '4px 10px', fontSize: '0.75rem', borderRadius: '15px', border: 'none', cursor: 'pointer',
                                            background: isExcl ? 'var(--danger)' : 'rgba(255,255,255,0.05)',
                                            color: isExcl ? '#fff' : '#888',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {g}
                                    </button>
                                );
                            })}
                        </div>
                    </div>


                    {/* Year Slider */}
                    <div style={{ minWidth: '180px' }}>
                        <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                            <span>From Year</span>
                            <span style={{ color: 'var(--accent-gold)' }}>{searchFilterYear[0]}</span>
                        </div>
                        <input
                            type="range" min="1950" max={new Date().getFullYear()} step="1" value={searchFilterYear[0]}
                            onChange={(e) => setSearchFilterYear([parseInt(e.target.value), 2030])}
                            style={{ width: '100%', accentColor: 'var(--accent-gold)' }}
                        />
                    </div>

                    {/* Reset Button */}
                    <div style={{ marginLeft: 'auto', alignSelf: 'flex-end' }}>
                        <button
                            className="btn-ghost"
                            style={{ fontSize: '0.8rem', opacity: 0.6 }}
                            onClick={() => {
                                setSearchFilterType('all');
                                setSearchFilterYear([1950, 2030]);
                                setSearchFilterGenres([]);
                                setSearchFilterGenreMode('include');
                            }}
                        >Reset Search Filters</button>
                    </div>
                </div>
            </div>


            {/* Dropdown — auto-search mode (typing) */}
            <div style={{
                position: 'absolute',
                top: 'calc(100% - 20px)',
                left: '5%', right: '5%',
                background: 'rgba(22,22,22,0.97)',
                backdropFilter: 'blur(15px)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderTop: 'none',
                borderRadius: '0 0 20px 20px',
                padding: '20px 16px 16px',
                boxShadow: '0 15px 30px rgba(0,0,0,0.5)',
                zIndex: 5,
                opacity: showResultsPanel && searchResults && !fullPageResults ? 1 : 0,
                transform: showResultsPanel && searchResults && !fullPageResults ? 'translateY(0)' : 'translateY(-12px)',
                pointerEvents: showResultsPanel && searchResults && !fullPageResults ? 'auto' : 'none',
                transition: 'all 0.35s cubic-bezier(0.165,0.84,0.44,1)',
                maxHeight: '420px', overflowY: 'auto'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ color: 'var(--accent-gold)', fontWeight: 600, fontSize: '0.85rem' }}>
                            {filteredSearchResults.length} results
                        </span>
                        {selectedLinks.size > 0 && (
                            <button onClick={(e) => { e.stopPropagation(); handleAddSelected(); }}
                                className="btn btn-primary"
                                style={{ fontSize: '0.72rem', padding: '4px 12px', height: 'auto', borderRadius: '14px', whiteSpace: 'nowrap' }}>
                                ✚ Add Selected ({selectedLinks.size})
                            </button>
                        )}
                    </div>
                    <button onClick={() => { setShowResultsPanel(false); setSelectedLinks(new Set()); }}
                        style={{ background: 'transparent', border: 'none', color: '#555', fontSize: '1.1rem', cursor: 'pointer', padding: '0 4px' }}>×</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {filteredSearchResults.length > 0 ? filteredSearchResults.map((item, idx) => {
                        const sel = selectedLinks.has(item.link);
                        const owned = isOwned(item.link);
                        return (
                            <div key={idx} style={{
                                display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 8px',
                                border: `1px solid ${owned ? 'rgba(212,175,55,0.5)' : sel ? 'rgba(212,175,55,0.4)' : 'rgba(255,255,255,0.04)'}`,
                                background: owned ? 'rgba(212,175,55,0.06)' : sel ? 'rgba(212,175,55,0.07)' : 'transparent',
                                borderRadius: '10px', transition: 'all 0.15s'
                            }}
                                onMouseEnter={e => { if (!sel && !owned) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                                onMouseLeave={e => { if (!sel && !owned) e.currentTarget.style.background = 'transparent'; }}
                            >
                                {/* Checkbox — hidden for owned */}
                                {!owned ? (
                                    <div onClick={(e) => { e.stopPropagation(); toggleSelect(item.link); }} style={{
                                        width: '17px', height: '17px', borderRadius: '4px', flexShrink: 0,
                                        background: sel ? 'var(--accent-gold)' : 'transparent',
                                        border: `2px solid ${sel ? 'var(--accent-gold)' : 'rgba(255,255,255,0.2)'}`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.6rem', color: '#000', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.15s'
                                    }}>{sel ? '✓' : ''}</div>
                                ) : (
                                    <div style={{ width: '17px', height: '17px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-gold)', fontSize: '0.75rem' }}>✓</div>
                                )}
                                {/* Poster */}
                                <img src={item.img} alt={item.title}
                                    style={{ width: '34px', height: '50px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} />
                                {/* Info — click = preview */}
                                <div style={{ flex: 1, cursor: 'pointer', minWidth: 0 }} onClick={() => handleSelectMovie(item.link)}>
                                    <div style={{ fontSize: '0.86rem', fontWeight: 600, color: owned ? 'var(--accent-gold)' : '#eee', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
                                    <div style={{ fontSize: '0.71rem', color: '#666', marginTop: '1px' }}>{item.misc}</div>
                                </div>
                                {item.rating && <span style={{ fontSize: '0.7rem', background: '#2a2a2a', padding: '2px 6px', borderRadius: '5px', color: '#bbb', flexShrink: 0 }}>★ {item.rating}</span>}
                                {owned ? (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onScrollToMovie && onScrollToMovie(item.link); }}
                                        style={{
                                            background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.5)',
                                            color: 'var(--accent-gold)', borderRadius: '7px', padding: '3px 10px',
                                            fontSize: '0.72rem', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap', transition: 'all 0.15s',
                                            fontWeight: '600'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(212,175,55,0.3)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(212,175,55,0.15)'}
                                    >📍 Show</button>
                                ) : (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleBatchImport([item.link]); }}
                                        style={{
                                            background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.3)',
                                            color: 'var(--accent-gold)', borderRadius: '7px', padding: '3px 10px',
                                            fontSize: '0.72rem', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap', transition: 'all 0.15s'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(212,175,55,0.28)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(212,175,55,0.12)'}
                                    >+ Add</button>
                                )}
                            </div>
                        );
                    }) : (
                        <div style={{ padding: '16px', textAlign: 'center', color: '#555', fontSize: '0.85rem' }}>No results</div>
                    )}
                </div>
            </div>

            {/* Full Page Results Panel — opened on Enter / Search button */}
            {fullPageResults && searchResults && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(10px)', zIndex: 9999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: 'fadeIn 0.25s ease', padding: '20px'
                }}>
                    <div style={{
                        width: '100%', maxWidth: '840px', maxHeight: '88vh',
                        background: 'rgba(18,18,18,0.99)', borderRadius: '16px',
                        border: '1px solid rgba(255,255,255,0.09)',
                        boxShadow: '0 24px 60px rgba(0,0,0,0.8)',
                        display: 'flex', flexDirection: 'column', overflow: 'hidden'
                    }}>
                    {/* Header */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '18px 28px', borderBottom: '1px solid rgba(255,255,255,0.08)',
                        flexShrink: 0, flexWrap: 'wrap', gap: '12px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                            <h3 style={{ margin: 0, color: 'var(--accent-gold)', fontSize: '1.15rem' }}>
                                🎬 Search Results
                                <span style={{ fontSize: '0.8rem', color: '#666', marginLeft: '10px' }}>
                                    {filteredSearchResults.length} found
                                </span>
                            </h3>
                            {/* View toggle */}
                            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: '20px', padding: '3px' }}>
                                {[['grid','⊞ Grid'],['table','☰ List']].map(([mode, label]) => (
                                    <button key={mode} onClick={() => setViewMode(mode)} style={{
                                        padding: '5px 14px', borderRadius: '16px', border: 'none', cursor: 'pointer',
                                        fontSize: '0.78rem', fontWeight: 600,
                                        background: viewMode === mode ? 'var(--accent-gold)' : 'transparent',
                                        color: viewMode === mode ? '#000' : '#888', transition: 'all 0.2s'
                                    }}>{label}</button>
                                ))}
                            </div>
                            {selectedLinks.size > 0 && (
                                <button onClick={handleAddSelected} className="btn btn-primary" style={{
                                    fontSize: '0.82rem', padding: '7px 20px', borderRadius: '20px',
                                    boxShadow: '0 2px 12px rgba(212,175,55,0.4)', animation: 'fadeIn 0.2s'
                                }}>
                                    ✚ Add Selected ({selectedLinks.size})
                                </button>
                            )}
                            {filteredSearchResults.length > 1 && (
                                <button onClick={() => {
                                    if (selectedLinks.size === filteredSearchResults.length) {
                                        setSelectedLinks(new Set());
                                    } else {
                                        setSelectedLinks(new Set(filteredSearchResults.map(i => i.link)));
                                    }
                                }} style={{
                                    background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
                                    color: '#aaa', borderRadius: '16px', padding: '5px 14px',
                                    fontSize: '0.78rem', cursor: 'pointer'
                                }}>
                                    {selectedLinks.size === filteredSearchResults.length ? 'Deselect All' : 'Select All'}
                                </button>
                            )}
                        </div>
                        <button onClick={() => { setFullPageResults(false); setShowResultsPanel(false); setSelectedLinks(new Set()); }}
                            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', borderRadius: '50%', width: '36px', height: '36px', fontSize: '1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            ×
                        </button>
                    </div>

                    {/* Results Body */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
                        {filteredSearchResults.length === 0 ? (
                            <div style={{ textAlign: 'center', color: '#555', paddingTop: '60px', fontSize: '1rem' }}>No results match your filters</div>
                        ) : viewMode === 'grid' ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px' }}>
                                {filteredSearchResults.map((item, idx) => {
                                    const sel = selectedLinks.has(item.link);
                                    const owned = isOwned(item.link);
                                    return (
                                        <div key={idx} onClick={() => !owned && toggleSelect(item.link)} style={{
                                            background: owned ? 'rgba(212,175,55,0.09)' : sel ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.03)',
                                            border: `1px solid ${owned ? 'rgba(212,175,55,0.55)' : sel ? 'rgba(212,175,55,0.6)' : 'rgba(255,255,255,0.07)'}`,
                                            borderRadius: '14px', overflow: 'hidden', cursor: owned ? 'default' : 'pointer',
                                            transition: 'all 0.2s', position: 'relative',
                                            transform: sel ? 'scale(1.02)' : 'scale(1)'
                                        }}
                                            onMouseEnter={e => { if (!owned) e.currentTarget.style.border = '1px solid rgba(212,175,55,0.4)'; }}
                                            onMouseLeave={e => e.currentTarget.style.border = `1px solid ${owned ? 'rgba(212,175,55,0.55)' : sel ? 'rgba(212,175,55,0.6)' : 'rgba(255,255,255,0.07)'}`}
                                        >
                                            <div style={{ position: 'relative' }}>
                                                <img src={item.img} alt={item.title} style={{ width: '100%', height: '200px', objectFit: 'cover', display: 'block' }} />
                                                {/* Owned badge / select circle */}
                                                {owned ? (
                                                    <div style={{
                                                        position: 'absolute', top: '8px', right: '8px',
                                                        background: 'var(--accent-gold)', color: '#000',
                                                        borderRadius: '10px', padding: '2px 8px',
                                                        fontSize: '0.65rem', fontWeight: 'bold'
                                                    }}>✓ In Library</div>
                                                ) : (
                                                    <div style={{
                                                        position: 'absolute', top: '8px', right: '8px',
                                                        width: '22px', height: '22px', borderRadius: '50%',
                                                        background: sel ? 'var(--accent-gold)' : 'rgba(0,0,0,0.6)',
                                                        border: `2px solid ${sel ? 'var(--accent-gold)' : 'rgba(255,255,255,0.4)'}`,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: '0.7rem', color: '#000', fontWeight: 'bold',
                                                        transition: 'all 0.2s'
                                                    }}>{sel ? '✓' : ''}</div>
                                                )}
                                                {item.rating && <div style={{ position: 'absolute', bottom: '6px', left: '6px', background: 'rgba(0,0,0,0.8)', padding: '2px 7px', borderRadius: '6px', fontSize: '0.75rem', color: '#fff' }}>★ {item.rating}</div>}
                                            </div>
                                            <div style={{ padding: '10px' }}>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: owned ? 'var(--accent-gold)' : '#eee', marginBottom: '4px', lineHeight: 1.3 }}>{item.title}</div>
                                                <div style={{ fontSize: '0.7rem', color: '#666' }}>{item.misc}</div>
                                            </div>
                                            {owned && (
                                                <div style={{ padding: '0 10px 10px' }}>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onScrollToMovie && onScrollToMovie(item.link); }}
                                                        style={{
                                                            width: '100%', background: 'rgba(212,175,55,0.15)',
                                                            border: '1px solid rgba(212,175,55,0.4)', color: 'var(--accent-gold)',
                                                            borderRadius: '8px', padding: '5px 0', fontSize: '0.75rem',
                                                            cursor: 'pointer', fontWeight: '600'
                                                        }}
                                                    >📍 Show in Library</button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'left' }}>
                                        <th style={{ padding: '8px 12px', color: '#555', fontWeight: 500, width: '40px' }}></th>
                                        <th style={{ padding: '8px 12px', color: '#555', fontWeight: 500, width: '50px' }}></th>
                                        <th style={{ padding: '8px 12px', color: '#555', fontWeight: 500 }}>Title</th>
                                        <th style={{ padding: '8px 12px', color: '#555', fontWeight: 500 }}>Info</th>
                                        <th style={{ padding: '8px 12px', color: '#555', fontWeight: 500, width: '70px' }}>Rating</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredSearchResults.map((item, idx) => {
                                        const sel = selectedLinks.has(item.link);
                                        const owned = isOwned(item.link);
                                        return (
                                            <tr key={idx} onClick={() => !owned && toggleSelect(item.link)} style={{
                                                borderBottom: '1px solid rgba(255,255,255,0.04)',
                                                background: owned ? 'rgba(212,175,55,0.07)' : sel ? 'rgba(212,175,55,0.08)' : 'transparent',
                                                cursor: owned ? 'default' : 'pointer', transition: 'background 0.15s'
                                            }}
                                                onMouseEnter={e => e.currentTarget.style.background = owned ? 'rgba(212,175,55,0.1)' : sel ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.04)'}
                                                onMouseLeave={e => e.currentTarget.style.background = owned ? 'rgba(212,175,55,0.07)' : sel ? 'rgba(212,175,55,0.08)' : 'transparent'}
                                            >
                                                <td style={{ padding: '10px 12px' }}>
                                                    {owned ? (
                                                        <div style={{ color: 'var(--accent-gold)', fontSize: '0.85rem', fontWeight: 'bold' }}>✓</div>
                                                    ) : (
                                                        <div style={{
                                                            width: '18px', height: '18px', borderRadius: '4px',
                                                            background: sel ? 'var(--accent-gold)' : 'transparent',
                                                            border: `2px solid ${sel ? 'var(--accent-gold)' : 'rgba(255,255,255,0.2)'}`,
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            fontSize: '0.7rem', color: '#000', fontWeight: 'bold', transition: 'all 0.15s'
                                                        }}>{sel ? '✓' : ''}</div>
                                                    )}
                                                </td>
                                                <td style={{ padding: '10px 12px' }}>
                                                    <img src={item.img} alt="" style={{ width: '36px', height: '52px', objectFit: 'cover', borderRadius: '5px' }} />
                                                </td>
                                                <td style={{ padding: '10px 12px', fontWeight: 600, color: owned ? 'var(--accent-gold)' : '#eee', fontSize: '0.9rem' }}>{item.title}</td>
                                                <td style={{ padding: '10px 12px', color: '#666', fontSize: '0.8rem' }}>{item.misc}</td>
                                                <td style={{ padding: '10px 12px', color: '#aaa', fontSize: '0.82rem' }}>{item.rating ? `★ ${item.rating}` : '—'}</td>
                                                <td style={{ padding: '10px 12px' }}>
                                                    {owned && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); onScrollToMovie && onScrollToMovie(item.link); }}
                                                            style={{
                                                                background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.4)',
                                                                color: 'var(--accent-gold)', borderRadius: '6px', padding: '3px 10px',
                                                                fontSize: '0.72rem', cursor: 'pointer', fontWeight: '600', whiteSpace: 'nowrap'
                                                            }}
                                                        >📍 Show</button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Footer sticky action bar */}
                    {selectedLinks.size > 0 && (
                        <div style={{
                            padding: '14px 28px', borderTop: '1px solid rgba(255,255,255,0.08)',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            background: 'rgba(18,18,18,0.95)', flexShrink: 0
                        }}>
                            <span style={{ color: '#888', fontSize: '0.9rem' }}>
                                {selectedLinks.size} film{selectedLinks.size > 1 ? 's' : ''} selected
                            </span>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button onClick={() => setSelectedLinks(new Set())} style={{
                                    background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
                                    color: '#aaa', borderRadius: '20px', padding: '8px 20px', cursor: 'pointer', fontSize: '0.85rem'
                                }}>Clear</button>
                                <button onClick={handleAddSelected} className="btn btn-primary" style={{
                                    padding: '8px 28px', borderRadius: '20px',
                                    boxShadow: '0 2px 15px rgba(212,175,55,0.35)', fontSize: '0.9rem'
                                }}>✚ Add {selectedLinks.size} to Library</button>
                            </div>
                        </div>
                    )}
                </div>
                    </div>
            )}

            {/* Helper text */}
            <div style={{ paddingLeft: '20px', marginTop: '8px', fontSize: '0.8rem', color: '#666' }}>
                Supported: HDRezka links (single or batch) & Movie Titles
            </div>

            {/* Import Logs */}
            <div
                style={{
                    maxHeight: logs.length > 0 ? (isFadingLogs ? '0px' : '300px') : '0px',
                    opacity: logs.length > 0 ? (isFadingLogs ? 0 : 1) : 0,
                    overflow: 'hidden',
                    transition: 'max-height 0.8s ease-in-out, opacity 0.8s ease-in-out, margin-top 0.8s ease-in-out',
                    marginTop: logs.length > 0 && !isFadingLogs ? '15px' : '0px'
                }}
            >
                <div className="glass-panel" style={{ padding: '15px', position: 'relative' }}>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '0.9rem' }}>
                        {logs.map((log, i) => (
                            <div key={i} style={{
                                color: log.type === 'success' ? '#03dac6' : log.type === 'error' ? 'var(--danger)' : '#aaa',
                                marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px',
                                animation: 'fadeIn 0.3s'
                            }}>
                                <span>{log.type === 'success' ? '✓' : log.type === 'error' ? '×' : '•'}</span>
                                {log.msg}
                            </div>
                        ))}
                    </div>
                    <div style={{
                        position: 'absolute', bottom: 0, left: 0, height: '3px', width: '100%',
                        background: 'rgba(255,255,255,0.05)', overflow: 'hidden', borderRadius: '0 0 8px 8px'
                    }}>
                        {!isFadingLogs && logs.length > 0 && (
                            <div style={{
                                height: '100%', width: '100%', background: 'var(--accent-gold)',
                                animation: 'deplete 10s linear forwards'
                            }} />
                        )}
                    </div>
                </div>
            </div>

            {/* Preview Panel */}
            {preview && (
                <div className="glass-panel" style={{
                    marginTop: '20px',
                    display: 'flex',
                    gap: '20px',
                    alignItems: 'flex-start',
                    padding: '25px',
                    animation: 'slideDown 0.5s cubic-bezier(0.165, 0.84, 0.44, 1)',
                    border: '1px solid rgba(212, 175, 55, 0.2)'
                }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                        <img src={preview.poster_url} alt="" style={{ width: '120px', borderRadius: '8px', boxShadow: '0 5px 15px rgba(0,0,0,0.5)' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <h3 style={{ marginTop: 0, fontSize: '1.4rem' }}>{preview.title} <span style={{ color: 'var(--accent-gold)', fontSize: '1rem', marginLeft: '5px' }}>{preview.year}</span></h3>
                        <div style={{ display: 'flex', gap: '10px', fontSize: '0.85rem', color: '#888', marginBottom: '15px' }}>
                            {preview.rating && <span style={{ background: '#333', padding: '2px 6px', borderRadius: '4px', color: '#fff' }}>★ {preview.rating}</span>}
                            <span>{preview.genres}</span>
                        </div>
                        <p style={{ fontSize: '0.95rem', color: '#ccc', lineHeight: '1.6' }}>{preview.description?.substring(0, 200)}...</p>
                        <div style={{ marginTop: '20px', display: 'flex', gap: '15px' }}>
                            <button onClick={handleAdd} className="btn btn-primary" style={{ padding: '10px 30px' }}>Add to Library</button>
                            <button onClick={() => setPreview(null)} className="btn btn-ghost">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideDown { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                @keyframes deplete { from { width: 100%; } to { width: 0%; } }
                @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
                .search-input::placeholder { color: #555; }
                .result-item:hover {
                    background: rgba(255, 255, 255, 0.08) !important;
                    transform: translateX(5px);
                }
            `}</style>
        </div>
    );
}

export default AddMovie;
