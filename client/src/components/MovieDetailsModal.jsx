import { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';

function MovieDetailsModal({ movie, onClose, onUpdate, onDelete, isTrashMode, readOnly, openWithWatchedPrompt, isSelected, onSelectToggle }) {
    if (!movie) return null;

    const [activeTab, setActiveTab] = useState(openWithWatchedPrompt ? 'reviews' : 'about');
    const [notes, setNotes] = useState(movie.notes || '');
    const [isPublic, setIsPublic] = useState(movie.notes_public === 1 || movie.notes_public === true);
    const [userRating, setUserRating] = useState(movie.user_rating || 0);
    const [hoverRating, setHoverRating] = useState(0);
    const [savingNotes, setSavingNotes] = useState(false);
    const [savedToastVisible, setSavedToastVisible] = useState(false);
    const [showWatchedPrompt, setShowWatchedPrompt] = useState(openWithWatchedPrompt);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [isPosterZoomed, setIsPosterZoomed] = useState(false);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Block page scrolling behind the modal while open
    useEffect(() => {
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, []);

    // Reviews states
    const [reviews, setReviews] = useState([]);
    const [loadingReviews, setLoadingReviews] = useState(false);
    const [newReview, setNewReview] = useState('');
    const [submittingReview, setSubmittingReview] = useState(false);
    const [editingReviewId, setEditingReviewId] = useState(null);
    const [editingReviewContent, setEditingReviewContent] = useState('');

    // HDRezka comments states
    const [hdrezkaComments, setHdrezkaComments] = useState([]);
    const [loadingHdrezka, setLoadingHdrezka] = useState(false);
    const [showHdrezkaComments, setShowHdrezkaComments] = useState(false);
    const [hdrezkaPage, setHdrezkaPage] = useState(1);
    const [hdrezkaHasMore, setHdrezkaHasMore] = useState(true);
    const [hdrezkaLoadingMore, setHdrezkaLoadingMore] = useState(false);
    const hdrezkaScrollRef = useState(null);

    // Inline feedback states
    const [notesFeedback, setNotesFeedback] = useState({ type: '', message: '' });
    const [reviewFeedback, setReviewFeedback] = useState({ type: '', message: '' });
    const [confirmDeleteReviewId, setConfirmDeleteReviewId] = useState(null);
    const [editReviewFeedback, setEditReviewFeedback] = useState({ id: null, type: '', message: '' });
    const [copiedShare, setCopiedShare] = useState(false);

    const handleShare = async () => {
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        const shareUrl = `${baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl}/share/movie/${movie.id}`;
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopiedShare(true);
            setTimeout(() => setCopiedShare(false), 2000);
        } catch (err) {
            console.error('Failed to copy', err);
        }
    };

    const loadHdrezkaComments = async (page = 1) => {
        if (!movie.link) return;
        if (page === 1) {
            setLoadingHdrezka(true);
            setHdrezkaComments([]);
            setHdrezkaPage(1);
            setHdrezkaHasMore(true);
        } else {
            setHdrezkaLoadingMore(true);
        }
        try {
            const res = await fetch(`/api/hdrezka-comments?url=${encodeURIComponent(movie.link)}&page=${page}`);
            if (res.ok) {
                const data = await res.json();
                const newComments = data.comments || [];
                const hasMore = data.hasMore || false;
                setHdrezkaComments(prev => page === 1 ? newComments : [...(prev || []), ...newComments]);
                setHdrezkaHasMore(hasMore);
                setHdrezkaPage(page);
                setShowHdrezkaComments(true);
            } else {
                console.error('Failed to load hdrezka comments: HTTP', res.status);
            }
        } catch (err) {
            console.error('Failed to load hdrezka comments:', err);
        } finally {
            setLoadingHdrezka(false);
            setHdrezkaLoadingMore(false);
        }
    };

    const loadMoreHdrezkaComments = () => {
        if (!hdrezkaLoadingMore && hdrezkaHasMore) {
            loadHdrezkaComments(hdrezkaPage + 1);
        }
    };

    const handleHdrezkaScroll = (e) => {
        const el = e.currentTarget;
        const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
        if (nearBottom && hdrezkaHasMore && !hdrezkaLoadingMore && !loadingHdrezka) {
            loadMoreHdrezkaComments();
        }
    };

    const currentUser = useMemo(() => {
        const token = localStorage.getItem('token');
        if (!token) return null;
        try {
            return JSON.parse(atob(token.split('.')[1]));
        } catch (e) {
            console.error('Failed to parse token:', e);
            return null;
        }
    }, []);

    // Lock body scroll when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    // Autosaved toast fade timer
    useEffect(() => {
        if (savedToastVisible) {
            const timer = setTimeout(() => {
                setSavedToastVisible(false);
            }, 2500);
            return () => clearTimeout(timer);
        }
    }, [savedToastVisible]);

    // Sync state if movie prop changes
    useEffect(() => {
        setNotes(movie.notes || '');
        setIsPublic(movie.notes_public === 1 || movie.notes_public === true);
        setUserRating(movie.user_rating || 0);
        if (openWithWatchedPrompt) {
            setActiveTab('reviews');
            setShowWatchedPrompt(true);
        }
    }, [movie, openWithWatchedPrompt]);

    // Fetch reviews globally by movie link
    useEffect(() => {
        const fetchReviews = async () => {
            if (!movie.link) return;
            setLoadingReviews(true);
            try {
                const res = await fetch(`/api/reviews?movie_link=${encodeURIComponent(movie.link)}`);
                if (res.ok) {
                    const data = await res.json();
                    setReviews(data);
                }
            } catch (err) {
                console.error('Error fetching reviews:', err);
            } finally {
                setLoadingReviews(false);
            }
        };

        fetchReviews();
    }, [movie.link]);

    // Auto-load first page of external comments when user opens the Feed tab
    useEffect(() => {
        if (activeTab === 'reviews' && movie.link && !showHdrezkaComments && !loadingHdrezka) {
            loadHdrezkaComments(1);
        }
    }, [activeTab]);

    const handleBackdropMouseDown = (e) => {
        if (e.target === e.currentTarget) onClose();
    };

    const handleRatingChange = async (ratingVal) => {
        setUserRating(ratingVal);
        // Instant visual feedback
        setSavedToastVisible(true);
        try {
            const updates = { user_rating: ratingVal || null };
            if (ratingVal > 0 && movie.status !== 'watched') {
                updates.status = 'watched';
                setShowWatchedPrompt(true);
                setActiveTab('reviews');
            }
            const res = await fetch(`/api/movies/${movie.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            if (res.ok) {
                if (onUpdate) onUpdate(movie.id, updates);
            }
        } catch (e) {
            console.error('Failed to autosave rating:', e);
        }
    };

    const handleSaveReview = async () => {
        setSavingNotes(true);
        setNotesFeedback({ type: '', message: '' });
        try {
            const updates = { 
                notes: notes.trim() === '' ? null : notes, 
                notes_public: isPublic
            };
            if (movie.status !== 'watched') {
                updates.status = 'watched';
                setShowWatchedPrompt(true);
            }
            const res = await fetch(`/api/movies/${movie.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            if (res.ok) {
                if (onUpdate) onUpdate(movie.id, updates);
                setNotesFeedback({ type: 'success', message: '✔ Notes saved successfully!' });
                setShowWatchedPrompt(false);
                setTimeout(() => setNotesFeedback({ type: '', message: '' }), 3000);
            } else {
                setNotesFeedback({ type: 'error', message: 'Failed to save notes.' });
            }
        } catch (e) {
            console.error(e);
            setNotesFeedback({ type: 'error', message: 'Error saving notes.' });
        } finally {
            setSavingNotes(false);
        }
    };

    const handleAddReview = async (e) => {
        e.preventDefault();
        if (!newReview.trim()) return;
        setSubmittingReview(true);
        setReviewFeedback({ type: '', message: '' });
        try {
            const res = await fetch('/api/reviews', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ movie_link: movie.link, content: newReview })
            });
            if (res.ok) {
                const data = await res.json();
                setReviews(prev => [data, ...prev]);
                setNewReview('');
                setReviewFeedback({ type: 'success', message: '✔ Review published!' });
                setTimeout(() => setReviewFeedback({ type: '', message: '' }), 3000);
            } else if (res.status === 401) {
                setReviewFeedback({ type: 'error', message: 'You must be logged in to post reviews!' });
            } else {
                setReviewFeedback({ type: 'error', message: 'Failed to post review.' });
            }
        } catch (err) {
            console.error('Failed to post review:', err);
            setReviewFeedback({ type: 'error', message: 'Failed to post review.' });
        } finally {
            setSubmittingReview(false);
        }
    };

    const handleDeleteReview = async (reviewId) => {
        setEditReviewFeedback({ id: null, type: '', message: '' });
        try {
            const res = await fetch(`/api/reviews/${reviewId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                setReviews(prev => prev.filter(r => r.id !== reviewId));
                setConfirmDeleteReviewId(null);
            } else {
                const errData = await res.json();
                setEditReviewFeedback({ id: reviewId, type: 'error', message: errData.error || 'Failed to delete review' });
                setTimeout(() => setEditReviewFeedback({ id: null, type: '', message: '' }), 3000);
            }
        } catch (err) {
            console.error('Failed to delete review:', err);
            setEditReviewFeedback({ id: reviewId, type: 'error', message: 'Failed to delete review' });
            setTimeout(() => setEditReviewFeedback({ id: null, type: '', message: '' }), 3000);
        }
    };

    const handleUpdateReview = async (reviewId) => {
        if (!editingReviewContent.trim()) return;
        setEditReviewFeedback({ id: null, type: '', message: '' });
        try {
            const res = await fetch(`/api/reviews/${reviewId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: editingReviewContent })
            });
            if (res.ok) {
                setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, content: editingReviewContent.trim() } : r));
                setEditingReviewId(null);
                setEditingReviewContent('');
                setEditReviewFeedback({ id: reviewId, type: 'success', message: '✔ Review updated!' });
                setTimeout(() => setEditReviewFeedback({ id: null, type: '', message: '' }), 3000);
            } else {
                const errData = await res.json();
                setEditReviewFeedback({ id: reviewId, type: 'error', message: errData.error || 'Failed to update review' });
                setTimeout(() => setEditReviewFeedback({ id: null, type: '', message: '' }), 3000);
            }
        } catch (err) {
            console.error('Failed to update review:', err);
            setEditReviewFeedback({ id: reviewId, type: 'error', message: 'Failed to update review' });
            setTimeout(() => setEditReviewFeedback({ id: null, type: '', message: '' }), 3000);
        }
    };

    const handleStatusToggle = async () => {
        const newStatus = movie.status === 'watched' ? 'want_to_watch' : 'watched';
        try {
            if (onUpdate) {
                await onUpdate(movie.id, { status: newStatus });
                if (newStatus === 'watched') {
                    setActiveTab('reviews');
                    setShowWatchedPrompt(true);
                }
            }
        } catch (err) {
            console.error(err);
        }
    };

    return ReactDOM.createPortal(
        <div
            onMouseDown={handleBackdropMouseDown}
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0, 0, 0, 0.85)',
                backdropFilter: 'blur(10px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 11000, padding: isMobile ? '12px' : '20px',
                animation: 'fadeIn 0.3s ease-out'
            }}
        >
            <div
                style={{
                    position: 'relative',
                    width: isMobile ? '94%' : '100%', 
                    maxWidth: '900px', 
                    maxHeight: isMobile ? '82vh' : '90vh',
                    display: 'flex', 
                    flexDirection: 'column',
                    animation: 'scaleIn 0.35s cubic-bezier(0.165, 0.84, 0.44, 1)'
                }}
            >
                {/* Header / Close Button fixed relative to the outer container, so it NEVER scrolls! */}
                <div style={{ position: 'absolute', top: isMobile ? '12px' : '15px', right: isMobile ? '12px' : '15px', display: 'flex', gap: '10px', alignItems: 'center', zIndex: 100 }}>
                    {!isMobile && onSelectToggle && (
                        <label style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px', 
                            cursor: 'pointer', 
                            background: isSelected ? 'rgba(212, 175, 55, 0.2)' : 'rgba(255,255,255,0.05)', 
                            border: isSelected ? '1px solid var(--accent-gold)' : '1px solid rgba(255,255,255,0.1)', 
                            padding: '6px 12px', 
                            borderRadius: '4px', 
                            color: isSelected ? 'var(--accent-gold)' : '#fff', 
                            fontSize: '0.9rem', 
                            transition: 'all 0.2s',
                            userSelect: 'none',
                            fontWeight: '500'
                        }}>
                            <input 
                                type="checkbox" 
                                checked={isSelected} 
                                onChange={onSelectToggle} 
                                style={{ accentColor: 'var(--accent-gold)', width: '15px', height: '15px', cursor: 'pointer' }}
                            />
                            {isSelected ? '✓ Selected' : 'Select'}
                        </label>
                    )}
                    {!isMobile && (
                        <button
                            onClick={handleShare}
                            className="btn btn-ghost"
                            style={{ padding: '6px 12px', fontSize: '0.9rem', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: copiedShare ? '#03dac6' : '#fff' }}
                        >
                            {copiedShare ? '✔ Copied' : '🔗 Share'}
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="btn btn-ghost"
                        style={{ 
                            fontSize: '1.2rem', 
                            padding: 0,
                            width: isMobile ? '34px' : '38px',
                            height: isMobile ? '34px' : '38px',
                            borderRadius: '50%',
                            background: 'rgba(0, 0, 0, 0.65)',
                            border: '1px solid rgba(255, 255, 255, 0.25)',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        title="Close Modal"
                        onMouseEnter={e => { e.currentTarget.style.border = '1px solid var(--accent-gold)'; e.currentTarget.style.color = 'var(--accent-gold)'; }}
                        onMouseLeave={e => { e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.25)'; e.currentTarget.style.color = '#fff'; }}
                    >
                        ✕
                    </button>
                </div>

                <div
                    className="glass-panel"
                    style={{
                        width: '100%',
                        height: '100%',
                        maxHeight: 'inherit',
                        overflowY: 'hidden', 
                        position: 'relative',
                        display: 'flex', 
                        flexDirection: 'column',
                        borderRadius: isMobile ? '20px' : '24px',
                        border: '1px solid rgba(255, 255, 255, 0.15)'
                    }}
                >

                {movie.source_collection_name && (
                    <div style={{
                        background: 'linear-gradient(90deg, rgba(212,175,55,0.15) 0%, rgba(212,175,55,0.02) 100%)',
                        borderBottom: '1px solid rgba(212,175,55,0.2)',
                        padding: '12px 40px',
                        fontSize: '0.85rem',
                        color: '#ddd',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexWrap: 'wrap'
                    }}>
                        <span style={{ fontSize: '1.1rem' }}>🎁</span>
                        <span>Saved from collection</span>
                        {movie.source_collection_token ? (
                            <a 
                                href={`/?collection=${movie.source_collection_token}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{ 
                                    color: 'var(--accent-gold)', 
                                    fontWeight: 700, 
                                    textDecoration: 'none', 
                                    padding: '2px 8px',
                                    background: 'rgba(212,175,55,0.1)',
                                    borderRadius: '4px',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(212,175,55,0.2)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(212,175,55,0.1)'}
                            >
                                {movie.source_collection_name}
                            </a>
                        ) : (
                            <span style={{ color: 'var(--accent-gold)', fontWeight: 700 }}>
                                {movie.source_collection_name}
                            </span>
                        )}
                        <span style={{ color: '#888' }}>by {movie.source_user_name || 'unknown'}</span>
                    </div>
                )}

                {/* Scrollable Modal Content */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    width: '100%',
                    padding: isMobile ? '16px 16px 85px 16px' : '40px 40px 95px 40px'
                }}>
                    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '16px' : '30px' }}>
                        {/* Left Column (Desktop only) */}
                    {!isMobile && (
                        <div style={{ flex: '0 0 240px', maxWidth: '100%' }}>
                            <img
                                src={movie.poster_url}
                                alt={movie.title}
                                style={{
                                    width: '100%', borderRadius: '12px',
                                    boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    marginBottom: '20px',
                                    cursor: 'zoom-in',
                                    transition: 'transform 0.2s'
                                }}
                                onClick={() => setIsPosterZoomed(true)}
                                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                            />

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', fontSize: '0.9rem' }}>
                                {movie.director && (
                                    <div>
                                        <div style={{ color: '#666', marginBottom: '3px', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.5px' }}>Director</div>
                                        <div style={{ color: '#fff', lineHeight: '1.4' }}>{movie.director}</div>
                                    </div>
                                )}
                                {movie.writers && (
                                    <div>
                                        <div style={{ color: '#666', marginBottom: '3px', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.5px' }}>Writers</div>
                                        <div style={{ color: '#fff', lineHeight: '1.4' }}>{movie.writers}</div>
                                    </div>
                                )}
                                {movie.actors && (
                                    <div>
                                        <div style={{ color: '#666', marginBottom: '3px', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.5px' }}>Starring</div>
                                        <div style={{ color: '#fff', lineHeight: '1.4' }}>{movie.actors}</div>
                                    </div>
                                )}

                                {!readOnly && !isTrashMode && (
                                    <div style={{
                                        borderTop: '1px solid rgba(255,255,255,0.08)',
                                        paddingTop: '15px',
                                        marginTop: '20px'
                                    }}>
                                        <h4 style={{ color: '#fff', marginBottom: '8px', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            📝 Personal Notes (Private)
                                        </h4>
                                        <textarea
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            placeholder="Write your private review, thoughts, or notes here..."
                                            style={{
                                                width: '100%', minHeight: '90px', background: 'rgba(0,0,0,0.4)',
                                                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px',
                                                padding: '8px', color: '#fff', fontSize: '0.85rem', resize: 'vertical',
                                                outline: 'none', fontFamily: 'inherit', lineHeight: '1.4', marginBottom: '10px'
                                            }}
                                        />
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#aaa', fontSize: '0.78rem' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={isPublic}
                                                    onChange={(e) => setIsPublic(e.target.checked)}
                                                    style={{ width: '15px', height: '15px', accentColor: 'var(--accent-gold)' }}
                                                />
                                                Visible to others in shared collections 👥
                                            </label>
                                            <button
                                                onClick={handleSaveReview}
                                                disabled={savingNotes}
                                                className="btn"
                                                style={{
                                                    background: 'var(--accent-gold)', color: '#000',
                                                    padding: '6px 12px', fontSize: '0.78rem', fontWeight: 'bold',
                                                    width: '100%', borderRadius: '6px'
                                                }}
                                            >
                                                {savingNotes ? '⏳ Saving...' : '💾 Save Notes'}
                                            </button>
                                            {notesFeedback.message && (
                                                <div style={{
                                                    marginTop: '4px',
                                                    padding: '6px 10px',
                                                    borderRadius: '4px',
                                                    fontSize: '0.78rem',
                                                    textAlign: 'center',
                                                    background: notesFeedback.type === 'success' ? 'rgba(3, 218, 198, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                    color: notesFeedback.type === 'success' ? '#03dac6' : 'var(--danger)',
                                                    border: notesFeedback.type === 'success' ? '1px solid rgba(3, 218, 198, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)'
                                                }}>
                                                    {notesFeedback.message}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Right Column / Main Area */}
                    <div style={{ flex: '1', minWidth: isMobile ? '100%' : '300px', display: 'flex', flexDirection: 'column' }}>
                        {isMobile ? (
                            /* Mobile Header (Compact poster + Title side-by-side) */
                            <div style={{ display: 'flex', gap: '16px', width: '100%', alignItems: 'flex-start', marginBottom: '10px' }}>
                                <div 
                                    onClick={() => setIsPosterZoomed(true)}
                                    style={{ 
                                        flex: '0 0 100px', 
                                        cursor: 'zoom-in', 
                                        position: 'relative',
                                        borderRadius: '12px',
                                        overflow: 'hidden',
                                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                                        border: '1px solid rgba(255,255,255,0.1)'
                                    }}
                                >
                                    <img
                                        src={movie.poster_url}
                                        alt={movie.title}
                                        style={{
                                            width: '100%',
                                            height: '145px',
                                            objectFit: 'cover',
                                            display: 'block'
                                        }}
                                    />
                                    <div style={{
                                        position: 'absolute', bottom: 0, left: 0, right: 0,
                                        background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: '0.62rem',
                                        textAlign: 'center', padding: '2px 0', fontWeight: 'bold'
                                    }}>🔍 Zoom</div>
                                </div>

                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px', paddingRight: '38px' }}>
                                    <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700, color: '#fff', lineHeight: 1.25 }}>{movie.title}</h2>
                                    {movie.original_title && (
                                        <div style={{ fontSize: '0.8rem', color: '#888', fontStyle: 'italic', margin: 0 }}>{movie.original_title}</div>
                                    )}
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginTop: '2px' }}>
                                        <span style={{
                                            background: 'var(--accent-gold)', color: '#000',
                                            padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.75rem'
                                        }}>
                                            ★ {movie.rating || 'N/A'}
                                        </span>
                                        {movie.user_rating && (
                                            <span style={{
                                                background: 'rgba(3, 218, 198, 0.2)', color: '#03dac6',
                                                padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.75rem',
                                                border: '1px solid rgba(3, 218, 198, 0.3)'
                                            }}>
                                                👤 ★ {movie.user_rating}
                                            </span>
                                        )}
                                        <span style={{ color: '#aaa', fontSize: '0.75rem' }}>{movie.year}</span>
                                    </div>
                                    <div style={{ color: 'var(--accent-gold)', fontSize: '0.75rem', fontWeight: 500, lineHeight: 1.3 }}>
                                        {movie.genres}
                                    </div>

                                    {/* Mobile inline Select & Share Actions Row */}
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                        {onSelectToggle && (
                                            <label style={{ 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                gap: '6px', 
                                                cursor: 'pointer', 
                                                background: isSelected ? 'rgba(212, 175, 55, 0.15)' : 'rgba(255,255,255,0.04)', 
                                                border: isSelected ? '1px solid var(--accent-gold)' : '1px solid rgba(255,255,255,0.08)', 
                                                padding: '5px 10px', 
                                                borderRadius: '6px', 
                                                color: isSelected ? 'var(--accent-gold)' : '#fff', 
                                                fontSize: '0.78rem', 
                                                transition: 'all 0.2s',
                                                userSelect: 'none',
                                                fontWeight: '600'
                                            }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={isSelected} 
                                                    onChange={onSelectToggle} 
                                                    style={{ accentColor: 'var(--accent-gold)', width: '13px', height: '13px', cursor: 'pointer' }}
                                                />
                                                {isSelected ? '✓ Selected' : 'Select'}
                                            </label>
                                        )}
                                        <button
                                            onClick={handleShare}
                                            className="btn"
                                            style={{ 
                                                padding: '5px 10px', 
                                                fontSize: '0.78rem', 
                                                borderRadius: '6px', 
                                                background: 'rgba(255,255,255,0.04)', 
                                                border: '1px solid rgba(255,255,255,0.08)',
                                                color: copiedShare ? '#03dac6' : '#fff',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}
                                        >
                                            {copiedShare ? '✔ Copied' : '🔗 Share'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* Desktop Header */
                            <>
                                <h2 style={{ fontSize: '2.4rem', margin: '0 0 5px 0', lineHeight: '1.1' }}>{movie.title}</h2>
                                {movie.original_title && (
                                    <div style={{ fontSize: '1.1rem', color: '#888', marginBottom: '15px' }}>{movie.original_title}</div>
                                )}

                                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '25px', alignItems: 'center' }}>
                                    <span style={{
                                        background: 'var(--accent-gold)', color: '#000',
                                        padding: '4px 12px', borderRadius: '4px', fontWeight: 'bold'
                                    }}>
                                        ★ {movie.rating || 'N/A'}
                                    </span>
                                    {movie.user_rating && (
                                        <span style={{
                                            background: 'rgba(3, 218, 198, 0.2)', color: '#03dac6',
                                            padding: '4px 12px', borderRadius: '4px', fontWeight: 'bold',
                                            border: '1px solid rgba(3, 218, 198, 0.4)'
                                        }}>
                                            👤 My rating: ★ {movie.user_rating}
                                        </span>
                                    )}
                                    <span style={{ color: '#aaa' }}>{movie.year}</span>
                                    <div style={{ width: '1px', height: '15px', background: '#444' }}></div>
                                    <span style={{ color: 'var(--accent-gold)', fontSize: '0.9rem' }}>{movie.genres}</span>
                                </div>
                            </>
                        )}

                        {/* Interactive Premium Tabs Menu */}
                        <div style={{ display: 'flex', gap: isMobile ? '15px' : '20px', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '25px', paddingBottom: '0' }}>
                            <button
                                onClick={() => setActiveTab('about')}
                                style={{
                                    background: 'none', border: 'none', color: activeTab === 'about' ? 'var(--accent-gold)' : '#888',
                                    fontSize: isMobile ? '0.92rem' : '1rem', fontWeight: 'bold', cursor: 'pointer', padding: '5px 10px',
                                    borderBottom: activeTab === 'about' ? '2.5px solid var(--accent-gold)' : '2.5px solid transparent',
                                    transition: 'all 0.2s', paddingBottom: '10px', marginBottom: '-1px'
                                }}
                            >
                                ℹ️ About
                            </button>

                            <button
                                onClick={() => setActiveTab('reviews')}
                                style={{
                                    background: 'none', border: 'none', color: activeTab === 'reviews' ? 'var(--accent-gold)' : '#888',
                                    fontSize: isMobile ? '0.92rem' : '1rem', fontWeight: 'bold', cursor: 'pointer', padding: '5px 10px',
                                    borderBottom: activeTab === 'reviews' ? '2.5px solid var(--accent-gold)' : '2.5px solid transparent',
                                    transition: 'all 0.2s', paddingBottom: '10px', marginBottom: '-1px'
                                }}
                            >
                                {isMobile ? `📝 Feed (${reviews.length})` : `📝 Rating & Community Feed (${reviews.length})`}
                            </button>
                        </div>

                        {/* Tab Content Display */}
                        <div style={{ flex: 1, marginBottom: '30px' }}>
                            {activeTab === 'about' && (
                                <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
                                    <h4 style={{ color: '#fff', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.85rem' }}>Synopsis</h4>
                                    <p style={{ color: '#ccc', lineHeight: '1.65', fontSize: isMobile ? '0.92rem' : '1.05rem', margin: 0, textAlign: 'justify' }}>{movie.description}</p>

                                    {isMobile && (
                                        <>
                                            {/* Shrunken Director & Starring grid */}
                                            <div style={{ 
                                                display: 'flex', 
                                                flexDirection: 'column', 
                                                gap: '8px', 
                                                fontSize: '0.82rem', 
                                                background: 'rgba(255,255,255,0.02)', 
                                                padding: '12px', 
                                                borderRadius: '8px',
                                                border: '1px solid rgba(255,255,255,0.04)',
                                                marginTop: '16px'
                                            }}>
                                                {movie.director && (
                                                    <div>
                                                        <span style={{ color: '#888', fontWeight: 600 }}>Director: </span>
                                                        <span style={{ color: '#fff' }}>{movie.director}</span>
                                                    </div>
                                                )}
                                                {movie.writers && (
                                                    <div>
                                                        <span style={{ color: '#888', fontWeight: 600 }}>Writers: </span>
                                                        <span style={{ color: '#fff' }}>{movie.writers}</span>
                                                    </div>
                                                )}
                                                {movie.actors && (
                                                    <div>
                                                        <span style={{ color: '#888', fontWeight: 600 }}>Starring: </span>
                                                        <span style={{ color: '#eee' }}>{movie.actors}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Personal Notes (Private) */}
                                            {!readOnly && !isTrashMode && (
                                                <div style={{
                                                    borderTop: '1px solid rgba(255,255,255,0.08)',
                                                    paddingTop: '12px',
                                                    marginTop: '16px'
                                                }}>
                                                    <h4 style={{ color: '#fff', marginBottom: '8px', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                        📝 Personal Notes (Private)
                                                    </h4>
                                                    <textarea
                                                        value={notes}
                                                        onChange={(e) => setNotes(e.target.value)}
                                                        placeholder="Write your private review, thoughts, or notes here..."
                                                        style={{
                                                            width: '100%', minHeight: '80px', background: 'rgba(0,0,0,0.4)',
                                                            border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px',
                                                            padding: '8px', color: '#fff', fontSize: '0.82rem', resize: 'vertical',
                                                            outline: 'none', fontFamily: 'inherit', lineHeight: '1.4', marginBottom: '8px'
                                                        }}
                                                    />
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#aaa', fontSize: '0.75rem' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={isPublic}
                                                                onChange={(e) => setIsPublic(e.target.checked)}
                                                                style={{ width: '14px', height: '14px', accentColor: 'var(--accent-gold)' }}
                                                            />
                                                            Visible to others in shared collections 👥
                                                        </label>
                                                        <button
                                                            onClick={handleSaveReview}
                                                            disabled={savingNotes}
                                                            className="btn"
                                                            style={{
                                                                background: 'var(--accent-gold)', color: '#000',
                                                                padding: '8px 12px', fontSize: '0.8rem', fontWeight: 'bold',
                                                                width: '100%', borderRadius: '6px', border: 'none', cursor: 'pointer'
                                                            }}
                                                        >
                                                            {savingNotes ? '⏳ Saving...' : '💾 Save Notes'}
                                                        </button>
                                                        {notesFeedback.message && (
                                                            <div style={{
                                                                marginTop: '4px',
                                                                padding: '6px 10px',
                                                                borderRadius: '4px',
                                                                fontSize: '0.75rem',
                                                                textAlign: 'center',
                                                                background: notesFeedback.type === 'success' ? 'rgba(3, 218, 198, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                                color: notesFeedback.type === 'success' ? '#03dac6' : 'var(--danger)',
                                                                border: notesFeedback.type === 'success' ? '1px solid rgba(3, 218, 198, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)'
                                                            }}>
                                                                {notesFeedback.message}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {/* Public Owner Notes & Rating Display in Shared view */}
                                    {(movie.notes || movie.user_rating) && (
                                        <div style={{
                                            background: 'rgba(212,175,55,0.06)',
                                            borderLeft: '4px solid var(--accent-gold)',
                                            padding: '16px 20px',
                                            borderRadius: '0 8px 8px 0',
                                            marginTop: '25px',
                                            color: '#eee',
                                            border: '1px solid rgba(212,175,55,0.1)'
                                        }}>
                                            <strong style={{ display: 'block', color: 'var(--accent-gold)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                                                ✍️ Shared Owner's Review
                                            </strong>
                                            {movie.user_rating && (
                                                <div style={{ color: 'var(--accent-gold)', fontWeight: 'bold', marginBottom: '8px', fontSize: '0.95rem' }}>
                                                    Rating: ★ {movie.user_rating} / 10
                                                </div>
                                            )}
                                            {movie.notes && <div style={{ fontStyle: 'italic' }}>"{movie.notes}"</div>}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'reviews' && (
                                <div style={{ animation: 'fadeIn 0.25s ease-out', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    {/* Congratulations Alert Banner for marking Watched */}
                                    {showWatchedPrompt && !readOnly && !isTrashMode && (
                                        <div style={{
                                            background: 'rgba(3, 218, 198, 0.08)',
                                            border: '1px solid rgba(3, 218, 198, 0.25)',
                                            padding: '15px 20px',
                                            borderRadius: '8px',
                                            color: '#fff',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            fontSize: '0.95rem'
                                        }}>
                                            <div>
                                                <span style={{ fontSize: '1.2rem', marginRight: '10px' }}>🎉</span>
                                                <strong>Congratulations!</strong> You have watched this movie! Rate it and write a review below.
                                            </div>
                                            <button
                                                onClick={() => setShowWatchedPrompt(false)}
                                                style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.2rem' }}
                                            >
                                                &times;
                                            </button>
                                        </div>
                                    )}

                                    {/* Star Rating Selector Component */}
                                    {!readOnly && !isTrashMode && (
                                        <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '10px', padding: isMobile ? '12px' : '10px 14px' }}>
                                            <h4 style={{ color: '#fff', marginTop: 0, marginBottom: '8px', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                ⭐ Your Personal Rating
                                            </h4>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '10px', flexWrap: 'wrap' }}>
                                                {/* Left side: Stars */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '2px' : '4px' }}>
                                                    {[...Array(10)].map((_, i) => {
                                                        const starValue = i + 1;
                                                        const isLit = (hoverRating || userRating) >= starValue;
                                                        return (
                                                            <button
                                                                key={starValue}
                                                                type="button"
                                                                onClick={() => handleRatingChange(starValue === userRating ? 0 : starValue)}
                                                                onMouseEnter={() => setHoverRating(starValue)}
                                                                onMouseLeave={() => setHoverRating(0)}
                                                                style={{
                                                                    background: 'none', border: 'none', cursor: 'pointer',
                                                                    fontSize: isMobile ? '1.25rem' : '1.45rem', padding: '1px', outline: 'none',
                                                                    color: isLit ? 'var(--accent-gold)' : 'rgba(255,255,255,0.15)',
                                                                    textShadow: isLit ? '0 0 10px rgba(212,175,55,0.4)' : 'none',
                                                                    transition: 'all 0.1s ease'
                                                                }}
                                                            >
                                                                ★
                                                            </button>
                                                        );
                                                    })}
                                                </div>

                                                {/* Right side: Indicators (Text rating, clear cross, and saved status) */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto', flexShrink: 0, minHeight: '24px' }}>
                                                    {/* Saved automatically toast */}
                                                    <span style={{
                                                        fontSize: '0.72rem', color: '#03dac6',
                                                        fontWeight: '500',
                                                        transition: 'opacity 0.8s ease, transform 0.8s ease',
                                                        opacity: savedToastVisible ? 0.95 : 0,
                                                        transform: savedToastVisible ? 'translateX(0)' : 'translateX(5px)',
                                                        pointerEvents: 'none',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        ✔ Saved!
                                                    </span>

                                                    {/* Rating numeric indicator */}
                                                    <span style={{
                                                        fontSize: isMobile ? '0.85rem' : '0.9rem', fontWeight: 'bold',
                                                        color: hoverRating ? '#fff' : (userRating ? 'var(--accent-gold)' : '#666'),
                                                        whiteSpace: 'nowrap',
                                                        minWidth: '50px',
                                                        textAlign: 'right'
                                                    }}>
                                                        {hoverRating ? `${hoverRating} / 10` : (userRating ? `${userRating} / 10` : 'Unrated')}
                                                    </span>

                                                    {/* Clear rating button placeholder (so it always occupies space and never shifts) */}
                                                    <div style={{ width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                        {userRating > 0 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRatingChange(0)}
                                                                title="Clear rating"
                                                                style={{
                                                                    background: 'rgba(255,255,255,0.07)',
                                                                    border: '1px solid rgba(255,255,255,0.12)',
                                                                    borderRadius: '50%',
                                                                    width: '22px', height: '22px',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    cursor: 'pointer', color: '#888', fontSize: '0.7rem',
                                                                    padding: 0, transition: 'all 0.15s'
                                                                }}
                                                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(207,102,121,0.25)'; e.currentTarget.style.color = 'var(--danger)'; }}
                                                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#888'; }}
                                                            >✕</button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Write Public Community Review Form */}
                                    {!readOnly && !isTrashMode && (
                                        <form onSubmit={handleAddReview} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '10px', padding: '15px' }}>
                                             <h4 style={{ color: '#fff', marginTop: 0, marginBottom: '10px', fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                 📢 Write a Public Community Review
                                             </h4>
                                             <textarea
                                                 value={newReview}
                                                 onChange={(e) => setNewReview(e.target.value)}
                                                 placeholder="Write a public review for this movie. Everyone in the community can read this!"
                                                 style={{
                                                     width: '100%', minHeight: '80px', background: 'rgba(0,0,0,0.4)',
                                                     border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
                                                     padding: '12px', color: '#fff', fontSize: '0.95rem', resize: 'vertical',
                                                     marginBottom: '12px', outline: 'none', fontFamily: 'inherit', lineHeight: '1.5'
                                                 }}
                                             />
                                             <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                 <button
                                                     type="submit"
                                                     disabled={submittingReview || !newReview.trim()}
                                                     className="btn"
                                                     style={{
                                                         background: 'var(--accent-gold)', color: '#000',
                                                         padding: '8px 20px', fontSize: '0.85rem', fontWeight: 'bold'
                                                     }}
                                                 >
                                                     {submittingReview ? '⏳ Publishing...' : '📢 Publish Review'}
                                                 </button>
                                                 {reviewFeedback.message && (
                                                     <span style={{
                                                         fontSize: '0.82rem',
                                                         color: reviewFeedback.type === 'success' ? '#03dac6' : 'var(--danger)',
                                                         fontWeight: 'bold'
                                                     }}>
                                                         {reviewFeedback.message}
                                                     </span>
                                                 )}
                                             </div>
                                        </form>
                                    )}


                                    {/* Reviews list */}
                                    <h4 style={{ color: '#fff', marginBottom: '15px', fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        💬 Community Feed
                                    </h4>

                                    {loadingReviews && reviews.length === 0 ? (
                                        <div style={{ color: '#666', padding: '20px 0' }}>Loading community reviews...</div>
                                    ) : reviews.length === 0 ? (
                                        <div style={{ color: '#666', padding: '20px 0', fontStyle: 'italic' }}>
                                            No community reviews posted yet. Be the first to share your thoughts!
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxHeight: '350px', overflowY: 'auto', paddingRight: '5px' }}>
                                            {reviews.map(r => (
                                                <div
                                                    key={r.id}
                                                    style={{
                                                        padding: '15px', borderRadius: '8px',
                                                        background: 'rgba(255,255,255,0.02)',
                                                        border: '1px solid rgba(255,255,255,0.05)'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <strong style={{ color: 'var(--accent-gold)' }}>👤 {r.username}</strong>
                                                            {currentUser && (currentUser.id === r.user_id || currentUser.username?.toLowerCase() === 'radev') && (
                                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                                    {confirmDeleteReviewId === r.id ? (
                                                                        <span style={{ display: 'flex', gap: '5px', alignItems: 'center', background: 'rgba(239,68,68,0.08)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.2)' }}>
                                                                            <span style={{ fontSize: '0.72rem', color: '#ff6b6b' }}>Sure delete?</span>
                                                                            <button
                                                                                onClick={() => handleDeleteReview(r.id)}
                                                                                style={{ background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: '3px', padding: '1px 6px', fontSize: '0.7rem', cursor: 'pointer' }}
                                                                            >Yes</button>
                                                                            <button
                                                                                onClick={() => setConfirmDeleteReviewId(null)}
                                                                                style={{ background: 'rgba(255,255,255,0.08)', color: '#aaa', border: 'none', borderRadius: '3px', padding: '1px 6px', fontSize: '0.7rem', cursor: 'pointer' }}
                                                                            >No</button>
                                                                        </span>
                                                                    ) : (
                                                                        <>
                                                                            <button
                                                                                onClick={() => {
                                                                                    setEditingReviewId(r.id);
                                                                                    setEditingReviewContent(r.content);
                                                                                }}
                                                                                title="Edit review"
                                                                                style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.78rem', padding: 0 }}
                                                                                onMouseEnter={e => e.target.style.color = 'var(--accent-gold)'}
                                                                                onMouseLeave={e => e.target.style.color = '#888'}
                                                                            >✏️ Edit</button>
                                                                            <button
                                                                                onClick={() => setConfirmDeleteReviewId(r.id)}
                                                                                title="Delete review"
                                                                                style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.78rem', padding: 0 }}
                                                                                onMouseEnter={e => e.target.style.color = 'var(--danger)'}
                                                                                onMouseLeave={e => e.target.style.color = '#888'}
                                                                            >🗑️ Delete</button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {editReviewFeedback.id === r.id && editReviewFeedback.message && (
                                                                <span style={{ color: editReviewFeedback.type === 'success' ? '#03dac6' : 'var(--danger)', fontSize: '0.75rem', marginLeft: '8px' }}>
                                                                    {editReviewFeedback.message}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span style={{ color: '#666' }}>{new Date(r.created_at).toLocaleDateString()}</span>
                                                    </div>
                                                    {editingReviewId === r.id ? (
                                                        <div style={{ marginTop: '5px' }}>
                                                            <textarea
                                                                value={editingReviewContent}
                                                                onChange={e => setEditingReviewContent(e.target.value)}
                                                                style={{
                                                                    width: '100%', minHeight: '60px', boxSizing: 'border-box',
                                                                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                                                                    borderRadius: '6px', color: '#fff', padding: '8px', fontSize: '0.9rem',
                                                                    outline: 'none', resize: 'vertical', fontFamily: 'inherit'
                                                                }}
                                                            />
                                                            <div style={{ display: 'flex', gap: '8px', marginTop: '6px', justifyContent: 'flex-end' }}>
                                                                <button
                                                                    onClick={() => { setEditingReviewId(null); setEditingReviewContent(''); }}
                                                                    style={{
                                                                        background: 'rgba(255,255,255,0.08)', border: 'none', color: '#aaa',
                                                                        borderRadius: '4px', padding: '4px 10px', fontSize: '0.78rem', cursor: 'pointer'
                                                                    }}
                                                                >Cancel</button>
                                                                <button
                                                                    onClick={() => handleUpdateReview(r.id)}
                                                                    style={{
                                                                        background: 'var(--accent-gold)', border: 'none', color: '#000',
                                                                        borderRadius: '4px', padding: '4px 12px', fontSize: '0.78rem', fontWeight: 'bold', cursor: 'pointer'
                                                                    }}
                                                                >Save</button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <p style={{ color: '#ccc', margin: 0, fontSize: '0.95rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                                                            {r.content}
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* HDRezka Comments Section */}
                                    <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '20px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                            <div>
                                                <h4 style={{ color: '#fff', margin: '0 0 4px 0', fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                    🌐 External Comments
                                                </h4>
                                                <div style={{ color: '#888', fontSize: '0.75rem' }}>
                                                    Comments from hdrezka
                                                </div>
                                            </div>
                                            {loadingHdrezka && (
                                                <div style={{ color: '#888', fontSize: '0.8rem' }}>⏳ Loading...</div>
                                            )}
                                        </div>

                                        {showHdrezkaComments && hdrezkaComments !== null && (
                                            <div 
                                                onScroll={handleHdrezkaScroll}
                                                style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '450px', overflowY: 'auto', paddingRight: '5px' }}
                                            >
                                                {hdrezkaComments.length === 0 && !loadingHdrezka ? (
                                                    <div style={{ color: '#666', fontStyle: 'italic', padding: '10px 0' }}>No external comments found.</div>
                                                ) : (
                                                    hdrezkaComments.map(comment => (
                                                        <div key={comment.id} style={{
                                                            padding: '12px', borderRadius: '8px',
                                                            background: 'rgba(0,0,0,0.2)',
                                                            border: '1px solid rgba(255,255,255,0.03)'
                                                        }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                                                <img 
                                                                    src={comment.avatar || 'https://static.hdrezka.ac/templates/hdrezka/images/noavatar.png'} 
                                                                    alt={comment.author} 
                                                                    style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} 
                                                                    onError={(e) => { e.target.src = 'https://static.hdrezka.ac/templates/hdrezka/images/noavatar.png' }}
                                                                />
                                                                <div>
                                                                    <div style={{ color: '#ddd', fontWeight: 'bold', fontSize: '0.85rem' }}>{comment.author}</div>
                                                                    <div style={{ color: '#666', fontSize: '0.72rem' }}>{comment.date}</div>
                                                                </div>
                                                            </div>
                                                            <div style={{ color: '#bbb', fontSize: '0.85rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                                                                {comment.text}
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                                {/* Load More indicator */}
                                                {hdrezkaLoadingMore && (
                                                    <div style={{ textAlign: 'center', color: '#888', padding: '10px', fontSize: '0.8rem' }}>⏳ Loading more...</div>
                                                )}
                                                {!hdrezkaHasMore && hdrezkaComments.length > 0 && (
                                                    <div style={{ textAlign: 'center', color: '#555', padding: '10px', fontSize: '0.75rem', fontStyle: 'italic' }}>All comments loaded</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

                {/* Modal Action Controls (Sticky/fixed at the bottom of .glass-panel) */}
                <div style={{ 
                    display: 'flex', 
                    gap: '10px', 
                    flexWrap: 'nowrap', 
                    paddingTop: '15px', 
                    paddingBottom: '15px',
                    paddingLeft: isMobile ? '16px' : '40px',
                    paddingRight: isMobile ? '16px' : '40px',
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(20, 20, 20, 0.85)',
                    backdropFilter: 'blur(20px)',
                    width: '100%',
                    boxSizing: 'border-box',
                    flexShrink: 0,
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    zIndex: 10
                }}>
                    {!isMobile && <div style={{ flex: '0 0 270px' }} />}
                    {readOnly ? (
                                <a
                                    href={movie.link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="btn"
                                    style={{
                                        background: 'linear-gradient(135deg, #FFDF73 0%, #D4AF37 100%)',
                                        border: 'none',
                                        color: '#000',
                                        padding: isMobile ? '10px 20px' : '12px 35px',
                                        fontSize: isMobile ? '0.88rem' : '1.05rem',
                                        fontWeight: 'bold',
                                        boxShadow: '0 4px 15px rgba(212, 175, 55, 0.3)',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        borderRadius: '10px',
                                        textDecoration: 'none',
                                        transition: 'all 0.2s',
                                        flex: isMobile ? '1' : 'initial'
                                    }}
                                >
                                    🎬 Watch on HDRezka
                                </a>
                            ) : !isTrashMode ? (
                                <>
                                    <button
                                        style={{
                                            background: movie.status === 'watched' ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, #FFDF73 0%, #D4AF37 100%)',
                                            border: movie.status === 'watched' ? '1px solid rgba(255,255,255,0.12)' : 'none',
                                            color: movie.status === 'watched' ? '#fff' : '#000',
                                            padding: isMobile ? '10px 12px' : '12px 28px',
                                            fontSize: isMobile ? '0.82rem' : '0.95rem',
                                            fontWeight: '700',
                                            borderRadius: '10px',
                                            cursor: 'pointer',
                                            boxShadow: movie.status === 'watched' ? 'none' : '0 4px 15px rgba(212, 175, 55, 0.25)',
                                            transition: 'all 0.2s',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px',
                                            flex: isMobile ? '1 1 auto' : '0 0 auto'
                                        }}
                                        onClick={handleStatusToggle}
                                    >
                                        {movie.status === 'watched' ? 'Mark Unwatched ⚪' : 'Mark Watched ⭐'}
                                    </button>
                                    <a
                                        href={movie.link}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{
                                            background: 'rgba(255,255,255,0.03)',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            color: '#fff',
                                            padding: isMobile ? '10px 12px' : '12px 28px',
                                            fontSize: isMobile ? '0.82rem' : '0.95rem',
                                            fontWeight: '600',
                                            borderRadius: '10px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px',
                                            textDecoration: 'none',
                                            flex: isMobile ? '1 1 auto' : '0 0 auto'
                                        }}
                                    >
                                        Watch on HDRezka 🌐
                                    </a>
                                    <button
                                        onClick={() => { onDelete(movie.id); onClose(); }}
                                        className="modal-delete-btn"
                                        style={{
                                            background: 'rgba(239, 68, 68, 0.08)',
                                            border: '1px solid rgba(239, 68, 68, 0.2)',
                                            color: '#ff6b6b',
                                            padding: isMobile ? '10px 14px' : '12px 18px',
                                            fontSize: isMobile ? '0.82rem' : '0.95rem',
                                            fontWeight: '600',
                                            borderRadius: '10px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px',
                                            flex: '0 0 auto'
                                        }}
                                        title="Delete Movie"
                                    >
                                        🗑️
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => { onDelete(movie.id); onClose(); }}
                                    style={{
                                        background: 'rgba(239, 68, 68, 0.9)',
                                        border: 'none',
                                        color: '#fff',
                                        padding: isMobile ? '10px 16px' : '12px 28px',
                                        fontSize: isMobile ? '0.85rem' : '0.95rem',
                                        fontWeight: '700',
                                        borderRadius: '10px',
                                        cursor: 'pointer',
                                        boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                                        transition: 'all 0.2s',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        flex: isMobile ? '1' : 'initial'
                                    }}
                                >
                                    Delete Permanently 🗑️
                                </button>
                            )}
                        </div>
                    </div>
                {/* End of outer wrapper div */}
                </div>

            {/* Poster Zoom Modal Overlay */}
            {isPosterZoomed && (
                <div
                    onClick={() => setIsPosterZoomed(false)}
                    style={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0, 0, 0, 0.95)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 12000,
                        cursor: 'zoom-out',
                        animation: 'fadeIn 0.2s ease-out'
                    }}
                >
                    <img
                        src={movie.poster_url}
                        alt={movie.title}
                        style={{
                            maxWidth: '90%',
                            maxHeight: '90%',
                            borderRadius: '12px',
                            boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            animation: 'scaleIn 0.25s cubic-bezier(0.165, 0.84, 0.44, 1)'
                        }}
                    />
                    <div style={{
                        position: 'absolute',
                        bottom: '24px',
                        color: '#aaa',
                        fontSize: '0.85rem',
                        background: 'rgba(255,255,255,0.08)',
                        padding: '8px 16px',
                        borderRadius: '20px',
                        backdropFilter: 'blur(5px)'
                    }}>
                        Click anywhere to close
                    </div>
                </div>
            )}

            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes scaleIn { from { transform: scale(0.9) translateY(20px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
                @keyframes slideIn { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            `}</style>
        </div>,
        document.body
    );
}

export default MovieDetailsModal;
