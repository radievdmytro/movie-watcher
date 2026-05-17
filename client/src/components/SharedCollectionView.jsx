import { useState, useEffect } from 'react';
import MovieDetailsModal from './MovieDetailsModal';

function SharedCollectionView({ collectionId, onExit }) {
    const [collection, setCollection] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedMovie, setSelectedMovie] = useState(null);
    const [importingIds, setImportingIds] = useState([]);
    const [importSuccessIds, setImportSuccessIds] = useState([]);

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

        if (collectionId) {
            fetchSharedCollection();
        }
    }, [collectionId]);

    const handleImportMovie = async (movie, e) => {
        if (e) e.stopPropagation();
        setImportingIds(prev => [...prev, movie.id]);
        try {
            const res = await fetch('/api/movies/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: movie.link })
            });
            if (res.ok || res.status === 409) { // 409 means already exists
                setImportSuccessIds(prev => [...prev, movie.id]);
            } else {
                alert('Failed to import movie. Please try again.');
            }
        } catch (err) {
            console.error('Import failed:', err);
        } finally {
            setImportingIds(prev => prev.filter(id => id !== movie.id));
        }
    };

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '100px', color: '#888' }}>
                <h3>Loading shared collection...</h3>
            </div>
        );
    }

    if (error || !collection) {
        return (
            <div style={{ textAlign: 'center', padding: '80px' }}>
                <h2 style={{ color: 'var(--danger)', marginBottom: '15px' }}>⚠️ Collection Not Found</h2>
                <p style={{ color: '#888', marginBottom: '25px' }}>The link might be broken or the collection was deleted.</p>
                <button onClick={onExit} className="btn btn-primary" style={{ padding: '10px 20px' }}>
                    Go to My Library
                </button>
            </div>
        );
    }

    return (
        <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            {selectedMovie && (
                <MovieDetailsModal
                    movie={selectedMovie}
                    onClose={() => setSelectedMovie(null)}
                    readOnly={true}
                    isTrashMode={false}
                />
            )}

            {/* Premium Header Banner */}
            <div className="glass-panel" style={{ padding: '30px 40px', borderRadius: '16px', marginBottom: '35px', border: '1px solid rgba(212,175,55,0.15)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
                    <div style={{ flex: '1', minWidth: '300px' }}>
                        <span style={{ color: 'var(--accent-gold)', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '2px', display: 'block', marginBottom: '8px' }}>
                            🍿 Shared Collection
                        </span>
                        <h2 style={{ fontSize: '2.5rem', margin: '0 0 10px 0', color: '#fff', lineHeight: '1.1' }}>
                            {collection.title}
                        </h2>
                        <p style={{ color: '#ccc', fontSize: '1.1rem', margin: 0, lineHeight: '1.6' }}>
                            {collection.description || 'No description provided.'}
                        </p>
                    </div>

                    <button
                        onClick={onExit}
                        className="btn"
                        style={{
                            background: 'var(--accent-gold)', color: '#000',
                            padding: '12px 24px', fontWeight: 'bold', fontSize: '0.95rem',
                            boxShadow: '0 4px 15px rgba(212,175,55,0.2)'
                        }}
                    >
                        🎬 Open My Library
                    </button>
                </div>
            </div>

            {/* Movies List */}
            {collection.movies.length === 0 ? (
                <div className="glass-panel" style={{ textAlign: 'center', padding: '60px', color: '#666' }}>
                    This collection is currently empty.
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '30px'
                }}>
                    {collection.movies.map(movie => {
                        const isImporting = importingIds.includes(movie.id);
                        const isImported = importSuccessIds.includes(movie.id);

                        return (
                            <div
                                key={movie.id}
                                className="glass-panel movie-card"
                                onClick={() => setSelectedMovie(movie)}
                                style={{
                                    position: 'relative', cursor: 'pointer', borderRadius: '12px',
                                    overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)',
                                    aspectRatio: '2/3', transition: 'transform 0.3s ease-out'
                                }}
                            >
                                <img
                                    src={movie.poster_url}
                                    alt={movie.title}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />

                                {/* Action Badge / Import */}
                                <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10 }}>
                                    <button
                                        onClick={(e) => handleImportMovie(movie, e)}
                                        disabled={isImporting || isImported}
                                        style={{
                                            background: isImported ? 'rgba(3, 218, 198, 0.9)' : 'rgba(0, 0, 0, 0.75)',
                                            color: isImported ? '#000' : 'var(--accent-gold)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '20px', padding: '6px 12px', fontSize: '0.75rem',
                                            fontWeight: 'bold', cursor: isImported ? 'default' : 'pointer',
                                            display: 'flex', gap: '5px', alignItems: 'center',
                                            boxShadow: '0 4px 10px rgba(0,0,0,0.4)',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {isImporting ? '⏳ Importing...' : isImported ? '✔ Added!' : '📥 Add to My Library'}
                                    </button>
                                </div>

                                {/* Info Card Overlay */}
                                <div style={{
                                    position: 'absolute', bottom: 0, left: 0, width: '100%',
                                    display: 'flex', flexDirection: 'column',
                                    zIndex: 5
                                }}>
                                    {/* Backdrop gradient */}
                                    <div style={{
                                        position: 'absolute', inset: 0,
                                        background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 60%, transparent 100%)',
                                        zIndex: -1
                                    }}></div>

                                    <div style={{ padding: '20px 15px 15px' }}>
                                        <h3 style={{
                                            fontSize: '1.05rem', lineHeight: '1.25', color: '#fff',
                                            margin: '0 0 4px 0', textShadow: '0 2px 4px rgba(0,0,0,0.8)',
                                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                        }}>
                                            {movie.title}
                                        </h3>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#ccc' }}>
                                            <span>{movie.year}</span>
                                            <span style={{ color: 'var(--accent-gold)', fontWeight: 'bold' }}>★ {movie.rating || '-'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default SharedCollectionView;
