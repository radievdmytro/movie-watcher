import { useState, useEffect } from 'react';
import MovieDetailsModal from './MovieDetailsModal';
import MovieComparisonModal from './MovieComparisonModal';

function EditableField({ value, onSave, style, type = 'text', placeholder, isMobile, ...props }) {
    const [localValue, setLocalValue] = useState(value || '');
    const [isEditing, setIsEditing] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    useEffect(() => { setLocalValue(value || ''); }, [value]);

    const handleBlur = () => {
        setIsEditing(false);
        if (localValue !== value) {
            onSave(localValue);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && type !== 'textarea') e.target.blur();
        if (e.key === 'Escape') {
            setLocalValue(value || '');
            setIsEditing(false);
        }
    };

    const inputStyle = {
        ...style,
        background: 'rgba(255,255,255,0.08)',
        border: 'none',
        borderBottom: '1px solid var(--accent-gold)',
        outline: 'none',
        padding: '2px 6px',
        margin: '-2px -6px',
        width: '100%',
        boxSizing: 'border-box',
        cursor: 'text',
        transition: 'all 0.2s',
        fontFamily: 'inherit',
        resize: 'none',
        borderRadius: '4px'
    };

    if (isEditing) {
        return (
            <div 
                onClick={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
                onMouseUp={e => e.stopPropagation()}
                style={{ display: 'flex', width: '100%' }}
            >
                {type === 'textarea' ? (
                    <textarea
                        value={localValue}
                        onChange={e => setLocalValue(e.target.value)}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        style={inputStyle}
                        placeholder={placeholder}
                        rows={2}
                        autoFocus
                        {...props}
                    />
                ) : (
                    <input
                        type="text"
                        value={localValue}
                        onChange={e => setLocalValue(e.target.value)}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        style={inputStyle}
                        placeholder={placeholder}
                        autoFocus
                        {...props}
                    />
                )}
            </div>
        );
    }

    const displayValue = value || placeholder;
    const isPlaceholder = !value;

    if (isMobile) {
        return (
            <div 
                style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    maxWidth: '100%'
                }}
            >
                <span 
                    style={{ 
                        ...style, 
                        borderBottom: '1px dashed transparent',
                        color: isPlaceholder ? '#555' : style.color || '#fff',
                        fontStyle: isPlaceholder ? 'italic' : 'normal',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                    }}
                >
                    {displayValue}
                </span>
                
                <span 
                    onClick={e => {
                        e.stopPropagation();
                        e.preventDefault();
                        setIsEditing(true);
                    }}
                    onMouseDown={e => e.stopPropagation()}
                    onMouseUp={e => e.stopPropagation()}
                    style={{ 
                        fontSize: '1rem', 
                        color: 'var(--accent-gold)', 
                        padding: '4px 8px',
                        cursor: 'pointer',
                        userSelect: 'none',
                        flexShrink: 0,
                        background: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '4px',
                        border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}
                    title="Click to edit"
                >
                    ✏️
                </span>
            </div>
        );
    }

    return (
        <div 
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={e => {
                e.stopPropagation();
                setIsEditing(true);
            }}
            onMouseDown={e => {
                e.stopPropagation();
            }}
            onMouseUp={e => {
                e.stopPropagation();
            }}
            style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '8px', 
                cursor: 'pointer',
                maxWidth: '100%'
            }}
        >
            <span 
                style={{ 
                    ...style, 
                    borderBottom: '1px dashed transparent',
                    color: isPlaceholder ? '#555' : style.color || '#fff',
                    fontStyle: isPlaceholder ? 'italic' : 'normal',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    transition: 'border-bottom-color 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.borderBottomColor = 'var(--accent-gold)'}
                onMouseLeave={e => e.currentTarget.style.borderBottomColor = 'transparent'}
            >
                {displayValue}
            </span>
            
            {isHovered && (
                <span 
                    style={{ 
                        fontSize: '0.85rem', 
                        color: 'var(--accent-gold)', 
                        opacity: 0.8,
                        userSelect: 'none',
                        flexShrink: 0
                    }}
                    title="Click to edit"
                >
                    ✏️
                </span>
            )}
        </div>
    );
}

function CollectionsView({ onBack }) {
    const [activeTab, setActiveTab] = useState('mine'); // 'hidden' | 'mine' | 'shared'
    const [collections, setCollections] = useState([]);
    const [sharedCollections, setSharedCollections] = useState([]);
    const [hiddenMovies, setHiddenMovies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sharedLoading, setSharedLoading] = useState(false);
    const [hiddenLoading, setHiddenLoading] = useState(false);
    const [expandedCollectionId, setExpandedCollectionId] = useState(null);
    const [expandedCollection, setExpandedCollection] = useState(null);
    const [selectedMovie, setSelectedMovie] = useState(null);
    const [copiedId, setCopiedId] = useState(null);

    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Multiselect & Comparison for Shared Collections
    const [selectedMovieIds, setSelectedMovieIds] = useState([]);
    const [compareMovieLinks, setCompareMovieLinks] = useState([]);
    const [isCompareOpen, setIsCompareOpen] = useState(false);
    const [ownedMovies, setOwnedMovies] = useState([]);

    // Inline Actions and Feedback (No native windows!)
    const [confirmDeleteCollId, setConfirmDeleteCollId] = useState(null);
    const [confirmRemoveMovieKey, setConfirmRemoveMovieKey] = useState(null); // `${collId}-${movieId}`
    const [confirmCloneCollId, setConfirmCloneCollId] = useState(null);
    const [actionFeedback, setActionFeedback] = useState({ id: null, type: '', message: '', undoAction: null });
    const [undoTimeoutIds, setUndoTimeoutIds] = useState({});

    // Share Modal State
    const [sharingCollection, setSharingCollection] = useState(null);
    const [shareRecipient, setShareRecipient] = useState('');
    const [shareError, setShareError] = useState('');
    const [shareSuccess, setShareSuccess] = useState('');
    const [sharingLoading, setSharingLoading] = useState(false);

    // Copy/Move Movie Modal State
    const [copyMoveMovieModal, setCopyMoveMovieModal] = useState(null); // null or { movies: [], sourceCollectionId, sourceCollectionTitle }
    const [copyMoveActionType, setCopyMoveActionType] = useState('copy'); // 'copy' | 'move'
    const [newCollectionTitle, setNewCollectionTitle] = useState('');
    const [copyMoveLoading, setCopyMoveLoading] = useState(false);
    const [copyMoveError, setCopyMoveError] = useState('');

    const handleExecuteCopyMove = async (targetCollectionId) => {
        if (!copyMoveMovieModal || !copyMoveMovieModal.movies || copyMoveMovieModal.movies.length === 0) return;
        setCopyMoveLoading(true);
        setCopyMoveError('');
        try {
            const res = await fetch('/api/collections/copy-move-movie', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    movieIds: copyMoveMovieModal.movies.map(m => m.id),
                    sourceCollectionId: copyMoveMovieModal.sourceCollectionId,
                    targetCollectionId,
                    actionType: copyMoveActionType
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to complete action');

            const count = copyMoveMovieModal.movies.length;
            const titleText = count === 1 ? `"${copyMoveMovieModal.movies[0].title}"` : `${count} movies`;

            // Success feedback!
            setActionFeedback({
                id: copyMoveMovieModal.sourceCollectionId,
                type: 'success',
                message: copyMoveActionType === 'move' 
                    ? `✔ Moved ${titleText} successfully!` 
                    : `✔ Copied ${titleText} successfully!`
            });

            // Close modal
            setCopyMoveMovieModal(null);
            setNewCollectionTitle('');
            setSelectedMovieIds([]); // Clear multiselect selections after successful copy/move!

            // Reload collections and current expanded collection movies list!
            fetchCollections();
            if (expandedCollectionId) {
                const resColl = await fetch(`/api/collections/${expandedCollectionId}`);
                if (resColl.ok) {
                    const dataColl = await resColl.json();
                    setExpandedCollection(dataColl);
                }
            }
            
            setTimeout(() => setActionFeedback({ id: null, type: '', message: '', undoAction: null }), 4000);
        } catch (err) {
            setCopyMoveError(err.message);
        } finally {
            setCopyMoveLoading(false);
        }
    };

    const handleCreateAndPlace = async () => {
        if (!newCollectionTitle.trim() || !copyMoveMovieModal) return;
        setCopyMoveLoading(true);
        setCopyMoveError('');
        try {
            const resNewColl = await fetch('/api/collections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: newCollectionTitle.trim(),
                    description: '',
                    movieIds: []
                })
            });
            const dataNewColl = await resNewColl.json();
            if (!resNewColl.ok) throw new Error(dataNewColl.error || 'Failed to create collection');

            const newCollectionId = dataNewColl.id;
            await handleExecuteCopyMove(newCollectionId);
        } catch (err) {
            setCopyMoveError(err.message);
            setCopyMoveLoading(false);
        }
    };

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

    const fetchHiddenMovies = async () => {
        setHiddenLoading(true);
        try {
            const res = await fetch('/api/hidden-global-movies');
            const data = await res.json();
            setHiddenMovies(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to fetch hidden global movies:', err);
        } finally {
            setHiddenLoading(false);
        }
    };

    const fetchOwnedMovies = async () => {
        try {
            const res = await fetch('/api/movies');
            const data = await res.json();
            if (Array.isArray(data)) {
                setOwnedMovies(data);
            }
        } catch (err) {
            console.error('Failed to fetch owned movies:', err);
        }
    };

    const handleImportMovieDirect = async (link) => {
        try {
            const res = await fetch('/api/movies/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: link })
            });
            if (res.ok) {
                fetchOwnedMovies();
            }
        } catch (err) {
            console.error('Import failed:', err);
        }
    };

    const handleImportAllMovies = async (collectionId, e) => {
        if (e) e.stopPropagation();
        try {
            const res = await fetch(`/api/collections/${collectionId}/import-movies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to import movies');

            setActionFeedback({ 
                id: collectionId, 
                type: 'success', 
                message: `✔ Imported ${data.importedCount} movies (skipped ${data.skippedCount})!` 
            });
            setConfirmCloneCollId(null);
            fetchOwnedMovies();
            setTimeout(() => setActionFeedback({ id: null, type: '', message: '', undoAction: null }), 4000);
        } catch (err) {
            setActionFeedback({ id: collectionId, type: 'error', message: `Error: ${err.message}` });
            setTimeout(() => setActionFeedback({ id: null, type: '', message: '', undoAction: null }), 4000);
        }
    };

    const handleBulkImport = async (collectionId) => {
        try {
            const res = await fetch(`/api/collections/${collectionId}/import-movies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ movieIds: selectedMovieIds })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to import movies');

            setActionFeedback({ 
                id: collectionId, 
                type: 'success', 
                message: `✔ Imported ${data.importedCount} selected movies (skipped ${data.skippedCount})!` 
            });
            setSelectedMovieIds([]);
            fetchOwnedMovies();
            setTimeout(() => setActionFeedback({ id: null, type: '', message: '', undoAction: null }), 4000);
        } catch (err) {
            setActionFeedback({ id: collectionId, type: 'error', message: `Error: ${err.message}` });
            setTimeout(() => setActionFeedback({ id: null, type: '', message: '', undoAction: null }), 4000);
        }
    };

    useEffect(() => {
        fetchCollections();
        fetchSharedCollections();
        fetchHiddenMovies();
        fetchOwnedMovies();
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

    // Synchronize expandedCollectionId state with URL hash and fetch details
    useEffect(() => {
        if (expandedCollectionId) {
            window.location.hash = `collections/${expandedCollectionId}`;
            fetchCollectionDetails(expandedCollectionId);
        } else {
            setExpandedCollection(null);
            if (window.location.hash.startsWith('#collections/')) {
                window.location.hash = 'collections';
            }
        }
    }, [expandedCollectionId]);

    // Parse hash on mount and listen to window hashchange events for deep-linked collections
    useEffect(() => {
        const handleHashChangeInsideCollections = () => {
            const hash = window.location.hash;
            if (hash === '#collections') {
                setExpandedCollectionId(null);
            } else if (hash.startsWith('#collections/')) {
                const parts = hash.split('/');
                const id = parseInt(parts[parts.length - 1]);
                if (!isNaN(id)) {
                    setExpandedCollectionId(id);
                }
            }
        };

        handleHashChangeInsideCollections();

        window.addEventListener('hashchange', handleHashChangeInsideCollections);
        return () => window.removeEventListener('hashchange', handleHashChangeInsideCollections);
    }, []);

    // Automatically switch activeTab to match the owned or shared collection on startup/load
    useEffect(() => {
        if (!expandedCollectionId) return;

        const inMine = collections.some(c => c.id === expandedCollectionId);
        if (inMine) {
            setActiveTab('mine');
            return;
        }

        const inShared = sharedCollections.some(c => c.id === expandedCollectionId);
        if (inShared) {
            setActiveTab('shared');
        }
    }, [collections, sharedCollections, expandedCollectionId]);

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

    const handleUpdateCollection = async (id, updates, prevValues) => {
        try {
            await fetch(`/api/collections/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            
            setCollections(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
            
            setActionFeedback({ 
                id, 
                type: 'undo', 
                message: '✔ Saved.', 
                undoAction: () => handleUndoCollection(id, prevValues) 
            });

            if (undoTimeoutIds[id]) clearTimeout(undoTimeoutIds[id]);

            const timeoutId = setTimeout(() => {
                setActionFeedback(prev => prev.id === id ? { id: null, type: '', message: '', undoAction: null } : prev);
            }, 10000);
            
            setUndoTimeoutIds(prev => ({ ...prev, [id]: timeoutId }));
        } catch (err) {
            console.error(err);
            setActionFeedback({ id, type: 'error', message: 'Failed to save.' });
            setTimeout(() => setActionFeedback({ id: null, type: '', message: '', undoAction: null }), 3000);
        }
    };

    const handleUndoCollection = async (id, revertValues) => {
        try {
            await fetch(`/api/collections/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(revertValues)
            });
            setCollections(prev => prev.map(c => c.id === id ? { ...c, ...revertValues } : c));
            if (undoTimeoutIds[id]) clearTimeout(undoTimeoutIds[id]);
            setActionFeedback({ id, type: 'success', message: '↩ Reverted!', undoAction: null });
            setTimeout(() => setActionFeedback({ id: null, type: '', message: '', undoAction: null }), 2000);
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

    const handleBulkRemove = async (collectionId) => {
        if (selectedMovieIds.length === 0) return;
        if (!window.confirm(`Are you sure you want to remove ${selectedMovieIds.length} movie(s) from this collection?`)) return;
        try {
            await fetch(`/api/collections/${collectionId}/movies/bulk-delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ movieIds: selectedMovieIds })
            });
            setSelectedMovieIds([]);
            fetchCollectionDetails(collectionId);
            fetchCollections();
        } catch (err) {
            console.error(err);
        }
    };

    const handleShare = (collection, e) => {
        e.stopPropagation();
        const token = collection.share_token || collection.id;
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        const shareUrl = `${baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl}/share/collection/${token}`;

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

    const handleUnhideMovie = async (movie, e) => {
        if (e) e.stopPropagation();
        try {
            await fetch(`/api/hidden-global-movies?link=${encodeURIComponent(movie.link || movie.movie_link)}`, {
                method: 'DELETE'
            });
            setHiddenMovies(prev => prev.filter(item => item.movie_link !== movie.movie_link));
            setActionFeedback({
                id: 'hidden',
                type: 'success',
                message: `✔ "${movie.title}" is visible again.`
            });
            setTimeout(() => setActionFeedback({ id: null, type: '', message: '', undoAction: null }), 3000);
        } catch (err) {
            console.error('Failed to unhide movie:', err);
            setActionFeedback({ id: 'hidden', type: 'error', message: 'Failed to unhide movie.' });
            setTimeout(() => setActionFeedback({ id: null, type: '', message: '', undoAction: null }), 3000);
        }
    };

    const currentCollections = activeTab === 'shared' ? sharedCollections : collections;
    const currentLoading = activeTab === 'shared' ? sharedLoading : loading;

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
                    readOnly={activeTab === 'shared' || activeTab === 'hidden'} // Read-only view for shared/hidden global entries
                />
            )}

            {isCompareOpen && (
                <MovieComparisonModal
                    isOpen={isCompareOpen}
                    onClose={() => setIsCompareOpen(false)}
                    movieLinks={compareMovieLinks}
                    onAddMovie={handleImportMovieDirect}
                    getOwnedMovie={(link) => {
                        const norm = (u) => (u || '').toLowerCase().replace(/^https?:\/\/[^/]+/, '').replace(/^\/+|\/+$/g, '').split('?')[0].split('#')[0];
                        const target = norm(link);
                        return ownedMovies.find(m => norm(m.link) === target);
                    }}
                    onOpenMovie={setSelectedMovie}
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
                            onClick={() => { setActiveTab('hidden'); setExpandedCollectionId(null); }}
                            className="btn"
                            style={{
                                background: activeTab === 'hidden' ? 'var(--accent-gold)' : 'transparent',
                                color: activeTab === 'hidden' ? '#000' : '#888',
                                borderRadius: '8px',
                                padding: '8px 16px',
                                fontWeight: 600,
                                fontSize: '0.9rem'
                            }}
                        >
                            Hidden ({hiddenMovies.length})
                        </button>
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

            {activeTab === 'hidden' ? (
                hiddenLoading ? (
                    <div style={{ textAlign: 'center', padding: '50px', color: '#888' }}>Loading hidden movies...</div>
                ) : hiddenMovies.length === 0 ? (
                    <div className="glass-panel" style={{ textAlign: 'center', padding: '50px', color: '#888' }}>
                        <p style={{ fontSize: '1.2rem', margin: '0 0 10px 0' }}>No hidden movies.</p>
                        <p style={{ fontSize: '0.9rem', color: '#555' }}>
                            Movies hidden from Global Database recommendations and search will appear here.
                        </p>
                    </div>
                ) : (
                    <div>
                        {actionFeedback.id === 'hidden' && actionFeedback.message && (
                            <div className="glass-panel" style={{
                                marginBottom: '16px',
                                padding: '12px 16px',
                                color: actionFeedback.type === 'error' ? 'var(--danger)' : '#03dac6',
                                fontWeight: 'bold',
                                fontSize: '0.9rem'
                            }}>
                                {actionFeedback.message}
                            </div>
                        )}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                            gap: '20px'
                        }}>
                            {hiddenMovies.map(movie => (
                                <div
                                    key={movie.movie_link}
                                    className="glass-panel movie-card"
                                    onClick={() => setSelectedMovie({
                                        ...movie,
                                        poster_url: movie.poster_url || movie.img,
                                        readOnly: true
                                    })}
                                    style={{
                                        position: 'relative',
                                        cursor: 'pointer',
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        border: '1px solid rgba(255,255,255,0.05)',
                                        aspectRatio: '2/3',
                                        transition: 'transform 0.2s',
                                        background: 'rgba(255,255,255,0.03)'
                                    }}
                                >
                                    {movie.poster_url ? (
                                        <img
                                            src={movie.poster_url}
                                            alt={movie.title}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(0.8)' }}
                                        />
                                    ) : (
                                        <div style={{
                                            width: '100%',
                                            height: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            padding: '16px',
                                            textAlign: 'center',
                                            color: '#777',
                                            background: 'rgba(0,0,0,0.25)'
                                        }}>
                                            {movie.title}
                                        </div>
                                    )}
                                    <button
                                        onClick={(e) => handleUnhideMovie(movie, e)}
                                        className="btn"
                                        style={{
                                            position: 'absolute',
                                            top: '10px',
                                            right: '10px',
                                            zIndex: 12,
                                            background: 'rgba(3, 218, 198, 0.88)',
                                            color: '#000',
                                            border: 'none',
                                            borderRadius: '8px',
                                            padding: '6px 10px',
                                            fontSize: '0.78rem',
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            boxShadow: '0 6px 18px rgba(0,0,0,0.35)'
                                        }}
                                        title="Show in global recommendations and search again"
                                    >
                                        👁️ Unhide
                                    </button>
                                    <div style={{
                                        position: 'absolute', bottom: 0, left: 0, width: '100%',
                                        padding: '30px 10px 10px',
                                        background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, transparent 100%)'
                                    }}>
                                        <h4 style={{
                                            fontSize: '0.85rem',
                                            color: '#fff',
                                            margin: '0 0 2px 0',
                                            textOverflow: 'ellipsis',
                                            overflow: 'hidden',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {movie.title}
                                        </h4>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#aaa' }}>
                                            <span>{movie.year || ''}</span>
                                            <span style={{ color: 'var(--accent-gold)' }}>★ {movie.rating || '-'}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            ) : currentLoading ? (
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
                                        {activeTab === 'mine' ? (
                                            <>
                                                <div style={{ display: 'block', marginBottom: '4px' }}>
                                                    <EditableField
                                                        value={c.title}
                                                        placeholder="Collection Title"
                                                        isMobile={isMobile}
                                                        style={{ margin: '0 0 5px 0', fontSize: '1.3rem', color: 'var(--accent-gold)', fontWeight: 'bold' }}
                                                        onSave={(newVal) => {
                                                            if (newVal.trim() && newVal !== c.title) {
                                                                handleUpdateCollection(c.id, { title: newVal }, { title: c.title });
                                                            }
                                                        }}
                                                    />
                                                </div>
                                                <div style={{ display: 'block' }}>
                                                    <EditableField
                                                        type="textarea"
                                                        value={c.description || ''}
                                                        placeholder="No description provided. Click to add."
                                                        isMobile={isMobile}
                                                        style={{ margin: 0, color: '#aaa', fontSize: '0.9rem', width: '100%' }}
                                                        onSave={(newVal) => {
                                                            if (newVal !== (c.description || '')) {
                                                                handleUpdateCollection(c.id, { description: newVal }, { description: c.description });
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div style={{ display: 'block', marginBottom: '4px' }}>
                                                    <h3 style={{ margin: '0 0 5px 0', fontSize: '1.3rem', color: 'var(--accent-gold)' }}>
                                                        {c.title}
                                                    </h3>
                                                </div>
                                                <div style={{ display: 'block' }}>
                                                    <p style={{ margin: 0, color: '#aaa', fontSize: '0.9rem' }}>
                                                        {c.description || 'No description provided.'}
                                                    </p>
                                                </div>
                                            </>
                                        )}
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
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '8px' }} onClick={e => e.stopPropagation()}>
                                                <span style={{
                                                    fontSize: '0.8rem',
                                                    color: actionFeedback.type === 'error' ? 'var(--danger)' : actionFeedback.type === 'undo' ? 'var(--accent-gold)' : '#03dac6',
                                                    fontWeight: 'bold'
                                                }}>
                                                    {actionFeedback.message}
                                                </span>
                                                {actionFeedback.type === 'undo' && actionFeedback.undoAction && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); actionFeedback.undoAction(); }}
                                                        style={{
                                                            background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '4px',
                                                            color: '#fff', fontSize: '0.75rem', padding: '2px 8px', cursor: 'pointer',
                                                            transition: 'background 0.2s', fontWeight: 'bold'
                                                        }}
                                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                                    >
                                                        Undo
                                                    </button>
                                                )}
                                            </div>
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
                                                    <span style={{ display: 'flex', gap: '5px', alignItems: 'center', background: 'rgba(212,175,55,0.08)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(212,175,55,0.2)' }} onClick={e => e.stopPropagation()}>
                                                        <span style={{ fontSize: '0.78rem', color: 'var(--accent-gold)', marginRight: '5px' }}>Import:</span>
                                                        <button
                                                            onClick={(e) => handleCloneCollection(c.id, e)}
                                                            className="btn btn-gold"
                                                            style={{ border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold' }}
                                                        >📑 Copy Collection</button>
                                                        <button
                                                            onClick={(e) => handleImportAllMovies(c.id, e)}
                                                            className="btn"
                                                            style={{ background: 'var(--accent-gold)', color: '#000', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold' }}
                                                        >📥 Add All to Library</button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setConfirmCloneCollId(null); }}
                                                            className="btn btn-ghost"
                                                            style={{ color: '#aaa', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer' }}
                                                        >Cancel</button>
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
                                            <>
                                                {expandedCollection && expandedCollection.movies.length > 0 && (
                                                    <div style={{
                                                        display: 'flex', gap: '15px', alignItems: 'center',
                                                        marginBottom: '20px', padding: '12px 18px',
                                                        background: 'rgba(255,255,255,0.02)', borderRadius: '10px',
                                                        border: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap'
                                                    }} onClick={e => e.stopPropagation()}>
                                                        <button
                                                            onClick={() => {
                                                                const allIds = expandedCollection.movies.map(m => m.id);
                                                                if (selectedMovieIds.length === allIds.length) {
                                                                    setSelectedMovieIds([]);
                                                                } else {
                                                                    setSelectedMovieIds(allIds);
                                                                }
                                                            }}
                                                            className="btn btn-ghost"
                                                            style={{ border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.8rem', padding: '5px 12px', color: '#fff', cursor: 'pointer' }}
                                                        >
                                                            {selectedMovieIds.length === expandedCollection.movies.length ? 'Deselect All' : 'Select All'}
                                                        </button>
                                                        <span style={{ fontSize: '0.85rem', color: '#888' }}>
                                                            {selectedMovieIds.length} movie(s) selected
                                                        </span>
                                                        {selectedMovieIds.length > 0 && (
                                                            <>
                                                                {/* Shared actions */}
                                                                {activeTab === 'shared' && (
                                                                    <>
                                                                        <button
                                                                            onClick={() => handleBulkImport(c.id)}
                                                                            className="btn btn-gold"
                                                                            style={{ padding: '6px 14px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' }}
                                                                        >
                                                                            📥 Add Selected to Library
                                                                        </button>
                                                                        {selectedMovieIds.length >= 2 && selectedMovieIds.length <= (isMobile ? 2 : 3) && (
                                                                            <button
                                                                                onClick={() => {
                                                                                    const selectedMovies = expandedCollection.movies.filter(m => selectedMovieIds.includes(m.id));
                                                                                    setCompareMovieLinks(selectedMovies.map(m => m.link));
                                                                                    setIsCompareOpen(true);
                                                                                }}
                                                                                className="btn"
                                                                                style={{
                                                                                    background: 'rgba(255,255,255,0.1)', color: '#fff',
                                                                                    border: '1px solid rgba(255,255,255,0.15)', padding: '6px 14px',
                                                                                    fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer'
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

                                                                {/* Mine actions */}
                                                                {activeTab === 'mine' && (
                                                                    <>
                                                                        <button
                                                                            onClick={() => handleBulkRemove(c.id)}
                                                                            className="btn"
                                                                            style={{
                                                                                background: 'rgba(239, 68, 68, 0.2)', color: '#ff6b6b',
                                                                                border: '1px solid rgba(239, 68, 68, 0.3)', padding: '6px 14px',
                                                                                fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer', borderRadius: '6px'
                                                                            }}
                                                                        >
                                                                            🗑️ Delete Selected
                                                                        </button>
                                                                    </>
                                                                )}

                                                                {/* Universal bulk Copy / Move actions */}
                                                                <button
                                                                    onClick={() => {
                                                                        setCopyMoveMovieModal({
                                                                            movies: expandedCollection.movies.filter(m => selectedMovieIds.includes(m.id)),
                                                                            sourceCollectionId: c.id,
                                                                            sourceCollectionTitle: c.title
                                                                        });
                                                                        setCopyMoveActionType('copy');
                                                                        setNewCollectionTitle('');
                                                                        setCopyMoveError('');
                                                                    }}
                                                                    className="btn btn-gold"
                                                                    style={{
                                                                        padding: '6px 14px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer', borderRadius: '6px'
                                                                    }}
                                                                >
                                                                    📁 Copy / Move Selected
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
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
                                                        {/* Multiselect checkbox shown in both mine and shared tabs */}
                                                        <div 
                                                            onClick={(e) => e.stopPropagation()}
                                                            style={{
                                                                position: 'absolute', top: '10px', left: '10px', zIndex: 12,
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

                                                        {/* Copy / Move to another collection button */}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setCopyMoveMovieModal({
                                                                    movies: [movie],
                                                                    sourceCollectionId: c.id,
                                                                    sourceCollectionTitle: c.title
                                                                });
                                                                setCopyMoveActionType('copy');
                                                                setNewCollectionTitle('');
                                                                setCopyMoveError('');
                                                            }}
                                                            style={{
                                                                position: 'absolute', 
                                                                top: '8px', 
                                                                right: activeTab === 'mine' ? '38px' : '8px',
                                                                background: 'rgba(0, 0, 0, 0.7)', 
                                                                color: 'var(--accent-gold)',
                                                                border: 'none', 
                                                                borderRadius: '50%', 
                                                                width: '26px', 
                                                                height: '26px',
                                                                display: 'flex', 
                                                                alignItems: 'center', 
                                                                justifyContent: 'center',
                                                                cursor: 'pointer', 
                                                                zIndex: 10, 
                                                                fontSize: '0.85rem', 
                                                                transition: 'all 0.15s'
                                                            }}
                                                            title="Copy or Move to another collection"
                                                            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                                                            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                                        >
                                                            📁
                                                        </button>

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
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
            {copyMoveMovieModal && (
                <div
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget) setCopyMoveMovieModal(null);
                    }}
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0, 0, 0, 0.85)',
                        backdropFilter: 'blur(10px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 20000, padding: '20px'
                    }}
                >
                    <div
                        className="glass-panel"
                        style={{
                            width: '100%', maxWidth: '480px', maxHeight: '85vh',
                            overflowY: 'auto', padding: '30px', position: 'relative',
                            animation: 'scaleIn 0.3s cubic-bezier(0.165, 0.84, 0.44, 1)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '12px',
                            background: 'var(--bg-card)'
                        }}
                    >
                        <button
                            onClick={() => setCopyMoveMovieModal(null)}
                            className="btn btn-ghost"
                            style={{ position: 'absolute', top: '15px', right: '15px', fontSize: '1.4rem', color: '#fff', border: 'none', background: 'transparent', cursor: 'pointer' }}
                        >
                            &times;
                        </button>

                        <h3 style={{ margin: '0 0 15px 0', fontSize: '1.4rem', color: 'var(--accent-gold)' }}>
                            📁 Copy / Move Movies
                        </h3>
                        
                        {/* Movie brief */}
                        {copyMoveMovieModal.movies.length === 1 ? (
                            <div style={{ display: 'flex', gap: '15px', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', marginBottom: '25px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <img 
                                    src={copyMoveMovieModal.movies[0].poster_url} 
                                    alt={copyMoveMovieModal.movies[0].title} 
                                    style={{ width: '50px', height: '75px', objectFit: 'cover', borderRadius: '4px' }} 
                                />
                                <div>
                                    <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', color: '#fff' }}>{copyMoveMovieModal.movies[0].title}</h4>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#aaa' }}>{copyMoveMovieModal.movies[0].year} • ★ {copyMoveMovieModal.movies[0].rating || '-'}</p>
                                    <p style={{ margin: '6px 0 0 0', fontSize: '0.75rem', color: 'var(--accent-gold)' }}>
                                        Current Collection: <strong>{copyMoveMovieModal.sourceCollectionTitle}</strong>
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '8px', marginBottom: '25px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <p style={{ margin: '0 0 10px 0', fontSize: '0.95rem', color: '#fff', fontWeight: 'bold' }}>
                                    📦 Processing {copyMoveMovieModal.movies.length} selected movies:
                                </p>
                                <div style={{ maxHeight: '120px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '5px' }}>
                                    {copyMoveMovieModal.movies.map(m => (
                                        <div key={m.id} style={{ fontSize: '0.85rem', color: '#ccc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            • {m.title} ({m.year})
                                        </div>
                                    ))}
                                </div>
                                <p style={{ margin: '12px 0 0 0', fontSize: '0.75rem', color: 'var(--accent-gold)' }}>
                                    Source Collection: <strong>{copyMoveMovieModal.sourceCollectionTitle}</strong>
                                </p>
                            </div>
                        )}

                        {/* Action selector */}
                        {activeTab === 'mine' && (
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                                <button
                                    onClick={() => setCopyMoveActionType('copy')}
                                    className="btn"
                                    style={{
                                        flex: 1,
                                        background: copyMoveActionType === 'copy' ? 'var(--accent-gold)' : 'rgba(255,255,255,0.05)',
                                        color: copyMoveActionType === 'copy' ? '#000' : '#888',
                                        borderRadius: '8px',
                                        fontSize: '0.85rem',
                                        fontWeight: 'bold',
                                        padding: '10px',
                                        border: 'none',
                                        cursor: 'pointer'
                                    }}
                                >
                                    📋 Copy (Leave here)
                                </button>
                                <button
                                    onClick={() => setCopyMoveActionType('move')}
                                    className="btn"
                                    style={{
                                        flex: 1,
                                        background: copyMoveActionType === 'move' ? 'var(--accent-gold)' : 'rgba(255,255,255,0.05)',
                                        color: copyMoveActionType === 'move' ? '#000' : '#888',
                                        borderRadius: '8px',
                                        fontSize: '0.85rem',
                                        fontWeight: 'bold',
                                        padding: '10px',
                                        border: 'none',
                                        cursor: 'pointer'
                                    }}
                                >
                                    🚚 Move (Delete from here)
                                </button>
                            </div>
                        )}

                        {copyMoveError && (
                            <div style={{
                                padding: '10px 15px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)',
                                border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ff6b6b', fontSize: '0.85rem',
                                fontWeight: 'bold', marginBottom: '15px', textAlign: 'center'
                            }}>
                                {copyMoveError}
                            </div>
                        )}

                        {/* Create new collection inline */}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                            <input
                                type="text"
                                placeholder="Create new collection & place there..."
                                value={newCollectionTitle}
                                onChange={e => setNewCollectionTitle(e.target.value)}
                                style={{
                                    flex: 1, background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)', padding: '10px 15px',
                                    borderRadius: '8px', color: '#fff', outline: 'none', fontSize: '0.85rem'
                                }}
                            />
                            <button
                                onClick={handleCreateAndPlace}
                                disabled={copyMoveLoading || !newCollectionTitle.trim()}
                                className="btn btn-gold"
                                style={{ padding: '0 15px', fontSize: '0.8rem', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                            >
                                {copyMoveLoading ? '...' : 'Create'}
                            </button>
                        </div>

                        {/* Existing collections list */}
                        <div>
                            <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Add to Existing Collection
                            </h4>
                            {collections.filter(x => x.id !== copyMoveMovieModal.sourceCollectionId).length === 0 ? (
                                <p style={{ color: '#555', fontSize: '0.85rem', fontStyle: 'italic', textAlign: 'center', padding: '15px 0' }}>
                                    No other collections available.
                                </p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                                    {collections
                                        .filter(x => x.id !== copyMoveMovieModal.sourceCollectionId)
                                        .map(targetColl => (
                                            <button
                                                key={targetColl.id}
                                                disabled={copyMoveLoading}
                                                onClick={() => handleExecuteCopyMove(targetColl.id)}
                                                style={{
                                                    width: '100%', padding: '10px 15px', background: 'rgba(255,255,255,0.03)',
                                                    border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px',
                                                    color: '#fff', textAlign: 'left', cursor: 'pointer',
                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                    transition: 'all 0.2s', fontSize: '0.85rem'
                                                }}
                                                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                                                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                            >
                                                <span style={{ fontWeight: 'bold' }}>{targetColl.title}</span>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--accent-gold)' }}>
                                                    {targetColl.movie_count} movies
                                                </span>
                                            </button>
                                        ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes scaleIn { from { transform: scale(0.95) translateY(10px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
            `}</style>
        </div>
    );
}

export default CollectionsView;
