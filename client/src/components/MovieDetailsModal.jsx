import { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';

function MovieDetailsModal({ movie, onClose, onUpdate, onDelete, isTrashMode, readOnly, openWithWatchedPrompt }) {
    if (!movie) return null;

    const [activeTab, setActiveTab] = useState(openWithWatchedPrompt ? 'notes' : 'about');
    const [notes, setNotes] = useState(movie.notes || '');
    const [isPublic, setIsPublic] = useState(movie.notes_public === 1 || movie.notes_public === true);
    const [userRating, setUserRating] = useState(movie.user_rating || 0);
    const [hoverRating, setHoverRating] = useState(0);
    const [savingNotes, setSavingNotes] = useState(false);
    const [savedToastVisible, setSavedToastVisible] = useState(false);
    const [showWatchedPrompt, setShowWatchedPrompt] = useState(openWithWatchedPrompt);

    // Reviews states
    const [reviews, setReviews] = useState([]);
    const [loadingReviews, setLoadingReviews] = useState(false);
    const [newReview, setNewReview] = useState('');
    const [submittingReview, setSubmittingReview] = useState(false);
    const [editingReviewId, setEditingReviewId] = useState(null);
    const [editingReviewContent, setEditingReviewContent] = useState('');

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
            setActiveTab('notes');
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

    const handleBackdropClick = (e) => {
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
                setActiveTab('notes');
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
        try {
            const updates = { 
                notes, 
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
                alert('Review saved successfully!');
                setShowWatchedPrompt(false);
            } else {
                alert('Failed to save review.');
            }
        } catch (e) {
            console.error(e);
            alert('Error saving review.');
        } finally {
            setSavingNotes(false);
        }
    };

    const handleAddReview = async (e) => {
        e.preventDefault();
        if (!newReview.trim()) return;
        setSubmittingReview(true);
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
            } else if (res.status === 401) {
                alert('You must be logged in to post reviews!');
            } else {
                alert('Failed to post review. Please try again.');
            }
        } catch (err) {
            console.error('Failed to post review:', err);
        } finally {
            setSubmittingReview(false);
        }
    };
    const handleDeleteReview = async (reviewId) => {
        if (!window.confirm('Are you sure you want to delete this review?')) return;
        try {
            const res = await fetch(`/api/reviews/${reviewId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                setReviews(prev => prev.filter(r => r.id !== reviewId));
            } else {
                const errData = await res.json();
                alert(errData.error || 'Failed to delete review');
            }
        } catch (err) {
            console.error('Failed to delete review:', err);
            alert('Failed to delete review');
        }
    };

    const handleUpdateReview = async (reviewId) => {
        if (!editingReviewContent.trim()) return;
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
            } else {
                const errData = await res.json();
                alert(errData.error || 'Failed to update review');
            }
        } catch (err) {
            console.error('Failed to update review:', err);
            alert('Failed to update review');
        }
    };
    const handleStatusToggle = async () => {
        const newStatus = movie.status === 'watched' ? 'want_to_watch' : 'watched';
        try {
            if (onUpdate) {
                await onUpdate(movie.id, { status: newStatus });
                if (newStatus === 'watched') {
                    setActiveTab('notes');
                    setShowWatchedPrompt(true);
                }
            }
        } catch (err) {
            console.error(err);
        }
    };

    return ReactDOM.createPortal(
        <div
            onClick={handleBackdropClick}
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0, 0, 0, 0.85)',
                backdropFilter: 'blur(10px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 11000, padding: '20px',
                animation: 'fadeIn 0.3s ease-out'
            }}
        >
            <div
                className="glass-panel"
                style={{
                    width: '100%', maxWidth: '900px', maxHeight: '90vh',
                    overflowY: 'auto', position: 'relative',
                    animation: 'scaleIn 0.35s cubic-bezier(0.165, 0.84, 0.44, 1)',
                    display: 'flex', flexDirection: 'column'
                }}
            >
                {/* Header / Close */}
                <button
                    onClick={onClose}
                    className="btn btn-ghost"
                    style={{
                        position: 'absolute', top: '15px', right: '15px',
                        fontSize: '1.5rem', zIndex: 10, padding: '5px'
                    }}
                >
                    &times;
                </button>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '30px', padding: '40px' }}>
                    {/* Left: Poster */}
                    <div style={{ flex: '0 0 300px', maxWidth: '100%' }}>
                        <img
                            src={movie.poster_url}
                            alt={movie.title}
                            style={{
                                width: '100%', borderRadius: '12px',
                                boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                marginBottom: '20px'
                            }}
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
                        </div>
                    </div>

                    {/* Right: Info */}
                    <div style={{ flex: '1', minWidth: '300px', display: 'flex', flexDirection: 'column' }}>
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
                            
                            {/* Personal user rating in header */}
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

                        {/* Interactive Premium Tabs Menu */}
                        <div style={{ display: 'flex', gap: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '25px', paddingBottom: '0' }}>
                            <button
                                onClick={() => setActiveTab('about')}
                                style={{
                                    background: 'none', border: 'none', color: activeTab === 'about' ? 'var(--accent-gold)' : '#888',
                                    fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', padding: '5px 10px',
                                    borderBottom: activeTab === 'about' ? '2px solid var(--accent-gold)' : '2px solid transparent',
                                    transition: 'all 0.2s', paddingBottom: '10px', marginBottom: '-1px'
                                }}
                            >
                                ℹ️ About
                            </button>

                            {!readOnly && !isTrashMode && (
                                <button
                                    onClick={() => setActiveTab('notes')}
                                    style={{
                                        background: 'none', border: 'none', color: activeTab === 'notes' ? 'var(--accent-gold)' : '#888',
                                        fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', padding: '5px 10px',
                                        borderBottom: activeTab === 'notes' ? '2px solid var(--accent-gold)' : '2px solid transparent',
                                        transition: 'all 0.2s', paddingBottom: '10px', marginBottom: '-1px'
                                    }}
                                >
                                    📝 My Review
                                </button>
                            )}

                            <button
                                onClick={() => setActiveTab('reviews')}
                                style={{
                                    background: 'none', border: 'none', color: activeTab === 'reviews' ? 'var(--accent-gold)' : '#888',
                                    fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', padding: '5px 10px',
                                    borderBottom: activeTab === 'reviews' ? '2px solid var(--accent-gold)' : '2px solid transparent',
                                    transition: 'all 0.2s', paddingBottom: '10px', marginBottom: '-1px'
                                }}
                            >
                                💬 Reviews ({reviews.length})
                            </button>
                        </div>

                        {/* Tab Content Display */}
                        <div style={{ flex: 1, marginBottom: '30px' }}>
                            {activeTab === 'about' && (
                                <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
                                    <h4 style={{ color: '#fff', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.9rem' }}>Synopsis</h4>
                                    <p style={{ color: '#ccc', lineHeight: '1.7', fontSize: '1.05rem', margin: 0 }}>{movie.description}</p>

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

                            {activeTab === 'notes' && !readOnly && !isTrashMode && (
                                <div style={{ animation: 'fadeIn 0.25s ease-out', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    {/* Congratulations Alert Banner for marking Watched */}
                                    {showWatchedPrompt && (
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
                                    <div>
                                        <h4 style={{ color: '#fff', marginBottom: '10px', fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            ⭐ Your Personal Rating
                                        </h4>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '15px' }}>
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
                                                            fontSize: '1.75rem', padding: '1px', outline: 'none',
                                                            color: isLit ? 'var(--accent-gold)' : 'rgba(255,255,255,0.15)',
                                                            textShadow: isLit ? '0 0 10px rgba(212,175,55,0.4)' : 'none',
                                                            transition: 'all 0.1s ease'
                                                        }}
                                                    >
                                                        ★
                                                    </button>
                                                );
                                            })}
                                            <span style={{
                                                marginLeft: '15px', fontSize: '1.05rem', fontWeight: 'bold',
                                                color: userRating ? 'var(--accent-gold)' : '#666',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {userRating ? `${userRating} / 10` : 'Unrated'}
                                            </span>

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
                                                        padding: 0, transition: 'all 0.15s',
                                                        flexShrink: 0
                                                    }}
                                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(207,102,121,0.25)'; e.currentTarget.style.color = 'var(--danger)'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#888'; }}
                                                >✕</button>
                                            )}
                                            
                                            <span style={{
                                                marginLeft: '12px', fontSize: '0.75rem', color: '#03dac6',
                                                fontWeight: '500',
                                                transition: 'opacity 0.8s ease, transform 0.8s ease',
                                                opacity: savedToastVisible ? 0.95 : 0,
                                                transform: savedToastVisible ? 'translateX(0)' : 'translateX(5px)',
                                                pointerEvents: 'none',
                                                whiteSpace: 'nowrap',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}>
                                                ✔ Saved automatically!
                                            </span>
                                        </div>
                                    </div>

                                    <div style={{
                                         borderTop: '1px solid rgba(255,255,255,0.08)',
                                         paddingTop: '20px',
                                         marginTop: '25px'
                                     }}>
                                         <h4 style={{ color: '#fff', marginBottom: '10px', fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                             📝 Personal Review & Notes (Private by default)
                                        </h4>
                                        <textarea
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            placeholder="Write your private review, thoughts, or movie night memories here..."
                                            style={{
                                                width: '100%', minHeight: '100px', background: 'rgba(0,0,0,0.4)',
                                                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
                                                padding: '15px', color: '#fff', fontSize: '0.95rem', resize: 'vertical',
                                                outline: 'none', fontFamily: 'inherit', lineHeight: '1.5', marginBottom: '15px'
                                            }}
                                        />

                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '15px' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: '#ccc', fontSize: '0.95rem' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={isPublic}
                                                    onChange={(e) => setIsPublic(e.target.checked)}
                                                    style={{ width: '18px', height: '18px', accentColor: 'var(--accent-gold)' }}
                                                />
                                                Make my review public in shared collections 🌍
                                            </label>

                                            <button
                                                onClick={handleSaveReview}
                                                disabled={savingNotes}
                                                className="btn"
                                                style={{
                                                    background: 'var(--accent-gold)', color: '#000',
                                                    padding: '10px 25px', fontSize: '0.9rem', fontWeight: 'bold'
                                                }}
                                            >
                                                {savingNotes ? '⏳ Saving...' : '💾 Save Review'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'reviews' && (
                                <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
                                    {/* Submit review (Only if authenticated/not guest) */}
                                    {!readOnly && (
                                        <form onSubmit={handleAddReview} style={{ marginBottom: '30px' }}>
                                            <h4 style={{ color: '#fff', marginBottom: '10px', fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
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
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxHeight: '250px', overflowY: 'auto', paddingRight: '5px' }}>
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
                                                                <div style={{ display: 'flex', gap: '8px', marginLeft: '8px' }}>
                                                                    <button
                                                                        onClick={() => {
                                                                            setEditingReviewId(r.id);
                                                                            setEditingReviewContent(r.content);
                                                                        }}
                                                                        title="Edit review"
                                                                        style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.78rem', padding: 0 }}
                                                                        onMouseEnter={e => e.target.style.color = 'var(--accent-gold)'}
                                                                        onMouseLeave={e => e.target.style.color = '#888'}
                                                                    >✏️</button>
                                                                    <button
                                                                        onClick={() => handleDeleteReview(r.id)}
                                                                        title="Delete review"
                                                                        style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.78rem', padding: 0 }}
                                                                        onMouseEnter={e => e.target.style.color = 'var(--danger)'}
                                                                        onMouseLeave={e => e.target.style.color = '#888'}
                                                                    >🗑️</button>
                                                                </div>
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
                                </div>
                            )}
                        </div>

                        {/* Modal Action Controls */}
                        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginTop: 'auto', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            {readOnly ? (
                                <a
                                    href={movie.link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="btn"
                                    style={{
                                        background: 'var(--accent-gold)',
                                        color: '#000',
                                        padding: '12px 35px',
                                        fontSize: '1.05rem',
                                        fontWeight: 'bold',
                                        boxShadow: '0 4px 15px rgba(212, 175, 55, 0.3)',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    🎬 Watch on HDRezka
                                </a>
                            ) : !isTrashMode ? (
                                <>
                                    <button
                                        className="btn"
                                        style={{
                                            background: movie.status === 'watched' ? 'rgba(255,255,255,0.1)' : 'var(--accent-gold)',
                                            color: movie.status === 'watched' ? '#fff' : '#000',
                                            padding: '12px 25px'
                                        }}
                                        onClick={handleStatusToggle}
                                    >
                                        {movie.status === 'watched' ? 'Mark Unwatched' : 'Mark Watched'}
                                    </button>
                                    <a
                                        href={movie.link}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="btn btn-ghost"
                                        style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '12px 25px' }}
                                    >
                                        Watch on HDRezka
                                    </a>
                                    <button
                                        onClick={() => { onDelete(movie.id); onClose(); }}
                                        className="btn btn-ghost"
                                        style={{ color: 'var(--danger)', padding: '12px 25px' }}
                                    >
                                        Delete
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => { onDelete(movie.id); onClose(); }}
                                    className="btn btn-primary"
                                    style={{ background: 'var(--danger)', color: '#fff' }}
                                >
                                    Delete Permanently
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

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
