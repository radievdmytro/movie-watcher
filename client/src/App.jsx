import { useState, useEffect, useRef } from 'react';
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

function App() {
    const [movies, setMovies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [checkingAuth, setCheckingAuth] = useState(true);
    const getInitialView = () => {
        const hash = window.location.hash;
        if (hash.startsWith('#collections')) return 'collections';
        if (hash === '#trash') return 'trash';
        if (hash === '#admin') return 'admin';
        if (hash === '#library') return 'library';
        return 'library';
    };

    const [currentView, setCurrentView] = useState(getInitialView); // 'library' | 'trash' | 'collections' | 'shared_collection' | 'admin'
    const [selectedIds, setSelectedIds] = useState([]);
    const [selectionAnchor, setSelectionAnchor] = useState(null);
    const [deletingIds, setDeletingIds] = useState([]); // Track items being deleted for animation
    const trashButtonRef = useRef(null);
    const [highlightedMovieLink, setHighlightedMovieLink] = useState(null);
    const [headerScrolled, setHeaderScrolled] = useState(false);

    useEffect(() => {
        const headerEl = document.querySelector('.app-header');
        const setH = () => {
            if (headerEl) {
                document.documentElement.style.setProperty(
                    '--header-h', headerEl.offsetHeight + 'px'
                );
            }
        };
        const updateLayout = () => {
            setHeaderScrolled(window.scrollY > 48);
            // Set immediately for pre-transition height
            requestAnimationFrame(setH);
            // Set again after transition finishes (~410ms) for post-transition height
            setTimeout(setH, 410);
        };
        updateLayout();
        window.addEventListener('scroll', updateLayout, { passive: true });
        window.addEventListener('resize', updateLayout, { passive: true });
        return () => {
            window.removeEventListener('scroll', updateLayout);
            window.removeEventListener('resize', updateLayout);
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
    const [sharedCollectionId, setSharedCollectionId] = useState(null);

    // Modal State
    const [confirmConfig, setConfirmConfig] = useState(null); // { title, message, onConfirm, confirmText, confirmColor }

    const [sharedMovieData, setSharedMovieData] = useState(null);

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

    // Verify token on startup
    useEffect(() => {
        const verifyToken = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                setCheckingAuth(false);
                return;
            }
            try {
                const res = await fetch('/api/auth/me');
                if (res.ok) {
                    const data = await res.json();
                    setUser(data.user);
                } else {
                    localStorage.removeItem('token');
                }
            } catch (err) {
                console.error('Failed to verify token:', err);
            } finally {
                setCheckingAuth(false);
            }
        };
        verifyToken();
    }, []);

    const handleExitSharedView = () => {
        window.history.replaceState({}, document.title, window.location.pathname);
        setSharedCollectionId(null);
        setCurrentView(user ? getInitialView() : 'auth');
    };

    const fetchMovies = async () => {
        if (currentView !== 'library' && currentView !== 'trash') return;
        if (!user) return; // Do not fetch movies if not authenticated
        setLoading(true);
        try {
            const endpoint = currentView === 'library' ? '/api/movies' : '/api/trash';
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
    }, [currentView, user]);

    const handleUpdate = async (id, updates) => {
        try {
            await fetch(`/api/movies/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            setMovies(movies.map(m => m.id === id ? { ...m, ...updates } : m));
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

    // Single Item Delete (Context dependent)
    const handleDelete = async (id) => {
        const isLibrary = currentView === 'library';

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

        const message = inCollections ? 
            (
                <div>
                    <p>Этот фильм находится в ваших подборках:</p>
                    <p style={{color: 'var(--accent-gold)'}}>{collectionNames.join(', ')}</p>
                    <p>Удалить его полностью или скрыть из библиотеки?</p>
                </div>
            ) : 
            (isLibrary ? 'Are you sure you want to move this movie to the trash?' : 'This action cannot be undone. Delete forever?');

        setConfirmConfig({
            title: isLibrary ? 'Удаление фильма' : 'Delete Permanently',
            message: message,
            confirmText: inCollections ? 'Удалить везде' : 'Delete',
            confirmColor: 'var(--danger)',
            extraActions: inCollections ? [
                {
                    label: 'Только скрыть',
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
                    const endpoint = isLibrary ? `/api/movies/${id}` : `/api/trash/${id}`;
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
                    <p>Эти фильмы (${selectedIds.length} шт.) находятся в ваших подборках:</p>
                    <p style={{color: 'var(--accent-gold)'}}>{collectionNames.join(', ')}</p>
                    <p>Хотите удалить их полностью (включая подборки) или только скрыть из общей библиотеки?</p>
                </div>
            ) : 
            `Are you sure you want to ${isLibrary ? 'trash' : 'permanently delete'} ${selectedIds.length} item(s)?`;

        setConfirmConfig({
            title: isLibrary ? 'Удаление фильмов' : 'Delete Selection Permanently',
            message: message,
            confirmText: inCollections ? 'Удалить везде' : 'Delete All',
            confirmColor: 'var(--danger)',
            extraActions: inCollections ? [
                {
                    label: 'Только скрыть',
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

    return (
        <div className="app">
            <header className={`header glass-panel app-header${headerScrolled ? ' header-scrolled' : ''}`}>
                <div className="container header-content">
                    <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div 
                            style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                            onClick={() => { if (currentView !== 'shared_collection') setCurrentView('library'); }}
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
                            <h1 className="gold logo" style={{ margin: 0, fontSize: '1.55rem', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
                                Radev's <span className="gold">Movie Selector</span>
                            </h1>
                        </div>
                        {user && currentView !== 'shared_collection' ? (
                            <div className="header-nav" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <button
                                    onClick={() => setCurrentView('library')}
                                    className="btn"
                                    style={{
                                        background: currentView === 'library' ? 'var(--bg-card)' : 'rgba(255,255,255,0.05)',
                                        color: currentView === 'library' ? '#fff' : '#888',
                                        borderRadius: '8px'
                                    }}
                                >
                                    Library
                                </button>
                                <button
                                    onClick={() => setCurrentView('collections')}
                                    className="btn"
                                    style={{
                                        background: currentView === 'collections' ? 'var(--bg-card)' : 'rgba(255,255,255,0.05)',
                                        color: currentView === 'collections' ? 'var(--accent-gold)' : '#888',
                                        borderRadius: '8px'
                                    }}
                                >
                                    📁 Collections
                                </button>
                                {user.username.toLowerCase() === 'radev' && (
                                    <button
                                        onClick={() => setCurrentView('admin')}
                                        className="btn"
                                        style={{
                                            background: currentView === 'admin' ? 'rgba(212, 175, 55, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                            color: currentView === 'admin' ? '#fff' : 'var(--accent-gold)',
                                            border: '1px solid rgba(212, 175, 55, 0.3)',
                                            borderRadius: '8px',
                                            fontWeight: 'bold'
                                        }}
                                    >
                                        👑 Admin Panel
                                    </button>
                                )}
                                {(currentView === 'library' || currentView === 'trash') && (
                                    <div className="header-movie-count" style={{ fontSize: '0.9rem', color: '#888', marginLeft: '5px' }}>
                                        {movies.length} {currentView === 'library' ? 'Movies' : 'Deleted Items'}
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </div>

                    {currentView !== 'shared_collection' && user && (
                        <div className="header-right" style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                            {currentView === 'trash' && movies.length > 0 && (
                                <button onClick={emptyTrash} className="btn btn-ghost" style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>
                                    Empty Trash
                                </button>
                            )}
                            <button
                                ref={trashButtonRef}
                                onClick={() => setCurrentView('trash')}
                                className="btn header-btn-trash"
                                title="Trash"
                                style={{
                                    background: currentView === 'trash' ? 'var(--bg-card)' : 'rgba(255,255,255,0.05)',
                                    color: currentView === 'trash' ? 'var(--accent-gold)' : '#888',
                                    border: currentView === 'trash' ? '1px solid var(--accent-gold)' : '1px solid rgba(255,255,255,0.05)',
                                    borderRadius: '8px'
                                }}
                            >
                                <span className="btn-icon">🗑️</span>
                                <span className="btn-label">Trash</span>
                            </button>
                            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', height: '24px', margin: '0 5px' }}></div>
                            <span className="header-username" style={{ fontSize: '0.9rem', color: '#aaa', fontWeight: 500 }}>
                                <span className="btn-icon">👤</span>
                                <span className="btn-label"> {user.username}</span>
                            </span>
                            <button onClick={handleLogout} className="btn btn-ghost header-btn-logout" title="Logout" style={{ fontSize: '0.85rem', color: '#ff6b6b' }}>
                                <span className="btn-icon">⏻</span>
                                <span className="btn-label">Logout</span>
                            </button>
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
                    />
                ) : currentView === 'collections' ? (
                    <CollectionsView
                        onBack={() => setCurrentView('library')}
                    />
                ) : (
                    <>
                        {currentView === 'library' && (
                            <div className="add-movie-section">
                                <AddMovie onMovieAdded={fetchMovies} onScrollToMovie={handleScrollToMovie} movies={movies} />
                            </div>
                        )}

                        <div className="movie-list-section">
                            {loading ? (
                                <div style={{ textAlign: 'center', padding: '50px' }}>Loading...</div>
                            ) : (
                                <MovieGrid
                                    movies={movies}
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
                                    highlightedLink={highlightedMovieLink}
                                />
                            )}
                            {!loading && movies.length === 0 && (
                                <div style={{ textAlign: 'center', color: '#666', marginTop: '50px' }}>
                                    {currentView === 'library' ? 'No movies yet.' : 'Trash is empty.'}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </main>

            {user && (currentView === 'library' || currentView === 'trash') && (
                <BulkActionBar
                    selectedCount={selectedIds.length}
                    onDelete={handleBulkDelete}
                    onRefresh={handleBulkRefresh}
                    onRestore={handleBulkRestore}
                    onAddToCollection={() => setShowAddToCollection(true)}
                    onCancelSelection={() => {
                        setSelectedIds([]);
                        setSelectionAnchor(null);
                    }}
                    isTrashMode={currentView === 'trash'}
                    anchor={selectionAnchor}
                />
            )}

            {showAddToCollection && (
                <AddToCollectionModal
                    movieIds={selectedIds}
                    movies={movies.filter(m => selectedIds.includes(m.id))}
                    onClose={() => setShowAddToCollection(false)}
                    onSuccess={() => {
                        setSelectedIds([]);
                        setSelectionAnchor(null);
                        setShowAddToCollection(false);
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
                />
            )}
        </div>
    );
}

export default App;
