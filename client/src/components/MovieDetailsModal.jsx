import { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import TrailerModal from './TrailerModal';
import MatrixText from './MatrixText';

const globalAttemptedUpdates = new Set();
// Persist live details across re-opens so TMDB rating / genres don't disappear
const globalLiveDetailsCache = new Map();

function MovieDetailsModal({ movie: propMovie, onClose, onUpdate, onDelete, isTrashMode, readOnly, openWithWatchedPrompt, isSelected, onSelectToggle, isAdded, libMovieId, onAddMovie, isWatched, onToggleWatched, onRemoveMovie, onHideMovie, onAddToCollection }) {
    const [liveDetails, setLiveDetails] = useState(() => {
        if (propMovie?.link) return globalLiveDetailsCache.get(propMovie.link) || null;
        return null;
    });
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);

    // Normalize propMovie: grids pass genres as 'misc' alias; normalize to 'genres' for consistency
    const movie = useMemo(() => {
        if (!propMovie) return null;
        const base = { ...propMovie };
        if (!base.genres && base.misc) base.genres = base.misc;
        return { ...base, ...liveDetails };
    }, [propMovie, liveDetails]);

    useEffect(() => {
        if (!propMovie || !propMovie.link) return;
        
        // Restore cached details immediately when re-opening the same movie
        const cached = globalLiveDetailsCache.get(propMovie.link);
        if (cached) {
            setLiveDetails(cached);
        }

        // If we already tried fetching details for this movie during this app session, don't try again
        if (globalAttemptedUpdates.has(propMovie.link)) return;

        // If it's missing description entirely, it hasn't been scraped yet.
        // Also trigger if rating is missing ('0', '—', 'N/A', null, etc).
        // globalAttemptedUpdates prevents infinite loops if HDRezka genuinely has no rating.
        const isRatingMissing = !propMovie.rating || propMovie.rating === '0' || propMovie.rating === '—' || propMovie.rating === 'N/A';
        const isTmdbRatingMissing = !propMovie.tmdb_rating || propMovie.tmdb_rating === '0' || propMovie.tmdb_rating === '—' || propMovie.tmdb_rating === 'N/A';
        const needsUpdate = propMovie.description === undefined || propMovie.description === null || isRatingMissing || isTmdbRatingMissing;

        if (needsUpdate) {
            globalAttemptedUpdates.add(propMovie.link);
            setIsLoadingDetails(true);
            const token = localStorage.getItem('token');
            fetch('/api/movies/search', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ query: propMovie.link })
            })
            .then(res => res.json())
            .then(data => {
                if (data && data.data) {
                    const details = data.data;
                    setLiveDetails(details);
                    globalLiveDetailsCache.set(propMovie.link, details);
                    
                    // If it's in the user's library, update it permanently!
                    if (propMovie.id) {
                        fetch(`/api/movies/${propMovie.id}`, {
                            method: 'PATCH',
                            headers: { 
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({
                                title: details.title,
                                original_title: details.original_title,
                                year: details.year,
                                rating: details.rating,
                                description: details.description,
                                poster_url: details.poster_url,
                                genres: details.genres,
                                actors: details.actors,
                                director: details.director,
                                writers: details.writers,
                                country: details.country,
                                duration: details.duration,
                                type: details.type
                            })
                        }).then(() => {
                            if (onUpdate) onUpdate(propMovie.id, details);
                        }).catch(err => console.error('Auto-update failed', err));
                    } else if (onUpdate) {
                        onUpdate(null, details);
                    }
                }
            })
            .catch(err => console.error('On-the-fly fetch failed:', err))
            .finally(() => setIsLoadingDetails(false));
        }
    }, [propMovie]);

    if (!movie) return null;

    const [activeTab, setActiveTab] = useState(openWithWatchedPrompt ? 'reviews' : 'about');
    const [notes, setNotes] = useState(movie.notes || '');
    const [isPublic, setIsPublic] = useState(movie.notes_public === 1 || movie.notes_public === true);
    const [userRating, setUserRating] = useState(movie.user_rating || 0);
    const [localStatus, setLocalStatus] = useState(() => isWatched ? 'watched' : (movie.status || 'want_to_watch'));
    const [initialMount, setInitialMount] = useState(true);

    useEffect(() => {
        if (initialMount) { setInitialMount(false); return; }
        // Only sync when isWatched prop changes (driven by parent's localWatchedLinks)
        setLocalStatus(isWatched ? 'watched' : 'want_to_watch');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isWatched]);

    const [hoverRating, setHoverRating] = useState(0);
    const [isLibraryBtnHovered, setIsLibraryBtnHovered] = useState(false);
    const [isHideBtnHovered, setIsHideBtnHovered] = useState(false);
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
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        const originalOverflow = document.body.style.overflow;
        const originalPaddingRight = document.body.style.paddingRight;

        document.body.style.overflow = 'hidden';
        if (scrollbarWidth > 0) {
            document.body.style.paddingRight = `${scrollbarWidth}px`;
        }

        return () => {
            document.body.style.overflow = originalOverflow;
            document.body.style.paddingRight = originalPaddingRight;
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

    // Global cache search state
    const [cacheSearch, setCacheSearch] = useState(null); // { type, value, movies: [], loading: false, error: null }
    
    // Trailer modal state
    const [isTrailerModalOpen, setIsTrailerModalOpen] = useState(false);
    const [trailerSearchQuery, setTrailerSearchQuery] = useState('');
    const [preloadedTrailers, setPreloadedTrailers] = useState(null);
    const [isTrailerCached, setIsTrailerCached] = useState(false);


    useEffect(() => {
        if (!movie) return;
        let typeStr = 'фильм';
        if (movie.genres && movie.genres.toLowerCase().includes('аниме')) {
            typeStr = 'аниме';
        } else if (movie.genres && movie.genres.toLowerCase().includes('мультфильм')) {
            typeStr = 'мультфильм';
        } else if (movie.type === 'series') {
            typeStr = 'сериал';
        }
        
        const queryTokens = [typeStr, movie.title, movie.year, 'трейлер'].filter(Boolean);
        const query = queryTokens.join(' ');
        setTrailerSearchQuery(query);
    }, [movie]);

    useEffect(() => {
        if (!trailerSearchQuery) return;
        let active = true;
        const fetchTrailers = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(trailerSearchQuery)}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error('Failed to fetch trailers');
                const data = await res.json();
                if (active) {
                    setPreloadedTrailers(data.results || []);
                    if (data.cached) setIsTrailerCached(true);
                }
            } catch (err) {
                console.error(err);
                if (active) setPreloadedTrailers(new Error('Could not load trailers'));
            }
        };
        fetchTrailers();
        return () => { active = false; };
    }, [trailerSearchQuery]);

    const handleCacheSearchClick = async (type, value) => {
        setCacheSearch({ type, value, movies: [], loading: true });
        try {
            const res = await fetch(`/api/cache/search-exact?${type}=${encodeURIComponent(value)}`);
            if (res.ok) {
                const data = await res.json();
                setCacheSearch({ type, value, movies: data, loading: false });
            } else {
                setCacheSearch({ type, value, movies: [], loading: false, error: 'Failed to fetch movies from global cache.' });
            }
        } catch (err) {
            setCacheSearch({ type, value, movies: [], loading: false, error: 'Failed to fetch movies from global cache.' });
        }
    };

    const [addingLinks, setAddingLinks] = useState(new Set());
    const [addedLinks, setAddedLinks] = useState(new Set());

    const handleAddMovieFromCache = async (link) => {
        if (addingLinks.has(link) || addedLinks.has(link)) return;
        setAddingLinks(prev => new Set([...prev, link]));
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/movies', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ link })
            });
            if (res.ok) {
                setAddedLinks(prev => new Set([...prev, link]));
            }
        } catch (err) {
            console.error('Failed to add movie from cache', err);
        } finally {
            setAddingLinks(prev => {
                const next = new Set(prev);
                next.delete(link);
                return next;
            });
        }
    };

    // Inline feedback states
    const [notesFeedback, setNotesFeedback] = useState({ type: '', message: '' });
    const [reviewFeedback, setReviewFeedback] = useState({ type: '', message: '' });
    const [confirmDeleteReviewId, setConfirmDeleteReviewId] = useState(null);
    const [editReviewFeedback, setEditReviewFeedback] = useState({ id: null, type: '', message: '' });
    const [copiedShare, setCopiedShare] = useState(false);
    const [isRefreshingData, setIsRefreshingData] = useState(false);
    const [isRefreshingTmdb, setIsRefreshingTmdb] = useState(false);

    const isAdmin = useMemo(() => {
        try {
            const token = localStorage.getItem('token');
            if (token) {
                const payload = JSON.parse(atob(token.split('.')[1]));
                return payload.username?.toLowerCase() === 'radev';
            }
        } catch (e) {}
        return false;
    }, []);

    const handleRefreshTmdb = async () => {
        if (isRefreshingTmdb || !movie?.link) return;
        setIsRefreshingTmdb(true);
        const token = localStorage.getItem('token');
        try {
            // Re-fetch details (which triggers TMDB enrichment on the backend)
            const searchRes = await fetch('/api/movies/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ query: movie.link })
            });
            const searchData = await searchRes.json();
            if (searchData && searchData.data) {
                const details = searchData.data;
                setLiveDetails(details);
                globalLiveDetailsCache.set(propMovie.link, details);
                // Remove from attempted so next open also benefits
                globalAttemptedUpdates.delete(propMovie.link);

                if (propMovie.id) {
                    await fetch(`/api/movies/${propMovie.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({
                            rating: details.rating,
                            tmdb_rating: details.tmdb_rating,
                            description: details.description,
                            genres: details.genres,
                            actors: details.actors,
                            director: details.director,
                            writers: details.writers,
                            country: details.country,
                            duration: details.duration,
                        })
                    });
                    if (onUpdate) onUpdate(propMovie.id, details);
                } else if (onUpdate) {
                    onUpdate(null, details);
                }
            }
        } catch (e) {
            console.error('TMDB refresh failed', e);
        } finally {
            setIsRefreshingTmdb(false);
        }
    };

    const handleRefreshData = async () => {
        if (isRefreshingData || !movie?.link) return;
        setIsRefreshingData(true);
        const token = localStorage.getItem('token');
        try {
            // First, trigger a refresh on the backend (re-scrapes HDRezka)
            await fetch('/api/admin/scraped-movies/refresh', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ links: [movie.link] })
            });

            // Now re-fetch the updated details to show in UI immediately
            const searchRes = await fetch('/api/movies/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ query: movie.link })
            });
            const searchData = await searchRes.json();
            if (searchData && searchData.data) {
                const details = searchData.data;
                setLiveDetails(details);
                globalLiveDetailsCache.set(propMovie.link, details);
                
                // If it's a library movie, update the DB
                if (propMovie.id) {
                    await fetch(`/api/movies/${propMovie.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({
                            title: details.title,
                            original_title: details.original_title,
                            year: details.year,
                            rating: details.rating,
                            description: details.description,
                            poster_url: details.poster_url,
                            genres: details.genres,
                            actors: details.actors,
                            director: details.director,
                            writers: details.writers,
                            country: details.country,
                            duration: details.duration,
                            type: details.type
                        })
                    });
                    if (onUpdate) onUpdate(propMovie.id, details);
                } else if (onUpdate) {
                    onUpdate(null, details);
                }
            }
        } catch (e) {
            console.error('Failed to refresh data', e);
            alert('Refresh failed: ' + e.message);
        } finally {
            setIsRefreshingData(false);
        }
    };


    const handleShare = async () => {
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        const shareId = movie.user_id ? movie.id : `c${movie.id}`;
        const shareUrl = `${baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl}/share/movie/${shareId}`;
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

    // Handle Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (isPosterZoomed) {
                    setIsPosterZoomed(false);
                } else if (cacheSearch) {
                    setCacheSearch(null);
                } else if (isTrailerModalOpen) {
                    setIsTrailerModalOpen(false);
                } else {
                    onClose();
                }
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose, isPosterZoomed, cacheSearch, isTrailerModalOpen]);

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
            if (ratingVal > 0 && localStatus !== 'watched') {
                updates.status = 'watched';
                setLocalStatus('watched');
                setShowWatchedPrompt(true);
                setActiveTab('reviews');
            }
            const url = movie.id ? `/api/movies/${movie.id}` : '/api/movies/history';
            const method = movie.id ? 'PATCH' : 'POST';
            const body = movie.id ? updates : { link: movie.link, user_rating: ratingVal || null, is_watched: ratingVal > 0 ? 1 : undefined };
            
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (res.ok) {
                if (onUpdate) onUpdate(movie.id || null, { ...updates, link: movie.link || movie.movie_link });
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
            if (localStatus !== 'watched') {
                updates.status = 'watched';
                setLocalStatus('watched');
                setShowWatchedPrompt(true);
            }
            const url = movie.id ? `/api/movies/${movie.id}` : '/api/movies/history';
            const method = movie.id ? 'PATCH' : 'POST';
            const body = movie.id ? updates : { link: movie.link, notes: notes.trim() === '' ? null : notes, notes_public: isPublic, is_watched: localStatus === 'watched' || updates.status === 'watched' ? 1 : undefined };

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (res.ok) {
                if (onUpdate) onUpdate(movie.id || null, { ...updates, link: movie.link || movie.movie_link });
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

    const [modalRipples, setModalRipples] = useState([]);

    const addModalRipple = (x, y, color) => {
        const id = Date.now() + Math.random();
        
        setModalRipples(prev => {
            if (prev.length > 0) {
                // Smooth color transition: Keep the existing ripple (same id, x, y) 
                // so the animation continues without restarting, but update the color.
                return [{ ...prev[0], color }];
            }
            // Start a new ripple
            return [{ id, x, y, color }];
        });
        
        setTimeout(() => {
            setModalRipples(prev => prev.filter(r => r.id !== id));
        }, 3200);
    };

    const handleStatusToggle = async (e) => {
        const newStatus = localStatus === 'watched' ? 'want_to_watch' : 'watched';
        
        if (e && e.clientX) {
            const container = e.currentTarget.closest('.glass-panel');
            if (container) {
                const rect = container.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const color = localStatus === 'watched' ? '255, 152, 0' : '3, 218, 198';
                addModalRipple(x, y, color);
            }
        }

        const previousStatus = localStatus;
        setLocalStatus(newStatus);
        try {
            const actualId = movie.id || libMovieId;
            if (onUpdate) {
                await onUpdate(actualId, { status: newStatus, link: movie.link || movie.movie_link });
            }
            if (onToggleWatched) {
                onToggleWatched(movie.link || movie.movie_link, newStatus);
            }
            if (newStatus === 'watched') {
                setActiveTab('reviews');
                setShowWatchedPrompt(true);
            } else {
                setShowWatchedPrompt(false);
            }
        } catch (err) {
            console.error(err);
            setLocalStatus(previousStatus);
        }
    };

    const renderHideButton = () => {
        if (!isMobile || isAdded || isTrashMode || readOnly) return null;
        return (
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    if (onHideMovie) onHideMovie(movie.link || movie.movie_link);
                    if (onClose) onClose();
                }}
                style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#fff',
                    padding: '8px',
                    fontSize: '1.2rem',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: '0 0 auto',
                    transition: 'all 0.2s'
                }}
                title="Hide from global search"
            >
                🚫
            </button>
        );
    };

    const renderLibraryButton = () => {
        const collBtn = onAddToCollection ? (
            <button
                onClick={(e) => { e.stopPropagation(); onAddToCollection(movie); }}
                style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#fff',
                    width: isMobile ? 'auto' : '46px',
                    height: isMobile ? 'auto' : '46px',
                    padding: isMobile ? '12px 14px' : '0',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.2rem',
                    transition: 'all 0.3s ease',
                    flexShrink: 0
                }}
                onMouseEnter={e => { if (!isMobile) { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'; e.currentTarget.style.transform = 'scale(1.05)'; } }}
                onMouseLeave={e => { if (!isMobile) { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'; e.currentTarget.style.transform = 'scale(1)'; } }}
                title="Add to Collection"
            >
                📁
            </button>
        ) : null;

        if (isAdded) {
            const showRemove = !isMobile && isLibraryBtnHovered;
            const btnText = isMobile ? '✓ Already in my Library' : (showRemove ? '🗑 Remove' : '✓ In My Library');
            
            const libraryBtn = (
                <button
                    onMouseEnter={() => setIsLibraryBtnHovered(true)}
                    onMouseLeave={() => setIsLibraryBtnHovered(false)}
                    onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const container = e.currentTarget.closest('.glass-panel');
                        if (container) {
                            const crect = container.getBoundingClientRect();
                            const x = rect.left + rect.width / 2 - crect.left;
                            const y = rect.top + rect.height / 2 - crect.top;
                            addModalRipple(x, y, '239, 68, 68'); // Red
                        }

                        const actualId = movie.id || libMovieId;
                        if (actualId && !isMobile) {
                            if (onDelete) {
                                onDelete(actualId, movie.link || movie.movie_link, false, true, false);
                            } else if (onRemoveMovie) {
                                onRemoveMovie(actualId, movie.link || movie.movie_link);
                            }
                            if (typeof onClose === 'function') {
                                onClose();
                            }
                        }
                    }}
                    style={{
                        background: isMobile ? 'rgba(3, 218, 198, 0.15)' : (showRemove ? 'rgba(239, 68, 68, 0.2)' : 'rgba(3, 218, 198, 0.1)'),
                        border: isMobile ? '1px solid #03dac6' : (showRemove ? '1px solid #ef4444' : '1px solid rgba(3, 218, 198, 0.2)'),
                        color: isMobile ? '#03dac6' : (showRemove ? '#ef4444' : '#03dac6'),
                        padding: isMobile ? '12px 10px' : '0 28px',
                        height: isMobile ? 'auto' : '46px',
                        fontSize: isMobile ? '0.85rem' : '0.95rem',
                        fontWeight: '700',
                        borderRadius: '12px',
                        cursor: isMobile ? 'default' : 'pointer',
                        boxShadow: 'none',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        width: isMobile ? '100%' : '180px',
                        flex: isMobile ? '1 1 auto' : '0 0 auto'
                    }}
                >
                    {btnText}
                </button>
            );

            if (isMobile) {
                return (
                    <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                        {libraryBtn}
                        {collBtn}
                        <button
                            onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const container = e.currentTarget.closest('.glass-panel');
                                if (container) {
                                    const crect = container.getBoundingClientRect();
                                    const x = rect.left + rect.width / 2 - crect.left;
                                    const y = rect.top + rect.height / 2 - crect.top;
                                    addModalRipple(x, y, '239, 68, 68'); // Red
                                }

                                const actualId = movie.id || libMovieId;
                                if (actualId) {
                                    if (onDelete) {
                                        onDelete(actualId, movie.link || movie.movie_link, false, true, false);
                                    } else if (onRemoveMovie) {
                                        onRemoveMovie(actualId, movie.link || movie.movie_link);
                                    }
                                    if (typeof onClose === 'function') {
                                        onClose();
                                    }
                                }
                            }}
                            style={{
                                background: 'rgba(239, 68, 68, 0.15)',
                                border: '1px solid rgba(239, 68, 68, 0.5)',
                                color: '#ef4444',
                                padding: '0 15px',
                                fontSize: '1.2rem',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}
                            title="Remove from Library"
                        >
                            🗑
                        </button>
                    </div>
                );
            }

            return (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {libraryBtn}
                    {collBtn}
                </div>
            );
        }

        const addBtn = (
            <button
                onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const container = e.currentTarget.closest('.glass-panel');
                    if (container) {
                        const crect = container.getBoundingClientRect();
                        const x = rect.left + rect.width / 2 - crect.left;
                        const y = rect.top + rect.height / 2 - crect.top;
                        addModalRipple(x, y, '168, 85, 247'); // Purple
                    }

                    if (onAddMovie) {
                        onAddMovie(movie.link || movie.movie_link);
                    }
                }}
                onMouseEnter={(e) => { if (!isMobile) { e.currentTarget.style.filter = 'brightness(1.15)'; e.currentTarget.style.transform = 'scale(1.02)'; } }}
                onMouseLeave={(e) => { if (!isMobile) { e.currentTarget.style.filter = 'brightness(1)'; e.currentTarget.style.transform = 'scale(1)'; } }}
                style={{
                    background: 'linear-gradient(135deg, #FFDF73 0%, #D4AF37 100%)',
                    border: 'none',
                    color: '#000',
                    padding: isMobile ? '12px 10px' : '0 28px',
                    height: isMobile ? 'auto' : '46px',
                    fontSize: isMobile ? '0.85rem' : '0.95rem',
                    fontWeight: '700',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(212, 175, 55, 0.25)',
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    width: isMobile ? '100%' : 'auto',
                    flex: isMobile ? '1 1 auto' : '0 0 auto',
                    filter: 'brightness(1)',
                    transform: 'scale(1)'
                }}
            >
                ➕ Add to Library
            </button>
        );

        return (
            <div style={{ display: 'flex', gap: '8px', width: isMobile ? '100%' : 'auto', alignItems: 'center' }}>
                {addBtn}
                {collBtn}
            </div>
        );
    };

    const handleTrailerClick = (e) => {
        e.stopPropagation();
        let typeStr = 'фильм';
        const isCartoon = movie.genres?.toLowerCase().includes('мульт') ||
                          movie.genres?.toLowerCase().includes('анимац') ||
                          movie.misc?.toLowerCase().includes('мульт') ||
                          movie.misc?.toLowerCase().includes('анимац') ||
                          movie.link?.includes('/cartoons/');
                                
        const isAnime = movie.genres?.toLowerCase().includes('аниме') ||
                        movie.misc?.toLowerCase().includes('аниме') ||
                        movie.link?.includes('/animation/');
        
        if (isAnime) {
            typeStr = 'аниме';
        } else if (isCartoon) {
            typeStr = 'мультфильм';
        } else if (movie.type === 'series') {
            typeStr = 'сериал';
        }
        
        const queryTokens = [typeStr, movie.title, movie.year, 'трейлер'].filter(Boolean);
        const query = queryTokens.join(' ');
        setTrailerSearchQuery(query);
        setIsTrailerModalOpen(true);
    };

    return ReactDOM.createPortal(
        <div
            onMouseDown={handleBackdropMouseDown}
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0, 0, 0, 0.85)',
                backdropFilter: 'blur(10px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 400000, padding: isMobile ? '12px' : '20px',
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
                <div style={{ 
                    position: 'absolute', 
                    top: 0, 
                    right: 0, 
                    padding: isMobile ? '12px' : '15px', 
                    display: 'flex', 
                    gap: '10px', 
                    alignItems: 'center', 
                    justifyContent: 'flex-end',
                    zIndex: 100,
                    pointerEvents: 'none'
                }}>
                    {!isMobile && onSelectToggle && (
                        <div 
                            onClick={onSelectToggle}
                            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.15)' }}
                            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px', 
                                cursor: 'pointer', 
                                background: isSelected ? 'rgba(212, 175, 55, 0.2)' : 'rgba(255,255,255,0.05)', 
                                border: isSelected ? '1px solid var(--accent-gold)' : '1px solid rgba(255,255,255,0.1)', 
                                padding: '0 12px', 
                                height: '32px',
                                boxSizing: 'border-box',
                                borderRadius: '4px', 
                                color: isSelected ? 'var(--accent-gold)' : '#fff', 
                                fontSize: '0.9rem', 
                                transition: 'all 0.2s',
                                userSelect: 'none',
                                fontWeight: '500',
                                pointerEvents: 'auto',
                                boxShadow: '0 6px 16px rgba(0,0,0,0.85), 0 2px 4px rgba(0,0,0,0.5)',
                                backdropFilter: 'blur(8px)',
                                WebkitBackdropFilter: 'blur(8px)'
                            }}
                        >
                            <div style={{
                                width: '14px', height: '14px', borderRadius: '3px',
                                background: isSelected ? 'var(--accent-gold)' : 'rgba(255,255,255,0.1)',
                                border: `1px solid ${isSelected ? 'var(--accent-gold)' : 'rgba(255,255,255,0.3)'}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '10px', color: '#000', fontWeight: 'bold',
                                transition: 'all 0.2s'
                            }}>
                                {isSelected ? '✓' : ''}
                            </div>
                            {isSelected ? 'Selected' : 'Select'}
                        </div>
                    )}
                    {!isMobile && (
                        <button
                            onClick={handleShare}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                            className="btn btn-ghost"
                            style={{ display: 'flex', alignItems: 'center', padding: '0 12px', height: '32px', boxSizing: 'border-box', fontSize: '0.9rem', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: copiedShare ? '#03dac6' : '#fff', pointerEvents: 'auto', transition: 'all 0.2s', boxShadow: '0 6px 16px rgba(0,0,0,0.85), 0 2px 4px rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
                        >
                            {copiedShare ? '✔ Copied' : '🔗 Share'}
                        </button>
                    )}
                    {!isMobile && (
                        <button
                            onClick={handleRefreshTmdb}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(1,180,228,0.15)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                            disabled={isRefreshingTmdb}
                            className="btn btn-ghost"
                            title="Обновить TMDB данные (рейтинг, описание, жанры)"
                            style={{ display: 'flex', alignItems: 'center', padding: '0 12px', height: '32px', boxSizing: 'border-box', fontSize: '0.9rem', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: isRefreshingTmdb ? '1px solid rgba(1,180,228,0.4)' : '1px solid rgba(255,255,255,0.08)', color: isRefreshingTmdb ? '#01b4e4' : '#fff', cursor: isRefreshingTmdb ? 'wait' : 'pointer', pointerEvents: 'auto', transition: 'all 0.2s', boxShadow: '0 6px 16px rgba(0,0,0,0.85), 0 2px 4px rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
                        >
                            {isRefreshingTmdb ? '⏳' : '🎬 TMDB'}
                        </button>
                    )}
                    {!isMobile && isAdmin && (
                        <button
                            onClick={handleRefreshData}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                            disabled={isRefreshingData}
                            className="btn btn-ghost"
                            title="Обновить данные фильма"
                            style={{ display: 'flex', alignItems: 'center', padding: '0 12px', height: '32px', boxSizing: 'border-box', fontSize: '0.9rem', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: isRefreshingData ? '#aaa' : '#fff', cursor: isRefreshingData ? 'wait' : 'pointer', pointerEvents: 'auto', transition: 'all 0.2s', boxShadow: '0 6px 16px rgba(0,0,0,0.85), 0 2px 4px rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
                        >
                            {isRefreshingData ? '⏳' : '🔄 Refresh'}
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
                            background: 'rgba(0, 0, 0, 0.45)',
                            border: '1px solid rgba(255, 255, 255, 0.25)',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 6px 16px rgba(0,0,0,0.85), 0 2px 4px rgba(0,0,0,0.5)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            pointerEvents: 'auto',
                            backdropFilter: 'blur(8px)',
                            WebkitBackdropFilter: 'blur(8px)'
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
                        overflow: 'hidden', 
                        position: 'relative',
                        display: 'flex', 
                        flexDirection: 'column',
                        borderRadius: isMobile ? '20px' : '24px',
                        border: '1px solid rgba(255, 255, 255, 0.15)'
                    }}
                >
                    {/* Modal Ripple Container */}
                    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 'inherit', pointerEvents: 'none', zIndex: 50 }}>
                        {modalRipples.map(ripple => (
                            <div 
                                key={ripple.id} 
                                style={{ 
                                    position: 'absolute', 
                                    inset: 0, 
                                    borderRadius: 'inherit', 
                                    color: `rgb(${ripple.color})`,
                                    transition: 'color 0.5s ease-out',
                                    '--ripple-x': `${ripple.x}px`, 
                                    '--ripple-y': `${ripple.y}px` 
                                }}
                            >
                                <div
                                    className="modal-watch-ripple"
                                    style={{
                                        left: ripple.x,
                                        top: ripple.y
                                    }}
                                />
                                <div className="modal-edge-glow" />
                            </div>
                        ))}
                    </div>

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

                            <button
                                onClick={handleTrailerClick}
                                style={{
                                    width: '100%',
                                    background: 'rgba(255, 255, 255, 0.1)',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    color: '#ccc',
                                    padding: '10px 15px',
                                    borderRadius: '10px',
                                    fontSize: '0.9rem',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    marginBottom: '20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    transition: 'all 0.2s ease',
                                    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
                                    animation: (Array.isArray(preloadedTrailers) && preloadedTrailers.length > 0) ? 'shimmerGold 1.5s ease-out 0.5s 1 forwards' : 'none'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(212, 175, 55, 0.15)';
                                    e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.4)';
                                    e.currentTarget.style.color = '#fff';
                                    e.currentTarget.style.transform = 'scale(1.02)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                                    e.currentTarget.style.color = '#ccc';
                                    e.currentTarget.style.transform = 'scale(1)';
                                }}
                            >
                                🎬 <MatrixText 
                                    targetWord={preloadedTrailers === null ? 'Искать' : 'Смотреть'} 
                                    isSearching={preloadedTrailers === null}
                                    skipAnimation={isTrailerCached}
                                /> трейлер
                            </button>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', fontSize: '0.9rem' }}>
                                {movie.director && (
                                    <div>
                                        <div style={{ color: '#666', marginBottom: '3px', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.5px' }}>Director</div>
                                        <div style={{ color: '#fff', lineHeight: '1.4' }}>
                                            {movie.director.split(',').map((d, idx) => {
                                                const trimmed = d.trim();
                                                if (!trimmed) return null;
                                                return (
                                                    <span 
                                                        key={idx}
                                                        onClick={() => handleCacheSearchClick('director', trimmed)}
                                                        style={{ cursor: 'pointer', color: 'var(--accent-gold)', textDecoration: 'underline', marginRight: '8px', display: 'inline-block' }}
                                                    >
                                                        {trimmed}
                                                    </span>
                                                );
                                            })}
                                        </div>
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
                                        <div style={{ color: '#fff', lineHeight: '1.4' }}>
                                            {movie.actors.split(',').map((a, idx) => {
                                                const trimmed = a.trim();
                                                if (!trimmed) return null;
                                                return (
                                                    <span 
                                                        key={idx}
                                                        onClick={() => handleCacheSearchClick('actor', trimmed)}
                                                        style={{
                                                            cursor: 'pointer',
                                                            color: '#eee',
                                                            background: 'rgba(255, 255, 255, 0.08)',
                                                            padding: '2px 6px',
                                                            borderRadius: '4px',
                                                            marginRight: '6px',
                                                            marginBottom: '6px',
                                                            display: 'inline-block',
                                                            transition: 'background 0.2s'
                                                        }}
                                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                                                    >
                                                        {trimmed}
                                                    </span>
                                                );
                                            })}
                                        </div>
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
                                <div style={{ flex: '0 0 100px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                                <button
                                    onClick={handleTrailerClick}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(255, 255, 255, 0.1)',
                                        border: '1px solid rgba(255, 255, 255, 0.2)',
                                        color: '#ccc',
                                        padding: '6px 0',
                                        borderRadius: '8px',
                                        fontSize: '0.75rem',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '4px',
                                        transition: 'all 0.2s ease',
                                        animation: (Array.isArray(preloadedTrailers) && preloadedTrailers.length > 0 && !isTrailerCached) ? 'shimmerGold 1.5s ease-out 1 forwards' : 'none'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'rgba(212, 175, 55, 0.15)';
                                        e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.4)';
                                        e.currentTarget.style.color = '#fff';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                                        e.currentTarget.style.color = '#ccc';
                                    }}
                                >
                                    🎬 Трейлер
                                </button>
                            </div>

                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px', paddingRight: '38px' }}>
                                    <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700, color: '#fff', lineHeight: 1.25 }}>{movie.title}</h2>
                                    {movie.original_title && (
                                        <div style={{ fontSize: '0.8rem', color: '#888', fontStyle: 'italic', margin: 0 }}>{movie.original_title}</div>
                                    )}
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginTop: '2px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            {movie.rating && movie.rating !== '—' ? (
                                                <span style={{
                                                    background: 'var(--accent-gold)', color: '#000',
                                                    padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.75rem',
                                                    display: 'flex', alignItems: 'center', gap: '3px', width: 'fit-content'
                                                }}>
                                                    ★ {movie.rating} <span style={{ fontSize: '0.55rem', opacity: 0.8, marginTop: '1px' }}>HD</span>
                                                </span>
                                            ) : (
                                                <span style={{
                                                    background: 'var(--accent-gold)', color: '#000',
                                                    padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.75rem', width: 'fit-content'
                                                }}>
                                                    ★ N/A
                                                </span>
                                            )}
                                            {movie.tmdb_rating && (
                                                <span style={{ fontSize: '0.65rem', color: '#888', marginLeft: '2px' }}>
                                                    ★ {movie.tmdb_rating} TMDB
                                                </span>
                                            )}
                                        </div>
                                        {movie.user_rating && (
                                            <span style={{
                                                background: 'rgba(3, 218, 198, 0.2)', color: '#03dac6',
                                                padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.75rem',
                                                border: '1px solid rgba(3, 218, 198, 0.3)'
                                            }}>
                                                👤 ★ {movie.user_rating}
                                            </span>
                                        )}
                                        <span onClick={() => handleCacheSearchClick('year', movie.year)} style={{ color: '#aaa', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}>{movie.year}</span>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
{movie.genres ? movie.genres.split(',').map((g, idx) => {
                                             const trimmed = g.trim();
                                             if (!trimmed) return null;
                                             return (
                                                 <span 
                                                     key={idx}
                                                     onClick={() => handleCacheSearchClick('genre', trimmed)}
                                                     style={{
                                                         color: 'var(--accent-gold)',
                                                         background: 'rgba(212, 175, 55, 0.1)',
                                                         padding: '1px 6px',
                                                         borderRadius: '4px',
                                                         cursor: 'pointer',
                                                         fontSize: '0.72rem',
                                                         fontWeight: 500
                                                     }}
                                                 >
                                                     {trimmed}
                                                 </span>
                                             );
                                         }) : null}
                                    </div>

                                    {/* Mobile inline Select & Share Actions Row */}
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                        {onSelectToggle && (
                                            <div 
                                                onClick={onSelectToggle}
                                                style={{ 
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
                                                }}
                                            >
                                                <div style={{
                                                    width: '12px', height: '12px', borderRadius: '3px',
                                                    background: isSelected ? 'var(--accent-gold)' : 'rgba(255,255,255,0.1)',
                                                    border: `1px solid ${isSelected ? 'var(--accent-gold)' : 'rgba(255,255,255,0.3)'}`,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '9px', color: '#000', fontWeight: 'bold',
                                                    transition: 'all 0.2s'
                                                }}>
                                                    {isSelected ? '✓' : ''}
                                                </div>
                                                {isSelected ? 'Selected' : 'Select'}
                                            </div>
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
                                        {isAdmin && (
                                            <button
                                                onClick={handleRefreshData}
                                                disabled={isRefreshingData}
                                                className="btn"
                                                style={{ 
                                                    padding: '5px 10px', 
                                                    fontSize: '0.78rem', 
                                                    borderRadius: '6px', 
                                                    background: 'rgba(255,255,255,0.04)', 
                                                    border: '1px solid rgba(255,255,255,0.08)',
                                                    color: isRefreshingData ? '#aaa' : '#fff',
                                                    fontWeight: '600',
                                                    cursor: isRefreshingData ? 'wait' : 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}
                                            >
                                                {isRefreshingData ? '⏳' : '🔄 Refresh'}
                                            </button>
                                        )}
                                        <button
                                            onClick={handleRefreshTmdb}
                                            disabled={isRefreshingTmdb}
                                            className="btn"
                                            title="Обновить TMDB данные"
                                            style={{ 
                                                padding: '5px 10px', 
                                                fontSize: '0.78rem', 
                                                borderRadius: '6px', 
                                                background: 'rgba(255,255,255,0.04)', 
                                                border: isRefreshingTmdb ? '1px solid rgba(1,180,228,0.4)' : '1px solid rgba(255,255,255,0.08)',
                                                color: isRefreshingTmdb ? '#01b4e4' : '#fff',
                                                fontWeight: '600',
                                                cursor: isRefreshingTmdb ? 'wait' : 'pointer',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}
                                        >
                                            {isRefreshingTmdb ? '⏳' : '🎬 TMDB'}
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
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', justifyContent: 'center' }}>
                                        {movie.rating && movie.rating !== '—' ? (
                                            <span style={{
                                                background: 'var(--accent-gold)', color: '#000',
                                                padding: '4px 12px', borderRadius: '4px', fontWeight: 'bold',
                                                display: 'flex', alignItems: 'center', gap: '4px', width: 'fit-content'
                                            }}>
                                                ★ {movie.rating} <span style={{ fontSize: '0.7rem', opacity: 0.8, marginTop: '1px' }}>HD</span>
                                            </span>
                                        ) : (
                                            <span style={{
                                                background: 'var(--accent-gold)', color: '#000',
                                                padding: '4px 12px', borderRadius: '4px', fontWeight: 'bold', width: 'fit-content'
                                            }}>
                                                ★ N/A
                                            </span>
                                        )}
                                        {movie.tmdb_rating && (
                                            <span style={{ fontSize: '0.75rem', color: '#888', marginLeft: '2px' }}>
                                                ★ {movie.tmdb_rating} TMDB
                                            </span>
                                        )}
                                    </div>
                                    {movie.user_rating && (
                                        <span style={{
                                            background: 'rgba(3, 218, 198, 0.2)', color: '#03dac6',
                                            padding: '4px 12px', borderRadius: '4px', fontWeight: 'bold',
                                            border: '1px solid rgba(3, 218, 198, 0.4)'
                                        }}>
                                            👤 My rating: ★ {movie.user_rating}
                                        </span>
                                    )}
                                    <span 
                                        onClick={() => handleCacheSearchClick('year', movie.year)}
                                        style={{ color: '#aaa', cursor: 'pointer', textDecoration: 'underline' }}
                                    >
                                        {movie.year}
                                    </span>
                                    <div style={{ width: '1px', height: '15px', background: '#444' }}></div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                                        {movie.genres ? movie.genres.split(',').map((g, idx) => {
                                            const trimmed = g.trim();
                                            if (!trimmed) return null;
                                            return (
                                                <span 
                                                    key={idx}
                                                    onClick={() => handleCacheSearchClick('genre', trimmed)}
                                                    style={{
                                                        color: 'var(--accent-gold)',
                                                        background: 'rgba(212, 175, 55, 0.1)',
                                                        padding: '2px 8px',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        fontSize: '0.9rem',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(212, 175, 55, 0.2)'}
                                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(212, 175, 55, 0.1)'}
                                                >
                                                    {trimmed}
                                                </span>
                                            );
                                        }) : null}
                                    </div>
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
                                    {isLoadingDetails && (
                                        <div style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            padding: '30px 20px',
                                            gap: '12px',
                                            color: '#aaa',
                                            background: 'rgba(255,255,255,0.02)',
                                            borderRadius: '12px',
                                            border: '1px solid rgba(255,255,255,0.05)',
                                            marginBottom: '20px'
                                        }}>
                                            <div style={{
                                                border: '3px solid rgba(255,255,255,0.1)',
                                                borderTop: '3px solid var(--accent-gold)',
                                                borderRadius: '50%',
                                                width: '28px',
                                                height: '28px',
                                                animation: 'spin 1s linear infinite'
                                            }} />
                                            <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>Fetching rich movie details...</span>
                                        </div>
                                    )}

                                    {!movie.id && !isLoadingDetails && (!movie.description || movie.description.trim() === '') && (
                                        <div style={{
                                            background: 'rgba(212, 175, 55, 0.1)',
                                            border: '1px solid rgba(212, 175, 55, 0.3)',
                                            color: 'var(--accent-gold)',
                                            padding: '12px 16px',
                                            borderRadius: '8px',
                                            marginBottom: '20px',
                                            fontSize: '0.9rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px'
                                        }}>
                                            <span style={{ fontSize: '1.2rem' }}>ℹ️</span>
                                            <span>
                                                Detailed information (actors, directors, rating and other data) will be available after adding to your library.
                                            </span>
                                        </div>
                                    )}

                                    <h4 style={{ color: '#fff', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.85rem' }}>Synopsis</h4>
                                    <p style={{ color: '#ccc', lineHeight: '1.65', fontSize: isMobile ? '0.92rem' : '1.05rem', margin: 0, textAlign: 'justify' }}>{movie.description || 'No synopsis available.'}</p>

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
                                                        {movie.director.split(',').map((d, idx) => {
                                                            const trimmed = d.trim();
                                                            if (!trimmed) return null;
                                                            return (
                                                                <span 
                                                                    key={idx}
                                                                    onClick={() => handleCacheSearchClick('director', trimmed)}
                                                                    style={{ cursor: 'pointer', color: 'var(--accent-gold)', textDecoration: 'underline', marginRight: '8px' }}
                                                                >
                                                                    {trimmed}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                                {movie.writers && (
                                                    <div>
                                                        <span style={{ color: '#888', fontWeight: 600 }}>Writers: </span>
                                                        <span style={{ color: '#fff' }}>{movie.writers}</span>
                                                    </div>
                                                )}
                                                {movie.actors && (
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px' }}>
                                                        <span style={{ color: '#888', fontWeight: 600, marginRight: '4px' }}>Starring: </span>
                                                        {movie.actors.split(',').map((a, idx) => {
                                                            const trimmed = a.trim();
                                                            if (!trimmed) return null;
                                                            return (
                                                                <span 
                                                                    key={idx}
                                                                    onClick={() => handleCacheSearchClick('actor', trimmed)}
                                                                    style={{
                                                                        cursor: 'pointer',
                                                                        color: '#eee',
                                                                        background: 'rgba(255, 255, 255, 0.08)',
                                                                        padding: '2px 6px',
                                                                        borderRadius: '4px',
                                                                        fontSize: '0.78rem'
                                                                    }}
                                                                >
                                                                    {trimmed}
                                                                </span>
                                                            );
                                                        })}
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
                                    {!readOnly && !isTrashMode && (
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateRows: showWatchedPrompt ? '1fr' : '0fr',
                                            opacity: showWatchedPrompt ? 1 : 0,
                                            marginBottom: showWatchedPrompt ? '0px' : '-20px',
                                            pointerEvents: showWatchedPrompt ? 'auto' : 'none',
                                            transition: 'all 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)',
                                        }}>
                                            <div style={{ overflow: 'hidden' }}>
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
                                            </div>
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
                    flexDirection: isMobile ? 'column' : 'row',
                    gap: '8px', 
                    flexWrap: 'nowrap', 
                    paddingTop: '12px', 
                    paddingBottom: isMobile ? '16px' : '15px',
                    paddingLeft: isMobile ? '12px' : '40px',
                    paddingRight: isMobile ? '12px' : '40px',
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
                    {/* ─── DESKTOP: left placeholder with library button ─── */}
                    {!isMobile && (
                        <div style={{ flex: '0 0 270px', display: 'flex', alignItems: 'center' }}>
                            {(!isTrashMode || readOnly) && renderLibraryButton()}
                        </div>
                    )}

                    {/* ─── MOBILE two-row layout ─── */}
                    {isMobile && !isTrashMode && !readOnly && (
                        <>
                            {/* Row 1: Library button + Hide button */}
                            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                                {/* Library / Remove button (full width minus the hide btn) */}
                                <div style={{ flex: 1 }}>
                                    {renderLibraryButton()}
                                </div>
                                {/* 🚫 Hide button — only for global (non-library) movies */}
                                {!isAdded && onHideMovie && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (onHideMovie) onHideMovie(movie.link || movie.movie_link);
                                            if (onClose) onClose();
                                        }}
                                        style={{
                                            background: 'rgba(255,255,255,0.1)',
                                            border: '1px solid rgba(255,255,255,0.2)',
                                            color: '#fff',
                                            width: '52px',
                                            height: '52px',
                                            fontSize: '1.3rem',
                                            borderRadius: '12px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                            transition: 'all 0.2s'
                                        }}
                                        title="Hide from global search"
                                    >
                                        🚫
                                    </button>
                                )}
                            </div>

                            {/* Row 2: Mark Watched + Watch on HDRezka + optional delete */}
                            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                                {/* Mark Watched button */}
                                <button
                                    style={{
                                        flex: 1,
                                        background: localStatus === 'watched' ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, #FFDF73 0%, #D4AF37 100%)',
                                        border: localStatus === 'watched' ? '1px solid rgba(255,255,255,0.12)' : 'none',
                                        color: localStatus === 'watched' ? '#fff' : '#000',
                                        padding: '12px 8px',
                                        fontSize: '0.85rem',
                                        fontWeight: '700',
                                        borderRadius: '12px',
                                        cursor: 'pointer',
                                        boxShadow: localStatus === 'watched' ? 'none' : '0 4px 15px rgba(212, 175, 55, 0.25)',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                    }}
                                    onClick={handleStatusToggle}
                                >
                                    <span style={{ fontSize: '1.1rem' }}>{localStatus === 'watched' ? '⚪' : '⭐'}</span>
                                    <span>{localStatus === 'watched' ? 'Mark Unwatched' : 'Mark Watched'}</span>
                                </button>

                                {/* Watch on HDRezka button */}
                                <a
                                    href={movie.link}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                        flex: 1,
                                        background: 'rgba(255,255,255,0.06)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        color: '#fff',
                                        padding: '12px 8px',
                                        fontSize: '0.85rem',
                                        fontWeight: '600',
                                        borderRadius: '12px',
                                        textDecoration: 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    <span style={{ fontSize: '1.1rem' }}>🌐</span>
                                    <span>Watch on HDRezka</span>
                                </a>


                            </div>
                        </>
                    )}

                    {/* ─── MOBILE readOnly layout ─── */}
                    {isMobile && readOnly && (
                        <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                            <div style={{ flex: 1 }}>
                                {renderLibraryButton()}
                            </div>
                            <a
                                href={movie.link}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                    flex: 1,
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    color: '#fff',
                                    padding: '12px 8px',
                                    fontSize: '0.85rem',
                                    fontWeight: '600',
                                    borderRadius: '12px',
                                    textDecoration: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    transition: 'all 0.2s',
                                }}
                            >
                                🌐 Watch on HDRezka
                            </a>
                        </div>
                    )}

                    {/* ─── MOBILE trash mode ─── */}
                    {isMobile && isTrashMode && (
                        <button
                            onClick={() => { onDelete(movie.id); onClose(); }}
                            style={{
                                width: '100%',
                                background: 'rgba(239, 68, 68, 0.9)',
                                border: 'none',
                                color: '#fff',
                                padding: '14px 16px',
                                fontSize: '0.95rem',
                                fontWeight: '700',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                            }}
                        >
                            Delete Permanently 🗑️
                        </button>
                    )}

                    {/* ─── DESKTOP content (right side of left placeholder) ─── */}
                    {!isMobile && readOnly && (
                                <>
                                    <a
                                        href={movie.link}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{
                                            background: 'rgba(255,255,255,0.03)',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            color: '#fff',
                                            padding: '12px 28px',
                                            fontSize: '0.95rem',
                                            fontWeight: '600',
                                            borderRadius: '10px',
                                            textDecoration: 'none',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'all 0.2s',
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                    >
                                        🎬 Watch on HDRezka
                                    </a>
                                </>
                            )}
                    {!isMobile && !isTrashMode && !readOnly && (
                                <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
                                    <button
                                        style={{
                                            background: localStatus === 'watched' ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, #FFDF73 0%, #D4AF37 100%)',
                                            border: localStatus === 'watched' ? '1px solid rgba(255,255,255,0.12)' : 'none',
                                            color: localStatus === 'watched' ? '#fff' : '#000',
                                            padding: '0 24px',
                                            fontSize: '0.95rem',
                                            fontWeight: '700',
                                            borderRadius: '10px',
                                            cursor: 'pointer',
                                            boxShadow: localStatus === 'watched' ? 'none' : '0 4px 15px rgba(212, 175, 55, 0.25)',
                                            transition: 'all 0.3s ease',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px',
                                            height: '46px',
                                            overflow: 'hidden',
                                            whiteSpace: 'nowrap',
                                            flex: 1,
                                            filter: 'brightness(1)'
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.15)'; e.currentTarget.style.transform = 'scale(1.02)'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.filter = 'brightness(1)'; e.currentTarget.style.transform = 'scale(1)'; }}
                                        onClick={handleStatusToggle}
                                        title={localStatus === 'watched' ? 'Mark Unwatched' : 'Mark Watched'}
                                    >
                                        <span style={{ fontSize: '1.1rem' }}>{localStatus === 'watched' ? '⚪' : '⭐'}</span>
                                        <span style={{ whiteSpace: 'nowrap' }}>
                                            {localStatus === 'watched' ? 'Mark Unwatched' : 'Mark Watched'}
                                        </span>
                                    </button>
                                    <a
                                        href={movie.link}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{
                                            background: 'rgba(255,255,255,0.03)',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            color: '#fff',
                                            padding: '0 24px',
                                            fontSize: '0.95rem',
                                            fontWeight: '600',
                                            borderRadius: '10px',
                                            cursor: 'pointer',
                                            transition: 'all 0.3s ease',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px',
                                            textDecoration: 'none',
                                            height: '46px',
                                            overflow: 'hidden',
                                            whiteSpace: 'nowrap',
                                            flex: 1,
                                            transform: 'scale(1)'
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.transform = 'scale(1.02)'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.transform = 'scale(1)'; }}
                                        title="Watch on HDRezka"
                                    >
                                        <span style={{ fontSize: '1.1rem' }}>🌐</span>
                                        <span style={{ whiteSpace: 'nowrap' }}>
                                            Watch on HDRezka
                                        </span>
                                    </a>

                                    {onHideMovie && (
                                        <button
                                            onMouseEnter={() => setIsHideBtnHovered(true)}
                                            onMouseLeave={() => setIsHideBtnHovered(false)}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onHideMovie(movie.link || movie.movie_link);
                                                onClose();
                                            }}
                                            style={{
                                                background: isHideBtnHovered ? 'rgba(255, 152, 0, 0.2)' : 'rgba(255,255,255,0.05)',
                                                border: isHideBtnHovered ? '1px solid #ff9800' : '1px solid rgba(255,255,255,0.15)',
                                                color: isHideBtnHovered ? '#ff9800' : '#fff',
                                                padding: isHideBtnHovered ? '0 16px' : '0',
                                                fontSize: '0.95rem',
                                                fontWeight: '600',
                                                borderRadius: '10px',
                                                cursor: 'pointer',
                                                transition: 'all 0.3s ease',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: isHideBtnHovered ? '8px' : '0',
                                                flex: '0 0 auto',
                                                width: isHideBtnHovered ? '130px' : '46px',
                                                height: '46px',
                                                overflow: 'hidden',
                                                whiteSpace: 'nowrap'
                                            }}
                                            title="Hide from global search"
                                        >
                                            <span style={{ fontSize: '1.1rem' }}>🚫</span>
                                            <span style={{ 
                                                opacity: isHideBtnHovered ? 1 : 0, 
                                                width: isHideBtnHovered ? 'auto' : 0,
                                                transition: 'opacity 0.3s ease', 
                                                pointerEvents: 'none' 
                                            }}>
                                                Hide film
                                            </span>
                                        </button>
                                    )}
                                </div>
                            )}
                    {!isMobile && isTrashMode && (
                                <button
                                    onClick={() => { onDelete(movie.id); onClose(); }}
                                    style={{
                                        background: 'rgba(239, 68, 68, 0.9)',
                                        border: 'none',
                                        color: '#fff',
                                        padding: '12px 28px',
                                        fontSize: '0.95rem',
                                        fontWeight: '700',
                                        borderRadius: '10px',
                                        cursor: 'pointer',
                                        boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                                        transition: 'all 0.2s',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
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

            {/* Global Cache Search Sub-Modal */}
            {cacheSearch && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0, 0, 0, 0.85)',
                        backdropFilter: 'blur(8px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 13000,
                        animation: 'fadeIn 0.2s ease-out'
                    }}
                >
                    <div
                        style={{
                            width: '90%',
                            maxWidth: '650px',
                            maxHeight: '80vh',
                            background: 'rgba(22, 22, 22, 0.95)',
                            backdropFilter: 'blur(20px)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '16px',
                            boxShadow: '0 24px 60px rgba(0,0,0,0.8), 0 0 30px rgba(212,175,55,0.05)',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            animation: 'scaleIn 0.25s cubic-bezier(0.165, 0.84, 0.44, 1)'
                        }}
                    >
                        {/* Sub-modal Header */}
                        <div style={{
                            padding: '16px 20px',
                            borderBottom: '1px solid rgba(255,255,255,0.06)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: 'rgba(255,255,255,0.01)'
                        }}>
                            <div>
                                <h3 style={{ margin: 0, color: '#fff', fontSize: '1.15rem', fontWeight: 700 }}>
                                    🔍 Global Cache Search
                                </h3>
                                <div style={{ fontSize: '0.82rem', color: '#888', marginTop: '2px' }}>
                                    Matching movies for {cacheSearch.type}: <span style={{ color: 'var(--accent-gold)', fontWeight: 600 }}>{cacheSearch.value}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setCacheSearch(null)}
                                style={{
                                    background: 'rgba(255,255,255,0.04)',
                                    border: 'none',
                                    color: '#aaa',
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1rem',
                                    fontWeight: 'bold',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#aaa'; }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Sub-modal Content */}
                        <div style={{
                            flex: 1,
                            overflowY: 'auto',
                            padding: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '15px'
                        }}>
                            {cacheSearch.loading ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: '15px' }}>
                                    <div style={{
                                        width: '40px',
                                        height: '40px',
                                        border: '3px solid rgba(212, 175, 55, 0.1)',
                                        borderTop: '3px solid var(--accent-gold)',
                                        borderRadius: '50%',
                                        animation: 'spin 1s linear infinite'
                                    }}></div>
                                    <span style={{ color: '#aaa', fontSize: '0.9rem' }}>Searching cache database...</span>
                                </div>
                            ) : cacheSearch.error ? (
                                <div style={{ color: 'var(--danger)', textAlign: 'center', padding: '20px' }}>
                                    ⚠️ {cacheSearch.error}
                                </div>
                            ) : cacheSearch.movies.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666' }}>
                                    <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🎬</div>
                                    <div>No other movies found in global cache for this search.</div>
                                </div>
                            ) : (
                                cacheSearch.movies.map((item, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => window.open('?movie=c' + item.id, '_blank')}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)';
                                            e.currentTarget.style.transform = 'translateY(0)';
                                        }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '15px',
                                            padding: '12px',
                                            background: 'rgba(255,255,255,0.02)',
                                            border: '1px solid rgba(255,255,255,0.04)',
                                            borderRadius: '10px',
                                            cursor: 'pointer',
                                            transition: 'transform 0.2s, background-color 0.2s'
                                        }}
                                    >
                                        {/* Poster */}
                                        <img
                                            src={item.poster_url || '/placeholder-poster.png'}
                                            alt={item.title}
                                            style={{
                                                width: '50px',
                                                height: '75px',
                                                borderRadius: '6px',
                                                objectFit: 'cover',
                                                background: '#111',
                                                border: '1px solid rgba(255,255,255,0.08)'
                                            }}
                                            onError={e => { e.target.src = 'https://placehold.co/100x150/111/aaa?text=No+Poster'; }}
                                        />

                                        {/* Info */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <h4 style={{ margin: 0, color: '#fff', fontSize: '0.95rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {item.title}
                                            </h4>
                                            {item.original_title && (
                                                <div style={{ color: '#888', fontSize: '0.78rem', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {item.original_title}
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px', fontSize: '0.75rem', flexWrap: 'wrap' }}>
                                                <span style={{ color: '#aaa' }}>{item.year}</span>
                                                <span style={{ color: '#555' }}>|</span>
                                                <span style={{ color: 'var(--accent-gold)' }}>★ {item.rating || 'N/A'}</span>
                                                <span style={{ color: '#555' }}>|</span>
                                                <span style={{ color: '#aaa', maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.genres}>
                                                    {item.genres}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div>
                                            {addedLinks.has(item.link) ? (
                                                <span style={{
                                                    fontSize: '0.82rem',
                                                    color: '#03dac6',
                                                    background: 'rgba(3, 218, 198, 0.1)',
                                                    padding: '6px 12px',
                                                    borderRadius: '6px',
                                                    border: '1px solid rgba(3, 218, 198, 0.2)',
                                                    fontWeight: '600'
                                                }}>
                                                    ✓ In My Library
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleAddMovieFromCache(item.link);
                                                    }}
                                                    disabled={addingLinks.has(item.link)}
                                                    style={{
                                                        background: 'linear-gradient(135deg, #FFDF73 0%, #D4AF37 100%)',
                                                        border: 'none',
                                                        color: '#000',
                                                        padding: '6px 12px',
                                                        fontSize: '0.82rem',
                                                        fontWeight: '700',
                                                        borderRadius: '6px',
                                                        cursor: addingLinks.has(item.link) ? 'not-allowed' : 'pointer',
                                                        boxShadow: '0 2px 8px rgba(212, 175, 55, 0.2)',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onMouseEnter={e => { if (!addingLinks.has(item.link)) e.currentTarget.style.transform = 'scale(1.03)'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                                                >
                                                    {addingLinks.has(item.link) ? '⏳ Adding...' : '➕ Add to Library'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Sub-modal Footer */}
                        <div style={{
                            padding: '12px 20px',
                            borderTop: '1px solid rgba(255,255,255,0.06)',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            background: 'rgba(255,255,255,0.01)'
                        }}>
                            <button
                                onClick={() => setCacheSearch(null)}
                                style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    color: '#fff',
                                    padding: '6px 16px',
                                    fontSize: '0.85rem',
                                    fontWeight: '600',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {isTrailerModalOpen && (
                <TrailerModal 
                    searchQuery={trailerSearchQuery}
                    preloadedTrailers={preloadedTrailers}
                    onClose={(e) => {
                        if (e) e.stopPropagation();
                        setIsTrailerModalOpen(false);
                    }}
                />
            )}

            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes scaleIn { from { transform: scale(0.9) translateY(20px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
                @keyframes slideIn { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                @keyframes shimmerGold { 0% { box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2); background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.2); color: #ccc; } 30% { box-shadow: 0 0 30px rgba(212, 175, 55, 0.8); background: rgba(212, 175, 55, 0.3); border-color: rgba(212, 175, 55, 1); color: #fff; text-shadow: 0 0 10px rgba(255,255,255,0.5); } 100% { box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2); background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.2); color: #ccc; } }
            `}</style>
        </div>,
        document.body
    );
}

export default MovieDetailsModal;
