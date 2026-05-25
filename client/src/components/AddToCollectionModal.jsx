import { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

function AddToCollectionModal({ movieIds, movies = [], onClose, onSuccess }) {
    const [collections, setCollections] = useState([]);
    const [newTitle, setNewTitle] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [loading, setLoading] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [createdCollectionId, setCreatedCollectionId] = useState(null);
    const modalRef = useRef(null);

    useEffect(() => {
        fetch('/api/collections')
            .then(res => res.json())
            .then(data => setCollections(data))
            .catch(err => console.error('Failed to load collections:', err));
    }, []);

    const handleBackdropClick = (e) => {
        if (modalRef.current && !modalRef.current.contains(e.target)) {
            onClose();
        }
    };

    const predictCollectionMetadata = () => {
        if (!movies || movies.length === 0) return;

        const years = movies.map(m => parseInt(m.year)).filter(y => !isNaN(y));
        const minYear = years.length > 0 ? Math.min(...years) : null;
        const maxYear = years.length > 0 ? Math.max(...years) : null;
        const yearStr = (minYear && maxYear) ? (minYear === maxYear ? ` (${minYear})` : ` (${minYear}-${maxYear})`) : '';

        const genreCounts = {};
        movies.forEach(m => {
            if (m.genres) {
                const firstGenre = m.genres.split(',')[0].trim();
                if (firstGenre) {
                    genreCounts[firstGenre] = (genreCounts[firstGenre] || 0) + 1;
                }
            }
        });

        let topGenre = null;
        let topGenreCount = 0;
        for (const [genre, count] of Object.entries(genreCounts)) {
            if (count > topGenreCount) {
                topGenreCount = count;
                topGenre = genre;
            }
        }

        let commonActor = null;
        let commonDirector = null;

        if (movies.length > 1) {
            let actorIntersections = movies[0].actors ? movies[0].actors.split(',').map(a=>a.trim()) : [];
            let dirIntersections = movies[0].director ? movies[0].director.split(',').map(a=>a.trim()) : [];
            
            for (let i = 1; i < movies.length; i++) {
                const m = movies[i];
                const mActors = m.actors ? m.actors.split(',').map(a=>a.trim()) : [];
                const mDirs = m.director ? m.director.split(',').map(a=>a.trim()) : [];
                actorIntersections = actorIntersections.filter(a => mActors.includes(a));
                dirIntersections = dirIntersections.filter(d => mDirs.includes(d));
            }

            if (actorIntersections.length > 0) commonActor = actorIntersections[0];
            if (dirIntersections.length > 0) commonDirector = dirIntersections[0];
        }

        let predictedTitle = '';
        
        if (commonDirector) {
            predictedTitle = `Фильмы от: ${commonDirector}${yearStr}`;
        } else if (commonActor) {
            predictedTitle = `Фильмы с: ${commonActor}${yearStr}`;
        } else if (topGenre && topGenreCount >= Math.max(1, Math.floor(movies.length / 2))) {
            predictedTitle = `${topGenre}${yearStr}`;
            predictedTitle = predictedTitle.charAt(0).toUpperCase() + predictedTitle.slice(1);
        }

        if (predictedTitle && !newTitle) {
            setNewTitle(predictedTitle);
        }
    };

    useEffect(() => {
        if (showCreateForm) {
            predictCollectionMetadata();
        }
    }, [showCreateForm]);

    const handleCreateAndAdd = async (e) => {
        e.preventDefault();
        if (!newTitle.trim()) return;
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/collections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: newTitle.trim(),
                    description: newDesc.trim(),
                    movieIds
                })
            });
            if (res.ok) {
                const data = await res.json();
                const token = data.share_token || data.id;
                const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
                const shareUrl = `${baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl}/share/collection/${token}`;
                
                try {
                    await navigator.clipboard.writeText(shareUrl);
                    setSuccessMsg('✅ Коллекция создана! Ссылка скопирована в буфер обмена, теперь вы можете ею поделиться!');
                } catch (err) {
                    setSuccessMsg('✅ Коллекция создана! (Не удалось скопировать ссылку)');
                }
                setCreatedCollectionId(data.id);
            } else {
                const data = await res.json().catch(() => ({}));
                setError(data.error || 'Failed to create collection');
            }
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAddToExisting = async (collectionId) => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`/api/collections/${collectionId}/movies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ movieIds })
            });
            if (res.ok) {
                onSuccess();
            } else {
                const data = await res.json().catch(() => ({}));
                setError(data.error || 'Failed to add to collection');
            }
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return ReactDOM.createPortal(
        <div
            onMouseDown={handleBackdropClick}
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0, 0, 0, 0.85)',
                backdropFilter: 'blur(10px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 300000, padding: '20px'
            }}
        >
            <div
                className="glass-panel"
                ref={modalRef}
                style={{
                    width: '100%', maxWidth: '500px', maxHeight: '85vh',
                    overflowY: 'auto', padding: '30px', position: 'relative',
                    animation: 'scaleIn 0.3s cubic-bezier(0.165, 0.84, 0.44, 1)'
                }}
            >
                <button
                    onClick={onClose}
                    className="btn btn-ghost"
                    style={{ position: 'absolute', top: '15px', right: '15px', fontSize: '1.4rem' }}
                >
                    &times;
                </button>

                <h3 style={{ margin: '0 0 15px 0', fontSize: '1.5rem', color: 'var(--accent-gold)' }}>
                    📁 Add to Collection
                </h3>
                <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '25px' }}>
                    Selected <span style={{ color: '#fff', fontWeight: 'bold' }}>{movieIds.length}</span> movie(s).
                </p>

                {error && (
                    <div style={{
                        padding: '10px 15px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ff6b6b', fontSize: '0.85rem',
                        fontWeight: 'bold', marginBottom: '15px', textAlign: 'center', animation: 'fadeIn 0.2s'
                    }}>
                        {error}
                    </div>
                )}
                {successMsg && (
                    <div style={{
                        padding: '10px 15px', borderRadius: '8px', background: 'rgba(76, 175, 80, 0.08)',
                        border: '1px solid rgba(76, 175, 80, 0.2)', color: '#4caf50', fontSize: '0.85rem',
                        fontWeight: 'bold', marginBottom: '15px', textAlign: 'center', animation: 'fadeIn 0.2s'
                    }}>
                        {successMsg}
                    </div>
                )}

                {showCreateForm ? (
                    <form onSubmit={handleCreateAndAdd} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', color: '#888', marginBottom: '5px' }}>
                                Collection Title *
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. Action Movies 90s, Weekend Watchlist..."
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                required
                                style={{
                                    width: '100%', background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)', padding: '10px 15px',
                                    borderRadius: '8px', color: '#fff', outline: 'none'
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', color: '#888', marginBottom: '5px' }}>
                                Description (Optional)
                            </label>
                            <textarea
                                placeholder="What is this collection about?"
                                value={newDesc}
                                onChange={(e) => setNewDesc(e.target.value)}
                                style={{
                                    width: '100%', background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)', padding: '10px 15px',
                                    borderRadius: '8px', color: '#fff', outline: 'none',
                                    resize: 'vertical', minHeight: '80px'
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                            {createdCollectionId ? (
                                <>
                                    <button
                                        type="button"
                                        className="btn"
                                        onClick={() => {
                                            localStorage.setItem('animateCollectionId', createdCollectionId);
                                            window.location.hash = 'collections';
                                            if (onSuccess) onSuccess();
                                            else onClose();
                                        }}
                                        style={{ 
                                            background: 'var(--accent-gold)', color: '#000', flex: 1,
                                            animation: 'fadeInUp 0.4s cubic-bezier(0.165, 0.84, 0.44, 1)'
                                        }}
                                    >
                                        Show in Collections
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-ghost"
                                        onClick={() => {
                                            if (onSuccess) onSuccess();
                                            else onClose();
                                        }}
                                        style={{ 
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            animation: 'fadeInUp 0.4s cubic-bezier(0.165, 0.84, 0.44, 1) 0.1s both'
                                        }}
                                    >
                                        Close
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="btn"
                                        style={{ background: 'var(--accent-gold)', color: '#000', flex: 1 }}
                                    >
                                        {loading ? 'Saving...' : 'Create & Add'}
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-ghost"
                                        onClick={() => setShowCreateForm(false)}
                                        style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                                    >
                                        Cancel
                                    </button>
                                </>
                            )}
                        </div>
                    </form>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <button
                            onClick={() => setShowCreateForm(true)}
                            className="btn"
                            style={{
                                background: 'rgba(255,255,255,0.05)', color: 'var(--accent-gold)',
                                border: '1px dashed var(--accent-gold)', width: '100%', padding: '12px'
                            }}
                        >
                            ➕ Create New Collection
                        </button>

                        <div>
                            <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Existing Collections
                            </h4>
                            {collections.length === 0 ? (
                                <p style={{ color: '#555', fontSize: '0.9rem', fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>
                                    No collections created yet.
                                </p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                                    {collections.map(c => (
                                        <button
                                            key={c.id}
                                            disabled={loading}
                                            onClick={() => handleAddToExisting(c.id)}
                                            style={{
                                                width: '100%', padding: '12px 15px', background: 'rgba(255,255,255,0.03)',
                                                border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px',
                                                color: '#fff', textAlign: 'left', cursor: 'pointer',
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                transition: 'background 0.2s'
                                            }}
                                            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                                            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                        >
                                            <span style={{ fontWeight: 'bold' }}>{c.title}</span>
                                            <span style={{ fontSize: '0.8rem', color: 'var(--accent-gold)' }}>
                                                {c.movie_count} movie(s)
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
            <style>{`
                @keyframes scaleIn { from { transform: scale(0.95) translateY(10px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
                @keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>,
        document.body
    );
}

export default AddToCollectionModal;
