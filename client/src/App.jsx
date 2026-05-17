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

function App() {
    const [movies, setMovies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [checkingAuth, setCheckingAuth] = useState(true);
    const [currentView, setCurrentView] = useState('library'); // 'library' | 'trash' | 'collections' | 'shared_collection' | 'admin'
    const [selectedIds, setSelectedIds] = useState([]);
    const [selectionAnchor, setSelectionAnchor] = useState(null);
    const [deletingIds, setDeletingIds] = useState([]); // Track items being deleted for animation
    const trashButtonRef = useRef(null);

    const [showAddToCollection, setShowAddToCollection] = useState(false);
    const [sharedCollectionId, setSharedCollectionId] = useState(null);

    // Modal State
    const [confirmConfig, setConfirmConfig] = useState(null); // { title, message, onConfirm, confirmText, confirmColor }

    // Parse URL on startup for shared collection ID
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const collId = params.get('collection');
        if (collId) {
            setSharedCollectionId(collId);
            setCurrentView('shared_collection');
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
        setCurrentView(user ? 'library' : 'auth');
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
    };

    // Single Item Delete (Context dependent)
    const handleDelete = (id) => {
        const isLibrary = currentView === 'library';
        setConfirmConfig({
            title: isLibrary ? 'Move to Trash' : 'Delete Permanently',
            message: isLibrary ? 'Are you sure you want to move this movie to the trash?' : 'This action cannot be undone. Delete forever?',
            confirmText: 'Delete',
            confirmColor: 'var(--danger)',
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
    const handleBulkDelete = () => {
        if (selectedIds.length === 0) return;
        const isLibrary = currentView === 'library';

        setConfirmConfig({
            title: isLibrary ? 'Move Selection to Trash' : 'Delete Selection Permanently',
            message: `Are you sure you want to ${isLibrary ? 'trash' : 'permanently delete'} ${selectedIds.length} item(s)?`,
            confirmText: 'Delete All',
            confirmColor: 'var(--danger)',
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
            <header className="header glass-panel">
                <div className="container header-content">
                    <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <h1 className="gold logo" style={{ cursor: 'pointer', margin: 0 }} onClick={() => { if (currentView !== 'shared_collection') setCurrentView('library'); }}>Movie<span className="gold">Watcher</span></h1>
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
                                className="btn"
                                style={{
                                    background: currentView === 'trash' ? 'var(--bg-card)' : 'rgba(255,255,255,0.05)',
                                    color: currentView === 'trash' ? 'var(--accent-gold)' : '#888',
                                    border: currentView === 'trash' ? '1px solid var(--accent-gold)' : '1px solid rgba(255,255,255,0.05)',
                                    borderRadius: '8px'
                                }}
                            >
                                Trash
                            </button>
                            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', height: '24px', margin: '0 5px' }}></div>
                            <span style={{ fontSize: '0.9rem', color: '#aaa', fontWeight: 500 }}>
                                👤 {user.username}
                            </span>
                            <button onClick={handleLogout} className="btn btn-ghost" style={{ fontSize: '0.85rem', color: '#ff6b6b' }}>
                                Logout
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
                                <AddMovie onMovieAdded={fetchMovies} />
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
                    isTrashMode={currentView === 'trash'}
                    anchor={selectionAnchor}
                />
            )}

            {showAddToCollection && (
                <AddToCollectionModal
                    movieIds={selectedIds}
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
        </div>
    );
}

export default App;
