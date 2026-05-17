import { useState, useEffect } from 'react';
import MovieDetailsModal from './MovieDetailsModal';

function CollectionsView({ onBack }) {
    const [collections, setCollections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedCollectionId, setExpandedCollectionId] = useState(null);
    const [expandedCollection, setExpandedCollection] = useState(null);
    const [selectedMovie, setSelectedMovie] = useState(null);
    const [copiedId, setCopiedId] = useState(null);

    const fetchCollections = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/collections');
            const data = await res.json();
            setCollections(data);
        } catch (err) {
            console.error('Failed to fetch collections:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCollections();
    }, []);

    const fetchCollectionDetails = async (id) => {
        try {
            const res = await fetch(`/api/collections/${id}`);
            const data = await res.json();
            setExpandedCollection(data);
        } catch (err) {
            console.error('Failed to fetch collection details:', err);
        }
    };

    useEffect(() => {
        if (expandedCollectionId) {
            fetchCollectionDetails(expandedCollectionId);
        } else {
            setExpandedCollection(null);
        }
    }, [expandedCollectionId]);

    const handleDeleteCollection = async (id, e) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this collection?')) return;
        try {
            await fetch(`/api/collections/${id}`, { method: 'DELETE' });
            if (expandedCollectionId === id) setExpandedCollectionId(null);
            fetchCollections();
        } catch (err) {
            console.error(err);
        }
    };

    const handleRemoveMovie = async (collectionId, movieId, e) => {
        e.stopPropagation();
        if (!confirm('Remove this movie from the collection?')) return;
        try {
            await fetch(`/api/collections/${collectionId}/movies/${movieId}`, {
                method: 'DELETE'
            });
            // Refresh details and collection count
            fetchCollectionDetails(collectionId);
            fetchCollections();
        } catch (err) {
            console.error(err);
        }
    };

    const handleShare = (id, e) => {
        e.stopPropagation();
        // Construct the shareable link pointing to current host with ?collection=id query param
        const shareUrl = `${window.location.origin}/?collection=${id}`;

        const copyText = (text) => {
            if (navigator.clipboard && window.isSecureContext) {
                return navigator.clipboard.writeText(text);
            } else {
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                return new Promise((res, rej) => {
                    document.execCommand('copy') ? res() : rej();
                    textArea.remove();
                });
            }
        };

        copyText(shareUrl)
            .then(() => {
                setCopiedId(id);
                setTimeout(() => setCopiedId(null), 2000);
            })
            .catch(err => {
                console.error('Failed to copy share link:', err);
                alert(`Share Link (Copy manually): ${shareUrl}`);
            });
    };

    return (
        <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            {selectedMovie && (
                <MovieDetailsModal
                    movie={selectedMovie}
                    onClose={() => setSelectedMovie(null)}
                    onUpdate={() => {
                        // Refresh details if movie status updated inside collection view
                        if (expandedCollectionId) fetchCollectionDetails(expandedCollectionId);
                    }}
                    onDelete={() => {}} // Read-only deletion within collection
                    isTrashMode={false}
                />
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <button
                        onClick={onBack}
                        className="btn btn-ghost"
                        style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '8px 15px', borderRadius: '8px' }}
                    >
                        ← Back to Library
                    </button>
                    <h2 style={{ margin: 0, fontSize: '2rem', color: '#fff' }}>
                        📁 My Collections
                    </h2>
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '50px', color: '#888' }}>Loading collections...</div>
            ) : collections.length === 0 ? (
                <div className="glass-panel" style={{ textAlign: 'center', padding: '50px', color: '#888' }}>
                    <p style={{ fontSize: '1.2rem', margin: '0 0 10px 0' }}>No collections yet.</p>
                    <p style={{ fontSize: '0.9rem', color: '#555' }}>
                        Select movies in the Library view and click "Add to Collection" to create one.
                    </p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                    {collections.map(c => {
                        const isExpanded = expandedCollectionId === c.id;
                        return (
                            <div
                                key={c.id}
                                className="glass-panel"
                                style={{
                                    border: isExpanded ? '1px solid var(--accent-gold)' : '1px solid rgba(255,255,255,0.05)',
                                    borderRadius: '12px', overflow: 'hidden',
                                    transition: 'all 0.3s ease'
                                }}
                            >
                                {/* Collection Card Header */}
                                <div
                                    onClick={() => setExpandedCollectionId(isExpanded ? null : c.id)}
                                    style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '20px 25px', cursor: 'pointer', background: 'rgba(255,255,255,0.01)',
                                        flexWrap: 'wrap', gap: '15px'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                    onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.01)'}
                                >
                                    <div style={{ flex: '1', minWidth: '200px' }}>
                                        <h3 style={{ margin: '0 0 5px 0', fontSize: '1.3rem', color: 'var(--accent-gold)' }}>
                                            {c.title}
                                        </h3>
                                        <p style={{ margin: 0, color: '#aaa', fontSize: '0.9rem' }}>
                                            {c.description || 'No description provided.'}
                                        </p>
                                        <span style={{ fontSize: '0.8rem', color: '#666', marginTop: '5px', display: 'inline-block' }}>
                                            Created: {new Date(c.created_at).toLocaleDateString()}
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }} onClick={e => e.stopPropagation()}>
                                        <span style={{
                                            background: 'rgba(212, 175, 55, 0.1)', color: 'var(--accent-gold)',
                                            padding: '4px 10px', borderRadius: '15px', fontSize: '0.8rem', fontWeight: 'bold'
                                        }}>
                                            {c.movie_count} Movie(s)
                                        </span>

                                        <button
                                            onClick={(e) => handleShare(c.id, e)}
                                            className="btn"
                                            style={{
                                                background: copiedId === c.id ? '#03dac6' : 'rgba(255,255,255,0.05)',
                                                color: copiedId === c.id ? '#000' : '#fff',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                padding: '6px 12px', fontSize: '0.8rem', display: 'flex', gap: '5px', alignItems: 'center'
                                            }}
                                        >
                                            {copiedId === c.id ? '✔ Copied!' : '🔗 Share Link'}
                                        </button>

                                        <button
                                            onClick={(e) => handleDeleteCollection(c.id, e)}
                                            className="btn btn-ghost"
                                            style={{ color: 'var(--danger)', padding: '6px', fontSize: '1rem' }}
                                            title="Delete Collection"
                                        >
                                            🗑
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded Movie List */}
                                {isExpanded && (
                                    <div style={{
                                        padding: '25px', borderTop: '1px solid rgba(255,255,255,0.05)',
                                        background: 'rgba(0,0,0,0.2)', animation: 'slideDown 0.3s ease-out'
                                    }}>
                                        {!expandedCollection ? (
                                            <div style={{ textAlign: 'center', color: '#555' }}>Loading movies...</div>
                                        ) : expandedCollection.movies.length === 0 ? (
                                            <div style={{ textAlign: 'center', color: '#555', fontStyle: 'italic' }}>
                                                This collection has no movies. Go to Library, select movies, and add them!
                                            </div>
                                        ) : (
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                                                gap: '20px'
                                            }}>
                                                {expandedCollection.movies.map(movie => (
                                                    <div
                                                        key={movie.id}
                                                        className="glass-panel movie-card"
                                                        onClick={() => setSelectedMovie(movie)}
                                                        style={{
                                                            position: 'relative', cursor: 'pointer', borderRadius: '8px',
                                                            overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)',
                                                            aspectRatio: '2/3', transition: 'transform 0.2s'
                                                        }}
                                                    >
                                                        <img
                                                            src={movie.poster_url}
                                                            alt={movie.title}
                                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                        />
                                                        {/* Delete Movie from Collection button */}
                                                        <button
                                                            onClick={(e) => handleRemoveMovie(c.id, movie.id, e)}
                                                            style={{
                                                                position: 'absolute', top: '8px', right: '8px',
                                                                background: 'rgba(0, 0, 0, 0.7)', color: 'var(--danger)',
                                                                border: 'none', borderRadius: '50%', width: '26px', height: '26px',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                cursor: 'pointer', zIndex: 10, fontSize: '0.8rem'
                                                            }}
                                                            title="Remove from Collection"
                                                        >
                                                            &times;
                                                        </button>
                                                        {/* Bottom title info */}
                                                        <div style={{
                                                            position: 'absolute', bottom: 0, left: 0, width: '100%',
                                                            padding: '20px 10px 10px', zIndex: 2,
                                                            background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)'
                                                        }}>
                                                            <h4 style={{
                                                                fontSize: '0.85rem', color: '#fff', margin: '0 0 2px 0',
                                                                textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap'
                                                            }}>
                                                                {movie.title}
                                                            </h4>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#aaa' }}>
                                                                <span>{movie.year}</span>
                                                                <span style={{ color: 'var(--accent-gold)' }}>★ {movie.rating || '-'}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
            <style>{`
                @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
}

export default CollectionsView;
