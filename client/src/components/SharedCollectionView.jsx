import { useState, useEffect, useMemo } from 'react';
import MovieDetailsModal from './MovieDetailsModal';
import MovieComparisonModal from './MovieComparisonModal';

function SharedCollectionView({ collectionId, onExit }) {
    const [collection, setCollection] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedMovie, setSelectedMovie] = useState(null);
    const [importingIds, setImportingIds] = useState([]);
    const [importSuccessIds, setImportSuccessIds] = useState([]);
    const [importFailedIds, setImportFailedIds] = useState([]);

    // Multiselect & Comparison for Shared Collection
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const [selectedMovieIds, setSelectedMovieIds] = useState([]);
    const [compareMovieLinks, setCompareMovieLinks] = useState([]);
    const [isCompareOpen, setIsCompareOpen] = useState(false);
    const [ownedMovieLinks, setOwnedMovieLinks] = useState([]);

    const fetchOwnedMovies = async () => {
        try {
            const res = await fetch('/api/movies');
            const data = await res.json();
            if (Array.isArray(data)) {
                setOwnedMovieLinks(data.map(m => m.link));
            }
        } catch (err) {
            console.error('Failed to fetch owned movies:', err);
        }
    };

    const handleBulkImport = async () => {
        if (!collection) return;
        try {
            const res = await fetch(`/api/collections/${collection.id}/import-movies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ movieIds: selectedMovieIds })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to import movies');

            setImportSuccessIds(prev => [...prev, ...selectedMovieIds]);
            setSelectedMovieIds([]);
            fetchOwnedMovies();
        } catch (err) {
            console.error('Bulk import failed:', err);
        }
    };

    useEffect(() => {
        fetchOwnedMovies();
    }, []);

    // Filters & Sort
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [sortField, setSortField] = useState('title');
    const [sortDir, setSortDir] = useState('asc');
    const [viewMode, setViewMode] = useState('grid');
    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        const fetchSharedCollection = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/collections/${collectionId}`);
                if (!res.ok) throw new Error('Collection not found');
                const data = await res.json();
                setCollection(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        if (collectionId) fetchSharedCollection();
    }, [collectionId]);

    const handleImportMovie = async (movie, e) => {
        if (e) e.stopPropagation();
        setImportingIds(prev => [...prev, movie.id]);
        setImportFailedIds(prev => prev.filter(id => id !== movie.id));
        try {
            const res = await fetch('/api/movies/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: movie.link,
                    source_collection_name: collection.title,
                    source_collection_token: collection.share_token,
                    source_user_name: collection.owner_username
                })
            });
            if (res.ok || res.status === 409) {
                setImportSuccessIds(prev => [...prev, movie.id]);
            } else {
                setImportFailedIds(prev => [...prev, movie.id]);
                setTimeout(() => setImportFailedIds(prev => prev.filter(id => id !== movie.id)), 4000);
            }
        } catch (err) {
            console.error('Import failed:', err);
            setImportFailedIds(prev => [...prev, movie.id]);
            setTimeout(() => setImportFailedIds(prev => prev.filter(id => id !== movie.id)), 4000);
        } finally {
            setImportingIds(prev => prev.filter(id => id !== movie.id));
        }
    };

    const filteredMovies = useMemo(() => {
        if (!collection?.movies) return [];
        let list = [...collection.movies];

        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(m =>
                m.title?.toLowerCase().includes(q) ||
                m.genres?.toLowerCase().includes(q) ||
                m.director?.toLowerCase().includes(q)
            );
        }
        if (filterType !== 'all') {
            list = list.filter(m => m.type === filterType);
        }

        list.sort((a, b) => {
            let va, vb;
            if (sortField === 'rating') { va = parseFloat(a.rating) || 0; vb = parseFloat(b.rating) || 0; }
            else if (sortField === 'year') { va = parseInt(a.year) || 0; vb = parseInt(b.year) || 0; }
            else if (sortField === 'user_rating') { va = parseFloat(a.user_rating) || 0; vb = parseFloat(b.user_rating) || 0; }
            else { va = (a.title || '').toLowerCase(); vb = (b.title || '').toLowerCase(); }
            if (va < vb) return sortDir === 'asc' ? -1 : 1;
            if (va > vb) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
        return list;
    }, [collection, search, filterType, sortField, sortDir]);

    const toggleSort = (field) => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('asc'); }
    };

    if (loading) return (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#888' }}>
            <div style={{ width: '40px', height: '40px', border: '3px solid rgba(212,175,55,0.3)', borderTopColor: 'var(--accent-gold)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 20px' }} />
            <p>Loading shared collection...</p>
        </div>
    );

    if (error || !collection) return (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <h2 style={{ color: 'var(--danger)', marginBottom: '15px' }}>⚠️ Collection Not Found</h2>
            <p style={{ color: '#888', marginBottom: '25px' }}>The link might be broken or the collection was deleted.</p>
            <button onClick={onExit} className="btn btn-primary" style={{ padding: '10px 20px' }}>Go to My Library</button>
        </div>
    );

    const sortLabel = { title: 'Title', rating: 'Rating', year: 'Year', user_rating: 'User Rating' };
    const sortArrow = sortDir === 'asc' ? '↑' : '↓';

    return (
        <div style={{ animation: 'fadeIn 0.3s ease-out', maxWidth: '1400px', margin: '0 auto' }}>
            {selectedMovie && (
                <MovieDetailsModal
                    movie={selectedMovie}
                    onClose={() => setSelectedMovie(null)}
                    readOnly={true}
                    isTrashMode={false}
                />
            )}

            {/* Header */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(212,175,55,0.08) 0%, rgba(0,0,0,0) 60%)',
                border: '1px solid rgba(212,175,55,0.15)',
                borderRadius: '16px',
                padding: 'clamp(20px, 4vw, 36px) clamp(16px, 4vw, 40px)',
                marginBottom: '24px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                flexWrap: 'wrap', gap: '16px'
            }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                    <span style={{ color: 'var(--accent-gold)', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', display: 'block', marginBottom: '6px' }}>
                        🍿 Shared Collection
                    </span>
                    <h1 style={{ fontSize: 'clamp(1.4rem, 4vw, 2.2rem)', margin: '0 0 8px 0', color: '#fff', lineHeight: 1.15 }}>
                        {collection.title}
                    </h1>
                    {collection.description && (
                        <p style={{ color: '#aaa', fontSize: 'clamp(0.85rem, 2vw, 1rem)', margin: 0, lineHeight: 1.55 }}>
                            {collection.description}
                        </p>
                    )}
                    <div style={{ marginTop: '10px', fontSize: '0.8rem', color: '#555' }}>
                        {collection.movies.length} film{collection.movies.length !== 1 ? 's' : ''}
                        {filteredMovies.length !== collection.movies.length && ` · ${filteredMovies.length} shown`}
                    </div>
                </div>
                <button onClick={onExit} className="btn" style={{
                    background: 'var(--accent-gold)', color: '#000',
                    padding: '10px 20px', fontWeight: 700, fontSize: '0.88rem',
                    boxShadow: '0 4px 15px rgba(212,175,55,0.2)', flexShrink: 0, borderRadius: '12px'
                }}>
                    🎬 My Library
                </button>
            </div>

            {/* Filter & Sort Bar */}
            <div style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '14px', padding: '12px 16px', marginBottom: '20px',
                display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center'
            }}>
                {/* Search */}
                <div style={{ position: 'relative', flex: '1', minWidth: '160px', maxWidth: '280px' }}>
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search title, genre..."
                        style={{
                            width: '100%', boxSizing: 'border-box',
                            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '10px', padding: '7px 12px 7px 32px',
                            color: '#fff', fontSize: '0.84rem', outline: 'none'
                        }}
                    />
                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#555', fontSize: '0.85rem' }}>🔍</span>
                </div>

                {/* Type filter pills */}
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '20px', padding: '3px', gap: '1px' }}>
                    {[['all','All'],['movie','Movies'],['series','Series']].map(([v, label]) => (
                        <button key={v} onClick={() => setFilterType(v)} style={{
                            padding: '5px 13px', borderRadius: '16px', border: 'none', cursor: 'pointer',
                            fontSize: '0.78rem', fontWeight: 600,
                            background: filterType === v ? 'var(--accent-gold)' : 'transparent',
                            color: filterType === v ? '#000' : '#888', transition: 'all 0.2s'
                        }}>{label}</button>
                    ))}
                </div>

                {/* Sort */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {[['title','Title'],['rating','Rating'],['year','Year'],['user_rating','⭐ User']].map(([f, label]) => (
                        <button key={f} onClick={() => toggleSort(f)} style={{
                            padding: '5px 12px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                            fontSize: '0.78rem',
                            background: sortField === f ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.05)',
                            color: sortField === f ? 'var(--accent-gold)' : '#777',
                            transition: 'all 0.2s'
                        }}>
                            {label} {sortField === f ? sortArrow : ''}
                        </button>
                    ))}
                </div>

                {/* View toggle */}
                <div style={{ marginLeft: 'auto', display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '20px', padding: '3px' }}>
                    {[['grid','⊞'],['table','☰']].map(([m, icon]) => (
                        <button key={m} onClick={() => setViewMode(m)} style={{
                            width: '34px', height: '28px', borderRadius: '14px', border: 'none', cursor: 'pointer',
                            background: viewMode === m ? 'var(--accent-gold)' : 'transparent',
                            color: viewMode === m ? '#000' : '#777', fontSize: '0.95rem', transition: 'all 0.2s'
                        }}>{icon}</button>
                    ))}
                </div>
            </div>

            {collection && collection.movies.length > 0 && (
                <div style={{
                    display: 'flex', gap: '15px', alignItems: 'center',
                    marginBottom: '20px', padding: '12px 18px',
                    background: 'rgba(255,255,255,0.02)', borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap'
                }} onClick={e => e.stopPropagation()}>
                    <button
                        onClick={() => {
                            const allIds = collection.movies.map(m => m.id);
                            if (selectedMovieIds.length === allIds.length) {
                                setSelectedMovieIds([]);
                            } else {
                                setSelectedMovieIds(allIds);
                            }
                        }}
                        className="btn btn-ghost"
                        style={{ border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.8rem', padding: '5px 12px' }}
                    >
                        {selectedMovieIds.length === collection.movies.length ? 'Deselect All' : 'Select All'}
                    </button>
                    <span style={{ fontSize: '0.85rem', color: '#888' }}>
                        {selectedMovieIds.length} movie(s) selected
                    </span>
                    {selectedMovieIds.length > 0 && (
                        <>
                            <button
                                onClick={handleBulkImport}
                                className="btn btn-gold"
                                style={{ padding: '6px 14px', fontSize: '0.8rem', fontWeight: 'bold' }}
                            >
                                📥 Add Selected to Library
                            </button>
                            {selectedMovieIds.length >= 2 && selectedMovieIds.length <= (isMobile ? 2 : 3) && (
                                <button
                                    onClick={() => {
                                        const selectedMovies = collection.movies.filter(m => selectedMovieIds.includes(m.id));
                                        setCompareMovieLinks(selectedMovies.map(m => m.link));
                                        setIsCompareOpen(true);
                                    }}
                                    className="btn"
                                    style={{
                                        background: 'rgba(255,255,255,0.1)', color: '#fff',
                                        border: '1px solid rgba(255,255,255,0.15)', padding: '6px 14px',
                                        fontSize: '0.8rem', fontWeight: 'bold'
                                    }}
                                >
                                    ⚖️ Compare Selected
                                </button>
                            )}
                            {selectedMovieIds.length > (isMobile ? 2 : 3) && (
                                <span style={{ fontSize: '0.8rem', color: '#888', fontStyle: 'italic', padding: '6px 0' }}>
                                    Compare (max {isMobile ? 2 : 3})
                                </span>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Movies */}
            {filteredMovies.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#555' }}>
                    {search || filterType !== 'all' ? 'No movies match your filters.' : 'This collection is empty.'}
                </div>
            ) : viewMode === 'grid' ? (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(130px, 18vw, 180px), 1fr))',
                    gap: 'clamp(10px, 2vw, 20px)'
                }}>
                    {filteredMovies.map(movie => {
                        const isImporting = importingIds.includes(movie.id);
                        const isImported = importSuccessIds.includes(movie.id);
                        const isFailed = importFailedIds.includes(movie.id);
                        return (
                            <div key={movie.id}
                                onClick={() => setSelectedMovie(movie)}
                                style={{
                                    position: 'relative', cursor: 'pointer', borderRadius: '10px',
                                    overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)',
                                    aspectRatio: '2/3', transition: 'transform 0.25s, box-shadow 0.25s'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                            >
                                <img src={movie.poster_url} alt={movie.title}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />

                                {/* Checkbox */}
                                <div 
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                        position: 'absolute', top: '7px', left: '7px', zIndex: 12,
                                        background: 'rgba(0,0,0,0.6)', borderRadius: '4px', padding: '4px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedMovieIds.includes(movie.id)}
                                        onChange={(e) => {
                                            setSelectedMovieIds(prev => 
                                                e.target.checked 
                                                    ? [...prev, movie.id] 
                                                    : prev.filter(id => id !== movie.id)
                                            );
                                        }}
                                        style={{
                                            cursor: 'pointer', width: '18px', height: '18px',
                                            accentColor: 'var(--accent-gold)'
                                        }}
                                    />
                                </div>

                                {/* Add button */}
                                <button onClick={e => handleImportMovie(movie, e)} disabled={isImporting || isImported}
                                    style={{
                                        position: 'absolute', top: '7px', right: '7px', zIndex: 10,
                                        background: isFailed ? 'rgba(239,68,68,0.9)' : isImported ? 'rgba(3,218,198,0.9)' : 'rgba(0,0,0,0.78)',
                                        color: isFailed ? '#fff' : isImported ? '#000' : 'var(--accent-gold)',
                                        border: '1px solid rgba(255,255,255,0.12)',
                                        borderRadius: '18px', padding: '4px 9px', fontSize: '0.68rem',
                                        fontWeight: 700, cursor: isImported ? 'default' : 'pointer',
                                        whiteSpace: 'nowrap', transition: 'all 0.2s'
                                    }}>
                                    {isImporting ? '⏳' : isFailed ? '❌ Failed' : isImported ? '✔' : '+ Add'}
                                </button>


                                {/* Bottom overlay */}
                                <div style={{
                                    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 5,
                                    background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 55%, transparent 100%)',
                                    padding: 'clamp(14px,3vw,20px) clamp(8px,2vw,14px) clamp(8px,2vw,12px)'
                                }}>
                                    <div style={{ fontSize: 'clamp(0.78rem,1.8vw,0.95rem)', fontWeight: 700, color: '#fff', lineHeight: 1.2, marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {movie.title}
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'clamp(0.65rem,1.5vw,0.75rem)', color: '#bbb' }}>
                                        <span>{movie.year}</span>
                                        <span style={{ color: 'var(--accent-gold)', fontWeight: 700 }}>★ {movie.rating || '–'}</span>
                                    </div>
                                    {movie.user_rating && (
                                        <div style={{ fontSize: '0.65rem', color: '#888', marginTop: '2px' }}>
                                            User: {movie.user_rating}/10
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* Table view */
                <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '480px' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
                                <th style={{ padding: '10px 14px', textAlign: 'left', color: '#555', fontWeight: 500, fontSize: '0.78rem', width: '30px' }}>
                                    <input
                                        type="checkbox"
                                        checked={filteredMovies.length > 0 && selectedMovieIds.length === filteredMovies.length}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedMovieIds(filteredMovies.map(m => m.id));
                                            } else {
                                                setSelectedMovieIds([]);
                                            }
                                        }}
                                        style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--accent-gold)' }}
                                    />
                                </th>
                                <th style={{ padding: '10px 14px', textAlign: 'left', color: '#555', fontWeight: 500, fontSize: '0.78rem', width: '44px' }}></th>
                                <th style={{ padding: '10px 14px', textAlign: 'left', color: '#555', fontWeight: 500, fontSize: '0.78rem' }}>Title</th>
                                <th style={{ padding: '10px 14px', textAlign: 'left', color: '#555', fontWeight: 500, fontSize: '0.78rem' }}>Year</th>
                                <th style={{ padding: '10px 14px', textAlign: 'left', color: '#555', fontWeight: 500, fontSize: '0.78rem' }}>Rating</th>
                                <th style={{ padding: '10px 14px', textAlign: 'left', color: '#555', fontWeight: 500, fontSize: '0.78rem' }}>Genre</th>
                                <th style={{ padding: '10px 14px', textAlign: 'right', color: '#555', fontWeight: 500, fontSize: '0.78rem', width: '90px' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredMovies.map(movie => {
                                const isImporting = importingIds.includes(movie.id);
                                const isImported = importSuccessIds.includes(movie.id);
                                const isFailed = importFailedIds.includes(movie.id);
                                return (
                                    <tr key={movie.id}
                                        onClick={() => setSelectedMovie(movie)}
                                        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'background 0.15s' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <td style={{ padding: '8px 14px' }} onClick={e => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={selectedMovieIds.includes(movie.id)}
                                                onChange={(e) => {
                                                    setSelectedMovieIds(prev => 
                                                        e.target.checked 
                                                            ? [...prev, movie.id] 
                                                            : prev.filter(id => id !== movie.id)
                                                    );
                                                }}
                                                style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--accent-gold)' }}
                                            />
                                        </td>
                                        <td style={{ padding: '8px 14px' }}>
                                            <img src={movie.poster_url} alt="" style={{ width: '32px', height: '46px', objectFit: 'cover', borderRadius: '4px' }} />
                                        </td>
                                        <td style={{ padding: '8px 14px', fontWeight: 600, color: '#eee', fontSize: '0.88rem' }}>{movie.title}</td>
                                        <td style={{ padding: '8px 14px', color: '#777', fontSize: '0.82rem' }}>{movie.year}</td>
                                        <td style={{ padding: '8px 14px', color: 'var(--accent-gold)', fontSize: '0.82rem', fontWeight: 700 }}>★ {movie.rating || '–'}</td>
                                        <td style={{ padding: '8px 14px', color: '#666', fontSize: '0.78rem', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{movie.genres || '–'}</td>
                                        <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                                            <button onClick={e => handleImportMovie(movie, e)} disabled={isImporting || isImported}
                                                style={{
                                                    background: isFailed ? 'rgba(239,68,68,0.15)' : isImported ? 'rgba(3,218,198,0.15)' : 'rgba(212,175,55,0.12)',
                                                    color: isFailed ? '#ff6b6b' : isImported ? '#03dac6' : 'var(--accent-gold)',
                                                    border: `1px solid ${isFailed ? 'rgba(239,68,68,0.3)' : isImported ? 'rgba(3,218,198,0.3)' : 'rgba(212,175,55,0.3)'}`,
                                                    borderRadius: '8px', padding: '4px 12px', fontSize: '0.75rem',
                                                    cursor: isImported ? 'default' : 'pointer', whiteSpace: 'nowrap'
                                                }}>
                                                {isImporting ? '⏳' : isFailed ? '❌ Failed' : isImported ? '✔ Added' : '+ Add'}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {isCompareOpen && (
                <MovieComparisonModal
                    isOpen={isCompareOpen}
                    onClose={() => setIsCompareOpen(false)}
                    movieLinks={compareMovieLinks}
                    onAddMovie={async (link) => {
                        const movie = collection.movies.find(m => m.link === link);
                        if (movie) {
                            handleImportMovie(movie);
                        } else {
                            try {
                                await fetch('/api/movies/import', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ url: link })
                                });
                                fetchOwnedMovies();
                            } catch (e) {
                                console.error(e);
                            }
                        }
                    }}
                    isOwned={(link) => ownedMovieLinks.includes(link)}
                />
            )}

            <style>{`
                @keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
                @media (max-width: 480px) {
                    input[placeholder] { font-size: 0.8rem !important; }
                }
            `}</style>
        </div>
    );
}

export default SharedCollectionView;
