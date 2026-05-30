import { useState, useEffect, useRef } from 'react';
import MovieDetailsModal from './MovieDetailsModal';

const AnimatedCounter = ({ value }) => {
    const [count, setCount] = useState(0);
    const hasAnimated = useRef(false);

    useEffect(() => {
        const end = parseInt(value, 10);
        if (isNaN(end) || end === 0) {
            setCount(0);
            return;
        }

        if (hasAnimated.current) {
            setCount(end);
            return;
        }

        hasAnimated.current = true;

        let duration = 1000;
        if (end >= 1000) duration = 3000;
        else if (end >= 100) duration = 2000;

        let startTimestamp = null;
        let animationFrameId = null;
        
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const easeProgress = progress * (2 - progress);
            setCount(Math.floor(easeProgress * end));
            if (progress < 1) {
                animationFrameId = window.requestAnimationFrame(step);
            } else {
                setCount(end);
            }
        };
        animationFrameId = window.requestAnimationFrame(step);
        
        return () => {
            if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
        }
    }, [value]);

    return <>{count}</>;
};

const SmoothCrawlerCounter = ({ value, isRunning, delayMs }) => {
    const [displayValue, setDisplayValue] = useState(value);
    
    useEffect(() => {
        const end = parseInt(value, 10);
        if (isNaN(end)) return;

        // If value resets/drops, snap immediately (no animation)
        if (end <= displayValue) {
            setDisplayValue(end);
            return;
        }

        // We animate when value INCREASES (even if the crawler just stopped for the final batch)
        const duration = Math.max(100, delayMs * 0.75);
        let startTimestamp = null;
        let animationFrameId = null;
        
        // Capture the start value when this animation triggers
        const startValue = displayValue;

        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            
            // Linear progression
            setDisplayValue(Math.floor(startValue + (end - startValue) * progress));
            
            if (progress < 1) {
                animationFrameId = window.requestAnimationFrame(step);
            } else {
                setDisplayValue(end);
            }
        };

        animationFrameId = window.requestAnimationFrame(step);

        return () => {
            if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, isRunning]); // omitted displayValue, delayMs to avoid unnecessary resets

    return <>{displayValue}</>;
};

function AdminDashboard({ onBack, movies = [], onMovieAdded }) {
    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [guestsLimit, setGuestsLimit] = useState(10);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null); // The user object being inspected
    const [userData, setUserData] = useState({ movies: [], collections: [] });
    const [userLoading, setUserLoading] = useState(false);
    const [activeSubTab, setActiveSubTab] = useState('movies'); // 'movies' | 'collections'
    const [selectedMovie, setSelectedMovie] = useState(null);
    const [expandedCollectionId, setExpandedCollectionId] = useState(null);
    const [expandedCollection, setExpandedCollection] = useState(null);
    const [syncStatus, setSyncStatus] = useState(null);
    const [error, setError] = useState(null);

    // Crawler States
    const [crawlerSettings, setCrawlerSettings] = useState({ enabled: false, ratePerHour: 60, currentStatus: 'Idle', totalCached: 0 });
    const [updatingCrawler, setUpdatingCrawler] = useState(false);

    // Fast Crawler States
    const [fastCrawler, setFastCrawler] = useState({
        isRunning: false,
        pagesCrawled: 0,
        totalPages: 0,
        totalImported: 0,
        logs: [],
        currentCategory: '',
        shouldStop: false
    });
    const [fcPages, setFcPages] = useState(() => parseInt(localStorage.getItem('admin_fcPages')) || 5);
    const [fcCategories, setFcCategories] = useState(() => {
        const saved = localStorage.getItem('admin_fcCategories');
        return saved ? JSON.parse(saved) : ['films', 'series', 'cartoons', 'animation'];
    });
    const [fcDelay, setFcDelay] = useState(() => parseInt(localStorage.getItem('admin_fcDelay')) || 5000);
    const [startingFC, setStartingFC] = useState(false);

    // Recently Scraped Movies States
    const [isRealtime, setIsRealtime] = useState(false);
    const [recentFastScraped, setRecentFastScraped] = useState([]);
    const [fastScrapedLimit, setFastScrapedLimit] = useState(10);
    const [recentDetailedScraped, setRecentDetailedScraped] = useState([]);
    const [detailedScrapedLimit, setDetailedScrapedLimit] = useState(10);
    const [selectedFastMovies, setSelectedFastMovies] = useState([]);
    const [selectedDetailedMovies, setSelectedDetailedMovies] = useState([]);
    const [refreshState, setRefreshState] = useState({ isRefreshing: false, progress: 0, total: 0, type: null });
    const [systemSettings, setSystemSettings] = useState({ matrixPhrases: ['searching trailers', 'preparing video', 'please wait'], useSloganInMatrix: true, matrixAnimationType: '3D' });
    const [matrixPhrasesRaw, setMatrixPhrasesRaw] = useState('');
    const [savingSettings, setSavingSettings] = useState(false);
    const [showBrokenFast, setShowBrokenFast] = useState(false);
    const [showBrokenDetailed, setShowBrokenDetailed] = useState(false);
    const [bulkRefreshDelay, setBulkRefreshDelay] = useState(() => parseInt(localStorage.getItem('admin_bulkRefreshDelay')) || 2);

    // Save local settings to localStorage
    useEffect(() => {
        localStorage.setItem('admin_fcPages', fcPages.toString());
        localStorage.setItem('admin_fcCategories', JSON.stringify(fcCategories));
        localStorage.setItem('admin_fcDelay', fcDelay.toString());
        localStorage.setItem('admin_bulkRefreshDelay', bulkRefreshDelay.toString());
    }, [fcPages, fcCategories, fcDelay, bulkRefreshDelay]);
    
    // Broken Movies Repair State
    const [brokenStats, setBrokenStats] = useState({ count: 0 });
    const [isRepairing, setIsRepairing] = useState(false);
    const isRepairingRef = useRef(false);

    const handleDeleteScrapedMovies = async (links, type) => {
        if (!window.confirm(`Are you sure you want to delete ${links.length} movie(s) from the database?`)) return;
        try {
            const res = await fetch('/api/admin/scraped-movies/delete', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}` 
                },
                body: JSON.stringify({ links })
            });
            if (res.ok) {
                fetchRecentScraped();
                if (type === 'fast') setSelectedFastMovies([]);
                if (type === 'detailed') setSelectedDetailedMovies([]);
            } else {
                const data = await res.json();
                alert(`Error: ${data.error}`);
            }
        } catch (e) {
            console.error('Failed to delete movies:', e);
            alert('Failed to delete movies');
        }
    };

    const handleRefreshScrapedMovies = async (links, type) => {
        if (refreshState.isRefreshing) return;
        setRefreshState({ isRefreshing: true, progress: 0, total: links.length, type });

        for (let i = 0; i < links.length; i++) {
            try {
                const res = await fetch('/api/admin/scraped-movies/refresh', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}` 
                    },
                    body: JSON.stringify({ links: [links[i]] })
                });

                if (res.ok) {
                    setRefreshState(prev => ({ ...prev, progress: i + 1 }));
                    fetchRecentScraped();
                } else {
                    const data = await res.json();
                    console.error(`Error refreshing ${links[i]}:`, data.error);
                }

                if (i < links.length - 1) {
                    const delayMs = Math.max(1000, bulkRefreshDelay * 1000 + (Math.random() * 1500));
                    await new Promise(r => setTimeout(r, delayMs)); // Configurable delay + random jitter
                }
            } catch (e) {
                console.error(`Failed to refresh ${links[i]}:`, e);
            }
        }

        setRefreshState({ isRefreshing: false, progress: 0, total: 0, type: null });
        if (type === 'fast') setSelectedFastMovies([]);
        if (type === 'detailed') setSelectedDetailedMovies([]);
    };

    const fetchBrokenStats = async () => {
        try {
            const res = await fetch('/api/admin/broken-movies/stats', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) setBrokenStats(await res.json());
        } catch (e) {
            console.error('Failed to fetch broken stats:', e);
        }
    };

    const handleStartRepair = async () => {
        if (isRepairingRef.current) return;
        isRepairingRef.current = true;
        setIsRepairing(true);

        while (isRepairingRef.current) {
            try {
                const res = await fetch(`/api/admin/recent-scraped?limit=20&broken=true`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                if (!res.ok) break;
                const brokenMovies = await res.json();
                
                if (brokenMovies.length === 0) break;

                for (let i = 0; i < brokenMovies.length; i++) {
                    if (!isRepairingRef.current) break;
                    
                    await fetch('/api/admin/scraped-movies/refresh', {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('token')}` 
                        },
                        body: JSON.stringify({ links: [brokenMovies[i].link] })
                    });

                    fetchBrokenStats();
                    fetchRecentScraped();

                    const delayMs = Math.max(1000, bulkRefreshDelay * 1000 + (Math.random() * 1500));
                    await new Promise(r => setTimeout(r, delayMs));
                }
            } catch (e) {
                console.error('Repair error:', e);
                break;
            }
        }

        isRepairingRef.current = false;
        setIsRepairing(false);
        fetchBrokenStats();
    };

    const handleStopRepair = () => {
        isRepairingRef.current = false;
        setIsRepairing(false);
    };

    const fetchRecentScraped = async () => {
        try {
            const resFast = await fetch(`/api/admin/recent-scraped?limit=${fastScrapedLimit}&type=fast&broken=${showBrokenFast}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (resFast.ok) setRecentFastScraped(await resFast.json());

            const resDetailed = await fetch(`/api/admin/recent-scraped?limit=${detailedScrapedLimit}&type=detailed&broken=${showBrokenDetailed}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (resDetailed.ok) setRecentDetailedScraped(await resDetailed.json());
        } catch (e) {
            console.error('Failed to fetch recent scraped movies:', e);
        }
    };

    // Re-fetch when limits change
    useEffect(() => {
        if (stats) {
            fetchRecentScraped();
            if (!isRepairingRef.current) fetchBrokenStats();
        }
    }, [fastScrapedLimit, detailedScrapedLimit, showBrokenFast, showBrokenDetailed]);

    const hasInitiallyFetchedRef = useRef(false);
    
    // Initial load
    useEffect(() => {
        // Only run once when stats initially loads
        if (stats && !isRepairingRef.current && !hasInitiallyFetchedRef.current) {
            hasInitiallyFetchedRef.current = true;
            fetchRecentScraped();
            fetchBrokenStats();
        }
    }, [stats]);

    // Inline Admin Operations State (No native popups!)
    const [confirmDeleteUserId, setConfirmDeleteUserId] = useState(null);
    const [resetPasswordUserId, setResetPasswordUserId] = useState(null);
    const [newPasswordVal, setNewPasswordVal] = useState('');
    const [adminFeedback, setAdminFeedback] = useState({ id: null, type: '', message: '' });

    // Poll Fast Crawler status
    useEffect(() => {
        let fcInterval = null;
        const fetchStatus = async () => {
            try {
                const res = await fetch('/api/admin/fast-crawler/status');
                if (res.ok) {
                    const data = await res.json();
                    setFastCrawler(data);
                    
                    setStats(prev => {
                        if (!prev) return prev;
                        
                        const newTotalCached = data.totalCached !== undefined ? data.totalCached : prev.totalCached;
                        const newMissing = data.missingDescriptions !== undefined ? data.missingDescriptions : prev.missingDescriptions;
                        
                        const hasChanges = newTotalCached !== prev.totalCached || newMissing !== prev.missingDescriptions;
                        
                        if ((data.isRunning || isRealtime) && hasChanges) {
                            fetchRecentScraped();
                        }
                        
                        if (hasChanges) {
                            return { ...prev, totalCached: newTotalCached, missingDescriptions: newMissing };
                        }
                        return prev;
                    });
                    
                    setCrawlerSettings(prev => {
                        if (data.totalCached !== undefined && prev.totalCached !== data.totalCached) {
                            return { ...prev, totalCached: data.totalCached };
                        }
                        return prev;
                    });
                }
            } catch (e) {
                console.error('Failed to poll fast crawler status:', e);
            }
        };

        fetchStatus(); // fetch immediately on mount
        if (fastCrawler.isRunning || isRealtime) {
            fcInterval = setInterval(fetchStatus, 2500);
        } else {
            fcInterval = setInterval(fetchStatus, 6000); // slower polling when idle
        }

        return () => {
            if (fcInterval) clearInterval(fcInterval);
        };
    }, [fastCrawler.isRunning, stats, isRealtime]);

    const handleStartFastCrawler = async () => {
        setStartingFC(true);
        try {
            const res = await fetch('/api/admin/fast-crawler/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pages: fcPages,
                    categories: fcCategories,
                    pageDelay: fcDelay
                })
            });
            if (res.ok) {
                setFastCrawler(prev => ({ ...prev, isRunning: true, logs: ['[System] Initiating crawler...'] }));
            }
        } catch (err) {
            console.error('Failed to start fast crawler:', err);
        } finally {
            setStartingFC(false);
        }
    };

    const handleStopFastCrawler = async () => {
        try {
            await fetch('/api/admin/fast-crawler/stop', { method: 'POST' });
        } catch (err) {
            console.error('Failed to stop fast crawler:', err);
        }
    };

    const fetchAdminData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [statsRes, usersRes, syncRes, crawlerRes, settingsRes] = await Promise.all([
                fetch('/api/admin/stats'),
                fetch('/api/admin/users'),
                fetch('/api/admin/sync-status'),
                fetch('/api/admin/crawler-settings'),
                fetch(`/api/settings/public?t=${Date.now()}`),
                fetchRecentScraped()
            ]);
            
            if (!statsRes.ok) {
                const errData = await statsRes.json().catch(() => ({}));
                throw new Error(errData.error || `Failed to fetch global stats (HTTP ${statsRes.status})`);
            }
            if (!usersRes.ok) {
                const errData = await usersRes.json().catch(() => ({}));
                throw new Error(errData.error || `Failed to fetch registered users list (HTTP ${usersRes.status})`);
            }
            
            setStats(await statsRes.json());
            setUsers(await usersRes.json());
            
            if (syncRes.ok) {
                setSyncStatus(await syncRes.json());
            }
            if (crawlerRes.ok) {
                setCrawlerSettings(await crawlerRes.json());
            }
            if (settingsRes && settingsRes.ok) {
                const settingsData = await settingsRes.json();
                if (settingsData.matrixPhrases) {
                    setSystemSettings({
                        matrixPhrases: settingsData.matrixPhrases,
                        useSloganInMatrix: settingsData.useSloganInMatrix !== undefined ? settingsData.useSloganInMatrix : true,
                        matrixAnimationType: settingsData.matrixAnimationType || '3D'
                    });
                    setMatrixPhrasesRaw(settingsData.matrixPhrases.join(', '));
                }
            }
        } catch (err) {
            console.error('Failed to fetch admin stats:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAdminData();
    }, []);

    // Live update loop for crawler status when enabled
    useEffect(() => {
        let intervalId = null;
        if (crawlerSettings.enabled && !selectedUser) {
            intervalId = setInterval(async () => {
                try {
                    const res = await fetch('/api/admin/crawler-settings');
                    if (res.ok) {
                        const data = await res.json();
                        setCrawlerSettings(data);
                        
                        setStats(prev => {
                            if (!prev) return prev;
                            
                            const hasChanges = prev.totalCached !== data.totalCached || prev.missingDescriptions !== data.partiallyScraped;
                            
                            if (hasChanges) {
                                // Refresh recent list to show newly populated descriptions
                                fetchRecentScraped();
                                return { ...prev, totalCached: data.totalCached, missingDescriptions: data.partiallyScraped };
                            }
                            return prev;
                        });
                    }
                } catch (e) {
                    console.error('Failed to poll crawler settings:', e);
                }
            }, 3000);
        }
        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [crawlerSettings.enabled, selectedUser]);

    const handleUpdateCrawler = async (updatedFields) => {
        setUpdatingCrawler(true);
        try {
            const body = {
                enabled: updatedFields.enabled !== undefined ? updatedFields.enabled : crawlerSettings.enabled,
                ratePerHour: updatedFields.ratePerHour !== undefined ? updatedFields.ratePerHour : crawlerSettings.ratePerHour
            };
            const res = await fetch('/api/admin/crawler-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (res.ok) {
                const data = await res.json();
                setCrawlerSettings(data);
                if (stats) {
                    setStats(prev => ({ ...prev, totalCached: data.totalCached }));
                }
            }
        } catch (err) {
            console.error('Failed to update background crawler settings:', err);
        } finally {
            setUpdatingCrawler(false);
        }
    };

    const handleInspectUser = async (user) => {
        setSelectedUser(user);
        setUserLoading(true);
        setActiveSubTab('movies');
        setExpandedCollectionId(null);
        try {
            const res = await fetch(`/api/admin/users/${user.id}/data`);
            if (res.ok) {
                setUserData(await res.json());
            }
        } catch (err) {
            console.error('Failed to fetch user library data:', err);
        } finally {
            setUserLoading(false);
        }
    };

    const handleBackToUsers = () => {
        setSelectedUser(null);
        setUserData({ movies: [], collections: [] });
    };

    const handleResetPassword = async (user) => {
        const passToUse = newPasswordVal.trim() || 'Reset123!';
        try {
            const res = await fetch(`/api/admin/users/${user.id}/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newPassword: passToUse })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to reset password');
            
            setAdminFeedback({
                id: user.id,
                type: 'success',
                message: `✔ Password reset to: "${data.newPassword}"`
            });
            setResetPasswordUserId(null);
            setNewPasswordVal('');
            setTimeout(() => setAdminFeedback({ id: null, type: '', message: '' }), 6000);
        } catch (err) {
            setAdminFeedback({ id: user.id, type: 'error', message: `Error: ${err.message}` });
            setTimeout(() => setAdminFeedback({ id: null, type: '', message: '' }), 4000);
        }
    };

    const handleDeleteUser = async (user) => {
        try {
            const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to delete user');
            
            setAdminFeedback({
                id: user.id,
                type: 'success',
                message: `✔ User @${user.username} deleted.`
            });
            setConfirmDeleteUserId(null);
            fetchAdminData();
            setTimeout(() => setAdminFeedback({ id: null, type: '', message: '' }), 4000);
        } catch (err) {
            setAdminFeedback({ id: user.id, type: 'error', message: `Error: ${err.message}` });
            setTimeout(() => setAdminFeedback({ id: null, type: '', message: '' }), 4000);
        }
    };

    const handleSaveSettings = async () => {
        setSavingSettings(true);
        try {
            const res = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}` 
                },
                body: JSON.stringify({
                    matrixPhrases: matrixPhrasesRaw.split(',').map(s => s.trim()).filter(Boolean),
                    useSloganInMatrix: systemSettings.useSloganInMatrix,
                    matrixAnimationType: systemSettings.matrixAnimationType
                })
            });
            if (!res.ok) throw new Error('Failed to save settings');
            
            // Invalidate frontend cache for matrix settings
            window.dispatchEvent(new Event('matrixSettingsUpdated'));
            
            setAdminFeedback({ id: 'settings', type: 'success', message: 'Настройки успешно сохранены!' });
            setTimeout(() => setAdminFeedback({ id: null, type: '', message: '' }), 3000);
        } catch (err) {
            setAdminFeedback({ id: 'settings', type: 'error', message: err.message });
        } finally {
            setSavingSettings(false);
        }
    };

    return (
        <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            {selectedMovie && (
                <MovieDetailsModal
                    movie={selectedMovie}
                    onClose={() => setSelectedMovie(null)}
                    onUpdate={(id, updates) => {
                        setSelectedMovie(prev => prev ? { ...prev, ...updates } : prev);
                        setRecentFastScraped(prev => prev.map(m => m.link === updates.link ? { ...m, ...updates } : m));
                        setRecentDetailedScraped(prev => prev.map(m => m.link === updates.link ? { ...m, ...updates } : m));
                    }}
                    onDelete={() => {}}
                    isTrashMode={false}
                    readOnly={false}
                    isAdded={!!movies.find(m => (m.link || '').split('#')[0].replace(/\/$/, '') === (selectedMovie.link || '').split('#')[0].replace(/\/$/, '') && !m.deleted_at)}
                    libMovieId={movies.find(m => (m.link || '').split('#')[0].replace(/\/$/, '') === (selectedMovie.link || '').split('#')[0].replace(/\/$/, '') && !m.deleted_at)?.id}
                    onAddMovie={async (link) => {
                        try {
                            const token = localStorage.getItem('token');
                            await fetch('/api/movies', {
                                method: 'POST',
                                headers: { 
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}` 
                                },
                                body: JSON.stringify({ link })
                            });
                            if (onMovieAdded) onMovieAdded();
                        } catch (e) {
                            console.error('Failed to add movie from admin dashboard', e);
                        }
                    }}
                />
            )}

            {/* Header section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <button
                        onClick={selectedUser ? handleBackToUsers : onBack}
                        className="btn btn-ghost"
                        style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '8px 15px', borderRadius: '8px' }}
                    >
                        {selectedUser ? '← Back to User List' : '← Back to Library'}
                    </button>
                    <h2 style={{ margin: 0, fontSize: '2rem', color: '#fff' }}>
                        👑 {selectedUser ? `Inspect @${selectedUser.username}` : 'Admin Dashboard'}
                    </h2>
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '50px', color: '#888' }}>
                    <div style={{
                        display: 'inline-block',
                        width: '30px',
                        height: '30px',
                        border: '3px solid rgba(255,255,255,0.1)',
                        borderTopColor: 'var(--accent-gold)',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        marginBottom: '15px'
                    }}></div>
                    <div style={{ fontSize: '0.95rem' }}>Loading Admin Panel...</div>
                    <style>{`
                        @keyframes spin {
                            to { transform: rotate(360deg); }
                        }
                    `}</style>
                </div>
            ) : error ? (
                <div className="glass-panel animate-fade-in" style={{
                    padding: '40px 30px',
                    borderRadius: '15px',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    background: 'rgba(239, 68, 68, 0.05)',
                    textAlign: 'center',
                    maxWidth: '500px',
                    margin: '40px auto',
                    color: '#f87171'
                }}>
                    <div style={{ fontSize: '3rem', marginBottom: '15px' }}>⚠️</div>
                    <h3 style={{ margin: '0 0 10px 0', color: '#fff', fontSize: '1.3rem' }}>Connection or Access Error</h3>
                    <p style={{ color: '#aaa', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '25px' }}>
                        {error}
                    </p>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                        <button onClick={fetchAdminData} className="btn btn-gold" style={{ padding: '10px 20px' }}>
                            🔄 Retry Loading
                        </button>
                        <button onClick={onBack} className="btn" style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.05)', color: '#fff' }}>
                            Go Back
                        </button>
                    </div>
                </div>
            ) : !selectedUser ? (
                // VIEW 1: Main Stats and Users List
                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                    {/* Supabase Sync Status / Warnings */}
                    {syncStatus && syncStatus.supabaseConfigured && syncStatus.status === 'Failed' && (
                        <div className="glass-panel animate-fade-in" style={{
                            padding: '20px',
                            borderRadius: '12px',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            background: 'rgba(239, 68, 68, 0.05)',
                            color: '#f87171',
                            fontSize: '0.9rem',
                            lineHeight: '1.6'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold', marginBottom: '8px', fontSize: '1.05rem' }}>
                                ⚠️ Cloud Database Sync is Failing!
                            </div>
                            <div style={{ color: '#ccc', marginBottom: '10px' }}>
                                Your SQLite database backup is currently failing to upload to Supabase because the provided API key <strong>is invalid or has expired permissions</strong> (error: <code>{syncStatus.error}</code>).
                            </div>
                            <div style={{ borderLeft: '3px solid var(--accent-gold)', paddingLeft: '12px', fontSize: '0.85rem', color: '#aaa' }}>
                                💡 <strong>To fix this and prevent account resets when Render sleeps:</strong> Please replace your Supabase anon/service-role API key (starts with <code>eyJ...</code>) in your environment variables. Do not use local bootstrap keys starting with <code>sb_publishable_...</code>.
                            </div>
                        </div>
                    )}

                    {syncStatus && syncStatus.supabaseConfigured && syncStatus.status === 'Success' && (
                        <div className="glass-panel animate-fade-in" style={{
                            padding: '12px 20px',
                            borderRadius: '12px',
                            border: '1px solid rgba(3, 218, 198, 0.2)',
                            background: 'rgba(3, 218, 198, 0.03)',
                            color: '#03dac6',
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '10px'
                        }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                🟢 Cloud database backup is fully active and synced with Supabase.
                            </span>
                            <span style={{ color: '#888', fontSize: '0.8rem' }}>
                                Last Sync: {syncStatus.time ? new Date(syncStatus.time).toLocaleTimeString() : 'N/A'}
                            </span>
                        </div>
                    )}

                    {syncStatus && !syncStatus.supabaseConfigured && (
                        <div className="glass-panel animate-fade-in" style={{
                            padding: '12px 20px',
                            borderRadius: '12px',
                            border: '1px solid rgba(255,255,255,0.06)',
                            background: 'rgba(255,255,255,0.01)',
                            color: '#aaa',
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '10px'
                        }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                ☁️ Cloud Backup is not configured. Running in local-only mode.
                            </span>
                            <span style={{ color: '#666', fontSize: '0.8rem' }}>
                                (Set SUPABASE_URL and SUPABASE_KEY to enable cloud backups)
                            </span>
                        </div>
                    )}

                    {/* Stats Grid */}
                    {stats && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '15px' }}>
                            <div className="glass-panel" style={{ padding: '20px 10px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                                <div style={{ fontSize: '2.5rem', color: 'var(--accent-gold)', fontWeight: 'bold', marginBottom: '5px' }}>
                                    {stats.totalUsers}
                                </div>
                                <div style={{ color: '#888', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Total Users
                                </div>
                            </div>
                            <div className="glass-panel" style={{ padding: '20px 10px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                                <div style={{ fontSize: '2.5rem', color: '#03dac6', fontWeight: 'bold', marginBottom: '5px' }}>
                                    {stats.totalMovies}
                                </div>
                                <div style={{ color: '#888', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Total Library Movies
                                </div>
                            </div>
                            <div className="glass-panel" style={{ padding: '20px 10px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                                <div style={{ fontSize: '2.5rem', color: '#ff6b6b', fontWeight: 'bold', marginBottom: '5px' }}>
                                    {stats.totalCollections}
                                </div>
                                <div style={{ color: '#888', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Total Collections
                                </div>
                            </div>
                            <div className="glass-panel" style={{ padding: '20px 10px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                                <div style={{ fontSize: '2.5rem', color: '#e5c158', fontWeight: 'bold', marginBottom: '5px' }}>
                                    <SmoothCrawlerCounter value={stats.totalCached || 0} isRunning={fastCrawler.isRunning} delayMs={fcDelay} />
                                </div>
                                <div style={{ color: '#888', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Global Cached (Rezka)
                                </div>
                            </div>
                            <div className="glass-panel" style={{ padding: '20px 10px', borderRadius: '15px', border: '1px solid rgba(59,130,246,0.2)', background: 'rgba(59,130,246,0.05)', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <div style={{ fontSize: '2.5rem', color: '#3b82f6', fontWeight: 'bold', marginBottom: '5px' }}>
                                    <AnimatedCounter value={stats.missingDescriptions || 0} />
                                </div>
                                <div style={{ color: '#93c5fd', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: (stats.missingDescriptions > 0 || crawlerSettings.enabled) ? '10px' : '0' }}>
                                    No Description
                                </div>
                                {stats.missingDescriptions > 0 && !crawlerSettings.enabled && (
                                    <button 
                                        onClick={() => handleUpdateCrawler({ enabled: true })}
                                        style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', width: 'fit-content', margin: '0 auto' }}
                                    >
                                        ▶️ Load ({crawlerSettings.ratePerHour}/h)
                                    </button>
                                )}
                                {crawlerSettings.enabled && (
                                    <button 
                                        onClick={() => handleUpdateCrawler({ enabled: false })}
                                        style={{ background: 'transparent', border: '1px solid #3b82f6', color: '#3b82f6', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', width: 'fit-content', margin: '0 auto' }}
                                    >
                                        ⏸ Stop
                                    </button>
                                )}
                            </div>
                            <div className="glass-panel" style={{ padding: '20px 10px', borderRadius: '15px', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <div style={{ fontSize: '2.5rem', color: '#ef4444', fontWeight: 'bold', marginBottom: '5px' }}>
                                    <AnimatedCounter value={brokenStats.count || 0} />
                                </div>
                                <div style={{ color: '#fca5a5', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: brokenStats.count > 0 ? '10px' : '0' }}>
                                    Broken Movies
                                </div>
                                {brokenStats.count > 0 && !isRepairing && (
                                    <button 
                                        onClick={handleStartRepair}
                                        style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', width: 'fit-content', margin: '0 auto' }}
                                    >
                                        ▶️ Repair ({bulkRefreshDelay}s)
                                    </button>
                                )}
                                {isRepairing && (
                                    <button 
                                        onClick={handleStopRepair}
                                        style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', width: 'fit-content', margin: '0 auto' }}
                                    >
                                        ⏸ Stop
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Background Crawler Control Card */}
                    <div className="glass-panel animate-fade-in" style={{
                        borderRadius: '15px',
                        padding: '25px',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        background: 'rgba(255, 255, 255, 0.01)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontSize: '1.8rem' }}>🤖</span>
                                <div>
                                    <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        Background Movie Crawler
                                        <span className="crawler-status-indicator" style={{
                                            display: 'inline-block',
                                            width: '8px',
                                            height: '8px',
                                            borderRadius: '50%',
                                            background: crawlerSettings.enabled ? '#03dac6' : 'rgba(255,255,255,0.2)',
                                            boxShadow: crawlerSettings.enabled ? '0 0 10px #03dac6' : 'none'
                                        }}></span>
                                    </h3>
                                    <p style={{ margin: '3px 0 0 0', color: '#888', fontSize: '0.85rem' }}>
                                        Automatically index random movies from HDRezka into the global site cache in the background
                                    </p>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <button
                                    onClick={() => handleUpdateCrawler({ enabled: !crawlerSettings.enabled })}
                                    disabled={updatingCrawler}
                                    className={`btn ${crawlerSettings.enabled ? 'btn-ghost' : 'btn-gold'}`}
                                    style={{
                                        padding: '8px 20px',
                                        borderRadius: '8px',
                                        fontWeight: 600,
                                        fontSize: '0.85rem',
                                        border: crawlerSettings.enabled ? '1px solid rgba(239, 68, 68, 0.4)' : 'none',
                                        color: crawlerSettings.enabled ? '#f87171' : '#000',
                                        background: crawlerSettings.enabled ? 'rgba(239, 68, 68, 0.05)' : 'var(--accent-gold)'
                                    }}
                                >
                                    {updatingCrawler ? 'Updating...' : crawlerSettings.enabled ? '🔴 Stop Crawler' : '🟢 Start Crawler'}
                                </button>
                            </div>
                        </div>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                            gap: '20px',
                            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                            paddingTop: '20px'
                        }}>
                            {/* Left Settings Control */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div>
                                    <label style={{ color: '#ccc', fontSize: '0.9rem', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                                        Scraping Speed (Requests Limit):
                                    </label>
                                    <select
                                        value={crawlerSettings.ratePerHour}
                                        onChange={(e) => handleUpdateCrawler({ ratePerHour: parseInt(e.target.value) })}
                                        disabled={updatingCrawler}
                                        style={{
                                            width: '100%',
                                            padding: '10px 12px',
                                            background: 'rgba(0, 0, 0, 0.4)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            color: '#fff',
                                            borderRadius: '8px',
                                            fontSize: '0.9rem',
                                            outline: 'none',
                                            cursor: 'pointer'
                                        }}
                                        <option value="60">60 movies / hour (~60 sec delay - Safe)</option>
                                        <option value="120">120 movies / hour (~30 sec delay - Normal)</option>
                                        <option value="240">240 movies / hour (~15 sec delay - Fast)</option>
                                        <option value="600">600 movies / hour (~6 sec delay - TMDB Turbo)</option>
                                        <option value="1200">1200 movies / hour (~3 sec delay - TMDB Ultra)</option>
                                        <option value="3600">3600 movies / hour (1 sec delay - TMDB Max Speed)</option>
                                    </select>
                                </div>

                                <div style={{
                                    fontSize: '0.8rem',
                                    color: '#888',
                                    lineHeight: '1.5',
                                    background: 'rgba(255, 255, 255, 0.01)',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(255, 255, 255, 0.02)'
                                }}>
                                    💡 <strong>Smart Safety Measures:</strong> The crawler uses TMDB (40 req/sec allowed limit) for descriptions and only hits HDRezka 1 time per catalog page. High speeds like 3600/hr are now <strong>100% safe from bans!</strong>
                                </div>
                            </div>

                            {/* Right Status Panel */}
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px',
                                background: 'rgba(0, 0, 0, 0.25)',
                                padding: '15px 20px',
                                borderRadius: '10px',
                                border: crawlerSettings.blockedUntil ? '1px solid rgba(251, 146, 60, 0.4)' : '1px solid rgba(255, 255, 255, 0.03)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                                    <span style={{ color: '#888' }}>Total Global Cache:</span>
                                    <span style={{ color: '#e5c158', fontWeight: 'bold' }}>🎬 {crawlerSettings.totalCached || 0} movies</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                                    <span style={{ color: '#888' }}>Without Description:</span>
                                    <span style={{ color: crawlerSettings.partiallyScraped > 0 ? '#ff6b6b' : '#03dac6', fontWeight: 'bold' }}>
                                        ⚠️ {crawlerSettings.partiallyScraped ?? 0} movies
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                                    <span style={{ color: '#888' }}>Average delay:</span>
                                    <span style={{ color: '#aaa' }}>{((3600 / crawlerSettings.ratePerHour)).toFixed(0)} seconds</span>
                                </div>

                                {/* Consecutive error counter */}
                                {crawlerSettings.enabled && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                                        <span style={{ color: '#888' }}>Error streak:</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {[1,2,3,4,5].map(i => (
                                                <div key={i} style={{
                                                    width: '10px', height: '10px', borderRadius: '50%',
                                                    background: (crawlerSettings.consecutiveErrors || 0) >= i
                                                        ? (crawlerSettings.consecutiveErrors >= 5 ? '#fb923c' : '#facc15')
                                                        : 'rgba(255,255,255,0.1)',
                                                    transition: 'background 0.3s'
                                                }} />
                                            ))}
                                            <span style={{ color: (crawlerSettings.consecutiveErrors || 0) >= 5 ? '#fb923c' : '#aaa', fontSize: '0.8rem' }}>
                                                {crawlerSettings.consecutiveErrors || 0}/5
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Auto-pause alert banner */}
                                {crawlerSettings.blockedUntil && (
                                    <div style={{
                                        background: 'rgba(251, 146, 60, 0.1)',
                                        border: '1px solid rgba(251, 146, 60, 0.4)',
                                        borderRadius: '8px',
                                        padding: '8px 12px',
                                        fontSize: '0.8rem',
                                        color: '#fb923c',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}>
                                        <span style={{ fontSize: '1rem' }}>⏸</span>
                                        <div>
                                            <div style={{ fontWeight: 700 }}>Auto-paused (IP block detected)</div>
                                            <div style={{ color: '#aaa', marginTop: '2px' }}>
                                                Resuming at {new Date(crawlerSettings.blockedUntil).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '5px' }}>
                                    <span style={{ color: '#888', fontSize: '0.8rem', fontWeight: 600 }}>Live Crawler Status:</span>
                                    <div style={{
                                        background: 'rgba(0,0,0,0.3)',
                                        padding: '8px 12px',
                                        borderRadius: '6px',
                                        fontFamily: 'monospace',
                                        fontSize: '0.82rem',
                                        color: crawlerSettings.blockedUntil ? '#fb923c' : (crawlerSettings.enabled ? '#03dac6' : '#888'),
                                        borderLeft: crawlerSettings.blockedUntil ? '3px solid #fb923c' : (crawlerSettings.enabled ? '3px solid #03dac6' : '3px solid #555'),
                                        wordBreak: 'break-all',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }} title={crawlerSettings.currentStatus}>
                                        {crawlerSettings.currentStatus}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bulk Fast Crawler Card */}
                    <div className="glass-panel animate-fade-in" style={{
                        borderRadius: '15px',
                        padding: '25px',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        background: 'rgba(255, 255, 255, 0.01)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontSize: '1.8rem' }}>⚡</span>
                                <div>
                                    <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        Bulk Fast Crawler
                                        <span className="crawler-status-indicator" style={{
                                            display: 'inline-block',
                                            width: '8px',
                                            height: '8px',
                                            borderRadius: '50%',
                                            background: fastCrawler.isRunning ? '#03dac6' : 'rgba(255,255,255,0.2)',
                                            boxShadow: fastCrawler.isRunning ? '0 0 10px #03dac6' : 'none'
                                        }}></span>
                                    </h3>
                                    <p style={{ margin: '3px 0 0 0', color: '#888', fontSize: '0.85rem' }}>
                                        Index entire catalog pages of 36 movies at a time (36x faster) to instantly fill your database
                                    </p>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                {fastCrawler.isRunning ? (
                                    <button
                                        onClick={handleStopFastCrawler}
                                        className="btn"
                                        style={{
                                            padding: '8px 20px',
                                            borderRadius: '8px',
                                            fontWeight: 600,
                                            fontSize: '0.85rem',
                                            border: '1px solid rgba(239, 68, 68, 0.4)',
                                            color: '#f87171',
                                            background: 'rgba(239, 68, 68, 0.08)',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        🛑 Stop Crawler
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleStartFastCrawler}
                                        disabled={startingFC || fcCategories.length === 0}
                                        className="btn btn-gold"
                                        style={{
                                            padding: '8px 20px',
                                            borderRadius: '8px',
                                            fontWeight: 600,
                                            fontSize: '0.85rem',
                                            background: 'var(--accent-gold)',
                                            color: '#000',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {startingFC ? 'Starting...' : '🚀 Launch Fast Crawler'}
                                    </button>
                                )}
                            </div>
                        </div>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                            gap: '20px',
                            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                            paddingTop: '20px'
                        }}>
                            {/* Left Settings Control */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div>
                                    <label style={{ color: '#ccc', fontSize: '0.9rem', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                                        Pages to Crawl (per category):
                                    </label>
                                    <select
                                        value={fcPages}
                                        onChange={(e) => setFcPages(parseInt(e.target.value))}
                                        disabled={fastCrawler.isRunning}
                                        style={{
                                            width: '100%',
                                            padding: '10px 12px',
                                            background: 'rgba(0, 0, 0, 0.4)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            color: '#fff',
                                            borderRadius: '8px',
                                            fontSize: '0.9rem',
                                            outline: 'none',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <option value="1">1 page (~36 movies)</option>
                                        <option value="2">2 pages (~72 movies)</option>
                                        <option value="5">5 pages (~180 movies)</option>
                                        <option value="10">10 pages (~360 movies)</option>
                                        <option value="25">25 pages (~900 movies)</option>
                                        <option value="50">50 pages (~1,800 movies)</option>
                                    </select>
                                </div>

                                <div>
                                    <label style={{ color: '#ccc', fontSize: '0.9rem', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                                        Target Categories:
                                    </label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        {['films', 'series', 'cartoons', 'animation'].map(cat => {
                                            const labelMap = { films: 'Films', series: 'Series', cartoons: 'Cartoons', animation: 'Anime' };
                                            const isSelected = fcCategories.includes(cat);
                                            return (
                                                <button
                                                    key={cat}
                                                    disabled={fastCrawler.isRunning}
                                                    onClick={() => {
                                                        if (isSelected) {
                                                            setFcCategories(prev => prev.filter(c => c !== cat));
                                                        } else {
                                                            setFcCategories(prev => [...prev, cat]);
                                                        }
                                                    }}
                                                    style={{
                                                        padding: '8px 10px',
                                                        borderRadius: '6px',
                                                        border: isSelected ? '1px solid var(--accent-gold)' : '1px solid rgba(255,255,255,0.06)',
                                                        background: isSelected ? 'rgba(212,175,55,0.1)' : 'rgba(0,0,0,0.2)',
                                                        color: isSelected ? 'var(--accent-gold)' : '#aaa',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                        textAlign: 'center'
                                                    }}
                                                >
                                                    {labelMap[cat]}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div>
                                    <label style={{ color: '#ccc', fontSize: '0.9rem', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                                        Delay Between Pages:
                                    </label>
                                    <select
                                        value={fcDelay}
                                        onChange={(e) => setFcDelay(parseInt(e.target.value))}
                                        disabled={fastCrawler.isRunning}
                                        style={{
                                            width: '100%',
                                            padding: '10px 12px',
                                            background: 'rgba(0, 0, 0, 0.4)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            color: '#fff',
                                            borderRadius: '8px',
                                            fontSize: '0.9rem',
                                            outline: 'none',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <option value="3000">3.0 seconds (Fast - Risk of rate limit)</option>
                                        <option value="5000">5.0 seconds (Balanced - Safe without Proxy)</option>
                                        <option value="8000">8.0 seconds (Polite - Recommended)</option>
                                        <option value="12000">12.0 seconds (Ultra Safe - Conservative)</option>
                                        <option value="60000">60.0 seconds (Live Mode)</option>
                                        <option value="300000">300.0 seconds (Slow Mode)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Right Telemetry & Console Log */}
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px',
                                background: 'rgba(0, 0, 0, 0.25)',
                                padding: '15px 20px',
                                borderRadius: '10px',
                                border: '1px solid rgba(255, 255, 255, 0.03)',
                                overflow: 'hidden'
                            }}>
                                {/* Progress bar */}
                                {fastCrawler.isRunning && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#aaa' }}>
                                            <span>Progress:</span>
                                            <span>{fastCrawler.pagesCrawled} / {fastCrawler.totalPages} pages ({Math.round((fastCrawler.pagesCrawled / fastCrawler.totalPages) * 100) || 0}%)</span>
                                        </div>
                                        <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                                            <div style={{
                                                width: `${((fastCrawler.pagesCrawled / fastCrawler.totalPages) * 100) || 0}%`,
                                                height: '100%',
                                                background: 'var(--accent-gold)',
                                                borderRadius: '3px',
                                                transition: 'width 0.4s ease'
                                            }} />
                                        </div>
                                    </div>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                                    <span style={{ color: '#888' }}>Status:</span>
                                    <span style={{ color: fastCrawler.isRunning ? '#03dac6' : '#888', fontWeight: 'bold' }}>
                                        {fastCrawler.isRunning ? `Crawling ${fastCrawler.currentCategory}...` : 'Idle'}
                                    </span>
                                </div>
                                
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                                    <span style={{ color: '#888' }}>Total Imported This Run:</span>
                                    <span style={{ color: '#e5c158', fontWeight: 'bold' }}>🎬 {fastCrawler.totalImported || 0} movies</span>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexGrow: 1 }}>
                                    <span style={{ color: '#888', fontSize: '0.8rem', fontWeight: 600 }}>Live Terminal Console:</span>
                                    <div style={{
                                        background: '#09090b',
                                        padding: '10px 12px',
                                        borderRadius: '8px',
                                        fontFamily: 'monospace',
                                        fontSize: '0.78rem',
                                        color: '#38bdf8',
                                        border: '1px solid rgba(255,255,255,0.03)',
                                        height: '100px',
                                        overflowY: 'auto',
                                        display: 'flex',
                                        flexDirection: 'column-reverse',
                                        gap: '4px',
                                        lineHeight: '1.4'
                                    }}>
                                        {[...fastCrawler.logs].reverse().map((log, idx) => (
                                            <div key={idx} style={{
                                                color: log.includes('✅') ? '#03dac6' : log.includes('❌') ? '#f87171' : log.includes('🚀') ? 'var(--accent-gold)' : '#38bdf8'
                                            }}>{log}</div>
                                        ))}
                                        {fastCrawler.logs.length === 0 && (
                                            <div style={{ color: '#555', fontStyle: 'italic' }}>Console output is empty. Launch the crawler to start streaming.</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Recently Scraped Movies Card - Fast Parser */}
                    <div className="glass-panel animate-fade-in" style={{
                        borderRadius: '15px',
                        padding: '20px',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        background: 'rgba(255, 255, 255, 0.01)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '15px'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                            <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                🚀 Fast Crawler Results <span style={{ fontSize: '0.8rem', color: '#888', fontWeight: 'normal' }}>(Basic Info Only)</span>
                            </h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#888', cursor: 'pointer', background: showBrokenFast ? 'rgba(239, 68, 68, 0.1)' : 'transparent', padding: '4px 8px', borderRadius: '6px', border: showBrokenFast ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid transparent' }}>
                                    <input type="checkbox" checked={showBrokenFast} onChange={e => setShowBrokenFast(e.target.checked)} />
                                    Broken
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '0.85rem', color: '#888' }}>~Delay (s):</span>
                                    <input 
                                        type="number" 
                                        min="1" max="60"
                                        value={bulkRefreshDelay} 
                                        onChange={e => setBulkRefreshDelay(parseInt(e.target.value) || 2)} 
                                        style={{ width: '55px', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.5)', color: '#fff' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '0.85rem', color: '#888' }}>Show:</span>
                                    <input 
                                        type="number" 
                                        min="1" max="999"
                                        value={fastScrapedLimit} 
                                        onChange={e => setFastScrapedLimit(parseInt(e.target.value) || 10)} 
                                        style={{ width: '70px', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.5)', color: '#fff' }}
                                    />
                                </div>
                                {selectedFastMovies.length > 0 && (
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button 
                                            onClick={() => handleRefreshScrapedMovies(selectedFastMovies, 'fast')}
                                            disabled={refreshState.isRefreshing}
                                            style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '8px', cursor: refreshState.isRefreshing ? 'not-allowed' : 'pointer', fontSize: '0.8rem', fontWeight: 'bold', opacity: refreshState.isRefreshing ? 0.7 : 1 }}
                                        >
                                            {refreshState.isRefreshing && refreshState.type === 'fast' 
                                                ? `🔄 Refreshing ${refreshState.progress} / ${refreshState.total}`
                                                : `🔄 Refresh (${selectedFastMovies.length})`
                                            }
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteScrapedMovies(selectedFastMovies, 'fast')}
                                            style={{ background: 'var(--danger)', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                                        >
                                            🗑 Delete ({selectedFastMovies.length})
                                        </button>
                                    </div>
                                )}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <button 
                                        onClick={fetchRecentScraped}
                                        className="btn"
                                        title="Refresh"
                                        style={{ fontSize: '0.8rem', color: '#34d399', background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.25)', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer' }}
                                    >
                                        🔄
                                    </button>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#888', cursor: 'pointer', background: isRealtime ? 'rgba(59, 130, 246, 0.1)' : 'transparent', padding: '4px 8px', borderRadius: '6px', border: isRealtime ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent' }}>
                                        <input type="checkbox" checked={isRealtime} onChange={e => setIsRealtime(e.target.checked)} />
                                        Realtime
                                    </label>
                                </div>
                            </div>
                        </div>
                        
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#888', fontSize: '0.85rem' }}>
                                        <th style={{ padding: '10px', width: '30px' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={selectedFastMovies.length === recentFastScraped.length && recentFastScraped.length > 0}
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedFastMovies(recentFastScraped.map(m => m.link));
                                                    else setSelectedFastMovies([]);
                                                }}
                                            />
                                        </th>
                                        <th style={{ padding: '10px' }}>Poster</th>
                                        <th style={{ padding: '10px' }}>Title</th>
                                        <th style={{ padding: '10px' }}>Year / Type</th>
                                        <th style={{ padding: '10px' }}>Rating</th>
                                        <th style={{ padding: '10px', textAlign: 'right' }}>Scraped Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentFastScraped.map((m, idx) => (
                                        <tr 
                                            key={m.link || idx} 
                                            style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', cursor: 'pointer', transition: 'background 0.2s', background: selectedFastMovies.includes(m.link) ? 'rgba(255, 255, 255, 0.08)' : 'transparent' }}
                                            onClick={() => setSelectedMovie(m)}
                                            onMouseEnter={(e) => { if (!selectedFastMovies.includes(m.link)) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                                            onMouseLeave={(e) => { if (!selectedFastMovies.includes(m.link)) e.currentTarget.style.background = 'transparent' }}
                                        >
                                            <td style={{ padding: '8px 10px' }} onClick={e => e.stopPropagation()}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedFastMovies.includes(m.link)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setSelectedFastMovies(prev => [...prev, m.link]);
                                                        else setSelectedFastMovies(prev => prev.filter(link => link !== m.link));
                                                    }}
                                                />
                                            </td>
                                            <td style={{ padding: '8px 10px' }}>
                                                <img 
                                                    src={m.poster_url} 
                                                    alt={m.title}
                                                    style={{ width: '40px', height: '58px', objectFit: 'cover', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)' }} 
                                                    onError={(e) => { e.target.src = 'placeholder.jpg'; }}
                                                />
                                            </td>
                                            <td style={{ padding: '10px' }}>
                                                <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.9rem' }}>{m.title}</div>
                                                <div style={{ color: '#666', fontSize: '0.78rem' }}>{m.original_title || '—'}</div>
                                            </td>
                                            <td style={{ padding: '10px', fontSize: '0.85rem', color: '#aaa' }}>
                                                <div>{m.year}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#888', textTransform: 'capitalize' }}>
                                                    {m.type === 'movie' ? '🎥 Movie' : '📺 Series'}
                                                </div>
                                            </td>
                                            <td style={{ padding: '10px', fontSize: '0.85rem', color: '#e5c158', fontWeight: 'bold' }}>
                                                ⭐ {m.rating ? m.rating.toFixed(1) : '—'}
                                            </td>
                                            <td style={{ padding: '10px', textAlign: 'right', fontSize: '0.8rem', color: '#888' }}>
                                                {new Date(m.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </td>
                                        </tr>
                                    ))}
                                    {recentFastScraped.length === 0 && (
                                        <tr>
                                            <td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#555', fontStyle: 'italic' }}>
                                                No recently scraped movies found by fast parser.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Recently Scraped Movies Card - Detailed Parser */}
                    <div className="glass-panel animate-fade-in" style={{
                        borderRadius: '15px',
                        padding: '20px',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        background: 'rgba(255, 255, 255, 0.01)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '15px'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                            <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                🔍 Detailed Parser Results <span style={{ fontSize: '0.8rem', color: '#888', fontWeight: 'normal' }}>(Full Info)</span>
                            </h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#888', cursor: 'pointer', background: showBrokenDetailed ? 'rgba(239, 68, 68, 0.1)' : 'transparent', padding: '4px 8px', borderRadius: '6px', border: showBrokenDetailed ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid transparent' }}>
                                    <input type="checkbox" checked={showBrokenDetailed} onChange={e => setShowBrokenDetailed(e.target.checked)} />
                                    Broken
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '0.85rem', color: '#888' }}>~Delay (s):</span>
                                    <input 
                                        type="number" 
                                        min="1" max="60"
                                        value={bulkRefreshDelay} 
                                        onChange={e => setBulkRefreshDelay(parseInt(e.target.value) || 2)} 
                                        style={{ width: '55px', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.5)', color: '#fff' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '0.85rem', color: '#888' }}>Show:</span>
                                    <input 
                                        type="number" 
                                        min="1" max="999"
                                        value={detailedScrapedLimit} 
                                        onChange={e => setDetailedScrapedLimit(parseInt(e.target.value) || 10)} 
                                        style={{ width: '70px', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.5)', color: '#fff' }}
                                    />
                                </div>
                                {selectedDetailedMovies.length > 0 && (
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button 
                                            onClick={() => handleRefreshScrapedMovies(selectedDetailedMovies, 'detailed')}
                                            disabled={refreshState.isRefreshing}
                                            style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '8px', cursor: refreshState.isRefreshing ? 'not-allowed' : 'pointer', fontSize: '0.8rem', fontWeight: 'bold', opacity: refreshState.isRefreshing ? 0.7 : 1 }}
                                        >
                                            {refreshState.isRefreshing && refreshState.type === 'detailed' 
                                                ? `🔄 Refreshing ${refreshState.progress} / ${refreshState.total}`
                                                : `🔄 Refresh (${selectedDetailedMovies.length})`
                                            }
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteScrapedMovies(selectedDetailedMovies, 'detailed')}
                                            style={{ background: 'var(--danger)', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                                        >
                                            🗑 Delete ({selectedDetailedMovies.length})
                                        </button>
                                    </div>
                                )}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <button 
                                        onClick={fetchRecentScraped}
                                        className="btn"
                                        title="Refresh"
                                        style={{ fontSize: '0.8rem', color: '#c084fc', background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.25)', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer' }}
                                    >
                                        🔄
                                    </button>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#888', cursor: 'pointer', background: isRealtime ? 'rgba(59, 130, 246, 0.1)' : 'transparent', padding: '4px 8px', borderRadius: '6px', border: isRealtime ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent' }}>
                                        <input type="checkbox" checked={isRealtime} onChange={e => setIsRealtime(e.target.checked)} />
                                        Realtime
                                    </label>
                                </div>
                            </div>
                        </div>
                        
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#888', fontSize: '0.85rem' }}>
                                        <th style={{ padding: '10px', width: '30px' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={selectedDetailedMovies.length === recentDetailedScraped.length && recentDetailedScraped.length > 0}
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedDetailedMovies(recentDetailedScraped.map(m => m.link));
                                                    else setSelectedDetailedMovies([]);
                                                }}
                                            />
                                        </th>
                                        <th style={{ padding: '10px' }}>Poster</th>
                                        <th style={{ padding: '10px' }}>Title</th>
                                        <th style={{ padding: '10px' }}>Year / Type</th>
                                        <th style={{ padding: '10px' }}>Rating</th>
                                        <th style={{ padding: '10px', textAlign: 'right' }}>Scraped Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentDetailedScraped.map((m, idx) => (
                                        <tr 
                                            key={m.link || idx} 
                                            style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', cursor: 'pointer', transition: 'background 0.2s', background: selectedDetailedMovies.includes(m.link) ? 'rgba(255, 255, 255, 0.08)' : 'transparent' }}
                                            onClick={() => setSelectedMovie(m)}
                                            onMouseEnter={(e) => { if (!selectedDetailedMovies.includes(m.link)) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                                            onMouseLeave={(e) => { if (!selectedDetailedMovies.includes(m.link)) e.currentTarget.style.background = 'transparent' }}
                                        >
                                            <td style={{ padding: '8px 10px' }} onClick={e => e.stopPropagation()}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedDetailedMovies.includes(m.link)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setSelectedDetailedMovies(prev => [...prev, m.link]);
                                                        else setSelectedDetailedMovies(prev => prev.filter(link => link !== m.link));
                                                    }}
                                                />
                                            </td>
                                            <td style={{ padding: '8px 10px' }}>
                                                <img 
                                                    src={m.poster_url} 
                                                    alt={m.title}
                                                    style={{ width: '40px', height: '58px', objectFit: 'cover', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)' }} 
                                                    onError={(e) => { e.target.src = 'placeholder.jpg'; }}
                                                />
                                            </td>
                                            <td style={{ padding: '10px' }}>
                                                <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.9rem' }}>{m.title}</div>
                                                <div style={{ color: '#666', fontSize: '0.78rem' }}>{m.original_title || '—'}</div>
                                            </td>
                                            <td style={{ padding: '10px', fontSize: '0.85rem', color: '#aaa' }}>
                                                <div>{m.year}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#888', textTransform: 'capitalize' }}>
                                                    {m.type === 'movie' ? '🎥 Movie' : '📺 Series'}
                                                </div>
                                            </td>
                                            <td style={{ padding: '10px', fontSize: '0.85rem', color: '#e5c158', fontWeight: 'bold' }}>
                                                ⭐ {m.rating ? m.rating.toFixed(1) : '—'}
                                            </td>
                                            <td style={{ padding: '10px', textAlign: 'right', fontSize: '0.8rem', color: '#888' }}>
                                                {new Date(m.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </td>
                                        </tr>
                                    ))}
                                    {recentDetailedScraped.length === 0 && (
                                        <tr>
                                            <td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#555', fontStyle: 'italic' }}>
                                                No recently scraped movies found by detailed parser.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Users list: Registered */}
                    {(() => {
                        const registeredUsers = users.filter(u => !u.username.startsWith('guest_'));
                        const guestUsers = users.filter(u => u.username.startsWith('guest_'));

                        const renderUserTable = (title, userList, isGuestList) => (
                            <div className="glass-panel animate-fade-in" style={{ borderRadius: '15px', overflow: 'hidden', padding: '20px', marginBottom: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                                    <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem' }}>{title} ({userList.length})</h3>
                                    {isGuestList && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '0.85rem', color: '#888' }}>Show:</span>
                                            <input 
                                                type="number" 
                                                min="1" max="1000"
                                                value={guestsLimit} 
                                                onChange={e => setGuestsLimit(parseInt(e.target.value) || 10)} 
                                                style={{ width: '60px', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.5)', color: '#fff' }}
                                            />
                                        </div>
                                    )}
                                </div>
                                
                                <div className="admin-users-table-view" style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#888', fontSize: '0.85rem' }}>
                                                <th style={{ padding: '12px 15px' }}>Username</th>
                                                <th style={{ padding: '12px 15px' }}>Registration</th>
                                                <th style={{ padding: '12px 15px' }}>Last Location & Login</th>
                                                <th style={{ padding: '12px 15px' }}>Device Telemetry</th>
                                                <th style={{ padding: '12px 15px', textAlign: 'center' }}>Stats</th>
                                                <th style={{ padding: '12px 15px', textAlign: 'right' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {userList.map(u => (
                                                <tr key={u.id} className="admin-user-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                                    <td style={{ padding: '15px', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px', minWidth: '180px' }}>
                                                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(212,175,55,0.1)', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                                            {u.username[0].toUpperCase()}
                                                        </div>
                                                        <span style={{ display: 'flex', flexDirection: 'column' }}>
                                                            <span>@{u.username}</span>
                                                            <span style={{ fontSize: '0.72rem', color: u.username.toLowerCase() === 'radev' ? 'var(--accent-gold)' : '#888', fontWeight: 'normal' }}>
                                                                {u.username.toLowerCase() === 'radev' ? '🛡 Owner/Admin' : u.username.startsWith('guest_') ? '👤 Guest Account' : '👤 Registered User'}
                                                            </span>
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '15px', color: '#aaa', fontSize: '0.85rem' }}>
                                                        <div>{new Date(u.created_at).toLocaleDateString()}</div>
                                                        <div style={{ fontSize: '0.75rem', color: '#666' }}>{new Date(u.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                    </td>
                                                    <td style={{ padding: '15px', color: '#fff', fontSize: '0.85rem' }}>
                                                        <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            {u.last_country || 'Never logged in'}
                                                        </div>
                                                        <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '2px' }}>
                                                            {u.last_login_at ? (
                                                                <>
                                                                    📅 {new Date(u.last_login_at).toLocaleDateString()} {new Date(u.last_login_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </>
                                                            ) : (
                                                                '—'
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '15px', color: '#fff', fontSize: '0.85rem' }}>
                                                        <div style={{ fontFamily: 'monospace', color: '#38bdf8' }}>
                                                            📍 {u.last_ip || 'No IP data'}
                                                        </div>
                                                        <div style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '2px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                            <span>{u.last_device === 'Mobile' ? '📱 Mobile' : u.last_device === 'Tablet' ? '📟 Tablet' : '🖥 Desktop'}</span>
                                                            <span style={{ color: '#555' }}>|</span>
                                                            <span>{u.last_os || 'Unknown OS'}</span>
                                                            <span style={{ color: '#555' }}>|</span>
                                                            <span>{u.last_browser || 'Unknown Browser'}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '15px', textAlign: 'center' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', fontSize: '0.8rem' }}>
                                                            <span style={{ color: '#fff', whiteSpace: 'nowrap' }}>🎬 <strong>{u.movie_count}</strong> movies</span>
                                                            <span style={{ color: '#c084fc', whiteSpace: 'nowrap' }}>📁 <strong>{u.collection_count}</strong> lists</span>
                                                            <span style={{ color: '#03dac6', whiteSpace: 'nowrap' }}>💬 <strong>{u.comment_count || 0}</strong> comments</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '15px', textAlign: 'right' }}>
                                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                            <button
                                                                onClick={() => handleInspectUser(u)}
                                                                className="btn btn-ghost"
                                                                style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '6px 12px', fontSize: '0.85rem', borderRadius: '8px' }}
                                                            >
                                                                🔍 Inspect
                                                            </button>
                                                            {adminFeedback.id === u.id && adminFeedback.message && (
                                                                <span style={{
                                                                    fontSize: '0.8rem',
                                                                    color: adminFeedback.type === 'success' ? '#03dac6' : 'var(--danger)',
                                                                    fontWeight: 'bold',
                                                                    marginRight: '8px'
                                                                }}>
                                                                    {adminFeedback.message}
                                                                </span>
                                                            )}
                                                            {u.username.toLowerCase() !== 'radev' && (
                                                                <>
                                                                    {resetPasswordUserId === u.id ? (
                                                                        <div style={{ display: 'flex', gap: '5px', alignItems: 'center', background: 'rgba(212,175,55,0.05)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(212,175,55,0.2)' }}>
                                                                            <input
                                                                                type="text"
                                                                                placeholder="New password (blank for Reset123!)"
                                                                                value={newPasswordVal}
                                                                                onChange={e => setNewPasswordVal(e.target.value)}
                                                                                style={{
                                                                                    background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                                                                                    color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '0.78rem',
                                                                                    width: '180px', outline: 'none'
                                                                                }}
                                                                            />
                                                                            <button
                                                                                onClick={() => handleResetPassword(u)}
                                                                                style={{ background: 'var(--accent-gold)', color: '#000', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold' }}
                                                                            >Save</button>
                                                                            <button
                                                                                onClick={() => { setResetPasswordUserId(null); setNewPasswordVal(''); }}
                                                                                style={{ background: 'rgba(255,255,255,0.08)', color: '#aaa', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer' }}
                                                                            >Cancel</button>
                                                                        </div>
                                                                    ) : confirmDeleteUserId === u.id ? (
                                                                        <span style={{ display: 'flex', gap: '5px', alignItems: 'center', background: 'rgba(239,68,68,0.08)', padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }}>
                                                                            <span style={{ fontSize: '0.78rem', color: '#ff6b6b', fontWeight: 'bold' }}>Delete user?</span>
                                                                            <button
                                                                                onClick={() => handleDeleteUser(u)}
                                                                                style={{ background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold' }}
                                                                            >Yes</button>
                                                                            <button
                                                                                onClick={() => setConfirmDeleteUserId(null)}
                                                                                style={{ background: 'rgba(255,255,255,0.08)', color: '#aaa', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer' }}
                                                                            >No</button>
                                                                        </span>
                                                                    ) : (
                                                                        <>
                                                                            <button
                                                                                onClick={() => setResetPasswordUserId(u.id)}
                                                                                className="btn"
                                                                                style={{
                                                                                    background: 'rgba(212, 175, 55, 0.1)',
                                                                                    color: 'var(--accent-gold)',
                                                                                    border: '1px solid rgba(212, 175, 55, 0.2)',
                                                                                    padding: '6px 12px',
                                                                                    fontSize: '0.85rem',
                                                                                    borderRadius: '8px',
                                                                                    fontWeight: 500
                                                                                }}
                                                                            >
                                                                                🔑 Reset
                                                                            </button>
                                                                            <button
                                                                                onClick={() => setConfirmDeleteUserId(u.id)}
                                                                                className="btn btn-ghost"
                                                                                style={{
                                                                                    color: 'var(--danger)',
                                                                                    border: '1px solid rgba(239, 68, 68, 0.1)',
                                                                                    padding: '6px 10px',
                                                                                    fontSize: '0.85rem',
                                                                                    borderRadius: '8px'
                                                                                }}
                                                                                title="Delete User"
                                                                            >
                                                                                🗑
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile Cards View */}
                                <div className="admin-users-cards-view" style={{ display: 'none', flexDirection: 'column', gap: '15px' }}>
                                    {userList.map(u => (
                                        <div key={u.id} className="glass-panel animate-fade-in" style={{ padding: '15px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(212,175,55,0.1)', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                                        {u.username[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div style={{ color: '#fff', fontWeight: 600, fontSize: '1rem' }}>@{u.username}</div>
                                                        <div style={{ fontSize: '0.75rem', color: u.username.toLowerCase() === 'radev' ? 'var(--accent-gold)' : '#888' }}>
                                                            {u.username.toLowerCase() === 'radev' ? '🛡 Owner/Admin' : u.username.startsWith('guest_') ? '👤 Guest Account' : '👤 Registered User'}
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleInspectUser(u)}
                                                    className="btn btn-ghost"
                                                    style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '6px 10px', fontSize: '0.8rem', borderRadius: '6px' }}
                                                >
                                                    🔍 Inspect
                                                </button>
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.85rem' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                    <span style={{ color: '#666', fontSize: '0.75rem' }}>Registration</span>
                                                    <span style={{ color: '#aaa' }}>{new Date(u.created_at).toLocaleDateString()}</span>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                    <span style={{ color: '#666', fontSize: '0.75rem' }}>Last Login</span>
                                                    <span style={{ color: '#aaa' }}>{u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : '—'}</span>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                    <span style={{ color: '#666', fontSize: '0.75rem' }}>Location</span>
                                                    <span style={{ color: '#fff' }}>{u.last_country || 'Unknown'}</span>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                    <span style={{ color: '#666', fontSize: '0.75rem' }}>Device</span>
                                                    <span style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{u.last_device || 'Unknown'}</span>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', justifyContent: 'space-around', padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                <span style={{ color: '#fff', fontSize: '0.85rem' }}>🎬 <strong>{u.movie_count}</strong></span>
                                                <span style={{ color: '#c084fc', fontSize: '0.85rem' }}>📁 <strong>{u.collection_count}</strong></span>
                                                <span style={{ color: '#03dac6', fontSize: '0.85rem' }}>💬 <strong>{u.comment_count || 0}</strong></span>
                                            </div>

                                            {u.username.toLowerCase() !== 'radev' && (
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    {resetPasswordUserId === u.id ? (
                                                        <div style={{ display: 'flex', flex: 1, gap: '5px', background: 'rgba(212,175,55,0.05)', padding: '6px', borderRadius: '8px', border: '1px solid rgba(212,175,55,0.2)' }}>
                                                            <input
                                                                type="text"
                                                                placeholder="New pw (blank=Reset123!)"
                                                                value={newPasswordVal}
                                                                onChange={e => setNewPasswordVal(e.target.value)}
                                                                style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', padding: '4px 6px', fontSize: '0.78rem', width: '100%', outline: 'none' }}
                                                            />
                                                            <button onClick={() => handleResetPassword(u)} style={{ background: 'var(--accent-gold)', color: '#000', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '0.75rem', fontWeight: 'bold' }}>Save</button>
                                                            <button onClick={() => { setResetPasswordUserId(null); setNewPasswordVal(''); }} style={{ background: 'rgba(255,255,255,0.08)', color: '#aaa', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '0.75rem' }}>✕</button>
                                                        </div>
                                                    ) : confirmDeleteUserId === u.id ? (
                                                        <div style={{ display: 'flex', flex: 1, justifyContent: 'space-between', alignItems: 'center', background: 'rgba(239,68,68,0.08)', padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }}>
                                                            <span style={{ fontSize: '0.78rem', color: '#ff6b6b', fontWeight: 'bold' }}>Delete?</span>
                                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                                <button onClick={() => handleDeleteUser(u)} style={{ background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '0.75rem', fontWeight: 'bold' }}>Yes</button>
                                                                <button onClick={() => setConfirmDeleteUserId(null)} style={{ background: 'rgba(255,255,255,0.08)', color: '#aaa', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '0.75rem' }}>No</button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            {adminFeedback.id === u.id && adminFeedback.message ? (
                                                                <span style={{ fontSize: '0.8rem', color: adminFeedback.type === 'success' ? '#03dac6' : 'var(--danger)', fontWeight: 'bold' }}>
                                                                    {adminFeedback.message}
                                                                </span>
                                                            ) : <div />}
                                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                                <button
                                                                    onClick={() => setResetPasswordUserId(u.id)}
                                                                    className="btn"
                                                                    style={{ background: 'rgba(212, 175, 55, 0.1)', color: 'var(--accent-gold)', border: '1px solid rgba(212, 175, 55, 0.2)', padding: '5px 10px', fontSize: '0.8rem', borderRadius: '6px', fontWeight: 500 }}
                                                                >
                                                                    🔑 Reset
                                                                </button>
                                                                <button
                                                                    onClick={() => setConfirmDeleteUserId(u.id)}
                                                                    className="btn btn-ghost"
                                                                    style={{ color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.1)', padding: '5px 10px', fontSize: '0.8rem', borderRadius: '6px' }}
                                                                >
                                                                    🗑 Delete
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );

                        return (
                            <>
                                {renderUserTable('Registered Users', registeredUsers, false)}
                                {renderUserTable('Guest Users', guestUsers.slice(0, guestsLimit), true)}
                            </>
                        );
                    })()}
                </div>
            ) : (
                // VIEW 2: Inspecting Specific User Data
                <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                    {/* User profile overview */}
                    <div className="glass-panel" style={{ padding: '20px 25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(212,175,55,0.1)', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.4rem' }}>
                                {selectedUser.username[0].toUpperCase()}
                            </div>
                            <div>
                                <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem' }}>@{selectedUser.username}</h3>
                                <p style={{ margin: '3px 0 0 0', color: '#888', fontSize: '0.85rem' }}>
                                    Joined: {new Date(selectedUser.created_at).toLocaleDateString()}
                                </p>
                            </div>
                        </div>

                        {/* Subtabs toggle */}
                        <div className="glass-panel" style={{ display: 'inline-flex', padding: '4px', borderRadius: '10px', gap: '4px' }}>
                            <button
                                onClick={() => { setActiveSubTab('movies'); setExpandedCollectionId(null); }}
                                className="btn"
                                style={{
                                    background: activeSubTab === 'movies' ? 'var(--accent-gold)' : 'transparent',
                                    color: activeSubTab === 'movies' ? '#000' : '#888',
                                    borderRadius: '8px',
                                    padding: '8px 16px',
                                    fontWeight: 600,
                                    fontSize: '0.9rem'
                                }}
                            >
                                Movies ({userData.movies.length})
                            </button>
                            <button
                                onClick={() => { setActiveSubTab('collections'); setExpandedCollectionId(null); }}
                                className="btn"
                                style={{
                                    background: activeSubTab === 'collections' ? 'var(--accent-gold)' : 'transparent',
                                    color: activeSubTab === 'collections' ? '#000' : '#888',
                                    borderRadius: '8px',
                                    padding: '8px 16px',
                                    fontWeight: 600,
                                    fontSize: '0.9rem'
                                }}
                            >
                                Collections ({userData.collections.length})
                            </button>
                        </div>
                    </div>

                    {userLoading ? (
                        <div style={{ textAlign: 'center', padding: '50px', color: '#888' }}>Loading library contents...</div>
                    ) : activeSubTab === 'movies' ? (
                        // User's Movies Grid
                        userData.movies.length === 0 ? (
                            <div className="glass-panel" style={{ textAlign: 'center', padding: '50px', color: '#888' }}>
                                This user's library is empty.
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '20px' }}>
                                {userData.movies.map(movie => (
                                    <div
                                        key={movie.id}
                                        className="glass-panel movie-card animate-fade-in"
                                        onClick={() => setSelectedMovie(movie)}
                                        style={{
                                            position: 'relative', cursor: 'pointer', borderRadius: '12px',
                                            overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)',
                                            aspectRatio: '2/3', transition: 'transform 0.2s'
                                        }}
                                    >
                                        <img
                                            src={movie.poster_url}
                                            alt={movie.title}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                        <div style={{
                                            position: 'absolute', bottom: 0, left: 0, width: '100%',
                                            padding: '20px 10px 10px', zIndex: 2,
                                            background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)'
                                        }}>
                                            <h4 style={{
                                                fontSize: '0.9rem', color: '#fff', margin: '0 0 4px 0',
                                                textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap'
                                            }}>
                                                {movie.title}
                                            </h4>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#aaa' }}>
                                                <span>{movie.year}</span>
                                                <span style={{ color: 'var(--accent-gold)' }}>★ {movie.rating || '-'}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    ) : (
                        // User's Collections List
                        userData.collections.length === 0 ? (
                            <div className="glass-panel" style={{ textAlign: 'center', padding: '50px', color: '#888' }}>
                                This user hasn't created any collections.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {userData.collections.map(c => {
                                    const isExpanded = expandedCollectionId === c.id;
                                    return (
                                        <div
                                            key={c.id}
                                            className="glass-panel animate-fade-in"
                                            style={{
                                                border: isExpanded ? '1px solid var(--accent-gold)' : '1px solid rgba(255,255,255,0.05)',
                                                borderRadius: '12px', overflow: 'hidden',
                                                transition: 'all 0.3s ease'
                                            }}
                                        >
                                            <div
                                                onClick={async () => {
                                                    if (isExpanded) {
                                                        setExpandedCollectionId(null);
                                                    } else {
                                                        setExpandedCollectionId(c.id);
                                                        // Fetch expanded collection's movies
                                                        try {
                                                            const res = await fetch(`/api/collections/${c.id}`);
                                                            if (res.ok) {
                                                                const data = await res.json();
                                                                setExpandedCollection(data);
                                                            }
                                                        } catch (err) {
                                                            console.error(err);
                                                        }
                                                    }
                                                }}
                                                style={{
                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                    padding: '20px 25px', cursor: 'pointer', background: 'rgba(255,255,255,0.01)',
                                                    flexWrap: 'wrap', gap: '15px'
                                                }}
                                                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.01)'}
                                            >
                                                <div>
                                                    <h3 style={{ margin: '0 0 5px 0', fontSize: '1.2rem', color: 'var(--accent-gold)' }}>
                                                        {c.title}
                                                    </h3>
                                                    <p style={{ margin: 0, color: '#aaa', fontSize: '0.85rem' }}>
                                                        {c.description || 'No description provided.'}
                                                    </p>
                                                </div>
                                                <span style={{
                                                    background: 'rgba(212, 175, 55, 0.1)', color: 'var(--accent-gold)',
                                                    padding: '4px 10px', borderRadius: '15px', fontSize: '0.8rem', fontWeight: 'bold'
                                                }}>
                                                    {c.movie_count} Movie(s)
                                                </span>
                                            </div>

                                            {isExpanded && (
                                                <div style={{ padding: '25px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}>
                                                    {!expandedCollection || expandedCollection.id !== c.id ? (
                                                        <div style={{ textAlign: 'center', color: '#555' }}>Loading movies...</div>
                                                    ) : expandedCollection.movies.length === 0 ? (
                                                        <div style={{ textAlign: 'center', color: '#555', fontStyle: 'italic' }}>
                                                            This collection has no movies.
                                                        </div>
                                                    ) : (
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '20px' }}>
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
                                                                    <div style={{
                                                                        position: 'absolute', bottom: 0, left: 0, width: '100%',
                                                                        padding: '20px 10px 10px', zIndex: 2,
                                                                        background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)'
                                                                    }}>
                                                                        <h4 style={{
                                                                            fontSize: '0.8rem', color: '#fff', margin: '0 0 2px 0',
                                                                            textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap'
                                                                        }}>
                                                                            {movie.title}
                                                                        </h4>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#aaa' }}>
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
                        )
                    )}
                </div>
            )}

            {!loading && !selectedUser && (
                <div style={{
                    marginTop: '40px',
                    padding: '20px',
                    background: '#1a1a2e',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.1)'
                }}>
                    <h3 style={{ margin: '0 0 15px 0', color: '#fff', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        ⚙️ Настройки анимации загрузки
                    </h3>
                    <div style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '0.95rem', cursor: 'pointer' }}>
                            <input 
                                type="radio" 
                                name="matrixAnimationType"
                                value="3D"
                                checked={systemSettings.matrixAnimationType === '3D'}
                                onChange={(e) => setSystemSettings({ ...systemSettings, matrixAnimationType: e.target.value })}
                                style={{ accentColor: '#3b82f6', cursor: 'pointer' }}
                            />
                            3D Матрица (полет)
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '0.95rem', cursor: 'pointer' }}>
                            <input 
                                type="radio" 
                                name="matrixAnimationType"
                                value="2D"
                                checked={systemSettings.matrixAnimationType === '2D'}
                                onChange={(e) => setSystemSettings({ ...systemSettings, matrixAnimationType: e.target.value })}
                                style={{ accentColor: '#3b82f6', cursor: 'pointer' }}
                            />
                            2D Дождь (классика)
                        </label>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fff', fontSize: '0.95rem', marginBottom: '15px', cursor: 'pointer' }}>
                        <input 
                            type="checkbox" 
                            checked={systemSettings.useSloganInMatrix}
                            onChange={(e) => setSystemSettings({ ...systemSettings, useSloganInMatrix: e.target.checked })}
                            style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#3b82f6' }}
                        />
                        Использовать слоган сайта в анимации матрицы
                    </label>
                    <p style={{ color: '#aaa', fontSize: '0.85rem', marginBottom: '15px' }}>
                        Дополнительные слова и фразы, которые будут падать во время поиска трейлера. (Разделяйте запятыми)
                    </p>
                    <textarea
                        value={matrixPhrasesRaw}
                        onChange={(e) => setMatrixPhrasesRaw(e.target.value)}
                        placeholder="searching trailers, preparing video, please wait"
                        style={{
                            width: '100%',
                            minHeight: '80px',
                            background: '#0f0f1a',
                            border: '1px solid rgba(255,255,255,0.2)',
                            color: '#fff',
                            padding: '12px',
                            borderRadius: '8px',
                            fontSize: '0.9rem',
                            resize: 'vertical',
                            marginBottom: '15px'
                        }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <button
                            onClick={handleSaveSettings}
                            disabled={savingSettings}
                            style={{
                                background: '#3b82f6',
                                color: '#fff',
                                border: 'none',
                                padding: '10px 20px',
                                borderRadius: '8px',
                                cursor: savingSettings ? 'not-allowed' : 'pointer',
                                fontWeight: 'bold',
                                opacity: savingSettings ? 0.7 : 1,
                                transition: '0.2s'
                            }}
                        >
                            {savingSettings ? 'Сохранение...' : '💾 Сохранить фразы'}
                        </button>
                        {adminFeedback.id === 'settings' && (
                            <span style={{
                                color: adminFeedback.type === 'error' ? '#ff4444' : '#00C851',
                                fontSize: '0.9rem',
                                animation: 'fadeIn 0.3s'
                            }}>
                                {adminFeedback.message}
                            </span>
                        )}
                    </div>
                </div>
            )}

            <style>{`
                .admin-user-row {
                    transition: background 0.2s ease;
                }
                .admin-user-row:hover {
                    background: rgba(255, 255, 255, 0.015);
                }
                .crawler-status-indicator {
                    animation: pulse 2.5s infinite;
                }
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 0.7; box-shadow: 0 0 0 0 rgba(3, 218, 198, 0.5); }
                    70% { transform: scale(1.2); opacity: 1; box-shadow: 0 0 0 8px rgba(3, 218, 198, 0); }
                    100% { transform: scale(1); opacity: 0.7; box-shadow: 0 0 0 0 rgba(3, 218, 198, 0); }
                }
            `}</style>
        </div>
    );
}

export default AdminDashboard;
