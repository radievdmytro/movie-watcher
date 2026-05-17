import { useState, useEffect } from 'react';
import MovieDetailsModal from './MovieDetailsModal';

function CollectionsView({ onBack }) {
    const [activeTab, setActiveTab] = useState('mine'); // 'mine' | 'shared'
    const [collections, setCollections] = useState([]);
    const [sharedCollections, setSharedCollections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sharedLoading, setSharedLoading] = useState(false);
    const [expandedCollectionId, setExpandedCollectionId] = useState(null);
    const [expandedCollection, setExpandedCollection] = useState(null);
    const [selectedMovie, setSelectedMovie] = useState(null);
    const [copiedId, setCopiedId] = useState(null);

    // Inline Actions and Feedback (No native windows!)
    const [confirmDeleteCollId, setConfirmDeleteCollId] = useState(null);
    const [confirmRemoveMovieKey, setConfirmRemoveMovieKey] = useState(null); // `${collId}-${movieId}`
    const [confirmCloneCollId, setConfirmCloneCollId] = useState(null);
    const [actionFeedback, setActionFeedback] = useState({ id: null, type: '', message: '' });

    // Share Modal State
    const [sharingCollection, setSharingCollection] = useState(null);
    const [shareRecipient, setShareRecipient] = useState('');
    const [shareError, setShareError] = useState('');
    const [shareSuccess, setShareSuccess] = useState('');
    const [sharingLoading, setSharingLoading] = useState(false);

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

    const fetchSharedCollections = async () => {
        setSharedLoading(true);
        try {
            const res = await fetch('/api/collections-shared-with-me');
            const data = await res.json();
            setSharedCollections(data);
        } catch (err) {
            console.error('Failed to fetch shared collections:', err);
        } finally {
            setSharedLoading(false);
        }
    };

    useEffect(() => {
        fetchCollections();
        fetchSharedCollections();
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
        if (e) e.stopPropagation();
        try {
            await fetch(`/api/collections/${id}`, { method: 'DELETE' });
            if (expandedCollectionId === id) setExpandedCollectionId(null);
            setConfirmDeleteCollId(null);
            fetchCollections();
        } catch (err) {
            console.error(err);
        }
    };

    const handleRemoveMovie = async (collectionId, movieId, e) => {
        if (e) e.stopPropagation();
        try {
            await fetch(`/api/collections/${collectionId}/movies/${movieId}`, {
                method: 'DELETE'
            });
            setConfirmRemoveMovieKey(null);
            fetchCollectionDetails(collectionId);
            fetchCollections();
        } catch (err) {
            console.error(err);
        }
    };

    const handleShare = (collection, e) => {
        e.stopPropagation();
        const token = collection.share_token || collection.id;
        // Dynamically compute the path to support subdirectories (like /movie-watcher/) on GitHub Pages
        const path = window.location.pathname.endsWith('/') ? window.location.pathname : window.location.pathname + '/';
        const shareUrl = `${window.location.origin}${path}?collection=${token}`;

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
                setCopiedId(collection.id);
                setTimeout(() => setCopiedId(null), 2000);
            })
            .catch(err => {
                console.error('Failed to copy share link:', err);
                setActionFeedback({ id: collection.id, type: 'info', message: `Link: ${shareUrl}` });
            });
    };

    const handleSendShare = async (e) => {
        e.preventDefault();
        setShareError('');
        setShareSuccess('');
        setSharingLoading(true);

        try {
            const res = await fetch(`/api/collections/${sharingCollection.id}/share`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: shareRecipient })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to share collection');

            setShareSuccess(`Collection successfully sent to @${shareRecipient}!`);
            fetchCollections();
            setTimeout(() => {
                setSharingCollection(null);
                setShareRecipient('');
                setShareSuccess('');
            }, 1800);
        } catch (err) {
            setShareError(err.message);
        } finally {
            setSharingLoading(false);
        }
    };

    const handleCloneCollection = async (id, e) => {
        if (e) e.stopPropagation();
        try {
            const res = await fetch(`/api/collections/${id}/clone`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to clone collection');

            setActionFeedback({ id, type: 'success', message: '✔ Copied to your library!' });
            setConfirmCloneCollId(null);
            fetchCollections();
            setActiveTab('mine');
            setTimeout(() => setActionFeedback({ id: null, type: '', message: '' }), 3000);
        } catch (err) {
            setActionFeedback({ id, type: 'error', message: `Error: ${err.message}` });
            setTimeout(() => setActionFeedback({ id: null, type: '', message: '' }), 4000);
        }
    };

    const currentCollections = activeTab === 'mine' ? collections : sharedCollections;
    const currentLoading = activeTab === 'mine' ? loading : sharedLoading;

    return (
        <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            {selectedMovie && (
                <MovieDetailsModal
                    movie={selectedMovie}
                    onClose={() => setSelectedMovie(null)}
                    onUpdate={() => {
                        if (expandedCollectionId) fetchCollectionDetails(expandedCollectionId);
                    }}
                    onDelete={() => {}} 
                    isTrashMode={false}
                    readOnly={activeTab === 'shared'} // Read-only view for shared lists received from other users
                />
            )}

            {/* Direct Share Modal */}
            {sharingCollection && (
                <div className="modal-overlay" style={{ zIndex: 1000 }}>
                    <div className="modal-content glass-panel animate-fade-in" style={{ maxWidth: '420px', padding: '30px' }}>
                        <h3 style={{ marginTop: 0, color: 'var(--accent-gold)', fontSize: '1.4rem' }}>📨 Send Collection</h3>
                        <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '20px' }}>
                            Send <strong>"{sharingCollection.title}"</strong> directly to another user inside MovieWatcher. It will instantly appear in their "Shared with me" tab!
                        </p>

                        <form onSubmit={handleSendShare} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            {shareError && <div style={{ color: '#f87171', fontSize: '0.85rem', background: 'rgba(239,68,68,0.1)', padding: '10px', borderRadius: '6px' }}>⚠️ {shareError}</div>}
                            {shareSuccess && <div style={{ color: '#4ade80', fontSize: '0.85rem', background: 'rgba(74,222,128,0.1)', padding: '10px', borderRadius: '6px' }}>✔ {shareSuccess}</div>}

                            <div className="input-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label htmlFor="recipient" style={{ fontSize: '0.8rem', color: '#aaa', fontWeight: 500 }}>Recipient Username</label>
                                <input
                                    type="text"
                                    id="recipient"
                                    value={shareRecipient}
                                    onChange={(e) => setShareRecipient(e.target.value)}
                                    placeholder="Enter username"
                                    required
                                    disabled={sharingLoading || shareSuccess}
                                    style={{
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '8px',
                                        padding: '12px 14px',
                                        color: '#fff',
                                        outline: 'none',
                                        fontSize: '0.95rem'
                                    }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                                <button
                                    type="button"
                                    onClick={() => { setSharingCollection(null); setShareRecipient(''); setShareError(''); setShareSuccess(''); }}
                                    className="btn btn-ghost"
                                    style={{ flex: 1 }}
                                >
                                    Cancel
                                </button>
                                {!shareSuccess && (
                                    <button
                                        type="submit"
                                        className="btn btn-gold"
                                        style={{ flex: 1 }}
                                        disabled={sharingLoading}
                                    >
                                        {sharingLoading ? 'Sending...' : 'Send'}
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Header section with tabs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <button
                            onClick={onBack}
                            className="btn btn-ghost"
                            style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '8px 15px', borderRadius: '8px' }}
                        >
                            ← Back to Library
                        </button>
                        <h2 style={{ margin: 0, fontSize: '2rem', color: '#fff' }}>
                            📁 Collections
                        </h2>
                    </div>

                    {/* Tabs */}
                    <div className="glass-panel" style={{ display: 'inline-flex', padding: '4px', borderRadius: '10px', gap: '4px' }}>
                        <button
                            onClick={() => { setActiveTab('mine'); setExpandedCollectionId(null); }}
                            className="btn"
                            style={{
                                background: activeTab === 'mine' ? 'var(--accent-gold)' : 'transparent',
                                color: activeTab === 'mine' ? '#000' : '#888',
                                borderRadius: '8px',
                                padding: '8px 16px',
                                fontWeight: 600,
                                fontSize: '0.9rem'
                            }}
                        >
                            My Collections
                        </button>
                        <button
                            onClick={() => { setActiveTab('shared'); setExpandedCollectionId(null); }}
                            className="btn"
                            style={{
                                background: activeTab === 'shared' ? 'var(--accent-gold)' : 'transparent',
                                color: activeTab === 'shared' ? '#000' : '#888',
                                borderRadius: '8px',
                                padding: '8px 16px',
                                fontWeight: 600,
                                fontSize: '0.9rem'
                            }}
                        >
                            Shared with me ({sharedCollections.length})
                        </button>
                    </div>
                </div>
            </div>

            {currentLoading ? (
                <div style={{ textAlign: 'center', padding: '50px', color: '#888' }}>Loading collections...</div>
            ) : currentCollections.length === 0 ? (
                <div className="glass-panel" style={{ textAlign: 'center', padding: '50px', color: '#888' }}>
                    <p style={{ fontSize: '1.2rem', margin: '0 0 10px 0' }}>
                        {activeTab === 'mine' ? 'No collections yet.' : 'No collections shared with you yet.'}
                    </p>
                    <p style={{ fontSize: '0.9rem', color: '#555' }}>
                        {activeTab === 'mine' 
                            ? 'Select movies in the Library view and click "Add to Collection" to create one.'
                            : 'When other users share a collection with your username, it will appear here!'
                        }
                    </p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                    {currentCollections.map(c => {
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
                                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginTop: '6px' }}>
                                            <span style={{ fontSize: '0.8rem', color: '#666' }}>
                                                Created: {new Date(c.created_at).toLocaleDateString()}
                                            </span>
                                            {activeTab === 'shared' && (
                                                <span style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', fontWeight: 500 }}>
                                                    👤 Sent by @{c.sender_username}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }} onClick={e => e.stopPropagation()}>
                                        <span style={{
                                            background: 'rgba(212, 175, 55, 0.1)', color: 'var(--accent-gold)',
                                            padding: '4px 10px', borderRadius: '15px', fontSize: '0.8rem', fontWeight: 'bold'
                                        }}>
                                            {c.movie_count} Movie(s)
                                        </span>

                                        {actionFeedback.id === c.id && actionFeedback.message && (
                                            <span style={{
                                                fontSize: '0.8rem',
                                                color: actionFeedback.type === 'success' ? '#03dac6' : actionFeedback.type === 'info' ? 'var(--accent-gold)' : 'var(--danger)',
                                                fontWeight: 'bold',
                                                marginRight: '8px'
                                            }}>
                                                {actionFeedback.message}
                                            </span>
                                        )}

                                        {activeTab === 'mine' ? (
                                            <>
                                                <button
                                                    onClick={(e) => handleShare(c, e)}
                                                    className="btn"
                                                    style={{
                                                        background: copiedId === c.id ? '#03dac6' : 'rgba(255,255,255,0.05)',
                                                        color: copiedId === c.id ? '#000' : '#fff',
                                                        border: '1px solid rgba(255,255,255,0.1)',
                                                        padding: '6px 12px', fontSize: '0.8rem', display: 'flex', gap: '5px', alignItems: 'center'
                                                    }}
                                                >
                                                    {copiedId === c.id ? '✔ Copied!' : '🔗 Copy Link'}
                                                </button>

                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setSharingCollection(c); }}
                                                    className="btn btn-gold"
                                                    style={{
                                                        padding: '6px 12px', fontSize: '0.8rem', display: 'flex', gap: '5px', alignItems: 'center'
                                                    }}
                                                >
                                                    📨 Send to User
                                                </button>

                                                {confirmDeleteCollId === c.id ? (
                                                    <span style={{ display: 'flex', gap: '5px', alignItems: 'center', background: 'rgba(239,68,68,0.08)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.2)' }} onClick={e => e.stopPropagation()}>
                                                        <span style={{ fontSize: '0.78rem', color: '#ff6b6b' }}>Delete?</span>
                                                        <button
                                                            onClick={(e) => handleDeleteCollection(c.id, e)}
                                                            className="btn"
                                                            style={{ background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: '4px', padding: '2px 8px', fontSize: '0.75rem', cursor: 'pointer' }}
                                                        >Yes</button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteCollId(null); }}
                                                            className="btn"
                                                            style={{ background: 'rgba(255,255,255,0.08)', color: '#aaa', border: 'none', borderRadius: '4px', padding: '2px 8px', fontSize: '0.75rem', cursor: 'pointer' }}
                                                        >No</button>
                                                    </span>
                                                ) : (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteCollId(c.id); }}
                                                        className="btn btn-ghost"
                                                        style={{ color: 'var(--danger)', padding: '6px', fontSize: '1rem' }}
                                                        title="Delete Collection"
                                                    >
                                                        🗑
                                                    </button>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                {confirmCloneCollId === c.id ? (
                                                    <span style={{ display: 'flex', gap: '5px', alignItems: 'center', background: 'rgba(212,175,55,0.08)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(212,175,55,0.2)' }} onClick={e => e.stopPropagation()}>
                                                        <span style={{ fontSize: '0.78rem', color: 'var(--accent-gold)' }}>Copy to library?</span>
                                                        <button
                                                            onClick={(e) => handleCloneCollection(c.id, e)}
                                                            className="btn"
                                                            style={{ background: 'var(--accent-gold)', color: '#000', border: 'none', borderRadius: '4px', padding: '2px 8px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold' }}
                                                        >Yes</button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setConfirmCloneCollId(null); }}
                                                            className="btn"
                                                            style={{ background: 'rgba(255,255,255,0.08)', color: '#aaa', border: 'none', borderRadius: '4px', padding: '2px 8px', fontSize: '0.75rem', cursor: 'pointer' }}
                                                        >No</button>
                                                    </span>
                                                ) : (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setConfirmCloneCollId(c.id); }}
                                                        className="btn btn-gold"
                                                        style={{
                                                            padding: '6px 12px', fontSize: '0.8rem', display: 'flex', gap: '5px', alignItems: 'center'
                                                        }}
                                                    >
                                                        📥 Save to My Library
                                                    </button>
                                                )}
                                            </>
                                        )}
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
                                                This collection has no movies.
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
                                                        
                                                        {/* Delete Movie from Collection button (Only if it's my collection!) */}
                                                        {activeTab === 'mine' && (
                                                            <>
                                                                {confirmRemoveMovieKey === `${c.id}-${movie.id}` ? (
                                                                    <div
                                                                        onClick={e => e.stopPropagation()}
                                                                        style={{
                                                                            position: 'absolute', inset: 0,
                                                                            background: 'rgba(0, 0, 0, 0.85)',
                                                                            display: 'flex', flexDirection: 'column',
                                                                            alignItems: 'center', justifyContent: 'center',
                                                                            gap: '10px', zIndex: 15, padding: '10px',
                                                                            textAlign: 'center', animation: 'fadeIn 0.2s ease-out'
                                                                        }}
                                                                    >
                                                                        <span style={{ fontSize: '0.8rem', color: '#ff6b6b', fontWeight: 'bold' }}>Remove movie?</span>
                                                                        <div style={{ display: 'flex', gap: '8px' }}>
                                                                            <button
                                                                                onClick={(e) => handleRemoveMovie(c.id, movie.id, e)}
                                                                                style={{ background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold' }}
                                                                            >Yes</button>
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); setConfirmRemoveMovieKey(null); }}
                                                                                style={{ background: 'rgba(255,255,255,0.15)', color: '#eee', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer' }}
                                                                            >No</button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); setConfirmRemoveMovieKey(`${c.id}-${movie.id}`); }}
                                                                        style={{
                                                                            position: 'absolute', top: '8px', right: '8px',
                                                                            background: 'rgba(0, 0, 0, 0.7)', color: 'var(--danger)',
                                                                            border: 'none', borderRadius: '50%', width: '26px', height: '26px',
                                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                            cursor: 'pointer', zIndex: 10, fontSize: '0.8rem', transition: 'all 0.15s'
                                                                        }}
                                                                        title="Remove from Collection"
                                                                    >
                                                                        &times;
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}

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
