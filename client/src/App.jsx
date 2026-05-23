import { useState, useEffect, useRef, useMemo } from 'react';
import './App.css';
import AddMovie from './components/AddMovie';
import MovieGrid from './components/MovieGrid';
import BulkActionBar from './components/BulkActionBar';
import ConfirmModal from './components/ConfirmModal';
import AddToCollectionModal from './components/AddToCollectionModal';
import CollectionsView from './components/CollectionsView';
import SharedCollectionView from './components/SharedCollectionView';
import AuthScreen from './components/AuthScreen';
import AdminDashboard from './components/AdminDashboard';
import MovieDetailsModal from './components/MovieDetailsModal';
import MovieComparisonModal from './components/MovieComparisonModal';

// Smoothly animates a numeric value to avoid jarring jumps on each poll update
function useSmoothCount(targetValue, duration = 3750) {
    const [displayValue, setDisplayValue] = useState(targetValue);
    const animRef = useRef(null);
    const prevValueRef = useRef(targetValue);

    useEffect(() => {
        const end = parseInt(targetValue, 10);
        if (isNaN(end)) return;

        // Snap immediately if decreasing (shouldn't happen, but just in case)
        if (end <= prevValueRef.current) {
            prevValueRef.current = end;
            setDisplayValue(end);
            return;
        }

        const startValue = prevValueRef.current;
        prevValueRef.current = end;

        if (animRef.current) cancelAnimationFrame(animRef.current);

        const currentDuration = startValue === 0 ? 2000 : duration;

        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / currentDuration, 1);
            const easeProgress = progress * (2 - progress); // Add slight easing for initial load
            setDisplayValue(Math.floor(startValue + (end - startValue) * easeProgress));
            if (progress < 1) {
                animRef.current = requestAnimationFrame(step);
            } else {
                setDisplayValue(end);
            }
        };
        animRef.current = requestAnimationFrame(step);

        return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
    }, [targetValue, duration]);

    return displayValue;
}

const cleanLinkPath = (url) => {
    if (!url) return '';
    return url.toLowerCase()
        .replace(/^https?:\/\/[^/]+/, '')
        .replace(/^\/+|\/+$/g, '')
        .split('?')[0]
        .split('#')[0];
};

function App() {
    const [movies, setMovies] = useState([]);
    const [historyList, setHistoryList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [checkingAuth, setCheckingAuth] = useState(true);
    const getInitialView = () => {
        const hash = window.location.hash;
        if (hash.startsWith('#collections')) return 'collections';
        if (hash === '#trash') return 'trash';
        if (hash === '#admin') return 'admin';
        if (hash === '#watched') return 'watched';
        if (hash === '#library') return 'library';
        return 'library';
    };

    const [currentView, setCurrentView] = useState(getInitialView); // 'library' | 'trash' | 'collections' | 'shared_collection' | 'admin' | 'watched'
    const [selectedIds, setSelectedIds] = useState([]);
    const [selectionAnchor, setSelectionAnchor] = useState(null);
    const [deletingIds, setDeletingIds] = useState([]); // Track items being deleted for animation
    const trashButtonRef = useRef(null);
    const [highlightedMovieLink, setHighlightedMovieLink] = useState(null);
    const [headerScrolled, setHeaderScrolled] = useState(false);

    // Guest Experience Tooltips and Modal States
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [showGuestTooltip, setShowGuestTooltip] = useState(false);
    const [guestTooltipText, setGuestTooltipText] = useState('');
    const [activityCount, setActivityCount] = useState(0);

    const [globalCacheCount, setGlobalCacheCount] = useState(0);
    const [fcDelay, setFcDelay] = useState(5000);
    const smoothCacheCount = useSmoothCount(globalCacheCount, Math.max(100, fcDelay * 0.75));
    const [latestScrapedMovie, setLatestScrapedMovie] = useState(null);
    const [popupMovie, setPopupMovie] = useState(null);     // what's displayed in the popup
    const [popupMode, setPopupMode] = useState('crawler');  // 'crawler' | 'random' | 'top'
    const [showScrapePopup, setShowScrapePopup] = useState(false);
    const [scrapedDetailsMovie, setScrapedDetailsMovie] = useState(null);
    const [isHoveringBadge, setIsHoveringBadge] = useState(false);
    const [guestLimitReached, setGuestLimitReached] = useState(false);

    const scrapePopupTimer = useRef(null);
    const showcaseCounter = useRef(0); // counts showcase fires to trigger 'top' every 4th

    useEffect(() => {
        if (!user) return;
        const fetchStats = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) return;
                const res = await fetch(`/api/cache/stats?t=${Date.now()}`, {
                    headers: { 
                        'Authorization': `Bearer ${token}`,
                        'Cache-Control': 'no-cache'
                    }
                });
                if (res.ok) {
                    const data = await res.json();
                    setGlobalCacheCount(data.totalCached);
                    if (data.fastCrawler && data.fastCrawler.delay) {
                        setFcDelay(data.fastCrawler.delay);
                    }
                    if (data.lastScraped) {
                        setLatestScrapedMovie(prev => {
                            if (prev && prev.id !== data.lastScraped.id) {
                                // New movie fully scraped by crawler — show crawler popup
                                setPopupMovie(data.lastScraped);
                                setPopupMode('crawler');
                                setShowScrapePopup(true);
                                if (scrapePopupTimer.current) clearTimeout(scrapePopupTimer.current);
                                scrapePopupTimer.current = setTimeout(() => setShowScrapePopup(false), 5000);
                            } else if (!prev) {
                                // First load — silently set popupMovie for hover display
                                setPopupMovie(data.lastScraped);
                                setPopupMode('crawler');
                            }
                            return data.lastScraped;
                        });
                    }
                }
            } catch (err) {
                console.error('Failed to fetch cache stats:', err);
            }
        };

        // 30-second showcase: every 4th fires top-rated, others fire random
        const fetchRandomShowcase = async () => {
            if (showScrapePopup) return; // crawler popup visible — skip
            try {
                const token = localStorage.getItem('token');
                if (!token) return;

                showcaseCounter.current += 1;
                const isTopRatedTurn = (showcaseCounter.current % 4 === 0);

                const url = isTopRatedTurn
                    ? `/api/cache/top?t=${Date.now()}`
                    : `/api/cache/random?minRating=6&t=${Date.now()}`;

                const res = await fetch(url, {
                    headers: { 'Authorization': `Bearer ${token}`, 'Cache-Control': 'no-cache' }
                });
                if (res.ok) {
                    const movie = await res.json();
                    if (movie) {
                        setPopupMovie(movie);
                        setPopupMode(isTopRatedTurn ? 'top' : 'random');
                        setShowScrapePopup(true);
                        if (scrapePopupTimer.current) clearTimeout(scrapePopupTimer.current);
                        scrapePopupTimer.current = setTimeout(() => setShowScrapePopup(false), 5000);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch showcase movie:', err);
            }
        };

        fetchStats();
        const statsInterval = setInterval(fetchStats, 5000);
        const showcaseInterval = setInterval(fetchRandomShowcase, 30000);

        return () => {
            clearInterval(statsInterval);
            clearInterval(showcaseInterval);
            if (scrapePopupTimer.current) clearTimeout(scrapePopupTimer.current);
        };
    }, [user]);

    useEffect(() => {
        let isTouching = false;
        let scrollTimeout;

        const handleTouchStart = () => { isTouching = true; };
        const handleTouchEnd = () => { 
            isTouching = false; 
            checkSnap();
        };

        const checkSnap = () => {
            if (window.innerWidth > 768) return;
            // Snap to either 0 or 48 based on scroll position when user lifts finger
            if (!isTouching && window.scrollY > 0 && window.scrollY < 48) {
                if (window.scrollY > 24) {
                    window.scrollTo({ top: 48, behavior: 'smooth' });
                } else {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }
        };

        const headerEl = document.querySelector('.app-header');
        const setH = () => {
            if (headerEl) {
                document.documentElement.style.setProperty(
                    '--header-h', headerEl.offsetHeight + 'px'
                );
            }
        };

        const updateLayout = () => {
            const scrollY = window.scrollY;
            // Calculate a 0-to-1 scroll progress tied exactly to scroll
            const progress = Math.min(1, Math.max(0, scrollY / 48));
            document.documentElement.style.setProperty('--sp', progress);
            
            setHeaderScrolled(scrollY > 48);
            
            // Set immediately for pre-transition height
            requestAnimationFrame(setH);
            // Set again after transition finishes (~410ms) for post-transition height
            setTimeout(setH, 410);

            // Trigger snap check a moment after scrolling stops (for mousewheel/trackpad)
            if (window.innerWidth <= 768 && !isTouching) {
                clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(checkSnap, 150);
            }
        };

        updateLayout();
        window.addEventListener('touchstart', handleTouchStart, { passive: true });
        window.addEventListener('touchend', handleTouchEnd, { passive: true });
        window.addEventListener('scroll', updateLayout, { passive: true });
        window.addEventListener('resize', updateLayout, { passive: true });
        
        return () => {
            window.removeEventListener('touchstart', handleTouchStart);
            window.removeEventListener('touchend', handleTouchEnd);
            window.removeEventListener('scroll', updateLayout);
            window.removeEventListener('resize', updateLayout);
            clearTimeout(scrollTimeout);
        };
    }, []);

    const handleScrollToMovie = (link) => {
        // Close any open panels, switch to library view
        setCurrentView('library');
        setHighlightedMovieLink(link);
        // After a short delay, find the card by data-link and scroll to it
        setTimeout(() => {
            const card = document.querySelector(`[data-movie-link="${CSS.escape(link)}"]`);
            if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            // Clear highlight after animation
            setTimeout(() => setHighlightedMovieLink(null), 2800);
        }, 150);
    };

    const [showAddToCollection, setShowAddToCollection] = useState(false);
    const [collectionMovie, setCollectionMovie] = useState(null);
    const [sharedCollectionId, setSharedCollectionId] = useState(null);

    // Modal State
    const [confirmConfig, setConfirmConfig] = useState(null); // { title, message, onConfirm, confirmText, confirmColor }

    const [sharedMovieData, setSharedMovieData] = useState(null);
    const [isCompareOpen, setIsCompareOpen] = useState(false);
    const [compareLinks, setCompareLinks] = useState([]);
    const [compareDetailsMovie, setCompareDetailsMovie] = useState(null);

    // Synchronize currentView state with URL hash
    useEffect(() => {
        if (checkingAuth) return; // Do not touch hash while verifying session!
        if (currentView === 'shared_collection') {
            return;
        }
        if (user) {
            if (currentView === 'collections' && window.location.hash.startsWith('#collections/')) {
                return;
            }
            window.location.hash = currentView;
        } else {
            window.location.hash = '';
        }
    }, [currentView, user, checkingAuth]);

    // Handle hash change events (e.g. browser back/forward or manual hash entry)
    useEffect(() => {
        if (checkingAuth) return; // Wait until session is verified!
        const handleHashChange = () => {
            if (currentView === 'shared_collection') return;
            const hash = window.location.hash;
            if (hash.startsWith('#collections')) {
                setCurrentView('collections');
            } else if (hash === '#trash') {
                setCurrentView('trash');
            } else if (hash === '#admin') {
                if (user && user.username.toLowerCase() === 'radev') {
                    setCurrentView('admin');
                } else {
                    setCurrentView('library');
                    window.location.hash = 'library';
                }
            } else if (hash === '#watched') {
                setCurrentView('watched');
            } else if (hash === '#library') {
                setCurrentView('library');
            } else if (user) {
                setCurrentView('library');
            }
        };

        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [user, currentView, checkingAuth]);

    // Parse URL on startup for shared collection ID or movie ID
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const collId = params.get('collection');
        const movieId = params.get('movie');
        if (collId) {
            setSharedCollectionId(collId);
            setCurrentView('shared_collection');
        } else if (movieId) {
            fetch(`/api/public/movie/${movieId}`)
                .then(res => res.json())
                .then(data => {
                    if (data && !data.error) setSharedMovieData(data);
                })
                .catch(err => console.error('Failed to load shared movie:', err));
        }
    }, []);

    // Verify token on startup (with automatic guest account creation if unauthenticated)
    useEffect(() => {
        const handleGuestResponse = (data) => {
            if (data.visits >= 6) {
                setGuestLimitReached(true);
                setIsAuthModalOpen(true);
                setGuestTooltipText("🚨 Вы превысили лимит просмотров для гостей. Зарегистрируйтесь, чтобы продолжить!");
                setShowGuestTooltip(true);
            }
        };

        const verifyToken = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                try {
                    const guestRes = await fetch('/api/auth/guest', { method: 'POST' });
                    if (guestRes.ok) {
                        const guestData = await guestRes.json();
                        localStorage.setItem('token', guestData.token);
                        setUser(guestData.user);
                        handleGuestResponse(guestData);
                    }
                } catch (guestErr) {
                    console.error('Failed to create guest session:', guestErr);
                } finally {
                    setCheckingAuth(false);
                }
                return;
            }
            try {
                const res = await fetch('/api/auth/me', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setUser(data.user);
                    if (data.visits) {
                        handleGuestResponse(data);
                    }
                } else {
                    localStorage.removeItem('token');
                    // Automatically get guest session instead of showing login screen
                    const guestRes = await fetch('/api/auth/guest', { method: 'POST' });
                    if (guestRes.ok) {
                        const guestData = await guestRes.json();
                        localStorage.setItem('token', guestData.token);
                        setUser(guestData.user);
                        handleGuestResponse(guestData);
                    }
                }
            } catch (err) {
                console.error('Failed to verify token:', err);
            } finally {
                setCheckingAuth(false);
            }
        };
        verifyToken();
    }, []);

    // Auto-show Guest Welcome Tooltip for exactly 10 seconds
    useEffect(() => {
        if (user && user.username.startsWith('guest_') && !guestLimitReached) {
            setGuestTooltipText("👋 You are browsing as a Guest. Log in or register to save your movies permanently!");
            setShowGuestTooltip(true);
            const timer = setTimeout(() => {
                setShowGuestTooltip(false);
            }, 10000); // 10 seconds popover!
            return () => clearTimeout(timer);
        }
    }, [user, guestLimitReached]);

    // Active Usage Trigger
    const triggerGuestActivity = () => {
        if (user && user.username.startsWith('guest_')) {
            setActivityCount(prev => {
                const next = prev + 1;
                if (next === 2 || next === 5 || next === 8) {
                    setGuestTooltipText("🔮 Enjoying the app? Create a permanent account in one click to keep your saved watchlist secure!");
                    setShowGuestTooltip(true);
                }
                return next;
            });
        }
    };

    // Selection active usage hook
    useEffect(() => {
        if (user && user.username.startsWith('guest_') && selectedIds.length >= 2) {
            setGuestTooltipText("💡 Want to save your selected movies? Sign in or register so they don't get lost!");
            setShowGuestTooltip(true);
        }
    }, [selectedIds.length, user]);

    const handleExitSharedView = () => {
        window.history.replaceState({}, document.title, window.location.pathname);
        setSharedCollectionId(null);
        setCurrentView(user ? getInitialView() : 'auth');
    };

    const fetchHistoryList = async () => {
        if (!user) return;
        try {
            const res = await fetch('/api/movies/history');
            const data = await res.json();
            setHistoryList(data);
        } catch (error) {
            console.error('Failed to fetch history:', error);
        }
    };

    const fetchMovies = async (silent = false) => {
        if (currentView !== 'library' && currentView !== 'trash' && currentView !== 'watched') return;
        if (!user) return; // Do not fetch movies if not authenticated
        if (!silent) setLoading(true);
        try {
            const endpoint = (currentView === 'library' || currentView === 'watched') ? '/api/movies' : '/api/trash';
            const res = await fetch(endpoint);
            const data = await res.json();
            setMovies(data);
            setSelectedIds([]); // Reset selection on view change/reload
            setSelectionAnchor(null);
        } catch (error) {
            console.error('Failed to fetch movies:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMovies();
        fetchHistoryList();
    }, [currentView, user]);

     const handleUpdate = async (id, updates) => {
        if (id === null) {
            if (updates && updates.link) {
                try {
                    const historyBody = {
                        link: updates.link,
                        user_rating: updates.user_rating,
                        notes: updates.notes,
                        notes_public: updates.notes_public,
                        is_watched: updates.status === 'watched' ? 1 : (updates.status === 'want_to_watch' ? 0 : undefined)
                    };
                    // Strip undefined fields
                    Object.keys(historyBody).forEach(key => {
                        if (historyBody[key] === undefined) delete historyBody[key];
                    });
                    
                    await fetch('/api/movies/history', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(historyBody)
                    });
                } catch (e) {
                    console.error('Failed to update history in handleUpdate:', e);
                }
            }
            fetchMovies(true);
            fetchHistoryList();
            return;
        }
        try {
            await fetch(`/api/movies/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            setMovies(movies.map(m => m.id === id ? { ...m, ...updates } : m));
            fetchHistoryList();
        } catch (error) {
            console.error('Update failed:', error);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        setUser(null);
        setMovies([]);
        setSelectedIds([]);
        setSelectionAnchor(null);
        setCurrentView('library');
        window.location.hash = '';
    };

    const handleGlobalAddMovie = async (link) => {
        if (!user) {
            setIsAuthModalOpen(true);
            return;
        }
        try {
            const res = await fetch('/api/movies/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: link })
            });
            if (res.ok || res.status === 409) {
                fetchMovies(true);
                if (sharedMovieData && (sharedMovieData.link === link || sharedMovieData.movie_link === link)) {
                    setSharedMovieData(null);
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            }
        } catch (e) {
            console.error('Failed to add movie globally:', e);
        }
    };

    // Single Item Delete (Context dependent)
    const handleDelete = async (id, forceNoConfirm = false, permanent = true, promptIfNoCollections = true) => {
        const isLibrary = currentView === 'library';

        if (forceNoConfirm) {
            try {
                const endpoint = (isLibrary && !permanent) ? `/api/movies/${id}` : `/api/trash/${id}`;
                await fetch(endpoint, { method: 'DELETE' });
                setMovies(prev => prev.filter(m => m.id !== id));
                setSelectedIds(prev => prev.filter(sid => sid !== id));
                if (selectedIds.length <= 1) setSelectionAnchor(null);
            } catch (error) {
                console.error('Delete failed:', error);
            }
            return;
        }

        let inCollections = false;
        let collectionNames = [];

        if (isLibrary) {
            try {
                const res = await fetch('/api/movies/check-collections', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids: [id] })
                });
                const data = await res.json();
                inCollections = data.inCollections;
                collectionNames = data.collectionNames || [];
            } catch (err) {
                console.error('Failed to check collections:', err);
            }
        }

        if (!inCollections && !promptIfNoCollections) {
            try {
                const endpoint = (isLibrary && !permanent) ? `/api/movies/${id}` : `/api/trash/${id}`;
                await fetch(endpoint, { method: 'DELETE' });
                setMovies(prev => prev.filter(m => m.id !== id));
                setSelectedIds(prev => prev.filter(sid => sid !== id));
                if (selectedIds.length <= 1) setSelectionAnchor(null);
            } catch (error) {
                console.error('Delete failed:', error);
            }
            return;
        }

        const message = inCollections ? 
            (
                <div>
                    <p>Этот фильм есть в ваших подборках:</p>
                    <p style={{color: 'var(--accent-gold)'}}>{collectionNames.join(', ')}</p>
                    <p>Хотите удалить его отовсюду или только из библиотеки?</p>
                </div>
            ) : 
            'Это навсегда удалит фильм из вашей библиотеки. Продолжить?';

        setConfirmConfig({
            title: isLibrary ? 'Удалить фильм' : 'Удалить навсегда',
            message: message,
            confirmText: inCollections ? 'Удалить отовсюду' : 'Удалить',
            confirmColor: 'var(--danger)',
            extraActions: inCollections ? [
                {
                    label: 'Только из библиотеки',
                    color: '#4caf50',
                    onClick: async () => {
                        try {
                            setConfirmConfig(null);
                            await fetch('/api/movies/bulk-hide', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ ids: [id] })
                            });
                            setMovies(prev => prev.filter(m => m.id !== id));
                            setSelectedIds(prev => prev.filter(sid => sid !== id));
                            if (selectedIds.length <= 1) setSelectionAnchor(null);
                        } catch (error) {
                            console.error('Hide failed:', error);
                        }
                    }
                }
            ] : [],
            onConfirm: async () => {
                try {
                    const endpoint = (isLibrary && !permanent) ? `/api/movies/${id}` : `/api/trash/${id}`;
                    await fetch(endpoint, { method: 'DELETE' });
                    setMovies(prev => prev.filter(m => m.id !== id));
                    setSelectedIds(prev => prev.filter(sid => sid !== id));
                    if (selectedIds.length <= 1) setSelectionAnchor(null);
                    setConfirmConfig(null);
                } catch (error) {
                    console.error('Delete failed:', error);
                }
            }
        });
    };

    // Bulk Delete with Animation
    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        const isLibrary = currentView === 'library';

        let inCollections = false;
        let collectionNames = [];

        if (isLibrary) {
            try {
                const res = await fetch('/api/movies/check-collections', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids: selectedIds })
                });
                const data = await res.json();
                inCollections = data.inCollections;
                collectionNames = data.collectionNames || [];
            } catch (err) {
                console.error('Failed to check collections:', err);
            }
        }

        const message = inCollections ? 
            (
                <div>
                    <p>These movies ({selectedIds.length} pcs) are in your collections:</p>
                    <p style={{color: 'var(--accent-gold)'}}>{collectionNames.join(', ')}</p>
                    <p>Do you want to delete them permanently everywhere (including collections) or just hide them from the library?</p>
                </div>
            ) : 
            `Are you sure you want to ${isLibrary ? 'trash' : 'permanently delete'} ${selectedIds.length} item(s)?`;

        setConfirmConfig({
            title: isLibrary ? 'Delete Movies' : 'Delete Selection Permanently',
            message: message,
            confirmText: inCollections ? 'Delete Everywhere' : 'Delete All',
            confirmColor: 'var(--danger)',
            extraActions: inCollections ? [
                {
                    label: 'Only Hide',
                    color: '#4caf50',
                    onClick: async () => {
                        try {
                            setConfirmConfig(null);
                            await fetch('/api/movies/bulk-hide', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ ids: selectedIds })
                            });
                            // Start delete animation to remove them from library view
                            setDeletingIds(selectedIds);
                            setTimeout(() => {
                                setMovies(prev => prev.filter(m => !selectedIds.includes(m.id)));
                                setSelectedIds([]);
                                setSelectionAnchor(null);
                                setDeletingIds([]);
                            }, 300);
                        } catch (error) {
                            console.error('Hide failed:', error);
                        }
                    }
                }
            ] : [],
            onConfirm: async () => {
                try {
                    // Start delete animation
                    setDeletingIds(selectedIds);
                    setConfirmConfig(null);

                    // Wait for animation to complete (1500ms total)
                    await new Promise(resolve => setTimeout(resolve, 1500));

                    // Perform actual deletion
                    const endpoint = isLibrary ? '/api/movies/bulk-delete' : '/api/trash';
                    await fetch(endpoint, {
                        method: isLibrary ? 'POST' : 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ids: selectedIds })
                    });

                    // Clear animation state and refresh
                    setDeletingIds([]);
                    fetchMovies();
                } catch (error) {
                    console.error('Bulk delete failed', error);
                    setDeletingIds([]);
                }
            }
        });
    };

    // Bulk Refresh
    const handleBulkRefresh = async () => {
        if (!selectedIds.length) return;
        try {
            await fetch('/api/movies/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: selectedIds })
            });
            fetchMovies();
        } catch (error) {
            console.error('Bulk refresh failed', error);
        }
    };

    // Bulk Restore (from Trash)
    const handleBulkRestore = async () => {
        if (!selectedIds.length) return;
        try {
            await fetch('/api/movies/bulk-restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: selectedIds })
            });
            fetchMovies();
        } catch (error) {
            console.error('Bulk restore failed', error);
        }
    };

    // Bulk Mark Watched
    const handleBulkMarkWatched = async () => {
        if (!selectedIds.length) return;
        try {
            await fetch('/api/movies/bulk-watched', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: selectedIds })
            });
            fetchMovies();
            setSelectedIds([]);
            setSelectionAnchor(null);
        } catch (error) {
            console.error('Bulk mark watched failed', error);
        }
    };

    const handleBulkCompare = () => {
        const compareMax = window.innerWidth <= 768 ? 3 : 4;
        const links = movies
            .filter(m => selectedIds.includes(m.id))
            .map(m => m.link)
            .filter(Boolean);
        if (links.length < 2 || links.length > compareMax) return;
        setCompareLinks(links);
        setIsCompareOpen(true);
    };

    const emptyTrash = () => {
        setConfirmConfig({
            title: 'Empty Trash',
            message: 'Are you sure you want to permanently delete all items in the trash? This cannot be undone.',
            confirmText: 'Empty Trash',
            confirmColor: 'var(--danger)',
            onConfirm: async () => {
                try {
                    await fetch('/api/trash', { method: 'DELETE' });
                    fetchMovies();
                    setConfirmConfig(null);
                } catch (error) {
                    console.error('Empty trash failed', error);
                }
            }
        });
    };

    const displayedMovies = useMemo(() => {
        if (currentView === 'library') {
            return movies.filter(m => m.id !== null);
        }
        if (currentView === 'watched') {
            return movies.filter(m => m.status === 'watched');
        }
        return movies;
    }, [movies, currentView]);

    if (checkingAuth) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-app)', color: '#fff' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ border: '4px solid rgba(255,255,255,0.1)', borderTop: '4px solid var(--accent-gold)', borderRadius: '50%', width: '50px', height: '50px', animation: 'spin 1s linear infinite', margin: '0 auto 20px' }}></div>
                    <div>Verifying Session...</div>
                    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                </div>
            </div>
        );
    }

    const renderCacheBadge = (isMobile) => {
        if (globalCacheCount <= 0) return null;
        return (
            <div 
                className={`global-cache-wrapper ${isMobile ? 'mobile-badge-only' : 'desktop-badge-only'}`}
                style={{ position: 'relative' }}
                onMouseEnter={() => { if (!isMobile) setIsHoveringBadge(true); }}
                onMouseLeave={() => { if (!isMobile) setIsHoveringBadge(false); }}
            >
                <div 
                    className="global-cache-badge glass-panel" 
                    style={{
                        fontSize: '0.8rem',
                        color: '#c084fc',
                        background: 'rgba(168, 85, 247, 0.08)',
                        border: '1px solid rgba(168, 85, 247, 0.25)',
                        padding: '6px 14px',
                        borderRadius: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: 'bold',
                        boxShadow: '0 0 10px rgba(168, 85, 247, 0.05)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        animation: 'pulse 3s infinite alternate'
                    }}
                    onClick={(e) => { 
                        if (isMobile) {
                            e.stopPropagation();
                            setIsHoveringBadge(prev => !prev);
                        } else {
                            if (user?.username?.toLowerCase() === 'radev') setCurrentView('admin'); 
                        }
                    }}
                >
                    <span 
                        className="live-pulse"
                        style={{ 
                            width: '6px', 
                            height: '6px', 
                            background: '#c084fc', 
                            borderRadius: '50%',
                            display: 'inline-block',
                            boxShadow: '0 0 8px #c084fc',
                            animation: 'blink 1.5s infinite'
                        }} 
                    />
                    <span>🎬 {smoothCacheCount.toLocaleString()} in DB</span>
                </div>
                
                {/* The Latest Scraped Notification Popup */}
                {/* Transparent bridge: fills gap between button and popup so mouse doesn't "escape" */}
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: '0',
                    width: '310px',
                    paddingTop: '10px',   // invisible bridge over the gap
                    zIndex: 100,
                    pointerEvents: (showScrapePopup || isHoveringBadge) && popupMovie ? 'auto' : 'none',
                }}>
                <div style={{
                    width: '290px',
                    marginLeft: 'auto',
                    background: popupMode === 'top'
                        ? 'rgba(30, 25, 15, 0.92)'
                        : popupMode === 'random'
                            ? 'rgba(15, 25, 35, 0.9)'
                            : 'rgba(25, 20, 40, 0.88)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: popupMode === 'top'
                        ? '1px solid rgba(212, 175, 55, 0.45)'
                        : popupMode === 'random'
                            ? '1px solid rgba(56, 189, 248, 0.3)'
                            : '1px solid rgba(168, 85, 247, 0.35)',
                    borderRadius: '16px',
                    padding: '12px 14px',
                    boxShadow: popupMode === 'top'
                        ? '0 12px 40px rgba(0, 0, 0, 0.7), inset 0 1px 1px rgba(255, 255, 255, 0.15), 0 0 25px rgba(212, 175, 55, 0.15)'
                        : popupMode === 'random'
                            ? '0 12px 40px rgba(0, 0, 0, 0.65), inset 0 1px 1px rgba(255, 255, 255, 0.08), 0 0 20px rgba(56, 189, 248, 0.1)'
                            : '0 12px 40px rgba(0, 0, 0, 0.65), inset 0 1px 1px rgba(255, 255, 255, 0.1), 0 0 20px rgba(168, 85, 247, 0.15)',
                    opacity: (showScrapePopup || isHoveringBadge) && popupMovie ? 1 : 0,
                    transform: (showScrapePopup || isHoveringBadge) && popupMovie 
                        ? 'translateY(0) scale(1)' 
                        : 'translateY(-15px) scale(0.92)',
                    pointerEvents: (showScrapePopup || isHoveringBadge) && popupMovie ? 'auto' : 'none',
                    transition: 'opacity 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    zIndex: 100,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    cursor: 'pointer'
                }} onClick={() => {
                    if (popupMovie) setScrapedDetailsMovie(popupMovie);
                }}>
                    {popupMovie?.poster_url && (
                        <img src={popupMovie.poster_url} alt="poster" style={{ width: '45px', height: '65px', borderRadius: '8px', objectFit: 'cover', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                        <div style={{ fontSize: '0.72rem', color: popupMode === 'top' ? 'var(--accent-gold)' : popupMode === 'random' ? '#38bdf8' : '#c084fc', marginBottom: '3px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
                            {popupMode === 'top' ? '✨ Высокий рейтинг:' : popupMode === 'random' ? '🎲 Случайный фильм:' : 'Недавно добавлено:'}
                        </div>
                        <div style={{ fontSize: '0.92rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: '600', lineHeight: '1.2' }}>
                            {popupMovie?.title}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '4px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {popupMovie?.year && <span>{popupMovie.year}</span>}
                            {popupMovie?.year && popupMovie?.rating && <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'rgba(255,255,255,0.3)' }}></span>}
                            {popupMovie?.rating ? <span style={{ color: 'var(--accent-gold)', fontWeight: 'bold' }}>★ {popupMovie.rating}</span> : null}
                        </div>
                    </div>
                </div>  {/* end inner popup */}
                </div>  {/* end bridge wrapper */}
            </div>
        );
    };

    return (
        <div className="app">
            <style>{`
                @keyframes blink {
                    0%, 100% { opacity: 0.4; transform: scale(0.9); }
                    50% { opacity: 1; transform: scale(1.1); }
                }
                @keyframes pulse {
                    0% { box-shadow: 0 0 4px rgba(168, 85, 247, 0.1); }
                    100% { box-shadow: 0 0 12px rgba(168, 85, 247, 0.25); }
                }
            `}</style>
            <header className={`header glass-panel app-header${headerScrolled ? ' header-scrolled' : ''}`}>
                <div className="container header-content">
                    {currentView !== 'shared_collection' && user && renderCacheBadge(true)}
                    <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div 
                            style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                            onClick={() => { 
                                if (currentView !== 'shared_collection') setCurrentView('library');
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                        >
                            <img 
                                src="favicon.png" 
                                alt="Radev Movie Selector Mascot" 
                                style={{ 
                                    width: '76px', 
                                    height: '76px', 
                                    objectFit: 'contain',
                                    borderRadius: '0',
                                    border: 'none',
                                    filter: 'drop-shadow(0 0 8px rgba(212,175,55,0.35))',
                                    transition: 'transform 0.3s ease'
                                }} 
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1) rotate(-5deg)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1) rotate(0deg)'}
                            />
                            <h1 className="gold logo" style={{ margin: 0, fontSize: '1.35rem', letterSpacing: '0.5px', lineHeight: '1.1', display: 'flex', flexDirection: 'column' }}>
                                <span>Radev's</span>
                                <span className="gold">Movie Selector</span>
                            </h1>
                        </div>
                        {user && currentView !== 'shared_collection' ? (
                            <div className="header-nav" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <button
                                    onClick={() => setCurrentView('library')}
                                    className={`btn ${currentView === 'library' ? 'active-library' : ''}`}
                                >
                                    Library
                                </button>
                                <button
                                    onClick={() => setCurrentView('watched')}
                                    className={`btn ${currentView === 'watched' ? 'active-watched' : ''}`}
                                >
                                    Watched
                                </button>
                                <button
                                    onClick={() => setCurrentView('collections')}
                                    className={`btn ${currentView === 'collections' ? 'active-collections' : ''}`}
                                >
                                    📁 Collections
                                </button>
                                {user.username.toLowerCase() === 'radev' && (
                                    <button
                                        onClick={() => setCurrentView('admin')}
                                        className={`btn ${currentView === 'admin' ? 'active-admin' : ''}`}
                                    >
                                        👑 Admin Panel
                                    </button>
                                )}
                            </div>
                        ) : null}
                    </div>

                    {currentView !== 'shared_collection' && user && (
                        <div className="header-right" style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>

                            {renderCacheBadge(false)}
                            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', height: '24px', margin: '0 5px' }}></div>
                            {user.username.startsWith('guest_') ? (
                                <div style={{ position: 'relative', display: 'inline-block' }}>
                                    <span className="header-username" style={{
                                        fontSize: '0.9rem', color: 'var(--accent-gold)', fontWeight: 'bold',
                                        background: 'rgba(212, 175, 55, 0.1)', border: '1px solid rgba(212, 175, 55, 0.25)',
                                        padding: '6px 14px', borderRadius: '20px', cursor: 'pointer',
                                        transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px'
                                    }}
                                    onClick={() => setIsAuthModalOpen(true)}
                                    >
                                        <span className="btn-icon">👤</span>
                                        <span className="btn-label">Guest Visitor (Sign In)</span>
                                    </span>
                                    
                                    {/* Guest Floating Popover Tooltip */}
                                    {showGuestTooltip && (
                                        <div className="glass-panel" style={{
                                            position: 'absolute', top: '100%', right: 0, marginTop: '12px',
                                            width: '280px', padding: '16px', borderRadius: '16px',
                                            border: '1px solid rgba(168, 85, 247, 0.4)',
                                            background: 'linear-gradient(135deg, rgba(20, 10, 35, 0.96) 0%, rgba(10, 5, 20, 0.98) 100%)',
                                            boxShadow: '0 8px 32px rgba(168, 85, 247, 0.25), 0 0 20px rgba(168, 85, 247, 0.1)',
                                            color: '#fff', fontSize: '0.85rem', zIndex: 1000,
                                            display: 'flex', flexDirection: 'column', gap: '10px',
                                            animation: 'fadeInDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: '8px' }}>
                                                <span style={{ fontSize: '1.1rem' }}>💡</span>
                                                <span style={{ flex: 1, lineHeight: '1.4', color: '#e2e8f0', textAlign: 'left' }}>
                                                    {guestTooltipText}
                                                </span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setShowGuestTooltip(false);
                                                    }}
                                                    style={{
                                                        background: 'none', border: 'none', color: '#888',
                                                        cursor: 'pointer', padding: 0, fontSize: '0.85rem'
                                                    }}
                                                >✕</button>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setIsAuthModalOpen(true);
                                                    setShowGuestTooltip(false);
                                                }}
                                                style={{
                                                    background: 'linear-gradient(135deg, #c084fc 0%, #a855f7 100%)',
                                                    border: 'none', color: '#fff', padding: '8px 12px',
                                                    borderRadius: '8px', fontWeight: 'bold', fontSize: '0.8rem',
                                                    cursor: 'pointer', boxShadow: '0 2px 8px rgba(168, 85, 247, 0.3)',
                                                    textAlign: 'center', transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                            >
                                                🔑 Sign In / Register
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <span className="header-username" style={{ fontSize: '0.9rem', color: '#aaa', fontWeight: 500 }}>
                                        <span className="btn-icon">👤</span>
                                        <span className="btn-label"> {user.username}</span>
                                    </span>
                                    <button onClick={handleLogout} className="btn btn-ghost header-btn-logout" title="Logout" style={{ fontSize: '0.85rem', color: '#ff6b6b' }}>
                                        <span className="btn-icon">⏻</span>
                                        <span className="btn-label">Logout</span>
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </header>

            <main className="container main-content">
                {currentView === 'shared_collection' ? (
                    <SharedCollectionView
                        collectionId={sharedCollectionId}
                        onExit={handleExitSharedView}
                    />
                ) : !user ? (
                    <AuthScreen onAuthSuccess={setUser} />
                ) : currentView === 'admin' ? (
                    <AdminDashboard
                        onBack={() => setCurrentView('library')}
                        movies={movies}
                        onMovieAdded={() => fetchMovies(true)}
                    />
                ) : currentView === 'collections' ? (
                    <CollectionsView
                        onBack={() => setCurrentView('library')}
                    />
                ) : (
                    <>
                        {currentView === 'library' && (
                                <AddMovie 
                                    onMovieAdded={() => fetchMovies(true)} 
                                    onScrollToMovie={handleScrollToMovie} 
                                    movies={movies} 
                                    selectedLibraryIds={selectedIds}
                                    onGuestActivity={triggerGuestActivity}
                                    onAddToCollectionClick={setCollectionMovie}
                                />
                        )}

                        <div className="movie-list-section">
                            {loading ? (
                                <div style={{ textAlign: 'center', padding: '50px' }}>Loading...</div>
                            ) : (
                                <MovieGrid
                                    movies={displayedMovies}
                                    allMovies={movies}
                                    historyList={historyList}
                                    onFetchHistory={fetchHistoryList}
                                    onUpdate={handleUpdate}
                                    onDelete={handleDelete}
                                    selectedIds={selectedIds}
                                    onSelect={setSelectedIds}
                                    onSelectAll={(ids) => {
                                        setSelectedIds(ids);
                                        if (ids.length === 0) setSelectionAnchor(null);
                                    }}
                                    setSelectionAnchor={setSelectionAnchor}
                                    deletingIds={deletingIds}
                                    trashButtonRef={trashButtonRef}
                                    isTrashMode={currentView === 'trash'}
                                    isWatchedView={currentView === 'watched'}
                                    isGuest={user?.username?.startsWith('guest_')}
                                    guestLimitReached={guestLimitReached}
                                    onRegisterClick={() => setIsAuthModalOpen(true)}
                                    emptyMessage={currentView === 'library' ? 'Your library is empty.' : currentView === 'watched' ? 'Watched list is empty.' : 'Trash is empty.'}
                                    highlightedLink={highlightedMovieLink}
                                    onGuestActivity={triggerGuestActivity}
                                    onAddToCollectionClick={setCollectionMovie}
                                />
                            )}
                            {!loading && displayedMovies.length === 0 && (
                                <div style={{ textAlign: 'center', color: '#666', marginTop: '50px' }}>
                                    {currentView === 'library' ? 'Your library is empty.' : currentView === 'watched' ? 'Watched list is empty.' : 'Trash is empty.'}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </main>

            {user && (currentView === 'library' || currentView === 'trash' || currentView === 'watched') && (
                <BulkActionBar
                    selectedCount={selectedIds.length}
                    onDelete={handleBulkDelete}
                    onRefresh={handleBulkRefresh}
                    onRestore={handleBulkRestore}
                    onMarkWatched={handleBulkMarkWatched}
                    onAddToCollection={() => setShowAddToCollection(true)}
                    onCompare={(currentView === 'library' || currentView === 'watched') ? handleBulkCompare : undefined}
                    onCancelSelection={() => {
                        setSelectedIds([]);
                        setSelectionAnchor(null);
                    }}
                    isTrashMode={currentView === 'trash'}
                    anchor={selectionAnchor}
                />
            )}

            {(showAddToCollection || collectionMovie) && (
                <AddToCollectionModal
                    movieIds={showAddToCollection ? selectedIds : (Array.isArray(collectionMovie) ? collectionMovie.map(m => m.id) : [collectionMovie.id].filter(Boolean))}
                    movies={showAddToCollection ? movies.filter(m => selectedIds.includes(m.id)) : (Array.isArray(collectionMovie) ? collectionMovie : [collectionMovie])}
                    onClose={() => {
                        setShowAddToCollection(false);
                        setCollectionMovie(null);
                    }}
                    onSuccess={() => {
                        if (showAddToCollection) {
                            setSelectedIds([]);
                            setSelectionAnchor(null);
                        }
                        setShowAddToCollection(false);
                        setCollectionMovie(null);
                    }}
                />
            )}

            {confirmConfig && (
                <ConfirmModal
                    {...confirmConfig}
                    onCancel={() => setConfirmConfig(null)}
                />
            )}

            {sharedMovieData && (
                <MovieDetailsModal
                    movie={sharedMovieData}
                    onClose={() => {
                        setSharedMovieData(null);
                        window.history.replaceState({}, document.title, window.location.pathname);
                    }}
                    onUpdate={user && user.id === sharedMovieData.user_id ? handleUpdate : undefined}
                    readOnly={!user || user.id !== sharedMovieData.user_id}
                    isAdded={movies.some(m => !m.deleted_at && cleanLinkPath(m.link) === cleanLinkPath(sharedMovieData.link || sharedMovieData.movie_link))}
                    onAddMovie={handleGlobalAddMovie}
                />
            )}

            {compareDetailsMovie && (
                <MovieDetailsModal
                    movie={compareDetailsMovie}
                    onClose={() => setCompareDetailsMovie(null)}
                    onUpdate={(id, updates) => {
                        if (id) handleUpdate(id, updates);
                        setCompareDetailsMovie(prev => (prev ? { ...prev, ...updates } : prev));
                    }}
                    isAdded={movies.some(m => !m.deleted_at && cleanLinkPath(m.link) === cleanLinkPath(compareDetailsMovie.link || compareDetailsMovie.movie_link))}
                    onAddMovie={handleGlobalAddMovie}
                />
            )}

            {scrapedDetailsMovie && (
                <MovieDetailsModal
                    movie={scrapedDetailsMovie}
                    onClose={() => setScrapedDetailsMovie(null)}
                    onUpdate={(id, updates) => {
                        if (id) handleUpdate(id, updates);
                        setScrapedDetailsMovie(prev => (prev ? { ...prev, ...updates } : prev));
                    }}
                    isAdded={movies.some(m => !m.deleted_at && cleanLinkPath(m.link) === cleanLinkPath(scrapedDetailsMovie.link || scrapedDetailsMovie.movie_link))}
                    onAddMovie={handleGlobalAddMovie}
                />
            )}

            {isCompareOpen && (
                <MovieComparisonModal
                    isOpen={isCompareOpen}
                    onClose={() => {
                        setIsCompareOpen(false);
                        setCompareLinks([]);
                    }}
                    movieLinks={compareLinks}
                    getOwnedMovie={(link) =>
                        movies.find(m => !m.deleted_at && cleanLinkPath(m.link) === cleanLinkPath(link))
                    }
                    onOpenMovie={setCompareDetailsMovie}
                />
            )}

            {isAuthModalOpen && (
                <div style={{
                    position: 'fixed', inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.75)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    zIndex: 12000,
                    animation: 'fadeIn 0.3s ease-out'
                }}>
                    <div style={{ position: 'relative', width: '100%', maxWidth: '420px', padding: '10px' }}>
                        <button
                            onClick={() => setIsAuthModalOpen(false)}
                            style={{
                                position: 'absolute', top: '25px', right: '25px',
                                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '50%', width: '32px', height: '32px',
                                color: '#ccc', fontSize: '1rem', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.2s', zIndex: 10
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                        >
                            ✕
                        </button>
                        <AuthScreen onAuthSuccess={(newUser) => {
                            setUser(newUser);
                            setIsAuthModalOpen(false);
                        }} />
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
