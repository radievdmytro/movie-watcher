import { useState, useEffect, useRef } from 'react';

function AddMovie({ onMovieAdded }) {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [preview, setPreview] = useState(null);
    const [searchResults, setSearchResults] = useState(null);
    const [showResultsPanel, setShowResultsPanel] = useState(false);
    const [logs, setLogs] = useState([]);
    const [isFadingLogs, setIsFadingLogs] = useState(false);

    // Filters for search results
    const [searchFilterType, setSearchFilterType] = useState('all');
    const [searchFilterYear, setSearchFilterYear] = useState([1900, new Date().getFullYear() + 2]);
    const [searchFilterGenres, setSearchFilterGenres] = useState([]);
    const [searchFilterGenreMode, setSearchFilterGenreMode] = useState('include');
    const [showSearchFilters, setShowSearchFilters] = useState(false);

    const containerRef = useRef(null);

    const isHdrezkaUrl = (str) => str.includes('hdrezka') && (str.startsWith('http://') || str.startsWith('https://'));

    const extractUrls = (text) => {
        const match = text.match(/\bhttps?:\/\/\S+/gi);
        return match ? match.filter(url => url.includes('hdrezka')) : [];
    };

    const handleSearch = async (isAuto = false) => {
        if (!query.trim()) {
            setPreview(null);
            setSearchResults(null);
            setShowResultsPanel(false);
            return;
        }

        const urls = extractUrls(query);
        if (isAuto && (urls.length > 1 || query.length < 3)) return;

        setLoading(true);
        if (!isAuto) {
            setPreview(null);
            setSearchResults(null);
            setLogs([]);
            setIsFadingLogs(false);
        }

        if (urls.length > 1) {
            await handleBatchImport(urls);
            setLoading(false);
            return;
        }

        try {
            const res = await fetch('/api/movies/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: query.trim() })
            });
            const data = await res.json();

            if (data.type === 'detail') {
                setPreview(data.data);
                setShowResultsPanel(false);
            } else if (data.type === 'list') {
                setSearchResults(data.data);
                setShowResultsPanel(true);

                // Auto-open detail panel if only one result
                if (data.data.length === 1) {
                    const singleResult = data.data[0];
                    try {
                        const detailRes = await fetch('/api/movies/details', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ link: singleResult.link })
                        });
                        const detailData = await detailRes.json();
                        setPreview(detailData);
                        setShowResultsPanel(false);
                    } catch (err) {
                        console.error('Failed to auto-fetch details:', err);
                    }
                }
            }
        } catch (error) {
            console.error('Search failed:', error);
            if (!isAuto) alert('Search failed');
        } finally {
            if (urls.length <= 1) setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            if (query.trim()) {
                handleSearch(true);
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
                alert(d.error);
            }
        } catch (error) {
            console.error(error);
        }
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
            setShowResultsPanel(true);
        } catch (error) {
            console.error('Category fetch failed:', error);
            alert('Failed to fetch category');
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
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
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
                    onClick={() => handleSearch(false)}
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

            {/* Search Results Dropdown/Panel */}
            <div
                style={{
                    position: 'absolute',
                    top: 'calc(100% - 20px)', // Overlap slightly for seamless feel
                    left: '5%',
                    right: '5%',
                    background: 'rgba(25, 25, 25, 0.95)',
                    backdropFilter: 'blur(15px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderTop: 'none',
                    borderRadius: '0 0 20px 20px',
                    padding: '25px 20px 20px 20px',
                    boxShadow: '0 15px 30px rgba(0,0,0,0.5)',
                    zIndex: 5,
                    opacity: showResultsPanel && searchResults ? 1 : 0,
                    transform: showResultsPanel && searchResults ? 'translateY(0)' : 'translateY(-20px)',
                    pointerEvents: showResultsPanel && searchResults ? 'auto' : 'none',
                    transition: 'all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1)',
                    maxHeight: '400px',
                    overflowY: 'auto'
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <h4 style={{ color: 'var(--accent-gold)', margin: 0 }}>Select Movie</h4>
                        {filteredSearchResults.length > 1 && (
                            <button
                                onClick={() => handleBatchImport(filteredSearchResults.map(i => i.link))}
                                className="btn btn-primary"
                                style={{
                                    fontSize: '0.7rem',
                                    padding: '4px 12px',
                                    height: 'auto',
                                    whiteSpace: 'nowrap',
                                    borderRadius: '15px',
                                    boxShadow: '0 2px 8px rgba(212, 175, 55, 0.4)'
                                }}
                            >
                                ADD {filteredSearchResults.length} RESULTS
                            </button>
                        )}
                    </div>
                    <button onClick={() => setShowResultsPanel(false)} className="btn btn-ghost" style={{ fontSize: '1.2rem', padding: '0 5px' }}>&times;</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {filteredSearchResults.length > 0 ? filteredSearchResults.map((item, idx) => (
                        <div key={idx} onClick={() => handleSelectMovie(item.link)} style={{
                            display: 'flex', gap: '15px', padding: '10px',
                            border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px',
                            cursor: 'pointer', transition: 'all 0.2s',
                            position: 'relative'
                        }}
                            className="result-item"
                        >
                            <img src={item.img} alt={item.title} style={{ width: '50px', height: '75px', objectFit: 'cover', borderRadius: '6px' }} />
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ fontSize: '1rem', fontWeight: 'bold' }}>{item.title}</div>
                                    {(() => {
                                        const isCartoon = item.misc?.toLowerCase().includes('мульт') || item.misc?.toLowerCase().includes('анимац') || item.link?.includes('/cartoons/') || item.link?.includes('/animation/');
                                        const isAnime = item.misc?.toLowerCase().includes('аниме');

                                        if (isCartoon) return <span className="badge-search" style={{ background: 'rgba(255, 152, 0, 0.3)', color: '#ffcc80', borderColor: 'rgba(255,152,0,0.5)' }}>Cartoon</span>;
                                        if (isAnime) return <span className="badge-search" style={{ background: 'rgba(233, 30, 99, 0.3)', color: '#f48fb1', borderColor: 'rgba(233,30,99,0.5)' }}>Anime</span>;

                                        return (
                                            <>
                                                {item.misc?.toLowerCase().includes('триллер') && <span className="badge-search" style={{ background: 'rgba(183, 28, 28, 0.3)', color: '#ef9a9a', borderColor: 'rgba(183,28,28,0.5)' }}>Thriller</span>}
                                                {item.misc?.toLowerCase().includes('детектив') && <span className="badge-search" style={{ background: 'rgba(74, 20, 140, 0.3)', color: '#ce93d8', borderColor: 'rgba(74,20,140,0.5)' }}>Detective</span>}
                                                {item.misc?.toLowerCase().includes('ужас') && <span className="badge-search" style={{ background: 'rgba(46, 125, 50, 0.3)', color: '#a5d6a7', borderColor: 'rgba(46,125,50,0.3)' }}>Horror</span>}
                                                {item.misc?.toLowerCase().includes('комед') && <span className="badge-search" style={{ background: 'rgba(251, 192, 45, 0.3)', color: '#fff59d', borderColor: 'rgba(251,192,45,0.5)' }}>Comedy</span>}
                                                {(item.misc?.toLowerCase().includes('мелодрам') || item.misc?.toLowerCase().includes('драма')) && (
                                                    <span className="badge-search" style={{ background: 'rgba(194, 24, 91, 0.3)', color: '#f48fb1', borderColor: 'rgba(194,24,91,0.5)' }}>Drama</span>
                                                )}
                                            </>
                                        );
                                    })()}
                                    {item.type === 'series' && <span className="badge-search" style={{ background: 'rgba(33, 150, 243, 0.3)', color: '#90caf9', borderColor: 'rgba(33,150,243,0.5)' }}>TV</span>}

                                    <style>{`
                                        .badge-search {
                                            font-size: 0.55rem; padding: 1px 4px; border-radius: 3px; border: 1px solid;
                                            text-transform: uppercase; line-height: 1; margin-right: 4px;
                                        }
                                    `}</style>
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#888' }}>{item.misc}</div>
                                {item.rating && <span style={{ fontSize: '0.75rem', background: '#333', padding: '1px 5px', borderRadius: '4px', marginTop: '5px', display: 'inline-block' }}>★ {item.rating}</span>}
                            </div>
                        </div>
                    )) : (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>No results match your filters</div>
                    )}
                </div>
            </div>

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
